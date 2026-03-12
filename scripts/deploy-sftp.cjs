const fs = require("fs");
const os = require("os");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const DEFAULT_PRESERVE_REMOTE = [".well-known"];
const DOTENV_PATH = path.resolve(".env");

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

function fail(message) {
  throw new Error(message);
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

function requireConfig(config) {
  const required = ["host", "port", "username", "remotePath", "privateKeyPath"];
  for (const key of required) {
    if (!config[key]) {
      fail(`Missing '${key}' in .vscode/sftp.json`);
    }
  }
}

function resolvePrivateKey(config) {
  const keyPath = path.resolve(expandEnvPath(config.privateKeyPath));
  if (!fs.existsSync(keyPath)) {
    fail(`Private key not found: ${keyPath}`);
  }

  try {
    const privateKey = fs.readFileSync(keyPath, "utf8");
    return { privateKey, keyPath };
  } catch (error) {
    fail(`Unable to read private key at ${keyPath}: ${error.message}`);
  }
}

function resolvePassphrase(config) {
  // Allow a dedicated env var without changing existing config behavior.
  const envPassphrase = expandEnvValue(process.env.SFTP_PASSPHRASE || "");
  if (envPassphrase) {
    return envPassphrase;
  }

  const configPassphrase = expandEnvValue(config.passphrase || "");
  return configPassphrase || undefined;
}

function getPreserveSet(config) {
  const preserveFromConfig = Array.isArray(config.preserveRemote) ? config.preserveRemote : [];
  const merged = [...DEFAULT_PRESERVE_REMOTE, ...preserveFromConfig]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return new Set(merged);
}

async function removeRemoteEntry(sftp, remotePath, itemType) {
  if (itemType === "d") {
    const children = await sftp.list(remotePath);
    for (const child of children) {
      const childPath = path.posix.join(remotePath, child.name);
      await removeRemoteEntry(sftp, childPath, child.type);
    }

    await sftp.rmdir(remotePath);
    console.log(`Removed directory: ${remotePath}`);
    return;
  }

  await sftp.delete(remotePath);
  console.log(`Removed file: ${remotePath}`);
}

async function cleanRemoteRoot(sftp, remoteRoot, preserveSet) {
  const existing = await sftp.list(remoteRoot);
  for (const item of existing) {
    if (preserveSet.has(item.name)) {
      console.log(`Preserved: ${path.posix.join(remoteRoot, item.name)}`);
      continue;
    }

    const target = path.posix.join(remoteRoot, item.name);
    await removeRemoteEntry(sftp, target, item.type);
  }
}

async function uploadDir(sftp, localDir, remoteDir) {
  try {
    await sftp.mkdir(remoteDir, true);
  } catch (_) {
    // Directory may already exist
  }

  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = path.posix.join(remoteDir, entry.name);

    if (entry.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
      continue;
    }

    if (entry.isFile()) {
      await sftp.put(localPath, remotePath);
      console.log(`Uploaded: ${remotePath}`);
    }
  }
}

async function main() {
  const configPath = path.resolve(".vscode", "sftp.json");
  if (!fs.existsSync(configPath)) {
    fail("Missing .vscode/sftp.json");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  requireConfig(config);

  const buildDir = String(process.env.DEPLOY_BUILD_DIR || "build").trim() || "build";
  const localRoot = path.resolve(buildDir);
  if (!fs.existsSync(localRoot)) {
    fail(`Missing ${buildDir}/ directory. Run npm run deploy first.`);
  }

  const remoteRoot = config.remotePath.replace(/\\/g, "/");
  const preserveSet = getPreserveSet(config);
  const { privateKey, keyPath } = resolvePrivateKey(config);
  const passphrase = resolvePassphrase(config);
  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host: config.host,
      port: Number(config.port) || 22,
      username: config.username,
      privateKey,
      passphrase,
      readyTimeout: 60000,
    });

    console.log(`Connected with SSH key: ${keyPath}`);
    await sftp.mkdir(remoteRoot, true);
    await cleanRemoteRoot(sftp, remoteRoot, preserveSet);
    await uploadDir(sftp, localRoot, remoteRoot);

    const remoteIndex = path.posix.join(remoteRoot, "index.html");
    const stat = await sftp.stat(remoteIndex);
    if (!stat || !stat.size) {
      fail("Remote index.html is missing or empty after upload.");
    }

    console.log(`Verified remote index.html size=${stat.size}`);
    console.log("Deploy upload finished.");
  } finally {
    await sftp.end();
  }
}

main().catch((error) => {
  console.error(`Deploy failed: ${error.message}`);
  process.exit(1);
});
