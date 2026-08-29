import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("shares one private local file between local browser origins", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "money-garden-test-"));
  const dataFile = join(folder, "state.json");
  const port = 44000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/local-data-server.mjs", import.meta.url))], {
    env: { ...process.env, MONEY_GARDEN_PORT: String(port), MONEY_GARDEN_DATA_FILE: dataFile },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGTERM"));
  let startupError = "";
  child.stderr.on("data", (chunk) => { startupError += chunk.toString(); });

  const endpoint = `http://127.0.0.1:${port}/v1/state`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(endpoint)).ok) { ready = true; break; } } catch { /* server is starting */ }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!ready && /listen EPERM/.test(startupError)) return t.skip("Sandbox does not permit loopback listeners");
  assert.equal(ready, true, startupError || "Local data server did not start");

  const saved = await fetch(endpoint, { method: "PUT", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ accounts: [{ name: "测试账户" }] }) });
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const loaded = await fetch(endpoint, { headers: { origin: "http://127.0.0.1:3000" } });
  assert.deepEqual((await loaded.json()).data.accounts, [{ name: "测试账户" }]);
  assert.match(await readFile(dataFile, "utf8"), /测试账户/);

  const rejected = await fetch(endpoint, { headers: { origin: "https://example.com" } });
  assert.equal(rejected.status, 403);
});
