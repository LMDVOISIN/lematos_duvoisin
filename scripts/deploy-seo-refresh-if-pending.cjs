/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

function readDotEnv(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }

  return map;
}

function getEnvValue(envMap, ...keys) {
  for (const key of keys) {
    const value = process.env[key] || envMap[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseInteger(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isMissingQueueTableError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "PGRST205" ||
    /seo_refresh_requests/i.test(message) && /does not exist|schema cache/i.test(message)
  );
}

function resolveNpmExecution() {
  if (process.platform !== "win32") {
    return {
      command: "npm",
      baseArgs: [],
    };
  }

  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      baseArgs: [npmExecPath],
    };
  }

  const nodeDir = path.dirname(process.execPath);
  const npmCliCandidates = [
    path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "..", "node_modules", "npm", "bin", "npm-cli.js"),
  ];

  const npmCliPath = npmCliCandidates.find((candidate) => fs.existsSync(candidate));
  if (npmCliPath) {
    return {
      command: process.execPath,
      baseArgs: [npmCliPath],
    };
  }

  const comSpec =
    process.env.ComSpec ||
    process.env.COMSPEC ||
    path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");

  return {
    command: comSpec,
    baseArgs: ["/d", "/s", "/c"],
    useShellCommand: true,
  };
}

function runNpmScript(scriptName) {
  const execution = resolveNpmExecution();
  const args = execution.useShellCommand
    ? [...execution.baseArgs, `npm run ${scriptName}`]
    : [...execution.baseArgs, "run", scriptName];

  return spawnSync(execution.command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true,
  });
}

function buildFailureMessage(child, scriptName) {
  if (child?.error) {
    const parts = [
      `${scriptName} spawn failed`,
      child.error.code || null,
      child.error.message || null,
    ].filter(Boolean);
    return parts.join(": ");
  }

  if (typeof child?.status === "number") {
    return `${scriptName} exit=${child.status}`;
  }

  if (child?.signal) {
    return `${scriptName} signal=${child.signal}`;
  }

  return `${scriptName} exit=unknown`;
}

async function main() {
  const envMap = readDotEnv(path.resolve(".env"));
  const supabaseUrl = getEnvValue(envMap, "SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = getEnvValue(envMap, "SUPABASE_SERVICE_ROLE_KEY");
  const batchLimit = parseInteger(getEnvValue(envMap, "SEO_REFRESH_QUEUE_BATCH_LIMIT"), 200);
  const requestType = getEnvValue(envMap, "SEO_REFRESH_REQUEST_TYPE") || "seo_refresh_annonces";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: pendingRows, error: pendingError } = await supabase
    .from("seo_refresh_requests")
    .select("id, annonce_id, created_at, source, reason")
    .eq("status", "pending")
    .eq("request_type", requestType)
    .order("created_at", { ascending: true })
    .limit(batchLimit);

  if (pendingError) {
    if (isMissingQueueTableError(pendingError)) {
      console.log("[seo-refresh-queue] Table seo_refresh_requests absente. Appliquez les migrations puis reessayez.");
      return;
    }
    throw pendingError;
  }

  if (!Array.isArray(pendingRows) || pendingRows.length === 0) {
    console.log("[seo-refresh-queue] Aucune demande en attente.");
    return;
  }

  const ids = pendingRows.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) {
    console.log("[seo-refresh-queue] Aucune demande exploitable.");
    return;
  }

  const startedAt = new Date().toISOString();
  const { error: lockError } = await supabase
    .from("seo_refresh_requests")
    .update({
      status: "processing",
      started_at: startedAt,
      updated_at: startedAt,
      error_message: null
    })
    .in("id", ids)
    .eq("status", "pending");

  if (lockError) {
    throw lockError;
  }

  console.log(`[seo-refresh-queue] ${ids.length} demande(s) detectee(s). Lancement du refresh SEO + upload...`);

  const child = runNpmScript("deploy:server:seo-refresh");

  const finishedAt = new Date().toISOString();

  if (child.status === 0) {
    const { error: doneError } = await supabase
      .from("seo_refresh_requests")
      .update({
        status: "done",
        processed_at: finishedAt,
        updated_at: finishedAt,
        error_message: null
      })
      .in("id", ids);

    if (doneError) {
      throw doneError;
    }

    console.log(`[seo-refresh-queue] Refresh termine. ${ids.length} demande(s) marquee(s) done.`);
    return;
  }

  const failureMessage = buildFailureMessage(child, "deploy:server:seo-refresh");
  await supabase
    .from("seo_refresh_requests")
    .update({
      status: "failed",
      processed_at: finishedAt,
      updated_at: finishedAt,
      error_message: failureMessage
    })
    .in("id", ids);

  throw new Error(failureMessage);
}

main().catch((error) => {
  console.error(`[seo-refresh-queue] Echec: ${error.message}`);
  process.exit(1);
});
