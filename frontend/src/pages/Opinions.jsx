import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowSquareOut, ChatCircleText, Checks, CookingPot, EyeSlash, ForkKnife, Star, Trash, UserCircle } from '@phosphor-icons/react';
import { useActions, useErr, useOpinions } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { OPINION_SOURCES, OPINION_TOPICS } from '../vocab.js';
import { Btn, Chip, Empty, Modal, Page, PageSkeleton, Seg } from '../components/ui.jsx';

const SOURCE_ICON = { customer: ForkKnife, worker: CookingPot };

/* "5 minutes ago" for recent ones, the date and time after a week. */
function useWhen() {
  const { t, lang, fmtDate } = useI();
  const rtf = new Intl.RelativeTimeFormat(lang === 'sw' ? 'sw' : 'en', { numeric: 'auto' });
  return (iso) => {
    const at = new Date(iso);
    const mins = Math.round((at - Date.now()) / 60_000);
    if (mins >= 0) return t('Sasa hivi', 'Just now');
    if (mins > -60) return rtf.format(mins, 'minute');
    if (mins > -24 * 60) return rtf.format(Math.round(mins / 60), 'hour');
    if (mins > -7 * 24 * 60) return rtf.format(Math.round(mins / (24 * 60)), 'day');
    const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    return `${fmtDate(local)} ${at.getFullYear()}, ${at.toTimeString().slice(0, 5)}`;
  };
}

const Stars = ({ n, label }) => (
  <span className="op-rating" role="img" aria-label={label}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={15} weight={i <= n ? 'fill' : 'regular'} className={i <= n ? 'on' : undefined} aria-hidden="true" />)}
  </span>
);

/* The manager's inbox for what customers and workers sent through the public form. */
export default function Opinions() {
  const { t, p } = useI();
  const { data } = useOpinions();
  const act = useActions();
  const fail = useErr();
  const when = useWhen();
  const [who, setWho] = useState('all');
  const [only, setOnly] = useState('all');
  const [doomed, setDoomed] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <PageSkeleton />;

  const c = data.counts;
  const list = data.opinions.filter((o) => (who === 'all' || o.source === who) && (only === 'all' || !o.read));
  const count = (label, n) => <>{label}<em className="seg-count">{n}</em></>;

  const toggle = (o) => act.readOpinion(o.id, !o.read).catch(fail);
  const readAll = async () => {
    setBusy(true);
    try { await act.readAllOpinions(); toast.success(t('Maoni yote yamewekwa kama yamesomwa.', 'All feedback marked as read.')); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await act.delOpinion(doomed.id); setDoomed(null); toast.success(t('Maoni yamefutwa.', 'Feedback deleted.')); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <Page>
      <header className="page-head">
        <div><p className="muted">{t('Sauti ya wateja na wafanyakazi', 'What customers and workers say')}</p><h1>{t('Maoni', 'Feedback')}</h1></div>
        <div className="row">
          <a className="btn" href="/toa-maoni" target="_blank" rel="noreferrer"><ArrowSquareOut size={18} weight="bold" />{t('Fungua fomu', 'Open the form')}</a>
          <Btn className="btn-primary" disabled={!c.unread} loading={busy && !doomed} onClick={readAll}><Checks size={18} weight="bold" />{t('Soma yote', 'Mark all read')}</Btn>
        </div>
      </header>

      <div className="kpis op-kpis">
        <div className="kpi accent"><small>{t('Hayajasomwa', 'Unread')}</small><b>{c.unread}</b></div>
        <div className="kpi"><small>{t('Jumla ya maoni', 'All feedback')}</small><b>{c.total}</b></div>
        <div className="kpi"><small>{t('Wateja · Wafanyakazi', 'Customers · Workers')}</small><b>{c.customer} · {c.worker}</b></div>
        <div className="kpi gold">
          <small>{t('Wastani wa nyota', 'Average stars')}</small>
          <b>{c.average_rating != null ? <>{c.average_rating.toFixed(1)} <Star size={22} weight="fill" aria-hidden="true" /></> : '—'}</b>
          <small>{c.rated ? t(`Kutoka maoni ${c.rated} yenye nyota`, `From ${c.rated} rated`) : t('Bado hakuna nyota', 'No stars yet')}</small>
        </div>
      </div>

      <div className="list-tools op-filters">
        <Seg label={t('Kutoka kwa', 'From')} value={who} onChange={setWho}
          options={[['all', count(t('Wote', 'All'), c.total)], ['customer', count(t('Wateja', 'Customers'), c.customer)], ['worker', count(t('Wafanyakazi', 'Workers'), c.worker)]]} />
        <Seg label={t('Onyesha', 'Show')} value={only} onChange={setOnly}
          options={[['all', t('Yote', 'All')], ['unread', count(t('Mapya', 'New'), c.unread)]]} />
      </div>

      {list.length === 0 ? (
        <Empty icon={ChatCircleText}>
          {c.total === 0 ? t('Bado hakuna maoni. Shiriki kiungo cha fomu na wateja na wafanyakazi.', 'No feedback yet. Share the form link with customers and workers.')
            : t('Hakuna maoni yanayolingana na uchaguzi huu.', 'No feedback matches this filter.')}
        </Empty>
      ) : (
        <ol className="op-list">
          {list.map((o, i) => {
            const Icon = SOURCE_ICON[o.source];
            return (
              <motion.li key={o.id} className={`op-card${o.read ? '' : ' unread'}`}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                <header>
                  <span className={`op-ico ${o.source}`}><Icon size={20} weight="duotone" aria-hidden="true" /></span>
                  <div className="op-meta">
                    <strong>{p(OPINION_SOURCES[o.source])}</strong>
                    <Chip>{p(OPINION_TOPICS[o.topic])}</Chip>
                    {o.rating ? <Stars n={o.rating} label={t(`Nyota ${o.rating} kati ya 5`, `${o.rating} of 5 stars`)} /> : null}
                    {!o.read ? <Chip tone="brass">{t('Mapya', 'New')}</Chip> : null}
                  </div>
                  <time dateTime={o.created_at}>{when(o.created_at)}</time>
                </header>
                <p className="op-msg">{o.message}</p>
                <footer>
                  <span className="op-contact">
                    {o.contact ? <><UserCircle size={17} weight="duotone" aria-hidden="true" />{o.contact}</>
                      : <><EyeSlash size={17} weight="duotone" aria-hidden="true" />{t('Bila jina', 'Anonymous')}</>}
                  </span>
                  <span className="op-actions">
                    <Btn className="btn-quiet btn-small" onClick={() => toggle(o)}>{o.read ? t('Weka kama mapya', 'Mark as new') : t('Weka kama yamesomwa', 'Mark as read')}</Btn>
                    <button type="button" className="icon-plain" onClick={() => setDoomed(o)} aria-label={t('Futa maoni haya', 'Delete this feedback')}><Trash size={18} /></button>
                  </span>
                </footer>
              </motion.li>
            );
          })}
        </ol>
      )}

      <Modal open={!!doomed} onClose={() => setDoomed(null)} title={t('Futa maoni haya?', 'Delete this feedback?')}
        description={t('Yakishafutwa hayawezi kurudishwa.', 'Once deleted it cannot be brought back.')}>
        {doomed ? <p className="op-msg op-quote">{doomed.message}</p> : null}
        <div className="actions">
          <Btn onClick={() => setDoomed(null)}>{t('Ghairi', 'Cancel')}</Btn>
          <Btn className="btn-danger-solid" loading={busy} onClick={remove}><Trash size={18} weight="bold" />{t('Futa', 'Delete')}</Btn>
        </div>
      </Modal>
    </Page>
  );
}
