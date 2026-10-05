import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeSlash, LockKey, User } from '@phosphor-icons/react';
import { api } from '../api.js';
import { useI } from '../i18n.jsx';
import { Btn } from '../components/ui.jsx';
import { LangSwitch } from '../components/Tools.jsx';
import plate from '../assets/login-plate.webp';
import backdrop from '../assets/login-backdrop.webp';
import logo from '../assets/stonetown-logo.webp';

// Set by the public demo build (Dockerfile). The demo login comes from `seed_demo`.
const DEMO = import.meta.env.VITE_DEMO === '1';

const EASE = [0.22, 1, 0.36, 1];
const rise = (delay) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } });

/* Always the dark, candle-lit StoneTown look, whatever theme the app itself is set to. */
export default function Login({ onDone }) {
  const { t } = useI();
  const [user, setUser] = useState(DEMO ? 'manager' : '');
  const [pass, setPass] = useState(DEMO ? 'daftari123' : '');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) { setErr(t('Jaza jina la mtumiaji na nenosiri.', 'Enter your username and password.')); return; }
    setBusy(true); setErr('');
    try { await api.login(user.trim(), pass); onDone(); }
    catch (ex) { setErr(ex.status === 401 || ex.status === 400 ? t('Jina au nenosiri si sahihi.', 'Wrong username or password.') : t('Imeshindwa kuunganisha na seva.', 'Could not reach the server.')); }
    finally { setBusy(false); }
  };

  const invalid = err ? { 'aria-invalid': true, 'aria-describedby': 'login-error' } : {};

  return (
    <div className="auth" style={{ '--backdrop': `url(${backdrop})` }}>
      <div className="auth-tools"><LangSwitch /></div>

      <motion.main className="auth-frame" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: EASE }}>
        <section className="auth-hero">
          <motion.img {...rise(0.1)} className="auth-logo" src={logo} width="512" height="512" alt="Stone Town Grill & Restaurant" />
          <motion.figure className="auth-plate" initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1.1, delay: 0.15, ease: EASE }}>
            <img src={plate} alt="" width="720" height="720" fetchPriority="high" decoding="async" />
          </motion.figure>
          <motion.p {...rise(0.45)} className="auth-tagline">
            <span>{t('Daftari la mgahawa', 'Restaurant ledger')}</span>
            {t('Mauzo, matumizi na mishahara. Mahali pamoja.', 'Sales, expenses and salaries. All in one place.')}
          </motion.p>
        </section>

        <motion.section {...rise(0.25)} className="auth-panel">
          <div className="auth-head">
            <h1>{t('Ingia', 'Sign in')}</h1>
            <p>{t('Karibu tena, meneja.', 'Welcome back, manager.')}</p>
          </div>
          {DEMO ? (
            <p className="auth-demo" role="note">
              {t('Hili ni toleo la majaribio. Jina na nenosiri vimeshajazwa, bonyeza Ingia. Taarifa zote ni za mfano na zinarudi mwanzo seva inapoanza upya.',
                'This is a public demo. The login is filled in, so just press Sign in. All data is sample data and resets whenever the server restarts.')}
            </p>
          ) : null}

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="username">{t('Jina la mtumiaji', 'Username')}</label>
              <div className="auth-input">
                <User size={19} weight="duotone" aria-hidden="true" />
                <input id="username" name="username" type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder={t('Weka jina la mtumiaji', 'Enter your username')}
                  autoComplete="username" autoCapitalize="none" spellCheck={false} enterKeyHint="next" autoFocus required {...invalid} />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="current-password">{t('Nenosiri', 'Password')}</label>
              <div className="auth-input">
                <LockKey size={19} weight="duotone" aria-hidden="true" />
                <input id="current-password" name="password" type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('Weka nenosiri', 'Enter your password')}
                  autoComplete="current-password" enterKeyHint="go" required {...invalid} />
                <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="current-password"
                  aria-label={show ? t('Ficha nenosiri', 'Hide password') : t('Onyesha nenosiri', 'Show password')}>
                  {show ? <EyeSlash size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            {err ? <p id="login-error" className="auth-error" role="alert">{err}</p> : null}
            <Btn type="submit" className="btn-primary btn-block auth-submit" loading={busy}>
              {t('Ingia', 'Sign in')}<ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Btn>
          </form>

          <p className="auth-foot">{t('Akaunti ya meneja pekee', 'Manager account only')} · Daftari</p>
        </motion.section>
      </motion.main>
    </div>
  );
}
