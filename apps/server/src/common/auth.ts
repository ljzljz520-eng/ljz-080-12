import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';

export type StaffRole = 'station_admin' | 'courier' | 'housekeeper';

export interface AuthUser {
  kind: 'staff' | 'family';
  id: number;
  name: string;
  role?: StaffRole;
  stationId?: number;
  elderId?: number;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const STAFF_ROLES_KEY = 'staffRoles';
const FAMILY_ONLY_KEY = 'familyOnly';

/** 仅站点员工（可限定角色）可访问 */
export const StaffOnly = (...roles: StaffRole[]) =>
  SetMetadata(STAFF_ROLES_KEY, roles);

/** 仅家属账号可访问 */
export const FamilyOnly = () => SetMetadata(FAMILY_ONLY_KEY, true);

/** 取当前登录人，未登录抛 401 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new UnauthorizedException('未登录');
    return req.user;
  },
);

/**
 * 演示环境鉴权：通过请求头 x-staff-id / x-family-id 标识身份，
 * 在库中校验账号存在后挂载到 req.user。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    req.user = await this.resolveUser(req);

    const staffRoles = this.reflector.getAllAndOverride<StaffRole[]>(
      STAFF_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (staffRoles?.length) {
      if (!req.user) throw new UnauthorizedException('未登录');
      if (req.user.kind !== 'staff' || !staffRoles.includes(req.user.role!)) {
        throw new ForbiddenException('无权访问：需要站点员工权限');
      }
    }

    const familyOnly = this.reflector.getAllAndOverride<boolean>(
      FAMILY_ONLY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (familyOnly) {
      if (!req.user) throw new UnauthorizedException('未登录');
      if (req.user.kind !== 'family') {
        throw new ForbiddenException('无权访问：仅家属账号可用');
      }
    }
    return true;
  }

  private async resolveUser(req: AuthedRequest): Promise<AuthUser | undefined> {
    const staffId = req.headers['x-staff-id'];
    const familyId = req.headers['x-family-id'];

    if (staffId) {
      const { rows } = await this.db.query<{
        id: number;
        name: string;
        role: StaffRole;
        station_id: number;
      }>('SELECT id, name, role, station_id FROM staff_users WHERE id = $1', [
        Number(staffId),
      ]);
      if (!rows.length) throw new UnauthorizedException('员工账号不存在');
      const s = rows[0];
      return {
        kind: 'staff',
        id: s.id,
        name: s.name,
        role: s.role,
        stationId: s.station_id,
      };
    }

    if (familyId) {
      const { rows } = await this.db.query<{
        id: number;
        name: string;
        elder_id: number;
      }>('SELECT id, name, elder_id FROM family_members WHERE id = $1', [
        Number(familyId),
      ]);
      if (!rows.length) throw new UnauthorizedException('家属账号不存在');
      const f = rows[0];
      return { kind: 'family', id: f.id, name: f.name, elderId: f.elder_id };
    }

    return undefined;
  }
}
