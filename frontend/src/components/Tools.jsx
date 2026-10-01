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

/* A real toggle: both languages are always on screen, side by side, in a pill of
   fixed width — only a sliding highlight moves, nothing resizes or changes text,
   so the control never jumps around. Each short label is a native short form of
   that language's own name ("KIS" for Kiswahili, "ENG" for English) rather than
   an abbreviation of the other language's word for it; the full name is still
   available as a tooltip and to screen readers. */
export function LangSwitch() {
  const { lang, setLang, t } = useI();
  const id = useId();
  const options = [['sw', 'KIS', 'Kiswahili'], ['en', 'ENG', 'English']];
  return (
    <div className="lang" role="group" aria-label={t('Lugha', 'Language')}>
      {options.map(([v, short, full]) => (
        <button key={v} type="button" aria-pressed={lang === v} title={full} aria-label={full} onClick={() => setLang(v)}>
          {lang === v ? <motion.span layoutId={id} className="thumb" transition={{ type: 'spring', stiffness: 520, damping: 38 }} /> : null}
          <span>{short}</span>
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
