import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeSlash, LockKey } from '@phosphor-icons/react';
import { api } from '../api.js';
import { useI } from '../i18n.jsx';
import { Btn, Callout, Logo, TextField } from '../components/ui.jsx';
import { Tools } from '../components/Tools.jsx';

export default function Login({ onDone, theme, toggle }) {
  const { t } = useI();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api.login(user.trim(), pass); onDone(); }
    catch (ex) { setErr(ex.status === 401 || ex.status === 400 ? t('Jina au nenosiri si sahihi.', 'Wrong username or password.') : t('Imeshindwa kuunganisha na seva.', 'Could not reach the server.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <section className="login-art" aria-hidden="true">
        <div className="kanga" />
        <div className="brand" style={{ padding: 0 }}><Logo size={52} /><div><b>Daftari</b><small>{t('Daftari la mgahawa', 'Restaurant ledger')}</small></div></div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <h1>{t('Hesabu zako, wazi kama kioo.', 'Your books, clear as glass.')}</h1>
          <p>{t('Mauzo, pesa, wafanyakazi na mishahara ya banda na mgahawa. Mahali pamoja.', 'Sales, cash, workers and salaries for the stall and restaurant. All in one place.')}</p>
        </motion.div>
        <motion.div className="float-card" style={{ right: '8%', top: '22%' }} animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <small>{t('Mauzo ya leo', 'Sales today')}</small><b>TSh 566,000</b>
        </motion.div>
        <motion.div className="float-card" style={{ right: '22%', bottom: '24%' }} animate={{ y: [0, 10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
          <small>{t('Tofauti ya pesa', 'Cash difference')}</small><b>TSh 0 ✓</b>
        </motion.div>
      </section>

      <section className="login-form">
        <div className="tools"><Tools theme={theme} toggle={toggle} /></div>
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
          <div><p className="eyebrow">{t('Karibu tena', 'Welcome back')}</p><h1 style={{ fontSize: '2.2rem', marginTop: 6 }}>{t('Ingia kama meneja', 'Sign in as manager')}</h1></div>
          <TextField label={t('Jina la mtumiaji', 'Username')} value={user} onChange={setUser} autoComplete="username" autoFocus required />
          <label className="field">
            <span className="field-label">{t('Nenosiri', 'Password')}</span>
            <span className="money" style={{ gap: 10 }}>
              <LockKey size={20} weight="duotone" aria-hidden="true" />
              <input style={{ fontFamily: 'var(--font-text)', fontSize: '1rem', fontWeight: 400 }} type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="icon-plain" onClick={() => setShow((s) => !s)} aria-label={t('Onyesha nenosiri', 'Show password')} style={{ marginRight: -8 }}>
                {show ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          {err ? <Callout tone="bad">{err}</Callout> : null}
          <Btn type="submit" className="btn-primary btn-block" loading={busy} style={{ minHeight: 52 }}>
            {t('Ingia', 'Sign in')}<ArrowRight size={18} weight="bold" />
          </Btn>
        </motion.form>
      </section>
    </div>
  );
}
