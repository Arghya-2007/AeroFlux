import { SetMetadata } from '@nestjs/common';
import { AgentRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AgentRole[]) => SetMetadata(ROLES_KEY, roles);
