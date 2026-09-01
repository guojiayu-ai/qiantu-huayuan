import assert from "node:assert/strict";
import test from "node:test";

import { amountOnlyInvestmentValueEffect, investmentAccountEffect, newestFirst } from "../lib/finance.mjs";

test("investment operations update the selected cash account with fees exactly once", () => {
  assert.equal(investmentAccountEffect({ type: "买入", amount: 139, fee: 0.1 }), -139.1);
  assert.equal(investmentAccountEffect({ type: "卖出", amount: 200, fee: 0.2 }), 199.8);
  assert.equal(investmentAccountEffect({ type: "分红", amount: 12.34, fee: 0 }), 12.34);
  assert.equal(investmentAccountEffect({ type: "费用", amount: 1.5, fee: 0 }), -1.5);
});

test("buying a fund transfers cash into holdings without double counting", () => {
  const startingCash = 1000;
  const trade = { type: "买入", amount: 139, fee: 0.1 };
  const fundMarketValue = 100 * 1.39;
  const totalAssets = startingCash + investmentAccountEffect(trade) + fundMarketValue;

  assert.equal(totalAssets, 999.9);
});

test("amount-only cash funds update other investment market value", () => {
  const cashFund = { role: "现金备用层", valuationMethod: "万份收益、7日年化收益率" };
  const etf = { role: "核心宽基", valuationMethod: "盈利收益率法" };

  assert.equal(amountOnlyInvestmentValueEffect({ type: "买入", amount: 2000 }, cashFund), 2000);
  assert.equal(amountOnlyInvestmentValueEffect({ type: "卖出", amount: 2000 }, cashFund), -2000);
  assert.equal(amountOnlyInvestmentValueEffect({ type: "分红", amount: 10 }, cashFund), 0);
  assert.equal(amountOnlyInvestmentValueEffect({ type: "买入", amount: 2000 }, etf), 0);
});

test("investment history is newest first and preserves same-day entry order", () => {
  const records = [
    { id: "old", date: "2026-07-27" },
    { id: "new-first", date: "2026-09-01" },
    { id: "same-day-a", date: "2026-08-31" },
    { id: "same-day-b", date: "2026-08-31" },
  ];

  assert.deepEqual(newestFirst(records).map((item) => item.id), ["new-first", "same-day-a", "same-day-b", "old"]);
  assert.deepEqual(records.map((item) => item.id), ["old", "new-first", "same-day-a", "same-day-b"]);
});
