export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
}

export interface TenantInstallation {
  id: string;
  installationId: number;
  targetType: string;
  targetId: number;
  targetLogin: string;
  suspended: boolean;
  installedByUserId: string | null;
}

export interface TenantNpmConfiguration {
  npmRepositoryId: number;
  npmRepositoryFullName: string;
  workflowTemplateRepositoryId: number;
  workflowTemplateRepositoryFullName: string;
}

export interface TenantLinkedPackage {
  id: string;
  repositoryId: number;
  repositoryFullName: string;
  submodulePath: string;
  versionNaming: string;
  enabled: boolean;
  lastSyncedSha: string | null;
}

export interface UserSigningKey {
  id: string;
  publicKeyId: string;
  name: string;
  enabled: boolean;
  registeredOnGitHub: boolean;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOverview {
  organization: { id: string; name: string; slug: string; role: string };
  installation: TenantInstallation | null;
  npmConfiguration: TenantNpmConfiguration | null;
  linkedPackages: TenantLinkedPackage[];
  signingKeys: UserSigningKey[];
}

export interface InstallationRepository {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
}
