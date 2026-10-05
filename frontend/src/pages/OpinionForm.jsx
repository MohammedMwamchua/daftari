import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, CookingPot, ForkKnife, LockSimple, PaperPlaneRight, Star, User } from '@phosphor-icons/react';
import { api } from '../api.js';
import { useI } from '../i18n.jsx';
import { OPINION_TOPICS } from '../vocab.js';
import { Btn } from '../components/ui.jsx';
import { LangSwitch } from '../components/Tools.jsx';
import backdrop from '../assets/login-backdrop.webp';
import logo from '../assets/stonetown-logo.webp';

const EASE = [0.22, 1, 0.36, 1];
const MAX = 1000;
const STARS = [1, 2, 3, 4, 5];
const STAR_WORDS = [null, ['Mbaya sana', 'Very bad'], ['Mbaya', 'Bad'], ['Wastani', 'Okay'], ['Nzuri', 'Good'], ['Nzuri sana', 'Excellent']];
const EMPTY = { source: '', rating: 0, topic: '', message: '', contact: '', website: '' };

/* The public opinions form (/toa-maoni). No login: customers and workers send what they think, anonymously unless they
   write a name. Same dark StoneTown look as the sign-in screen. */
export default function OpinionForm() {
  const { t, p } = useI();
  const [f, setF] = useState(EMPTY);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setErr(''); }; // any change clears the last error

  useEffect(() => {
    const before = document.title;
    document.title = `${t('Toa maoni', 'Feedback')} · Stone Town`;
    return () => { document.title = before; };
  }, [t]);

  // on a shared device at the counter, the thank-you screen clears itself for the next person
  useEffect(() => {
    if (!sent) return undefined;
    const id = setTimeout(() => { setF(EMPTY); setSent(false); }, 20_000);
    return () => clearTimeout(id);
  }, [sent]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.source) { setErr(t('Chagua kama wewe ni mteja au mfanyakazi.', 'Choose whether you are a customer or a worker.')); return; }
    if (f.message.trim().length < 3) { setErr(t('Andika maoni yako kwanza.', 'Please write your feedback first.')); return; }
    setBusy(true); setErr('');
    try {
      await api.submitOpinion({ source: f.source, rating: f.rating || null, topic: f.topic || null, message: f.message, contact: f.contact, website: f.website });
      setSent(true);
    } catch (ex) {
      setErr(ex.status === 429 ? t('Umetuma maoni mengi kwa muda mfupi. Jaribu tena baadaye kidogo.', 'You have sent a lot of feedback in a short time. Please try again a little later.')
        : ex.status === 400 ? t('Angalia ulichoandika kisha ujaribu tena.', 'Please check what you wrote and try again.')
          : t('Imeshindwa kutuma. Angalia mtandao kisha ujaribu tena.', 'Could not send. Check the connection and try again.'));
    } finally { setBusy(false); }
  };

  const shown = hover || f.rating;

  return (
    <div className="auth op-page" style={{ '--backdrop': `url(${backdrop})` }}>
      <div className="auth-tools"><LangSwitch /></div>

      <motion.main className="op" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
        <img className="op-logo" src={logo} width="512" height="512" alt="Stone Town Grill & Restaurant" />

        <section className="auth-panel op-panel">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div key="thanks" className="op-thanks" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} role="status">
                <CheckCircle size={64} weight="duotone" aria-hidden="true" />
                <h1>{t('Asante sana!', 'Thank you!')}</h1>
                <p>{t('Maoni yako yamefika kwa meneja. Yanatusaidia kuboresha kila siku.', 'Your feedback has reached the manager. It helps us get better every day.')}</p>
                <Btn className="btn-primary auth-submit" onClick={() => { setF(EMPTY); setSent(false); }}>{t('Tuma maoni mengine', 'Send more feedback')}</Btn>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div className="auth-head">
                  <h1>{t('Tupe maoni yako', 'Tell us what you think')}</h1>
                  <p>{t('Huna haja ya kuandika jina lako.', "You don't need to give your name.")}</p>
                </div>

                <form className="op-form" onSubmit={submit} noValidate>
                  <fieldset className="op-q">
                    <legend>{t('Wewe ni nani?', 'Who are you?')}</legend>
                    <div className="op-who">
                      {[['customer', ForkKnife, t('Mteja', 'Customer'), t('Nimekula au kununua hapa', 'I ate or bought here')],
                        ['worker', CookingPot, t('Mfanyakazi', 'Worker'), t('Ninafanya kazi hapa', 'I work here')]].map(([v, Icon, title, sub]) => (
                        <label key={v} className="op-opt">
                          <input type="radio" name="source" value={v} checked={f.source === v} onChange={() => set('source')(v)} />
                          <Icon size={26} weight="duotone" aria-hidden="true" />
                          <span><strong>{title}</strong><small>{sub}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="op-q">
                    <legend>{t('Unatupa nyota ngapi?', 'How many stars?')} <small>{t('(si lazima)', '(optional)')}</small></legend>
                    {/* tapping the chosen star (or topic) again clears it */}
                    <div className="op-stars" onMouseLeave={() => setHover(0)}>
                      {STARS.map((n) => (
                        <label key={n} className={`op-star${shown >= n ? ' on' : ''}`} onMouseEnter={() => setHover(n)}>
                          <input type="radio" name="rating" value={n} checked={f.rating === n} onChange={() => set('rating')(n)} onClick={() => f.rating === n && set('rating')(0)} />
                          <Star size={34} weight={shown >= n ? 'fill' : 'regular'} aria-hidden="true" />
                          <span className="sr">{n} {t('nyota', n === 1 ? 'star' : 'stars')}</span>
                        </label>
                      ))}
                      <span className="op-star-word" aria-hidden="true">{shown ? p(STAR_WORDS[shown]) : ''}</span>
                    </div>
                  </fieldset>

                  <fieldset className="op-q">
                    <legend>{t('Kuhusu nini?', 'What is it about?')} <small>{t('(si lazima)', '(optional)')}</small></legend>
                    <div className="op-topics">
                      {Object.entries(OPINION_TOPICS).map(([k, pair]) => (
                        <label key={k} className="op-chip">
                          <input type="radio" name="topic" value={k} checked={f.topic === k} onChange={() => set('topic')(k)} onClick={() => f.topic === k && set('topic')('')} />
                          <span>{p(pair)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="op-q">
                    <label className="op-label" htmlFor="op-message">{t('Maoni yako', 'Your feedback')}</label>
                    <div className="op-text">
                      <textarea id="op-message" rows={5} maxLength={MAX} value={f.message} onChange={(e) => set('message')(e.target.value)}
                        placeholder={t('Tuambie kilichokufurahisha, au tunachopaswa kuboresha…', 'Tell us what you liked, or what we should do better…')} />
                    </div>
                    <span className="op-count" aria-live="polite">{f.message.length} / {MAX}</span>
                  </div>

                  <div className="op-q">
                    <label className="op-label" htmlFor="op-contact">{t('Jina au namba ya simu', 'Name or phone number')} <small>{t('(si lazima)', '(optional)')}</small></label>
                    <div className="auth-input">
                      <User size={19} weight="duotone" aria-hidden="true" />
                      <input id="op-contact" maxLength={100} autoComplete="off" value={f.contact} onChange={(e) => set('contact')(e.target.value)}
                        placeholder={t('Acha wazi ili ubaki bila jina', 'Leave empty to stay anonymous')} />
                    </div>
                    <p className="op-hint">
                      {f.source === 'worker'
                        ? t('Ukiacha wazi, meneja ataona tu kuwa maoni yametoka kwa mfanyakazi, si nani.', 'If you leave it empty, the manager only sees that it came from a worker, not who.')
                        : t('Andika tu kama ungependa tukujibu.', 'Only add it if you would like a reply.')}
                    </p>
                  </div>

                  {/* a field people never see; only bots fill it in */}
                  <div className="op-hp" aria-hidden="true">
                    <label>Website<input name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website')(e.target.value)} /></label>
                  </div>

                  {err ? <p className="auth-error" role="alert">{err}</p> : null}
                  <Btn type="submit" className="btn-primary btn-block auth-submit" loading={busy}>
                    {t('Tuma maoni', 'Send feedback')}<PaperPlaneRight size={18} weight="bold" aria-hidden="true" />
                  </Btn>
                </form>

                <p className="auth-foot op-privacy">
                  <LockSimple size={14} weight="bold" aria-hidden="true" />
                  {t('Hatuhifadhi chochote kinachokutambulisha, isipokuwa ukiandika jina au namba.', "We don't keep anything that identifies you, unless you write your name or number.")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </motion.main>
    </div>
  );
}
