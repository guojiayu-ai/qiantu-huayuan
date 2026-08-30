export function investmentAccountEffect(item) {
  if (item.type === "买入") return -Number(item.amount) - Number(item.fee || 0);
  if (item.type === "卖出") return Number(item.amount) - Number(item.fee || 0);
  if (item.type === "分红") return Number(item.amount);
  return -Number(item.amount);
}
