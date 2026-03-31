import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterAgencyDto,
  AgencyLoginDto,
  RegisterAgencyAgentDto,
  RegisterAgentDto,
  LoginDto,
  RequestEmailChangeDto,
} from '../dto/auth.dto';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '../jwt/jwt-refresh-auth.guard';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../../types/jwt-payload';

@Controller('auth')
export class AuthController {
  private readonly isSecure: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isSecure = this.configService.get<string>('NODE_ENV') !== 'development';
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }

  private sendAuthResponse(res: Response, authResult: any) {
    const { accessToken, refreshToken, ...responseData } = authResult;
    if (accessToken && refreshToken) {
      this.setAuthCookies(res, accessToken, refreshToken);
    }
    return res.json(responseData);
  }

  private sendMfaOrAuthResponse(res: Response, authResult: any) {
    if (authResult.mfaPending) {
      res.cookie('mfa_token', authResult.mfaToken, {
        httpOnly: true,
        secure: this.isSecure,
        sameSite: 'strict',
        maxAge: 5 * 60 * 1000,
        path: '/api/v1/auth',
      });
      return res.status(200).json({ mfaPending: true });
    }
    return this.sendAuthResponse(res, authResult);
  }

  // AGENCY ADMIN (Agency Table)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('agency/register')
  @HttpCode(HttpStatus.ACCEPTED)
  registerAgency(@Body() dto: RegisterAgencyDto, @Req() req: any) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.registerAgency(dto, ip, userAgent);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LoginThrottlerGuard)
  @Post('agency/login')
  async loginAgency(@Body() dto: AgencyLoginDto, @Req() req: any, @Res() res: Response) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const authResult = await this.authService.loginAgency(dto, ip, userAgent);
    return this.sendMfaOrAuthResponse(res, authResult);
  }

  // AGENCY AGENT
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('agency-agent/register')
  @HttpCode(HttpStatus.ACCEPTED)
  registerAgencyAgent(@Body() dto: RegisterAgencyAgentDto, @Req() req: any) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.registerAgencyAgent(dto, ip, userAgent);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LoginThrottlerGuard)
  @Post('agency-agent/login')
  async loginAgencyAgent(@Body() dto: LoginDto, @Req() req: any, @Res() res: Response) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const authResult = await this.authService.loginAgencyAgent(dto, ip, userAgent);
    return this.sendMfaOrAuthResponse(res, authResult);
  }

  // INDEPENDENT AGENT
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('agent/register')
  @HttpCode(HttpStatus.ACCEPTED)
  registerAgent(@Body() dto: RegisterAgentDto, @Req() req: any) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.registerAgent(dto, ip, userAgent);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LoginThrottlerGuard)
  @Post('agent/login')
  async loginAgent(@Body() dto: LoginDto, @Req() req: any, @Res() res: Response) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const authResult = await this.authService.loginAgent(dto, ip, userAgent);
    return this.sendMfaOrAuthResponse(res, authResult);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh-token')
  async refreshToken(@Req() req: any, @Res() res: Response) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const refreshToken = req.user?.refreshToken;
    const authResult = await this.authService.refreshToken(refreshToken, ip, userAgent);
    return this.sendAuthResponse(res, authResult);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload, @Req() req: any, @Res() res: Response) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.authService.logout(
      user.sub,
      user.email,
      user.jti,
      user.tokenFamily,
      user.exp,
      ip,
      userAgent,
    );
    res.clearCookie('access_token', { httpOnly: true, secure: this.isSecure, sameSite: 'strict', path: '/' });
    res.clearCookie('refresh_token', { httpOnly: true, secure: this.isSecure, sameSite: 'strict', path: '/api/v1/auth' });
    return res.json(result);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  setupMfa(@Req() req: any) {
    return this.authService.setupMfa(
      req.user.id,
      req.user.email,
      req.user.userType,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  enableMfa(@Req() req: any, @Body('token') token: string) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.enableMfa(req.user.id, req.user.email, token, req.user.userType, ip, userAgent);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(
    @Body('token') token: string,
    @Body('type') type: 'agency' | 'agency-agent' | 'agent',
  ) {
    return this.authService.verifyEmail(token, type);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('request-email-change')
  requestEmailChange(
    @Body() dto: RequestEmailChangeDto,
    @Req() req: any,
  ) {
    return this.authService.requestEmailChange(
      req.user.id,
      req.user.userType,
      dto.password,
      dto.newEmail,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email-change')
  verifyEmailChange(
    @Body('token') token: string,
    @Body('type') type: 'agency' | 'agency-agent' | 'agent',
  ) {
    return this.authService.verifyEmailChange(token, type);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('revert-email-change')
  revertEmailChange(
    @Body('token') token: string,
    @Body('type') type: 'agency' | 'agency-agent' | 'agent',
  ) {
    return this.authService.revertEmailChange(token, type);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mfa/verify-login')
  async verifyMfa(
    @Body('code') code: string,
    @Body('isRecoveryCode') isRecoveryCode: boolean = false,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const mfaToken = req.cookies?.['mfa_token'];
    if (!mfaToken) {
      return res.status(401).json({ message: 'MFA token missing' });
    }
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const authResult = await this.authService.verifyMfaLogin(mfaToken, code, ip, userAgent, isRecoveryCode);
    res.clearCookie('mfa_token', { path: '/api/v1/auth' });
    return this.sendAuthResponse(res, authResult);
  }
}
