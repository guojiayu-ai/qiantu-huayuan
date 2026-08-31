import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataHost = process.env.MONEY_GARDEN_HOST || "127.0.0.1";
const dataPort = process.env.MONEY_GARDEN_PORT || "43128";
const webHost = process.env.MONEY_GARDEN_WEB_HOST || "127.0.0.1";
const webHealthHost = process.env.MONEY_GARDEN_WEB_HEALTH_HOST || "localhost";
const webPort = process.env.MONEY_GARDEN_WEB_PORT || "3000";

async function serviceReady(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    return false;
  }
}

const children = [];
if (await serviceReady(`http://${dataHost}:${dataPort}/health`)) {
  process.stdout.write(`Reusing local data service on ${dataHost}:${dataPort}\n`);
} else {
  children.push(spawn(process.execPath, [resolve(projectRoot, "scripts/local-data-server.mjs")], { cwd: projectRoot, stdio: "inherit" }));
}

if (await serviceReady(`http://${webHealthHost}:${webPort}`)) {
  process.stdout.write(`Reusing web app on http://${webHealthHost}:${webPort}\n`);
} else {
  children.push(spawn(process.execPath, [resolve(projectRoot, "node_modules/vinext/dist/cli.js"), "dev", "--host", webHost, "--port", webPort], { cwd: projectRoot, stdio: "inherit", env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" } }));
}

if (!children.length) process.exit(0);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}

for (const child of children) child.on("exit", (code, signal) => {
  if (!stopping) stop(code || (signal ? 1 : 0));
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
