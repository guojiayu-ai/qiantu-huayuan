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
  assert.match(html, /仅此浏览器(?:<!-- -->)? · 北京时间 · 人民币/);
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
  assert.match(page, /http:\/\/127\.0\.0\.1:43128\/v1\/state/);
  assert.match(page, /http:\/\/localhost:3000/);
  assert.match(page, /本机已同步/);
  assert.match(page, /TIME_ZONE = "Asia\/Shanghai"/);
  assert.match(page, /CURRENCY_CODE = "CNY"/);
  assert.match(page, /\+ 添加账户/);
  assert.match(page, /如：浦发银行/);
  assert.match(
    page,
    /tone: item\.tone \|\| legacyTones\[item\.color \|\| ""\] \|\| tones\[index % tones\.length\]/,
  );
  assert.match(page, /latestPricedTrade/);
  assert.match(page, /priceIsEstimated/);
  assert.match(page, /最近成交价/);
  assert.match(page, /asOfTodayInvestments/);
  assert.match(page, /asOfTodayFlows/);
  assert.match(page, /const \[dashboardMonth, setDashboardMonth\] = useState\(currentMonth\)/);
  assert.match(page, /dashboardMonthFlows/);
  assert.match(page, /dashboardMonthInvestments/);
  assert.match(page, /看板月份/);
  assert.match(page, /资产分布/);
  assert.doesNotMatch(page, /const income = monthFlows/);
  assert.doesNotMatch(page, /const investmentCashflow = monthInvestments/);
  assert.match(page, /accountNetFlows/);
  assert.match(page, /investmentAccountEffect/);
  assert.match(page, /asOfTodayInvestments\.forEach/);
  assert.match(page, /currentBalance: Number\(account\.balance \|\| 0\) \+ \(accountNetFlows\.get\(account\.id!\) \|\| 0\)/);
  assert.match(page, /const totalAssets = bankTotal \+ fundMarketValue/);
  assert.match(page, /各账户当前余额 \+ 基金当前市值/);
  assert.match(page, /不受收支月份影响/);
  assert.match(page, /当前净值（元）/);
  assert.match(page, /未来日期记录不会提前计入/);
  assert.match(page, /收入、支出和投资交易都会自动计入所选账户/);
  assert.match(page, /className="history-month"/);
  assert.doesNotMatch(page, /className="nav-right"><label>.*type="month"/);
  assert.doesNotMatch(page, /if \(next === "定投"\) setMonth\(currentMonth\)/);
  assert.match(page, /const \[investmentMonth, setInvestmentMonth\] = useState\(""\)/);
  assert.match(page, /investmentMonth \? investments\.filter\(\(item\) => item\.date\.startsWith\(investmentMonth\)\) : investments/);
  assert.match(page, /onClick=\{\(\) => setInvestmentMonth\(""\)\}>全部/);
  assert.match(page, /aria-label="筛选定投月份"/);
  assert.doesNotMatch(page, /latestInvestment\.date\.slice/);
  assert.match(page, /定投标的/);
  assert.match(page, /支持添加多只/);
  assert.match(page, /组合定位/);
  assert.match(page, /估值方法/);
  const investmentPage = page.slice(
    page.indexOf('{tab === "定投" && <div className="tab-panel invest-panel">'),
    page.indexOf('{tab === "资产" && <div className="tab-panel asset-panel">'),
  );
  const settingsPage = page.slice(
    page.indexOf('{tab === "设置" && <div className="tab-panel settings-panel">'),
  );
  assert.match(investmentPage, /<h2>记录投资<\/h2>/);
  assert.doesNotMatch(investmentPage, /我的计划|定投标的|当前净值（元）/);
  assert.match(settingsPage, /我的计划/);
  assert.match(settingsPage, /定投标的/);
  assert.match(settingsPage, /value=\{plan\.stockTarget \|\| ""\}/);
  assert.match(settingsPage, /value=\{plan\.maxDrawdown \|\| ""\}/);
  assert.match(settingsPage, /className="settings-row settings-row-full plan-row"/);
  assert.match(settingsPage, /className="settings-row settings-row-full fund-row"/);
  assert.match(settingsPage, /className="settings-row management-row"/);
  assert.doesNotMatch(settingsPage, /className="settings-row strategy-row"/);
  assert.doesNotMatch(settingsPage, /className="settings-stack"/);
  assert.match(settingsPage, /当前净值（元）/);
  assert.doesNotMatch(settingsPage, /买入、暂停、退出与复盘规则/);
  assert.match(page, /function deleteFund/);
  assert.match(settingsPage, /className="delete-button"/);
  assert.doesNotMatch(settingsPage, /fund\.active \? "停用" : "启用"/);
  assert.doesNotMatch(settingsPage, /<h2>设置<\/h2>/);
  assert.match(settingsPage, /categories\.filter\(\(item\) => item\.type === newCategoryType\)/);
  assert.match(settingsPage, /className="category-switch"/);
  assert.match(settingsPage, /\(\["收入", "支出"\] as FlowType\[\]\)/);
  assert.match(settingsPage, /className="mini-form category-form"/);
  assert.match(settingsPage, /className="category-delete"/);
  assert.match(page, /function deleteCategory/);
  assert.match(page, /基金 \/ ETF/);
  assert.match(page, /交易手续费（元）/);
  assert.match(page, /成交金额（不含手续费）/);
  assert.match(page, /成交时指数估值/);
  assert.match(page, /估值数据来源/);
  assert.match(page, /估值计算口径/);
  assert.match(page, /偏离计划原因/);
  assert.match(page, /标的 \/ 账户/);
  assert.match(page, /份额 \/ 成交价/);
  assert.match(page, /成交估值/);
  assert.match(page, /备注 \/ 偏离/);
  assert.match(page, /item\.price \? currency\.format\(item\.price\)/);
  assert.match(page, /item\.deviationReason/);
  assert.match(page, /估值数据来源: i\.valuationSource/);
  assert.match(page, /实际支出/);
  assert.doesNotMatch(page, /7956|8259|4827/);
  assert.equal(hostingConfig.d1, null);
  assert.equal(hostingConfig.r2, null);
});
