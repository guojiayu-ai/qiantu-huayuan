import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.MONEY_GARDEN_HOST || "127.0.0.1";
const port = Number(process.env.MONEY_GARDEN_PORT || 43128);
const dataFile = resolve(process.env.MONEY_GARDEN_DATA_FILE || resolve(projectRoot, ".local-data/money-garden.json"));
const maxBytes = 2 * 1024 * 1024;

function localOrigin(origin = "") {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function headers(origin = "") {
  const result = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-methods": "GET, PUT, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  if (localOrigin(origin)) result["access-control-allow-origin"] = origin;
  return result;
}

function reply(response, status, body, origin) {
  response.writeHead(status, headers(origin));
  response.end(JSON.stringify(body));
}

async function loadState() {
  try {
    return JSON.parse(await readFile(dataFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { revision: 0, updatedAt: null, data: null };
    throw error;
  }
}

async function saveState(data) {
  const previous = await loadState();
  const next = { revision: Number(previous.revision || 0) + 1, updatedAt: new Date().toISOString(), data };
  await mkdir(dirname(dataFile), { recursive: true, mode: 0o700 });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, dataFile);
  return next;
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  if (origin && !localOrigin(origin)) return reply(response, 403, { error: "Only local browser origins are allowed" }, origin);
  if (request.method === "OPTIONS") return reply(response, 204, {}, origin);

  try {
    if (request.url === "/health" && request.method === "GET") return reply(response, 200, { ok: true }, origin);
    if (request.url === "/v1/state" && request.method === "GET") return reply(response, 200, await loadState(), origin);
    if (request.url === "/v1/state" && request.method === "PUT") {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxBytes) return reply(response, 413, { error: "Backup is too large" }, origin);
        chunks.push(chunk);
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(response, 400, { error: "Invalid state" }, origin);
      return reply(response, 200, await saveState(parsed), origin);
    }
    return reply(response, 404, { error: "Not found" }, origin);
  } catch (error) {
    return reply(response, 500, { error: error instanceof Error ? error.message : "Unknown error" }, origin);
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Money Garden local data: http://${host}:${port}\nData file: ${dataFile}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
