import 'server-only';
import { z } from 'zod';
import { GithubIdentifiers } from './github-identifiers';

export function submoduleEntrySchema() {
  return z.object({ path: z.string(), repositoryFullName: z.string() });
}

export type SubmoduleEntry = z.infer<ReturnType<typeof submoduleEntrySchema>>;

export class GithubContents {
  apiBase = 'https://api.github.com/repos/';
  apiVersion = '2022-11-28';
  userAgent = 'karasu-lab-admin';
  gitmodulesPath = '.gitmodules';
  pathKey = 'path';
  urlKey = 'url';
  repositoryUrlPattern = /^https:\/\/github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/;
  sectionHeaderPattern = /^\[submodule\s+"[^"]*"\]$/;
  identifiers = new GithubIdentifiers();

  private headers(token: string): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: ['Bearer', token].join(' '),
      'user-agent': this.userAgent,
      'x-github-api-version': this.apiVersion,
    };
  }

  async get(token: string, repositoryFullName: string, path: string, ref?: string): Promise<Response> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return fetch(`${this.apiBase}${this.identifiers.encodeRepositoryPath(repositoryFullName)}/contents/${encodedPath}${query}`, {
      headers: this.headers(token),
      cache: 'no-store',
    });
  }

  async readText(token: string, repositoryFullName: string, path: string, ref?: string): Promise<string | null> {
    const response = await this.get(token, repositoryFullName, path, ref);
    if (!response.ok) return null;
    const data = z.object({ content: z.string() }).safeParse(await response.json().catch(() => null));
    if (!data.success) return null;
    return Buffer.from(data.data.content, 'base64').toString('utf8');
  }

  async readJson(token: string, repositoryFullName: string, path: string, ref?: string): Promise<unknown | null> {
    const text = await this.readText(token, repositoryFullName, path, ref);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async exists(token: string, repositoryFullName: string, path: string): Promise<boolean> {
    return (await this.get(token, repositoryFullName, path)).ok;
  }

  async headOid(token: string, repositoryFullName: string, branch: string): Promise<string> {
    const refPath = `${this.identifiers.encodeRepositoryPath(repositoryFullName)}/git/ref/heads/${this.identifiers
      .assertBranchName(branch)
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const response = await fetch(`${this.apiBase}${refPath}`, { headers: this.headers(token), cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Resolving the head of ${repositoryFullName}@${branch} failed (${response.status})`);
    }
    const data = z.object({ object: z.object({ sha: z.string() }) }).safeParse(await response.json());
    if (!data.success) throw new Error(`Resolving the head of ${repositoryFullName}@${branch} returned no commit SHA`);
    return data.data.object.sha;
  }

  parseGitmodules(text: string): SubmoduleEntry[] {
    const entries: SubmoduleEntry[] = [];
    let path: string | null = null;
    let url: string | null = null;
    const flush = () => {
      const match = url === null ? null : this.repositoryUrlPattern.exec(url);
      if (path !== null && match) entries.push({ path, repositoryFullName: match[1] });
      path = null;
      url = null;
    };
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (this.sectionHeaderPattern.test(line)) {
        flush();
        continue;
      }
      const separator = line.indexOf('=');
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === this.pathKey) path = value;
      if (key === this.urlKey) url = value;
    }
    flush();
    return entries;
  }

  async readSubmodules(token: string, repositoryFullName: string): Promise<SubmoduleEntry[]> {
    const text = await this.readText(token, repositoryFullName, this.gitmodulesPath);
    return text === null ? [] : this.parseGitmodules(text);
  }
}
