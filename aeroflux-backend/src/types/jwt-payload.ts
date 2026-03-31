export interface JwtPayload {
  sub: string;
  id: string;
  email: string;
  agencyId: string | null;
  role: string;
  userType: string;
  jti: string;
  tokenFamily: string;
  exp: number;
}

