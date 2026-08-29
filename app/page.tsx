"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type FlowType = "收入" | "支出";
type InvestType = "买入" | "卖出" | "分红" | "费用";
type Tab = "收入" | "支出" | "定投" | "资产" | "设置";
type Account = { id?: string; name: string; tail: string; balance: number; tone: string; active?: boolean };
type Category = { id: string; name: string; type: FlowType; active: boolean };
type Flow = { id: string | number; date: string; type: FlowType; category: string; accountId?: string; account?: string; amount: number; note: string };
type Investment = { id: string | number; date: string; type: InvestType; fundId: string; fundName: string; fundCode: string; amount: number; units: number; price: number; fee: number; valuation: string; rule: string; accountId: string; note: string };
type FundPlan = { id: string; name: string; code: string; role: string; valuationMethod: string; baseAmount: number; targetAllocation: number; currentPrice: number; active: boolean };
type InvestPlan = { goal: string; targetAmount: number; emergencyMonths: number; monthlyBudget: number; executionDay: number; frequency: string; stockTarget: number; maxDrawdown: number; buyRule: string; pauseRule: string; exitRule: string; reviewFrequency: string };

const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const tones = ["coral", "violet", "mint", "yellow", "blue"];
const initialAccounts: Account[] = [
  { id: "icbc-7956", name: "工商银行", tail: "7956", balance: 0, tone: "coral", active: true },
  { id: "cmb-8259", name: "招商银行", tail: "8259", balance: 0, tone: "violet", active: true },
  { id: "boc-4827", name: "中国银行", tail: "4827", balance: 0, tone: "mint", active: true },
];
const initialCategories: Category[] = [
  ...["实习工资", "奖金/补贴", "红包/转账", "兼职", "报销", "其他收入"].map((name, index) => ({ id: `income-${index}`, name, type: "收入" as const, active: true })),
  ...["住宿", "餐饮", "交通", "学习/考试", "社交", "娱乐", "服饰", "医疗", "其他支出"].map((name, index) => ({ id: `expense-${index}`, name, type: "支出" as const, active: true })),
];
const initialPlan: InvestPlan = { goal: "长期个人财富积累", targetAmount: 0, emergencyMonths: 6, monthlyBudget: 500, executionDay: 10, frequency: "每月", stockTarget: 60, maxDrawdown: 30, buyRule: "仅按计划买入已确认估值方法、且处于可买区间的指数基金", pauseRule: "应急金不足、当月无结余或标的估值不合适时暂停", exitRule: "达到目标日期或估值退出条件时分批降低风险", reviewFrequency: "每季度" };

function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function accountId(account: Account) { return account.id || `${account.name}-${account.tail}`; }
function accountLabel(account: Account) { return `${account.name}${account.tail ? ` · ${account.tail}` : ""}`; }

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const stored = localStorage.getItem(key); if (stored) try { setValue(JSON.parse(stored)); } catch { /* keep defaults */ } setLoaded(true); }, [key]);
  useEffect(() => { if (loaded) localStorage.setItem(key, JSON.stringify(value)); }, [key, loaded, value]);
  return [value, setValue] as const;
}

function signedMoney(value: number) { return value === 0 ? currency.format(0) : `${value > 0 ? "+" : "−"}${currency.format(Math.abs(value))}`; }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function Home() {
  const [accounts, setAccounts] = useLocalState<Account[]>("money-garden-accounts", initialAccounts);
  const [categories, setCategories] = useLocalState<Category[]>("money-garden-categories-v1", initialCategories);
  const [flows, setFlows] = useLocalState<Flow[]>("money-ledger-daily-v2", []);
  const [investments, setInvestments] = useLocalState<Investment[]>("money-ledger-invest-v3", []);
  const [legacyInvestments] = useLocalState<any[]>("money-ledger-invest-v2", []);
  const [funds, setFunds] = useLocalState<FundPlan[]>("money-garden-funds-v1", []);
  const [plan, setPlan] = useLocalState<InvestPlan>("money-garden-plan-v1", initialPlan);
  const [otherInvestmentValue, setOtherInvestmentValue] = useLocalState("money-ledger-invest-value-v2", 0);
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<Tab>("支出");
  const [flowDate, setFlowDate] = useState(today);
  const [category, setCategory] = useState("餐饮");
  const [flowAccount, setFlowAccount] = useState("icbc-7956");
  const [flowAmount, setFlowAmount] = useState("");
  const [flowNote, setFlowNote] = useState("");
  const [investDate, setInvestDate] = useState(today);
  const [investType, setInvestType] = useState<InvestType>("买入");
  const [investFund, setInvestFund] = useState("");
  const [investAmount, setInvestAmount] = useState("");
  const [investUnits, setInvestUnits] = useState("");
  const [investPrice, setInvestPrice] = useState("");
  const [investFee, setInvestFee] = useState("");
  const [investValuation, setInvestValuation] = useState("");
  const [investRule, setInvestRule] = useState("");
  const [investNote, setInvestNote] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountTail, setNewAccountTail] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<FlowType>("支出");
  const [newFund, setNewFund] = useState({ name: "", code: "", role: "核心宽基", valuationMethod: "盈利收益率法", baseAmount: "500", targetAllocation: "100" });
  const fileRef = useRef<HTMLInputElement>(null);

  const normalizedAccounts = useMemo(() => accounts.map((item) => ({ ...item, id: accountId(item), active: item.active !== false })), [accounts]);
  const activeAccounts = normalizedAccounts.filter((item) => item.active);
  const activeFunds = funds.filter((item) => item.active);
  const monthFlows = useMemo(() => flows.filter((item) => item.date.startsWith(month)), [flows, month]);
  const monthInvestments = useMemo(() => investments.filter((item) => item.date.startsWith(month)), [investments, month]);
  const income = monthFlows.filter((item) => item.type === "收入").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = monthFlows.filter((item) => item.type === "支出").reduce((sum, item) => sum + Number(item.amount), 0);
  const investmentCashflow = monthInvestments.reduce((sum, item) => {
    if (item.type === "卖出") return sum + item.amount - item.fee;
    if (item.type === "分红") return sum + item.amount;
    if (item.type === "买入") return sum - item.amount - item.fee;
    return sum - item.amount;
  }, 0);
  const holdings = useMemo(() => funds.map((fund) => {
    const fundTrades = investments.filter((item) => item.fundId === fund.id);
    const units = fundTrades.reduce((sum, item) => sum + (item.type === "买入" ? item.units : item.type === "卖出" ? -item.units : 0), 0);
    const invested = fundTrades.reduce((sum, item) => sum + (item.type === "买入" ? item.amount + item.fee : item.type === "卖出" ? -item.amount + item.fee : item.type === "费用" ? item.amount : 0), 0);
    return { ...fund, units, invested, marketValue: units * Number(fund.currentPrice || 0) };
  }), [funds, investments]);
  const bankTotal = normalizedAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const fundMarketValue = holdings.reduce((sum, item) => sum + item.marketValue, 0);
  const totalAssets = bankTotal + fundMarketValue + Number(otherInvestmentValue || 0);
  const dailyNet = income - expense;
  const totalCashChange = dailyNet + investmentCashflow;

  useEffect(() => {
    if (!activeAccounts.some((item) => item.id === flowAccount) && activeAccounts[0]) setFlowAccount(activeAccounts[0].id!);
  }, [activeAccounts, flowAccount]);
  useEffect(() => {
    if (!activeFunds.some((item) => item.id === investFund) && activeFunds[0]) setInvestFund(activeFunds[0].id);
  }, [activeFunds, investFund]);
  useEffect(() => {
    if (!legacyInvestments.length || investments.length || localStorage.getItem("money-ledger-invest-v3-migrated")) return;
    const productNames = [...new Set(legacyInvestments.map((item) => String(item.product || "未命名基金")))];
    const migratedFunds: FundPlan[] = productNames.map((name, index) => ({ id: `legacy-fund-${index}`, name, code: "", role: "核心宽基", valuationMethod: "待补充", baseAmount: 0, targetAllocation: 0, currentPrice: 0, active: true }));
    if (!funds.length) setFunds(migratedFunds);
    setInvestments(legacyInvestments.map((item, index) => {
      const fund = migratedFunds.find((entry) => entry.name === String(item.product || "未命名基金"))!;
      return { id: item.id || `legacy-invest-${index}`, date: item.date || today, type: item.type || "买入", fundId: fund.id, fundName: fund.name, fundCode: "", amount: Number(item.amount || 0), units: 0, price: 0, fee: 0, valuation: "", rule: "旧版记录迁移", accountId: "", note: item.note || "" };
    }));
    localStorage.setItem("money-ledger-invest-v3-migrated", "1");
  }, [legacyInvestments, investments, funds, setFunds, setInvestments]);
  useEffect(() => {
    if (tab !== "收入" && tab !== "支出") return;
    const first = categories.find((item) => item.type === tab && item.active);
    if (first && !categories.some((item) => item.type === tab && item.active && item.name === category)) setCategory(first.name);
  }, [tab, categories, category]);

  function addFlow(event: FormEvent, type: FlowType) {
    event.preventDefault(); const amount = Number(flowAmount); if (!amount || amount <= 0 || !category || !flowAccount) return;
    setFlows([{ id: uid("flow"), date: flowDate, type, category, accountId: flowAccount, amount, note: flowNote.trim() }, ...flows]);
    setFlowAmount(""); setFlowNote("");
  }
  function addInvestment(event: FormEvent) {
    event.preventDefault(); const amount = Number(investAmount); const fund = funds.find((item) => item.id === investFund); if (!fund || !amount || amount <= 0) return;
    setInvestments([{ id: uid("invest"), date: investDate, type: investType, fundId: fund.id, fundName: fund.name, fundCode: fund.code, amount, units: Number(investUnits || 0), price: Number(investPrice || 0), fee: Number(investFee || 0), valuation: investValuation.trim(), rule: investRule.trim(), accountId: flowAccount, note: investNote.trim() }, ...investments]);
    setInvestAmount(""); setInvestUnits(""); setInvestPrice(""); setInvestFee(""); setInvestNote("");
  }
  function addAccount(event: FormEvent) {
    event.preventDefault(); if (!newAccountName.trim()) return;
    setAccounts([...normalizedAccounts, { id: uid("account"), name: newAccountName.trim(), tail: newAccountTail.trim(), balance: 0, tone: tones[accounts.length % tones.length], active: true }]);
    setNewAccountName(""); setNewAccountTail("");
  }
  function addCategory(event: FormEvent) {
    event.preventDefault(); if (!newCategoryName.trim() || categories.some((item) => item.type === newCategoryType && item.name === newCategoryName.trim())) return;
    setCategories([...categories, { id: uid("category"), name: newCategoryName.trim(), type: newCategoryType, active: true }]); setNewCategoryName("");
  }
  function addFund(event: FormEvent) {
    event.preventDefault(); if (!newFund.name.trim()) return;
    setFunds([...funds, { id: uid("fund"), name: newFund.name.trim(), code: newFund.code.trim(), role: newFund.role, valuationMethod: newFund.valuationMethod, baseAmount: Number(newFund.baseAmount || 0), targetAllocation: Number(newFund.targetAllocation || 0), currentPrice: 0, active: true }]);
    setNewFund({ ...newFund, name: "", code: "" });
  }
  function patchPlan<K extends keyof InvestPlan>(key: K, value: InvestPlan[K]) { setPlan({ ...plan, [key]: value }); }
  function resolveAccount(item: Flow | Investment) { return normalizedAccounts.find((account) => account.id === item.accountId)?.name || ("account" in item ? item.account : "") || "—"; }

  function exportFullCsv() {
    const headers = ["数据类型", "日期", "收支/操作", "分类", "账户", "金额", "基金名称", "基金代码", "份额", "成交价", "费用", "估值", "触发规则", "备注", "名称", "尾号", "当前余额", "启用", "组合功能", "估值方法", "基准金额", "目标占比", "当前净值", "计划字段", "计划值"];
    const rows: Record<string, unknown>[] = [];
    normalizedAccounts.forEach((a) => rows.push({ 数据类型: "账户", 名称: a.name, 尾号: a.tail, 当前余额: a.balance, 启用: a.active }));
    categories.forEach((c) => rows.push({ 数据类型: "分类", "收支/操作": c.type, 分类: c.name, 启用: c.active }));
    flows.forEach((f) => rows.push({ 数据类型: "收支记录", 日期: f.date, "收支/操作": f.type, 分类: f.category, 账户: resolveAccount(f), 金额: f.amount, 备注: f.note }));
    investments.forEach((i) => rows.push({ 数据类型: "投资记录", 日期: i.date, "收支/操作": i.type, 账户: resolveAccount(i), 金额: i.amount, 基金名称: i.fundName, 基金代码: i.fundCode, 份额: i.units, 成交价: i.price, 费用: i.fee, 估值: i.valuation, 触发规则: i.rule, 备注: i.note }));
    funds.forEach((f) => rows.push({ 数据类型: "定投标的", 基金名称: f.name, 基金代码: f.code, 启用: f.active, 组合功能: f.role, 估值方法: f.valuationMethod, 基准金额: f.baseAmount, 目标占比: f.targetAllocation, 当前净值: f.currentPrice }));
    Object.entries(plan).forEach(([key, value]) => rows.push({ 数据类型: "定投计划", 计划字段: key, 计划值: value }));
    rows.push({ 数据类型: "其他理财市值", 当前余额: otherInvestmentValue });
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))].map((row) => row.map(csvCell).join(",")).join("\n");
    download(`钱途花园-完整数据-${today}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
  }
  function exportJson() { download(`钱途花园-备份-${today}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), accounts: normalizedAccounts, categories, flows, investments, legacyInvestments, funds, plan, otherInvestmentValue }, null, 2), "application/json"); }
  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data.accounts) || !Array.isArray(data.flows)) throw new Error(); setAccounts(data.accounts); setCategories(data.categories || initialCategories); setFlows(data.flows); setInvestments(data.investments || []); setFunds(data.funds || []); setPlan({ ...initialPlan, ...(data.plan || {}) }); setOtherInvestmentValue(Number(data.otherInvestmentValue || 0)); alert("备份已恢复"); } catch { alert("无法读取这个备份文件"); } }; reader.readAsText(file); event.target.value = "";
  }

  function FlowPanel({ type }: { type: FlowType }) {
    const rows = monthFlows.filter((item) => item.type === type); const total = rows.reduce((sum, item) => sum + item.amount, 0);
    const availableCategories = categories.filter((item) => item.type === type && item.active);
    return <div className="tab-panel"><div className="panel-head"><div><span>{type === "收入" ? "01" : "02"}</span><h2>记录{type}</h2></div><p>{type === "收入" ? "工资、红包和其他进账分开记" : "选择分类和付款账户，几秒记一笔"}</p></div>
      <form className="sheet-form flow-form" onSubmit={(event) => addFlow(event, type)}><label>日期<input type="date" value={flowDate} onChange={(event) => setFlowDate(event.target.value)} required /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value)}>{availableCategories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label>账户<select value={flowAccount} onChange={(event) => setFlowAccount(event.target.value)}>{activeAccounts.map((item) => <option value={item.id} key={item.id}>{accountLabel(item)}</option>)}</select></label><label>金额<input type="number" min="0.01" step="0.01" value={flowAmount} onChange={(event) => setFlowAmount(event.target.value)} placeholder="0.00" required /></label><label>备注<input value={flowNote} onChange={(event) => setFlowNote(event.target.value)} placeholder="可不填" /></label><button type="submit" disabled={!activeAccounts.length || !availableCategories.length}>添加{type}</button></form>
      <div className="table-wrap"><table><thead><tr><th>日期</th><th>分类</th><th>账户</th><th>备注</th><th className="number">金额</th><th /></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.id}><td>{item.date}</td><td><span className={`type ${type}`}>{item.category}</span></td><td>{resolveAccount(item)}</td><td className="note-cell">{item.note || "—"}</td><td className={`number ${type === "收入" ? "positive" : "negative"}`}>{type === "收入" ? "+" : "−"}{currency.format(item.amount)}</td><td><button className="delete" onClick={() => setFlows(flows.filter((entry) => entry.id !== item.id))}>删除</button></td></tr>) : <tr><td className="no-data" colSpan={6}>本月暂无{type}记录</td></tr>}</tbody><tfoot><tr><td colSpan={4}>本月{type}</td><td className={`number ${type === "收入" ? "positive" : "negative"}`}>{currency.format(total)}</td><td /></tr></tfoot></table></div></div>;
  }

  return <main className="app-shell">
    <header className="simple-nav"><div><strong>钱途花园</strong><span>个人资产记录</span></div><div className="nav-right"><label>月份<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button onClick={exportFullCsv}>导出完整 CSV</button></div></header>
    <div className="dashboard">
      <aside className="side-summary"><p className="kicker">ASSET OVERVIEW</p><h1>资产<br />与收支</h1><article className="total-card"><span>当前总资产</span><strong>{currency.format(totalAssets)}</strong><small>银行卡 {currency.format(bankTotal)} · 基金 {currency.format(fundMarketValue)}<br />其他理财 {currency.format(otherInvestmentValue)}</small></article><div className="side-metrics"><div><span>本月收入</span><strong className="positive">{currency.format(income)}</strong></div><div><span>本月支出</span><strong className="negative">{currency.format(expense)}</strong></div><div><span>日常净结余</span><strong className={dailyNet >= 0 ? "positive" : "negative"}>{signedMoney(dailyNet)}</strong></div><div><span>投资现金流</span><strong className={investmentCashflow >= 0 ? "positive" : "negative"}>{signedMoney(investmentCashflow)}</strong></div></div><div className="cash-change"><span>综合现金变化</span><strong className={totalCashChange >= 0 ? "positive" : "negative"}>{signedMoney(totalCashChange)}</strong></div></aside>
      <section className="workspace"><nav className="tabs">{(["收入", "支出", "定投", "资产", "设置"] as const).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
        {tab === "收入" && <FlowPanel type="收入" />}{tab === "支出" && <FlowPanel type="支出" />}
        {tab === "定投" && <div className="tab-panel invest-panel"><div className="panel-head"><div><span>03</span><h2>定投计划与执行</h2></div><p>目标 → 规则 → 标的 → 每笔执行</p></div><div className="invest-layout"><section className="plan-card"><h3>我的计划</h3><div className="compact-grid"><label>投资目标<input value={plan.goal} onChange={(e) => patchPlan("goal", e.target.value)} /></label><label>目标金额<input type="number" value={plan.targetAmount || ""} onChange={(e) => patchPlan("targetAmount", Number(e.target.value))} /></label><label>应急金（月）<input type="number" value={plan.emergencyMonths} onChange={(e) => patchPlan("emergencyMonths", Number(e.target.value))} /></label><label>每月预算<input type="number" value={plan.monthlyBudget} onChange={(e) => patchPlan("monthlyBudget", Number(e.target.value))} /></label><label>执行频率<select value={plan.frequency} onChange={(e) => patchPlan("frequency", e.target.value)}><option>每周</option><option>双周</option><option>每月</option></select></label><label>固定执行日<input type="number" min="1" max="28" value={plan.executionDay} onChange={(e) => patchPlan("executionDay", Number(e.target.value))} /></label><label>股票目标占比 %<input type="number" value={plan.stockTarget} onChange={(e) => patchPlan("stockTarget", Number(e.target.value))} /></label><label>可承受回撤 %<input type="number" value={plan.maxDrawdown} onChange={(e) => patchPlan("maxDrawdown", Number(e.target.value))} /></label></div><details><summary>买入、暂停、退出与复盘规则</summary><label>买入规则<textarea value={plan.buyRule} onChange={(e) => patchPlan("buyRule", e.target.value)} /></label><label>暂停规则<textarea value={plan.pauseRule} onChange={(e) => patchPlan("pauseRule", e.target.value)} /></label><label>退出规则<textarea value={plan.exitRule} onChange={(e) => patchPlan("exitRule", e.target.value)} /></label><label>复盘频率<input value={plan.reviewFrequency} onChange={(e) => patchPlan("reviewFrequency", e.target.value)} /></label></details></section><section className="fund-card"><h3>定投标的</h3><form className="fund-form" onSubmit={addFund}><input placeholder="基金名称" value={newFund.name} onChange={(e) => setNewFund({ ...newFund, name: e.target.value })} required /><input placeholder="代码" value={newFund.code} onChange={(e) => setNewFund({ ...newFund, code: e.target.value })} /><select value={newFund.role} onChange={(e) => setNewFund({ ...newFund, role: e.target.value })}><option>核心宽基</option><option>价值或红利</option><option>行业补充</option><option>低风险替代</option></select><select value={newFund.valuationMethod} onChange={(e) => setNewFund({ ...newFund, valuationMethod: e.target.value })}><option>盈利收益率法</option><option>博格公式PE法</option><option>博格公式PB法</option><option>不适用</option></select><input type="number" placeholder="每期金额" value={newFund.baseAmount} onChange={(e) => setNewFund({ ...newFund, baseAmount: e.target.value })} /><input type="number" placeholder="目标占比%" value={newFund.targetAllocation} onChange={(e) => setNewFund({ ...newFund, targetAllocation: e.target.value })} /><button>新增标的</button></form><div className="fund-list">{funds.length ? funds.map((fund) => <article key={fund.id} className={!fund.active ? "muted-row" : ""}><div><strong>{fund.name}</strong><span>{fund.code || "无代码"} · {fund.role} · {fund.valuationMethod}</span></div><label>当前净值<input type="number" step="0.0001" value={fund.currentPrice || ""} onChange={(e) => setFunds(funds.map((item) => item.id === fund.id ? { ...item, currentPrice: Number(e.target.value) } : item))} /></label><button className="soft-button" onClick={() => setFunds(funds.map((item) => item.id === fund.id ? { ...item, active: !item.active } : item))}>{fund.active ? "停用" : "启用"}</button></article>) : <div className="empty-card">先添加一只计划中的基金，再记录执行</div>}</div></section></div>
          <form className="sheet-form trade-form" onSubmit={addInvestment}><label>日期<input type="date" value={investDate} onChange={(e) => setInvestDate(e.target.value)} /></label><label>操作<select value={investType} onChange={(e) => setInvestType(e.target.value as InvestType)}><option>买入</option><option>卖出</option><option>分红</option><option>费用</option></select></label><label>基金<select value={investFund} onChange={(e) => setInvestFund(e.target.value)}>{activeFunds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label><label>金额<input type="number" step="0.01" min="0.01" value={investAmount} onChange={(e) => setInvestAmount(e.target.value)} required /></label><label>份额<input type="number" step="0.0001" min="0" value={investUnits} onChange={(e) => setInvestUnits(e.target.value)} /></label><label>成交价<input type="number" step="0.0001" min="0" value={investPrice} onChange={(e) => setInvestPrice(e.target.value)} /></label><label>费用<input type="number" step="0.01" min="0" value={investFee} onChange={(e) => setInvestFee(e.target.value)} /></label><label>指数估值<input value={investValuation} onChange={(e) => setInvestValuation(e.target.value)} placeholder="如 PE 12.3" /></label><label>触发规则<input value={investRule} onChange={(e) => setInvestRule(e.target.value)} placeholder="如 月度基准" /></label><label>备注<input value={investNote} onChange={(e) => setInvestNote(e.target.value)} /></label><button disabled={!activeFunds.length}>记录执行</button></form><div className="table-wrap trade-table"><table><thead><tr><th>日期</th><th>操作</th><th>基金</th><th>估值 / 规则</th><th className="number">份额</th><th className="number">金额</th><th /></tr></thead><tbody>{monthInvestments.length ? monthInvestments.map((item) => <tr key={item.id}><td>{item.date}</td><td><span className={`type invest-${item.type}`}>{item.type}</span></td><td>{item.fundName}<small>{item.fundCode}</small></td><td>{item.valuation || "—"}<small>{item.rule || "未填写触发规则"}</small></td><td className="number">{item.units || "—"}</td><td className="number">{currency.format(item.amount)}</td><td><button className="delete" onClick={() => setInvestments(investments.filter((entry) => entry.id !== item.id))}>删除</button></td></tr>) : <tr><td className="no-data" colSpan={7}>本月暂无定投执行记录</td></tr>}</tbody></table></div></div>}
        {tab === "资产" && <div className="tab-panel asset-panel"><div className="panel-head"><div><span>04</span><h2>当前资产</h2></div><p>余额和基金净值变动后在这里更新</p></div><div className="account-grid">{normalizedAccounts.map((item) => <label className={`account ${item.tone} ${!item.active ? "muted-row" : ""}`} key={item.id}><div><strong>{item.name}</strong><span>{item.tail ? `尾号 ${item.tail}` : "现金账户"}</span></div><div className="balance-input"><span>¥</span><input type="number" step="0.01" value={item.balance || ""} placeholder="0.00" onChange={(e) => setAccounts(normalizedAccounts.map((account) => account.id === item.id ? { ...account, balance: Number(e.target.value) } : account))} /></div></label>)}</div><div className="holding-grid">{holdings.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.units.toFixed(4)} 份 × {item.currentPrice || 0}</span></div><strong>{currency.format(item.marketValue)}</strong><small>累计净投入 {currency.format(item.invested)}</small></article>)}</div><label className="market-value"><span>其他理财当前市值</span><div><span>¥</span><input type="number" step="0.01" value={otherInvestmentValue || ""} placeholder="0.00" onChange={(e) => setOtherInvestmentValue(Number(e.target.value))} /></div></label><div className="asset-total"><span>当前总资产</span><strong>{currency.format(totalAssets)}</strong></div></div>}
        {tab === "设置" && <div className="tab-panel settings-panel"><div className="panel-head"><div><span>05</span><h2>账户、分类与迁移</h2></div><p>停用不会删除历史记录</p></div><div className="settings-grid"><section><h3>账户</h3><form className="mini-form" onSubmit={addAccount}><input placeholder="账户名称" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} required /><input placeholder="尾号（可不填）" value={newAccountTail} onChange={(e) => setNewAccountTail(e.target.value)} maxLength={8} /><button>新增</button></form><div className="chip-list">{normalizedAccounts.map((item) => <button className={item.active ? "chip active-chip" : "chip"} key={item.id} onClick={() => setAccounts(normalizedAccounts.map((account) => account.id === item.id ? { ...account, active: !account.active } : account))}>{accountLabel(item)} · {item.active ? "使用中" : "已停用"}</button>)}</div></section><section><h3>收支分类</h3><form className="mini-form" onSubmit={addCategory}><select value={newCategoryType} onChange={(e) => setNewCategoryType(e.target.value as FlowType)}><option>收入</option><option>支出</option></select><input placeholder="分类名称" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required /><button>新增</button></form><div className="category-columns">{(["收入", "支出"] as const).map((type) => <div key={type}><strong>{type}</strong><div className="chip-list">{categories.filter((item) => item.type === type).map((item) => <button className={item.active ? `chip ${type === "收入" ? "income-chip" : "expense-chip"}` : "chip"} key={item.id} onClick={() => setCategories(categories.map((categoryItem) => categoryItem.id === item.id ? { ...categoryItem, active: !categoryItem.active } : categoryItem))}>{item.name}</button>)}</div></div>)}</div></section><section className="backup-card"><h3>完整备份</h3><p>CSV 包含账户、分类、全部收支、定投计划、标的和交易；JSON 可在本网站一键恢复。</p><div><button onClick={exportFullCsv}>导出完整 CSV</button><button className="soft-button" onClick={exportJson}>备份 JSON</button><button className="soft-button" onClick={() => fileRef.current?.click()}>恢复 JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} /></div></section></div></div>}
      </section>
    </div>
  </main>;
}
