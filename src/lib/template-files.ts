import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { z } from 'zod';
import { getClientConfig } from './client-config';

export function templateSetNameSchema() {
  return z.enum(['npm-repository', 'workflow-templates', 'package']);
}

export type TemplateSetName = z.infer<ReturnType<typeof templateSetNameSchema>>;

export function setupFileSchema() {
  return z.object({ path: z.string(), content: z.string() });
}

export type SetupFile = z.infer<ReturnType<typeof setupFileSchema>>;

export function templateManifestSchema() {
  return z.object({ files: z.array(z.object({ source: z.string(), path: z.string() })) });
}

export type TemplateManifest = z.infer<ReturnType<typeof templateManifestSchema>>;

export function templateValuesSchema() {
  return z.record(z.string(), z.string());
}

export type TemplateValues = z.infer<ReturnType<typeof templateValuesSchema>>;

export abstract class TemplateAssetSource {
  abstract read(path: string): Promise<string>;
}

export class CloudflareTemplateAssets extends TemplateAssetSource {
  appUrl = getClientConfig().appUrl;

  async read(path: string): Promise<string> {
    const url = new URL(path, this.appUrl);
    const { env } = await getCloudflareContext({ async: true });
    const response = env.ASSETS ? await env.ASSETS.fetch(new Request(url)) : await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Reading the template ${path} failed (${response.status})`);
    return response.text();
  }
}

export class TemplateFiles {
  basePath = '/templates';
  manifestName = 'manifest.json';
  placeholderPattern = /%%([A-Z_]+)%%/g;

  constructor(readonly assets: TemplateAssetSource = new CloudflareTemplateAssets()) {}

  render(template: string, values: TemplateValues): string {
    return template.replace(this.placeholderPattern, (placeholder, key: string) =>
      Object.hasOwn(values, key) ? values[key] : placeholder
    );
  }

  async load(set: TemplateSetName, values: TemplateValues = {}): Promise<SetupFile[]> {
    const setPath = `${this.basePath}/${templateSetNameSchema().parse(set)}`;
    const manifest = templateManifestSchema().parse(JSON.parse(await this.assets.read(`${setPath}/${this.manifestName}`)));
    return Promise.all(
      manifest.files.map(async (file) => ({
        path: file.path,
        content: this.render(await this.assets.read(`${setPath}/${file.source}`), values),
      }))
    );
  }
}
