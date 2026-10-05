import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, tokens } from './api.js';
import { useI } from './i18n.jsx';

const q = (key, path, opts = {}) => ({ queryKey: key, queryFn: () => api.get(path), ...opts });

export const useMeta = () => useQuery(q(['meta'], '/meta/', { staleTime: 30_000 }));
export const useDay = (date, opts) => useQuery(q(['day', date], `/days/${date}/`, { enabled: !!date, ...opts }));
export const useDayPay = (date) => useQuery(q(['day-pay', date], `/days/${date}/pay/`, { placeholderData: keepPreviousData }));
export const useDayReport = (date) => useQuery(q(['day-report', date], `/reports/day/${date}/`, { placeholderData: keepPreviousData }));
export const useWorkers = () => useQuery(q(['workers'], '/workers/'));
export const useWorker = (id, month) => useQuery(q(['worker', id, month], `/workers/${id}/?month=${month}`));
export const useAccount = (id, month) => useQuery(q(['account', id, month], `/workers/${id}/account/?month=${month}`));
export const useSalary = (ym) => useQuery(q(['salary', ym], `/salary/${ym}/`));
export const useReport = (ym) => useQuery(q(['report', ym], `/reports/month/${ym}/`));
export const useExpenses = (ym) => useQuery(q(['expenses', ym], `/expenses/?month=${ym}`));
/* the inbox, a page at a time: who = all|customer|worker, only = all|unread */
export const useOpinions = (who, only, limit) => useQuery(q(['opinions', who, only, limit],
  `/opinions/?source=${who}&unread=${only === 'unread' ? 1 : 0}&limit=${limit}`, { refetchInterval: 60_000, placeholderData: keepPreviousData }));
/* the menu badge: checks for new opinions every minute */
export const useOpinionsUnread = () => useQuery(q(['opinions-unread'], '/opinions/unread/', { refetchInterval: 60_000 }));

/* Turns an API failure into a friendly, translated message. */
export function useErr() {
  const { t } = useI();
  return (e) => {
    const map = {
      day_closed: t('Siku hii imefungwa. Ongeza marekebisho kama rekodi mpya.', 'This day is closed. Add a correction as a new entry.'),
      attendance_missing: t('Andika mahudhurio ya kila mfanyakazi kwanza.', 'Mark attendance for every worker first.'),
      cashier_required: t('Chagua keshia wa siku kabla ya kufunga.', 'Choose the cashier of the day before closing.'),
      salary_locked: t('Orodha ya mishahara imeidhinishwa na imefungwa.', 'The salary list is approved and locked.'),
      wrong_password: t('Nenosiri la sasa si sahihi.', 'Your current password is wrong.'),
      category_in_use: t('Kundi hili linatumika kwenye matumizi yaliyoandikwa. Lifiche badala yake.', 'This category is used by expenses already recorded. Hide it instead.'),
    };
    toast.error(map[e?.code] || (e?.status === 400 ? t('Angalia taarifa ulizojaza.', 'Please check the details you entered.') : t('Kuna tatizo. Jaribu tena.', 'Something went wrong. Try again.')));
  };
}

/* All writes. Day results are placed straight into the cache, then everything refreshes in the background. */
export function useActions() {
  const qc = useQueryClient();
  const settle = async (p, { day = false } = {}) => {
    const res = await p;
    if (day && res?.date) qc.setQueryData(['day', res.date], res);
    qc.invalidateQueries();
    return res;
  };
  const dayRes = (p) => settle(p, { day: true });
  return {
    saveSales: (d, body) => dayRes(api.put(`/days/${d}/sales/`, body)),
    saveCount: (d, body) => dayRes(api.put(`/days/${d}/cash-count/`, body)),
    saveAttendance: (d, body) => dayRes(api.put(`/days/${d}/attendance/`, body)),
    savePayments: (d, body) => dayRes(api.put(`/days/${d}/payments/`, body)),
    visit: async (d, step) => {
      const r = await api.post(`/days/${d}/visit/`, { step });
      qc.setQueryData(['day', d], (old) => (old ? { ...old, visited: r.visited } : old));
    },
    closeDay: async (d) => {
      const r = await api.post(`/days/${d}/close/`);
      qc.setQueryData(['day', d], r.day);
      qc.invalidateQueries();
      return r;
    },
    addExpense: (body) => settle(api.post('/expenses/', body)),
    delExpense: (id) => settle(api.del(`/expenses/${id}/`)),
    addWorker: (body) => settle(api.post('/workers/', body)),
    patchWorker: (id, body) => settle(api.patch(`/workers/${id}/`, body)),
    removeWorker: (id, reason) => settle(api.post(`/workers/${id}/remove/`, { reason })),
    restoreWorker: (id) => settle(api.post(`/workers/${id}/restore/`)),
    addLeave: (id, body) => settle(api.post(`/workers/${id}/leaves/`, body)),
    delLeave: (id) => settle(api.del(`/leaves/${id}/`)),
    addAdvance: (body) => settle(api.post('/advances/', body)),
    addShortage: (id, body) => settle(api.post(`/workers/${id}/shortages/`, body)),
    setShortage: (id, status) => settle(api.patch(`/shortages/${id}/`, { status })),
    approveSalary: (ym) => settle(api.post(`/salary/${ym}/approve/`)),
    markPaid: (lineId, paid) => settle(api.post(`/salary-lines/${lineId}/paid/`, { paid })),
    saveSettings: (body) => settle(api.patch('/meta/', body)),
    addCategory: (body) => settle(api.post('/categories/', body)),
    patchCategory: (id, body) => settle(api.patch(`/categories/${id}/`, body)),
    delCategory: (id) => settle(api.del(`/categories/${id}/`)),
    // a new password ends every earlier sign-in; the server hands this device a fresh one so it stays signed in
    changePassword: async (body) => {
      const r = await api.post('/auth/change-password/', body);
      if (r?.access) tokens.set({ access: r.access, refresh: r.refresh });
      return r;
    },
    readOpinion: (id, read) => settle(api.patch(`/opinions/${id}/`, { read })),
    readAllOpinions: () => settle(api.post('/opinions/read-all/')),
    delOpinion: (id) => settle(api.del(`/opinions/${id}/`)),
  };
}
