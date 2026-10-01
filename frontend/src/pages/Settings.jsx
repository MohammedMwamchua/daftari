import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeSlash, LockKey, Plus, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useActions, useErr, useMeta } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { Btn, Callout, MoneyInput, Page, Tabs, TextField } from '../components/ui.jsx';

export default function Settings() {
  const { t } = useI();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'general';
  return (
    <Page>
      <header className="page-head"><div><p className="muted">{t('Weka mara moja', 'Set once')}</p><h1>{t('Mipangilio', 'Settings')}</h1></div></header>
      <Tabs label={t('Mipangilio', 'Settings')} value={tab} onChange={(v) => setSp(v === 'general' ? {} : { tab: v })}
        items={[['general', t('Jumla', 'General')], ['password', t('Nenosiri', 'Password')]]} />
      {tab === 'password' ? <PasswordTab /> : <GeneralTab />}
    </Page>
  );
}

function GeneralTab() {
  const { t, lang } = useI();
  const meta = useMeta().data;
  const act = useActions();
  const fail = useErr();
  const [flt, setFlt] = useState({ banda: meta.settings.float_banda, mgahawa: meta.settings.float_mgahawa });
  useEffect(() => setFlt({ banda: meta.settings.float_banda, mgahawa: meta.settings.float_mgahawa }), [meta.settings]);
  const [sw, setSw] = useState('');
  const [en, setEn] = useState('');

  const saveFloat = async (e) => {
    e.preventDefault();
    try { await act.saveSettings({ float_banda: flt.banda ?? 0, float_mgahawa: flt.mgahawa ?? 0 }); toast.success(t('Imehifadhiwa.', 'Saved.')); } catch (ex) { fail(ex); }
  };
  const addCat = async (e) => {
    e.preventDefault();
    if (!sw.trim()) return;
    try { await act.addCategory({ name_sw: sw, name_en: en || sw }); setSw(''); setEn(''); toast.success(t('Kundi limeongezwa.', 'Category added.')); } catch (ex) { fail(ex); }
  };

  return (
    <div className="two" style={{ marginTop: 0 }}>
      <form className="panel stack" onSubmit={saveFloat}>
        <h2>{t('Chenji ya kudumu', 'Fixed change float')}</h2>
        <p className="muted">{t('Kiasi cha chenji kinachobaki kwenye droo. Hakihesabiwi kwenye hesabu ya pesa.', 'Change kept in each till. It is left out of the cash count.')}</p>
        <MoneyInput label={t('Banda', 'Stall')} value={flt.banda} onChange={(v) => setFlt((f) => ({ ...f, banda: v }))} />
        <MoneyInput label={t('Mgahawa', 'Restaurant')} value={flt.mgahawa} onChange={(v) => setFlt((f) => ({ ...f, mgahawa: v }))} />
        <div><Btn type="submit" className="btn-primary">{t('Hifadhi', 'Save')}</Btn></div>
      </form>

      <section className="panel stack">
        <h2>{t('Makundi ya matumizi', 'Expense categories')}</h2>
        <p className="muted" style={{ marginTop: -8 }}>{t('Bonyeza jina kuficha au kuonyesha. Bonyeza × kuondoa kabisa.', 'Click the name to hide or show it. Click × to remove it completely.')}</p>
        <div className="chips">
          {meta.categories.map((c) => (
            <span key={c.id} className="chip chip-removable" style={{ opacity: c.active ? 1 : 0.5 }}>
              <button type="button" className="chip-label" title={c.active ? t('Bonyeza kuzima', 'Click to hide') : t('Bonyeza kuwasha', 'Click to show')}
                onClick={() => act.patchCategory(c.id, { active: !c.active }).catch(fail)}>{lang === 'sw' ? c.name_sw : c.name_en}</button>
              <button type="button" className="chip-x" aria-label={t('Ondoa kundi', 'Remove category')} title={t('Ondoa kabisa', 'Remove completely')}
                onClick={() => act.delCategory(c.id).then(() => toast.success(t('Kundi limeondolewa.', 'Category removed.'))).catch(fail)}>
                <X size={11} weight="bold" />
              </button>
            </span>
          ))}
        </div>
        <form className="stack" onSubmit={addCat}>
          <div className="grid-2"><TextField label={t('Jina (Kiswahili)', 'Name (Swahili)')} value={sw} onChange={setSw} /><TextField label={t('Jina (English)', 'Name (English)')} value={en} onChange={setEn} /></div>
          <div><Btn type="submit" className="btn-quiet"><Plus size={16} weight="bold" />{t('Ongeza kundi', 'Add category')}</Btn></div>
        </form>
      </section>
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="money" style={{ gap: 10 }}>
        <LockKey size={20} weight="duotone" aria-hidden="true" style={{ color: 'var(--ink-3)', flex: 'none' }} />
        <input
          style={{ fontFamily: 'var(--font-text)', fontSize: '1rem', fontWeight: 400 }}
          type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} required
        />
        <button type="button" className="icon-plain" onClick={() => setShow((s) => !s)} style={{ marginRight: -8, flex: 'none' }}
          aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

function PasswordTab() {
  const { t } = useI();
  const act = useActions();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErrors(null);
    if (next !== confirm) { setErrors([t('Nenosiri jipya na uthibitisho hazifanani.', 'New password and confirmation do not match.')]); return; }
    if (next.length < 8) { setErrors([t('Nenosiri jipya liwe na angalau herufi 8.', 'New password must be at least 8 characters.')]); return; }
    setBusy(true);
    try {
      await act.changePassword({ current_password: current, new_password: next });
      setCurrent(''); setNext(''); setConfirm(''); setDone(true);
      toast.success(t('Nenosiri limebadilishwa.', 'Password changed.'));
    } catch (ex) {
      if (ex.code === 'wrong_password') setErrors([t('Nenosiri la sasa si sahihi.', 'Your current password is wrong.')]);
      else if (ex.data?.errors?.new_password) setErrors(ex.data.errors.new_password);
      else setErrors([t('Imeshindwa kubadilisha nenosiri. Jaribu tena.', 'Could not change the password. Try again.')]);
    } finally { setBusy(false); }
  };

  return (
    <div className="two" style={{ marginTop: 0 }}>
      <form className="panel stack" onSubmit={submit} style={{ maxWidth: 440 }}>
        <h2>{t('Badilisha nenosiri', 'Change password')}</h2>
        <p className="muted">{t('Hili ni nenosiri la kuingia kama meneja.', 'This is the password used to sign in as manager.')}</p>
        <PasswordField label={t('Nenosiri la sasa', 'Current password')} value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField label={t('Nenosiri jipya', 'New password')} value={next} onChange={setNext} autoComplete="new-password" />
        <PasswordField label={t('Thibitisha nenosiri jipya', 'Confirm new password')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {errors ? <Callout tone="bad">{errors.map((m, i) => <div key={i}>{m}</div>)}</Callout> : null}
        {done ? <Callout tone="good">{t('Nenosiri jipya limehifadhiwa.', 'Your new password is saved.')}</Callout> : null}
        <div><Btn type="submit" className="btn-primary" loading={busy}>{t('Badilisha nenosiri', 'Change password')}</Btn></div>
      </form>
    </div>
  );
}
