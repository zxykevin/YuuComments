import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type StaticAssetOptions = {
  workerUrl: string;
  turnstileSiteKey: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(repoRoot, "frontend");
const frontendSourceRoot = path.join(frontendRoot, "vanilla");
const frontendDistRoot = path.join(repoRoot, "dist", "frontend");
const astroSourceRoot = path.join(frontendRoot, "astro");
const astroDistRoot = path.join(repoRoot, "dist", "astro");
const adminSourceRoot = path.join(repoRoot, "admin");
const adminDistRoot = path.join(repoRoot, "dist", "admin");

function ensureDirectory(directory: string) {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function copyAsset(source: string, destination: string) {
  copyFileSync(source, destination);

  if (readFileSync(source, "utf8") !== readFileSync(destination, "utf8")) {
    throw new Error(`Generated asset does not match its source: ${destination}`);
  }
}

function buildFrontendAssets(workerUrl: string, turnstileSiteKey: string) {
  ensureDirectory(frontendDistRoot);
  copyAsset(
    path.join(frontendSourceRoot, "comments.js"),
    path.join(frontendDistRoot, "comments.js"),
  );
  copyAsset(
    path.join(frontendSourceRoot, "comments.css"),
    path.join(frontendDistRoot, "comments.css"),
  );
  copyAsset(
    path.join(frontendRoot, "embed.html"),
    path.join(frontendDistRoot, "embed.html"),
  );
  copyAsset(
    path.join(frontendRoot, "embed-resize.js"),
    path.join(frontendDistRoot, "embed-resize.js"),
  );
  copyAsset(
    path.join(frontendRoot, "yuucomments-embed.js"),
    path.join(frontendDistRoot, "yuucomments-embed.js"),
  );

  const commentsScript = readFileSync(
    path.join(frontendDistRoot, "comments.js"),
    "utf8",
  );
  if (
    !commentsScript.includes("getDeviceFingerprint") ||
    !commentsScript.includes("deviceFingerprint,")
  ) {
    throw new Error(
      "Generated frontend asset is missing the v0.1.5 device fingerprint submission logic.",
    );
  }

  const config = `window.YuuCommentsConfig = {
  apiBase: ${JSON.stringify(workerUrl)},
  turnstileSiteKey: ${JSON.stringify(turnstileSiteKey)}
};
`;
  writeFileSync(
    path.join(frontendDistRoot, "yuucomments.config.js"),
    config,
    "utf8",
  );
}

function buildAstroAssets() {
  ensureDirectory(astroDistRoot);
  copyAsset(
    path.join(astroSourceRoot, "YuuComments.astro"),
    path.join(astroDistRoot, "YuuComments.astro"),
  );
  copyAsset(
    path.join(astroSourceRoot, "YuuCommentsIframe.astro"),
    path.join(astroDistRoot, "YuuCommentsIframe.astro"),
  );
}

function buildAdminAssets(workerUrl: string) {
  ensureDirectory(adminDistRoot);
  copyAsset(
    path.join(adminSourceRoot, "admin.js"),
    path.join(adminDistRoot, "admin.js"),
  );
  copyAsset(
    path.join(adminSourceRoot, "admin.css"),
    path.join(adminDistRoot, "admin.css"),
  );

  const sourceHtml = readFileSync(path.join(adminSourceRoot, "index.html"), "utf8");
  const adminHtml = sourceHtml.replace(
    'data-api-base=""',
    `data-api-base=${JSON.stringify(workerUrl)}`,
  );
  writeFileSync(path.join(adminDistRoot, "index.html"), adminHtml, "utf8");
}

export function buildStaticAssets({
  workerUrl,
  turnstileSiteKey,
}: StaticAssetOptions) {
  buildFrontendAssets(workerUrl, turnstileSiteKey);
  buildAstroAssets();
  buildAdminAssets(workerUrl);
}
