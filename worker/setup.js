import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = dirname(fileURLToPath(import.meta.url));
const examplePath = join(workerDir, "wrangler.toml.example");
const configPath = join(workerDir, "wrangler.toml");

if (existsSync(configPath)) {
  console.log("worker/wrangler.toml already exists.");
} else {
  copyFileSync(examplePath, configPath);
  console.log("Created worker/wrangler.toml from worker/wrangler.toml.example.");
}

console.log("Next: edit worker/wrangler.toml if needed, then run pnpm deploy:backend.");
