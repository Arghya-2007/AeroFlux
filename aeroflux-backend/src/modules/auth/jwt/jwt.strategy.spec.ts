import { JwtStrategy } from './jwt.strategy';
import { RedisService } from '../../../shared/redis/redis.service';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    jwtStrategy = new JwtStrategy(redisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should throw UnauthorizedException if token is blacklisted', async () => {
      const token = 'revoked-token';
      const req = {
        cookies: { access_token: token },
        headers: {},
      } as unknown as Request;

      const payload = { sub: 'user-id', email: 'test@example.com', jti: 'jti-1' };

      redisService.get.mockResolvedValue('true');

      await expect(jwtStrategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtStrategy.validate(req, payload)).rejects.toThrow(
        'Token revoked',
      );
      expect(redisService.get).toHaveBeenCalledWith('bl_token:jti-1');
    });

    it('should return payload if token is not blacklisted', async () => {
      const token = 'valid-token';
      const req = {
        cookies: { access_token: token },
        headers: {},
      } as unknown as Request;

      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        agencyId: 'agency-id',
        role: 'ADMIN',
        userType: 'Admin',
        jti: 'jti-2',
        tokenFamily: 'family-1',
        exp: 9999999999,
      };

      redisService.get.mockResolvedValueOnce(null);

      const result = await jwtStrategy.validate(req, payload);

      expect(result).toEqual({
        sub: payload.sub,
        id: payload.sub,
        email: payload.email,
        agencyId: payload.agencyId,
        role: payload.role,
        userType: payload.userType,
        jti: payload.jti,
        tokenFamily: payload.tokenFamily,
        exp: payload.exp,
      });
      expect(redisService.get).toHaveBeenCalledWith('bl_token:jti-2');
    });

    it('should reject token provided via Authorization header', async () => {
      const token = 'valid-token';
      const req = {
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
      } as unknown as Request;

      const payload = { sub: 'user-id', email: 'test@example.com', jti: 'jti-3' };

      await expect(jwtStrategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when access_token cookie is absent', async () => {
      const req = {
        cookies: {},
        headers: {},
      } as unknown as Request;

      const payload = { sub: 'user-id', email: 'test@example.com', jti: 'jti-4' };

      await expect(jwtStrategy.validate(req, payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
