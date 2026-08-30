import assert from "node:assert/strict";
import test from "node:test";

import { investmentAccountEffect } from "../lib/finance.mjs";

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
