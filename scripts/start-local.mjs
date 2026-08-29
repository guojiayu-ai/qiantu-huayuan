import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [resolve(projectRoot, "scripts/local-data-server.mjs")], { cwd: projectRoot, stdio: "inherit" }),
  spawn(process.execPath, [resolve(projectRoot, "node_modules/vinext/dist/cli.js"), "dev", "--host", "127.0.0.1", "--port", "3000"], { cwd: projectRoot, stdio: "inherit", env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" } }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}

for (const child of children) child.on("exit", (code, signal) => { if (!stopping && (code || signal)) stop(code || 1); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
