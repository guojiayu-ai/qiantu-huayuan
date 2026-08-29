import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the RMB finance tracker", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>钱途花园｜实习期个人资产与定投计划<\/title>/i);
  assert.match(html, /本地保存 · 北京时间 · 人民币/);
  assert.match(html, /日期（北京时间）/);
  assert.match(html, /金额（人民币元）/);
  assert.match(html, /导出完整 CSV/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps financial data device-local with explicit locale metadata", async () => {
  const [page, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);

  assert.match(page, /localStorage\.getItem/);
  assert.match(page, /localStorage\.setItem/);
  assert.doesNotMatch(page, /fetch\s*\(/);
  assert.match(page, /TIME_ZONE = "Asia\/Shanghai"/);
  assert.match(page, /CURRENCY_CODE = "CNY"/);
  assert.match(page, /\+ 添加账户/);
  assert.match(page, /如：浦发银行/);
  assert.doesNotMatch(page, /7956|8259|4827/);
  assert.equal(hostingConfig.d1, null);
  assert.equal(hostingConfig.r2, null);
});
