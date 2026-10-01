import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Check, Lock, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useDay, useErr, useMeta, useWorkers } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { num, sum, tsh } from '../format.js';
import { PAID_FROM, ROLES, SEC, SECTIONS, STEPS } from '../vocab.js';
import { Avatar, Btn, Callout, Chip, CountUp, Empty, Leader, Money, MoneyInput, Page, PageSkeleton, Seg, SelectField, StatusChip } from '../components/ui.jsx';
import { ExpenseForm } from '../components/forms.jsx';

const stepOf = (v) => Math.min(5, Math.max(0, Number.parseInt(v ?? '0', 10) || 0));

export default function Close() {
  const { t, p } = useI();
  const today = useMeta().data.today;
  const { data: d } = useDay(today);
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

  if (d.closed) {
    return (
      <Page>
        <div className="empty" style={{ padding: 48 }}>
          <Lock size={36} weight="duotone" />
          <h2 style={{ margin: '8px 0' }}>{t('Siku ya leo imefungwa', 'Today is closed')}</h2>
          <p style={{ marginBottom: 18 }}>{t('Marekebisho yafanywe kama rekodi mpya.', 'Corrections are added as new entries.')}</p>
          <Link to="/" className="btn btn-primary">{t('Rudi Leo', 'Back to Today')}</Link>
        </div>
      </Page>
    );
  }

  const active = workers.filter((w) => w.active);
  const go = (i) => nav(`/funga/${i}`);
  const doneStep = (i) => d.visited.includes(i);
  const mark = (i) => act.visit(today, i).catch(() => {});
  const setSale = (s, k, v) => setForm((f) => ({ ...f, sales: { ...f.sales, [s]: { ...f.sales[s], [k]: v } } }));
  const salesBody = () => Object.fromEntries(SEC.map((s) => {
    const x = form.sales[s];
    return [s, { cash: x.cash || 0, mobile: x.mobile || 0, cashier_id: x.cashier_id ? Number(x.cashier_id) : null }];
  }));
  const countBody = () => Object.fromEntries(SEC.map((s) => [s, form.count[s]]));
  const lockedAtt = d.attendance.filter((w) => w.locked);
  const attBody = () => Object.fromEntries(Object.entries(form.att).map(([k, v]) => [k, v]));

  const props = { d, form, setForm, setSale, active, act, today, t, p };
  const body = [
    <SalesStep {...props} key="0" />, <DeliveriesStep {...props} key="1" />, <ExpensesStep {...props} key="2" />,
    <CountStep {...props} key="3" />, <AttendanceStep {...props} lockedAtt={lockedAtt} key="4" />,
    <FinishStep {...props} lockedAtt={lockedAtt} go={go} salesBody={salesBody} countBody={countBody} attBody={attBody} key="5" />,
  ][step];

  const saveAndNext = async () => {
    try {
      if (step === 0) await act.saveSales(today, salesBody());
      if (step === 3) await act.saveCount(today, countBody());
      if (step === 4) await act.saveAttendance(today, attBody());
      mark(step);
      go(step + 1);
    } catch (e) { toast.error(t('Imeshindwa kuhifadhi. Jaribu tena.', 'Could not save. Try again.')); }
  };

  return (
    <Page>
      <header className="page-head">
        <div><p className="muted">{t('Funga siku ya leo', "Close today's books")}</p><h1>{p(STEPS[step])}</h1></div>
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
          {step < 5 ? (
            <div className="wiz-nav">
              <Btn onClick={() => (step > 0 ? go(step - 1) : nav('/'))}><ArrowLeft size={18} weight="bold" />{step > 0 ? t('Nyuma', 'Back') : t('Leo', 'Today')}</Btn>
              <Btn className="btn-primary" onClick={saveAndNext}>{t('Endelea', 'Continue')}<ArrowRight size={18} weight="bold" /></Btn>
            </div>
          ) : (
            <div className="wiz-nav"><Btn onClick={() => go(4)}><ArrowLeft size={18} weight="bold" />{t('Nyuma', 'Back')}</Btn><span /></div>
          )}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

/* ------------------------------------------------------------ 1. sales */
function SalesStep({ d, form, setSale, active, t, p }) {
  const cashiers = [...active].sort((a, b) => (b.role === 'keshia') - (a.role === 'keshia'));
  const total = sum(SEC, (s) => (form.sales[s].cash || 0) + (form.sales[s].mobile || 0));
  return (
    <>
      <header><h2>{t('Mauzo ya leo', "Today's sales")}</h2><p className="muted">{t('Andika jumla ya pesa taslimu na pesa za simu kwa kila sehemu.', 'Enter the cash and mobile money totals for each section.')}</p></header>
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

/* ------------------------------------------------------------ 2. deliveries */
function DeliveriesStep({ d, active, act, today, t, p }) {
  const fail = useErr();
  const [worker, setWorker] = useState('');
  const [section, setSection] = useState('mgahawa');
  const [amount, setAmount] = useState(null);
  const [method, setMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    if (!worker || !amount) { toast.warning(t('Chagua mfanyakazi na andika kiasi.', 'Choose the worker and enter the amount.')); return; }
    setBusy(true);
    try { await act.addDelivery(today, { worker_id: Number(worker), section, amount, method }); setAmount(null); toast.success(t('Delivery imeandikwa.', 'Delivery saved.')); }
    catch (ex) { fail(ex); } finally { setBusy(false); }
  };
  return (
    <>
      <header><h2>{t('Delivery za leo', "Today's deliveries")}</h2><p className="muted">{t('Wapishi wanapeleka wenyewe. Delivery ni bure kwa mteja.', 'Cooks deliver themselves. Delivery is free for the customer.')}</p></header>
      {d.deliveries.length === 0 ? <Empty>{t('Hakuna delivery leo.', 'No deliveries today.')}</Empty> : (
        <ul className="list" style={{ marginBottom: 22 }}>
          {d.deliveries.map((x) => (
            <li key={x.id}>
              <Chip tone={x.method === 'cash' ? 'warn' : 'info'}>{x.method === 'cash' ? t('Taslimu', 'Cash') : t('Simu', 'Mobile')}</Chip>
              <span className="li-main"><strong>{x.worker_name}</strong><span>{p(SECTIONS[x.section])}{x.method === 'mobile' ? ` · ${t('Hakuna cha kukabidhi', 'Nothing to hand in')}` : ''}</span></span>
              <span className="li-amt">{tsh(x.amount)}</span>
              {x.method === 'cash' ? (x.handed_in ? <Chip tone="good"><Check size={12} weight="bold" />{t('Imekabidhiwa', 'Handed in')}</Chip>
                : <Btn className="btn-quiet btn-small" onClick={() => act.handIn([x.id]).catch(fail)}>{t('Amekabidhi', 'Handed in')}</Btn>) : null}
              <button type="button" className="icon-plain" aria-label={t('Futa', 'Delete')} onClick={() => act.delDelivery(x.id).catch(fail)}><Trash size={18} weight="duotone" /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="section-block stack" onSubmit={add}>
        <h3>{t('Ongeza delivery', 'Add a delivery')}</h3>
        <div className="grid-2">
          <SelectField label={t('Aliyepeleka', 'Taken by')} value={worker} onChange={setWorker}>
            <option value="">{t('— Chagua —', '— Choose —')}</option>
            {[...active].sort((a, b) => (b.role === 'mpishi') - (a.role === 'mpishi')).map((w) => <option key={w.id} value={w.id}>{w.name} ({p(ROLES[w.role])})</option>)}
          </SelectField>
          <MoneyInput label={t('Kiasi cha oda', 'Order amount')} value={amount} onChange={setAmount} />
        </div>
        <div className="row">
          <div className="field"><span className="field-label">{t('Sehemu', 'Section')}</span><Seg label={t('Sehemu', 'Section')} value={section} onChange={setSection} options={SEC.map((s) => [s, p(SECTIONS[s])])} /></div>
          <div className="field"><span className="field-label">{t('Mteja alilipa', 'Customer paid')}</span><Seg label={t('Mteja alilipa', 'Customer paid')} value={method} onChange={setMethod} options={[['cash', t('Taslimu', 'Cash')], ['mobile', t('Simu', 'Mobile money')]]} /></div>
        </div>
        {method === 'cash' ? <Callout tone="info">{t('Mpishi anadaiwa pesa hii hadi akabidhi kwa keshia.', 'The cook owes this cash until it is handed to the cashier.')}</Callout> : null}
        <div><Btn type="submit" className="btn-primary" loading={busy}>{t('Weka delivery', 'Add delivery')}</Btn></div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------ 3. expenses */
function ExpensesStep({ d, act, today, t, p }) {
  const fail = useErr();
  return (
    <>
      <header><h2>{t('Matumizi ya leo', "Today's expenses")}</h2><p className="muted">{t('Ikilipwa kutoka droo, hupunguza pesa inayotarajiwa kwenye hatua inayofuata.', 'Paid from a till, it lowers that till’s expected cash in the next step.')}</p></header>
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
      <div className="section-block"><h3>{t('Ongeza matumizi', 'Add an expense')}</h3><ExpenseForm date={today} /></div>
    </>
  );
}

/* ------------------------------------------------------------ 4. cash count */
export function cashMath(d, form, s) {
  const x = d.sections[s];
  const cash = form.sales[s].cash || 0;
  const expected = cash - x.undelivered - x.payouts;
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
                <Leader label={t('Delivery haijakabidhiwa', 'Delivery not handed in')} value={`− ${tsh(c.undelivered)}`} />
                <Leader label={t('Imetoka droo leo', 'Paid out of the till')} value={`− ${tsh(c.payouts)}`} />
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

/* ------------------------------------------------------------ 5. attendance */
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

/* ------------------------------------------------------------ 6. finish */
function FinishStep({ d, form, active, act, today, t, p, lockedAtt, go, salesBody, countBody, attBody }) {
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
      await act.saveSales(today, salesBody());
      await act.saveCount(today, countBody());
      if (Object.keys(attBody()).length) await act.saveAttendance(today, attBody());
      const r = await act.closeDay(today);
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ['#e3b655', '#14916f', '#ffffff', '#0b5d49'], disableForReducedMotion: true });
      toast.success(t('Siku imefungwa. Kazi nzuri!', 'The day is closed. Well done!'));
      r.shortages.forEach((s) => toast.warning(t(`Upungufu wa ${tsh(s.amount)} umeandikwa kwenye akaunti ya ${s.worker_name}.`, `The ${tsh(s.amount)} shortage was added to ${s.worker_name}'s account.`), { duration: 8000 }));
      nav('/');
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <>
      <header><h2>{t('Funga siku ya leo', "Close today's books")}</h2><p className="muted">{t('Kagua muhtasari kabla ya kufunga. Siku iliyofungwa haibadilishwi.', 'Review the summary. A closed day cannot be edited.')}</p></header>
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
            <Leader label={t('Delivery bado inadaiwa', 'Delivery cash still owed')} value={tsh(sum(d.owed, (o) => o.amount))} />
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
        {missing.length ? <Callout tone="warn">{t('Hawajaandikwa:', 'Not marked yet:')} <strong>{missing.map((w) => w.name).join(', ')}</strong>. <button type="button" className="btn-ghost" onClick={() => go(4)}>{t('Nenda kwenye mahudhurio', 'Go to attendance')}</button></Callout> : null}
      </div>
      <div style={{ marginTop: 24 }}>
        <Btn className="btn-primary btn-block" style={{ minHeight: 56, fontSize: '1.05rem' }} loading={busy} disabled={missing.length > 0 || noCashier} onClick={close}>
          <Lock size={20} weight="bold" />{t('Funga siku ya leo', 'Close today')}
        </Btn>
      </div>
    </>
  );
}
