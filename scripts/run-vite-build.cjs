const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  let sourcemap = false;
  let outDir = "build";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--sourcemap") {
      sourcemap = true;
      continue;
    }

    if (arg === "--outDir") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error("Missing value for --outDir");
      }

      outDir = nextValue;
      index += 1;
      continue;
    }
  }

  return { sourcemap, outDir };
}

async function removePathWithRetries(targetPath, attempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const details = error && error.code ? `${error.code}: ${error.message}` : String(error);

      if (attempt === attempts) {
        throw new Error(`Unable to remove '${targetPath}' after ${attempts} attempts. ${details}`);
      }

      console.warn(`[build] Cleanup retry ${attempt}/${attempts} failed for ${targetPath}. ${details}`);
      await sleep(delayMs);
    }
  }
}

async function emptyDirWithRetries(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entryNames = fs.readdirSync(dirPath);
  for (const entryName of entryNames) {
    const entryPath = path.join(dirPath, entryName);
    await removePathWithRetries(entryPath);
  }

  console.log(`[build] Cleared previous output contents: ${dirPath}`);
}

async function main() {
  const { sourcemap, outDir } = parseArgs(process.argv.slice(2));
  const resolvedOutDir = path.resolve(outDir);

  await emptyDirWithRetries(resolvedOutDir);

  const viteCli = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  const viteArgs = [viteCli, "build", "--emptyOutDir", "false", "--outDir", outDir];
  if (sourcemap) {
    viteArgs.push("--sourcemap");
  }

  console.log(`[build] Starting Vite build${sourcemap ? " with sourcemaps" : ""} -> ${resolvedOutDir}`);

  const child = spawn(process.execPath, viteArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(`[build] Failed to start Vite build. ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(`[build] ${error.message}`);
  process.exit(1);
});
