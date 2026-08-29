"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type EntryType = "收入" | "支出" | "定投";
type Entry = { id: number; date: string; type: EntryType; category: string; account: string; amount: number; note: string };
type Account = { name: string; tail: string; balance: number; tone: string };

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const today = new Date().toISOString().slice(0, 10);
const starterAccounts: Account[] = [
  { name: "工商银行", tail: "7956", balance: 0, tone: "coral" },
  { name: "招商银行", tail: "8259", balance: 0, tone: "violet" },
  { name: "中国银行", tail: "4827", balance: 0, tone: "mint" },
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
    if (raw) try { setValue(JSON.parse(raw)); } catch { /* keep defaults */ }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(value)); }, [key, ready, value]);
  return [value, setValue] as const;
}

export default function Home() {
  const [accounts, setAccounts] = useStoredState<Account[]>("money-garden-accounts", starterAccounts);
  const [entries, setEntries] = useStoredState<Entry[]>("money-garden-entries", []);
  const [necessary, setNecessary] = useStoredState("money-garden-necessary", 2500);
  const [targetMonths, setTargetMonths] = useStoredState("money-garden-target", 6);
  const [streak, setStreak] = useStoredState("money-garden-streak", 0);
  const [lastCheck, setLastCheck] = useStoredState("money-garden-check", "");
  const [entryType, setEntryType] = useState<EntryType>("支出");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories.支出[0]);
  const [account, setAccount] = useState("工商银行 · 7956");
  const [note, setNote] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [dark, setDark] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("money-garden-theme");
    const next = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }, []);
  useEffect(() => {
    const onScroll = () => setScrollProgress(window.scrollY / Math.max(document.body.scrollHeight - innerHeight, 1));
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver((items) => items.forEach((item) => item.isIntersecting && item.target.classList.add("in-view")), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

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
  const maxSpend = Math.max(...spending.map(([, value]) => value), 1);

  function burst() { setCelebrate(true); window.setTimeout(() => setCelebrate(false), 1200); }
  function chooseType(type: EntryType) { setEntryType(type); setCategory(categories[type][0]); }
  function addEntry(event: FormEvent) {
    event.preventDefault(); const value = Number(amount); if (!value || value <= 0) return;
    setEntries([{ id: Date.now(), date: today, type: entryType, category, account, amount: value, note }, ...entries]);
    setAmount(""); setNote(""); burst();
  }
  function checkIn() {
    if (lastCheck === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    setStreak(lastCheck === yesterday ? streak + 1 : 1); setLastCheck(today); burst();
  }
  function toggleTheme() {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("money-garden-theme", next ? "dark" : "light");
  }
  function exportCsv() {
    const rows = [["日期", "类型", "分类", "账户", "金额", "备注"], ...entries.map((e) => [e.date, e.type, e.category, e.account, String(e.amount), e.note])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `钱途花园-${month}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <>
    <div className="grain" aria-hidden="true" />
    <div className="scroll-progress" aria-hidden="true"><i style={{ transform: `scaleX(${scrollProgress})` }} /></div>
    {celebrate && <div className="confetti" aria-hidden="true">✦ ● ✿ ▲ ● ✦</div>}

    <header className="nav">
      <a className="nav-logo" href="#top"><span className="live-dot" />钱途花园 <em>/ Money Garden</em></a>
      <nav className="nav-links"><a href="#assets">资产</a><a href="#ledger">流水</a><a href="#plan">计划</a></nav>
      <div className="nav-actions">
        <button className="theme" onClick={toggleTheme} aria-label="切换深浅色"><span /></button>
        <button className="pill-button" onClick={checkIn} disabled={lastCheck === today}>{lastCheck === today ? "今日已浇水 ✓" : "今日浇水 +1"}</button>
      </div>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner">
          <div className="status-chip reveal"><span />实习期 · 个人资产练习中 · Lv.{level}</div>
          <h1 className="hero-title">
            <span className="title-line"><span>把每一笔钱</span></span>
            <span className="title-line"><span>种成<em>未来。</em></span></span>
          </h1>
          <p className="hero-sub reveal">不要求完美记账，只需要比昨天更懂自己的钱。</p>
          <div className="hero-actions reveal"><a className="button solid" href="#ledger">记一笔 →</a><a className="button ghost" href="#plan">看我的定投计划</a></div>
          <div className="stickers" aria-hidden="true"><span className="sticker one">🌱 连续 {streak} 天</span><span className="sticker two">💰 本月结余 {money.format(surplus)}</span><span className="sticker three">✨ 定投不靠意志力</span></div>
        </div>
        <div className="marquee" aria-hidden="true">{[0, 1].map((copy) => <div className="marquee-track" key={copy}><span>先储蓄</span><b>✳</b><span>再消费</span><b>✳</b><span>留足安全垫</span><b>✳</b><span>长期定投</span><b>✳</b><span>不追热点</span><b>✳</b><span>每月复盘</span><b>✳</b></div>)}</div>
        <div className="scroll-cue"><span />向下看花园</div>
      </section>

      <section className="section" id="assets">
        <div className="wrap">
          <p className="eyebrow reveal">01 — MY MONEY MAP</p>
          <h2 className="section-title reveal">先看清自己的钱，<br />再决定让它去<span className="mark">哪里。</span></h2>
          <div className="bento">
            <article className="bento-card summary-card reveal">
              <span className="card-tag">This month</span><p>本月投前结余</p><strong>{money.format(surplus)}</strong>
              <div className="summary-row"><span>收入 <b>{money.format(income)}</b></span><span>支出 <b>{money.format(expense)}</b></span><span>定投 <b>{money.format(invested)}</b></span></div>
            </article>
            <article className="bento-card growth-card reveal">
              <span className="card-tag">Safety garden</span><div className="growth-top"><div><p>备用金生长进度</p><strong>{Math.round(emergencyProgress * 100)}%</strong></div><span className="plant-emoji" style={{ transform: `scale(${.72 + emergencyProgress * .38})` }}>🌿</span></div>
              <div className="meter"><i style={{ width: `${emergencyProgress * 100}%` }} /></div><small>{money.format(balance)} / {money.format(emergencyTarget)}</small>
            </article>
            <article className="bento-card action-card reveal"><span className="card-tag">Next move</span><p>建议当月定投</p><strong>{money.format(suggestedInvest)}</strong><p className="muted">{emergencyProgress >= 1 ? "安全垫达标，可以稳定加码。" : "先用结余的 20% 建立习惯。"}</p><a href="#plan">打开行动卡 →</a></article>
            <article className="bento-card quote-card reveal"><span className="card-tag">A tiny promise</span><p>“工资到账先分配，<em>不是月底剩多少才存多少。</em>”</p><span className="blob" /></article>
          </div>

          <div className="section-heading reveal"><div><p className="eyebrow">BANK ACCOUNTS</p><h3>三个账户，一眼看懂</h3></div><strong>合计 {money.format(balance)}</strong></div>
          <div className="account-grid">
            {accounts.map((item, index) => <article className={`account-card ${item.tone} reveal`} key={item.tail}><div className="account-head"><span>0{index + 1}</span><i>•• {item.tail}</i></div><h3>{item.name}</h3><label>当前余额<div><span>¥</span><input aria-label={`${item.name}余额`} type="number" value={item.balance || ""} placeholder="0" onChange={(event) => setAccounts(accounts.map((a, i) => i === index ? { ...a, balance: Number(event.target.value) } : a))} /></div></label></article>)}
          </div>

          <div className="insight-grid">
            <article className="insight reveal"><div className="section-heading compact"><div><p className="eyebrow">SPENDING SIGNAL</p><h3>钱花去哪儿了</h3></div></div>{spending.length ? <div className="bars">{spending.map(([name, value]) => <div className="bar" key={name}><span>{name}</span><i><b style={{ width: `${(value / maxSpend) * 100}%` }} /></i><strong>{money.format(value)}</strong></div>)}</div> : <div className="empty">记一笔支出，就会长出图表。<span>✿</span></div>}</article>
            <article className="insight quest-card reveal"><span className="card-tag">Tiny quests</span><h3>本月三件小事</h3>{[[balance > 0, "填完三个账户余额", "看清今天的位置"], [entries.length >= 3, "记满 3 笔流水", `${Math.min(entries.length, 3)} / 3`], [invested > 0, "完成第一笔定投", "金额不必大，先开始"]].map(([done, title, desc]) => <div className={`quest ${done ? "done" : ""}`} key={String(title)}><span>{done ? "✓" : "○"}</span><div><b>{title}</b><small>{desc}</small></div></div>)}</article>
          </div>
        </div>
      </section>

      <section className="section alternate" id="ledger">
        <div className="wrap">
          <p className="eyebrow reveal">02 — DAILY DROPS</p>
          <h2 className="section-title reveal">每一笔都算数，<br />但记账不必<span className="mark mint-mark">痛苦。</span></h2>
          <div className="ledger-grid">
            <form className="entry-form reveal" onSubmit={addEntry}>
              <div className="type-tabs">{(["收入", "支出", "定投"] as EntryType[]).map((type) => <button type="button" className={entryType === type ? "active" : ""} onClick={() => chooseType(type)} key={type}>{type}</button>)}</div>
              <label>金额<div className="money-input"><span>¥</span><input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></label>
              <div className="form-row"><label>分类<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories[entryType].map((item) => <option key={item}>{item}</option>)}</select></label><label>账户<select value={account} onChange={(event) => setAccount(event.target.value)}>{accounts.map((item) => <option key={item.tail}>{item.name} · {item.tail}</option>)}</select></label></div>
              <label>备注（可选）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：和同事吃面" /></label>
              <button className="submit" type="submit">种下一笔记录 <span>＋</span></button>
            </form>
            <article className="history reveal"><div className="history-head"><div><span className="card-tag">Recent</span><h3>最近流水</h3></div><button onClick={exportCsv}>导出 CSV ↗</button></div>
              {entries.length ? entries.slice(0, 8).map((item) => <div className="history-row" key={item.id}><span className={`entry-icon ${item.type}`}>{item.type === "收入" ? "+" : item.type === "支出" ? "−" : "↗"}</span><div><b>{item.category}</b><small>{item.date} · {item.account}{item.note ? ` · ${item.note}` : ""}</small></div><strong>{item.type === "收入" ? "+" : "−"}{money.format(item.amount)}</strong><button aria-label="删除这条记录" onClick={() => setEntries(entries.filter((entry) => entry.id !== item.id))}>×</button></div>) : <div className="empty tall">第一笔记录，会是花园的第一颗种子。<span>✿</span></div>}
            </article>
          </div>
        </div>
      </section>

      <section className="statement wrap reveal"><p>先攒下让自己<span>不慌的钱，</span>再用不影响生活的钱<span>长期定投。</span>慢一点没关系，真正重要的是<span>一直在场。</span></p></section>

      <section className="section" id="plan">
        <div className="wrap">
          <p className="eyebrow reveal">03 — SLOW & STEADY</p>
          <h2 className="section-title reveal">一份适合实习期的，<br /><span className="mark violet-mark">不费力</span>定投计划。</h2>
          <div className="plan-grid">
            <article className="plan-card safety-card reveal"><span className="card-tag">Priority 01</span><h3>先把安全垫铺软</h3><div className="month-number">{targetMonths}<small>个月</small></div><input aria-label="备用金目标月数" type="range" min="3" max="12" value={targetMonths} onChange={(event) => setTargetMonths(Number(event.target.value))} /><div className="range-label"><span>3 个月</span><span>12 个月</span></div><label>预计每月必要支出<div className="inline-money"><span>¥</span><input type="number" min="0" value={necessary || ""} onChange={(event) => setNecessary(Number(event.target.value))} /></div></label><p>目标备用金 <strong>{money.format(emergencyTarget)}</strong></p></article>
            <article className="plan-card allocation-card reveal"><span className="card-tag">Recipe</span><h3>每 100 元怎么种</h3>{[["核心宽基", 50, "coral"], ["红利 / 价值", 20, "violet"], ["债券 / 货币", 20, "mint"], ["机会储备", 10, "butter"]].map(([name, pct, tone]) => <div className="allocation-row" key={String(name)}><i className={String(tone)} /><span>{name}</span><b>{pct}%</b></div>)}<p>这是组合功能参考，不是具体基金推荐。选基金时再比较指数、费率和跟踪误差。</p></article>
            <article className="plan-card rules-card reveal"><span className="card-tag">My rules</span><h3>四条纪律，比预测行情更有用。</h3><ol><li><span>01</span>工资到账后执行，不靠月底意志力</li><li><span>02</span>结余 ≤ 0 或需要动用备用金时暂停</li><li><span>03</span>只按月复盘，不因几天涨跌改计划</li><li><span>04</span>不借款、不透支、不追热点定投</li></ol></article>
          </div>
        </div>
      </section>

      <section className="closing wrap reveal"><p>YOUR MONEY, YOUR PACE</p><h2>今天也给未来的自己，<em>浇点水。</em></h2><p>先填账户余额，再记下今天的一笔。你的数据只保存在这台设备。</p><a className="button light" href="#top">回到顶部 ↑</a><span className="closing-glow" /></section>
    </main>
    <footer><span>钱途花园 · 实习期个人版</span><span>慢慢来，比较快。</span></footer>
  </>;
}
