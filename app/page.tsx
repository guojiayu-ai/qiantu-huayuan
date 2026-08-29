"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type FlowType = "收入" | "支出";
type InvestType = "买入" | "卖出" | "分红" | "费用";
type Account = { name: string; tail: string; balance: number; tone: string };
type Flow = { id: number; date: string; type: FlowType; category: string; account: string; amount: number; note: string };
type Investment = { id: number; date: string; type: InvestType; product: string; amount: number; note: string };

const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const initialAccounts: Account[] = [
  { name: "工商银行", tail: "7956", balance: 0, tone: "coral" },
  { name: "招商银行", tail: "8259", balance: 0, tone: "violet" },
  { name: "中国银行", tail: "4827", balance: 0, tone: "mint" },
];
const categorySuggestions = ["实习工资", "奖金/补贴", "红包/转账", "兼职", "报销", "住宿", "餐饮", "交通", "学习/考试", "社交", "娱乐", "服饰", "医疗", "其他"];

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) try { setValue(JSON.parse(stored)); } catch { /* keep initial value */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => { if (loaded) localStorage.setItem(key, JSON.stringify(value)); }, [key, loaded, value]);
  return [value, setValue] as const;
}

function signedMoney(value: number) {
  if (value === 0) return currency.format(0);
  return `${value > 0 ? "+" : "−"}${currency.format(Math.abs(value))}`;
}

export default function Home() {
  const [accounts, setAccounts] = useLocalState<Account[]>("money-garden-accounts", initialAccounts);
  const [flows, setFlows] = useLocalState<Flow[]>("money-ledger-daily-v2", []);
  const [investments, setInvestments] = useLocalState<Investment[]>("money-ledger-invest-v2", []);
  const [investmentValue, setInvestmentValue] = useLocalState("money-ledger-invest-value-v2", 0);
  const [month, setMonth] = useState(currentMonth);
  const [flowType, setFlowType] = useState<FlowType>("支出");
  const [flowDate, setFlowDate] = useState(today);
  const [category, setCategory] = useState("餐饮");
  const [flowAccount, setFlowAccount] = useState("工商银行 · 7956");
  const [flowAmount, setFlowAmount] = useState("");
  const [flowNote, setFlowNote] = useState("");
  const [investType, setInvestType] = useState<InvestType>("买入");
  const [investDate, setInvestDate] = useState(today);
  const [product, setProduct] = useState("");
  const [investAmount, setInvestAmount] = useState("");
  const [investNote, setInvestNote] = useState("");

  const monthFlows = useMemo(() => flows.filter((item) => item.date.startsWith(month)), [flows, month]);
  const monthInvestments = useMemo(() => investments.filter((item) => item.date.startsWith(month)), [investments, month]);
  const income = monthFlows.filter((item) => item.type === "收入").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthFlows.filter((item) => item.type === "支出").reduce((sum, item) => sum + item.amount, 0);
  const dailyNet = income - expense;
  const investmentCashflow = monthInvestments.reduce((sum, item) => sum + (item.type === "卖出" || item.type === "分红" ? item.amount : -item.amount), 0);
  const totalCashChange = dailyNet + investmentCashflow;
  const bankTotal = accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const totalAssets = bankTotal + Number(investmentValue || 0);

  function addFlow(event: FormEvent) {
    event.preventDefault(); const amount = Number(flowAmount); if (!amount || amount <= 0 || !category.trim()) return;
    setFlows([{ id: Date.now(), date: flowDate, type: flowType, category: category.trim(), account: flowAccount, amount, note: flowNote.trim() }, ...flows]);
    setFlowAmount(""); setFlowNote("");
  }
  function addInvestment(event: FormEvent) {
    event.preventDefault(); const amount = Number(investAmount); if (!amount || amount <= 0 || !product.trim()) return;
    setInvestments([{ id: Date.now(), date: investDate, type: investType, product: product.trim(), amount, note: investNote.trim() }, ...investments]);
    setInvestAmount(""); setInvestNote("");
  }
  function exportCsv() {
    const rows = [
      ["日期", "模块", "类型", "分类/产品", "账户", "金额", "备注"],
      ...flows.map((item) => [item.date, "日常收支", item.type, item.category, item.account, String(item.amount), item.note]),
      ...investments.map((item) => [item.date, "投资", item.type, item.product, "", String(item.amount), item.note]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); link.download = `资产记录-${month}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <main className="app-shell">
    <header className="simple-nav"><div><strong>钱途花园</strong><span>个人资产记录</span></div><button onClick={exportCsv}>导出 CSV</button></header>

    <section className="overview">
      <div className="overview-head"><div><p>YOUR MONEY, YOUR PACE</p><h1>资产与收支</h1></div><label>查看月份<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
      <div className="summary-grid">
        <article className="summary primary"><span>当前总资产</span><strong>{currency.format(totalAssets)}</strong><small>银行卡 {currency.format(bankTotal)} + 理财市值 {currency.format(investmentValue)}</small></article>
        <article className="summary"><span>本月收入</span><strong className="positive">{currency.format(income)}</strong></article>
        <article className="summary"><span>本月支出</span><strong className="negative">{currency.format(expense)}</strong></article>
        <article className="summary"><span>日常净结余</span><strong className={dailyNet >= 0 ? "positive" : "negative"}>{signedMoney(dailyNet)}</strong></article>
        <article className="summary"><span>投资现金流</span><strong className={investmentCashflow >= 0 ? "positive" : "negative"}>{signedMoney(investmentCashflow)}</strong><small>卖出/分红 − 买入/费用</small></article>
        <article className="summary"><span>综合现金变化</span><strong className={totalCashChange >= 0 ? "positive" : "negative"}>{signedMoney(totalCashChange)}</strong><small>日常净结余 + 投资现金流</small></article>
      </div>
    </section>

    <section className="block">
      <div className="block-title"><div><span>01</span><h2>账户余额</h2></div><p>直接填写当前余额</p></div>
      <div className="account-grid">{accounts.map((item, index) => <label className={`account ${item.tone}`} key={item.tail}><div><strong>{item.name}</strong><span>尾号 {item.tail}</span></div><div className="balance-input"><span>¥</span><input aria-label={`${item.name}余额`} type="number" step="0.01" value={item.balance || ""} placeholder="0.00" onChange={(event) => setAccounts(accounts.map((account, i) => i === index ? { ...account, balance: Number(event.target.value) } : account))} /></div></label>)}</div>
      <label className="market-value"><span>理财当前市值</span><div><span>¥</span><input type="number" step="0.01" value={investmentValue || ""} placeholder="0.00" onChange={(event) => setInvestmentValue(Number(event.target.value))} /></div></label>
    </section>

    <section className="block">
      <div className="block-title"><div><span>02</span><h2>记录日常收支</h2></div><p>分类可直接输入自定义内容</p></div>
      <form className="sheet-form" onSubmit={addFlow}>
        <label>日期<input type="date" value={flowDate} onChange={(event) => setFlowDate(event.target.value)} required /></label>
        <label>类型<select value={flowType} onChange={(event) => setFlowType(event.target.value as FlowType)}><option>收入</option><option>支出</option></select></label>
        <label>分类<input list="category-list" value={category} onChange={(event) => setCategory(event.target.value)} required /><datalist id="category-list">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist></label>
        <label>账户<select value={flowAccount} onChange={(event) => setFlowAccount(event.target.value)}>{accounts.map((item) => <option key={item.tail}>{item.name} · {item.tail}</option>)}</select></label>
        <label>金额<input type="number" min="0.01" step="0.01" value={flowAmount} onChange={(event) => setFlowAmount(event.target.value)} placeholder="0.00" required /></label>
        <label>备注<input value={flowNote} onChange={(event) => setFlowNote(event.target.value)} placeholder="可不填" /></label>
        <button type="submit">添加</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>日期</th><th>类型</th><th>分类</th><th>账户</th><th>备注</th><th className="number">金额</th><th /></tr></thead><tbody>{monthFlows.length ? monthFlows.map((item) => <tr key={item.id}><td>{item.date}</td><td><span className={`type ${item.type}`}>{item.type}</span></td><td>{item.category}</td><td>{item.account}</td><td className="note-cell">{item.note || "—"}</td><td className={`number ${item.type === "收入" ? "positive" : "negative"}`}>{item.type === "收入" ? "+" : "−"}{currency.format(item.amount)}</td><td><button className="delete" onClick={() => setFlows(flows.filter((entry) => entry.id !== item.id))}>删除</button></td></tr>) : <tr><td className="no-data" colSpan={7}>本月暂无收支记录</td></tr>}</tbody><tfoot><tr><td colSpan={5}>本月合计</td><td className={`number ${dailyNet >= 0 ? "positive" : "negative"}`}>{signedMoney(dailyNet)}</td><td /></tr></tfoot></table></div>
    </section>

    <section className="block">
      <div className="block-title"><div><span>03</span><h2>记录投资</h2></div><p>买入和费用为现金流出，卖出和分红为现金流入</p></div>
      <form className="sheet-form invest-form" onSubmit={addInvestment}>
        <label>日期<input type="date" value={investDate} onChange={(event) => setInvestDate(event.target.value)} required /></label>
        <label>操作<select value={investType} onChange={(event) => setInvestType(event.target.value as InvestType)}><option>买入</option><option>卖出</option><option>分红</option><option>费用</option></select></label>
        <label className="wide">产品/基金<input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="例如：沪深300指数基金" required /></label>
        <label>金额<input type="number" min="0.01" step="0.01" value={investAmount} onChange={(event) => setInvestAmount(event.target.value)} placeholder="0.00" required /></label>
        <label>备注<input value={investNote} onChange={(event) => setInvestNote(event.target.value)} placeholder="可不填" /></label>
        <button type="submit">添加</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>日期</th><th>操作</th><th>产品/基金</th><th>备注</th><th className="number">金额</th><th /></tr></thead><tbody>{monthInvestments.length ? monthInvestments.map((item) => { const incoming = item.type === "卖出" || item.type === "分红"; return <tr key={item.id}><td>{item.date}</td><td><span className={`type invest-${item.type}`}>{item.type}</span></td><td>{item.product}</td><td className="note-cell">{item.note || "—"}</td><td className={`number ${incoming ? "positive" : "negative"}`}>{incoming ? "+" : "−"}{currency.format(item.amount)}</td><td><button className="delete" onClick={() => setInvestments(investments.filter((entry) => entry.id !== item.id))}>删除</button></td></tr>}) : <tr><td className="no-data" colSpan={6}>本月暂无投资记录</td></tr>}</tbody><tfoot><tr><td colSpan={4}>本月投资现金流</td><td className={`number ${investmentCashflow >= 0 ? "positive" : "negative"}`}>{signedMoney(investmentCashflow)}</td><td /></tr></tfoot></table></div>
    </section>

    <footer>数据仅保存在当前浏览器 · 金额统一按人民币计算</footer>
  </main>;
}
