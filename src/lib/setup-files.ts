import 'server-only';

export interface SetupFile {
  path: string;
  content: string;
}

function workflowTemplateCi(templateRepositoryFullName: string): string {
  return `name: CI

on:
    workflow_call:

permissions:
    contents: write

jobs:
    format:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
              with:
                  ref: \${{ github.head_ref || github.ref_name }}
            - uses: ${templateRepositoryFullName}@main
              with:
                  task: format

    typecheck:
        needs: format
        runs-on: ubuntu-latest
        env:
            NODE_AUTH_TOKEN: \${{ secrets.NODE_AUTH_TOKEN }}
        steps:
            - uses: actions/checkout@v4
              with:
                  ref: \${{ github.head_ref || github.ref_name }}
            - uses: ${templateRepositoryFullName}@main
              with:
                  task: typecheck

    build:
        needs: typecheck
        runs-on: ubuntu-latest
        env:
            NODE_AUTH_TOKEN: \${{ secrets.NODE_AUTH_TOKEN }}
        steps:
            - uses: actions/checkout@v4
              with:
                  ref: \${{ github.head_ref || github.ref_name }}
            - uses: ${templateRepositoryFullName}@main
              with:
                  task: build
`;
}

const WORKFLOW_TEMPLATE_ACTION = `name: JS Workflows
description: Run the shared Prettier formatting, type check and build tasks for a JavaScript or TypeScript package.

branding:
    icon: check-circle
    color: gray-dark

inputs:
    task:
        description: The task to run (format, typecheck or build).
        required: true

runs:
    using: composite
    steps:
        - uses: actions/setup-node@v4
          with:
              node-version: lts/*
              registry-url: https://npm.pkg.github.com
              scope: "@karasu-lab"
        - run: bash "$GITHUB_ACTION_PATH/scripts/run.sh" "$TASK"
          shell: bash
          env:
              TASK: \${{ inputs.task }}
`;

const WORKFLOW_TEMPLATE_RUN_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

task="\${1:?usage: run.sh <format|typecheck|build>}"
tools="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v pnpm > /dev/null; then
    npm install --global pnpm
fi

pnpm install --dir "$tools" --no-frozen-lockfile --ignore-scripts

if [ "$task" != "format" ]; then
    workspace="$(node "$tools/scripts/resolve-workspace.mjs")"
    if [ "$workspace" = "unchanged" ] && [ -f pnpm-lock.yaml ]; then
        pnpm install --frozen-lockfile --config.strict-dep-builds=false
    else
        pnpm install --no-frozen-lockfile --config.strict-dep-builds=false
    fi
fi

case "$task" in
    format)
        organize_imports="$(cd "$tools" && node -p 'require.resolve("prettier-plugin-organize-imports")')"
        "$tools/node_modules/.bin/prettier" \\
            --config "$tools/.prettierrc.json" \\
            --plugin "$organize_imports" \\
            --ignore-unknown \\
            --write "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,css}"

        if ! git diff --quiet; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git commit --all --message "style: apply prettier formatting"
            git push
        fi
        ;;
    typecheck)
        "$tools/node_modules/.bin/eslint" \\
            --config "$tools/eslint.config.mjs" \\
            --no-error-on-unmatched-pattern \\
            .

        if [ -f tsconfig.json ]; then
            pnpm exec tsc --noEmit
        fi
        ;;
    build)
        if node -e 'process.exit(require("./package.json").scripts?.build ? 0 : 1)'; then
            pnpm run build
        fi
        ;;
    *)
        echo "unknown task: $task" >&2
        exit 1
        ;;
esac
`;

const WORKFLOW_TEMPLATE_RESOLVE_WORKSPACE = `import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
let changed = false;

for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
]) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (!String(spec).startsWith("workspace:")) {
            continue;
        }
        const version = execFileSync("npm", ["view", name, "version"], {
            encoding: "utf8",
        }).trim();
        manifest[field][name] = version;
        changed = true;
    }
}

if (changed) {
    writeFileSync("package.json", JSON.stringify(manifest, null, 4) + "\\n");
}
process.stdout.write(changed ? "changed" : "unchanged");
`;

const WORKFLOW_TEMPLATE_PRETTIER_CONFIG = `{
    "tabWidth": 4
}
`;

const WORKFLOW_TEMPLATE_ESLINT_CONFIG = `import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.next/**",
            "**/.turbo/**",
            "**/coverage/**",
            "**/*.d.ts",
        ],
    },
    {
        files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
        languageOptions: {
            parser: tseslint.parser,
        },
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            "@next/next": nextPlugin,
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
        },
    },
];
`;

const WORKFLOW_TEMPLATE_PACKAGE_JSON = `{
    "name": "js-workflows",
    "version": "1.0.0",
    "private": true,
    "description": "Shared formatting, type check and build workflow for JavaScript and TypeScript packages",
    "license": "MIT",
    "devDependencies": {
        "@eslint/js": "10.0.1",
        "@next/eslint-plugin-next": "16.4.3",
        "eslint": "10.14.0",
        "prettier": "3.9.10",
        "prettier-plugin-organize-imports": "4.3.0",
        "typescript": "6.0.3",
        "typescript-eslint": "8.72.1"
    }
}
`;

export function workflowTemplateFiles(templateRepositoryFullName: string): SetupFile[] {
  return [
    { path: '.github/workflows/ci.yml', content: workflowTemplateCi(templateRepositoryFullName) },
    { path: 'action.yml', content: WORKFLOW_TEMPLATE_ACTION },
    { path: 'scripts/run.sh', content: WORKFLOW_TEMPLATE_RUN_SCRIPT },
    { path: 'scripts/resolve-workspace.mjs', content: WORKFLOW_TEMPLATE_RESOLVE_WORKSPACE },
    { path: '.prettierrc.json', content: WORKFLOW_TEMPLATE_PRETTIER_CONFIG },
    { path: 'eslint.config.mjs', content: WORKFLOW_TEMPLATE_ESLINT_CONFIG },
    { path: 'package.json', content: WORKFLOW_TEMPLATE_PACKAGE_JSON },
    { path: '.gitignore', content: 'node_modules/\n' },
  ];
}

export function packageCiWorkflow(templateRepositoryFullName: string): string {
  return `name: CI

on:
    pull_request:

jobs:
    ci:
        uses: ${templateRepositoryFullName}/.github/workflows/ci.yml@main
        permissions:
            contents: write
        secrets: inherit
`;
}

const NPM_PUBLISH_WORKFLOW = `name: Publish packages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repository and its package submodules
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Update every package submodule to its latest main
        run: git submodule update --remote

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Publish unpublished package versions to GitHub Packages
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node scripts/publish.mjs
`;

const NPM_PUBLISH_SCRIPT = `#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REGISTRY = "https://npm.pkg.github.com";
const DEFAULT_VERSION_NAMING_PATTERN = "{version}-{shortCommitHash}";
const token = process.env.NODE_AUTH_TOKEN;
if (!token) {
  console.error("NODE_AUTH_TOKEN is required");
  process.exit(1);
}

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
}

function repositoryUrl(dir) {
  const url = git(dir, ["remote", "get-url", "origin"]);
  return url.startsWith("http") ? "git+" + url : url;
}

function publishVersionFor(manifest, sha) {
  const declared =
    manifest.versionNaming && typeof manifest.versionNaming.pattern === "string"
      ? manifest.versionNaming.pattern
      : "";
  const pattern = declared || DEFAULT_VERSION_NAMING_PATTERN;
  return pattern
    .split("{version}")
    .join(manifest.version)
    .split("{shortCommitHash}")
    .join(sha.slice(0, 7))
    .split("{commitHash}")
    .join(sha);
}

const packages = [];
for (const entry of readdirSync("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join("packages", entry.name);
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.private) {
    console.log("skip " + entry.name + ": marked private");
    continue;
  }
  const sha = git(dir, ["rev-parse", "HEAD"]);
  packages.push({
    dir,
    manifest,
    name: manifest.name,
    publishVersion: publishVersionFor(manifest, sha),
  });
}

const npmrcPath = join(mkdtempSync(join(tmpdir(), "npmrc-")), ".npmrc");
const scopes = [
  ...new Set(
    packages
      .map((pkg) => (pkg.name.startsWith("@") ? pkg.name.split("/")[0] : null))
      .filter((scope) => scope !== null)
  ),
];
writeFileSync(
  npmrcPath,
  scopes.map((scope) => scope + ":registry=" + REGISTRY).join("\\n") +
    (scopes.length > 0 ? "\\n" : "") +
    "//" +
    new URL(REGISTRY).host +
    "/:_authToken=" +
    token +
    "\\n"
);

const byName = new Map(packages.map((p) => [p.name, p]));
function workspaceDeps(pkg) {
  const deps = { ...pkg.manifest.dependencies, ...pkg.manifest.peerDependencies };
  return Object.keys(deps).filter((name) => byName.has(name));
}
const ordered = [];
const visiting = new Set();
function visit(pkg) {
  if (ordered.includes(pkg) || visiting.has(pkg.name)) return;
  visiting.add(pkg.name);
  for (const depName of workspaceDeps(pkg)) visit(byName.get(depName));
  visiting.delete(pkg.name);
  ordered.push(pkg);
}
for (const pkg of packages) visit(pkg);

async function alreadyPublished(pkg) {
  const res = await fetch(REGISTRY + "/" + encodeURIComponent(pkg.name), {
    headers: { Authorization: "Bearer " + token },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error("registry check for " + pkg.name + " failed (HTTP " + res.status + ")");
  const body = await res.json();
  return Boolean(body.versions && body.versions[pkg.publishVersion]);
}

let failures = 0;
for (const pkg of ordered) {
  if (await alreadyPublished(pkg)) {
    console.log("skip " + pkg.name + "@" + pkg.publishVersion + ": already published");
    continue;
  }
  const manifest = { ...pkg.manifest };
  delete manifest.private;
  manifest.version = pkg.publishVersion;
  manifest.repository ??= { type: "git", url: repositoryUrl(pkg.dir) };
  manifest.publishConfig = { ...manifest.publishConfig, access: "public" };
  for (const field of ["dependencies", "peerDependencies"]) {
    for (const [depName, spec] of Object.entries(manifest[field] ?? {})) {
      if (byName.has(depName) && String(spec).startsWith("workspace:")) {
        manifest[field][depName] = byName.get(depName).publishVersion;
      }
    }
  }
  writeFileSync(join(pkg.dir, "package.json"), JSON.stringify(manifest, null, 2) + "\\n");
  console.log("publishing " + pkg.name + "@" + pkg.publishVersion);
  try {
    execFileSync(
      "npm",
      ["publish", "--registry", REGISTRY, "--access", "public", "--tag", "latest", "--userconfig", npmrcPath],
      { cwd: pkg.dir, stdio: "inherit", env: { ...process.env, NODE_AUTH_TOKEN: token } }
    );
  } catch {
    failures += 1;
    console.error("failed to publish " + pkg.name + "@" + pkg.publishVersion);
  }
}
if (failures > 0) process.exit(1);
console.log("done");
`;

const NPM_PUBLISH_PROGRESS_COMMENTS = `{
  "pointerUpdate": "Pointer update: {pullRequestUrl} bumps {npmRepository} to {commit} with auto-merge enabled. The publish workflow runs once the pointer update is merged.",
  "published": "Published {packageName}@{version} to GitHub Packages.\\n\\nPublish workflow run: {workflowRunUrl}",
  "publishFailed": "Publishing {packageName} at {commit} failed.\\n\\nPublish workflow run: {workflowRunUrl}"
}
`;

export const NPM_REPOSITORY_FILES: SetupFile[] = [
  { path: '.github/workflows/publish.yml', content: NPM_PUBLISH_WORKFLOW },
  { path: 'scripts/publish.mjs', content: NPM_PUBLISH_SCRIPT },
  { path: '.github/publish-progress-comments.json', content: NPM_PUBLISH_PROGRESS_COMMENTS },
];
