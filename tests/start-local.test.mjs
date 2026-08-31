import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

test("local launcher reuses healthy services instead of failing on occupied ports", async (t) => {
  const dataServer = createServer((request, response) => {
    response.writeHead(request.url === "/health" ? 200 : 404, { "content-type": "application/json" });
    response.end("{}");
  });
  const webServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
  });
  t.after(() => dataServer.close());
  t.after(() => webServer.close());

  let dataPort;
  let webPort;
  try {
    dataPort = await listen(dataServer);
    webPort = await listen(webServer);
  } catch (error) {
    if (error?.code === "EPERM") return t.skip("Sandbox does not permit loopback listeners");
    throw error;
  }

  const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/start-local.mjs", import.meta.url))], {
    env: {
      ...process.env,
      MONEY_GARDEN_HOST: "127.0.0.1",
      MONEY_GARDEN_PORT: String(dataPort),
      MONEY_GARDEN_WEB_HOST: "127.0.0.1",
      MONEY_GARDEN_WEB_HEALTH_HOST: "127.0.0.1",
      MONEY_GARDEN_WEB_PORT: String(webPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  let errorOutput = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));

  assert.equal(exitCode, 0, errorOutput);
  assert.match(output, /Reusing local data service/);
  assert.match(output, /Reusing web app/);
});
