import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { AuthEventType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { HashingService } from '../../../shared/hashing/hashing.service';
import { CaptchaService } from '../captcha/captcha.service';
import { AuthEventService } from './auth-event.service';
import {
  RegisterAgencyDto,
  AgencyLoginDto,
  RegisterAgencyAgentDto,
  RegisterAgentDto,
  LoginDto,
} from '../dto/auth.dto';

export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'REGISTER_SUCCESS',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUEST',
  'PASSWORD_RESET_SUCCESS',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_SUCCESS',
  'MFA_FAILURE',
  'MFA_LOCKOUT',
  'TOKEN_REFRESH',
  'TOKEN_REUSE_DETECTED',
  'SESSION_REVOKED',
  'IMPOSSIBLE_TRAVEL_DETECTED',
  'CAPTCHA_REQUIRED',
  'CAPTCHA_FAILED',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

const UNKNOWN_AUDIT_ACTION = 'UNKNOWN_ACTION' as const;
type AuditActionOrUnknown = AuditAction | typeof UNKNOWN_AUDIT_ACTION;

const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS);
const FAILED_LOGIN_CAPTCHA_THRESHOLD = 3;
const IP_LOCKOUT_THRESHOLD = 20;

const AUDIT_ACTION_TO_EVENT_TYPE: Record<AuditAction, AuthEventType> = {
  LOGIN_SUCCESS: AuthEventType.LOGIN_SUCCESS,
  LOGIN_FAILURE: AuthEventType.LOGIN_FAILED,
  LOGOUT: AuthEventType.LOGOUT,
  REGISTER_SUCCESS: AuthEventType.REGISTER_SUCCESS,
  EMAIL_VERIFIED: AuthEventType.EMAIL_VERIFIED,
  PASSWORD_RESET_REQUEST: AuthEventType.PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_SUCCESS: AuthEventType.PASSWORD_CHANGED,
  MFA_ENABLED: AuthEventType.MFA_ENABLED,
  MFA_DISABLED: AuthEventType.MFA_DISABLED,
  MFA_SUCCESS: AuthEventType.MFA_SUCCESS,
  MFA_FAILURE: AuthEventType.MFA_FAILED,
  MFA_LOCKOUT: AuthEventType.MFA_LOCKOUT,
  TOKEN_REFRESH: AuthEventType.TOKEN_REFRESHED,
  TOKEN_REUSE_DETECTED: AuthEventType.TOKEN_REUSE_DETECTED,
  SESSION_REVOKED: AuthEventType.SESSION_REVOKED_ALL,
  IMPOSSIBLE_TRAVEL_DETECTED: AuthEventType.IMPOSSIBLE_TRAVEL_FLAGGED,
  CAPTCHA_REQUIRED: AuthEventType.LOGIN_BLOCKED_CAPTCHA,
  CAPTCHA_FAILED: AuthEventType.LOGIN_BLOCKED_CAPTCHA,
  ACCOUNT_LOCKED: AuthEventType.LOGIN_BLOCKED_IP,
  ACCOUNT_UNLOCKED: AuthEventType.ACCOUNT_UNLOCKED,
};

@Injectable()
export class AuthService implements OnModuleInit {
  private DUMMY_HASH!: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
    private hashingService: HashingService,
    private captchaService: CaptchaService,
    private authEventService: AuthEventService,
    private configService: ConfigService,
  ) {
    if (this.configService.get('NODE_ENV') !== 'production') {
      nodemailer
        .createTestAccount()
        .then((account) => {
          this.transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
              user: account.user,
              pass: account.pass,
            },
          });
        })
        .catch((err) => {
          this.logger.warn(
            'Could not create nodemailer test account. Verification URLs will only be logged.',
            err.message,
          );
        });
    }
  }

  async onModuleInit() {
    this.DUMMY_HASH = await this.hashingService.hash('dummy_password_for_timing_attack_mitigation');
    this.resend = new Resend(this.configService.getOrThrow<string>('RESEND_API_KEY'));
  }

  private resend!: Resend;
  private transporter: nodemailer.Transporter;

  private async sendVerificationEmail(
    email: string,
    token: string,
    type: 'agency' | 'agency-agent' | 'agent',
  ) {
    const verifyUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/verify-email?token=${token}&type=${type}`;
    try {
      if (this.configService.get('NODE_ENV') === 'production') {
        const { error } = await this.resend.emails.send({
          from: 'AeroFlux <noreply@aeroflux.com>', // assuming production domain will be verified
          to: email,
          subject: 'Verify your email address',
          html: `<p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p>`,
        });
        if (error) {
          this.logger.error('Resend error:', error);
        }
      } else {
        if (this.transporter) {
          const info = await this.transporter.sendMail({
            from: '"AeroFlux Dev" <onboarding@resend.dev>',
            to: email,
            subject: 'Verify your email address',
            html: `<p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p>`,
          });
          this.logger.log(`[VERIFICATION EMAIL] URL: ${verifyUrl}`);
          this.logger.log(
            `Nodemailer test email preview URL: ${nodemailer.getTestMessageUrl(info)}`,
          );
        } else {
          this.logger.log(`[VERIFICATION EMAIL] URL: ${verifyUrl}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to send verification email exception:', error);
    }
  }

  private logAuditEvent(
    action: AuditAction,
    email: string,
    success: boolean,
    ip: string,
    userAgent: string,
    metadata: any = {},
  ) {
    const resolvedAction = this.resolveAuditAction(action as string);
    const type =
      resolvedAction === UNKNOWN_AUDIT_ACTION
        ? AuthEventType.UNKNOWN_ACTION
        : AUDIT_ACTION_TO_EVENT_TYPE[resolvedAction];

    const payload = {
      action: resolvedAction,
      email,
      success,
      ...(resolvedAction === UNKNOWN_AUDIT_ACTION ? { originalAction: action } : {}),
      ...metadata,
    };
    
    // Fire and forget
    this.authEventService.logEvent({
      type,
      ip,
      userAgent,
      metadata: payload,
    }).catch(e => this.logger.error('Failed to save audit event', e));
  }

  private resolveAuditAction(action: string): AuditActionOrUnknown {
    if (AUDIT_ACTION_SET.has(action)) {
      return action as AuditAction;
    }

    if (this.configService.get('NODE_ENV') !== 'production') {
      throw new Error(`Unknown audit action: ${action}`);
    }

    this.logger.warn(`[AUDIT] Unknown audit action received: ${action}`);
    return UNKNOWN_AUDIT_ACTION;
  }

  private async verifyFailedAttempts(email: string, ip: string, captchaToken?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    let attempts: string | null;

    try {
      attempts = await this.redis.get(`failed_login:${normalizedEmail}`);
    } catch (e) {
      this.logger.warn('Failed login Redis check failed - blocking request as fail-safe');
      this.logger.error(
        'Redis unavailable during failed login counter check',
        e instanceof Error ? e.stack : String(e),
      );
      throw new ServiceUnavailableException('Auth service temporarily unavailable');
    }

    if (attempts && parseInt(attempts, 10) >= FAILED_LOGIN_CAPTCHA_THRESHOLD) {
      if (!captchaToken) {
        throw new UnauthorizedException('CAPTCHA_REQUIRED');
      }
      const isValid = await this.captchaService.verify(captchaToken, ip);
      if (!isValid) {
        throw new UnauthorizedException('CAPTCHA_REQUIRED');
      }
    }
  }

  private async incrementFailedAttempts(email: string, ip: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const count = await this.redis.incr(`failed_login:${normalizedEmail}`);
    if (count === 1) {
      await this.redis.expire(`failed_login:${normalizedEmail}`, 900);
    }
    await this.trackIpAttempt(ip);
  }

  private async resetFailedAttempts(email: string, ip: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.redis.del(`failed_login:${normalizedEmail}`);
    if (ip) {
      const hashedIp = this.hashIp(ip);
      await this.redis.del(`failed_login_ip:${hashedIp}`);
    }
  }

  private async checkImpossibleTravel(
    email: string,
    currentIp: string,
    currentUserAgent: string,
  ) {
    const lastLoginStr = await this.redis.get(`last_login_meta:${email}`);
    if (lastLoginStr) {
      const lastLogin = JSON.parse(lastLoginStr);
      if (lastLogin.ip && lastLogin.ip !== currentIp) {
        this.logAuditEvent(
          'IMPOSSIBLE_TRAVEL_DETECTED',
          email,
          false,
          currentIp,
          currentUserAgent,
          {
            reason: 'Impossible Travel / Unrecognized IP',
            previousIp: lastLogin.ip,
          },
        );
      }
    }
    await this.redis.set(
      `last_login_meta:${email}`,
      JSON.stringify({
        ip: currentIp,
        userAgent: currentUserAgent,
        timestamp: Date.now(),
      }),
      'EX',
      86400 * 30,
    );
  }

  private hashIp(ip: string): string {
    const secret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
    return crypto.createHmac('sha256', secret).update(ip).digest('hex');
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async trackIpAttempt(ip: string): Promise<void> {
    const hashedIp = this.hashIp(ip);
    try {
      // Redis key for tracking failed logins per IP to prevent botnet brute force. TTL 1 hour (3600s).
      const key = `failed_login_ip:${hashedIp}`;
      await this.redis.pipeline().incr(key).expire(key, 3600).exec();
    } catch (redisError) {
      this.logger.error(
        'trackIpAttempt: Redis write failed — failing closed to prevent lockout bypass',
        {
          hashedIp,
          error: redisError instanceof Error ? redisError.message : String(redisError),
          stack: redisError instanceof Error ? redisError.stack : undefined,
        },
      );
      throw new ServiceUnavailableException('Auth service temporarily unavailable');
    }
  }

  private async checkIpLockout(ip: string): Promise<void> {
    const hash = this.hashIp(ip);
    let attempts: string | null;

    try {
      attempts = await this.redis.get(`failed_login_ip:${hash}`);
    } catch (e) {
      this.logger.warn('IP lockout Redis check failed — blocking request as fail-safe');
      this.logger.error(
        'Redis unavailable during IP lockout check',
        e instanceof Error ? e.stack : String(e),
      );
      throw new ServiceUnavailableException('Auth service temporarily unavailable');
    }

    if (attempts && parseInt(attempts, 10) >= IP_LOCKOUT_THRESHOLD) {
      throw new TooManyRequestsException('Too many requests from this IP');
    }
  }

  async registerAgency(
    data: RegisterAgencyDto,
    ip: string = '',
    userAgent: string = '',
  ) {

    const existingAgency = await this.prisma.agency.findUnique({
      where: { agencyAdminEmail: data.agencyAdminEmail },
    });
    if (existingAgency) {
      // To prevent user enumeration, we do not throw an error if the agency is already registered.
      return {
        message: 'If this email is new, a verification link has been sent',
      };
    }

    const agencyAdminPasswordHash = await this.hashingService.hash(
      data.agencyAdminPassword,
    );
    let agencySlug = data.agencyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    let slugExists = await this.prisma.agency.findUnique({
      where: { agencySlug },
    });
    let counter = 1;
    const baseSlug = agencySlug;
    while (slugExists) {
      agencySlug = `${baseSlug}-${counter}`;
      slugExists = await this.prisma.agency.findUnique({
        where: { agencySlug },
      });
      counter++;
    }

    const rawAgencySecret = `SEC-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const agencySecretHash = await this.hashingService.hash(rawAgencySecret);

    const agency = await this.prisma.agency.create({
      data: {
        agencyName: data.agencyName,
        agencyAddress: data.agencyAddress,
        agencySlug,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        agencyAdminName: data.agencyAdminName,
        agencyAdminEmail: data.agencyAdminEmail,
        agencyAdminPasswordHash,
        agencySecretHash,
        subscription: {
          create: {
            plan: 'FREE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });


    this.logAuditEvent(
      'REGISTER_SUCCESS',
      agency.agencyAdminEmail,
      true,
      ip,
      userAgent,
    );

    const emailVerificationToken = this.generateVerificationToken(
      agency.id,
      'Agency',
    );
    await this.sendVerificationEmail(
      agency.agencyAdminEmail,
      emailVerificationToken,
      'agency',
    );

    return {
      message: 'If this email is new, a verification link has been sent',
    };
  }

  async loginAgency(
    data: AgencyLoginDto,
    ip: string = '',
    userAgent: string = '',
  ) {
    try {
      await this.checkIpLockout(ip);
    } catch (e) {
      if (e instanceof TooManyRequestsException) {
        this.logAuditEvent('ACCOUNT_LOCKED', data.agencyAdminEmail, false, ip, userAgent, { reason: 'Too many attempts from this location' });
      }
      throw e;
    }

    await this.verifyFailedAttempts(data.agencyAdminEmail, ip, data.captchaToken);

    const agency = await this.prisma.agency.findUnique({
      where: { agencyAdminEmail: data.agencyAdminEmail },
    });

    if (!agency || !agency.isActive) {
      // Mitigate timing attacks by performing a dummy hash comparison
      await this.hashingService.compare(
        data.agencyAdminPassword,
        this.DUMMY_HASH,
      );
      await this.incrementFailedAttempts(data.agencyAdminEmail, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.agencyAdminEmail, false, ip, userAgent, {
        reason: !agency ? 'USER_NOT_FOUND' : 'ACCOUNT_INACTIVE',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.hashingService.compare(
      data.agencyAdminPassword,
      agency.agencyAdminPasswordHash,
    );
    if (!isPasswordValid) {
      await this.incrementFailedAttempts(data.agencyAdminEmail, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.agencyAdminEmail, false, ip, userAgent, {
        reason: 'WRONG_PASSWORD',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agency.isEmailVerified) {
      await this.incrementFailedAttempts(data.agencyAdminEmail, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.agencyAdminEmail, false, ip, userAgent, {
        reason: 'EMAIL_NOT_VERIFIED',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.resetFailedAttempts(data.agencyAdminEmail, ip);

    await this.redis.sadd('login_updates:agency', agency.id);

    this.logAuditEvent('LOGIN_SUCCESS', data.agencyAdminEmail, true, ip, userAgent, {
      mfaPending: agency.isMfaEnabled,
    });
    await this.checkImpossibleTravel(data.agencyAdminEmail, ip, userAgent);

    if (agency.isMfaEnabled) {
      return this.generateMfaTempToken(
        agency.id,
        agency.agencyAdminEmail,
        agency.id,
        'AGENCY_ADMIN',
        'Agency',
      );
    }

    return await this.generateToken(
      agency.id,
      agency.agencyAdminEmail,
      agency.id,
      'AGENCY_ADMIN',
      'Agency',
    );
  }

  async registerAgencyAgent(
    data: RegisterAgencyAgentDto,
    ip: string = '',
    userAgent: string = '',
  ) {
    const agency = await this.prisma.agency.findUnique({
      where: { agencyPublicId: data.agencyPublicId },
    });

    if (!agency || !agency.isActive) {
      return {
        message: 'If this email is new, a verification link has been sent',
      };
    }

    const isCodeValid = await this.hashingService.compare(
      data.agencySecret,
      agency.agencySecretHash,
    );
    if (!isCodeValid) {
      return {
        message: 'If this email is new, a verification link has been sent.',
      };
    }

    const existingAgent = await this.prisma.agencyAgent.findUnique({
      where: { email: data.email },
    });
    if (existingAgent) {
      // To prevent user enumeration, we do not throw here.
      return {
        message: 'If this email is new, a verification link has been sent',
      };
    }

    const passwordHash = await this.hashingService.hash(data.password);

    const agent = await this.prisma.agencyAgent.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        name: data.name,
        role: data.role || 'AGENT',
        agencyId: agency.id,
      },
    });

    this.logAuditEvent(
      'REGISTER_SUCCESS',
      agent.email,
      true,
      ip,
      userAgent,
    );


    const emailVerificationToken = this.generateVerificationToken(
      agent.id,
      'AgencyAgent',
    );
    await this.sendVerificationEmail(
      agent.email,
      emailVerificationToken,
      'agency-agent',
    );

    return {
      message: 'If this email is new, a verification link has been sent',
    };
  }

  async loginAgencyAgent(
    data: LoginDto,
    ip: string = '',
    userAgent: string = '',
  ) {
    try {
      await this.checkIpLockout(ip);
    } catch (e) {
      if (e instanceof TooManyRequestsException) {
        this.logAuditEvent('ACCOUNT_LOCKED', data.email, false, ip, userAgent, { reason: 'Too many attempts from this location' });
      }
      throw e;
    }

    await this.verifyFailedAttempts(data.email, ip, data.captchaToken);

    const agent = await this.prisma.agencyAgent.findUnique({
      where: { email: data.email },
    });

    if (!agent || !agent.isActive) {
      await this.hashingService.compare(data.password, this.DUMMY_HASH);
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: !agent ? 'USER_NOT_FOUND' : 'ACCOUNT_INACTIVE',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.hashingService.compare(
      data.password,
      agent.passwordHash,
    );
    if (!isPasswordValid) {
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: 'WRONG_PASSWORD',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agent.isEmailVerified) {
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: 'EMAIL_NOT_VERIFIED',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.resetFailedAttempts(data.email, ip);

    await this.redis.sadd('login_updates:agencyAgent', agent.id);

    this.logAuditEvent('LOGIN_SUCCESS', data.email, true, ip, userAgent, {
      mfaPending: agent.isMfaEnabled,
    });
    await this.checkImpossibleTravel(data.email, ip, userAgent);

    if (agent.isMfaEnabled) {
      return this.generateMfaTempToken(
        agent.id,
        agent.email,
        agent.agencyId,
        agent.role,
        'AgencyAgent',
      );
    }

    return await this.generateToken(
      agent.id,
      agent.email,
      agent.agencyId,
      agent.role,
      'AgencyAgent',
    );
  }

  async registerAgent(
    data: RegisterAgentDto,
    ip: string = '',
    userAgent: string = '',
  ) {
    const existingAgent = await this.prisma.agent.findUnique({
      where: { email: data.email },
    });
    if (existingAgent) {
      // To prevent user enumeration, we do not throw here.
      return {
        message: 'If this email is new, a verification link has been sent',
      };
    }

    const passwordHash = await this.hashingService.hash(data.password);

    const agent = await this.prisma.agent.create({
      data: {
        email: data.email,
        phone: data.phone,
        address: data.address,
        passwordHash,
        name: data.name,
      },
    });

    this.logAuditEvent('REGISTER_SUCCESS', agent.email, true, ip, userAgent);


    const emailVerificationToken = this.generateVerificationToken(
      agent.id,
      'Agent',
    );
    await this.sendVerificationEmail(
      agent.email,
      emailVerificationToken,
      'agent',
    );

    return {
      message: 'If this email is new, a verification link has been sent',
    };
  }

  async loginAgent(data: LoginDto, ip: string = '', userAgent: string = '') {
    try {
      await this.checkIpLockout(ip);
    } catch (e) {
      if (e instanceof TooManyRequestsException) {
        this.logAuditEvent('ACCOUNT_LOCKED', data.email, false, ip, userAgent, { reason: 'Too many attempts from this location' });
      }
      throw e;
    }

    await this.verifyFailedAttempts(data.email, ip, data.captchaToken);

    const agent = await this.prisma.agent.findUnique({
      where: { email: data.email },
    });

    if (!agent || !agent.isActive) {
      await this.hashingService.compare(data.password, this.DUMMY_HASH);
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: !agent ? 'USER_NOT_FOUND' : 'ACCOUNT_INACTIVE',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.hashingService.compare(
      data.password,
      agent.passwordHash,
    );
    if (!isPasswordValid) {
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: 'WRONG_PASSWORD',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agent.isEmailVerified) {
      await this.incrementFailedAttempts(data.email, ip);
      this.logAuditEvent('LOGIN_FAILURE', data.email, false, ip, userAgent, {
        reason: 'EMAIL_NOT_VERIFIED',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.resetFailedAttempts(data.email, ip);

    await this.redis.sadd('login_updates:agent', agent.id);

    this.logAuditEvent('LOGIN_SUCCESS', data.email, true, ip, userAgent, {
      mfaPending: agent.isMfaEnabled,
    });
    await this.checkImpossibleTravel(data.email, ip, userAgent);

    if (agent.isMfaEnabled) {
      return this.generateMfaTempToken(
        agent.id,
        agent.email,
        null,
        'AGENT',
        'Agent',
      );
    }

    return await this.generateToken(agent.id, agent.email, null, 'AGENT', 'Agent');
  }

  private encryptTotp(secret: string): string {
    const key = Buffer.from(this.configService.getOrThrow<string>('TOTP_ENCRYPTION_KEY'), 'hex');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
  }

  private decryptTotp(stored: string): string {
    const [ivHex, tagHex, encHex] = stored.split(':');
    const key = Buffer.from(this.configService.getOrThrow<string>('TOTP_ENCRYPTION_KEY'), 'hex');
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    d.setAuthTag(Buffer.from(tagHex, 'hex'));
    return d.update(Buffer.from(encHex, 'hex')).toString('utf8') + d.final('utf8');
  }

  async setupMfa(userId: string, email: string, userType: string) {
    const secret = speakeasy.generateSecret({
      name: `AeroFlux (${email})`,
    });

    // Generate 8 10-character alphanumeric recovery codes
    const recoveryCodes: string[] = [];
    const hashedRecoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(5).toString('hex').toLowerCase(); // 10 chars
      recoveryCodes.push(code);
      const hash = await this.hashingService.hash(code);
      hashedRecoveryCodes.push(hash);
    }

    const encryptedSecret = this.encryptTotp(secret.base32);

    if (userType === 'Agency') {
      await this.prisma.agency.update({
        where: { id: userId },
        data: { mfaSecret: encryptedSecret, mfaRecoveryCodes: { set: hashedRecoveryCodes } },
      });
    } else if (userType === 'AgencyAgent') {
      await this.prisma.agencyAgent.update({
        where: { id: userId },
        data: { mfaSecret: encryptedSecret, mfaRecoveryCodes: { set: hashedRecoveryCodes } },
      });
    } else if (userType === 'Agent') {
      await this.prisma.agent.update({
        where: { id: userId },
        data: { mfaSecret: encryptedSecret, mfaRecoveryCodes: { set: hashedRecoveryCodes } },
      });
    }

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');
    return { qrCodeUrl, secret: secret.base32, recoveryCodes };
  }

  async enableMfa(userId: string, email: string, token: string, userType: string, ip: string = '', userAgent: string = '') {
    let user: any;
    if (userType === 'Agency') {
      user = await this.prisma.agency.findUnique({ where: { id: userId } });
    } else if (userType === 'AgencyAgent') {
      user = await this.prisma.agencyAgent.findUnique({
        where: { id: userId },
      });
    } else if (userType === 'Agent') {
      user = await this.prisma.agent.findUnique({ where: { id: userId } });
    }

    if (!user || (!user.mfaSecret && userType !== 'Agency')) {
      throw new UnauthorizedException('MFA not setup properly');
    }

    const decryptedSecret = this.decryptTotp(user.mfaSecret);
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: token,
    });

    if (!isValid) throw new UnauthorizedException('Invalid MFA token');

    if (userType === 'Agency') {
      await this.prisma.agency.update({
        where: { id: userId },
        data: { isMfaEnabled: true },
      });
    } else if (userType === 'AgencyAgent') {
      await this.prisma.agencyAgent.update({
        where: { id: userId },
        data: { isMfaEnabled: true },
      });
    } else if (userType === 'Agent') {
      await this.prisma.agent.update({
        where: { id: userId },
        data: { isMfaEnabled: true },
      });
    }

    this.logAuditEvent('MFA_ENABLED', email, true, ip, userAgent);

    return { message: 'MFA enabled successfully' };
  }

  async verifyMfaLogin(
    mfaToken: string,
    totpCode: string,
    ip: string = '',
    userAgent: string = '',
    isRecoveryCode: boolean = false
  ) {
    try {
      const payload = this.jwtService.verify(mfaToken, {
        secret: this.configService.getOrThrow<string>('MFA_TOKEN_SECRET'),
      });

      if (!payload.mfaRequired)
        throw new UnauthorizedException('Invalid token type');

      if (payload.tokenType !== 'mfa_pending')
        throw new UnauthorizedException('Invalid token type');

      const agentId = payload.sub;
      const mfaAttemptsKey = `mfa_attempts:${agentId}`;
      const attempts = await this.redis.get(mfaAttemptsKey);

      if (attempts && parseInt(attempts) >= 5) {
        const hashedIp = ip ? this.hashIp(ip) : null;
        this.logAuditEvent('MFA_LOCKOUT', payload.email ?? 'unknown', false, ip, userAgent, {
          reason: 'Too many MFA attempts',
          userId: payload.sub,
          ip: hashedIp,
        });
        throw new TooManyRequestsException('Too many MFA attempts. Try again later.');
      }

      const handleFailure = async () => {
        await this.redis.multi().incr(mfaAttemptsKey).expire(mfaAttemptsKey, 900).exec();
      };

      let user: any;
      if (payload.userType === 'Agency') {
        user = await this.prisma.agency.findUnique({
          where: { id: payload.sub },
        });
      } else if (payload.userType === 'AgencyAgent') {
        user = await this.prisma.agencyAgent.findUnique({
          where: { id: payload.sub },
        });
      } else if (payload.userType === 'Agent') {
        user = await this.prisma.agent.findUnique({
          where: { id: payload.sub },
        });
      }

      if (!user || !user.mfaSecret) {
        throw new UnauthorizedException('MFA not setup properly');
      }

      const decryptedSecret = this.decryptTotp(user.mfaSecret);

      if (isRecoveryCode) {
        if (!user.mfaRecoveryCodes || user.mfaRecoveryCodes.length === 0) {
          await handleFailure();
          throw new UnauthorizedException('No recovery codes available');
        }

        let validCodeIndex = -1;
        for (let i = 0; i < user.mfaRecoveryCodes.length; i++) {
          const isMatch = await this.hashingService.compare(totpCode, user.mfaRecoveryCodes[i]);
          if (isMatch) {
            validCodeIndex = i;
            break;
          }
        }

        if (validCodeIndex === -1) {
          await handleFailure();
          throw new UnauthorizedException('Invalid recovery code');
        }

        // Remove used recovery code
        const updatedCodes = [...user.mfaRecoveryCodes];
        updatedCodes.splice(validCodeIndex, 1);

        if (payload.userType === 'Agency') {
          await this.prisma.agency.update({ where: { id: payload.sub }, data: { mfaRecoveryCodes: updatedCodes } });
        } else if (payload.userType === 'AgencyAgent') {
          await this.prisma.agencyAgent.update({ where: { id: payload.sub }, data: { mfaRecoveryCodes: updatedCodes } });
        } else if (payload.userType === 'Agent') {
          await this.prisma.agent.update({ where: { id: payload.sub }, data: { mfaRecoveryCodes: updatedCodes } });
        }
      } else {
        const isValid = speakeasy.totp.verify({
          secret: decryptedSecret,
          encoding: 'base32',
          token: totpCode,
        });

        if (!isValid) {
          await handleFailure();
          throw new UnauthorizedException('Invalid MFA code');
        }
      }

      await this.redis.del(mfaAttemptsKey);

      this.logAuditEvent(
        'MFA_SUCCESS',
        payload.email,
        true,
        ip,
        userAgent,
      );

      return await this.generateToken(
        payload.sub,
        payload.email,
        payload.agencyId,
        payload.role,
        payload.userType,
      );
    } catch (e: any) {
      if (e instanceof TooManyRequestsException) throw e;
      if (e instanceof UnauthorizedException) throw e;
      this.logAuditEvent('MFA_FAILURE', 'unknown', false, ip, userAgent, {
        error: e?.message,
      });
      throw new InternalServerErrorException('MFA verification failed');
    }
  }

  async logout(
    userId: string,
    email: string,
    jti: string | undefined,
    tokenFamily: string | undefined,
    exp: number | undefined,
    ip: string = '',
    userAgent: string = '',
  ) {
    if (tokenFamily) {
      await this.redis.del(`refresh:${tokenFamily}`);
      await this.redis.srem(`user_sessions:${userId}`, tokenFamily);
    }
    if (jti && exp) {
      // Floor at 60s so minor clock-skew between nodes can't skip the blacklist entry
      const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 60);
      await this.redis.set(`bl_token:${jti}`, 'revoked', 'EX', ttl);
    }
    
    this.logAuditEvent('LOGOUT', email, true, ip, userAgent);
    
    return { message: 'Logged out successfully' };
  }

  private async revokeAllUserSessions(userId: string) {
    const families = await this.redis.smembers(`user_sessions:${userId}`);
    if (families && families.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const family of families) {
        pipeline.del(`refresh:${family}`);
      }
      pipeline.del(`user_sessions:${userId}`);
      await pipeline.exec();
    }
  }

  async refreshToken(
    refreshToken: string,
    ip: string = '',
    userAgent: string = '',
  ) {
    try {
      const payload: any = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const tokenFamily = payload.tokenFamily;
      if (!tokenFamily) {
        throw new UnauthorizedException('Invalid token format');
      }
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const incomingHash = this.hashRefreshToken(refreshToken);
      const tryDeduplicatedRefresh = async () => {
        const dedupRaw = await this.redis.get(`refresh_dedup:${incomingHash}`);
        if (!dedupRaw) {
          return null;
        }

        this.logger.debug(
          `Refresh token deduplicated for user ${payload.sub} and token family ${tokenFamily}`,
        );

        // The dedup cache only stores a hash pointer, never a raw token.
        const { newTokenHash, tokenFamily: newFamily, userId } = JSON.parse(dedupRaw);

        // Look up the actual rotation entry by token family.
        const rotatedDataStr = await this.redis.get(`refresh:${newFamily}`);
        if (!rotatedDataStr) {
          // The rotated session is gone — treat as replay attack.
          this.logAuditEvent('TOKEN_REUSE_DETECTED', payload.email ?? 'unknown', false, ip, userAgent, {
            reason: 'Dedup pointer found but rotated session missing',
            tokenFamily: newFamily,
          });
          await this.revokeAllUserSessions(userId);
          throw new UnauthorizedException('Token reuse detected — all sessions revoked');
        }

        const rotatedData = JSON.parse(rotatedDataStr);

        // Verify the stored hash matches the dedup pointer.
        if (rotatedData.hashedToken !== newTokenHash) {
          this.logAuditEvent('TOKEN_REUSE_DETECTED', payload.email ?? 'unknown', false, ip, userAgent, {
            reason: 'Dedup hash mismatch with rotated session',
            tokenFamily: newFamily,
          });
          await this.revokeAllUserSessions(userId);
          throw new UnauthorizedException('Token reuse detected — all sessions revoked');
        }

        // Re-issue an access token from the original JWT payload (not from cache).
        const accessToken = await this.signAccessToken({
          sub: payload.sub,
          email: payload.email,
          agencyId: payload.agencyId,
          role: payload.role,
          userType: payload.userType,
          tokenFamily: newFamily,
          tokenType: 'access',
        });

        this.logAuditEvent('TOKEN_REFRESH', payload.email ?? 'unknown', true, ip, userAgent, {
          deduplicated: true,
          tokenFamily: newFamily,
        });

        // Return without a new refresh token — the caller must use the
        // already-rotated refresh token it received from the first response.
        return {
          accessToken,
          refreshToken: null,
          user: {
            id: payload.sub,
            email: payload.email,
            agencyId: payload.agencyId,
            role: payload.role,
            userType: payload.userType,
          },
        };
      };

      const storedDataStr = await this.redis.get(`refresh:${tokenFamily}`);
      if (!storedDataStr) {
        const dedupResult = await tryDeduplicatedRefresh();
        if (dedupResult) {
          return dedupResult;
        }

        this.logAuditEvent('TOKEN_REUSE_DETECTED', payload.email ?? 'unknown', false, ip, userAgent, {
          reason: 'Missing refresh token family in Redis',
          tokenFamily,
        });
        await this.revokeAllUserSessions(payload.sub);
        throw new UnauthorizedException('Token reuse detected \u2014 all sessions revoked');
      }

      const storedData = JSON.parse(storedDataStr);
      const incomingBuffer = Buffer.from(incomingHash, 'hex');
      const storedBuffer = Buffer.from(storedData.hashedToken, 'hex');

      if (incomingBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(incomingBuffer, storedBuffer)) {
        const dedupResult = await tryDeduplicatedRefresh();
        if (dedupResult) {
          return dedupResult;
        }

        this.logAuditEvent('TOKEN_REUSE_DETECTED', payload.email ?? 'unknown', false, ip, userAgent, {
          reason: 'Refresh token hash mismatch',
          tokenFamily,
        });
        await this.revokeAllUserSessions(payload.sub);
        throw new UnauthorizedException('Token reuse detected \u2014 all sessions revoked');
      }

      let isActive = false;

      if (payload.userType === 'Agency') {
        const agency = await this.prisma.agency.findUnique({
          where: { id: payload.sub },
          select: { isActive: true },
        });
        if (agency?.isActive) isActive = true;
      } else if (payload.userType === 'AgencyAgent') {
        const agent = await this.prisma.agencyAgent.findUnique({
          where: { id: payload.sub },
          select: { isActive: true },
        });
        if (agent?.isActive) isActive = true;
      } else if (payload.userType === 'Agent') {
        const agent = await this.prisma.agent.findUnique({
          where: { id: payload.sub },
          select: { isActive: true },
        });
        if (agent?.isActive) isActive = true;
      }

      if (isActive) {
        this.logAuditEvent('TOKEN_REFRESH', payload.email, true, ip, userAgent);
        return await this.generateToken(
          payload.sub,
          payload.email,
          payload.agencyId,
          payload.role,
          payload.userType,
          {
            previousTokenFamily: tokenFamily,
            previousRefreshTokenHash: incomingHash,
          },
        );
      } else {
        throw new UnauthorizedException('Account is inactive or deleted');
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      this.logAuditEvent('TOKEN_REFRESH', 'unknown', false, ip, userAgent, {
        error: e?.message,
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateToken(
    sub: string,
    email: string,
    agencyId: string | null,
    role: string,
    userType: string,
    rotationContext?: {
      previousTokenFamily?: string;
      previousRefreshTokenHash?: string;
    },
  ) {
    const tokenFamily = crypto.randomUUID();
    const basePayload = { sub, email, agencyId, role, userType, tokenFamily };
    const accessToken = await this.signAccessToken({
      ...basePayload,
      tokenType: 'access',
    });
    const refreshToken = await this.signRefreshToken({
      ...basePayload,
      tokenType: 'refresh',
    });

    const hashedToken = this.hashRefreshToken(refreshToken);
    const refreshTtlSeconds = 7 * 24 * 60 * 60;
    const transaction = this.redis.multi();

    transaction.set(
      `refresh:${tokenFamily}`,
      JSON.stringify({ hashedToken, userId: sub }),
      'EX',
      refreshTtlSeconds,
    );
    transaction.sadd(`user_sessions:${sub}`, tokenFamily);

    if (rotationContext?.previousTokenFamily) {
      transaction.del(`refresh:${rotationContext.previousTokenFamily}`);
      transaction.srem(`user_sessions:${sub}`, rotationContext.previousTokenFamily);
    }

    if (rotationContext?.previousRefreshTokenHash) {
      // Short dedup window to absorb legitimate concurrent refresh races.
      // Store ONLY the hash of the new token — never the raw token.
      transaction.set(
          `refresh_dedup:${rotationContext.previousRefreshTokenHash}`,
          JSON.stringify({ newTokenHash: hashedToken, tokenFamily, userId: sub }),
          'EX',
          2,
      );
    }

    await transaction.exec();

    return {
      accessToken,
      refreshToken,
      user: {
        id: sub,
        email,
        agencyId,
        role,
        userType,
      },
    };
  }

  private signAccessToken(payload: object): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
      jwtid: randomUUID(),
    });
  }

  private signRefreshToken(payload: object): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
      jwtid: randomUUID(),
    });
  }

  private generateVerificationToken(sub: string, userType: string) {
    // SECURITY FIX: Use dedicated signEmailToken to prevent token confusion
    return this.signEmailToken(
      { sub, userType, verification: true, purpose: 'email_verify' },
      '2h',
    );
  }

  // SECURITY FIX: Centralize email token signing and add purpose, aud, iss claims
  private signEmailToken(payload: object, expiresIn: string): string {
    const secret = this.configService.getOrThrow<string>('EMAIL_TOKEN_SECRET');
    return this.jwtService.sign(
      { ...payload, iss: 'tourpilot-auth', aud: 'tourpilot-email-flow' },
      { expiresIn: expiresIn as any, secret, jwtid: randomUUID() }
    );
  }

  // SECURITY FIX: Centralize email token signature verification with purpose-checking
  private verifyEmailToken(token: string, expectedPurpose: string): any {
    try {
      const secret = this.configService.getOrThrow<string>('EMAIL_TOKEN_SECRET');
      const payload = this.jwtService.verify(token, {
        secret,
        issuer: 'tourpilot-auth',
        audience: 'tourpilot-email-flow',
      });
      if (payload.purpose !== expectedPurpose) {
        throw new UnauthorizedException('Token purpose mismatch');
      }
      return payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private generateMfaTempToken(
    sub: string,
    email: string,
    agencyId: string | null,
    role: string,
    userType: string,
  ) {
    const payload = { sub, email, agencyId, role, userType, mfaRequired: true, tokenType: 'mfa_pending' };
    const signedToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('MFA_TOKEN_SECRET'),
      expiresIn: '5m',
      jwtid: randomUUID(),
    });
    return { mfaPending: true, mfaToken: signedToken };
  }

  async verifyEmail(token: string, type: 'agency' | 'agency-agent' | 'agent') {
    // SECURITY FIX: Enforce expected token purpose during consumption
    const payload = this.verifyEmailToken(token, 'email_verify');
    if (type === 'agency') {
      await this.prisma.agency.update({
        where: { id: payload.sub },
        data: { isEmailVerified: true },
      });
    } else if (type === 'agency-agent') {
      await this.prisma.agencyAgent.update({
        where: { id: payload.sub },
        data: { isEmailVerified: true },
      });
    } else if (type === 'agent') {
      await this.prisma.agent.update({
        where: { id: payload.sub },
        data: { isEmailVerified: true },
      });
    }
    return { message: 'Email verified successfully' };
  }

  async requestEmailChange(userId: string, userType: string, password: string, newEmail: string) {
    let user;
    let oldEmail;
    let passwordHash;

    if (userType === 'Agency') {
      user = await this.prisma.agency.findUnique({ where: { id: userId } });
      oldEmail = user?.agencyAdminEmail;
      passwordHash = user?.agencyAdminPasswordHash;
    } else if (userType === 'AgencyAgent') {
      user = await this.prisma.agencyAgent.findUnique({ where: { id: userId } });
      oldEmail = user?.email;
      passwordHash = user?.passwordHash;
    } else if (userType === 'Agent') {
      user = await this.prisma.agent.findUnique({ where: { id: userId } });
      oldEmail = user?.email;
      passwordHash = user?.passwordHash;
    }

    if (!user || !passwordHash) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await this.hashingService.compare(password, passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const typeMapping: any = { 'Agency': 'agency', 'AgencyAgent': 'agency-agent', 'Agent': 'agent' };
    const mappedType = typeMapping[userType];

    // SECURITY FIX: Use dedicated signEmailToken with email_change purpose
    const verifyToken = this.signEmailToken(
      { sub: userId, userType, newEmail, oldEmail, type: 'email-change-verify', purpose: 'email_change' },
      '2h'
    );

    const verifyUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/verify-email-change?token=${verifyToken}&type=${mappedType}`;
    
    try {
      if (this.configService.get('NODE_ENV') === 'production') {
        await this.resend.emails.send({
          from: 'AeroFlux <noreply@aeroflux.com>',
          to: newEmail,
          subject: 'Verify your new email address',
          html: `<p>Please verify your new email address by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email Change</a></p>`,
        });
      } else if (this.transporter) {
        await this.transporter.sendMail({
          from: '"AeroFlux Dev" <onboarding@resend.dev>',
          to: newEmail,
          subject: 'Verify your new email address',
          html: `<p>Please verify your new email address by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email Change</a></p>`,
        });
        this.logger.log(`[VERIFY NEW EMAIL] ${verifyUrl}`);
      }
    } catch (e) {
      this.logger.error('Failed to send email change verification', e);
    }

    return { message: 'Verification link sent to new email' };
  }

  async verifyEmailChange(token: string, type: string) {
    // SECURITY FIX: Use strict verification and correct purpose
    const payload = this.verifyEmailToken(token, 'email_change');
    
    const { sub, userType, newEmail, oldEmail } = payload;

    if (userType === 'Agency') {
      await this.prisma.agency.update({ where: { id: sub }, data: { agencyAdminEmail: newEmail, isEmailVerified: true } });
    } else if (userType === 'AgencyAgent') {
      await this.prisma.agencyAgent.update({ where: { id: sub }, data: { email: newEmail, isEmailVerified: true } });
    } else if (userType === 'Agent') {
      await this.prisma.agent.update({ where: { id: sub }, data: { email: newEmail, isEmailVerified: true } });
    }

    // Revoke all active sessions — tokens carry the old email and must not remain valid
    await this.revokeAllUserSessions(sub);

    // SECURITY FIX: Sign revert token with email_revert purpose
    const revertToken = this.signEmailToken(
      { sub, userType, newEmail, oldEmail, type: 'email-change-revert', purpose: 'email_revert' },
      '7d'
    );

    const revertUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/revert-email-change?token=${revertToken}&type=${type}`;
    
    try {
      if (this.configService.get('NODE_ENV') === 'production') {
        await this.resend.emails.send({
          from: 'AeroFlux <noreply@aeroflux.com>',
          to: oldEmail,
          subject: 'Security Alert: Your email was changed',
          html: `<p>Your email was changed to ${newEmail}.</p><p>If this wasn't you, click here to revert:</p><p><a href="${revertUrl}">Revert Email Change</a></p>`,
        });
      } else if (this.transporter) {
        await this.transporter.sendMail({
          from: '"AeroFlux Dev" <onboarding@resend.dev>',
          to: oldEmail,
          subject: 'Security Alert: Your email was changed',
          html: `<p>Your email was changed to ${newEmail}.</p><p>If this wasn't you, click here to revert:</p><p><a href="${revertUrl}">Revert Email Change</a></p>`,
        });
        this.logger.log(`[REVERT ALERT EMAIL] ${revertUrl}`);
      }
    } catch (e) {
      this.logger.error('Failed to send email change revert alert', e);
    }

    return { message: 'Email updated successfully. An alert was sent to your old email.' };
  }

  async revertEmailChange(token: string, type: string) {
    // SECURITY FIX: Strictly verify revert token purpose
    const payload = this.verifyEmailToken(token, 'email_revert');

    const { sub, userType, oldEmail } = payload;

    if (userType === 'Agency') {
      await this.prisma.agency.update({ where: { id: sub }, data: { agencyAdminEmail: oldEmail, isEmailVerified: true } });
    } else if (userType === 'AgencyAgent') {
      await this.prisma.agencyAgent.update({ where: { id: sub }, data: { email: oldEmail, isEmailVerified: true } });
    } else if (userType === 'Agent') {
      await this.prisma.agent.update({ where: { id: sub }, data: { email: oldEmail, isEmailVerified: true } });
    }

    // Revoke all active sessions — the revert likely means the account was compromised
    await this.revokeAllUserSessions(sub);

    return { message: 'Email setup reverted successfully' };
  }
}