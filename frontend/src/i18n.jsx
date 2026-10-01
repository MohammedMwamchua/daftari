import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DAYS, DAYS_SHORT, MONTHS, MONTHS_SHORT } from './vocab.js';

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('daftari.lang') || 'sw');
  useEffect(() => {
    localStorage.setItem('daftari.lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => {
    const L = lang === 'sw' ? 0 : 1;
    const fmtDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_SHORT[L][m - 1]}`; };
    return {
      lang, L, setLang,
      t: (sw, en) => (L === 0 ? sw : en),
      p: (pair) => pair[L],
      fmtDate,
      fmtRange: (a, b) => (a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`),
      monthName: (ym) => `${MONTHS[L][Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`,
      dayName: (dow) => DAYS[L][dow],
      dayOffName: (dow) => (dow == null ? (L === 0 ? 'Hakuna siku ya mapumziko' : 'No day off') : DAYS[L][dow]),
      dayShort: (dow) => DAYS_SHORT[L][dow],
      longDate: (iso, dow) => { const [y, m, d] = iso.split('-').map(Number); return `${DAYS[L][dow]}, ${d} ${MONTHS[L][m - 1]} ${y}`; },
    };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI = () => useContext(Ctx);
