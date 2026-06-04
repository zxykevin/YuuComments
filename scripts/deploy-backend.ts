import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

type D1Config = {
  binding: string;
  name: string;
  id: string;
};

type WranglerIdentity = {
  accounts?: Array<{ id?: string }>;
};

type TurnstileWidget = {
  sitekey?: string;
  secret?: string;
};

type JsonObject = Record<string, unknown>;
type CommandInvocation = {
  command: string;
  prefixArgs: string[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerRoot = path.join(repoRoot, "worker");
const wranglerConfigPath = path.join(workerRoot, "wrangler.toml");
const wranglerExamplePath = path.join(workerRoot, "wrangler.toml.example");
const wranglerConfigArg = "worker/wrangler.toml";
const frontendRoot = path.join(repoRoot, "frontend");
const frontendSourceRoot = path.join(repoRoot, "frontend", "vanilla");
const frontendDistRoot = path.join(repoRoot, "dist", "frontend");
const astroSourceRoot = path.join(repoRoot, "frontend", "astro");
const astroDistRoot = path.join(repoRoot, "dist", "astro");
const adminSourceRoot = path.join(repoRoot, "admin");
const adminDistRoot = path.join(repoRoot, "dist", "admin");
const corsSourcePath = path.join(workerRoot, "src", "utils", "cors.ts");
let workerExists = true;

const args = parseArgs(process.argv.slice(2));
const secretsPath = path.join(repoRoot, args.secretsFile);
const pnpmInvocation = resolvePnpmInvocation();
const nodeInvocation: CommandInvocation = { command: process.execPath, prefixArgs: [] };
const tempSecretsFiles = new Set<string>();

process.chdir(repoRoot);

function parseArgs(argv: string[]) {
  let secretsFile = "secrets.production.json";
  let skipInstall = false;
  let loginCallbackPort = Number(process.env.WRANGLER_LOGIN_CALLBACK_PORT ?? 18789);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--skip-install" || arg === "-SkipInstall") {
      skipInstall = true;
      continue;
    }

    if (arg === "--secrets-file" || arg === "-SecretsFile") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      secretsFile = value;
      index += 1;
      continue;
    }

    if (arg === "--login-callback-port" || arg === "-LoginCallbackPort") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      loginCallbackPort = Number(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--secrets-file=")) {
      secretsFile = arg.slice("--secrets-file=".length);
      continue;
    }

    if (arg.startsWith("--login-callback-port=")) {
      loginCallbackPort = Number(arg.slice("--login-callback-port=".length));
      continue;
    }

    if (!arg.startsWith("-") && secretsFile === "secrets.production.json") {
      secretsFile = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(loginCallbackPort) || loginCallbackPort < 1 || loginCallbackPort > 65535) {
    throw new Error("login callback port must be an integer between 1 and 65535.");
  }

  return { secretsFile, skipInstall, loginCallbackPort };
}

function resolvePnpmInvocation(): CommandInvocation {
  if (process.platform !== "win32") {
    return { command: "pnpm", prefixArgs: [] };
  }

  const pnpmEntry = findPnpmEntryPoint();
  if (!pnpmEntry) {
    throw new Error("pnpm is required but was not found in PATH.");
  }

  return { command: process.execPath, prefixArgs: [pnpmEntry] };
}

function findPnpmEntryPoint() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /pnpm/i.test(path.basename(npmExecPath)) && existsSync(npmExecPath)) {
    return npmExecPath;
  }

  const commandPath = findCommandOnPath("pnpm.cmd");
  if (commandPath) {
    const entryPath = path.join(path.dirname(commandPath), "node_modules", "pnpm", "bin", "pnpm.mjs");
    if (existsSync(entryPath)) {
      return entryPath;
    }
  }

  return null;
}

function findCommandOnPath(commandName: string) {
  const pathValue = process.env.Path ?? process.env.PATH ?? "";
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) {
      continue;
    }

    const commandPath = path.join(directory, commandName);
    if (existsSync(commandPath)) {
      return commandPath;
    }
  }

  return null;
}

function runCommand(invocation: CommandInvocation, args: string[], options: { stdio?: "inherit" | "pipe" } = {}) {
  const result = spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function invokeCheckedCommand(description: string, invocation: CommandInvocation, args: string[], options: { stdio?: "inherit" | "ignore" } = {}) {
  console.log("");
  console.log(`==> ${description}`);
  const result = spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 1}.`);
  }
}

function captureCommand(invocation: CommandInvocation, args: string[]) {
  const result = runCommand(invocation, args);
  const output = [result.stdout, result.stderr].filter(Boolean).join("");

  if (result.status !== 0) {
    const error = new Error(output.trim() || `${invocation.command} failed with exit code ${result.status ?? 1}.`);
    Object.assign(error, { output, status: result.status });
    throw error;
  }

  return output;
}

function setUtf8File(filePath: string, content: string) {
  writeFileSync(filePath, content, "utf8");
}

function parseJsonObject(raw: string): JsonObject {
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
}

function getRequiredSecrets() {
  const config = readFileSync(wranglerConfigPath, "utf8");
  const match = config.match(/^\[secrets\]\s*required\s*=\s*\[(.*?)\]/ms);

  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function getConfiguredSecrets() {
  const result = runCommand(pnpmInvocation, ["exec", "wrangler", "secret", "list", "--format", "json", "--config", wranglerConfigArg]);
  const output = [result.stdout, result.stderr].filter(Boolean).join("");

  if (result.status !== 0) {
    if (/Worker ".*" not found/.test(output)) {
      workerExists = false;
      return [];
    }

    throw new Error("Failed to read configured Worker secrets.");
  }

  if (!output.trim()) {
    return [];
  }

  const parsed = JSON.parse(output) as Array<{ name?: string }>;
  return parsed.map((secret) => secret.name).filter((name): name is string => Boolean(name));
}

function getWranglerIdentity() {
  const json = captureCommand(pnpmInvocation, ["exec", "wrangler", "whoami", "--json"]);
  return JSON.parse(json) as WranglerIdentity;
}

function ensureWranglerIdentity() {
  try {
    return getWranglerIdentity();
  } catch {
    console.log("");
    console.log("==> Cloudflare login required");
    invokeCheckedCommand("Opening Cloudflare login", pnpmInvocation, [
      "exec",
      "wrangler",
      "login",
      "--callback-host",
      "127.0.0.1",
      "--callback-port",
      String(args.loginCallbackPort),
    ]);
    return getWranglerIdentity();
  }
}

function getD1Config(): D1Config {
  const config = readFileSync(wranglerConfigPath, "utf8");
  const blockMatch = config.match(/^\[\[d1_databases\]\](.*?)(?=^\[\[|^\[|\z)/ms);

  if (!blockMatch) {
    throw new Error("worker/wrangler.toml does not contain a [[d1_databases]] block.");
  }

  const block = blockMatch[1];
  const bindingMatch = block.match(/^\s*binding\s*=\s*"([^"]+)"/m);
  const nameMatch = block.match(/^\s*database_name\s*=\s*"([^"]+)"/m);
  const idMatch = block.match(/^\s*database_id\s*=\s*"([^"]+)"/m);

  if (!bindingMatch || !nameMatch || !idMatch) {
    throw new Error("The D1 config must include binding, database_name, and database_id.");
  }

  return {
    binding: bindingMatch[1],
    name: nameMatch[1],
    id: idMatch[1],
  };
}

function getD1DatabaseByName(name: string) {
  const json = captureCommand(pnpmInvocation, ["exec", "wrangler", "d1", "list", "--json"]);
  const databases = JSON.parse(json) as Array<{ name?: string; uuid?: string }>;
  return databases.find((database) => database.name === name) ?? null;
}

function setD1DatabaseId(databaseId: string) {
  const config = readFileSync(wranglerConfigPath, "utf8");
  const updated = config.replace(/^(\s*database_id\s*=\s*")[^"]+(")/m, `$1${databaseId}$2`);

  if (updated === config) {
    throw new Error("Failed to update database_id in worker/wrangler.toml.");
  }

  setUtf8File(wranglerConfigPath, updated);
}

function getSecretValueFromFile(name: string, filePath: string) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = parseJsonObject(readFileSync(filePath, "utf8"));
  const value = content[name];
  return value == null ? null : value;
}

function getLocalSecrets(filePath: string): JsonObject {
  if (!existsSync(filePath)) {
    return {};
  }

  return parseJsonObject(readFileSync(filePath, "utf8"));
}

function saveLocalSecrets(secrets: JsonObject, filePath: string) {
  setUtf8File(filePath, JSON.stringify(secrets, null, 2));
}

async function fetchCloudflare<T>(url: string, apiToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function getTurnstileWidgetDetails(accountId: string, apiToken: string, siteKey: unknown) {
  try {
    if (typeof siteKey === "string" && siteKey.trim()) {
      const response = await fetchCloudflare<{ success?: boolean; result?: TurnstileWidget }>(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets/${siteKey}`,
        apiToken,
      );

      if (response.success && response.result) {
        return response.result;
      }

      return null;
    }

    const response = await fetchCloudflare<{ success?: boolean; result?: Array<{ sitekey?: string }> }>(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets`,
      apiToken,
    );

    if (!response.success || !response.result) {
      return null;
    }

    if (response.result.length !== 1 || !response.result[0].sitekey) {
      return null;
    }

    return getTurnstileWidgetDetails(accountId, apiToken, response.result[0].sitekey);
  } catch {
    return null;
  }
}

async function getTurnstileHostnames(filePath: string) {
  let rawHostnames: unknown = process.env.TURNSTILE_HOSTNAMES;

  if (isBlank(rawHostnames) && existsSync(filePath)) {
    const content = parseJsonObject(readFileSync(filePath, "utf8"));
    if (Object.hasOwn(content, "TURNSTILE_HOSTNAMES")) {
      rawHostnames = content.TURNSTILE_HOSTNAMES;
    }
  }

  const hostnames = ["127.0.0.1", "localhost"];

  if (Array.isArray(rawHostnames)) {
    hostnames.push(...rawHostnames.map((item) => String(item).trim()).filter((item) => item.length > 0));
  } else {
    if (isBlank(rawHostnames)) {
      rawHostnames = await readPlainInput("Enter your site hostnames without https:// (comma-separated, for example example.com,www.example.com)");
    }

    hostnames.push(...String(rawHostnames).split(",").map((item) => item.trim()).filter((item) => item.length > 0));
  }

  return unique(hostnames);
}

async function getConfiguredSiteHostnames(filePath: string) {
  const hostnames = await getTurnstileHostnames(filePath);
  return unique(hostnames.filter((hostname) => hostname !== "127.0.0.1" && hostname !== "localhost"));
}

function addCorsOriginsForHostnames(hostnames: unknown) {
  const normalizedHostnames = normalizeHostnames(hostnames);
  const origins = unique(
    normalizedHostnames
      .filter((hostname) => hostname && hostname !== "127.0.0.1" && hostname !== "localhost")
      .map((hostname) => `https://${hostname.trim()}`),
  );

  if (origins.length === 0) {
    return;
  }

  const content = readFileSync(corsSourcePath, "utf8");
  const missingOrigins = origins.filter((origin) => !content.includes(`"${origin}"`));

  if (missingOrigins.length === 0) {
    return;
  }

  const lines = missingOrigins.map((origin) => `  "${origin}",`).join("\r\n");
  const updated = content.replace(/^(\]\);)$/m, `${lines}\r\n$1`);

  if (updated === content) {
    throw new Error("Failed to update worker/src/utils/cors.ts.");
  }

  setUtf8File(corsSourcePath, updated);
}

async function newTurnstileWidget(accountId: string, apiToken: string, hostnames: string[]) {
  if (hostnames.length === 0) {
    throw new Error("At least one Turnstile hostname is required to create a widget.");
  }

  const response = await fetchCloudflare<{ success?: boolean; result?: TurnstileWidget }>(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets`,
    apiToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "YuuComments",
        mode: "managed",
        domains: hostnames,
      }),
    },
  );

  if (!response.success || !response.result) {
    throw new Error("Failed to create Turnstile widget.");
  }

  return response.result;
}

function newAdminToken() {
  return randomBytes(32).toString("hex");
}

async function readPlainSecret(prompt: string) {
  if (process.stdin.isTTY) {
    return await readMaskedSecret(prompt);
  }

  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
  });

  process.stdout.write(`${prompt}: `);
  try {
    const answer = await rl.question("");
    process.stdout.write("\n");
    return answer;
  } finally {
    rl.close();
  }
}

async function readMaskedSecret(prompt: string) {
  return await new Promise<string>((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    const finish = () => {
      cleanup();
      process.stdout.write("\n");
      resolve(value);
    };

    const onData = (chunk: Buffer | string) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("^C\n");
          reject(new Error("Input cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          finish();
          return;
        }

        if (char === "\u0008" || char === "\u007f") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }

        value += char;
        process.stdout.write("*");
      }
    };

    process.stdout.write(`${prompt}: `);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function readPlainInput(prompt: string) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  try {
    return await rl.question(`${prompt}: `);
  } finally {
    rl.close();
  }
}

function newTempSecretsFile(secrets: JsonObject) {
  if (Object.keys(secrets).length === 0) {
    return null;
  }

  const tempSecretsPath = path.join(tmpdir(), `yuucomments-secrets-${randomUUID().replaceAll("-", "")}.json`);
  setUtf8File(tempSecretsPath, JSON.stringify(secrets));
  tempSecretsFiles.add(tempSecretsPath);
  return tempSecretsPath;
}

function deleteTempSecretsFile(filePath: string) {
  tempSecretsFiles.delete(filePath);

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function deleteTrackedTempSecretsFiles() {
  for (const filePath of [...tempSecretsFiles]) {
    deleteTempSecretsFile(filePath);
  }
}

function uploadSecrets(secretsFile: string) {
  try {
    invokeCheckedCommand("Uploading required secrets", pnpmInvocation, ["exec", "wrangler", "secret", "bulk", secretsFile, "--config", wranglerConfigArg]);
  } finally {
    deleteTempSecretsFile(secretsFile);
  }
}

function invokeDeployWorker(secretsFile: string | null) {
  console.log("");
  console.log("==> Deploying Worker");

  const commandArgs = ["exec", "wrangler", "deploy", "--config", wranglerConfigArg];
  if (secretsFile && secretsFile.trim()) {
    commandArgs.push("--secrets-file", secretsFile);
  }

  const result = runCommand(pnpmInvocation, commandArgs);
  const output = [result.stdout, result.stderr].filter(Boolean).join("");

  if (output) {
    process.stdout.write(output);
  }

  if (result.status !== 0) {
    throw new Error(`Deploying Worker failed with exit code ${result.status ?? 1}.`);
  }

  return output.split(/\r?\n/).filter((line) => line.length > 0);
}

function getWorkerUrlFromDeployOutput(lines: string[]) {
  const urls = lines
    .join("\n")
    .match(/https:\/\/[^\s)]+/g)
    ?.map((url) => url.replace(/[.,;:]+$/, "")) ?? [];

  return urls.find((url) => {
    try {
      return new URL(url).hostname.endsWith(".workers.dev");
    } catch {
      return false;
    }
  }) ?? null;
}

function newFrontendBundle(workerUrl: string, turnstileSiteKey: string) {
  ensureDirectory(frontendDistRoot);
  copyFileSync(path.join(frontendSourceRoot, "comments.js"), path.join(frontendDistRoot, "comments.js"));
  copyFileSync(path.join(frontendSourceRoot, "comments.css"), path.join(frontendDistRoot, "comments.css"));
  copyFileSync(path.join(frontendRoot, "embed.html"), path.join(frontendDistRoot, "embed.html"));
  copyFileSync(path.join(frontendRoot, "embed-resize.js"), path.join(frontendDistRoot, "embed-resize.js"));
  copyFileSync(path.join(frontendRoot, "yuucomments-embed.js"), path.join(frontendDistRoot, "yuucomments-embed.js"));

  const config = `window.YuuCommentsConfig = {
  apiBase: "${workerUrl}",
  turnstileSiteKey: "${turnstileSiteKey}"
};
`;
  const configPath = path.join(frontendDistRoot, "yuucomments.config.js");
  setUtf8File(configPath, config);
  invokeCheckedCommand("Checking generated frontend config syntax", nodeInvocation, ["--check", configPath]);
}

function newAstroBundle() {
  ensureDirectory(astroDistRoot);
  copyFileSync(path.join(astroSourceRoot, "YuuComments.astro"), path.join(astroDistRoot, "YuuComments.astro"));
  copyFileSync(path.join(astroSourceRoot, "YuuCommentsIframe.astro"), path.join(astroDistRoot, "YuuCommentsIframe.astro"));
}

function newAdminBundle(workerUrl: string) {
  ensureDirectory(adminDistRoot);
  copyFileSync(path.join(adminSourceRoot, "admin.js"), path.join(adminDistRoot, "admin.js"));
  copyFileSync(path.join(adminSourceRoot, "admin.css"), path.join(adminDistRoot, "admin.css"));

  const adminHtml = readFileSync(path.join(adminSourceRoot, "index.html"), "utf8").replace('data-api-base=""', `data-api-base="${workerUrl}"`);
  setUtf8File(path.join(adminDistRoot, "index.html"), adminHtml);
}

function ensureDirectory(directory: string) {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function isBlank(value: unknown) {
  return value == null || String(value).trim().length === 0;
}

function stringValue(value: unknown) {
  return isBlank(value) ? "" : String(value);
}

function normalizeHostnames(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }

  if (isBlank(value)) {
    return [];
  }

  return String(value).split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function assertPnpmAvailable() {
  const result = runCommand(pnpmInvocation, ["--version"]);

  if (result.status !== 0) {
    throw new Error("pnpm is required but was not found in PATH.");
  }
}

async function main() {
  try {
    assertPnpmAvailable();

    if (!existsSync(wranglerConfigPath)) {
      copyFileSync(wranglerExamplePath, wranglerConfigPath);
    }

    console.log("");
    console.log("==> Checking Cloudflare login");
    const identity = ensureWranglerIdentity();

  if (!args.skipInstall) {
    invokeCheckedCommand("Installing dependencies", pnpmInvocation, ["install", "--frozen-lockfile"]);
  }

  const d1Config = getD1Config();
  let database = getD1DatabaseByName(d1Config.name);

  if (!database) {
    invokeCheckedCommand(`Creating D1 database ${d1Config.name}`, pnpmInvocation, ["exec", "wrangler", "d1", "create", d1Config.name]);
    database = getD1DatabaseByName(d1Config.name);

    if (!database) {
      throw new Error(`D1 database ${d1Config.name} was created, but its metadata could not be loaded.`);
    }
  }

  if (d1Config.id !== database.uuid) {
    if (isBlank(database.uuid)) {
      throw new Error(`D1 database ${d1Config.name} metadata did not include uuid.`);
    }

    console.log("");
    console.log("==> Updating wrangler.toml database_id");
    setD1DatabaseId(stringValue(database.uuid));
  }

  const requiredSecrets = getRequiredSecrets();
  const configuredSecrets = getConfiguredSecrets();
  const missingSecrets = requiredSecrets.filter((secret) => !configuredSecrets.includes(secret));
  const localSecrets = getLocalSecrets(secretsPath);
  const accountId = identity.accounts?.[0]?.id ?? "";
  let apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  let publicTurnstileSiteKey = process.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const localTurnstileSiteKey = getSecretValueFromFile("PUBLIC_TURNSTILE_SITE_KEY", secretsPath);
  const localTurnstileSecretKey = getSecretValueFromFile("TURNSTILE_SECRET_KEY", secretsPath);
  let localTurnstileHostnames = getSecretValueFromFile("TURNSTILE_HOSTNAMES", secretsPath);
  let createdTurnstileWidget = false;

  if (!isBlank(localTurnstileHostnames)) {
    addCorsOriginsForHostnames(localTurnstileHostnames);
  }

  if (isBlank(publicTurnstileSiteKey)) {
    publicTurnstileSiteKey = stringValue(localTurnstileSiteKey);
  }

  let turnstileWidget: TurnstileWidget | null = null;
  if (isBlank(localTurnstileSiteKey) && isBlank(localTurnstileSecretKey)) {
    if (isBlank(apiToken)) {
      apiToken = await readPlainSecret("Enter CLOUDFLARE_API_TOKEN to create Turnstile widget");
    }

    if (isBlank(apiToken)) {
      throw new Error("CLOUDFLARE_API_TOKEN is required to create a Turnstile widget automatically.");
    }

    const turnstileHostnames = await getTurnstileHostnames(secretsPath);
    localSecrets.TURNSTILE_HOSTNAMES = turnstileHostnames.filter((hostname) => hostname !== "127.0.0.1" && hostname !== "localhost");
    localTurnstileHostnames = localSecrets.TURNSTILE_HOSTNAMES;
    addCorsOriginsForHostnames(turnstileHostnames);
    turnstileWidget = await newTurnstileWidget(accountId, apiToken, turnstileHostnames);
    createdTurnstileWidget = true;
  } else if (!isBlank(apiToken) && !isBlank(accountId)) {
    turnstileWidget = await getTurnstileWidgetDetails(accountId, apiToken, publicTurnstileSiteKey);
  }

  if (turnstileWidget) {
    if (isBlank(publicTurnstileSiteKey)) {
      publicTurnstileSiteKey = stringValue(turnstileWidget.sitekey);
    }

    if (createdTurnstileWidget && !isBlank(turnstileWidget.secret)) {
      localSecrets.TURNSTILE_SECRET_KEY = turnstileWidget.secret;
    }

    if (
      missingSecrets.includes("TURNSTILE_SECRET_KEY") &&
      isBlank(process.env.TURNSTILE_SECRET_KEY) &&
      isBlank(getSecretValueFromFile("TURNSTILE_SECRET_KEY", secretsPath)) &&
      !isBlank(turnstileWidget.secret)
    ) {
      localSecrets.TURNSTILE_SECRET_KEY = turnstileWidget.secret;
    }
  }

  if (isBlank(publicTurnstileSiteKey)) {
    publicTurnstileSiteKey = await readPlainSecret("Enter PUBLIC_TURNSTILE_SITE_KEY");
  }

  if (isBlank(publicTurnstileSiteKey)) {
    throw new Error("PUBLIC_TURNSTILE_SITE_KEY cannot be empty.");
  }

  localSecrets.PUBLIC_TURNSTILE_SITE_KEY = publicTurnstileSiteKey;
  saveLocalSecrets(localSecrets, secretsPath);

  let deploySecretsFile: string | null = null;

  if (missingSecrets.length > 0) {
    const secretsToUpload: JsonObject = {};

    for (const secretName of missingSecrets) {
      if (secretName === "ADMIN_TOKEN") {
        let secretValue = process.env[secretName] ?? "";

        if (isBlank(secretValue)) {
          secretValue = stringValue(getSecretValueFromFile(secretName, secretsPath));
        }

        if (isBlank(secretValue)) {
          secretValue = newAdminToken();
        }

        secretsToUpload[secretName] = secretValue;
        localSecrets[secretName] = secretValue;
        continue;
      }

      if (secretName === "TURNSTILE_SECRET_KEY") {
        let secretValue = process.env[secretName] ?? "";

        if (isBlank(secretValue)) {
          secretValue = stringValue(getSecretValueFromFile(secretName, secretsPath));
        }

        if (isBlank(secretValue) && turnstileWidget && !isBlank(turnstileWidget.secret)) {
          secretValue = stringValue(turnstileWidget.secret);
        }

        if (isBlank(secretValue)) {
          secretValue = await readPlainSecret("Enter TURNSTILE_SECRET_KEY");
        }

        if (isBlank(secretValue)) {
          throw new Error("TURNSTILE_SECRET_KEY cannot be empty.");
        }

        secretsToUpload[secretName] = secretValue;
        localSecrets[secretName] = secretValue;
        continue;
      }

      let secretValue = process.env[secretName] ?? "";

      if (isBlank(secretValue)) {
        secretValue = stringValue(getSecretValueFromFile(secretName, secretsPath));
      }

      if (isBlank(secretValue)) {
        secretValue = await readPlainSecret(`Enter ${secretName}`);
      }

      if (isBlank(secretValue)) {
        throw new Error(`${secretName} cannot be empty.`);
      }

      secretsToUpload[secretName] = secretValue;
      localSecrets[secretName] = secretValue;
    }

    saveLocalSecrets(localSecrets, secretsPath);
    const tempSecretsFile = newTempSecretsFile(secretsToUpload);

    if (tempSecretsFile) {
      if (workerExists) {
        uploadSecrets(tempSecretsFile);
      } else {
        deploySecretsFile = tempSecretsFile;
      }
    }
  }

  if (isBlank(localTurnstileHostnames)) {
    const siteHostnames = await getConfiguredSiteHostnames(secretsPath);
    localSecrets.TURNSTILE_HOSTNAMES = siteHostnames;
    addCorsOriginsForHostnames(siteHostnames);
  }

  if (createdTurnstileWidget && !isBlank(turnstileWidget?.secret) && !missingSecrets.includes("TURNSTILE_SECRET_KEY")) {
    const turnstileSecretUpdate = newTempSecretsFile({
      TURNSTILE_SECRET_KEY: turnstileWidget?.secret,
    });

    if (turnstileSecretUpdate) {
      if (workerExists) {
        uploadSecrets(turnstileSecretUpdate);
      } else {
        deploySecretsFile = turnstileSecretUpdate;
      }
    }
  }

  invokeCheckedCommand("Running TypeScript checks", pnpmInvocation, ["typecheck"]);
  invokeCheckedCommand("Applying remote D1 migrations", pnpmInvocation, ["db:migrate:remote"]);

  let deployOutput: string[];
  try {
    deployOutput = invokeDeployWorker(deploySecretsFile);
  } finally {
    if (deploySecretsFile) {
      deleteTempSecretsFile(deploySecretsFile);
    }
  }

  const workerUrl = getWorkerUrlFromDeployOutput(deployOutput);

  if (!workerUrl) {
    throw new Error("Worker API URL could not be detected; frontend bundle was not generated.");
  }

  newFrontendBundle(workerUrl, publicTurnstileSiteKey);
  newAstroBundle();
  newAdminBundle(workerUrl);

  console.log("");
  console.log("Backend deployment completed.");
  console.log(`Worker API URL: ${workerUrl}`);
  console.log(`PUBLIC_TURNSTILE_SITE_KEY: ${publicTurnstileSiteKey}`);

  if (Object.hasOwn(localSecrets, "ADMIN_TOKEN")) {
    console.log(`ADMIN_TOKEN: ${localSecrets.ADMIN_TOKEN}`);
  } else {
    console.log("ADMIN_TOKEN: already configured remotely; value is not available locally.");
  }
  console.log("");
  console.log("Minimal frontend embed:");
  console.log('<div id="yuucomments" data-page-key="/posts/example/"></div>');
  console.log('<link rel="stylesheet" href="/comments/comments.css" />');
  console.log('<script src="/comments/yuucomments.config.js"></script>');
  console.log('<script src="/comments/comments.js" defer></script>');
  console.log("");
  console.log("Iframe frontend embed:");
  console.log('<div id="yuucomments-iframe" data-page-key="/posts/example/" data-src="/comments/embed.html" data-theme="light" data-lang="zh-CN"></div>');
  console.log('<script src="/comments/yuucomments-embed.js" defer></script>');
  console.log("");
  console.log("Publish the files in dist/frontend/ to your site's /comments/ directory.");
  console.log("Copy dist/astro/YuuComments.astro for inline Astro integration.");
  console.log("Copy dist/astro/YuuCommentsIframe.astro for iframe Astro integration.");
  console.log("Publish the files in dist/admin/ to your site's /admin/ directory.");
  console.log("");
  console.log("Astro / Mizuki environment variables:");
  console.log(`PUBLIC_COMMENTS_API_BASE_URL=${workerUrl}`);
  console.log(`PUBLIC_TURNSTILE_SITE_KEY=${publicTurnstileSiteKey}`);
  } finally {
    deleteTrackedTempSecretsFiles();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
