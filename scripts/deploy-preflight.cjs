const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG_PATH = path.resolve(".vscode", "sftp.json");
const DOTENV_PATH = path.resolve(".env");

function fail(message) {
  console.error(`Preflight failed: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Preflight warning: ${message}`);
}

function expandEnvTokens(input) {
  let output = input;
  output = output.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => process.env[name] || LOCAL_ENV[name] || "");
  output = output.replace(/%([^%]+)%/g, (_, name) => process.env[name] || LOCAL_ENV[name] || "");
  return output;
}

function expandEnvPath(input) {
  if (typeof input !== "string" || !input.trim()) {
    return "";
  }

  let output = expandEnvTokens(input.trim());

  if (output === "~") {
    return os.homedir();
  }

  if (output.startsWith("~/") || output.startsWith("~\\")) {
    return path.join(os.homedir(), output.slice(2));
  }

  return output;
}

function expandEnvValue(input) {
  if (typeof input !== "string") {
    return "";
  }
  return expandEnvTokens(input).trim();
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail("Missing .vscode/sftp.json");
  }

  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in .vscode/sftp.json: ${error.message}`);
  }
}

function requireFields(config, fields) {
  for (const field of fields) {
    if (!config[field]) {
      fail(`Missing '${field}' in .vscode/sftp.json`);
    }
  }
}

function ensureNotSshSession() {
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY) {
    fail("Deploy must be run from your local terminal in the project directory, not inside an SSH session.");
  }
}

function checkSecurityHints(config) {
  if (String(config.username || "").toLowerCase() === "root") {
    warn("SFTP username is 'root'. Prefer a dedicated deploy user with limited permissions.");
  }

  const rawPassphrase = typeof config.passphrase === "string" ? config.passphrase.trim() : "";
  const envPassphrase = expandEnvValue(process.env.SFTP_PASSPHRASE || "");
  const resolvedPassphrase = expandEnvValue(rawPassphrase);
  const hasEnvExpression = /\$\{env:[A-Za-z_][A-Za-z0-9_]*\}|%[^%]+%/.test(rawPassphrase);

  if (rawPassphrase && !hasEnvExpression && !envPassphrase) {
    warn("passphrase is stored directly in .vscode/sftp.json. Prefer ${env:SFTP_PASSPHRASE}.");
  }

  if (rawPassphrase && hasEnvExpression && !resolvedPassphrase && !envPassphrase) {
    warn("passphrase env reference is configured but currently unresolved.");
  }
}

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const out = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const LOCAL_ENV = parseDotEnv(DOTENV_PATH);

function checkEnvSecurityHints() {
  const vars = LOCAL_ENV;
  if (!Object.keys(vars).length) {
    return;
  }

  const weakValues = new Set(["change-me", "tonMotDePasseFort", "admin", "password", "123456"]);
  const adminPassword = String(vars.ADMIN_PASSWORD || "").trim();
  const publicAdminPassword = String(vars.NEXT_PUBLIC_ADMIN_PASSWORD || "").trim();
  if (weakValues.has(adminPassword) || weakValues.has(publicAdminPassword)) {
    warn("Weak admin password detected in .env. Use a long random value for ADMIN_PASSWORD and NEXT_PUBLIC_ADMIN_PASSWORD.");
  }

  const frontendAiKeys = [
    "VITE_OPENAI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "VITE_ANTHROPIC_API_KEY",
    "VITE_PERPLEXITY_API_KEY",
  ];

  for (const key of frontendAiKeys) {
    const value = String(vars[key] || "").trim();
    if (!value || value.startsWith("your-")) {
      continue;
    }
    warn(`${key} is defined. Any VITE_* key is exposed in the browser bundle.`);
  }
}

function ensureReadablePrivateKey(config) {
  const privateKeyPath = expandEnvPath(config.privateKeyPath);
  if (!privateKeyPath) {
    fail("privateKeyPath is empty in .vscode/sftp.json");
  }

  const resolvedKeyPath = path.resolve(privateKeyPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    fail(`Private key not found: ${resolvedKeyPath}`);
  }

  try {
    fs.accessSync(resolvedKeyPath, fs.constants.R_OK);
  } catch (error) {
    fail(`Private key is not readable: ${resolvedKeyPath}`);
  }

  return resolvedKeyPath;
}

function ensureBuildArtifacts() {
  const buildDir = path.resolve("build");
  const buildIndex = path.join(buildDir, "index.html");
  const buildHtaccess = path.join(buildDir, ".htaccess");
  const buildRobots = path.join(buildDir, "robots.txt");
  const buildSitemap = path.join(buildDir, "sitemap.xml");

  if (!fs.existsSync(buildDir)) {
    fail("Missing build/ directory. Run npm run deploy first.");
  }

  if (!fs.existsSync(buildIndex)) {
    fail("Missing build/index.html. Build output is incomplete.");
  }

  if (!fs.existsSync(buildHtaccess)) {
    fail("Missing build/.htaccess. Apache routing rules were not copied to the deploy artifact.");
  }

  if (!fs.existsSync(buildRobots)) {
    fail("Missing build/robots.txt. Run the SEO build pipeline before deploy.");
  }

  if (!fs.existsSync(buildSitemap)) {
    fail("Missing build/sitemap.xml. Run the SEO build pipeline before deploy.");
  }
}

function main() {
  const requireBuild = process.argv.includes("--require-build");

  ensureNotSshSession();
  const config = loadConfig();
  requireFields(config, ["host", "port", "username", "remotePath", "privateKeyPath"]);
  checkSecurityHints(config);
  checkEnvSecurityHints();
  const resolvedKeyPath = ensureReadablePrivateKey(config);

  if (requireBuild) {
    ensureBuildArtifacts();
  }

  console.log(`Preflight OK. SSH key: ${resolvedKeyPath}`);
}

main();
