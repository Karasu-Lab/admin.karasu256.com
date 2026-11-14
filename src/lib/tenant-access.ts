import 'server-only';
import { z } from 'zod';
import { ADMIN_TENANT_TYPE } from '@karasu-lab/types/shared';
import { getSessionUser } from '@karasu-lab/utils/server';
import { assignTenantType, getTenantOverview } from './api-auth';
import { getClientConfig } from './client-config';
import { tenantOverviewSchema } from './tenants';

export function tenantRoleSchema() {
  return z.enum(['owner', 'admin', 'member']);
}

export type TenantRole = z.infer<ReturnType<typeof tenantRoleSchema>>;

export function tenantAccessResultSchema() {
  return z.object({ userId: z.string(), overview: tenantOverviewSchema() });
}

export type TenantAccessResult = z.infer<ReturnType<typeof tenantAccessResultSchema>>;

export class TenantAccess {
  setupRoles: TenantRole[] = [tenantRoleSchema().enum.owner, tenantRoleSchema().enum.admin];

  async requireUserId(): Promise<string> {
    const user = await getSessionUser(getClientConfig().authApiUrl);
    if (!user) throw new Error('Unauthorized');
    return user.uid;
  }

  async optionalUserId(): Promise<string | null> {
    const user = await getSessionUser(getClientConfig().authApiUrl);
    return user ? user.uid : null;
  }

  hasSetupRole(role: string): boolean {
    return this.setupRoles.some((setupRole) => setupRole === role);
  }

  async requireMember(organizationId: string): Promise<TenantAccessResult> {
    const userId = await this.requireUserId();
    const overview = await getTenantOverview(organizationId, userId);
    await assignTenantType(organizationId, { userId, type: ADMIN_TENANT_TYPE });
    return { userId, overview };
  }

  async requireSetupRole(organizationId: string): Promise<TenantAccessResult> {
    const access = await this.requireMember(organizationId);
    if (!this.hasSetupRole(access.overview.organization.role)) throw new Error('tenant_setup_role_required');
    return access;
  }
}
