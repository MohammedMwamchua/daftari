import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowCounterClockwise, CalendarPlus, CalendarX, CaretLeft, HandCoins, MagnifyingGlass, Plus, Trash, UserMinus, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAccount, useActions, useDay, useErr, useMeta, useWorker, useWorkers } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { num, parseISO, sum, tsh } from '../format.js';
import { REMOVE_REASONS, ROLES, SECTIONS, STATUS } from '../vocab.js';
import { Avatar, Btn, Callout, Chip, Empty, Modal, MoneyInput, Page, PageSkeleton, Rise, Seg, SelectField, Tabs, TextField } from '../components/ui.jsx';

/* ------------------------------------------------------------ list */
export function WorkersList() {
  const { t, p, dayOffName } = useI();
  const { data: workers } = useWorkers();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const act = useActions();
  const fail = useErr();
  if (!workers) return <PageSkeleton />;
  const match = (w) => w.name.toLowerCase().includes(q.trim().toLowerCase());
  const active = workers.filter((w) => w.active && match(w));
  const removed = workers.filter((w) => !w.active);

  return (
    <Page>
      <header className="page-head">
        <div><p className="muted">{t('Timu yako', 'Your team')}</p><h1>{t('Wafanyakazi', 'Workers')}</h1></div>
        <div className="row">
          <div className="searchbar"><MagnifyingGlass size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Tafuta mfanyakazi…', 'Search workers…')} aria-label={t('Tafuta', 'Search')} /></div>
          <Btn className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} weight="bold" />{t('Ongeza', 'Add')}</Btn>
        </div>
      </header>

      {active.length === 0 ? <Empty>{t('Hakuna mfanyakazi anayelingana.', 'No workers match.')}</Empty> : (
        <div className="worker-grid">
          {active.map((w, i) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <Link to={`/wafanyakazi/${w.id}`} className="worker-card">
                <div className="top">
                  <Avatar name={w.name} />
                  <div style={{ minWidth: 0 }}><h3>{w.name}</h3><p className="muted" style={{ fontSize: '0.9rem' }}>{p(ROLES[w.role])}</p></div>
                </div>
                <div className="chips">
                  <Chip tone="brass">{w.pay_type === 'monthly' ? t('Mshahara', 'Monthly') : t('Kila siku', 'Daily')}: {tsh(w.rate)}</Chip>
                  {w.owed ? <Chip tone="warn"><Warning size={12} weight="fill" />{t('Anadaiwa', 'Owes')} {tsh(w.owed)}</Chip> : null}
                  {w.company_owes ? <Chip tone="bad"><HandCoins size={12} weight="fill" />{t('Haijalipwa', 'Unpaid')} {tsh(w.company_owes)}</Chip> : null}
                  {w.day_off == null ? <Chip tone="info"><CalendarX size={12} weight="bold" />{t('Hana siku ya mapumziko', 'No day off')}</Chip> : null}
                </div>
                <div className="meta"><span>{t('Siku ya mapumziko', 'Day off')}</span><b>{dayOffName(w.day_off)}</b></div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {removed.length ? (
        <section style={{ marginTop: 34 }}>
          <button type="button" className="btn-ghost" onClick={() => setShowRemoved((s) => !s)}>{t('Walioondolewa', 'Removed')} ({removed.length})</button>
          {showRemoved ? (
            <ul className="list" style={{ marginTop: 12 }}>
              {removed.map((w) => (
                <li key={w.id}>
                  <Avatar name={w.name} />
                  <span className="li-main"><strong>{w.name}</strong><span>{p(ROLES[w.role])} · {p(REMOVE_REASONS[w.removed_reason] || REMOVE_REASONS.other)}</span></span>
                  <Btn className="btn-quiet btn-small" onClick={() => act.restoreWorker(w.id).then(() => toast.success(t('Amerudishwa.', 'Restored.'))).catch(fail)}><ArrowCounterClockwise size={16} />{t('Rudisha', 'Restore')}</Btn>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <AddWorker open={adding} onClose={() => setAdding(false)} />
    </Page>
  );
}

function AddWorker({ open, onClose }) {
  const { t, p, dayName } = useI();
  const today = useMeta().data.today;
  const act = useActions();
  const fail = useErr();
  const empty = { name: '', role: 'keshia', phone: '', pay_type: 'monthly', rate: null, day_off: '1', joined_on: today };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.rate) { toast.warning(t('Jaza jina na mshahara.', 'Fill in the name and pay.')); return; }
    setBusy(true);
    try {
      await act.addWorker({ ...f, name: f.name.trim(), day_off: f.day_off === 'none' ? null : Number(f.day_off) });
      toast.success(t('Mfanyakazi ameongezwa.', 'Worker added.')); setF({ ...empty, joined_on: today }); onClose();
    } catch (ex) { fail(ex); } finally { setBusy(false); }
  };
  const future = f.joined_on > today;
  return (
    <Modal open={open} onClose={onClose} title={t('Ongeza mfanyakazi', 'Add a worker')}>
      <form className="stack" onSubmit={submit}>
        <TextField label={t('Jina kamili', 'Full name')} value={f.name} onChange={set('name')} autoFocus />
        <div className="grid-2">
          <SelectField label={t('Kazi', 'Role')} value={f.role} onChange={set('role')}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{p(v)}</option>)}</SelectField>
          <TextField label={t('Simu', 'Phone')} value={f.phone} onChange={set('phone')} inputMode="tel" />
        </div>
        <div className="field"><span className="field-label">{t('Aina ya malipo', 'Pay type')}</span>
          <Seg full label={t('Aina ya malipo', 'Pay type')} value={f.pay_type} onChange={set('pay_type')} options={[['monthly', t('Mshahara wa mwezi', 'Monthly salary')], ['daily', t('Kiwango cha siku', 'Daily rate')]]} /></div>
        <div className="grid-2">
          <MoneyInput label={f.pay_type === 'monthly' ? t('Mshahara kwa mwezi', 'Monthly salary') : t('Malipo kwa siku', 'Daily rate')} value={f.rate} onChange={set('rate')} />
          <SelectField label={t('Siku ya mapumziko', 'Weekly day off')} value={f.day_off} onChange={set('day_off')}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{dayName(d)}</option>)}
            <option value="none">{t('Hakuna', 'No')}</option>
          </SelectField>
        </div>
        {f.day_off === 'none' ? (
          <Callout tone="info">{t('Mfumo hautamjaza siku yoyote ya mapumziko. Mahudhurio yatahitajika kuandikwa kila siku.', 'The system will never fill in a rest day for this worker. Attendance must be marked for them every single day.')}</Callout>
        ) : null}
        <TextField type="date" label={t('Tarehe ya kuanza kazi', 'Start date')} value={f.joined_on} onChange={set('joined_on')}
          hint={future
            ? t('Mshahara wake utaanza kuhesabiwa tarehe hii; kabla ya hapo hataonekana kwenye orodha za kila siku.', 'Their pay starts counting on this date; they will not appear in the daily lists before it.')
            : t('Mshahara wake unahesabiwa kuanzia tarehe hii. Siku kabla ya hapa haziingii kwenye mshahara wala kuhesabiwa kama hakuja.', 'Their pay is calculated starting from this date. Days before it are not part of their salary and are never counted as absent.')} />
        <div className="actions"><Btn onClick={onClose}>{t('Ghairi', 'Cancel')}</Btn><Btn type="submit" className="btn-primary" loading={busy}>{t('Hifadhi', 'Save')}</Btn></div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ detail */
export function WorkerDetail() {
  const { id } = useParams();
  const { t, p, fmtDate } = useI();
  const today = useMeta().data.today;
  const ym = today.slice(0, 7);
  const { data: w } = useWorker(id, ym);
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'overview';
  if (!w) return <PageSkeleton />;

  return (
    <Page>
      <Link to="/wafanyakazi" className="backlink"><CaretLeft size={16} weight="bold" />{t('Wafanyakazi', 'Workers')}</Link>
      <header className="detail-head">
        <Avatar name={w.name} size="lg" />
        <div>
          <h1>{w.name}</h1>
          <div className="chips" style={{ marginTop: 8 }}>
            <Chip>{p(ROLES[w.role])}</Chip>
            <Chip tone="brass">{w.pay_type === 'monthly' ? t('Mshahara', 'Monthly') : t('Kila siku', 'Daily')}: {tsh(w.rate)}</Chip>
            {w.phone ? <Chip>{w.phone}</Chip> : null}
            <Chip tone={w.joined_on > today ? 'info' : undefined}>
              <CalendarPlus size={12} weight="bold" />
              {w.joined_on > today ? t(`Anaanza ${fmtDate(w.joined_on)}`, `Starts ${fmtDate(w.joined_on)}`) : t(`Alijiunga ${fmtDate(w.joined_on)}`, `Joined ${fmtDate(w.joined_on)}`)}
            </Chip>
            {!w.active ? <Chip tone="bad">{t('Ameondolewa', 'Removed')}</Chip> : null}
            {w.owed ? <Chip tone="warn"><Warning size={12} weight="fill" />{t('Anadaiwa', 'Owes')} {tsh(w.owed)}</Chip> : null}
            {w.company_owes ? <Chip tone="bad"><HandCoins size={12} weight="fill" />{t('Anaidai kampuni', 'Owed by the company')} {tsh(w.company_owes)}</Chip> : null}
            {w.day_off == null ? <Chip tone="info"><CalendarX size={12} weight="bold" />{t('Hana siku ya mapumziko', 'No day off')}</Chip> : null}
          </div>
        </div>
      </header>
      <Tabs label={t('Sehemu', 'Sections')} value={tab} onChange={(v) => setSp(v === 'overview' ? {} : { tab: v }, { replace: true })}
        items={[['overview', t('Muhtasari', 'Overview')], ['leave', t('Ruhusa na likizo', 'Leave')], ['account', t('Akaunti', 'Account')]]} />
      {tab === 'overview' ? <Overview w={w} today={today} /> : tab === 'leave' ? <Leave w={w} /> : <AccountTab w={w} ym={ym} today={today} />}
    </Page>
  );
}

function Overview({ w, today }) {
  const { t, p, dayName, dayShort, monthName } = useI();
  const hasDayOff = w.day_off != null;
  const act = useActions();
  const fail = useErr();
  const nav = useNavigate();
  const [removing, setRemoving] = useState(false);
  const ym = today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  const tiles = [['present', w.stats.present], ['late', w.stats.late], ['absent', w.stats.absent], ['permission', w.stats.permission + w.stats.holiday], ['dayoff', w.stats.dayoff]];

  return (
    <div className="two" style={{ marginTop: 0 }}>
      <section className="panel">
        <div className="panel-head"><h2>{monthName(ym)}</h2></div>
        <div className="cal" role="grid" aria-label={t('Kalenda ya mahudhurio', 'Attendance calendar')}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => <div className="dow" key={d}>{dayShort(d)}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`p${i}`} className="day pad" />)}
          {Array.from({ length: count }, (_, i) => {
            const day = i + 1; const iso = `${ym}-${String(day).padStart(2, '0')}`;
            const st = w.calendar[iso];
            const outside = iso > today || iso < w.joined_on; // not employed yet, or the day hasn't happened
            const cls = outside ? 'future' : st || 'unmarked';
            return <div key={iso} className={`day ${cls}${iso === today ? ' today' : ''}`} title={st ? p(STATUS[st]) : ''}>{day}</div>;
          })}
        </div>
        <div className="legend">
          {[['present', 'var(--good-bg)'], ['late', 'var(--warn-bg)'], ['absent', 'var(--bad-bg)'], ['permission', 'var(--info-bg)'], ['dayoff', 'var(--surface-3)']].map(([k, c]) => (
            <span key={k}><i style={{ background: c }} />{p(STATUS[k])}</span>
          ))}
        </div>
      </section>

      <div className="stack">
        <section className="panel">
          <div className="panel-head"><h2>{t('Siku zilizohesabiwa', 'Days counted')}</h2></div>
          <div className="stat-tiles">
            {tiles.map(([k, v]) => <div key={k}><b>{v}</b><small>{p(STATUS[k])}</small></div>)}
          </div>
        </section>
        <section className="panel">
          <SelectField label={t('Siku ya mapumziko kila wiki', 'Weekly day off')} value={hasDayOff ? String(w.day_off) : 'none'}
            onChange={(v) => act.patchWorker(w.id, { day_off: v === 'none' ? null : Number(v) }).then(() => toast.success(t('Imehifadhiwa.', 'Saved.'))).catch(fail)}
            hint={hasDayOff ? t('Mfumo huijaza siku hii kila wiki.', 'The system fills this day in every week.')
              : t('Hana siku ya mapumziko. Mahudhurio yanahitajika kuandikwa kila siku.', 'No weekly rest day. Attendance must be marked for them every day.')}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{dayName(d)}</option>)}
            <option value="none">{t('Hakuna', 'No')}</option>
          </SelectField>
          {!hasDayOff ? <div style={{ marginTop: 12 }}><Chip tone="info"><CalendarX size={12} weight="bold" />{t('Hana siku ya mapumziko', 'No day off')}</Chip></div> : null}
          <div className="divider" />
          <TextField type="date" label={t('Tarehe ya kuanza kazi', 'Start date')} value={w.joined_on}
            onChange={(v) => { if (v) act.patchWorker(w.id, { joined_on: v }).then(() => toast.success(t('Imehifadhiwa.', 'Saved.'))).catch(fail); }}
            hint={w.joined_on > today
              ? t('Bado hajaanza. Mshahara wake utaanza kuhesabiwa tarehe hii.', 'Not started yet. Their pay starts counting on this date.')
              : t('Mshahara wake unahesabiwa kuanzia tarehe hii. Siku kabla ya hapa haziingii kwenye mshahara.', 'Their pay is calculated starting from this date. Days before it are not part of their salary.')} />
        </section>
        {w.active ? (
          <section className="panel">
            <h3>{t('Ondoa mfanyakazi', 'Remove worker')}</h3>
            <p className="muted" style={{ margin: '6px 0 14px' }}>{t('Hafutwi. Historia ya mishahara na mahudhurio inabaki.', 'Not erased. Salary and attendance history stays.')}</p>
            <Btn className="btn-danger" onClick={() => setRemoving(true)}><UserMinus size={18} weight="duotone" />{t('Ondoa', 'Remove')} {w.name.split(' ')[0]}</Btn>
          </section>
        ) : null}
      </div>
      <RemoveModal w={w} open={removing} onClose={() => setRemoving(false)} onDone={() => nav('/wafanyakazi')} today={today} />
    </div>
  );
}

function RemoveModal({ w, open, onClose, onDone, today }) {
  const { t, p } = useI();
  const act = useActions();
  const fail = useErr();
  const day = useDay(today).data;
  const [reason, setReason] = useState('left');
  const row = day?.owed.find((o) => o.worker_id === w.id);
  const go = async () => {
    try { await act.removeWorker(w.id, reason); toast.success(t('Mfanyakazi ameondolewa.', 'Worker removed.')); onClose(); onDone(); } catch (e) { fail(e); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t(`Ondoa ${w.name}?`, `Remove ${w.name}?`)} description={t('Atatoweka kwenye orodha za kila siku, lakini historia inabaki.', 'They leave the daily lists, but history stays.')}>
      <div className="stack">
        {row ? (
          <Callout tone="bad"><strong>{t('Hawezi kuondolewa bado.', 'Cannot be removed yet.')}</strong> {t(`Anadaiwa ${tsh(row.amount)} ya pesa ya delivery.`, `Still owes ${tsh(row.amount)} of delivery cash.`)}
            <div style={{ marginTop: 10 }}><Btn className="btn-small" onClick={() => act.handIn(row.ids).then(() => toast.success(t('Imekabidhiwa.', 'Handed in.'))).catch(fail)}>{t('Amekabidhi', 'Handed in')}</Btn></div></Callout>
        ) : null}
        <div className="field"><span className="field-label">{t('Sababu', 'Reason')}</span>
          <Seg full label={t('Sababu', 'Reason')} value={reason} onChange={setReason} options={Object.entries(REMOVE_REASONS).map(([k, v]) => [k, p(v)])} /></div>
        <div className="actions"><Btn onClick={onClose}>{t('Ghairi', 'Cancel')}</Btn><Btn className="btn-danger-solid" disabled={!!row} onClick={go}>{t('Ndiyo, mwondoe', 'Yes, remove')}</Btn></div>
      </div>
    </Modal>
  );
}

function Leave({ w }) {
  const { t, p, fmtRange } = useI();
  const act = useActions();
  const fail = useErr();
  const today = useMeta().data.today;
  const [kind, setKind] = useState('permission');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState('');
  const save = async (e) => {
    e.preventDefault();
    try { await act.addLeave(w.id, { kind, start, end, reason }); setReason(''); toast.success(t('Rekodi imehifadhiwa.', 'Record saved.')); } catch (ex) { fail(ex); }
  };
  return (
    <div className="two" style={{ marginTop: 0 }}>
      <form className="panel stack" onSubmit={save}>
        <h2>{t('Rekodi mpya', 'New record')}</h2>
        <Seg full label={t('Aina', 'Type')} value={kind} onChange={setKind} options={[['permission', t('Ruhusa', 'Permission')], ['holiday', t('Likizo', 'Holiday')]]} />
        <div className="grid-2">
          <TextField type="date" label={t('Kuanzia', 'From')} value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); }} required />
          <TextField type="date" label={t('Hadi', 'To')} value={end} min={start} onChange={setEnd} required />
        </div>
        <TextField label={t('Sababu', 'Reason')} value={reason} onChange={setReason} maxLength={200} />
        <p className="muted" style={{ fontSize: '0.9rem' }}>{t('Siku hizi zitaonekana kwenye kalenda na mahudhurio moja kwa moja.', 'These days appear in the calendar and attendance automatically.')}</p>
        <div><Btn type="submit" className="btn-primary">{t('Weka rekodi', 'Save record')}</Btn></div>
      </form>
      <section>
        <div className="sec-head"><h2>{t('Rekodi zilizopo', 'Existing records')}</h2></div>
        {w.leaves.length === 0 ? <Empty>{t('Hakuna ruhusa wala likizo.', 'No leave records.')}</Empty> : (
          <ul className="list">
            {w.leaves.map((l) => (
              <li key={l.id}>
                <Chip tone="info">{l.kind === 'permission' ? t('Ruhusa', 'Permission') : t('Likizo', 'Holiday')}</Chip>
                <span className="li-main"><strong>{fmtRange(l.start, l.end)}</strong><span>{l.reason || '—'}</span></span>
                <button type="button" className="icon-plain" aria-label={t('Futa', 'Delete')} onClick={() => act.delLeave(l.id).catch(fail)}><Trash size={18} weight="duotone" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccountTab({ w, ym, today }) {
  const { t, p, fmtDate, monthName } = useI();
  const { data: a } = useAccount(w.id, ym);
  const act = useActions();
  const fail = useErr();
  const [amt, setAmt] = useState(null);
  const [reason, setReason] = useState('');
  const [adv, setAdv] = useState(null);
  if (!a) return <PageSkeleton />;
  const putShort = async (e) => {
    e.preventDefault();
    if (!amt || !reason.trim()) { toast.warning(t('Andika kiasi na sababu.', 'Enter the amount and a reason.')); return; }
    try { await act.addShortage(w.id, { amount: amt, reason: reason.trim() }); setAmt(null); setReason(''); toast.success(t('Upungufu umeandikwa kwenye akaunti.', 'Shortage written on the account.')); } catch (ex) { fail(ex); }
  };
  const putAdv = async (e) => {
    e.preventDefault();
    if (!adv) return;
    try { await act.addAdvance({ worker_id: w.id, amount: adv }); setAdv(null); toast.success(t('Advansi imewekwa.', 'Advance saved.')); } catch (ex) { fail(ex); }
  };
  const label = (en) => {
    if (en.kind === 'base') return [t('Mshahara wa msingi', 'Base pay'), w.pay_type === 'monthly' ? t('Mshahara wa mwezi baada ya siku zisizolipwa', 'Monthly salary after unpaid days') : t('Kiwango cha siku × siku zilizofanyiwa kazi', 'Daily rate × days worked')];
    if (en.kind === 'advance') return [`${t('Advansi', 'Advance')}, ${fmtDate(en.date)}`, null];
    return [`${t('Upungufu', 'Shortage')}, ${fmtDate(en.date)}${en.section ? `, ${p(SECTIONS[en.section])}` : ''}`, en.source === 'cash_count' ? t('Kutoka hesabu ya pesa', 'From the cash count') : `${t('Ameandika meneja', 'Written by the manager')}: ${en.reason}`];
  };

  return (
    <div className="two" style={{ marginTop: 0 }}>
      <div className="stack">
        <div className="paycard">
          <p style={{ opacity: 0.75, fontWeight: 500 }}>{t('Anayepaswa kulipwa sasa', 'Payable now')}</p>
          <p className="bignum"><span className="cur">TSh</span>{num(a.net)}</p>
          <div className="trio">
            <div><small>{t('Mshahara wa msingi', 'Base pay')}</small><b>{tsh(a.base)}</b></div>
            <div><small>{t('Advansi', 'Advances')}</small><b>− {tsh(a.advances)}</b></div>
            <div><small>{t('Upungufu', 'Shortages')}</small><b>− {tsh(a.shortages)}</b></div>
          </div>
        </div>
        {a.owed ? <Callout tone="warn">{t(`Bado anadaiwa ${tsh(a.owed)} ya pesa ya delivery.`, `Still owes ${tsh(a.owed)} of delivery cash.`)}</Callout> : null}
        {a.owed_by_company ? (
          <Callout tone="bad">
            <strong>{t(`Anaidai kampuni ${tsh(a.owed_by_company)}`, `Owed ${tsh(a.owed_by_company)} by the company`)}</strong>
            {t(' — mshahara wa miezi iliyopita ambao bado haujalipwa.', ' — approved salary from previous months that has not been paid yet.')}
            <div className="stack" style={{ marginTop: 10, gap: 6 }}>
              {a.unpaid_months.map((m) => (
                <div key={m.line_id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <span>{monthName(m.month)}: <strong>{tsh(m.net)}</strong></span>
                  <Btn className="btn-quiet btn-small" onClick={() => act.markPaid(m.line_id, true).then(() => toast.success(t('Imewekwa amelipwa.', 'Marked paid.'))).catch(fail)}>
                    {t('Weka amelipwa', 'Mark paid')}
                  </Btn>
                </div>
              ))}
            </div>
          </Callout>
        ) : null}
        {a.locked ? <Callout tone="info">{t('Orodha ya mishahara ya mwezi huu imeidhinishwa. Makato yamefungwa.', 'This month’s salary list is approved. Deductions are locked.')}</Callout> : (
          <>
            <form className="panel stack" onSubmit={putShort}>
              <h3>{t('Weka upungufu kwenye akaunti', 'Write a shortage on this account')}</h3>
              <MoneyInput label={t('Kiasi', 'Amount')} value={amt} onChange={setAmt} />
              <TextField label={t('Sababu (lazima)', 'Reason (required)')} value={reason} onChange={setReason} placeholder={t('mf. Vikombe vilivyovunjika', 'e.g. Broken cups')} maxLength={200} />
              <div><Btn type="submit" className="btn-primary">{t('Weka upungufu', 'Write shortage')}</Btn></div>
            </form>
            <form className="panel stack" onSubmit={putAdv}>
              <h3>{t('Advansi mpya', 'New advance')}</h3>
              <MoneyInput label={t('Kiasi', 'Amount')} value={adv} onChange={setAdv} hint={t('Itakatwa mwisho wa mwezi.', 'Deducted at the end of the month.')} />
              <div><Btn type="submit" className="btn-quiet">{t('Weka advansi', 'Save advance')}</Btn></div>
            </form>
          </>
        )}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>{t('Taarifa ya akaunti', 'Account statement')}</h2></div>
        <div className="stmt">
          <div className="h">{t('Maelezo', 'Item')}</div><div className="h r">{t('Kiasi', 'Amount')}</div><div className="h r">{t('Baki', 'Balance')}</div>
          {a.entries.map((en, i) => {
            const [main, sub] = label(en);
            const waived = en.status === 'waived';
            return (
              <Row key={i}>
                <div className={`c${waived ? ' waived' : ''}`}>
                  {main}{sub ? <small>{sub}</small> : null}
                  {en.kind === 'shortage' && !a.locked ? <button type="button" className="btn-ghost" style={{ padding: 0, fontSize: '0.82rem' }} onClick={() => act.setShortage(en.id, waived ? 'applied' : 'waived').catch(fail)}>{waived ? t('Rudisha makato', 'Deduct again') : t('Samehe', 'Waive')}</button> : null}
                  {waived ? <Chip className="" tone="neutral">{t('Imesamehewa', 'Waived')}</Chip> : null}
                </div>
                <div className={`c r ${waived ? 'waived' : en.amount < 0 ? 'neg' : 'pos'}`}>{en.amount < 0 ? '−' : '+'} {num(Math.abs(en.amount))}</div>
                <div className="c r">{num(en.balance)}</div>
              </Row>
            );
          })}
          <div className="c tot">{t('Atalipwa', 'Net pay')}</div><div className="c tot" /><div className="c tot r">{tsh(a.net)}</div>
        </div>
      </section>
    </div>
  );
}

const Row = ({ children }) => <>{children}</>;
