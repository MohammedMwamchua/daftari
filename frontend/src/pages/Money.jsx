import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData } from '@tanstack/react-query';
import { CheckCircle, Lock, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useDay, useDayPay, useDayReport, useErr, useExpenses, useMeta, useReport, useSalary } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { num, parseISO, signed, sum, tsh } from '../format.js';
import { PAID_FROM, ROLES, SECTIONS } from '../vocab.js';
import { Avatar, Btn, Callout, Chip, CountUp, Empty, Leader, Modal, Page, PageSkeleton, Rise, Seg, SelectField, StatusChip, Tabs, TextField } from '../components/ui.jsx';
import { BarsChart, CatBars, Donut } from '../components/charts.jsx';
import { DownloadButtons, ExpenseForm } from '../components/forms.jsx';

const diffCell = (n) => (n === 0 ? <span>0</span> : <span className={n < 0 ? 'bad' : 'good'}>{signed(n)}</span>);
const byCategory = (list, lang) => Object.values(list.reduce((a, e) => { (a[e.category] ||= { key: e.category, name: lang === 'sw' ? e.category_sw : e.category_en, amount: 0 }).amount += e.amount; return a; }, {})).sort((a, b) => b.amount - a.amount);
const toTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

function MonthPick({ ym, setYm }) {
  const { t, monthName } = useI();
  const months = useMeta().data.months;
  return (
    <label className="field" style={{ minWidth: 190 }}>
      <span className="field-label">{t('Mwezi', 'Month')}</span>
      <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label={t('Mwezi', 'Month')}>
        {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
      </select>
    </label>
  );
}

/* ?day=YYYY-MM-DD narrows every tab to that one day; without it every tab shows the whole month. */
export default function Money() {
  const { t, longDate } = useI();
  const meta = useMeta().data;
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'sales';
  const asked = sp.get('day');
  const first = `${meta.months[meta.months.length - 1]}-01`;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked >= first && asked <= meta.today ? asked : null;
  const [ym, setYm] = useState((day || meta.today).slice(0, 7));
  const go = (nextTab, nextDay) => setSp({ ...(nextTab !== 'sales' ? { tab: nextTab } : {}), ...(nextDay ? { day: nextDay } : {}) });
  const setTab = (v) => go(v, day);
  const pickMonth = (m) => { setYm(m); go(tab, null); };
  const pickDay = (d) => { setYm(d.slice(0, 7)); go(tab, d); };
  const wholeMonth = () => go(tab, null);

  return (
    <Page>
      <header className="page-head">
        <div><p className="muted">{t('Pesa za biashara', 'Business money')}</p><h1>{t('Fedha', 'Money')}</h1></div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <MonthPick ym={ym} setYm={pickMonth} />
          <div style={{ minWidth: 180 }}>
            <TextField type="date" label={t('Siku moja', 'One day')} value={day || ''} min={first} max={meta.today}
              onChange={(v) => { if (v && v >= first && v <= meta.today) pickDay(v); }} />
          </div>
        </div>
      </header>
      <Tabs label={t('Fedha', 'Money')} value={tab} onChange={setTab}
        items={[['sales', t('Mauzo', 'Sales')], ['expenses', t('Matumizi', 'Expenses')], ['salaries', t('Mishahara', 'Salaries')], ['reports', t('Ripoti', 'Reports')]]} />
      {day ? (
        <div style={{ marginBottom: 20 }}>
          <Callout tone="info">
            {t('Unaangalia siku moja tu:', 'Showing one day only:')} <strong>{longDate(day, parseISO(day).getDay())}</strong>.{' '}
            <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={wholeMonth}>{t('Ona mwezi mzima', 'See the whole month')}</button>
          </Callout>
        </div>
      ) : null}
      {tab === 'sales' ? <SalesTab ym={ym} day={day} pickDay={pickDay} />
        : tab === 'expenses' ? (day ? <DayExpenses date={day} /> : <ExpensesTab ym={ym} />)
          : tab === 'salaries' ? (day ? <DaySalaries date={day} wholeMonth={wholeMonth} /> : <SalariesTab ym={ym} />)
            : (day ? <DayReport date={day} /> : <ReportsTab ym={ym} />)}
    </Page>
  );
}

/* ------------------------------------------------------------ sales */
/* The chosen day on top (if any), then the totals of every day in the month as a separate part. */
function SalesTab({ ym, day, pickDay }) {
  const { t, fmtDate, dayName, dayShort, monthName } = useI();
  const { data: r } = useReport(ym);
  if (!r) return <PageSkeleton />;
  const show = (d) => { pickDay(d); toTop(); };
  const asc = [...r.days].reverse();
  const bars = asc.map((d) => ({ value: d.total, label: d.date.slice(8), hot: r.best && d.date === r.best.date, tip: `${dayName(d.dow)} ${fmtDate(d.date)}` }));
  const share = r.total ? Math.round((r.banda / r.total) * 100) : 0;

  return (
    <>
      {day ? <DayPanel date={day} /> : null}

      <section className="month-totals">
        <div className="sec-head">
          <div><p className="muted">{t('Jumla ya siku zote', 'Total of all days')}</p><h2 style={{ fontSize: '1.7rem' }}>{monthName(ym)}</h2></div>
          <DownloadButtons kind="month" id={ym} />
        </div>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="kpi accent"><small>{t('Jumla ya mauzo', 'Total sales')}</small><b><span className="cur">TSh</span><CountUp value={r.total} /></b></div>
          <div className="kpi"><small>{t('Pesa taslimu', 'Cash')}</small><b>{tsh(r.cash)}</b></div>
          <div className="kpi"><small>{t('Pesa za simu', 'Mobile money')}</small><b>{tsh(r.mobile)}</b></div>
          <div className="kpi"><small>{t('Jumla ya matumizi', 'Total expenses')}</small><b>{tsh(r.expenses_total)}</b></div>
          <div className="kpi"><small>{t('Wastani wa mauzo kwa siku', 'Average sales per day')}</small><b>{tsh(r.average)}</b></div>
          <div className="kpi gold"><small>{t('Siku bora', 'Best day')}</small><b>{r.best ? fmtDate(r.best.date) : '—'}</b><small>{r.best ? tsh(r.best.total) : ''}</small></div>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', marginBottom: 22 }}>
          <Rise className="panel">
            <div className="panel-head"><h2>{t('Taslimu na simu', 'Cash and mobile')}</h2></div>
            <div className="donut-wrap">
              <Donut parts={[{ v: r.cash, color: 'var(--brass-500)' }, { v: r.mobile, color: 'var(--emerald-600)' }]}>
                <b>{r.total ? Math.round((r.cash / r.total) * 100) : 0}%</b><small>{t('taslimu', 'cash')}</small>
              </Donut>
              <div className="stack" style={{ gap: 8, fontSize: '0.92rem' }}>
                <span><i className="dot-key" style={{ background: 'var(--brass-500)' }} /> {t('Taslimu', 'Cash')}</span>
                <span><i className="dot-key" style={{ background: 'var(--emerald-600)' }} /> {t('Simu', 'Mobile')}</span>
                <hr className="divider" style={{ margin: '4px 0' }} />
                <span>{t('Banda', 'Stall')}: <b>{share}%</b></span>
                <span>{t('Mgahawa', 'Restaurant')}: <b>{100 - share}%</b></span>
              </div>
            </div>
          </Rise>
          <Rise className="panel" delay={0.06}>
            <div className="panel-head"><h2>{t('Mauzo kwa siku', 'Sales by day')}</h2><span className="muted">{monthName(ym)}</span></div>
            {bars.length ? <BarsChart bars={bars} dense height={200} label={t('Mauzo kwa siku', 'Sales by day')} /> : <Empty>{t('Hakuna mauzo mwezi huu.', 'No sales this month.')}</Empty>}
          </Rise>
        </div>

        <div className="sec-head"><div><h2>{t('Kila siku', 'Every day')}</h2><p className="muted">{t('Bonyeza tarehe kuona kila kitu cha siku hiyo.', 'Click a date to see everything for that day.')}</p></div></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('Tarehe', 'Date')}</th><th>{t('Banda', 'Stall')}</th><th>{t('Mgahawa', 'Restaurant')}</th><th>{t('Mauzo', 'Sales')}</th><th>{t('Matumizi', 'Expenses')}</th><th>{t('Tofauti', 'Diff.')}</th></tr></thead>
            <tbody>
              {r.days.map((d) => (
                <tr key={d.date} className={d.date === day ? 'sel' : undefined} aria-current={d.date === day ? 'date' : undefined}>
                  <td><button type="button" className="linkcell" onClick={() => show(d.date)}>{dayShort(d.dow)} {fmtDate(d.date)}</button></td>
                  <td>{num(d.banda.cash + d.banda.mobile)}</td><td>{num(d.mgahawa.cash + d.mgahawa.mobile)}</td><td><b>{num(d.total)}</b></td>
                  <td>{d.expenses ? num(d.expenses) : '0'}</td>
                  <td>{d.closed ? diffCell(d.diff) : <Chip tone="warn">{t('Haijafungwa', 'Open')}</Chip>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td>{num(r.banda)}</td><td>{num(r.mgahawa)}</td><td>{num(r.total)}</td><td>{num(r.expenses_total)}</td><td>{diffCell(r.diff_total)}</td></tr></tfoot>
          </table>
        </div>
      </section>
    </>
  );
}

function DayPanel({ date }) {
  const { t, p, fmtDate, longDate } = useI();
  const q = useDay(date, { placeholderData: keepPreviousData });
  const d = q.data;
  if (!d) return <PageSkeleton />;
  const left = d.sales_total - d.expenses_total;
  return (
    <section id="siku-moja" className="day-panel" style={{ opacity: q.isPlaceholderData ? 0.55 : 1 }}>
      <div className="sec-head">
        <div>
          <p className="muted">{t('Siku moja', 'One day')}</p>
          <h2 style={{ fontSize: '1.7rem' }}>{longDate(d.date, d.dow)}</h2>
          <div className="chips" style={{ marginTop: 8 }}>{d.closed ? <Chip tone="good"><Lock size={12} weight="bold" />{t('Imefungwa', 'Closed')}</Chip> : <Chip tone="warn">{t('Haijafungwa', 'Open')}</Chip>}</div>
        </div>
        <DownloadButtons kind="day" id={d.date} />
      </div>

      <div className="kpis">
        <div className="kpi accent"><small>{t('Mauzo', 'Sales')}</small><b>{tsh(d.sales_total)}</b></div>
        <div className="kpi"><small>{t('Matumizi', 'Expenses')}</small><b>{tsh(d.expenses_total)}</b></div>
        <div className="kpi"><small>{t('Mauzo baada ya matumizi', 'Sales after expenses')}</small><b style={{ color: left < 0 ? 'var(--bad)' : undefined }}>{left < 0 ? `− ${tsh(-left)}` : tsh(left)}</b></div>
        <div className="kpi"><small>{t('Tofauti ya pesa', 'Cash difference')}</small><b style={{ color: d.difference_total < 0 ? 'var(--bad)' : undefined }}>{d.has_count ? (d.difference_total === 0 ? tsh(0) : signed(d.difference_total)) : '—'}</b></div>
      </div>

      <div className="tbl-wrap" style={{ marginBottom: 22 }}>
        <table className="tbl">
          <thead><tr><th>{t('Sehemu', 'Section')}</th><th>{t('Pesa taslimu', 'Cash')}</th><th>{t('Pesa za simu', 'Mobile money')}</th><th>{t('Jumla', 'Total')}</th><th>{t('Tofauti', 'Diff.')}</th></tr></thead>
          <tbody>{['banda', 'mgahawa'].map((s) => { const x = d.sections[s]; return <tr key={s}><td>{p(SECTIONS[s])}</td><td>{num(x.cash)}</td><td>{num(x.mobile)}</td><td><b>{num(x.cash + x.mobile)}</b></td><td>{x.difference == null ? '—' : diffCell(x.difference)}</td></tr>; })}</tbody>
          <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td>{num(d.cash_total)}</td><td>{num(d.mobile_total)}</td><td>{num(d.sales_total)}</td><td>{d.has_count ? diffCell(d.difference_total) : '—'}</td></tr></tfoot>
        </table>
      </div>

      <div className="two" style={{ marginTop: 0 }}>
        <section>
          <h3 style={{ marginBottom: 10 }}>{t('Matumizi ya siku', "The day's expenses")}</h3>
          {d.expenses.length === 0 ? <Empty>{t('Hakuna matumizi siku hii.', 'No expenses this day.')}</Empty> : (
            <ul className="list">{d.expenses.map((e) => <li key={e.id}><Chip>{t(e.category_sw, e.category_en)}</Chip><span className="li-main"><strong>{e.reason}</strong><span>{p(PAID_FROM[e.paid_from])}{e.section ? ` · ${p(SECTIONS[e.section])}` : ''}</span></span><span className="li-amt">{tsh(e.amount)}</span></li>)}</ul>
          )}
          {d.shortages.length || d.advances.length ? (
            <>
              <h3 style={{ margin: '22px 0 10px' }}>{t('Upungufu na advansi', 'Shortages and advances')}</h3>
              <ul className="list">
                {d.shortages.map((x) => (
                  <li key={`s${x.id}`}>
                    <Chip tone={x.status === 'waived' ? 'neutral' : 'bad'}>{x.status === 'waived' ? t('Imesamehewa', 'Waived') : t('Upungufu', 'Shortage')}</Chip>
                    <span className="li-main"><strong>{x.worker_name}</strong><span>{x.section ? p(SECTIONS[x.section]) : ''}{x.reason ? `${x.section ? ' · ' : ''}${x.reason}` : ''}</span></span>
                    <span className="li-amt" style={x.status === 'waived' ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{tsh(x.amount)}</span>
                  </li>
                ))}
                {d.advances.map((a) => (
                  <li key={`a${a.id}`}>
                    <Chip tone="info">{t('Advansi', 'Advance')}</Chip>
                    <span className="li-main"><strong>{a.worker_name}</strong><span>{fmtDate(d.date)}</span></span>
                    <span className="li-amt">{tsh(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section>
          <h3 style={{ marginBottom: 10 }}>{t('Wafanyakazi siku hii', 'Workers this day')}</h3>
          {d.attendance.length === 0 ? <Empty>{t('Hakuna mfanyakazi siku hii.', 'No workers this day.')}</Empty> : (
            <ul className="list">
              {d.attendance.map((w) => (
                <li key={w.worker_id}>
                  <Avatar name={w.name} />
                  <Link to={`/wafanyakazi/${w.worker_id}`} className="li-main" style={{ textDecoration: 'none' }}><strong>{w.name}</strong><span>{p(ROLES[w.role])}</span></Link>
                  <StatusChip k={w.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ one day: expenses, salaries, report */
function DayExpenses({ date }) {
  const { t, p, lang } = useI();
  const { data: d, isPlaceholderData } = useDay(date, { placeholderData: keepPreviousData });
  const act = useActions();
  const fail = useErr();
  if (!d) return <PageSkeleton />;
  const till = sum(d.expenses.filter((e) => e.paid_from === 'droo'), (e) => e.amount);
  const cats = byCategory(d.expenses, lang);
  return (
    <div style={{ opacity: isPlaceholderData ? 0.55 : 1 }}>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Matumizi ya siku', "The day's expenses")}</small><b>{tsh(d.expenses_total)}</b></div>
        <div className="kpi"><small>{t('Idadi', 'Entries')}</small><b>{d.expenses.length}</b></div>
        <div className="kpi"><small>{t('Yaliyotoka droo', 'Paid from a till')}</small><b>{tsh(till)}</b></div>
      </div>
      <div className="two" style={{ marginTop: 0 }}>
        <div className="stack">
          <section className="panel"><div className="panel-head"><h2>{t('Kwa kundi', 'By category')}</h2></div>{cats.length ? <CatBars rows={cats} /> : <Empty>{t('Hakuna matumizi siku hii.', 'No expenses this day.')}</Empty>}</section>
          {d.closed ? <Callout tone="info">{t('Siku hii imefungwa, kwa hiyo matumizi yake hayabadilishwi.', 'This day is closed, so its expenses cannot change.')}</Callout>
            : <section className="panel"><div className="panel-head"><h2>{t('Ongeza matumizi ya siku hii', 'Add an expense for this day')}</h2></div><ExpenseForm date={date} /></section>}
        </div>
        <section>
          <div className="sec-head"><h2>{t('Matumizi ya siku hii', 'Expenses this day')}</h2></div>
          {d.expenses.length === 0 ? <Empty>{t('Hakuna matumizi siku hii.', 'No expenses this day.')}</Empty> : (
            <ul className="list">
              {d.expenses.map((e) => (
                <li key={e.id}>
                  <Chip>{t(e.category_sw, e.category_en)}</Chip>
                  <span className="li-main"><strong>{e.reason}</strong><span>{p(PAID_FROM[e.paid_from])}{e.section ? ` · ${p(SECTIONS[e.section])}` : ''}</span></span>
                  <span className="li-amt">{tsh(e.amount)}</span>
                  {!d.closed ? <button type="button" className="icon-plain" aria-label={t('Futa', 'Delete')} onClick={() => act.delExpense(e.id).catch(fail)}><Trash size={18} weight="duotone" /></button> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function DaySalaries({ date, wholeMonth }) {
  const { t, p } = useI();
  const { data: s, isPlaceholderData } = useDayPay(date);
  if (!s) return <PageSkeleton />;
  const worked = s.lines.filter((l) => ['present', 'late'].includes(l.status)).length;
  return (
    <div style={{ opacity: isPlaceholderData ? 0.55 : 1 }}>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Mishahara ya siku', "The day's pay")}</small><b>{tsh(s.total_earned)}</b></div>
        <div className="kpi"><small>{t('Advansi za siku', "The day's advances")}</small><b>{tsh(s.total_advances)}</b></div>
        <div className="kpi"><small>{t('Makato ya upungufu', 'Shortage deductions')}</small><b>{tsh(s.total_shortages)}</b></div>
        <div className="kpi"><small>{t('Walifanya kazi', 'Worked')}</small><b>{worked} / {s.lines.length}</b></div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Callout tone="info">
          {t('Mshahara wa mwezi huhesabiwa kama 1/30 kwa siku, kama makato yanavyohesabiwa. Kuidhinisha na kulipa mishahara ni kwenye orodha ya mwezi mzima.', 'A monthly salary counts as 1/30 per day, the same way deductions are worked out. Approving and paying salaries happens on the whole-month list.')}{' '}
          <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={wholeMonth}>{t('Ona orodha ya mwezi', 'See the month list')}</button>
        </Callout>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t('Mfanyakazi', 'Worker')}</th><th>{t('Hali ya siku', 'That day')}</th><th>{t('Kiwango', 'Rate')}</th><th>{t('Mshahara wa siku', "Day's pay")}</th><th>{t('Advansi', 'Advances')}</th><th>{t('Upungufu', 'Shortages')}</th></tr></thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.worker.id}>
                <td><Link to={`/wafanyakazi/${l.worker.id}?tab=account`} className="linkcell" style={{ textDecoration: 'none' }}>{l.worker.name}</Link><small className="muted" style={{ display: 'block', fontWeight: 400 }}>{p(ROLES[l.worker.role])}</small></td>
                <td><StatusChip k={l.status} /></td>
                <td>{tsh(l.rate)} / {l.pay_type === 'monthly' ? t('mwezi', 'month') : t('siku', 'day')}</td>
                <td><b>{num(l.earned)}</b></td>
                <td>{l.advances ? `− ${num(l.advances)}` : '0'}</td>
                <td>{l.shortages ? <span className="bad">− {num(l.shortages)}</span> : '0'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td /><td /><td>{num(s.total_earned)}</td><td>{s.total_advances ? `− ${num(s.total_advances)}` : '0'}</td><td>{s.total_shortages ? `− ${num(s.total_shortages)}` : '0'}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

/* Profit up to the chosen day: sales and expenses added from the 1st of the month, minus the whole month's salaries. */
function DayReport({ date }) {
  const { t, lang, longDate, fmtDate, fmtRange, dayShort } = useI();
  const { data: r, isPlaceholderData } = useDayReport(date);
  if (!r) return <PageSkeleton />;
  const cats = r.expenses_by_category.map((c) => ({ key: c.key, name: lang === 'sw' ? c.name_sw : c.name_en, amount: c.amount }));
  const good = r.profit >= 0;
  const span = fmtRange(r.from, r.date);
  return (
    <div style={{ opacity: isPlaceholderData ? 0.55 : 1 }}>
      <Rise className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <div><h2>{t('Faida hadi siku hii', 'Profit up to this day')}</h2><p className="muted">{t(`Mauzo na matumizi ya ${span} yamejumlishwa`, `Sales and expenses for ${span} added together`)}</p></div>
          <DownloadButtons kind="day" id={r.date} />
        </div>
        <div className="profit">
          <p className="display amount-lg" style={{ fontSize: 'clamp(2.2rem, 1.5rem + 3vw, 3.4rem)', color: good ? 'var(--good)' : 'var(--bad)' }}><span className="cur">TSh</span>{good ? '' : '−'}<CountUp value={Math.abs(r.profit)} /></p>
          <p className="eq"><span>{tsh(r.total)} {t(`mauzo (${span})`, `sales (${span})`)}</span> − <span>{tsh(r.expenses_total)} {t(`matumizi (${span})`, `expenses (${span})`)}</span> − <span>{tsh(r.salaries_total)} {t('mishahara ya mwezi mzima', "the whole month's salaries")}</span></p>
        </div>
      </Rise>
      <div className="two" style={{ marginTop: 0 }}>
        <Rise className="panel">
          <div className="panel-head"><h2>{t('Mauzo yaliyojumlishwa', 'Sales added up')}</h2><span className="muted">{span}</span></div>
          <div className="ledger flat">
            <Leader label={t('Banda', 'Stall')} value={tsh(r.sales.banda)} />
            <Leader label={t('Mgahawa', 'Restaurant')} value={tsh(r.sales.mgahawa)} />
            <Leader label={t('Pesa taslimu', 'Cash')} value={tsh(r.cash)} />
            <Leader label={t('Pesa za simu', 'Mobile money')} value={tsh(r.mobile)} />
            <Leader strong label={t('Jumla', 'Total')} value={tsh(r.total)} />
          </div>
          <p className="muted" style={{ marginTop: 12 }}>{t(`${longDate(r.date, r.dow)} peke yake: mauzo ${tsh(r.day_sales)}, matumizi ${tsh(r.day_expenses)}`, `${longDate(r.date, r.dow)} on its own: sales ${tsh(r.day_sales)}, expenses ${tsh(r.day_expenses)}`)}</p>
        </Rise>
        <Rise className="panel" delay={0.06}>
          <div className="panel-head"><h2>{t('Matumizi kwa kundi', 'Expenses by category')}</h2><span className="muted">{span}</span></div>
          {cats.length ? <CatBars rows={cats} /> : <Empty>{t('Hakuna matumizi.', 'No expenses.')}</Empty>}
        </Rise>
      </div>
      <div className="sec-head" style={{ marginTop: 28 }}><div><h2>{t('Jinsi yalivyoongezeka', 'How it added up')}</h2><p className="muted">{t('Kila siku inaongezwa kwenye jumla ya siku zilizotangulia.', 'Each day is added to the days before it.')}</p></div></div>
      {r.running.length === 0 ? <Empty>{t('Hakuna mauzo wala matumizi bado mwezi huu.', 'No sales or expenses yet this month.')}</Empty> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('Tarehe', 'Date')}</th><th>{t('Mauzo ya siku', "Day's sales")}</th><th>{t('Matumizi ya siku', "Day's expenses")}</th><th>{t('Mauzo jumla', 'Sales so far')}</th><th>{t('Matumizi jumla', 'Expenses so far')}</th></tr></thead>
            <tbody>
              {r.running.map((x) => (
                <tr key={x.date} className={x.date === r.date ? 'sel' : undefined}>
                  <td>{dayShort(x.dow)} {fmtDate(x.date)}</td><td>{num(x.sales)}</td><td>{num(x.expenses)}</td><td><b>{num(x.sales_to_date)}</b></td><td><b>{num(x.expenses_to_date)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ expenses */
function ExpensesTab({ ym }) {
  const { t, p, lang, fmtDate } = useI();
  const meta = useMeta().data;
  const { data: list } = useExpenses(ym);
  const act = useActions();
  const fail = useErr();
  if (!list) return <PageSkeleton />;
  const total = sum(list, (e) => e.amount);
  const todayTotal = sum(list.filter((e) => e.date === meta.today), (e) => e.amount);
  const cats = byCategory(list, lang);
  return (
    <>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Jumla ya mwezi', 'Month total')}</small><b>{tsh(total)}</b></div>
        <div className="kpi"><small>{t('Leo', 'Today')}</small><b>{tsh(todayTotal)}</b></div>
        <div className="kpi"><small>{t('Idadi', 'Entries')}</small><b>{list.length}</b></div>
      </div>
      <div className="two" style={{ marginTop: 0 }}>
        <div className="stack">
          <section className="panel"><div className="panel-head"><h2>{t('Kwa kundi', 'By category')}</h2></div>{cats.length ? <CatBars rows={cats} /> : <Empty>{t('Hakuna matumizi.', 'No expenses.')}</Empty>}</section>
          <section className="panel"><div className="panel-head"><h2>{t('Ongeza matumizi', 'Add an expense')}</h2></div><ExpenseForm date={meta.today} /></section>
        </div>
        <section>
          <div className="sec-head"><h2>{t('Matumizi ya hivi karibuni', 'Latest expenses')}</h2></div>
          <ul className="list">
            {list.slice(0, 30).map((e) => (
              <li key={e.id}>
                <Chip>{t(e.category_sw, e.category_en)}</Chip>
                <span className="li-main"><strong>{e.reason}</strong><span>{fmtDate(e.date)} · {p(PAID_FROM[e.paid_from])}{e.section ? ` · ${p(SECTIONS[e.section])}` : ''}</span></span>
                <span className="li-amt">{tsh(e.amount)}</span>
                <button type="button" className="icon-plain" aria-label={t('Futa', 'Delete')} onClick={() => act.delExpense(e.id).catch(fail)}><Trash size={18} weight="duotone" /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ salaries */
function SalariesTab({ ym }) {
  const { t, p, fmtDate } = useI();
  const { data: s } = useSalary(ym);
  const act = useActions();
  const fail = useErr();
  const [confirm, setConfirm] = useState(false);
  if (!s) return <PageSkeleton />;
  const locked = s.status === 'approved';
  const kinds = [['permission', t('Ruhusa', 'Permission')], ['holiday', t('Likizo', 'Holiday')], ['dayoff', t('Siku ya mapumziko', 'Day off')]];
  const setRule = (k, field, v) => act.saveSettings({ rules: { ...s.rules, [k]: { ...s.rules[k], [field]: v } } }).catch(fail);
  const yn = (v, on) => <Seg label="" value={v ? 'y' : 'n'} disabled={locked} onChange={(x) => on(x === 'y')} options={[['y', t('Ndiyo', 'Yes')], ['n', t('Hapana', 'No')]]} />;

  return (
    <>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Jumla ya kulipwa', 'Total to pay')}</small><b>{tsh(s.total_net)}</b></div>
        <div className="kpi"><small>{t('Mshahara wa msingi', 'Base pay')}</small><b>{tsh(s.total_base)}</b></div>
        <div className="kpi"><small>{t('Advansi', 'Advances')}</small><b>{tsh(s.total_advances)}</b></div>
        <div className="kpi"><small>{t('Makato ya upungufu', 'Shortage deductions')}</small><b>{tsh(s.total_shortages)}</b></div>
      </div>

      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head"><div><h2>{t('Siku maalum zinahesabiwaje?', 'How do these days count?')}</h2><p className="muted">{locked ? t('Imefungwa baada ya kuidhinisha.', 'Locked after approval.') : t('Weka mara moja kulingana na sera yako.', 'Set once to match your policy.')}</p></div></div>
        <div className="rules">
          <span className="h" /><span className="h">{t('Mshahara wa mwezi: kata?', 'Monthly salary: deduct it?')}</span><span className="h">{t('Malipo ya siku: lipa?', 'Daily pay: pay it?')}</span>
          {kinds.map(([k, label]) => (
            <Row key={k}><strong>{label}</strong>{yn(s.rules[k].cut, (v) => setRule(k, 'cut', v))}{yn(s.rules[k].pay, (v) => setRule(k, 'pay', v))}</Row>
          ))}
        </div>
      </section>

      <div className="sec-head">
        <div className="row"><h2>{t('Orodha ya mishahara', 'Salary list')}</h2>{locked ? <Chip tone="good"><Lock size={12} weight="bold" />{t('Imeidhinishwa', 'Approved')}</Chip> : <Chip tone="warn">{t('Rasimu', 'Draft')}</Chip>}</div>
        {!locked ? <Btn className="btn-primary" onClick={() => setConfirm(true)}><CheckCircle size={18} weight="bold" />{t('Idhinisha orodha ya mishahara', 'Approve the salary list')}</Btn> : null}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t('Mfanyakazi', 'Worker')}</th><th>{t('Msingi', 'Base')}</th><th>{t('Advansi', 'Advances')}</th><th>{t('Upungufu', 'Shortages')}</th><th>{t('Atalipwa', 'Net pay')}</th>{locked ? <th>{t('Malipo', 'Paid')}</th> : null}</tr></thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.worker.id}>
                <td><Link to={`/wafanyakazi/${l.worker.id}?tab=account`} className="linkcell" style={{ textDecoration: 'none' }}>{l.worker.name}</Link>{l.removed ? <> <Chip tone="neutral">{t('Ameondolewa', 'Removed')}</Chip></> : null}</td>
                <td>{num(l.base)}</td><td>{l.advances ? `− ${num(l.advances)}` : '0'}</td><td>{l.shortages ? <span className="bad">− {num(l.shortages)}</span> : '0'}</td><td><b>{num(l.net)}</b></td>
                {locked ? <td>{l.paid ? <Chip tone="good">{t('Amelipwa', 'Paid')}</Chip> : null} <Btn className="btn-quiet btn-small paid-btn" onClick={() => act.markPaid(l.line_id, !l.paid).catch(fail)}>{l.paid ? t('Tengua', 'Undo') : t('Weka amelipwa', 'Mark paid')}</Btn></td> : null}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td>{num(s.total_base)}</td><td>{s.total_advances ? `− ${num(s.total_advances)}` : '0'}</td><td>{s.total_shortages ? `− ${num(s.total_shortages)}` : '0'}</td><td>{num(s.total_net)}</td>{locked ? <td /> : null}</tr></tfoot>
        </table>
      </div>

      <section style={{ marginTop: 28 }}>
        <div className="sec-head"><h2>{t('Makato ya upungufu', 'Shortage deductions')}</h2></div>
        {s.shortages.length === 0 ? <Empty>{t('Hakuna upungufu mwezi huu.', 'No shortages this month.')}</Empty> : (
          <ul className="list">
            {s.shortages.map((x) => (
              <li key={x.id}>
                <Chip tone={x.status === 'waived' ? 'neutral' : 'bad'}>{x.status === 'waived' ? t('Imesamehewa', 'Waived') : t('Imekatwa', 'Deducted')}</Chip>
                <span className="li-main"><strong>{x.worker_name}</strong><span>{fmtDate(x.date)}{x.section ? ` · ${p(SECTIONS[x.section])}` : ''}{x.reason ? ` · ${x.reason}` : ''}</span></span>
                <span className="li-amt" style={x.status === 'waived' ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{tsh(x.amount)}</span>
                {!locked ? <Btn className="btn-quiet btn-small" onClick={() => act.setShortage(x.id, x.status === 'waived' ? 'applied' : 'waived').catch(fail)}>{x.status === 'waived' ? t('Rudisha makato', 'Deduct again') : t('Samehe', 'Waive')}</Btn> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('Idhinisha orodha?', 'Approve the list?')} description={t('Baada ya kuidhinisha, makato na sheria za siku maalum hufungwa na haziwezi kubadilishwa.', 'After approval, deductions and the special-day rules are locked.')}>
        <div className="actions">
          <Btn onClick={() => setConfirm(false)}>{t('Ghairi', 'Cancel')}</Btn>
          <Btn className="btn-primary" onClick={async () => { try { await act.approveSalary(ym); setConfirm(false); toast.success(t('Orodha imeidhinishwa.', 'Salary list approved.')); } catch (e) { fail(e); } }}>{t('Idhinisha', 'Approve')}</Btn>
        </div>
      </Modal>
    </>
  );
}
const Row = ({ children }) => <>{children}</>;

/* ------------------------------------------------------------ reports */
function ReportsTab({ ym }) {
  const { t, lang, fmtDate, dayName, monthName } = useI();
  const meta = useMeta().data;
  const { data: r } = useReport(ym);
  if (!r) return <PageSkeleton />;
  const asc = [...r.days].reverse();
  const bars = asc.map((d) => ({ value: d.total, label: d.date.slice(8), hot: d.date === meta.today, tip: `${dayName(d.dow)} ${fmtDate(d.date)}` }));
  const cats = r.expenses_by_category.map((c) => ({ key: c.key, name: lang === 'sw' ? c.name_sw : c.name_en, amount: c.amount }));
  const good = r.profit >= 0;
  return (
    <>
      {ym === meta.today.slice(0, 7) ? <div style={{ marginBottom: 16 }}><Callout tone="info">{t('Mwezi haujaisha. Mishahara ya mwezi mzima huhesabiwa tangu siku ya kwanza, kwa hiyo faida huonekana ndogo hadi mauzo yafikie.', 'The month is not over. Monthly salaries count in full from day one, so profit looks low until sales catch up.')}</Callout></div> : null}
      <Rise className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head"><div><h2>{t('Faida ya mwezi', 'Profit for the month')}</h2><p className="muted">{monthName(ym)}</p></div><DownloadButtons kind="month" id={ym} /></div>
        <div className="profit">
          <p className="display amount-lg" style={{ fontSize: 'clamp(2.2rem, 1.5rem + 3vw, 3.4rem)', color: good ? 'var(--good)' : 'var(--bad)' }}><span className="cur">TSh</span>{good ? '' : '−'}<CountUp value={Math.abs(r.profit)} /></p>
          <p className="eq"><span>{tsh(r.total)} {t('mauzo', 'sales')}</span> − <span>{tsh(r.expenses_total)} {t('matumizi', 'expenses')}</span> − <span>{tsh(r.salaries_total)} {t('mishahara', 'salaries')}</span></p>
        </div>
      </Rise>
      <div className="two" style={{ marginTop: 0 }}>
        <Rise className="panel"><div className="panel-head"><h2>{t('Mauzo kwa siku', 'Sales by day')}</h2></div>{bars.length ? <BarsChart bars={bars} dense label={t('Mauzo kwa siku. Leo imeangaziwa kwa dhahabu.', 'Sales by day. Today is highlighted in gold.')} /> : <Empty>{t('Hakuna data.', 'No data.')}</Empty>}</Rise>
        <Rise className="panel" delay={0.06}><div className="panel-head"><h2>{t('Matumizi kwa kundi', 'Expenses by category')}</h2></div>{cats.length ? <CatBars rows={cats} /> : <Empty>{t('Hakuna matumizi.', 'No expenses.')}</Empty>}</Rise>
      </div>
    </>
  );
}
