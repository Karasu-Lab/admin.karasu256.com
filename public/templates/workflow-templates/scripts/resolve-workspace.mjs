import { execFileSync } from "node:child_process";
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
    writeFileSync("package.json", JSON.stringify(manifest, null, 4) + "\n");
}
process.stdout.write(changed ? "changed" : "unchanged");
