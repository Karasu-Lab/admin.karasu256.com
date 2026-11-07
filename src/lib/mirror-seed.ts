import 'server-only';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Volume, createFsFromVolume } from 'memfs';
import type { IFs } from 'memfs';
import { requestMirrorUploadUrl } from './git-api';

const WORKDIR = '/repo';

function joinPath(base: string, rel: string): string {
  return rel ? `${base}/${rel}` : base;
}

async function serializeGitDirectory(fs: IFs): Promise<Uint8Array<ArrayBuffer>> {
  const gitDir = `${WORKDIR}/.git`;
  const files: Record<string, string> = {};
  const walkDir = async (absPath: string, relPrefix: string): Promise<void> => {
    const names = (await fs.promises.readdir(absPath)) as string[];
    for (const name of names) {
      const abs = joinPath(absPath, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const stat = await fs.promises.stat(abs);
      if (stat.isDirectory()) {
        await walkDir(abs, rel);
      } else if (stat.isFile()) {
        const content = await fs.promises.readFile(abs);
        files[rel] = Buffer.from(content as Buffer).toString('base64');
      }
    }
  };
  await walkDir(gitDir, '');
  return new TextEncoder().encode(JSON.stringify({ files }));
}

export async function seedMirrorIfNeeded(input: {
  repositoryId: number;
  repositoryFullName: string;
}): Promise<void> {
  const upload = await requestMirrorUploadUrl(input);
  if (upload.exists) return;
  const fs = createFsFromVolume(new Volume());
  await git.clone({
    fs,
    http,
    dir: WORKDIR,
    url: `https://github.com/${input.repositoryFullName}.git`,
  });
  const archive = await serializeGitDirectory(fs);
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: archive,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Uploading the mirror of ${input.repositoryFullName} failed (${response.status}): ${detail.slice(0, 300)}`
    );
  }
}
