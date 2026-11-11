import { z } from 'zod';

export class GithubIdentifiers {
  repositoryFullNamePattern = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
  commitShaPattern = /^[0-9a-f]{40}$/;
  submodulePathPattern = /^packages\/[A-Za-z0-9._-]+$/;
  opaqueIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
  repositoryNamePattern = /^[A-Za-z0-9._-]{1,100}$/;
  branchNamePattern = /^[A-Za-z0-9._/-]+$/;
  maxBranchNameLength = 200;
  dotSegments = ['.', '..'];
  forbiddenBranchFragments = ['..', '//'];
  forbiddenBranchPrefixes = ['-', '/'];
  forbiddenBranchSuffixes = ['/', '.lock'];

  private parse(value: unknown, pattern: RegExp): string | null {
    const parsed = z.string().regex(pattern).safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  isRepositoryFullName(value: unknown): value is string {
    const parsed = this.parse(value, this.repositoryFullNamePattern);
    return parsed !== null && parsed.split('/').every((segment) => !this.dotSegments.includes(segment));
  }

  isRepositoryName(value: unknown): value is string {
    const parsed = this.parse(value, this.repositoryNamePattern);
    return parsed !== null && !this.dotSegments.includes(parsed);
  }

  isCommitSha(value: unknown): value is string {
    return this.parse(value, this.commitShaPattern) !== null;
  }

  isSubmodulePath(value: unknown): value is string {
    const parsed = this.parse(value, this.submodulePathPattern);
    return parsed !== null && !this.dotSegments.includes(parsed.split('/')[1]);
  }

  isOpaqueId(value: unknown): value is string {
    return this.parse(value, this.opaqueIdPattern) !== null;
  }

  isBranchName(value: unknown): value is string {
    const parsed = z.string().min(1).max(this.maxBranchNameLength).regex(this.branchNamePattern).safeParse(value);
    if (!parsed.success) return false;
    const branch = parsed.data;
    return (
      !this.forbiddenBranchFragments.some((fragment) => branch.includes(fragment)) &&
      !this.forbiddenBranchPrefixes.some((prefix) => branch.startsWith(prefix)) &&
      !this.forbiddenBranchSuffixes.some((suffix) => branch.endsWith(suffix))
    );
  }

  assertRepositoryFullName(value: string): string {
    if (!this.isRepositoryFullName(value)) throw new Error('invalid_repository_full_name');
    return value;
  }

  assertRepositoryName(value: string): string {
    if (!this.isRepositoryName(value)) throw new Error('invalid_repository_name');
    return value;
  }

  assertOpaqueId(value: string): string {
    if (!this.isOpaqueId(value)) throw new Error('invalid_identifier');
    return value;
  }

  assertBranchName(value: string): string {
    if (!this.isBranchName(value)) throw new Error('invalid_branch_name');
    return value;
  }

  encodeRepositoryPath(repositoryFullName: string): string {
    return this.assertRepositoryFullName(repositoryFullName).split('/').map(encodeURIComponent).join('/');
  }
}
