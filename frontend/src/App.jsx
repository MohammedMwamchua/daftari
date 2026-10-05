import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { CaretRight, CheckCircle, Gear, House, Notebook, SignOut, UsersThree, Wallet } from '@phosphor-icons/react';
import { tokens } from './api.js';
import { useDay, useMeta } from './hooks.js';
import { useI } from './i18n.jsx';
import { STEPS } from './vocab.js';
import { Logo, PageSkeleton } from './components/ui.jsx';
import { Tools, useTheme } from './components/Tools.jsx';
import Login from './pages/Login.jsx';
import Leo from './pages/Leo.jsx';
const Close = lazy(() => import('./pages/Close.jsx'));
const Money = lazy(() => import('./pages/Money.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const WorkersList = lazy(() => import('./pages/Workers.jsx').then((m) => ({ default: m.WorkersList })));
const WorkerDetail = lazy(() => import('./pages/Workers.jsx').then((m) => ({ default: m.WorkerDetail })));

/* Today's close-day progress in the sidebar: one glance, one click to the next step. */
function TodayCard() {
  const { t, fmtDate, dayName } = useI();
  const today = useMeta().data.today;
  const { data: d } = useDay(today);
  if (!d) return null;
  const done = d.closed ? STEPS.length : d.visited.length;
  const open = STEPS.findIndex((_, i) => !d.visited.includes(i));
  const next = open < 0 ? STEPS.length - 1 : open;
  return (
    <Link to={d.closed ? '/' : `/funga/${next}`} className={`today-card${d.closed ? ' is-closed' : ''}`}>
      <span className="tc-head">
        <span><small>{t('Leo', 'Today')}</small><b>{dayName(d.dow)}, {fmtDate(d.date)}</b></span>
        <CaretRight size={16} weight="bold" aria-hidden="true" />
      </span>
      <span className="tc-bar" aria-hidden="true"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></span>
      <span className="tc-foot">
        {d.closed
          ? <><CheckCircle size={15} weight="fill" aria-hidden="true" />{t('Siku imefungwa', 'Day closed')}</>
          : <>{t(`Hatua ${done} kati ya ${STEPS.length}`, `${done} of ${STEPS.length} steps`)}<span>{t(`Inayofuata: ${STEPS[next][0]}`, `Next: ${STEPS[next][1]}`)}</span></>}
      </span>
    </Link>
  );
}

function Shell({ onLogout }) {
  const { t } = useI();
  const location = useLocation();
  const [theme, toggle] = useTheme();
  const items = [
    ['/', t('Leo', 'Today'), House, true],
    ['/funga', t('Funga siku', 'Close day'), Notebook],
    ['/wafanyakazi', t('Wafanyakazi', 'Workers'), UsersThree],
    ['/fedha', t('Fedha', 'Money'), Wallet],
  ];
  const Links = ({ pillId, mobile }) => items.map(([to, label, Icon, end]) => (
    <NavLink key={to} to={to} end={end}>
      {({ isActive }) => (
        <>
          {isActive ? <motion.span layoutId={pillId} className="pill" transition={{ type: 'spring', stiffness: 460, damping: 38 }} /> : null}
          <span className="ico"><Icon size={mobile ? 24 : 20} weight={isActive ? 'fill' : 'duotone'} /></span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  ));
  const section = location.pathname.split('/')[1] || 'leo';

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand"><Logo size={44} /><div><b>Daftari</b><small>{t('Daftari la mgahawa', 'Restaurant ledger')}</small></div></div>
        <p className="nav-label" aria-hidden="true">{t('Menyu', 'Menu')}</p>
        <nav className="nav" aria-label={t('Menyu kuu', 'Main menu')}><Links pillId="rail-pill" /></nav>
        <div className="rail-foot">
          <TodayCard />
          <Tools theme={theme} toggle={toggle} />
          <div className="rail-links">
            <NavLink to="/mipangilio" className="userbox">
              <Gear size={20} weight="duotone" /><span>{t('Mipangilio', 'Settings')}</span>
            </NavLink>
            <button type="button" className="userbox out" onClick={onLogout}>
              <SignOut size={20} weight="duotone" /><span>{t('Toka', 'Sign out')}</span>
            </button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand"><Logo size={34} /><div><b>Daftari</b></div></div>
        <div className="rail-row">
          <Tools theme={theme} toggle={toggle} />
          <NavLink to="/mipangilio" className="icon-btn" aria-label={t('Mipangilio', 'Settings')}><Gear size={20} weight="duotone" /></NavLink>
          <button type="button" className="icon-btn" onClick={onLogout} aria-label={t('Toka', 'Sign out')}><SignOut size={20} weight="duotone" /></button>
        </div>
      </header>

      <main className="main" id="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <Suspense fallback={<PageSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<Leo />} />
              <Route path="/funga/:step?" element={<Close />} />
              <Route path="/wafanyakazi" element={<WorkersList />} />
              <Route path="/wafanyakazi/:id" element={<WorkerDetail />} />
              <Route path="/fedha" element={<Money />} />
              <Route path="/mipangilio" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottomnav" aria-label={t('Menyu kuu', 'Main menu')}><Links pillId="bottom-pill" mobile /></nav>
      <Toaster position="bottom-right" theme={theme} richColors closeButton className="toast-wrap" offset={24} mobileOffset={{ bottom: 104, left: 12, right: 12 }} />
    </div>
  );
}

function Gate({ onLogout }) {
  const meta = useMeta();
  if (meta.isLoading) {
    return <div className="boot"><div className="logo-pulse"><Logo size={64} /></div></div>;
  }
  if (meta.isError) return null;
  return <Shell onLogout={onLogout} />;
}

export default function App() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(() => !!tokens.get());
  const [theme, toggle] = useTheme();
  const logout = useCallback(() => { tokens.clear(); qc.clear(); setAuthed(false); }, [qc]);
  useEffect(() => {
    window.addEventListener('daftari:logout', logout);
    return () => window.removeEventListener('daftari:logout', logout);
  }, [logout]);
  if (!authed) return <><Login onDone={() => setAuthed(true)} /><Toaster theme={theme} richColors position="top-center" /></>;
  return <Gate onLogout={logout} />;
}

