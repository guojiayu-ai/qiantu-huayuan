export function investmentAccountEffect(item) {
  if (item.type === "买入") return -Number(item.amount) - Number(item.fee || 0);
  if (item.type === "卖出") return Number(item.amount) - Number(item.fee || 0);
  if (item.type === "分红") return Number(item.amount);
  return -Number(item.amount);
}

export function supportsAmountOnlyTrades(fund) {
  return fund?.role === "现金备用层" || fund?.valuationMethod?.includes("万份收益") === true;
}

export function amountOnlyInvestmentValueEffect(item, fund) {
  if (!item || !supportsAmountOnlyTrades(fund)) return 0;
  if (item.type === "买入") return Number(item.amount);
  if (item.type === "卖出") return -Number(item.amount);
  return 0;
}

export function newestFirst(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || a.index - b.index)
    .map(({ item }) => item);
}
