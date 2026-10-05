import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { Gear, House, Notebook, SignOut, UsersThree, Wallet } from '@phosphor-icons/react';
import { tokens } from './api.js';
import { useMeta } from './hooks.js';
import { useI } from './i18n.jsx';
import { Logo, PageSkeleton } from './components/ui.jsx';
import { Tools, useTheme } from './components/Tools.jsx';
import Login from './pages/Login.jsx';
import Leo from './pages/Leo.jsx';
const Close = lazy(() => import('./pages/Close.jsx'));
const Money = lazy(() => import('./pages/Money.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const WorkersList = lazy(() => import('./pages/Workers.jsx').then((m) => ({ default: m.WorkersList })));
const WorkerDetail = lazy(() => import('./pages/Workers.jsx').then((m) => ({ default: m.WorkerDetail })));

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
          <Icon size={mobile ? 24 : 22} weight={isActive ? 'fill' : 'duotone'} />
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
        <nav className="nav" aria-label={t('Menyu kuu', 'Main menu')}><Links pillId="rail-pill" /></nav>
        <div className="rail-foot">
          <Tools theme={theme} toggle={toggle} />
          <NavLink to="/mipangilio" className="userbox" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Gear size={20} weight="duotone" /><span>{t('Mipangilio', 'Settings')}</span>
          </NavLink>
          <button type="button" className="userbox" onClick={onLogout} style={{ border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <SignOut size={20} weight="duotone" /><span>{t('Toka', 'Sign out')}</span>
          </button>
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

