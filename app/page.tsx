"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type EntryType = "收入" | "支出" | "定投";
type Entry = { id: number; date: string; type: EntryType; category: string; account: string; amount: number; note: string };
type Account = { name: string; tail: string; balance: number; color: string };

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const today = new Date().toISOString().slice(0, 10);
const starterAccounts: Account[] = [
  { name: "工商银行", tail: "7956", balance: 0, color: "blue" },
  { name: "招商银行", tail: "8259", balance: 0, color: "red" },
  { name: "中国银行", tail: "4827", balance: 0, color: "green" },
];

const categories: Record<EntryType, string[]> = {
  收入: ["实习工资", "奖金/补贴", "红包/转账", "兼职", "报销", "其他收入"],
  支出: ["住宿", "餐饮", "交通", "学习/考试", "社交", "娱乐", "服饰", "医疗", "其他支出"],
  定投: ["核心宽基", "红利/价值", "债券/货币", "机会储备"],
};

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setValue(JSON.parse(raw)); } catch { /* keep defaults */ }
    }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(value)); }, [key, value, ready]);
  return [value, setValue] as const;
}

export default function Home() {
  const [accounts, setAccounts] = useStoredState<Account[]>("money-garden-accounts", starterAccounts);
  const [entries, setEntries] = useStoredState<Entry[]>("money-garden-entries", []);
  const [necessary, setNecessary] = useStoredState("money-garden-necessary", 2500);
  const [targetMonths, setTargetMonths] = useStoredState("money-garden-target", 6);
  const [streak, setStreak] = useStoredState("money-garden-streak", 0);
  const [lastCheck, setLastCheck] = useStoredState("money-garden-check", "");
  const [tab, setTab] = useState<"花园" | "流水" | "计划">("花园");
  const [entryType, setEntryType] = useState<EntryType>("支出");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories.支出[1]);
  const [account, setAccount] = useState("工商银行 · 7956");
  const [note, setNote] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  const month = today.slice(0, 7);
  const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
  const income = monthEntries.filter((e) => e.type === "收入").reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter((e) => e.type === "支出").reduce((s, e) => s + e.amount, 0);
  const invested = monthEntries.filter((e) => e.type === "定投").reduce((s, e) => s + e.amount, 0);
  const balance = accounts.reduce((s, a) => s + a.balance, 0);
  const emergencyTarget = necessary * targetMonths;
  const emergencyProgress = emergencyTarget ? Math.min(balance / emergencyTarget, 1) : 0;
  const surplus = income - expense;
  const suggestedInvest = Math.max(0, Math.round(surplus * (emergencyProgress >= 1 ? 0.5 : 0.2)));
  const level = Math.max(1, Math.floor((entries.length + streak * 2) / 5) + 1);

  const spending = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.filter((e) => e.type === "支出").forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [monthEntries]);
  const maxSpend = Math.max(...spending.map(([, v]) => v), 1);

  function chooseType(type: EntryType) {
    setEntryType(type);
    setCategory(categories[type][0]);
  }

  function addEntry(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    const newEntry: Entry = { id: Date.now(), date: today, type: entryType, category, account, amount: numericAmount, note };
    setEntries([newEntry, ...entries]);
    setAmount(""); setNote(""); setCelebrate(true);
    window.setTimeout(() => setCelebrate(false), 1200);
  }

  function checkIn() {
    if (lastCheck === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setStreak(lastCheck === yesterday ? streak + 1 : 1);
    setLastCheck(today);
    setCelebrate(true);
    window.setTimeout(() => setCelebrate(false), 1200);
  }

  function exportCsv() {
    const rows = [["日期", "类型", "分类", "账户", "金额", "备注"], ...entries.map((e) => [e.date, e.type, e.category, e.account, String(e.amount), e.note])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `钱途花园-${month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="shell">
      {celebrate && <div className="confetti" aria-hidden="true">✦　●　✿　▲　●　✦</div>}
      <aside className="rail">
        <div className="brand"><span className="brand-mark">芽</span><div><strong>钱途花园</strong><small>Money Garden</small></div></div>
        <div className="rail-copy">
          <p className="eyebrow">实习期 · 个人版</p>
          <h1>今天也给<br />未来的自己<br /><em>浇点水。</em></h1>
          <p>不追求完美记账，只要每个月比上个月更了解自己的钱。</p>
        </div>
        <nav aria-label="主要页面">
          {(["花园", "流水", "计划"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><span>{item === "花园" ? "✿" : item === "流水" ? "↗" : "◎"}</span>{item}</button>)}
        </nav>
        <button className="checkin" onClick={checkIn} disabled={lastCheck === today}>{lastCheck === today ? "今日已打卡 ✓" : "今日打卡 +1"}<small>连续 {streak} 天</small></button>
      </aside>

      <section className="canvas">
        <header className="topbar">
          <div><span className="month-chip">{month.replace("-", " / ")}</span><span className="level-chip">Lv.{level} 理财练习生</span></div>
          <button className="export" onClick={exportCsv}>导出记录 ↗</button>
        </header>

        {tab === "花园" && <>
          <section className="hero-grid reveal">
            <article className="hero-card lime">
              <span className="sticker">本月小结</span>
              <p>投前结余</p><strong>{money.format(surplus)}</strong>
              <div className="mini-row"><span>收入 {money.format(income)}</span><span>支出 {money.format(expense)}</span></div>
              <div className="scribble">先照顾当下，再投资未来。</div>
            </article>
            <article className="garden-card cream">
              <div className="plant" style={{ "--growth": `${Math.round(emergencyProgress * 100)}%` } as React.CSSProperties}>
                <div className="leaf leaf-a" /><div className="leaf leaf-b" /><div className="stem" /><div className="pot">¥</div>
              </div>
              <div><p className="eyebrow">安全垫生长中</p><strong>{Math.round(emergencyProgress * 100)}%</strong><p>备用金 {money.format(balance)} / {money.format(emergencyTarget)}</p></div>
            </article>
            <article className="target-card cobalt">
              <span className="sticker yellow">下次行动</span><p>建议当月定投</p><strong>{money.format(suggestedInvest)}</strong><p>{emergencyProgress >= 1 ? "安全垫达标，可以稳定加码" : "先用较小比例建立习惯"}</p>
              <div className="progress"><i style={{ width: `${suggestedInvest ? Math.min(invested / suggestedInvest, 1) * 100 : 0}%` }} /></div><small>已执行 {money.format(invested)}</small>
            </article>
          </section>

          <section className="section-head reveal"><div><p className="eyebrow">WALLET PATCH</p><h2>三只口袋</h2></div><p>月底更新一次余额就够了。</p></section>
          <section className="account-grid reveal">
            {accounts.map((item, index) => <article className={`bank-card ${item.color}`} key={item.tail}>
              <div className="bank-top"><span>{index + 1}</span><small>•• {item.tail}</small></div><h3>{item.name}</h3><label>当前余额<input aria-label={`${item.name}余额`} type="number" min="0" value={item.balance || ""} placeholder="0" onChange={(e) => setAccounts(accounts.map((a, i) => i === index ? { ...a, balance: Number(e.target.value) } : a))} /></label>
            </article>)}
          </section>

          <section className="lower-grid reveal">
            <article className="panel spend-panel"><div className="panel-title"><div><p className="eyebrow">SPENDING MAP</p><h2>钱都去哪儿了</h2></div><span>{money.format(expense)}</span></div>
              {spending.length ? <div className="bars">{spending.map(([name, value], i) => <div className="bar" key={name}><span>{name}</span><i><b style={{ width: `${(value / maxSpend) * 100}%`, animationDelay: `${i * 90}ms` }} /></i><strong>{money.format(value)}</strong></div>)}</div> : <div className="empty">记下一笔支出，这里就会长出图表。<span>↘</span></div>}
            </article>
            <article className="panel quest-panel"><p className="eyebrow">MINI QUESTS</p><h2>本月三个小任务</h2>
              {[{ done: necessary > 0, text: "写下每月必要支出" }, { done: accounts.some((a) => a.balance > 0), text: "更新银行卡余额" }, { done: invested > 0, text: "完成一次不冲动的定投" }].map((q, i) => <div className={`quest ${q.done ? "done" : ""}`} key={q.text}><span>{q.done ? "✓" : i + 1}</span><p>{q.text}<small>{q.done ? "完成，花园经验 +1" : "轻轻一点点，也算前进"}</small></p></div>)}
            </article>
          </section>
        </>}

        {tab === "流水" && <section className="page-section reveal">
          <div className="section-head"><div><p className="eyebrow">DAILY DROPS</p><h2>一笔一滴，记下来</h2></div><p>银行互转不算收入或支出。</p></div>
          <div className="ledger-layout">
            <form className="entry-form" onSubmit={addEntry}>
              <div className="segmented">{(["收入", "支出", "定投"] as EntryType[]).map((t) => <button type="button" className={entryType === t ? "selected" : ""} onClick={() => chooseType(t)} key={t}>{t}</button>)}</div>
              <label>金额<div className="money-input"><span>¥</span><input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div></label>
              <div className="form-row"><label>分类<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories[entryType].map((c) => <option key={c}>{c}</option>)}</select></label><label>账户<select value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.tail}>{a.name} · {a.tail}</option>)}</select></label></div>
              <label>备注（可选）<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：周五和同事吃面" /></label>
              <button className="primary" type="submit">种下一笔记录 <span>＋</span></button>
            </form>
            <article className="panel history"><div className="panel-title"><div><p className="eyebrow">RECENT</p><h2>最近流水</h2></div><span>{entries.length} 笔</span></div>
              {entries.length ? entries.slice(0, 8).map((e) => <div className="history-row" key={e.id}><span className={`type-dot ${e.type}`}>{e.type === "收入" ? "+" : e.type === "支出" ? "−" : "↗"}</span><div><strong>{e.category}</strong><small>{e.date} · {e.account}{e.note ? ` · ${e.note}` : ""}</small></div><b>{e.type === "收入" ? "+" : "−"}{money.format(e.amount)}</b><button aria-label="删除该记录" onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}>×</button></div>) : <div className="empty tall">第一笔记录，会是花园的第一颗种子。<span>✿</span></div>}
            </article>
          </div>
        </section>}

        {tab === "计划" && <section className="page-section reveal">
          <div className="section-head"><div><p className="eyebrow">SLOW & STEADY</p><h2>不费力的定投计划</h2></div><p>先活得安心，再慢慢变富。</p></div>
          <section className="plan-grid">
            <article className="panel safety"><span className="sticker">第一优先级</span><h2>把安全垫铺软</h2><div className="big-stat">{targetMonths}<small>个月</small></div><input aria-label="备用金目标月数" type="range" min="3" max="12" value={targetMonths} onChange={(e) => setTargetMonths(Number(e.target.value))} /><div className="range-label"><span>3个月</span><span>12个月</span></div><label>预计每月必要支出<div className="money-input small"><span>¥</span><input type="number" min="0" value={necessary || ""} onChange={(e) => setNecessary(Number(e.target.value))} /></div></label><p className="note">你的目标备用金：<strong>{money.format(emergencyTarget)}</strong></p></article>
            <article className="panel allocation"><span className="sticker lavender">参考配方</span><h2>每 100 元怎么种</h2>{[["核心宽基",50,"#2c5cff"],["红利/价值",20,"#ff5d44"],["债券/货币",20,"#83b792"],["机会储备",10,"#f1c84b"]].map(([name, pct, color]) => <div className="allocation-row" key={String(name)}><i style={{ background: String(color) }} /><span>{name}</span><b>{pct}%</b></div>)}<p className="note">这里只定义组合功能。选具体基金前，再比较指数、费率和跟踪误差。</p></article>
            <article className="panel rules"><span className="sticker pink">我的纪律卡</span><h2>四条简单规则</h2><ol><li><span>01</span>工资到账后执行，不靠月底意志力</li><li><span>02</span>结余≤0 或需要动用备用金时暂停</li><li><span>03</span>只按月复盘，不因几天涨跌改计划</li><li><span>04</span>不借款、不透支、不追热点定投</li></ol></article>
          </section>
        </section>}

        <footer><span>钱途花园 · 数据仅保存在当前设备</span><span>慢慢来，比较快。</span></footer>
      </section>
    </main>
  );
}
