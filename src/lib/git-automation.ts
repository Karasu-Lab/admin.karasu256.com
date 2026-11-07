import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SigningIdentity {
  name: string;
  email: string;
}

export async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

export async function withClonedRepository<T>(
  repositoryFullName: string,
  token: string,
  fn: (dir: string) => Promise<T>,
  options?: { recurseSubmodules?: boolean }
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'admin-git-'));
  try {
    const args = ['clone', '--quiet'];
    if (options?.recurseSubmodules) args.push('--recurse-submodules');
    args.push(`https://x-access-token:${token}@github.com/${repositoryFullName}.git`, dir);
    await execFileAsync('git', args);
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function configureCommitter(dir: string, identity: SigningIdentity): Promise<void> {
  await git(dir, ['config', 'user.name', identity.name]);
  await git(dir, ['config', 'user.email', identity.email]);
  const privateKey = process.env.COMMIT_SIGNING_PRIVATE_KEY;
  if (privateKey) {
    const keyPath = join(await mkdtemp(join(tmpdir(), 'admin-key-')), 'signing-key');
    await writeFile(keyPath, privateKey.replace(/\\n/g, '\n'), { mode: 0o600 });
    await git(dir, ['config', 'gpg.format', 'ssh']);
    await git(dir, ['config', 'user.signingkey', keyPath]);
  }
}

export function signingKeyConfigured(): boolean {
  return Boolean(process.env.COMMIT_SIGNING_PRIVATE_KEY);
}

export async function commitAll(dir: string, message: string): Promise<string> {
  await git(dir, ['add', '--all']);
  const signed = signingKeyConfigured();
  await git(dir, signed ? ['commit', '--quiet', '-S', '-m', message] : ['commit', '--quiet', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']);
}

export async function pushBranch(dir: string, branch: string): Promise<void> {
  await git(dir, ['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`]);
}

export async function createBranch(dir: string, branch: string): Promise<void> {
  await git(dir, ['checkout', '--quiet', '-b', branch]);
}

export async function defaultBranch(dir: string): Promise<string> {
  return git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
}
