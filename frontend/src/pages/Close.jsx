import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Check, Lock, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useDay, useErr, useMeta, useWorkers } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { addDays, num, sum, tsh } from '../format.js';
import { PAID_FROM, ROLES, SEC, SECTIONS, STEPS } from '../vocab.js';
import { Avatar, Btn, Callout, Chip, CountUp, Empty, Leader, Money, MoneyInput, Page, PageSkeleton, SelectField, StatusChip, TextField } from '../components/ui.jsx';
import { ExpenseForm } from '../components/forms.jsx';

const LAST = STEPS.length - 1;
const stepOf = (v) => Math.min(LAST, Math.max(0, Number.parseInt(v ?? '0', 10) || 0));

/* ?siku=YYYY-MM-DD fills an earlier day; anything missing, malformed or in the future means today. */
export default function Close() {
  const today = useMeta().data.today;
  const asked = useSearchParams()[0].get('siku');
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked < today ? asked : today;
  return <CloseDay key={day} day={day} today={today} />;
}

function CloseDay({ day, today }) {
  const { t, p, longDate } = useI();
  const isToday = day === today;
  const { data: d } = useDay(day);
  const workers = useWorkers().data;
  const act = useActions();
  const nav = useNavigate();
  const params = useParams();
  const step = stepOf(params.step);
  const [prev, setPrev] = useState(step);
  const dir = step >= prev ? 1 : -1;
  useEffect(() => { setPrev(step); }, [step]);

  /* All unsaved edits live here so jumping between steps never loses anything. */
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!d || form) return;
    const sales = {}; const count = {};
    SEC.forEach((s) => {
      const x = d.sections[s];
      sales[s] = { cash: x.cash || null, mobile: x.mobile || null, cashier_id: x.cashier_id ? String(x.cashier_id) : '' };
      count[s] = x.counted;
    });
    const att = {};
    d.attendance.forEach((w) => { if (!w.locked && w.status) att[w.worker_id] = w.status; });
    setForm({ sales, count, att });
  }, [d, form]);

  if (!d || !workers || !form) return <PageSkeleton />;

  const href = (i, dd = day) => `/funga/${i}${dd === today ? '' : `?siku=${dd}`}`;
  const picker = (
    <div style={{ minWidth: 190 }}>
      <TextField type="date" label={t('Tarehe ya kujaza', 'Day to fill')} value={day} max={today} onChange={(v) => { if (v) nav(href(0, v)); }} />
    </div>
  );

  if (d.closed) {
    const next = addDays(day, 1);
    return (
      <Page>
        <header className="page-head"><div /> {picker}</header>
        <div className="empty" style={{ padding: 48 }}>
          <Lock size={36} weight="duotone" />
          <h2 style={{ margin: '8px 0' }}>{isToday ? t('Siku ya leo imefungwa', 'Today is closed') : t(`${longDate(day, d.dow)} imefungwa`, `${longDate(day, d.dow)} is closed`)}</h2>
          <p style={{ marginBottom: 18 }}>{t('Marekebisho yafanywe kama rekodi mpya.', 'Corrections are added as new entries.')}</p>
          {isToday ? <Link to="/" className="btn btn-primary">{t('Rudi Leo', 'Back to Today')}</Link>
            : <Link to={href(0, next)} className="btn btn-primary">{t('Jaza siku inayofuata', 'Fill the next day')}<ArrowRight size={18} weight="bold" /></Link>}
        </div>
      </Page>
    );
  }

  const active = workers.filter((w) => w.active);
  const go = (i) => nav(href(i));
  const doneStep = (i) => d.visited.includes(i);
  const mark = (i) => act.visit(day, i).catch(() => {});
  const setSale = (s, k, v) => setForm((f) => ({ ...f, sales: { ...f.sales, [s]: { ...f.sales[s], [k]: v } } }));
  const salesBody = () => Object.fromEntries(SEC.map((s) => {
    const x = form.sales[s];
    return [s, { cash: x.cash || 0, mobile: x.mobile || 0, cashier_id: x.cashier_id ? Number(x.cashier_id) : null }];
  }));
  const countBody = () => Object.fromEntries(SEC.map((s) => [s, form.count[s]]));
  const lockedAtt = d.attendance.filter((w) => w.locked);
  const attBody = () => Object.fromEntries(Object.entries(form.att).map(([k, v]) => [k, v]));

  const props = { d, form, setForm, setSale, active, act, day, isToday, t, p };
  const body = [
    <SalesStep {...props} key="0" />, <ExpensesStep {...props} key="1" />, <CountStep {...props} key="2" />,
    <AttendanceStep {...props} lockedAtt={lockedAtt} key="3" />,
    <FinishStep {...props} lockedAtt={lockedAtt} go={go} href={href} salesBody={salesBody} countBody={countBody} attBody={attBody} key="4" />,
  ][step];

  const saveAndNext = async () => {
    try {
      if (step === 0) await act.saveSales(day, salesBody());
      if (step === 2) await act.saveCount(day, countBody());
      if (step === 3) await act.saveAttendance(day, attBody());
      mark(step);
      go(step + 1);
    } catch (e) { toast.error(t('Imeshindwa kuhifadhi. Jaribu tena.', 'Could not save. Try again.')); }
  };

  return (
    <Page>
      <header className="page-head">
        <div>
          <p className="muted">{isToday ? t('Funga siku ya leo', "Close today's books") : t(`Funga siku: ${longDate(day, d.dow)}`, `Close the books: ${longDate(day, d.dow)}`)}</p>
          <h1>{p(STEPS[step])}</h1>
        </div>
        {picker}
      </header>

      <div className="stepper" role="list" aria-label={t('Hatua', 'Steps')}>
        {STEPS.map((st, i) => (
          <button key={i} type="button" role="listitem" className={doneStep(i) ? 'done' : i === step ? 'cur' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
            {i > 0 ? <motion.span className="fill" initial={false} animate={{ scaleX: doneStep(i - 1) || i <= step ? 1 : 0 }} transition={{ duration: 0.5 }} /> : null}
            <span className="dot">{doneStep(i) && i !== step ? <Check size={16} weight="bold" /> : i + 1}</span>
            <span className="lbl">{p(st)}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step} custom={dir}
          variants={{ in: (x) => ({ opacity: 0, x: 40 * x }), on: { opacity: 1, x: 0 }, out: (x) => ({ opacity: 0, x: -40 * x }) }}
          initial="in" animate="on" exit="out" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="step-card">{body}</div>
          {step < LAST ? (
            <div className="wiz-nav">
              <Btn onClick={() => (step > 0 ? go(step - 1) : nav('/'))}><ArrowLeft size={18} weight="bold" />{step > 0 ? t('Nyuma', 'Back') : t('Leo', 'Today')}</Btn>
              <Btn className="btn-primary" onClick={saveAndNext}>{t('Endelea', 'Continue')}<ArrowRight size={18} weight="bold" /></Btn>
            </div>
          ) : (
            <div className="wiz-nav"><Btn onClick={() => go(LAST - 1)}><ArrowLeft size={18} weight="bold" />{t('Nyuma', 'Back')}</Btn><span /></div>
          )}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

/* ------------------------------------------------------------ 1. sales */
function SalesStep({ d, form, setSale, active, isToday, t, p }) {
  const cashiers = [...active].sort((a, b) => (b.role === 'keshia') - (a.role === 'keshia'));
  const total = sum(SEC, (s) => (form.sales[s].cash || 0) + (form.sales[s].mobile || 0));
  return (
    <>
      <header><h2>{isToday ? t('Mauzo ya leo', "Today's sales") : t('Mauzo ya siku', "The day's sales")}</h2><p className="muted">{t('Andika jumla ya pesa taslimu na pesa za simu kwa kila sehemu.', 'Enter the cash and mobile money totals for each section.')}</p></header>
      <div className="grid-2">
        {SEC.map((s) => (
          <div className="section-block" key={s}>
            <h3>{p(SECTIONS[s])}</h3>
            <div className="stack">
              <MoneyInput label={t('Pesa taslimu', 'Cash')} value={form.sales[s].cash} onChange={(v) => setSale(s, 'cash', v)} hint={t(`Jana: ${tsh(d.yesterday[s].cash)}`, `Yesterday: ${tsh(d.yesterday[s].cash)}`)} />
              <MoneyInput label={t('Pesa za simu', 'Mobile money')} value={form.sales[s].mobile} onChange={(v) => setSale(s, 'mobile', v)} hint={t(`Jana: ${tsh(d.yesterday[s].mobile)}`, `Yesterday: ${tsh(d.yesterday[s].mobile)}`)} />
              <SelectField label={t('Keshia wa siku', 'Cashier of the day')} value={form.sales[s].cashier_id} onChange={(v) => setSale(s, 'cashier_id', v)} hint={t('Upungufu wa pesa utaandikwa kwenye akaunti yake.', 'A cash shortage is written on this person’s account.')}>
                <option value="">{t('— Chagua —', '— Choose —')}</option>
                {cashiers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </SelectField>
            </div>
          </div>
        ))}
      </div>
      <div className="totalbar"><span>{t('Jumla ya siku', "Day's total")}</span><strong><span className="cur">TSh</span><CountUp value={total} duration={0.5} /></strong></div>
    </>
  );
}

/* ------------------------------------------------------------ 2. expenses */
function ExpensesStep({ d, act, day, isToday, t, p }) {
  const fail = useErr();
  return (
    <>
      <header><h2>{isToday ? t('Matumizi ya leo', "Today's expenses") : t('Matumizi ya siku', "The day's expenses")}</h2><p className="muted">{t('Ikilipwa kutoka droo, hupunguza pesa inayotarajiwa kwenye hatua inayofuata.', 'Paid from a till, it lowers that till’s expected cash in the next step.')}</p></header>
      {d.expenses.length === 0 ? <Empty>{t('Hakuna matumizi yaliyoandikwa.', 'No expenses recorded yet.')}</Empty> : (
        <ul className="list" style={{ marginBottom: 22 }}>
          {d.expenses.map((e) => (
            <li key={e.id}>
              <Chip>{t(e.category_sw, e.category_en)}</Chip>
              <span className="li-main"><strong>{e.reason}</strong><span>{p(PAID_FROM[e.paid_from])}{e.section ? ` · ${p(SECTIONS[e.section])}` : ''}</span></span>
              <span className="li-amt">{tsh(e.amount)}</span>
              <button type="button" className="icon-plain" aria-label={t('Futa', 'Delete')} onClick={() => act.delExpense(e.id).catch(fail)}><Trash size={18} weight="duotone" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="section-block"><h3>{t('Ongeza matumizi', 'Add an expense')}</h3><ExpenseForm date={day} /></div>
    </>
  );
}

/* ------------------------------------------------------------ 3. cash count */
export function cashMath(d, form, s) {
  const x = d.sections[s];
  const cash = form.sales[s].cash || 0;
  const expected = cash - x.payouts;
  const counted = form.count[s];
  const diff = counted == null ? null : counted - x.float - expected;
  return { ...x, cash, expected, counted, diff };
}

function CountStep({ d, form, setForm, active, t, p }) {
  return (
    <>
      <header><h2>{t('Hesabu ya pesa', 'Cash count')}</h2><p className="muted">{t('Hesabu pesa zote kwenye droo pamoja na chenji ya kudumu.', 'Count everything in the till, including the change float.')}</p></header>
      <div className="grid-2">
        {SEC.map((s) => {
          const c = cashMath(d, form, s);
          const who = active.find((w) => String(w.id) === form.sales[s].cashier_id);
          return (
            <div className="section-block" key={s}>
              <h3>{p(SECTIONS[s])}</h3>
              <div className="ledger flat">
                <Leader label={t('Mauzo ya taslimu', 'Cash sales')} value={tsh(c.cash)} />
                <Leader label={t('Imetoka droo', 'Paid out of the till')} value={`− ${tsh(c.payouts)}`} />
                <Leader strong label={t('Pesa inayotarajiwa', 'Expected cash')} value={tsh(c.expected)} />
              </div>
              <div style={{ margin: '14px 0' }}>
                <MoneyInput label={t('Pesa uliyohesabu (pamoja na chenji)', 'Cash counted (including change float)')} value={form.count[s]} onChange={(v) => setForm((f) => ({ ...f, count: { ...f.count, [s]: v } }))}
                  hint={t(`Chenji ya kudumu: ${tsh(c.float)}, haihesabiwi.`, `Fixed change float: ${tsh(c.float)}, left out of the count.`)} />
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {c.diff == null ? null : (
                  <motion.div key={c.diff === 0 ? 'z' : c.diff < 0 ? 'n' : 'p'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {c.diff === 0 ? <Callout tone="good"><strong>{t('Hakuna tofauti.', 'No difference.')}</strong> {t('Pesa zinalingana.', 'The cash matches.')}</Callout>
                      : c.diff < 0 ? <Callout tone="bad"><strong>{t('Upungufu', 'Shortage')}: {tsh(-c.diff)}.</strong> {who ? t(`Utaandikwa kwenye akaunti ya ${who.name} na kukatwa kwenye mshahara.`, `It will go to ${who.name}'s account and be deducted from pay.`) : t('Chagua keshia wa siku kwenye hatua ya mauzo.', 'Choose the cashier of the day in the sales step.')}</Callout>
                        : <Callout tone="warn"><strong>{t('Ziada', 'Surplus')}: {tsh(c.diff)}.</strong> {t('Angalia kama mauzo yoyote hayajaandikwa.', 'Check whether a sale is missing.')}</Callout>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ 4. attendance */
function AttendanceStep({ d, form, setForm, lockedAtt, t, p }) {
  const open = d.attendance.filter((w) => !w.locked);
  const set = (id, v) => setForm((f) => ({ ...f, att: { ...f.att, [id]: v } }));
  return (
    <>
      <header><h2>{t('Mahudhurio', 'Attendance')}</h2><p className="muted">{t('Huwezi kufunga siku hadi kila mfanyakazi aandikwe.', 'You cannot close the day until every worker is marked.')}</p></header>
      {lockedAtt.length ? (
        <div style={{ marginBottom: 12 }}>
          {lockedAtt.map((w) => (
            <div className="att-row" key={w.worker_id}>
              <div className="att-who"><Avatar name={w.name} /><span><strong>{w.name}</strong><small>{p(ROLES[w.role])}</small></span></div>
              <span className="row" style={{ gap: 8 }}><StatusChip k={w.status} /><Lock size={16} aria-label={t('Imejazwa yenyewe', 'Filled automatically')} /></span>
            </div>
          ))}
        </div>
      ) : null}
      {open.map((w) => (
        <div className="att-row" key={w.worker_id}>
          <div className="att-who"><Avatar name={w.name} /><span><strong>{w.name}</strong><small>{p(ROLES[w.role])}</small></span></div>
          <div className="att-btns" role="group" aria-label={w.name}>
            <button type="button" className="g" aria-pressed={form.att[w.worker_id] === 'present'} onClick={() => set(w.worker_id, 'present')}>{t('Yupo', 'Present')}</button>
            <button type="button" className="w" aria-pressed={form.att[w.worker_id] === 'late'} onClick={() => set(w.worker_id, 'late')}>{t('Amechelewa', 'Late')}</button>
            <button type="button" className="r" aria-pressed={form.att[w.worker_id] === 'absent'} onClick={() => set(w.worker_id, 'absent')}>{t('Hakuja', 'Absent')}</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------ 5. finish */
function FinishStep({ d, form, active, act, day, isToday, t, p, lockedAtt, go, href, salesBody, countBody, attBody }) {
  const nav = useNavigate();
  const fail = useErr();
  const [busy, setBusy] = useState(false);
  const missing = useMemo(() => d.attendance.filter((w) => !w.locked && !form.att[w.worker_id]), [d, form]);
  const shorts = SEC.map((s) => ({ s, c: cashMath(d, form, s), who: active.find((w) => String(w.id) === form.sales[s].cashier_id) })).filter((x) => x.c.diff != null && x.c.diff < 0);
  const noCashier = shorts.some((x) => !x.who);
  const salesTotal = sum(SEC, (s) => (form.sales[s].cash || 0) + (form.sales[s].mobile || 0));
  const present = d.attendance.filter((w) => w.locked ? false : ['present', 'late'].includes(form.att[w.worker_id])).length;

  const close = async () => {
    setBusy(true);
    try {
      await act.saveSales(day, salesBody());
      await act.saveCount(day, countBody());
      if (Object.keys(attBody()).length) await act.saveAttendance(day, attBody());
      const r = await act.closeDay(day);
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ['#e3b655', '#14916f', '#ffffff', '#0b5d49'], disableForReducedMotion: true });
      toast.success(isToday ? t('Siku imefungwa. Kazi nzuri!', 'The day is closed. Well done!') : t('Siku imefungwa. Sasa jaza siku inayofuata.', 'The day is closed. Now fill the next day.'));
      r.shortages.forEach((s) => toast.warning(t(`Upungufu wa ${tsh(s.amount)} umeandikwa kwenye akaunti ya ${s.worker_name}.`, `The ${tsh(s.amount)} shortage was added to ${s.worker_name}'s account.`), { duration: 8000 }));
      nav(isToday ? '/' : href(0, addDays(day, 1)));
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <>
      <header><h2>{isToday ? t('Funga siku ya leo', "Close today's books") : t('Funga siku hii', "Close this day's books")}</h2><p className="muted">{t('Kagua muhtasari kabla ya kufunga. Siku iliyofungwa haibadilishwi.', 'Review the summary. A closed day cannot be edited.')}</p></header>
      <div className="summary-grid">
        <div className="section-block">
          <h3>{t('Mauzo', 'Sales')}</h3>
          <div className="ledger flat">
            <Leader label={t('Banda', 'Stall')} value={tsh((form.sales.banda.cash || 0) + (form.sales.banda.mobile || 0))} />
            <Leader label={t('Mgahawa', 'Restaurant')} value={tsh((form.sales.mgahawa.cash || 0) + (form.sales.mgahawa.mobile || 0))} />
            <Leader strong label={t('Jumla', 'Total')} value={tsh(salesTotal)} />
          </div>
        </div>
        <div className="section-block">
          <h3>{t('Pesa na watu', 'Cash and people')}</h3>
          <div className="ledger flat">
            <Leader label={t('Matumizi', 'Expenses')} value={tsh(d.expenses_total)} />
            {SEC.map((s) => { const c = cashMath(d, form, s); return <Leader key={s} label={`${t('Tofauti', 'Difference')}: ${p(SECTIONS[s])}`} tone={c.diff == null ? undefined : c.diff === 0 ? 'good' : c.diff < 0 ? 'bad' : 'warn'} value={c.diff == null ? '—' : c.diff === 0 ? tsh(0) : `${c.diff < 0 ? '−' : '+'}${num(Math.abs(c.diff))}`} />; })}
            <Leader label={t('Waliohudhuria', 'Present')} value={`${present} / ${d.attendance.length - lockedAtt.length}`} />
          </div>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 18 }}>
        {shorts.map(({ s, c, who }) => (
          <Callout key={s} tone="warn">
            {who ? <>{t('Upungufu wa', 'The shortage of')} <strong>{tsh(-c.diff)}</strong> ({p(SECTIONS[s])}) {t('utaandikwa kwenye akaunti ya', 'will go straight to the account of')} <strong>{who.name}</strong>{t(' na kukatwa kwenye mshahara mara moja.', ' and be deducted from pay.')}</>
              : <>{t('Chagua keshia wa siku kwa', 'Choose the cashier of the day for')} {p(SECTIONS[s])}.</>}
          </Callout>
        ))}
        {missing.length ? <Callout tone="warn">{t('Hawajaandikwa:', 'Not marked yet:')} <strong>{missing.map((w) => w.name).join(', ')}</strong>. <button type="button" className="btn-ghost" onClick={() => go(3)}>{t('Nenda kwenye mahudhurio', 'Go to attendance')}</button></Callout> : null}
      </div>
      <div style={{ marginTop: 24 }}>
        <Btn className="btn-primary btn-block" style={{ minHeight: 56, fontSize: '1.05rem' }} loading={busy} disabled={missing.length > 0 || noCashier} onClick={close}>
          <Lock size={20} weight="bold" />{isToday ? t('Funga siku ya leo', 'Close today') : t('Funga siku hii', 'Close this day')}
        </Btn>
      </div>
    </>
  );
}
