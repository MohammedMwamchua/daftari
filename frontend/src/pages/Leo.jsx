import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle, TrendDown, TrendUp } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useDay, useErr, useMeta } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { num, pct, sum, tsh } from '../format.js';
import { ROLES, SECTIONS, STEPS } from '../vocab.js';
import { Avatar, Btn, Chip, CountUp, Empty, Leader, Page, PageSkeleton, Rise, StatusChip } from '../components/ui.jsx';
import { BarsChart, Ring, Spark } from '../components/charts.jsx';

let introPlayed = false;

export default function Leo() {
  const { t, p, L, fmtDate, longDate, dayShort, dayName } = useI();
  const today = useMeta().data.today;
  const { data: d } = useDay(today);
  const act = useActions();
  const fail = useErr();
  const nav = useNavigate();
  const [intro] = useState(() => !introPlayed);
  useEffect(() => { introPlayed = true; }, []);
  if (!d) return <PageSkeleton />;

  const closed = d.closed;
  const next = [0, 1, 2, 3, 4, 5].find((i) => !d.visited.includes(i)) ?? 5;
  const doneCount = closed ? 6 : d.visited.length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? t('Habari za asubuhi', 'Good morning') : hour < 17 ? t('Habari za mchana', 'Good afternoon') : t('Habari za jioni', 'Good evening');
  const delta = pct(d.sales_total, d.yesterday.total);
  const weekTotal = sum(d.week, (r) => r.total);
  const weekDelta = pct(weekTotal, d.week_prev_total);
  const bars = d.week.map((r, i) => ({
    value: r.total, label: dayShort(r.dow), hot: i === d.week.length - 1, tip: `${dayName(r.dow)} ${r.date.slice(8)}`,
  }));
  const diff = d.difference_total;
  const tone = !d.has_count ? undefined : diff === 0 ? 'good' : diff < 0 ? 'bad' : 'warn';
  const present = d.attendance.filter((w) => ['present', 'late'].includes(w.status)).length;
  const away = d.attendance.filter((w) => ['dayoff', 'permission', 'holiday'].includes(w.status)).length;
  const unmarked = d.attendance.filter((w) => !w.status).length;

  const handIn = async (row) => { try { await act.handIn(row.ids); toast.success(t(`${row.name} amekabidhi pesa.`, `${row.name} handed in the cash.`)); } catch (e) { fail(e); } };
  const flip = async (s) => { try { await act.setShortage(s.id, s.status === 'waived' ? 'applied' : 'waived'); } catch (e) { fail(e); } };

  return (
    <Page>
      <div className={intro ? 'intro' : undefined}>
        <header className="greet">
          <p className="muted">{hello}, {t('Meneja', 'Manager')}</p>
          <h1>{closed ? t('Siku ya leo imefungwa', 'Today is closed') : t('Funga siku ya leo', "Close today's books")}</h1>
        </header>

        <section className="ticket" aria-label={t('Tiketi ya leo', "Today's ticket")}>
          <div className="ticket-main">
            <div className="kanga" aria-hidden="true" />
            <div className="ticket-body">
              <p className="muted">{t('Mauzo ya leo', 'Sales today')}, {longDate(d.date, d.dow)}</p>
              <p className="bignum"><span className="cur">TSh</span><CountUp value={d.sales_total} /></p>
              <p className="delta-line">
                <Chip tone={delta >= 0 ? 'good' : 'bad'}>
                  {delta >= 0 ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                  {Math.abs(delta)}% {delta >= 0 ? t('juu ya jana', 'above yesterday') : t('chini ya jana', 'below yesterday')}
                </Chip>
                {closed ? <span className="stamp">{t('IMEFUNGWA', 'CLOSED')}</span> : null}
              </p>
              <Spark data={d.week.map((r) => ({ value: r.total }))} />
              <div className="ledger flat on-dark-ledger">
                <Leader idx={0} label={t('Banda', 'Stall')} value={tsh(d.sales.banda)} />
                <Leader idx={1} label={t('Mgahawa', 'Restaurant')} value={tsh(d.sales.mgahawa)} />
                <Leader idx={2} label={t('Matumizi ya leo', "Today's expenses")} value={`− ${tsh(d.expenses_total)}`} />
                <Leader idx={3} strong tone={tone} label={t('Tofauti ya pesa', 'Cash difference')}
                  sub={!d.has_count ? t('Bado haijahesabiwa', 'Not counted yet') : diff === 0 ? t('Pesa zote zinalingana', 'Everything adds up') : diff < 0 ? t('Upungufu', 'Shortage') : t('Ziada', 'Surplus')}
                  value={!d.has_count ? '—' : diff === 0 ? tsh(0) : `${diff < 0 ? '−' : '+'}${num(Math.abs(diff))}`} />
              </div>
              <div className="splitbar" role="img" aria-label={`${t('Pesa taslimu', 'Cash')} ${tsh(d.cash_total)}, ${t('Pesa za simu', 'Mobile money')} ${tsh(d.mobile_total)}`}>
                <span style={{ flex: d.cash_total || 1 }} /><span style={{ flex: d.mobile_total || 1 }} />
              </div>
              <div className="splitkey">
                <div><i className="k0" /><span>{t('Pesa taslimu', 'Cash')}</span><strong>{tsh(d.cash_total)}</strong></div>
                <div><i className="k1" /><span>{t('Pesa za simu', 'Mobile money')}</span><strong>{tsh(d.mobile_total)}</strong></div>
              </div>
            </div>
          </div>

          <div className="ticket-stub">
            <span className="notch t" aria-hidden="true" /><span className="notch b" aria-hidden="true" />
            <div className="stub-head">
              <Ring done={doneCount} now={closed ? -1 : next} />
              <div>
                <h2>{closed ? t('Kila kitu kimekamilika', 'Everything is done') : t(`Hatua ${doneCount} kati ya 6`, `${doneCount} of 6 steps done`)}</h2>
                <p className="muted">{closed ? t('Siku imefungwa', 'The day is locked') : t(`Inayofuata: ${STEPS[next][0]}`, `Next: ${STEPS[next][1]}`)}</p>
              </div>
            </div>
            <ol className="steps">
              {STEPS.map((st, i) => {
                const done = closed || d.visited.includes(i);
                return (
                  <li key={i} className={!done && i === next ? 'is-now' : undefined}>
                    <button type="button" onClick={() => nav(`/funga/${i}`)}>
                      <span className={`tick${done ? ' done' : i === next ? ' now' : ''}`}>{done ? <Check size={13} weight="bold" /> : i + 1}</span>
                      <span>{p(st)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {!closed ? (
              <Link to={`/funga/${next}`} className="btn btn-primary btn-block">{t('Endelea', 'Continue')}<ArrowRight size={18} weight="bold" /></Link>
            ) : null}
          </div>
        </section>

        <Rise className="panel" style={{ marginTop: '2rem' }}>
          <div className="panel-head">
            <div><h2>{t('Wiki hii', 'This week')}</h2><p className="muted">{t('Siku 7 za mwisho', 'The last 7 days')}</p></div>
            <div className="panel-stat">
              <span><span className="cur">TSh</span>{num(weekTotal)}</span>
              <Chip tone={weekDelta >= 0 ? 'good' : 'bad'}>{weekDelta >= 0 ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}{Math.abs(weekDelta)}%</Chip>
            </div>
          </div>
          <BarsChart bars={bars} label={t('Mauzo ya siku 7 za mwisho. Leo imeangaziwa kwa dhahabu.', 'Sales for the last 7 days. Today is highlighted in gold.')} />
        </Rise>

        <div className="two">
          <Rise as="section">
            <div className="sec-head">
              <h2>{t('Wafanyakazi leo', 'Workers today')}</h2>
              <div className="chips">
                <Chip tone="good">{present} {t('wapo kazini', 'at work')}</Chip>
                {away ? <Chip tone="info">{away} {t('hawapo', 'away')}</Chip> : null}
                {unmarked ? <Chip tone="warn">{unmarked} {t('hawajaandikwa', 'not marked')}</Chip> : null}
              </div>
            </div>
            <ul className="list">
              {d.attendance.map((w) => (
                <li key={w.worker_id}>
                  <Avatar name={w.name} />
                  <Link to={`/wafanyakazi/${w.worker_id}`} className="li-main" style={{ textDecoration: 'none' }}><strong>{w.name}</strong><span>{p(ROLES[w.role])}</span></Link>
                  <StatusChip k={w.status} />
                </li>
              ))}
            </ul>
          </Rise>

          <Rise as="section" delay={0.08}>
            <div className="sec-head"><h2>{t('Yanayosubiri wewe', 'Waiting for you')}</h2></div>
            {d.owed.length === 0 && d.shortages.length === 0 && d.unpaid_salaries.length === 0 ? (
              <Empty icon={CheckCircle}>{t('Hakuna kinachosubiri. Kazi nzuri.', 'Nothing is waiting. Good work.')}</Empty>
            ) : (
              <ul className="list">
                {d.owed.map((o) => (
                  <li key={`o${o.worker_id}`}>
                    <Chip tone="warn">{t('Anadaiwa', 'Owes')}</Chip>
                    <span className="li-main"><strong>{o.name}</strong><span>{t('Pesa ya delivery haijakabidhiwa', 'Delivery cash not handed in')}</span></span>
                    <span className="li-amt">{tsh(o.amount)}</span>
                    <Btn className="btn-quiet btn-small" onClick={() => handIn(o)}>{t('Amekabidhi', 'Handed in')}</Btn>
                  </li>
                ))}
                {d.shortages.map((s) => (
                  <li key={`s${s.id}`}>
                    <Chip tone={s.status === 'waived' ? 'neutral' : 'bad'}>{s.status === 'waived' ? t('Imesamehewa', 'Waived') : t('Upungufu', 'Shortage')}</Chip>
                    <span className="li-main"><strong>{s.worker_name}</strong><span>{fmtDate(s.date)}{s.section ? `, ${p(SECTIONS[s.section])}` : ''}</span></span>
                    <span className="li-amt" style={s.status === 'waived' ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{tsh(s.amount)}</span>
                    <Btn className="btn-quiet btn-small" onClick={() => flip(s)}>{s.status === 'waived' ? t('Rudisha makato', 'Deduct again') : t('Samehe', 'Waive')}</Btn>
                    <Link to={`/wafanyakazi/${s.worker_id}?tab=account`} className="btn-ghost">{t('Akaunti', 'Account')}</Link>
                  </li>
                ))}
                {d.unpaid_salaries.map((u) => (
                  <li key={`u${u.worker_id}`}>
                    <Chip tone="bad">{t('Haijalipwa', 'Unpaid')}</Chip>
                    <span className="li-main"><strong>{u.name}</strong><span>{t('Anaidai kampuni, mshahara wa mwezi uliopita', 'Owed by the company, from a previous month')}</span></span>
                    <span className="li-amt">{tsh(u.amount)}</span>
                    <Link to={`/wafanyakazi/${u.worker_id}?tab=account`} className="btn btn-quiet btn-small">{t('Akaunti', 'Account')}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Rise>
        </div>
      </div>
    </Page>
  );
}
