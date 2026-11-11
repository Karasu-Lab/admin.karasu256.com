'use server';

import {
  DashboardQueries,
  type DashboardData,
  type PackagesData,
  type SetupData,
  type TenantProfileData,
  type TenantSettingsData,
} from '@/lib/dashboard-data';
import type { LiveFeedData } from '@/lib/update-events';

export async function getDashboardDataAction(tenantId?: string): Promise<DashboardData> {
  return new DashboardQueries().dashboard(tenantId);
}

export async function getSetupDataAction(tenantId?: string): Promise<SetupData> {
  return new DashboardQueries().setup(tenantId);
}

export async function getPackagesDataAction(tenantId?: string): Promise<PackagesData> {
  return new DashboardQueries().packages(tenantId);
}

export async function getTenantSettingsDataAction(organizationId: string): Promise<TenantSettingsData> {
  return new DashboardQueries().tenantSettings(organizationId);
}

export async function getTenantProfileAction(organizationId: string): Promise<TenantProfileData> {
  return new DashboardQueries().profile(organizationId);
}

export async function getLiveFeedAction(organizationId: string): Promise<LiveFeedData> {
  return new DashboardQueries().liveFeed(organizationId);
}
