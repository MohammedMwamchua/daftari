import { useCallback, useId, useState } from 'react';
import { motion } from 'motion/react';
import { MoonStars, Sun } from '@phosphor-icons/react';
import { useI } from '../i18n.jsx';

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('daftari.theme', next);
    setTheme(next);
  }, [theme]);
  return [theme, toggle];
}

export function LangSwitch() {
  const { lang, setLang } = useI();
  const id = useId();
  return (
    <div className="lang" role="group" aria-label="Language">
      {[['sw', 'SW'], ['en', 'EN']].map(([v, label]) => (
        <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)}>
          {lang === v ? <motion.span layoutId={id} className="thumb" transition={{ type: 'spring', stiffness: 500, damping: 36 }} /> : null}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tools({ theme, toggle }) {
  const { t } = useI();
  return (
    <div className="rail-row">
      <LangSwitch />
      <button type="button" className="icon-btn" onClick={toggle} aria-label={t('Badilisha mwonekano', 'Switch theme')}>
        {theme === 'dark' ? <Sun size={20} weight="duotone" /> : <MoonStars size={20} weight="duotone" />}
      </button>
    </div>
  );
}
