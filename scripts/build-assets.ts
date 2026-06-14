import { buildStaticAssets } from "./static-assets";

const workerUrl =
  process.env.PUBLIC_COMMENTS_API_BASE_URL ??
  "https://your-worker.example.workers.dev";
const turnstileSiteKey =
  process.env.PUBLIC_TURNSTILE_SITE_KEY ?? "your-public-turnstile-site-key";

buildStaticAssets({ workerUrl, turnstileSiteKey });

console.log("Static assets generated in dist/frontend, dist/admin, and dist/astro.");
