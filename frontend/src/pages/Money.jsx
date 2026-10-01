import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CaretLeft, CheckCircle, Lock, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useDay, useErr, useExpenses, useMeta, useReport, useSalary } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { num, signed, sum, tsh } from '../format.js';
import { PAID_FROM, SECTIONS } from '../vocab.js';
import { Btn, Callout, Chip, CountUp, Empty, Modal, Page, PageSkeleton, Rise, Seg, SelectField, Tabs } from '../components/ui.jsx';
import { BarsChart, CatBars, Donut } from '../components/charts.jsx';
import { DownloadButtons, ExpenseForm } from '../components/forms.jsx';

const diffCell = (n) => (n === 0 ? <span>0</span> : <span className={n < 0 ? 'bad' : 'good'}>{signed(n)}</span>);

function MonthPick({ ym, setYm }) {
  const { t, monthName } = useI();
  const months = useMeta().data.months;
  return (
    <label className="field" style={{ minWidth: 200 }}>
      <span className="sr">{t('Mwezi', 'Month')}</span>
      <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label={t('Mwezi', 'Month')}>
        {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
      </select>
    </label>
  );
}

export default function Money() {
  const { t } = useI();
  const meta = useMeta().data;
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'sales';
  const day = sp.get('day');
  const [ym, setYm] = useState(meta.today.slice(0, 7));
  const setTab = (v) => setSp(v === 'sales' ? {} : { tab: v });

  return (
    <Page>
      <header className="page-head">
        <div><p className="muted">{t('Pesa za biashara', 'Business money')}</p><h1>{t('Fedha', 'Money')}</h1></div>
        {!day ? <MonthPick ym={ym} setYm={setYm} /> : null}
      </header>
      <Tabs label={t('Fedha', 'Money')} value={tab} onChange={setTab}
        items={[['sales', t('Mauzo', 'Sales')], ['expenses', t('Matumizi', 'Expenses')], ['salaries', t('Mishahara', 'Salaries')], ['reports', t('Ripoti', 'Reports')]]} />
      {tab === 'sales' ? (day ? <DayView date={day} back={() => setSp({})} /> : <SalesTab ym={ym} open={(d) => setSp({ day: d })} />)
        : tab === 'expenses' ? <ExpensesTab ym={ym} />
          : tab === 'salaries' ? <SalariesTab ym={ym} />
            : <ReportsTab ym={ym} />}
    </Page>
  );
}

/* ------------------------------------------------------------ sales */
function SalesTab({ ym, open }) {
  const { t, p, fmtDate, dayName, dayShort, monthName } = useI();
  const { data: r } = useReport(ym);
  if (!r) return <PageSkeleton />;
  const asc = [...r.days].reverse();
  const bars = asc.map((d) => ({ value: d.total, label: d.date.slice(8), hot: r.best && d.date === r.best.date, tip: `${dayName(d.dow)} ${fmtDate(d.date)}` }));
  const share = r.total ? Math.round((r.banda / r.total) * 100) : 0;

  return (
    <>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Jumla ya mauzo', 'Total sales')}</small><b><span className="cur">TSh</span><CountUp value={r.total} /></b></div>
        <div className="kpi"><small>{t('Pesa taslimu', 'Cash')}</small><b>{tsh(r.cash)}</b></div>
        <div className="kpi"><small>{t('Pesa za simu', 'Mobile money')}</small><b>{tsh(r.mobile)}</b></div>
        <div className="kpi"><small>{t('Wastani kwa siku', 'Average per day')}</small><b>{tsh(r.average)}</b></div>
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

      <div className="sec-head"><h2>{t('Kila siku', 'Every day')}</h2><DownloadButtons kind="month" id={ym} /></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t('Tarehe', 'Date')}</th><th>{t('Banda', 'Stall')}</th><th>{t('Mgahawa', 'Restaurant')}</th><th>{t('Jumla', 'Total')}</th><th>{t('Tofauti', 'Diff.')}</th></tr></thead>
          <tbody>
            {r.days.map((d) => (
              <tr key={d.date}>
                <td><button type="button" className="linkcell" onClick={() => open(d.date)}>{dayShort(d.dow)} {fmtDate(d.date)}</button></td>
                <td>{num(d.banda.cash + d.banda.mobile)}</td><td>{num(d.mgahawa.cash + d.mgahawa.mobile)}</td><td><b>{num(d.total)}</b></td>
                <td>{d.closed ? diffCell(d.diff) : <Chip tone="warn">{t('Haijafungwa', 'Open')}</Chip>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td>{num(r.banda)}</td><td>{num(r.mgahawa)}</td><td>{num(r.total)}</td><td>{diffCell(r.diff_total)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

function DayView({ date, back }) {
  const { t, p, longDate } = useI();
  const { data: d } = useDay(date);
  if (!d) return <PageSkeleton />;
  return (
    <>
      <button type="button" className="backlink" onClick={back} style={{ border: 0, background: 'none' }}><CaretLeft size={16} weight="bold" />{t('Rudi kwenye mwezi', 'Back to the month')}</button>
      <div className="sec-head" style={{ marginTop: 10 }}>
        <div><h2 style={{ fontSize: '1.7rem' }}>{longDate(d.date, d.dow)}</h2><div className="chips" style={{ marginTop: 8 }}>{d.closed ? <Chip tone="good"><Lock size={12} weight="bold" />{t('Imefungwa', 'Closed')}</Chip> : <Chip tone="warn">{t('Haijafungwa', 'Open')}</Chip>}</div></div>
        <DownloadButtons kind="day" id={d.date} />
      </div>
      <div className="kpis">
        <div className="kpi accent"><small>{t('Mauzo', 'Sales')}</small><b>{tsh(d.sales_total)}</b></div>
        <div className="kpi"><small>{t('Matumizi', 'Expenses')}</small><b>{tsh(d.expenses_total)}</b></div>
        <div className="kpi"><small>{t('Tofauti ya pesa', 'Cash difference')}</small><b style={{ color: d.difference_total < 0 ? 'var(--bad)' : undefined }}>{d.has_count ? (d.difference_total === 0 ? tsh(0) : signed(d.difference_total)) : '—'}</b></div>
      </div>
      <div className="tbl-wrap" style={{ marginBottom: 22 }}>
        <table className="tbl">
          <thead><tr><th>{t('Sehemu', 'Section')}</th><th>{t('Pesa taslimu', 'Cash')}</th><th>{t('Pesa za simu', 'Mobile money')}</th><th>{t('Jumla', 'Total')}</th><th>{t('Tofauti', 'Diff.')}</th></tr></thead>
          <tbody>{['banda', 'mgahawa'].map((s) => { const x = d.sections[s]; return <tr key={s}><td>{p(SECTIONS[s])}</td><td>{num(x.cash)}</td><td>{num(x.mobile)}</td><td><b>{num(x.cash + x.mobile)}</b></td><td>{x.difference == null ? '—' : diffCell(x.difference)}</td></tr>; })}</tbody>
          <tfoot><tr><td>{t('JUMLA', 'TOTAL')}</td><td>{num(d.cash_total)}</td><td>{num(d.mobile_total)}</td><td>{num(d.sales_total)}</td><td>{d.has_count ? diffCell(d.difference_total) : '—'}</td></tr></tfoot>
        </table>
      </div>
      <h2 style={{ marginBottom: 12 }}>{t('Matumizi ya siku', "The day's expenses")}</h2>
      {d.expenses.length === 0 ? <Empty>{t('Hakuna matumizi siku hii.', 'No expenses this day.')}</Empty> : (
        <ul className="list">{d.expenses.map((e) => <li key={e.id}><Chip>{t(e.category_sw, e.category_en)}</Chip><span className="li-main"><strong>{e.reason}</strong><span>{p(PAID_FROM[e.paid_from])}</span></span><span className="li-amt">{tsh(e.amount)}</span></li>)}</ul>
      )}
    </>
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
  const cats = Object.values(list.reduce((a, e) => { (a[e.category] ||= { key: e.category, name: lang === 'sw' ? e.category_sw : e.category_en, amount: 0 }).amount += e.amount; return a; }, {})).sort((a, b) => b.amount - a.amount);
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
