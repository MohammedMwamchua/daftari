import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import App from './App.jsx';
import { LangProvider } from './i18n.jsx';
import './styles.css';

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (n, e) => e?.status !== 401 && e?.status !== 404 && n < 2 } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <LangProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LangProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
