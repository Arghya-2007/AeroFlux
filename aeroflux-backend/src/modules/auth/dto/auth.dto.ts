import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const LoginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
});

const RegisterAgencySchema = z.object({
  agencyName: z
    .string()
    .min(1, 'Agency name is required')
    .max(100, 'Agency name is too long'),
  agencyAddress: z.string().max(255).optional(),
  supportEmail: z.string().email('Support email is required').max(255),
  supportPhone: z.string().max(20).optional(),
  agencyAdminName: z.string().min(1, 'Admin name is required').max(100),
  agencyAdminEmail: z.string().email('Admin email is required').max(255),
  agencyAdminPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character',
    )
    .max(100),
});

const AgencyLoginSchema = z.object({
  agencyAdminEmail: z
    .string()
    .email('Please provide a valid email address')
    .max(255),
  agencyAdminPassword: z.string().min(1, 'Password is required').max(100),
  captchaToken: z.string().optional(),
});

const RegisterAgencyAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Please provide a valid email address').max(255),
  phone: z.string().max(20).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character',
    )
    .max(100),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  agencyPublicId: z.string().min(1, 'Agency Public ID is required').max(100),
  agencySecret: z.string().min(1, 'Agency Secret is required').max(255), // Original RAW key
});

const RegisterAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Please provide a valid email address').max(255),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character',
    )
    .max(100),
});

const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

const RequestEmailChangeSchema = z.object({
  newEmail: z.string().email('Please provide a valid new email address'),
  password: z.string().min(1, 'Password is required to confirm identity'),
});

export class LoginDto extends createZodDto(LoginSchema) {}
export class RegisterAgencyDto extends createZodDto(RegisterAgencySchema) {}
export class AgencyLoginDto extends createZodDto(AgencyLoginSchema) {}
export class RegisterAgencyAgentDto extends createZodDto(
  RegisterAgencyAgentSchema,
) {}
export class RegisterAgentDto extends createZodDto(RegisterAgentSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export class RequestEmailChangeDto extends createZodDto(RequestEmailChangeSchema) {}
