"use client";
/* eslint-disable jsx-a11y/no-autofocus */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { investmentAccountEffect } from "@/lib/finance.mjs";

type FlowType = "收入" | "支出";
type InvestType = "买入" | "卖出" | "分红" | "费用";
type Tab = "收入" | "支出" | "定投" | "资产" | "设置";
type Account = { id?: string; name: string; tail: string; balance: number; tone?: string; color?: string; active?: boolean };
type Category = { id: string; name: string; type: FlowType; active: boolean };
type Flow = { id: string | number; date: string; type: FlowType; category: string; accountId?: string; account?: string; amount: number; note: string };
type Investment = { id: string | number; date: string; type: InvestType; fundId: string; fundName: string; fundCode: string; amount: number; units: number; price: number; fee: number; valuation: string; valuationSource?: string; valuationBasis?: string; rule: string; deviationReason?: string; accountId: string; note: string };
type LegacyInvestment = { id?: string | number; date?: string; type?: InvestType; product?: string; amount?: number; note?: string };
type FundPlan = { id: string; name: string; code: string; role: string; valuationMethod: string; baseAmount: number; targetAllocation: number; currentPrice: number; active: boolean };
type InvestPlan = { goal: string; targetAmount: number; emergencyMonths: number; monthlyBudget: number; executionDay: number; frequency: string; stockTarget: number; maxDrawdown: number; buyRule: string; pauseRule: string; exitRule: string; reviewFrequency: string };
type FinanceSnapshot = { accounts: Account[]; categories: Category[]; flows: Flow[]; investments: Investment[]; legacyInvestments: LegacyInvestment[]; funds: FundPlan[]; plan: InvestPlan; otherInvestmentValue: number };
type SyncStatus = "browser-only" | "connecting" | "synced" | "offline";

const CURRENCY_CODE = "CNY";
const TIME_ZONE = "Asia/Shanghai";
const LOCAL_SYNC_URL = "http://127.0.0.1:43128/v1/state";
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: CURRENCY_CODE, minimumFractionDigits: 2 });
function beijingParts(value = new Date(), includeTime = false) {
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", ...(includeTime ? { hour: "2-digit" as const, minute: "2-digit" as const, second: "2-digit" as const, hourCycle: "h23" as const } : {}) }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function beijingDate(value = new Date()) {
  const { year, month, day } = beijingParts(value);
  return `${year}-${month}-${day}`;
}
function beijingTimestamp(value = new Date()) {
  const { year, month, day, hour, minute, second } = beijingParts(value, true);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}
const today = beijingDate();
const currentMonth = today.slice(0, 7);
const tones = ["coral", "violet", "mint", "yellow", "blue"];
const legacyTones: Record<string, string> = { blue: "blue", red: "coral", green: "mint", purple: "violet", yellow: "yellow" };
const initialAccounts: Account[] = [];
const initialCategories: Category[] = [
  ...["实习工资", "奖金/补贴", "红包/转账", "兼职", "报销", "其他收入"].map((name, index) => ({ id: `income-${index}`, name, type: "收入" as const, active: true })),
  ...["住宿", "餐饮", "交通", "学习/考试", "社交", "娱乐", "服饰", "医疗", "其他支出"].map((name, index) => ({ id: `expense-${index}`, name, type: "支出" as const, active: true })),
];
const initialPlan: InvestPlan = { goal: "长期个人财富积累", targetAmount: 0, emergencyMonths: 6, monthlyBudget: 3000, executionDay: 11, frequency: "每月", stockTarget: 70, maxDrawdown: 60, buyRule: "仅按计划买入已确认估值方法、且处于可买区间的指数基金", pauseRule: "应急金不足、当月无结余或标的估值不合适时暂停", exitRule: "达到目标日期或估值退出条件时分批降低风险", reviewFrequency: "每季度" };

function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function accountId(account: Account) { return account.id || `${account.name}-${account.tail}`; }
function accountLabel(account: Account) { return `${account.name}${account.tail ? ` · ${account.tail}` : ""}`; }

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  // Browser storage is unavailable during server rendering, so hydrate it after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const stored = localStorage.getItem(key); if (stored) try { setValue(JSON.parse(stored)); } catch { /* keep defaults */ } setLoaded(true); }, [key]);
  useEffect(() => { if (loaded) localStorage.setItem(key, JSON.stringify(value)); }, [key, loaded, value]);
  return [value, setValue, loaded] as const;
}

function signedMoney(value: number) { return value === 0 ? currency.format(0) : `${value > 0 ? "+" : "−"}${currency.format(Math.abs(value))}`; }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function csvCell(value: unknown) { const text = String(value ?? ""); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }

export default function Home() {
  const [accounts, setAccounts, accountsLoaded] = useLocalState<Account[]>("money-garden-accounts", initialAccounts);
  const [categories, setCategories, categoriesLoaded] = useLocalState<Category[]>("money-garden-categories-v1", initialCategories);
  const [flows, setFlows, flowsLoaded] = useLocalState<Flow[]>("money-ledger-daily-v2", []);
  const [investments, setInvestments, investmentsLoaded] = useLocalState<Investment[]>("money-ledger-invest-v3", []);
  const [legacyInvestments, , legacyInvestmentsLoaded] = useLocalState<LegacyInvestment[]>("money-ledger-invest-v2", []);
  const [funds, setFunds, fundsLoaded] = useLocalState<FundPlan[]>("money-garden-funds-v1", []);
  const [plan, setPlan, planLoaded] = useLocalState<InvestPlan>("money-garden-plan-v1", initialPlan);
  const [otherInvestmentValue, setOtherInvestmentValue, otherValueLoaded] = useLocalState("money-ledger-invest-value-v2", 0);
  const [month, setMonth] = useState(currentMonth);
  const [investmentMonth, setInvestmentMonth] = useState("");
  const [dashboardMonth, setDashboardMonth] = useState(currentMonth);
  const [tab, setTab] = useState<Tab>("支出");
  const [flowDate, setFlowDate] = useState(today);
  const [category, setCategory] = useState("餐饮");
  const [flowAccount, setFlowAccount] = useState("");
  const [flowAmount, setFlowAmount] = useState("");
  const [flowNote, setFlowNote] = useState("");
  const [editingFlowId, setEditingFlowId] = useState<Flow["id"] | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [investDate, setInvestDate] = useState(today);
  const [investType, setInvestType] = useState<InvestType>("买入");
  const [investFund, setInvestFund] = useState("");
  const [investAmount, setInvestAmount] = useState("");
  const [investUnits, setInvestUnits] = useState("");
  const [investPrice, setInvestPrice] = useState("");
  const [investFee, setInvestFee] = useState("");
  const [investValuation, setInvestValuation] = useState("");
  const [investValuationSource, setInvestValuationSource] = useState("");
  const [investValuationBasis, setInvestValuationBasis] = useState("");
  const [investRule, setInvestRule] = useState("");
  const [investDeviationReason, setInvestDeviationReason] = useState("");
  const [investNote, setInvestNote] = useState("");
  const [investAccount, setInvestAccount] = useState("");
  const [editingInvestmentId, setEditingInvestmentId] = useState<Investment["id"] | null>(null);
  const [undoItem, setUndoItem] = useState<{ kind: "flow"; item: Flow } | { kind: "investment"; item: Investment } | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountTail, setNewAccountTail] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<FlowType>("支出");
  const [newFund, setNewFund] = useState({ name: "", code: "", role: "核心宽基", valuationMethod: "盈利收益率法", baseAmount: "500", targetAllocation: "100" });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("browser-only");
  const fileRef = useRef<HTMLInputElement>(null);
  const syncRevision = useRef(0);
  const syncReady = useRef(false);
  const skipNextSyncWrite = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedAccounts = useMemo(() => accounts.map((item, index) => ({
    ...item,
    id: accountId(item),
    tone: item.tone || legacyTones[item.color || ""] || tones[index % tones.length],
    active: item.active !== false,
  })), [accounts]);
  const activeAccounts = normalizedAccounts.filter((item) => item.active);
  const activeFunds = funds.filter((item) => item.active);
  const monthFlows = useMemo(() => flows.filter((item) => item.date.startsWith(month)), [flows, month]);
  const visibleInvestments = useMemo(() => investmentMonth ? investments.filter((item) => item.date.startsWith(investmentMonth)) : investments, [investments, investmentMonth]);
  const dashboardMonthFlows = useMemo(() => flows.filter((item) => item.date.startsWith(dashboardMonth)), [flows, dashboardMonth]);
  const dashboardMonthInvestments = useMemo(() => investments.filter((item) => item.date.startsWith(dashboardMonth)), [investments, dashboardMonth]);
  const income = dashboardMonthFlows.filter((item) => item.type === "收入").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = dashboardMonthFlows.filter((item) => item.type === "支出").reduce((sum, item) => sum + Number(item.amount), 0);
  const asOfTodayFlows = useMemo(() => flows.filter((item) => item.date <= today), [flows]);
  const asOfTodayInvestments = useMemo(() => investments.filter((item) => item.date <= today), [investments]);
  const cumulativeNetFlow = asOfTodayFlows.reduce((sum, item) => sum + (item.type === "收入" ? Number(item.amount) : -Number(item.amount)), 0);
  const accountNetFlows = useMemo(() => {
    const totals = new Map<string, number>();
    asOfTodayFlows.forEach((flow) => {
      const matched = normalizedAccounts.find((account) => account.id === flow.accountId || accountLabel(account) === flow.account || account.name === flow.account);
      if (!matched) return;
      totals.set(matched.id!, (totals.get(matched.id!) || 0) + (flow.type === "收入" ? Number(flow.amount) : -Number(flow.amount)));
    });
    asOfTodayInvestments.forEach((item) => {
      const matched = normalizedAccounts.find((account) => account.id === item.accountId);
      if (!matched) return;
      totals.set(matched.id!, (totals.get(matched.id!) || 0) + investmentAccountEffect(item));
    });
    return totals;
  }, [asOfTodayFlows, asOfTodayInvestments, normalizedAccounts]);
  const currentAccounts = useMemo(() => normalizedAccounts.map((account) => ({ ...account, currentBalance: Number(account.balance || 0) + (accountNetFlows.get(account.id!) || 0) })), [normalizedAccounts, accountNetFlows]);
  const investmentCashflow = dashboardMonthInvestments.reduce((sum, item) => {
    if (item.type === "卖出") return sum + item.amount - item.fee;
    if (item.type === "分红") return sum + item.amount;
    if (item.type === "买入") return sum - item.amount - item.fee;
    return sum - item.amount;
  }, 0);
  const holdings = useMemo(() => funds.map((fund) => {
    const fundTrades = asOfTodayInvestments.filter((item) => item.fundId === fund.id);
    const units = fundTrades.reduce((sum, item) => sum + (item.type === "买入" ? item.units : item.type === "卖出" ? -item.units : 0), 0);
    const invested = fundTrades.reduce((sum, item) => sum + (item.type === "买入" ? item.amount + item.fee : item.type === "卖出" ? -item.amount + item.fee : item.type === "费用" ? item.amount : 0), 0);
    const latestPricedTrade = [...fundTrades]
      .filter((item) => Number(item.price) > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const savedCurrentPrice = Number(fund.currentPrice || 0);
    const currentPrice = savedCurrentPrice > 0 ? savedCurrentPrice : Number(latestPricedTrade?.price || 0);
    return { ...fund, currentPrice, priceIsEstimated: savedCurrentPrice <= 0 && currentPrice > 0, units, invested, marketValue: units * currentPrice };
  }), [funds, asOfTodayInvestments]);
  const bankTotal = currentAccounts.reduce((sum, item) => sum + item.currentBalance, 0);
  const fundMarketValue = holdings.reduce((sum, item) => sum + item.marketValue, 0);
  const totalAssets = bankTotal + fundMarketValue + Number(otherInvestmentValue || 0);
  const dailyNet = income - expense;
  const totalCashChange = dailyNet + investmentCashflow;
  const localDataLoaded = accountsLoaded && categoriesLoaded && flowsLoaded && investmentsLoaded && legacyInvestmentsLoaded && fundsLoaded && planLoaded && otherValueLoaded;
  const snapshot = useMemo<FinanceSnapshot>(() => ({ accounts, categories, flows, investments, legacyInvestments, funds, plan, otherInvestmentValue: Number(otherInvestmentValue || 0) }), [accounts, categories, flows, investments, legacyInvestments, funds, plan, otherInvestmentValue]);
  const snapshotRef = useRef(snapshot);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  useEffect(() => {
    if (!localDataLoaded || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    let stopped = false;
    // The local file service is an external system; this reflects its connection state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncStatus("connecting");

    async function pull() {
      try {
        const response = await fetch(LOCAL_SYNC_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("Local data service unavailable");
        const remote = await response.json() as { revision?: number; data?: Partial<FinanceSnapshot> | null };
        if (stopped) return;
        if (remote.data && Number(remote.revision || 0) > syncRevision.current) {
          skipNextSyncWrite.current = true;
          setAccounts(remote.data.accounts || initialAccounts);
          setCategories(remote.data.categories || initialCategories);
          setFlows(remote.data.flows || []);
          setInvestments(remote.data.investments || []);
          setFunds(remote.data.funds || []);
          setPlan({ ...initialPlan, ...(remote.data.plan || {}) });
          setOtherInvestmentValue(Number(remote.data.otherInvestmentValue || 0));
          syncRevision.current = Number(remote.revision || 0);
        } else if (!remote.data) {
          const seeded = await fetch(LOCAL_SYNC_URL, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(snapshotRef.current) });
          if (!seeded.ok) throw new Error("Could not initialize local data");
          const saved = await seeded.json() as { revision?: number };
          syncRevision.current = Number(saved.revision || 0);
        }
        syncReady.current = true;
        setSyncStatus("synced");
      } catch {
        if (!stopped) setSyncStatus("offline");
      }
    }

    void pull();
    const timer = window.setInterval(() => void pull(), 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [localDataLoaded, setAccounts, setCategories, setFlows, setFunds, setInvestments, setOtherInvestmentValue, setPlan]);

  useEffect(() => {
    if (!syncReady.current) return;
    if (skipNextSyncWrite.current) { skipNextSyncWrite.current = false; return; }
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(async () => {
      try {
        setSyncStatus("connecting");
        const response = await fetch(LOCAL_SYNC_URL, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(snapshotRef.current) });
        if (!response.ok) throw new Error("Local data service unavailable");
        const saved = await response.json() as { revision?: number };
        syncRevision.current = Number(saved.revision || syncRevision.current);
        setSyncStatus("synced");
      } catch { setSyncStatus("offline"); }
    }, 350);
    return () => { if (writeTimer.current) clearTimeout(writeTimer.current); };
  }, [snapshot]);

  function changeTab(next: Tab) {
    if (next !== tab) {
      setEditingFlowId(null); setFlowAmount(""); setFlowNote("");
      setEditingInvestmentId(null); setInvestAmount(""); setInvestUnits(""); setInvestPrice(""); setInvestFee(""); setInvestValuation(""); setInvestRule(""); setInvestNote("");
    }
    setTab(next);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeAccounts.some((item) => item.id === flowAccount) && activeAccounts[0]) setFlowAccount(activeAccounts[0].id!);
  }, [activeAccounts, flowAccount]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeAccounts.some((item) => item.id === investAccount) && activeAccounts[0]) setInvestAccount(activeAccounts[0].id!);
  }, [activeAccounts, investAccount]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeFunds.some((item) => item.id === investFund) && activeFunds[0]) setInvestFund(activeFunds[0].id);
  }, [activeFunds, investFund]);
  useEffect(() => {
    if (!legacyInvestments.length || investments.length || localStorage.getItem("money-ledger-invest-v3-migrated")) return;
    const productNames = [...new Set(legacyInvestments.map((item) => String(item.product || "未命名基金")))];
    const migratedFunds: FundPlan[] = productNames.map((name, index) => ({ id: `legacy-fund-${index}`, name, code: "", role: "核心宽基", valuationMethod: "待补充", baseAmount: 0, targetAllocation: 0, currentPrice: 0, active: true }));
    if (!funds.length) setFunds(migratedFunds);
    setInvestments(legacyInvestments.map((item, index) => {
      const fund = migratedFunds.find((entry) => entry.name === String(item.product || "未命名基金"))!;
      return { id: item.id || `legacy-invest-${index}`, date: item.date || today, type: item.type || "买入", fundId: fund.id, fundName: fund.name, fundCode: "", amount: Number(item.amount || 0), units: 0, price: 0, fee: 0, valuation: "", valuationSource: "", valuationBasis: "", rule: "旧版记录迁移", deviationReason: "", accountId: "", note: item.note || "" };
    }));
    localStorage.setItem("money-ledger-invest-v3-migrated", "1");
  }, [legacyInvestments, investments, funds, setFunds, setInvestments]);
  useEffect(() => {
    if (tab !== "收入" && tab !== "支出") return;
    const first = categories.find((item) => item.type === tab && item.active);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (first && !categories.some((item) => item.type === tab && item.active && item.name === category)) setCategory(first.name);
  }, [tab, categories, category]);

  function addFlow(event: FormEvent, type: FlowType) {
    event.preventDefault(); const amount = Number(flowAmount); if (!amount || amount <= 0 || !category || !flowAccount) return;
    const next = { id: editingFlowId || uid("flow"), date: flowDate, type, category, accountId: flowAccount, amount, note: flowNote.trim() } as Flow;
    const duplicate = flows.some((item) => item.id !== editingFlowId && item.date === next.date && item.type === type && item.category === next.category && item.accountId === next.accountId && Number(item.amount) === amount && item.note === next.note);
    if (duplicate) { alert("这笔记录已经存在，没有重复添加"); return; }
    setFlows(editingFlowId ? flows.map((item) => item.id === editingFlowId ? next : item) : [next, ...flows]);
    setMonth(next.date.slice(0, 7));
    setFlowAmount(""); setFlowNote("");
    setEditingFlowId(null);
  }
  function addInvestment(event: FormEvent) {
    event.preventDefault(); const amount = Number(investAmount); const units = Number(investUnits || 0); const fee = Number(investFee || 0); const fund = funds.find((item) => item.id === investFund); if (!fund || !amount || amount <= 0 || fee < 0) return;
    if ((investType === "买入" || investType === "卖出") && units <= 0) { alert("买入或卖出必须填写大于 0 的份额"); return; }
    if (investType === "卖出" && fee > amount) { alert("卖出手续费不能大于成交金额"); return; }
    const ownedUnits = investments.filter((item) => item.fundId === fund.id && item.id !== editingInvestmentId).reduce((sum, item) => sum + (item.type === "买入" ? item.units : item.type === "卖出" ? -item.units : 0), 0);
    if (investType === "卖出" && units > ownedUnits) { alert(`最多可卖出 ${ownedUnits.toFixed(4)} 份`); return; }
    const next = { id: editingInvestmentId || uid("invest"), date: investDate, type: investType, fundId: fund.id, fundName: fund.name, fundCode: fund.code, amount, units, price: Number(investPrice || 0), fee, valuation: investValuation.trim(), valuationSource: investValuationSource.trim(), valuationBasis: investValuationBasis.trim(), rule: investRule.trim(), deviationReason: investDeviationReason.trim(), accountId: investAccount, note: investNote.trim() } as Investment;
    const duplicate = investments.some((item) => item.id !== editingInvestmentId && item.date === next.date && item.type === next.type && item.fundId === next.fundId && item.accountId === next.accountId && item.amount === next.amount && item.units === next.units);
    if (duplicate) { alert("这笔定投记录已经存在，没有重复添加"); return; }
    setInvestments(editingInvestmentId ? investments.map((item) => item.id === editingInvestmentId ? next : item) : [next, ...investments]);
    setMonth(next.date.slice(0, 7));
    setInvestAmount(""); setInvestUnits(""); setInvestPrice(""); setInvestFee(""); setInvestValuation(""); setInvestValuationSource(""); setInvestValuationBasis(""); setInvestRule(""); setInvestDeviationReason(""); setInvestNote("");
    setEditingInvestmentId(null);
  }
  function addAccount(event: FormEvent) {
    event.preventDefault(); if (!newAccountName.trim()) return;
    if (normalizedAccounts.some((item) => item.name === newAccountName.trim() && item.tail === newAccountTail.trim())) { alert("这个账户已经存在"); return; }
    setAccounts([...normalizedAccounts, { id: uid("account"), name: newAccountName.trim(), tail: newAccountTail.trim(), balance: Math.max(0, Number(newAccountBalance || 0)), tone: tones[accounts.length % tones.length], active: true }]);
    setNewAccountName(""); setNewAccountTail(""); setNewAccountBalance(""); setAccountFormOpen(false);
  }
  function addCategory(event: FormEvent) {
    event.preventDefault(); if (!newCategoryName.trim() || categories.some((item) => item.type === newCategoryType && item.name === newCategoryName.trim())) return;
    setCategories([...categories, { id: uid("category"), name: newCategoryName.trim(), type: newCategoryType, active: true }]); setNewCategoryName("");
  }
  function deleteCategory(item: Category) {
    if (!confirm(`删除分类“${item.name}”？历史收支记录会保留。`)) return;
    const nextCategories = categories.filter((entry) => entry.id !== item.id);
    setCategories(nextCategories);
    if (category === item.name && tab === item.type) {
      setCategory(nextCategories.find((entry) => entry.type === item.type && entry.active)?.name || "");
    }
  }
  function addFund(event: FormEvent) {
    event.preventDefault(); if (!newFund.name.trim()) return;
    if (funds.some((fund) => fund.name === newFund.name.trim() && fund.code === newFund.code.trim())) { alert("这个定投标的已经存在"); return; }
    setFunds([...funds, { id: uid("fund"), name: newFund.name.trim(), code: newFund.code.trim(), role: newFund.role, valuationMethod: newFund.valuationMethod, baseAmount: Number(newFund.baseAmount || 0), targetAllocation: Number(newFund.targetAllocation || 0), currentPrice: 0, active: true }]);
    setNewFund({ ...newFund, name: "", code: "" });
  }
  function deleteFund(fund: FundPlan) {
    if (investments.some((item) => item.fundId === fund.id)) {
      alert(`“${fund.name}”已有投资记录。为避免持仓和总资产失真，请先删除相关投资记录后再删除标的。`);
      return;
    }
    if (!confirm(`删除定投标的“${fund.name}”？`)) return;
    setFunds(funds.filter((item) => item.id !== fund.id));
  }
  function patchPlan<K extends keyof InvestPlan>(key: K, value: InvestPlan[K]) { setPlan({ ...plan, [key]: value }); }
  function resolveAccount(item: Flow | Investment) { const matched = normalizedAccounts.find((account) => account.id === item.accountId); return matched ? accountLabel(matched) : ("account" in item ? item.account : "") || "—"; }

  function editFlow(item: Flow) {
    setFlowDate(item.date); setCategory(item.category); setFlowAccount(item.accountId || ""); setFlowAmount(String(item.amount)); setFlowNote(item.note); setEditingFlowId(item.id);
  }
  function editInvestment(item: Investment) {
    setInvestDate(item.date); setInvestType(item.type); setInvestFund(item.fundId); setInvestAccount(item.accountId); setInvestAmount(String(item.amount)); setInvestUnits(item.units ? String(item.units) : ""); setInvestPrice(item.price ? String(item.price) : ""); setInvestFee(item.fee ? String(item.fee) : ""); setInvestValuation(item.valuation); setInvestValuationSource(item.valuationSource || ""); setInvestValuationBasis(item.valuationBasis || ""); setInvestRule(item.rule); setInvestDeviationReason(item.deviationReason || ""); setInvestNote(item.note); setEditingInvestmentId(item.id);
  }
  function deleteFlow(item: Flow) { setFlows(flows.filter((entry) => entry.id !== item.id)); setUndoItem({ kind: "flow", item }); }
  function deleteInvestment(item: Investment) { setInvestments(investments.filter((entry) => entry.id !== item.id)); setUndoItem({ kind: "investment", item }); }
  function undoDelete() {
    if (!undoItem) return;
    if (undoItem.kind === "flow") setFlows([undoItem.item, ...flows]); else setInvestments([undoItem.item, ...investments]);
    setUndoItem(null);
  }
  function importBatch(type: FlowType) {
    const parsed: Flow[] = []; let invalid = 0; let duplicate = 0;
    batchText.split(/\r?\n/).filter((line) => line.trim()).forEach((line) => {
      const parts = line.split(/\t|,/).map((part) => part.trim());
      const [date, categoryName, accountName, amountText, ...noteParts] = parts;
      const account = normalizedAccounts.find((item) => accountLabel(item) === accountName || item.name === accountName || item.tail === accountName.replace(/\D/g, ""));
      const amount = Number(String(amountText || "").replace(/[¥￥,]/g, ""));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !categoryName || !account || amount <= 0) { invalid += 1; return; }
      const candidate: Flow = { id: uid("flow"), date, type, category: categoryName, accountId: account.id, amount, note: noteParts.join(" ") };
      if ([...flows, ...parsed].some((item) => item.date === candidate.date && item.type === type && item.category === candidate.category && item.accountId === candidate.accountId && Number(item.amount) === amount && item.note === candidate.note)) { duplicate += 1; return; }
      parsed.push(candidate);
    });
    if (parsed.length) setFlows([...parsed, ...flows]);
    alert(`已导入 ${parsed.length} 笔${duplicate ? `，跳过 ${duplicate} 笔重复` : ""}${invalid ? `，${invalid} 行格式不完整` : ""}`);
    if (parsed.length && !invalid) { setBatchText(""); setBatchOpen(false); }
  }

  function exportFullCsv() {
    const headers = ["数据类型", "记录ID", "日期", "时区", "币种", "收支/操作", "分类", "账户ID", "账户", "金额", "基金ID", "基金名称", "基金代码", "份额", "成交价", "费用", "估值", "估值数据来源", "估值计算口径", "触发规则", "偏离计划原因", "备注", "名称", "尾号", "当前余额", "启用", "组合功能", "估值方法", "基准金额", "目标占比", "当前净值", "计划字段", "计划值"];
    const rows: Record<string, unknown>[] = [];
    normalizedAccounts.forEach((a) => rows.push({ 数据类型: "账户", 账户ID: a.id, 名称: a.name, 尾号: a.tail, 起始余额: a.balance, 币种: CURRENCY_CODE, 启用: a.active }));
    categories.forEach((c) => rows.push({ 数据类型: "分类", "收支/操作": c.type, 分类: c.name, 启用: c.active }));
    flows.forEach((f) => rows.push({ 数据类型: "收支记录", 记录ID: f.id, 日期: f.date, 时区: "北京时间 UTC+8", 币种: CURRENCY_CODE, "收支/操作": f.type, 分类: f.category, 账户ID: f.accountId, 账户: resolveAccount(f), 金额: f.amount, 备注: f.note }));
    investments.forEach((i) => rows.push({ 数据类型: "投资记录", 记录ID: i.id, 日期: i.date, 时区: "北京时间 UTC+8", 币种: CURRENCY_CODE, "收支/操作": i.type, 账户ID: i.accountId, 账户: resolveAccount(i), 金额: i.amount, 基金ID: i.fundId, 基金名称: i.fundName, 基金代码: i.fundCode, 份额: i.units, 成交价: i.price, 费用: i.fee, 估值: i.valuation, 估值数据来源: i.valuationSource, 估值计算口径: i.valuationBasis, 触发规则: i.rule, 偏离计划原因: i.deviationReason, 备注: i.note }));
    funds.forEach((f) => rows.push({ 数据类型: "定投标的", 基金ID: f.id, 币种: CURRENCY_CODE, 基金名称: f.name, 基金代码: f.code, 启用: f.active, 组合功能: f.role, 估值方法: f.valuationMethod, 基准金额: f.baseAmount, 目标占比: f.targetAllocation, 当前净值: f.currentPrice }));
    Object.entries(plan).forEach(([key, value]) => rows.push({ 数据类型: "定投计划", 计划字段: key, 计划值: value }));
    rows.push({ 数据类型: "其他理财市值", 币种: CURRENCY_CODE, 当前余额: otherInvestmentValue });
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))].map((row) => row.map(csvCell).join(",")).join("\n");
    download(`钱途花园-完整数据-${today}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
  }
  function jsonBackup() { return JSON.stringify({ version: 3, exportedAt: beijingTimestamp(), timeZone: TIME_ZONE, currency: CURRENCY_CODE, accounts: normalizedAccounts, categories, flows, investments, legacyInvestments, funds, plan, otherInvestmentValue }, null, 2); }
  function exportJson() { download(`钱途花园-备份-${today}.json`, jsonBackup(), "application/json"); }
  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data.accounts) || !Array.isArray(data.flows) || (data.investments && !Array.isArray(data.investments)) || (data.funds && !Array.isArray(data.funds))) throw new Error(); const summary = `${data.accounts.length} 个账户、${data.flows.length} 笔收支、${data.investments?.length || 0} 笔投资记录`; if (!confirm(`将恢复 ${summary}。现有数据会先自动备份，是否继续？`)) return; download(`钱途花园-恢复前备份-${today}.json`, jsonBackup(), "application/json"); setAccounts(data.accounts); setCategories(data.categories || initialCategories); setFlows(data.flows); setInvestments(data.investments || []); setFunds(data.funds || []); setPlan({ ...initialPlan, ...(data.plan || {}) }); setOtherInvestmentValue(Number(data.otherInvestmentValue || 0)); alert("备份已恢复"); } catch { alert("无法读取这个备份文件：格式不完整"); } }; reader.readAsText(file); event.target.value = "";
  }

  function renderFlowPanel(type: FlowType) {
    const rows = monthFlows.filter((item) => item.type === type); const total = rows.reduce((sum, item) => sum + item.amount, 0);
    const availableCategories = categories.filter((item) => item.type === type && item.active);
    return <div className="tab-panel"><div className="panel-head"><div><span>{type === "收入" ? "01" : "02"}</span><h2>记录{type}</h2></div><div className="panel-actions"><p>{type === "收入" ? "工资、红包和其他进账分开记" : "选择分类和付款账户，几秒记一笔"}</p><label className="history-month">查看月份<input type="month" value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} required /></label><button className="text-button" onClick={() => setBatchOpen(!batchOpen)}>{batchOpen ? "收起" : "批量录入"}</button></div></div>
      <form className="sheet-form flow-form" onSubmit={(event) => addFlow(event, type)}><label>日期（北京时间）<input type="date" value={flowDate} onChange={(event) => setFlowDate(event.target.value)} required /></label><label>分类<select value={category} onChange={(event) => setCategory(event.target.value)}>{availableCategories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label>账户<select value={flowAccount} onChange={(event) => setFlowAccount(event.target.value)}>{activeAccounts.map((item) => <option value={item.id} key={item.id}>{accountLabel(item)}</option>)}</select></label><label>金额（人民币元）<input type="number" min="0.01" step="0.01" value={flowAmount} onChange={(event) => setFlowAmount(event.target.value)} placeholder="0.00" required /></label><label>备注<input value={flowNote} onChange={(event) => setFlowNote(event.target.value)} placeholder="可不填" /></label><button type="submit" disabled={!activeAccounts.length || !availableCategories.length}>{editingFlowId ? "保存修改" : `添加${type}`}</button>{editingFlowId && <button type="button" className="soft-button" onClick={() => { setEditingFlowId(null); setFlowAmount(""); setFlowNote(""); }}>取消</button>}</form>{!activeAccounts.length && <button className="form-warning" onClick={() => changeTab("资产")}>还没有账户，先去资产页添加 →</button>}
      {batchOpen && <div className="batch-box"><textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} placeholder={`每行一笔：日期,分类,账户,金额,备注\n${today},餐饮,银行卡,25.8,午餐`} /><div><span>支持逗号或从表格复制的制表符；重复记录会自动跳过</span><button onClick={() => importBatch(type)}>检查并导入</button></div></div>}
      <div className="table-wrap"><table><thead><tr><th>日期</th><th>分类</th><th>账户</th><th>备注</th><th className="number">金额</th><th /></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.id}><td>{item.date}</td><td><span className={`type ${type}`}>{item.category}</span></td><td>{resolveAccount(item)}</td><td className="note-cell">{item.note || "—"}</td><td className={`number ${type === "收入" ? "positive" : "negative"}`}>{type === "收入" ? "+" : "−"}{currency.format(item.amount)}</td><td><div className="row-actions"><button onClick={() => editFlow(item)}>编辑</button><button className="delete" onClick={() => deleteFlow(item)}>删除</button></div></td></tr>) : <tr><td className="no-data" colSpan={6}>本月暂无{type}记录</td></tr>}</tbody><tfoot><tr><td colSpan={4}>本月{type}</td><td className={`number ${type === "收入" ? "positive" : "negative"}`}>{currency.format(total)}</td><td /></tr></tfoot></table></div></div>;
  }

  const syncLabel = syncStatus === "synced" ? "本机已同步" : syncStatus === "connecting" ? "本机同步中" : syncStatus === "offline" ? "本机服务未启动" : "仅此浏览器";
  const compositionTotal = Math.max(0, bankTotal) + Math.max(0, fundMarketValue) + Math.max(0, otherInvestmentValue);
  const assetShare = (value: number) => compositionTotal > 0 ? Math.max(0, value) / compositionTotal * 100 : 0;

  return <main className="app-shell">
    <header className="simple-nav"><div><strong>钱途花园</strong><span>个人资产记录</span><span className={`privacy-badge sync-${syncStatus}`} title={syncStatus === "browser-only" ? "线上地址的数据只保存在当前浏览器" : "本机地址使用这台电脑上的同一份数据"}>{syncLabel} · 北京时间 · 人民币</span></div><div className="nav-right"><button onClick={exportFullCsv}>导出完整 CSV</button></div></header>
    <div className="dashboard">
      <aside className="side-summary">
        <div className="summary-heading"><div><p className="kicker">MONEY DASHBOARD</p><h1>我的资产</h1></div><span>截至今天</span></div>
        <article className="total-card"><span>人民币总资产</span><strong>{currency.format(totalAssets)}</strong><div className="total-breakdown"><span>银行卡<b>{currency.format(bankTotal)}</b></span><span>基金<b>{currency.format(fundMarketValue)}</b></span><span>其他<b>{currency.format(otherInvestmentValue)}</b></span></div></article>
        <section className="monthly-dashboard"><header><div><span>月度现金流</span><small>收支和投资分开统计</small></div><label className="dashboard-month"><span>看板月份</span><input aria-label="看板月份" type="month" value={dashboardMonth} onChange={(event) => { if (event.target.value) setDashboardMonth(event.target.value); }} /></label></header><div className="side-metrics"><div><span>收入</span><strong className="positive">{currency.format(income)}</strong></div><div><span>支出</span><strong className="negative">{currency.format(expense)}</strong></div><div><span>日常净结余</span><strong className={dailyNet >= 0 ? "positive" : "negative"}>{signedMoney(dailyNet)}</strong></div><div><span>投资现金流</span><strong className={investmentCashflow >= 0 ? "positive" : "negative"}>{signedMoney(investmentCashflow)}</strong></div></div><div className="cash-change"><span>当月净现金变化</span><strong className={totalCashChange >= 0 ? "positive" : "negative"}>{signedMoney(totalCashChange)}</strong></div></section>
        <section className="asset-mix"><header><span>资产分布</span><small>截至今天</small></header><div className="mix-bar" aria-label="资产分布"><i className="mix-bank" style={{ width: `${assetShare(bankTotal)}%` }} /><i className="mix-fund" style={{ width: `${assetShare(fundMarketValue)}%` }} /><i className="mix-other" style={{ width: `${assetShare(otherInvestmentValue)}%` }} /></div><div className="mix-legend"><span><i className="mix-bank" />银行卡<b>{assetShare(bankTotal).toFixed(0)}%</b></span><span><i className="mix-fund" />基金<b>{assetShare(fundMarketValue).toFixed(0)}%</b></span><span><i className="mix-other" />其他<b>{assetShare(otherInvestmentValue).toFixed(0)}%</b></span></div></section>
        <section className="asset-context"><span>资产口径</span><p>初始余额 + 截至今天的全部收支 + 基金当前市值</p><small>累计收支 {signedMoney(cumulativeNetFlow)}</small></section>
      </aside>
      <section className="workspace"><nav className="tabs">{(["收入", "支出", "定投", "资产", "设置"] as const).map((item) => <button className={tab === item ? "active" : ""} onClick={() => changeTab(item)} key={item}>{item}</button>)}</nav>
        {tab === "定投" && <div className="investment-filter floating-history-month"><span>记录范围</span><button type="button" className={!investmentMonth ? "active" : ""} onClick={() => setInvestmentMonth("")}>全部</button><input aria-label="筛选定投月份" type="month" value={investmentMonth} onChange={(event) => setInvestmentMonth(event.target.value)} /></div>}
        {tab === "收入" && renderFlowPanel("收入")}{tab === "支出" && renderFlowPanel("支出")}
        {tab === "定投" && <div className="tab-panel invest-panel"><div className="panel-head"><div><span>03</span><h2>记录投资</h2></div><p>买入、卖出、分红与费用</p></div>
          <form className="sheet-form trade-form" onSubmit={addInvestment}>
            <label>日期（北京时间）<input type="date" value={investDate} onChange={(e) => setInvestDate(e.target.value)} required /></label>
            <label>操作<select value={investType} onChange={(e) => setInvestType(e.target.value as InvestType)}><option>买入</option><option>卖出</option><option>分红</option><option>费用</option></select></label>
            <label>基金 / ETF<select value={investFund} onChange={(e) => setInvestFund(e.target.value)}>{activeFunds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}{fund.code ? ` · ${fund.code}` : ""}</option>)}</select></label>
            <label>账户<select value={investAccount} onChange={(e) => setInvestAccount(e.target.value)}>{activeAccounts.map((account) => <option value={account.id} key={account.id}>{accountLabel(account)}</option>)}</select></label>
            <label>{investType === "买入" || investType === "卖出" ? "成交金额（不含手续费）" : investType === "分红" ? "到账金额（元）" : "费用金额（元）"}<input type="number" step="0.01" min="0.01" value={investAmount} onChange={(e) => setInvestAmount(e.target.value)} required /></label>
            <label>份额<input type="number" step="0.0001" min="0" value={investUnits} onChange={(e) => setInvestUnits(e.target.value)} required={investType === "买入" || investType === "卖出"} /></label>
            <label>成交价（元）<input type="number" step="0.0001" min="0" value={investPrice} onChange={(e) => setInvestPrice(e.target.value)} /></label>
            <label>交易手续费（元）<input type="number" step="0.01" min="0" value={investFee} onChange={(e) => setInvestFee(e.target.value)} placeholder="没有则填 0" /></label>
            <label>成交时指数估值<input value={investValuation} onChange={(e) => setInvestValuation(e.target.value)} placeholder="如 PE 12.3" /></label>
            <label>估值数据来源<input value={investValuationSource} onChange={(e) => setInvestValuationSource(e.target.value)} placeholder="如中证指数官网" /></label>
            <label>估值计算口径<input value={investValuationBasis} onChange={(e) => setInvestValuationBasis(e.target.value)} placeholder="如 PE-TTM" /></label>
            <label>触发规则<input value={investRule} onChange={(e) => setInvestRule(e.target.value)} placeholder="如月度基准" /></label>
            <label>偏离计划原因<input value={investDeviationReason} onChange={(e) => setInvestDeviationReason(e.target.value)} placeholder="按计划可不填" /></label>
            <label>备注<input value={investNote} onChange={(e) => setInvestNote(e.target.value)} placeholder="可不填" /></label>
            <button disabled={!activeFunds.length || !activeAccounts.length}>{editingInvestmentId ? "保存修改" : "记录执行"}</button>
            {editingInvestmentId && <button type="button" className="soft-button" onClick={() => { setEditingInvestmentId(null); setInvestAmount(""); setInvestUnits(""); setInvestPrice(""); setInvestFee(""); setInvestValuation(""); setInvestValuationSource(""); setInvestValuationBasis(""); setInvestRule(""); setInvestDeviationReason(""); setInvestNote(""); }}>取消</button>}
          </form>
          <div className="table-wrap trade-table"><table><thead><tr><th>交易</th><th>标的 / 账户</th><th className="number">份额 / 成交价</th><th>成交估值</th><th className="number">成交金额</th><th>备注 / 偏离</th><th /></tr></thead><tbody>{visibleInvestments.length ? visibleInvestments.map((item) => <tr key={item.id}><td className="trade-identity"><strong>{item.date}</strong><span className={`type invest-${item.type}`}>{item.type}</span></td><td className="trade-details"><strong>{item.fundName}</strong><small>{item.fundCode || "无代码"} · {resolveAccount(item)}</small></td><td className="number">{item.units ? `${item.units} 份` : "—"}<small>成交价 {item.price ? currency.format(item.price) : "—"}</small></td><td className="trade-details">{item.valuation || "未记录"}<small>来源：{item.valuationSource || "未填写"}</small><small>口径：{item.valuationBasis || "未填写"} · 规则：{item.rule || "未填写"}</small></td><td className="number">{currency.format(item.amount)}<small>手续费 {currency.format(item.fee)}</small><small>{item.type === "买入" ? `实际支出 ${currency.format(item.amount + item.fee)}` : item.type === "卖出" ? `实际到账 ${currency.format(Math.max(0, item.amount - item.fee))}` : item.type === "分红" ? `实际到账 ${currency.format(item.amount)}` : `实际支出 ${currency.format(item.amount)}`}</small></td><td className="trade-details">{item.note || "—"}<small>{item.deviationReason ? `偏离：${item.deviationReason}` : "按计划执行"}</small></td><td><div className="row-actions"><button onClick={() => editInvestment(item)}>编辑</button><button className="delete" onClick={() => deleteInvestment(item)}>删除</button></div></td></tr>) : <tr><td className="no-data" colSpan={7}>{investmentMonth ? "该月暂无定投执行记录" : "暂无定投执行记录"}</td></tr>}</tbody></table></div></div>}
        {tab === "资产" && <div className="tab-panel asset-panel">
          <div className="panel-head"><div><span>04</span><h2>截至今天的资产</h2></div><div className="panel-actions"><p>北京时间 {today.replaceAll("-", "/")} 快照 · 不受收支月份影响</p><button className="text-button" onClick={() => setAccountFormOpen(!accountFormOpen)}>{accountFormOpen ? "取消添加" : "+ 添加账户"}</button></div></div>
          {accountFormOpen && <form className="mini-form asset-add-form" onSubmit={addAccount}><input aria-label="账户名称" placeholder="如：浦发银行" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} required autoFocus /><input aria-label="银行卡尾号" placeholder="尾号（可不填）" value={newAccountTail} onChange={(e) => setNewAccountTail(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8} /><input aria-label="开始记账时的人民币余额" type="number" min="0" step="0.01" placeholder="起始余额" value={newAccountBalance} onChange={(e) => setNewAccountBalance(e.target.value)} /><button type="submit">确认添加</button></form>}
          <div className="asset-note">账户填写开始记账时的余额；此后收入、支出和投资交易都会自动计入所选账户。基金按截至今天持有份额 × 当前净值计算，未来日期记录不会提前计入。</div>
          <div className="account-grid">{currentAccounts.map((item) => <article className={`account ${item.tone} ${!item.active ? "muted-row" : ""}`} key={item.id}><div><strong>{item.name}</strong><span>{item.tail ? `尾号 ${item.tail}` : "现金账户"}</span></div><div className="account-current"><span>当前余额</span><strong>{currency.format(item.currentBalance)}</strong></div><label className="account-base"><span>初始余额</span><input aria-label={`${item.name}开始记账时的人民币余额`} type="number" min="0" step="0.01" value={item.balance || ""} placeholder="0.00" onChange={(e) => setAccounts(normalizedAccounts.map((account) => account.id === item.id ? { ...account, balance: Math.max(0, Number(e.target.value)) } : account))} /></label></article>)}</div>
          <div className="holding-grid">{holdings.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.code || "无代码"} · {item.units.toFixed(4)} 份</span></div><label className="holding-price"><span>当前净值（元）</span><input aria-label={`${item.name}当前净值`} type="number" min="0" step="0.0001" value={item.currentPrice || ""} placeholder="0.0000" onChange={(e) => setFunds(funds.map((fund) => fund.id === item.id ? { ...fund, currentPrice: Math.max(0, Number(e.target.value)) } : fund))} /></label><strong>{currency.format(item.marketValue)}</strong><small>{item.priceIsEstimated ? "暂按最近成交价计算 · " : ""}累计净投入 {currency.format(item.invested)}</small></article>)}</div>
          <label className="market-value"><span>其他理财当前市值（人民币）</span><div><span>¥</span><input type="number" min="0" step="0.01" value={otherInvestmentValue || ""} placeholder="0.00" onChange={(e) => setOtherInvestmentValue(Math.max(0, Number(e.target.value)))} /></div></label>
          <div className="asset-total"><span>截至今天人民币总资产（各账户当前余额 + 基金当前市值 + 其他理财）</span><strong>{currency.format(totalAssets)}</strong></div>
        </div>}
        {tab === "设置" && <div className="tab-panel settings-panel"><div className="settings-content">
          <div className="settings-row settings-row-full plan-row">
              <section className="plan-card">
                <h3>我的计划</h3>
                <div className="compact-grid"><label>投资目标<input value={plan.goal} onChange={(e) => patchPlan("goal", e.target.value)} /></label><label>目标金额（元）<input type="number" min="0" step="0.01" value={plan.targetAmount || ""} onChange={(e) => patchPlan("targetAmount", Number(e.target.value))} /></label><label>应急金（月）<input type="number" min="0" value={plan.emergencyMonths} onChange={(e) => patchPlan("emergencyMonths", Number(e.target.value))} /></label><label>每月预算（元）<input type="number" min="0" step="0.01" value={plan.monthlyBudget} onChange={(e) => patchPlan("monthlyBudget", Number(e.target.value))} /></label><label>执行频率<select value={plan.frequency} onChange={(e) => patchPlan("frequency", e.target.value)}><option>每周</option><option>双周</option><option>每月</option></select></label><label>固定执行日<input type="number" min="1" max="28" value={plan.executionDay} onChange={(e) => patchPlan("executionDay", Number(e.target.value))} /></label><label>股票目标占比 %<input type="number" min="0" max="100" value={plan.stockTarget || ""} onChange={(e) => patchPlan("stockTarget", Number(e.target.value))} /></label><label>可承受回撤 %<input type="number" min="0" max="100" value={plan.maxDrawdown || ""} onChange={(e) => patchPlan("maxDrawdown", Number(e.target.value))} /></label></div>
              </section>
          </div>
          <div className="settings-row settings-row-full fund-row">
              <section className="fund-card">
                <div className="card-title"><h3>定投标的</h3><span>支持添加多只</span></div>
                <form className="fund-form" onSubmit={addFund}><label className="fund-name">标的名称<input placeholder="如：红利ETF易方达" value={newFund.name} onChange={(e) => setNewFund({ ...newFund, name: e.target.value })} required /></label><label className="fund-code">基金 / ETF 代码<input placeholder="如：515180" value={newFund.code} onChange={(e) => setNewFund({ ...newFund, code: e.target.value })} /></label><label className="fund-role">组合定位<select value={newFund.role} onChange={(e) => setNewFund({ ...newFund, role: e.target.value })}><option>核心宽基</option><option>价值或红利</option><option>行业补充</option><option>低风险替代</option></select></label><label className="fund-method">估值方法<select value={newFund.valuationMethod} onChange={(e) => setNewFund({ ...newFund, valuationMethod: e.target.value })}><option>盈利收益率法</option><option>博格公式PE法</option><option>博格公式PB法</option><option>不适用</option></select></label><label className="fund-amount">每期金额（元）<input type="number" min="0" step="0.01" placeholder="500" value={newFund.baseAmount} onChange={(e) => setNewFund({ ...newFund, baseAmount: e.target.value })} /></label><label className="fund-allocation">目标占比（%）<input type="number" min="0" max="100" placeholder="100" value={newFund.targetAllocation} onChange={(e) => setNewFund({ ...newFund, targetAllocation: e.target.value })} /></label><button>添加标的</button></form>
                <div className="fund-list">{funds.length ? funds.map((fund) => <article key={fund.id}><div className="fund-summary"><strong>{fund.name}</strong><span>{fund.code || "无代码"} · {fund.role} · {fund.valuationMethod}</span></div><label>当前净值（元）<input type="number" min="0" step="0.0001" value={fund.currentPrice || ""} onChange={(e) => setFunds(funds.map((item) => item.id === fund.id ? { ...item, currentPrice: Number(e.target.value) } : item))} /></label><button type="button" className="delete-button" onClick={() => deleteFund(fund)}>删除</button></article>) : <div className="empty-card">先添加一只计划中的基金，再记录执行</div>}</div>
              </section>
          </div>
          <div className="settings-row management-row">
              <section className="settings-card account-card">
                <h3>账户</h3>
                <form className="mini-form account-settings-form" onSubmit={addAccount}><input aria-label="账户名称" placeholder="银行名称" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} required /><input aria-label="银行卡尾号" placeholder="尾号" value={newAccountTail} onChange={(e) => setNewAccountTail(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8} /><input aria-label="开始记账时的人民币余额" type="number" min="0" step="0.01" placeholder="起始余额" value={newAccountBalance} onChange={(e) => setNewAccountBalance(e.target.value)} /><button type="submit">新增</button></form>
                <div className="chip-list">{normalizedAccounts.map((item) => <button className={item.active ? "chip active-chip" : "chip"} key={item.id} aria-pressed={item.active} title={item.active ? "使用中，点击停用" : "已停用，点击启用"} onClick={() => setAccounts(normalizedAccounts.map((account) => account.id === item.id ? { ...account, active: !account.active } : account))}>{accountLabel(item)}{item.active ? "" : " · 已停用"}</button>)}</div>
              </section>
              <section className="settings-card category-card">
                <div className="category-title"><h3>收支分类</h3><div className="category-switch" aria-label="收支分类类型">{(["收入", "支出"] as FlowType[]).map((type) => <button type="button" key={type} className={newCategoryType === type ? "active" : ""} aria-pressed={newCategoryType === type} onClick={() => setNewCategoryType(type)}>{type}</button>)}</div></div>
                <form className="mini-form category-form" onSubmit={addCategory}><input aria-label="分类名称" placeholder={`新增${newCategoryType}分类`} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required /><button type="submit">新增</button></form>
                <div className="chip-list category-chip-list">{categories.filter((item) => item.type === newCategoryType).map((item) => <span className="category-chip-wrap" key={item.id}><button type="button" className={item.active ? `chip ${newCategoryType === "收入" ? "income-chip" : "expense-chip"}` : "chip"} onClick={() => setCategories(categories.map((categoryItem) => categoryItem.id === item.id ? { ...categoryItem, active: !categoryItem.active } : categoryItem))}>{item.name}</button><button type="button" className="category-delete" aria-label={`删除分类${item.name}`} title="删除分类" onClick={() => deleteCategory(item)}>×</button></span>)}</div>
              </section>
          </div>
          <section className="settings-card backup-card"><h3>本机备份</h3><p>{syncStatus === "browser-only" ? <>线上地址仅保存当前浏览器；跨浏览器请打开 <strong>http://localhost:3000</strong>。</> : <><strong>{syncLabel}</strong> · 跨浏览器统一打开 <strong>http://localhost:3000</strong>。</>} CSV 完整导出，JSON 可恢复。</p><div><button onClick={exportFullCsv}>导出完整 CSV</button><button className="soft-button" onClick={exportJson}>备份 JSON</button><button className="soft-button" onClick={() => fileRef.current?.click()}>恢复 JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} /></div></section>
        </div></div>}
      </section>
    </div>
    {undoItem && <div className="undo-toast" role="status"><span>已删除 1 条记录</span><button onClick={undoDelete}>撤销</button><button aria-label="关闭" onClick={() => setUndoItem(null)}>×</button></div>}
  </main>;
}
