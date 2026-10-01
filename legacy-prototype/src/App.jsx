import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  PiCalendarBlankDuotone, PiCaretLeftBold, PiCaretRightBold, PiCheckBold, PiDownloadSimpleBold, PiHouseLineDuotone,
  PiInfoDuotone, PiMoonStarsDuotone, PiNotebookDuotone, PiPlusBold, PiTrashDuotone, PiTrendDownBold, PiTrendUpBold,
  PiUsersThreeDuotone, PiWalletDuotone, PiWarningDuotone,
} from 'react-icons/pi';
import { makePdf, saveFile, toCsv } from './exporters.js';

/* =====================================================================
   Daftari: manager-only app for a chips stall and restaurant.
   Swahili first, English switch. All data below is sample data.
   ===================================================================== */

/* ---------- language ---------- */
const LangCtx = createContext({ lang: 'sw' });
const useI = () => {
  const { lang } = useContext(LangCtx);
  return {
    lang,
    t: (sw, en) => (lang === 'sw' ? sw : en),
    p: (pair) => pair[lang === 'sw' ? 0 : 1],
  };
};

/* ---------- formatting ---------- */
const num = (n) => Math.round(n || 0).toLocaleString('en-US');
const tsh = (n) => `TSh ${num(n)}`;
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n));
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
const isActive = (w) => w.active !== false;

const DAYS = [
  ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
];
const DAYS_SHORT = [
  ['Jpl', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Ijm', 'Jms'],
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
];
const MONTHS = [
  ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
];
const SHORT = [
  ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
];
const TODAY = '2026-09-30';
const TODAY_DOW = 3;
const fmtDate = (iso, lang) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT[lang === 'sw' ? 0 : 1][m - 1]}`;
};
const fmtRange = (a, b, lang) => (a === b ? fmtDate(a, lang) : `${fmtDate(a, lang)} – ${fmtDate(b, lang)}`);

/* ---------- vocabulary ---------- */
const SEC = ['banda', 'mgahawa'];
const SECTIONS = { banda: ['Banda', 'Stall'], mgahawa: ['Mgahawa', 'Restaurant'] };
const ROLES = {
  keshia: ['Keshia', 'Cashier'],
  mpishi: ['Mpishi', 'Cook'],
  mhudumu: ['Mhudumu', 'Waiter'],
  mwingine: ['Mfanyakazi mwingine', 'Other worker'],
};
const STATUS = {
  present: ['Amehudhuria', 'Present', 'good'],
  late: ['Amechelewa', 'Late', 'warn'],
  absent: ['Hakuja', 'Absent', 'bad'],
  dayoff: ['Siku ya mapumziko', 'Day off', 'info'],
  permission: ['Ruhusa', 'Permission', 'info'],
  holiday: ['Likizo', 'Holiday', 'info'],
};
const CATS = {
  malighafi: ['Malighafi', 'Ingredients'],
  kodi: ['Kodi', 'Rent'],
  umeme: ['Umeme', 'Electricity'],
  maji: ['Maji', 'Water'],
  gesi: ['Gesi', 'Gas'],
  usafiri: ['Usafiri', 'Transport'],
  matengenezo: ['Matengenezo', 'Repairs'],
  vifaa: ['Vifaa', 'Supplies'],
};
const STEPS = [
  ['Mauzo', 'Sales'],
  ['Delivery', 'Deliveries'],
  ['Matumizi', 'Expenses'],
  ['Hesabu ya pesa', 'Cash count'],
  ['Mahudhurio', 'Attendance'],
  ['Funga siku', 'Close the day'],
];

/* ---------- sample data ---------- */
const monthExpenses = [
  ['2026-09-01', 'kodi', 450000, 'Kodi ya jengo', 'simu'],
  ['2026-09-02', 'malighafi', 620000, 'Viazi, nyama na mafuta', 'simu'],
  ['2026-09-06', 'malighafi', 540000, 'Viazi, kuku na mchele', 'simu'],
  ['2026-09-08', 'umeme', 96000, 'Bili ya umeme', 'simu'],
  ['2026-09-10', 'malighafi', 610000, 'Viazi, samaki na mafuta', 'simu'],
  ['2026-09-10', 'maji', 28000, 'Bili ya maji', 'simu'],
  ['2026-09-14', 'malighafi', 580000, 'Nyama na mboga', 'simu'],
  ['2026-09-17', 'usafiri', 22000, 'Nauli ya kununua vifaa', 'droo', 'mgahawa'],
  ['2026-09-18', 'malighafi', 640000, 'Viazi na mafuta', 'simu'],
  ['2026-09-19', 'matengenezo', 65000, 'Kurekebisha friji', 'simu'],
  ['2026-09-22', 'malighafi', 600000, 'Kuku na mchele', 'simu'],
  ['2026-09-25', 'vifaa', 38000, 'Sahani na vikombe', 'droo', 'mgahawa'],
  ['2026-09-26', 'malighafi', 660000, 'Viazi, nyama na mafuta', 'simu'],
  ['2026-09-27', 'gesi', 25000, 'Mtungi wa gesi', 'droo', 'banda'],
];

const seed = () => ({
  workers: [
    { id: 'w1', name: 'Amina Juma', role: 'keshia', pay: 'monthly', rate: 300000, dayOff: 0, phone: '0712 345 678' },
    { id: 'w2', name: 'Rehema Saidi', role: 'keshia', pay: 'monthly', rate: 280000, dayOff: 1, phone: '0754 221 903' },
    { id: 'w3', name: 'Hassani Mrisho', role: 'mpishi', pay: 'monthly', rate: 350000, dayOff: 2, phone: '0687 410 256' },
    { id: 'w4', name: 'Juma Bakari', role: 'mpishi', pay: 'daily', rate: 10000, dayOff: 4, phone: '0765 118 342' },
    { id: 'w5', name: 'Zawadi Ally', role: 'mhudumu', pay: 'daily', rate: 8000, dayOff: 3, phone: '0622 507 719' },
    { id: 'w6', name: 'Neema Peter', role: 'mwingine', pay: 'daily', rate: 6000, dayOff: 0, phone: '0713 660 084' },
  ],
  leaves: [
    { id: 'l1', workerId: 'w6', type: 'permission', from: '2026-09-30', to: '2026-09-30', reason: 'Shughuli ya familia' },
    { id: 'l2', workerId: 'w4', type: 'holiday', from: '2026-10-05', to: '2026-10-08', reason: 'Kwenda kijijini' },
  ],
  rules: {
    permission: { cut: true, pay: false },
    holiday: { cut: false, pay: false },
    dayoff: { cut: false, pay: false },
  },
  expenses: [
    ...monthExpenses.map(([date, cat, amount, reason, from, section], i) => ({ id: `m${i}`, date, cat, amount, reason, from, section })),
    { id: 'e1', date: TODAY, cat: 'gesi', amount: 25000, reason: 'Mtungi wa gesi', from: 'droo', section: 'banda' },
    { id: 'e2', date: TODAY, cat: 'malighafi', amount: 84000, reason: 'Viazi na mafuta ya kupikia', from: 'simu' },
  ],
  advances: [
    { id: 'a1', workerId: 'w3', date: '2026-09-12', amount: 50000 },
    { id: 'a2', workerId: 'w5', date: '2026-09-16', amount: 15000 },
    { id: 'a3', workerId: 'w4', date: '2026-09-20', amount: 20000 },
  ],
  shortages: [{ id: 's1', workerId: 'w1', date: '2026-09-14', amount: 3500, status: 'approved', section: 'mgahawa' }],
  sales: {
    banda: { cash: 118000, mobile: 64000, cashier: 'w2' },
    mgahawa: { cash: 236000, mobile: 148000, cashier: 'w1' },
  },
  deliveries: [
    { id: 'd1', workerId: 'w4', section: 'mgahawa', amount: 12000, method: 'cash', handedIn: false },
    { id: 'd2', workerId: 'w3', section: 'banda', amount: 8500, method: 'mobile', handedIn: true },
    { id: 'd3', workerId: 'w4', section: 'mgahawa', amount: 15000, method: 'cash', handedIn: true },
  ],
  counted: { banda: 141000, mgahawa: 304000 },
  floatAmt: { banda: 50000, mgahawa: 80000 },
  attendance: { w1: 'present', w2: 'late', w3: 'present' },
  visited: [0, 1, 2],
  closed: null,
  salary: { status: 'draft', paid: {} },
});

/* Sales history for July to September (sample data). */
const pad2 = (n) => String(n).padStart(2, '0');
const monthDays = (m) => new Date(2026, m + 1, 0).getDate();
function genDay(m, d) {
  const dow = new Date(2026, m, d).getDay();
  const weekend = dow === 5 || dow === 6 || dow === 0;
  const total = 300000 + ((d * 37 + m * 11) % 11) * 18000 + (weekend ? 90000 : 0) + (m === 6 ? -20000 : m === 7 ? 15000 : 0);
  const bandaTotal = Math.round((total * (0.31 + ((d * 7 + m) % 5) * 0.01)) / 500) * 500;
  const mobilePct = 0.34 + ((d * 3 + m) % 6) * 0.015;
  const split = (x) => {
    const mobile = Math.round((x * mobilePct) / 500) * 500;
    return { cash: x - mobile, mobile };
  };
  const diff = d % 9 === 0 ? -2000 : d % 13 === 0 ? 1000 : d % 17 === 0 ? -3500 : 0;
  return { m, d, dow, iso: `2026-${pad2(m + 1)}-${pad2(d)}`, banda: split(bandaTotal), mgahawa: split(total - bandaTotal), total, diff };
}
const HISTORY = Array.from({ length: 29 }, (_, i) => genDay(8, i + 1));
const MONTH_OPTIONS = [6, 7, 8];

const todayRecord = (db, d) => ({
  m: 8, d: 30, dow: TODAY_DOW, iso: TODAY, live: true,
  banda: { cash: db.sales.banda.cash || 0, mobile: db.sales.banda.mobile || 0 },
  mgahawa: { cash: db.sales.mgahawa.cash || 0, mobile: db.sales.mgahawa.mobile || 0 },
  total: d.salesToday,
  diff: d.diffTotal,
});
const daysOf = (m, db, d) => (m === 8
  ? [...HISTORY, todayRecord(db, d)]
  : Array.from({ length: monthDays(m) }, (_, i) => genDay(m, i + 1)));

/* ---------- export files (CSV and PDF) ---------- */
const LINE = '-'.repeat(54);
const dots = (label, amount, width = 34) => `${label.slice(0, width - 1).padEnd(width, '.')} ${String(amount).padStart(14)}`;

function monthFiles(days, m, lang) {
  const L = lang === 'sw' ? 0 : 1;
  const tt = (sw, en) => (L === 0 ? sw : en);
  const ym = `2026-${pad2(m + 1)}`;
  const totals = days.reduce((a, r) => ({
    bc: a.bc + r.banda.cash, bm: a.bm + r.banda.mobile, gc: a.gc + r.mgahawa.cash, gm: a.gm + r.mgahawa.mobile, total: a.total + r.total, diff: a.diff + r.diff,
  }), { bc: 0, bm: 0, gc: 0, gm: 0, total: 0, diff: 0 });
  const head = [tt('Tarehe', 'Date'), tt('Siku', 'Day'), tt('Banda: pesa taslimu', 'Stall: cash'), tt('Banda: pesa za simu', 'Stall: mobile money'),
    tt('Mgahawa: pesa taslimu', 'Restaurant: cash'), tt('Mgahawa: pesa za simu', 'Restaurant: mobile money'), tt('Jumla ya mauzo', 'Total sales'), tt('Tofauti ya pesa', 'Cash difference')];
  const rows = [head, ...days.map((r) => [r.iso, DAYS[L][r.dow], r.banda.cash, r.banda.mobile, r.mgahawa.cash, r.mgahawa.mobile, r.total, r.diff]),
    [tt('JUMLA', 'TOTAL'), '', totals.bc, totals.bm, totals.gc, totals.gm, totals.total, totals.diff]];

  const fmtDiff = (n) => (n === 0 ? '0' : `${n < 0 ? '-' : '+'}${num(Math.abs(n))}`);
  const best = days.reduce((a, b) => (b.total > a.total ? b : a));
  const lines = [
    { text: 'Daftari', size: 22, font: 'F2' },
    { text: `${tt('Ripoti ya mauzo ya mwezi', 'Monthly sales report')}: ${MONTHS[L][m]} 2026`, size: 13, gap: 8 },
    { text: dots(tt('Jumla ya mauzo', 'Total sales'), `TSh ${num(totals.total)}`), size: 11, font: 'F3' },
    { text: dots(tt('Pesa taslimu', 'Cash'), `TSh ${num(totals.bc + totals.gc)}`), size: 11, font: 'F3' },
    { text: dots(tt('Pesa za simu', 'Mobile money'), `TSh ${num(totals.bm + totals.gm)}`), size: 11, font: 'F3' },
    { text: dots(tt('Banda', 'Stall'), `TSh ${num(totals.bc + totals.bm)}`), size: 11, font: 'F3' },
    { text: dots(tt('Mgahawa', 'Restaurant'), `TSh ${num(totals.gc + totals.gm)}`), size: 11, font: 'F3' },
    { text: dots(tt('Wastani kwa siku', 'Average per day'), `TSh ${num(totals.total / days.length)}`), size: 11, font: 'F3' },
    { text: dots(tt('Siku bora', 'Best day'), `${fmtDate(best.iso, lang)}: ${num(best.total)}`), size: 11, font: 'F3', gap: 10 },
    { text: `${tt('Tarehe', 'Date').padEnd(10)}${tt('Banda', 'Stall').padStart(11)}${tt('Mgahawa', 'Restaurant').padStart(12)}${tt('Jumla', 'Total').padStart(12)}${tt('Tofauti', 'Diff.').padStart(9)}`, size: 9, font: 'F3' },
    { text: LINE, size: 9, font: 'F3' },
    ...days.map((r) => ({ text: `${fmtDate(r.iso, lang).padEnd(10)}${num(r.banda.cash + r.banda.mobile).padStart(11)}${num(r.mgahawa.cash + r.mgahawa.mobile).padStart(12)}${num(r.total).padStart(12)}${fmtDiff(r.diff).padStart(9)}`, size: 9, font: 'F3' })),
    { text: LINE, size: 9, font: 'F3' },
    { text: `${tt('JUMLA', 'TOTAL').padEnd(10)}${num(totals.bc + totals.bm).padStart(11)}${num(totals.gc + totals.gm).padStart(12)}${num(totals.total).padStart(12)}${fmtDiff(totals.diff).padStart(9)}`, size: 9, font: 'F3' },
  ];
  return { csv: { filename: `mauzo-${ym}.csv`, data: toCsv(rows) }, pdf: { filename: `mauzo-${ym}.pdf`, data: makePdf(lines) } };
}

function dayFiles(r, expenses, lang) {
  const L = lang === 'sw' ? 0 : 1;
  const tt = (sw, en) => (L === 0 ? sw : en);
  const bTot = r.banda.cash + r.banda.mobile;
  const gTot = r.mgahawa.cash + r.mgahawa.mobile;
  const expTotal = sum(expenses, (e) => e.amount);
  const title = `${DAYS[L][r.dow]}, ${r.d} ${MONTHS[L][r.m]} 2026`;
  const diffTxt = r.diff === 0 ? 'TSh 0' : `${r.diff < 0 ? '-' : '+'}TSh ${num(Math.abs(r.diff))}`;
  const rows = [
    [tt('Sehemu', 'Section'), tt('Njia ya malipo', 'Payment method'), tt('Kiasi (TSh)', 'Amount (TSh)')],
    [tt('Banda', 'Stall'), tt('Pesa taslimu', 'Cash'), r.banda.cash],
    [tt('Banda', 'Stall'), tt('Pesa za simu', 'Mobile money'), r.banda.mobile],
    [tt('Mgahawa', 'Restaurant'), tt('Pesa taslimu', 'Cash'), r.mgahawa.cash],
    [tt('Mgahawa', 'Restaurant'), tt('Pesa za simu', 'Mobile money'), r.mgahawa.mobile],
    [tt('Jumla ya mauzo', 'Total sales'), '', r.total],
    ...expenses.map((e) => [tt('Matumizi', 'Expense'), `${CATS[e.cat][L]}: ${e.reason}`, e.amount]),
    [tt('Jumla ya matumizi', 'Total expenses'), '', expTotal],
    [tt('Tofauti ya pesa', 'Cash difference'), '', r.diff],
  ];
  const lines = [
    { text: 'Daftari', size: 22, font: 'F2' },
    { text: `${tt('Ripoti ya siku', 'Daily report')}: ${title}`, size: 13, gap: 12 },
    { text: tt('MAUZO', 'SALES'), size: 12, font: 'F2', gap: 4 },
    { text: dots(`${tt('Banda', 'Stall')}, ${tt('pesa taslimu', 'cash')}`, `TSh ${num(r.banda.cash)}`), font: 'F3' },
    { text: dots(`${tt('Banda', 'Stall')}, ${tt('pesa za simu', 'mobile money')}`, `TSh ${num(r.banda.mobile)}`), font: 'F3' },
    { text: dots(tt('Jumla ya banda', 'Stall total'), `TSh ${num(bTot)}`), font: 'F3', gap: 6 },
    { text: dots(`${tt('Mgahawa', 'Restaurant')}, ${tt('pesa taslimu', 'cash')}`, `TSh ${num(r.mgahawa.cash)}`), font: 'F3' },
    { text: dots(`${tt('Mgahawa', 'Restaurant')}, ${tt('pesa za simu', 'mobile money')}`, `TSh ${num(r.mgahawa.mobile)}`), font: 'F3' },
    { text: dots(tt('Jumla ya mgahawa', 'Restaurant total'), `TSh ${num(gTot)}`), font: 'F3', gap: 6 },
    { text: dots(tt('JUMLA YA MAUZO', 'TOTAL SALES'), `TSh ${num(r.total)}`), font: 'F3', gap: 14 },
    { text: tt('MATUMIZI', 'EXPENSES'), size: 12, font: 'F2', gap: 4 },
    ...(expenses.length === 0
      ? [{ text: tt('Hakuna matumizi yaliyoandikwa siku hii.', 'No expenses recorded this day.'), gap: 4 }]
      : expenses.map((e) => ({ text: dots(`${CATS[e.cat][L]}: ${e.reason}`, `TSh ${num(e.amount)}`), font: 'F3' }))),
    { text: dots(tt('Jumla ya matumizi', 'Total expenses'), `TSh ${num(expTotal)}`), font: 'F3', gap: 14 },
    { text: tt('PESA', 'CASH'), size: 12, font: 'F2', gap: 4 },
    { text: dots(tt('Tofauti ya pesa', 'Cash difference'), diffTxt), font: 'F3' },
  ];
  return { csv: { filename: `mauzo-${r.iso}.csv`, data: toCsv(rows) }, pdf: { filename: `mauzo-${r.iso}.pdf`, data: makePdf(lines) } };
}

/* ---------- attendance calendar (September, sample) ---------- */
const CAL = {
  w1: { late: [3, 17], permission: [11] },
  w2: { late: [8], absent: [5, 19], permission: [22] },
  w3: {},
  w4: { late: [12], absent: [9], holiday: [23, 24, 25] },
  w5: { late: [4, 15], permission: [10, 21] },
  w6: { late: [2, 9, 20] },
};
const dowOf = (day) => new Date(2026, 8, day).getDay();
function dayStatus(w, db, day) {
  const iso = `2026-09-${pad2(day)}`;
  const lv = db.leaves.find((l) => l.workerId === w.id && l.from <= iso && iso <= l.to);
  if (lv) return lv.type;
  if (dowOf(day) === w.dayOff) return 'dayoff';
  const c = CAL[w.id] || {};
  const hit = ['absent', 'late', 'permission', 'holiday'].find((k) => (c[k] || []).includes(day));
  return hit || 'present';
}
function statsOf(w, db) {
  const out = { present: 0, late: 0, absent: 0, permission: 0, holiday: 0, dayoff: 0 };
  for (let day = 1; day <= 29; day += 1) out[dayStatus(w, db, day)] += 1;
  return out;
}

/* ---------- derived numbers ---------- */
function statusToday(w, db) {
  const lv = db.leaves.find((l) => l.workerId === w.id && l.from <= TODAY && TODAY <= l.to);
  if (lv) return { key: lv.type, locked: 'leave' };
  if (w.dayOff === TODAY_DOW) return { key: 'dayoff', locked: 'dayoff' };
  return { key: db.attendance[w.id] || null, locked: null };
}

function salaryFor(w, db, todayKey) {
  const s = statsOf(w, db);
  if (todayKey) s[todayKey] = (s[todayKey] || 0) + 1;
  const r = db.rules;
  const kinds = ['permission', 'holiday', 'dayoff'];
  let base;
  if (w.pay === 'monthly') {
    const cutDays = (s.absent || 0) + sum(kinds, (k) => (r[k].cut ? s[k] || 0 : 0));
    base = w.rate - Math.round((w.rate / 30) * cutDays);
  } else {
    const paidDays = (s.present || 0) + (s.late || 0) + sum(kinds, (k) => (r[k].pay ? s[k] || 0 : 0));
    base = w.rate * paidDays;
  }
  const adv = sum(db.advances.filter((a) => a.workerId === w.id), (a) => a.amount);
  const short = sum(db.shortages.filter((x) => x.workerId === w.id && x.status === 'approved'), (x) => x.amount);
  return { stats: s, base, adv, short, net: Math.max(0, base - adv - short) };
}

function cashCalc(db) {
  const todayExp = db.expenses.filter((e) => e.date === TODAY);
  const out = {};
  SEC.forEach((s) => {
    const cashSales = db.sales[s].cash || 0;
    const undelivered = sum(db.deliveries.filter((x) => x.section === s && x.method === 'cash' && !x.handedIn), (x) => x.amount);
    const payouts = sum(todayExp.filter((e) => e.from === 'droo' && e.section === s), (e) => e.amount);
    const expected = cashSales - undelivered - payouts;
    const counted = db.counted[s];
    const float = db.floatAmt[s];
    const diff = counted == null ? null : counted - float - expected;
    out[s] = { cashSales, undelivered, payouts, expected, counted, float, diff };
  });
  return out;
}

function derive(db) {
  const sales = {};
  SEC.forEach((s) => { sales[s] = (db.sales[s].cash || 0) + (db.sales[s].mobile || 0); });
  const salesToday = sales.banda + sales.mgahawa;
  const expToday = sum(db.expenses.filter((e) => e.date === TODAY), (e) => e.amount);
  const cash = cashCalc(db);
  const owed = {};
  db.deliveries.forEach((x) => { if (x.method === 'cash' && !x.handedIn) owed[x.workerId] = (owed[x.workerId] || 0) + x.amount; });
  const active = db.workers.filter(isActive);
  const status = {};
  db.workers.forEach((w) => { status[w.id] = statusToday(w, db); });
  const salaryWorkers = db.workers.filter((w) => isActive(w) || (w.removedOn || '').startsWith('2026-09'));
  const salary = salaryWorkers.map((w) => ({ w, ...salaryFor(w, db, isActive(w) ? status[w.id].key : null) }));
  const salaryTotal = sum(salary, (r) => r.net);
  const monthSales = sum(HISTORY, (h) => h.total) + salesToday;
  const monthExp = sum(db.expenses, (e) => e.amount);
  const missing = active.filter((w) => !status[w.id].key);
  const pending = db.shortages.filter((s) => s.status === 'pending');
  const diffTotal = sum(SEC, (s) => cash[s].diff || 0);
  return { active, sales, salesToday, expToday, cash, owed, status, salary, salaryTotal, monthSales, monthExp, missing, pending, diffTotal };
}

/* ---------- icons and logo ---------- */
const ICONS = {
  home: PiHouseLineDuotone, book: PiNotebookDuotone, users: PiUsersThreeDuotone, wallet: PiWalletDuotone, moon: PiMoonStarsDuotone,
  check: PiCheckBold, plus: PiPlusBold, back: PiCaretLeftBold, next: PiCaretRightBold, alert: PiWarningDuotone, info: PiInfoDuotone,
  trash: PiTrashDuotone, download: PiDownloadSimpleBold, up: PiTrendUpBold, down: PiTrendDownBold, calendar: PiCalendarBlankDuotone,
};
const Icon = ({ name, size = 22 }) => {
  const C = ICONS[name];
  return <C size={size} aria-hidden="true" />;
};

const Logo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="#0e6b54" />
    <path d="M11.5 8.5h13.2a3 3 0 0 1 3 3V31H14.5a3 3 0 0 1-3-3V8.5Z" fill="#ffffff" fillOpacity="0.96" />
    <path d="M15.5 15h8M15.5 19.5h8M15.5 24h5" stroke="#0e6b54" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M23.2 8.5h4.5v12l-2.25-1.8-2.25 1.8v-12Z" fill="#e2a233" />
  </svg>
);

/* ---------- motion helpers: one orchestrated moment on first load ---------- */
let introPlayed = false;
function useCountUp(target, enabled) {
  const [v, setV] = useState(enabled ? 0 : target);
  const [fin, setFin] = useState(!enabled);
  useEffect(() => {
    if (fin) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFin(true); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1000);
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick); else setFin(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fin ? target : v;
}

/* ---------- charts ---------- */
const niceMax = (v) => { const step = v > 1000000 ? 500000 : v > 400000 ? 100000 : 50000; return Math.ceil(v / step) * step; };
const kfmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

function BarChart({ bars, label }) {
  const W = 640; const H = 210; const PL = 46; const PR = 8; const PT = 14; const PB = 30;
  const max = niceMax(Math.max(...bars.map((b) => b.value), 1));
  const bw = (W - PL - PR) / bars.length;
  const barW = Math.max(6, Math.min(34, bw * 0.6));
  const y = (v) => PT + (H - PT - PB) * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PL} x2={W - PR} y1={y(max * f)} y2={y(max * f)} className={f === 0 ? 'base' : 'grid'} />
          <text x={PL - 8} y={y(max * f) + 4} textAnchor="end">{kfmt(max * f)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = PL + i * bw + (bw - barW) / 2;
        const h = Math.max(3, y(0) - y(b.value));
        return (
          <g key={i}>
            <rect className={`bar${b.hot ? ' hot' : ''}`} x={x} y={y(0) - h} width={barW} height={h} rx={Math.min(6, barW / 2)}><title>{b.tip}</title></rect>
            {b.label ? <text x={x + barW / 2} y={H - 8} textAnchor="middle">{b.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ parts, size = 150, children }) {
  const r = 54; const C = 2 * Math.PI * r;
  const total = sum(parts, (x) => x.v) || 1;
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="d-track" />
        {parts.map((x, i) => {
          const len = Math.max((x.v / total) * C - 3, 0);
          const el = <circle key={i} cx="70" cy="70" r={r} fill="none" strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" className={`d-seg d${i}`} />;
          acc += (x.v / total) * C;
          return el;
        })}
      </svg>
      <div className="d-center">{children}</div>
    </div>
  );
}

function Ring({ done, now, total = 6, size = 112 }) {
  const r = 46; const C = 2 * Math.PI * r; const gap = 14; const seg = C / total - gap;
  return (
    <svg className="ring" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${done} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <circle key={i} cx="60" cy="60" r={r} fill="none" strokeWidth="9" strokeLinecap="round" style={{ '--i': i }}
          className={`seg${i < done ? ' on' : i === now ? ' now' : ''}`} strokeDasharray={`${seg} ${C - seg}`}
          transform={`rotate(${-90 + (360 / total) * i + (gap / 2 / C) * 360} 60 60)`} />
      ))}
      <text x="60" y="68" textAnchor="middle" fontSize="30">{done}<tspan className="sub" fontSize="15">/{total}</tspan></text>
    </svg>
  );
}

const Tabs = ({ items, value, onChange, label }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {items.map(([v, text]) => (
      <button key={v} type="button" role="tab" className="tab" aria-selected={value === v} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
);

/* ---------- small pieces ---------- */
const Chip = ({ tone = 'neutral', children }) => <span className={`chip chip-${tone}`}>{children}</span>;

const moneyParts = (v) => {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(− )?TSh (.+)$/);
  return m ? <>{m[1] || ''}<span className="cur">TSh</span>{m[2]}</> : v;
};

const Leader = ({ label, value, tone, strong, sub, idx }) => (
  <div className={`lrow${strong ? ' strong' : ''}${tone ? ` tone-${tone}` : ''}`} style={idx != null ? { '--i': idx } : undefined}>
    <span className="lab">{label}{sub ? <small>{sub}</small> : null}</span>
    <span className="dots" aria-hidden="true" />
    <span className="amt">{moneyParts(value)}</span>
  </div>
);

const Seg = ({ options, value, onChange, label, disabled }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button type="button" key={v} aria-pressed={value === v} disabled={disabled} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
);

const MoneyInput = ({ label, value, onChange, hint }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <span className="money">
      <span className="cur">TSh</span>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={value == null ? '' : num(value)}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, '');
          onChange(v === '' ? null : Number(v));
        }}
      />
    </span>
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
);

const Select = ({ label, value, onChange, children }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
  </label>
);

const StatusChip = ({ k }) => {
  const { p } = useI();
  if (!k) return <Chip tone="warn">{p(['Hajaandikwa', 'Not marked'])}</Chip>;
  return <Chip tone={STATUS[k][2]}>{p(STATUS[k])}</Chip>;
};

const hash = (str) => [...String(str)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 997, 7);
const Initials = ({ name, size }) => (
  <span className={`av t${hash(name) % 6}${size === 'lg' ? ' lg' : ''}`} aria-hidden="true">{name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
);

/* =====================================================================
   LEO  (today)
   ===================================================================== */
function LeoView({ db, d, act, go }) {
  const { t, p, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const [intro] = useState(() => !introPlayed);
  useEffect(() => { introPlayed = true; }, []);
  const closed = !!db.closed;
  const next = [0, 1, 2, 3, 4, 5].find((i) => !db.visited.includes(i)) ?? 5;
  const doneCount = closed ? 6 : db.visited.length;
  const shown = useCountUp(d.salesToday, intro);
  const hour = new Date().getHours();
  const hello = hour < 12 ? t('Habari za asubuhi', 'Good morning') : hour < 17 ? t('Habari za mchana', 'Good afternoon') : t('Habari za jioni', 'Good evening');
  const yest = HISTORY[HISTORY.length - 1];
  const delta = Math.round(((d.salesToday - yest.total) / yest.total) * 100);
  const week = [...HISTORY.slice(-6), todayRecord(db, d)];
  const weekTotal = sum(week, (r) => r.total);
  const prevTotal = sum(HISTORY.slice(-13, -6), (r) => r.total);
  const weekDelta = Math.round(((weekTotal - prevTotal) / prevTotal) * 100);
  const bars = week.map((r) => ({ value: r.total, label: DAYS_SHORT[L][r.dow], hot: r.live, tip: `${DAYS[L][r.dow]} ${r.d}: TSh ${num(r.total)}` }));
  const todayCash = (db.sales.banda.cash || 0) + (db.sales.mgahawa.cash || 0);
  const todayMobile = (db.sales.banda.mobile || 0) + (db.sales.mgahawa.mobile || 0);
  const owedList = Object.entries(d.owed);
  const nameOf = (id) => db.workers.find((w) => w.id === id)?.name;
  const tone = d.diffTotal === 0 ? 'good' : d.diffTotal < 0 ? 'bad' : 'warn';
  const inCount = d.active.filter((w) => ['present', 'late'].includes(d.status[w.id].key)).length;
  const awayCount = d.active.filter((w) => ['dayoff', 'permission', 'holiday'].includes(d.status[w.id].key)).length;
  const todoCount = d.active.filter((w) => !d.status[w.id].key).length;

  return (
    <div className={intro ? 'intro' : undefined}>
      <header className="greet">
        <p className="muted">{hello}, {t('Meneja', 'Manager')}</p>
        <h1>{closed ? t('Siku ya leo imefungwa', 'Today is closed') : t('Funga siku ya leo', "Close today's books")}</h1>
      </header>

      <section className="ticket" aria-label={t('Tiketi ya leo', "Today's ticket")}>
        <div className="ticket-main">
          <div className="kanga" aria-hidden="true" />
          <div className="ticket-body">
            <p className="muted">{t('Mauzo ya leo', 'Sales today')}, {DAYS[L][TODAY_DOW]} 30 {MONTHS[L][8]}</p>
            <p className="bignum"><span className="cur">TSh</span>{num(shown)}</p>
            <p className="delta-line">
              <Chip tone={delta >= 0 ? 'good' : 'bad'}><Icon name={delta >= 0 ? 'up' : 'down'} size={14} />{Math.abs(delta)}% {delta >= 0 ? t('juu ya jana', 'above yesterday') : t('chini ya jana', 'below yesterday')}</Chip>
              {closed ? <span className="stamp">{t('IMEFUNGWA', 'CLOSED')}</span> : null}
            </p>
            <div className="ledger flat">
              <Leader idx={0} label={t('Banda', 'Stall')} value={tsh(d.sales.banda)} />
              <Leader idx={1} label={t('Mgahawa', 'Restaurant')} value={tsh(d.sales.mgahawa)} />
              <Leader idx={2} label={t('Matumizi ya leo', "Today's expenses")} value={`− ${tsh(d.expToday)}`} />
              <Leader idx={3} strong tone={tone} label={t('Tofauti ya pesa', 'Cash difference')}
                sub={d.diffTotal === 0 ? t('Pesa zote zinalingana', 'Everything adds up') : d.diffTotal < 0 ? t('Upungufu', 'Shortage') : t('Ziada', 'Surplus')}
                value={d.diffTotal === 0 ? tsh(0) : signed(d.diffTotal)} />
            </div>
            <div className="ticket-split">
              <div className="splitbar" role="img" aria-label={`${t('Pesa taslimu', 'Cash')} ${tsh(todayCash)}, ${t('Pesa za simu', 'Mobile money')} ${tsh(todayMobile)}`}>
                <span style={{ flex: todayCash || 1 }} /><span style={{ flex: todayMobile || 1 }} />
              </div>
              <div className="splitkey">
                <div><i className="k0" /><span>{t('Pesa taslimu', 'Cash')}</span><strong>{tsh(todayCash)}</strong></div>
                <div><i className="k1" /><span>{t('Pesa za simu', 'Mobile money')}</span><strong>{tsh(todayMobile)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-stub">
          <div className="stub-head">
            <Ring done={doneCount} now={closed ? -1 : next} />
            <div>
              <h2>{closed ? t('Kila kitu kimekamilika', 'Everything is done') : t(`Hatua ${doneCount} kati ya 6`, `${doneCount} of 6 steps done`)}</h2>
              <p className="muted">{closed ? t(`Imefungwa saa ${db.closed}`, `Closed at ${db.closed}`) : t(`Inayofuata: ${STEPS[next][0]}`, `Next: ${STEPS[next][1]}`)}</p>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map((st, i) => {
              const done = closed || db.visited.includes(i);
              return (
                <li key={i} className={!done && i === next ? 'is-now' : undefined}>
                  <button type="button" onClick={() => go('funga', i)}>
                    <span className={`tick${done ? ' done' : i === next ? ' now' : ''}`}>{done ? <Icon name="check" size={13} /> : i + 1}</span>
                    <span>{p(st)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!closed ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => go('funga', next)}>
              {t('Endelea', 'Continue')}<Icon name="next" size={18} />
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel" style={{ marginTop: '2rem' }}>
        <div className="panel-head">
          <div>
            <h2>{t('Wiki hii', 'This week')}</h2>
            <p className="muted">{t('Siku 7 za mwisho', 'The last 7 days')}</p>
          </div>
          <div className="panel-stat">
            <span><span className="cur">TSh</span>{num(weekTotal)}</span>
            <Chip tone={weekDelta >= 0 ? 'good' : 'bad'}><Icon name={weekDelta >= 0 ? 'up' : 'down'} size={14} />{Math.abs(weekDelta)}%</Chip>
          </div>
        </div>
        <BarChart bars={bars} label={t('Mauzo ya siku 7 za mwisho. Leo imeangaziwa kwa dhahabu.', 'Sales for the last 7 days. Today is highlighted in gold.')} />
      </section>

      <div className="two">
        <section>
          <div className="sec-head">
            <h2>{t('Wafanyakazi leo', 'Workers today')}</h2>
            <div className="chips">
              <Chip tone="good">{inCount} {t('wapo kazini', 'at work')}</Chip>
              {awayCount ? <Chip tone="info">{awayCount} {t('hawapo (ruhusa)', 'away')}</Chip> : null}
              {todoCount ? <Chip tone="warn">{todoCount} {t('hawajaandikwa', 'not marked')}</Chip> : null}
            </div>
          </div>
          <ul className="list">
            {d.active.map((w) => (
              <li key={w.id}>
                <Initials name={w.name} />
                <span className="li-main"><strong>{w.name}</strong><span>{p(ROLES[w.role])}</span></span>
                <StatusChip k={d.status[w.id].key} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="sec-head"><h2>{t('Yanayosubiri wewe', 'Waiting for you')}</h2></div>
          {owedList.length === 0 && d.pending.length === 0 ? (
            <p className="empty">{t('Hakuna kinachosubiri. Kazi nzuri.', 'Nothing is waiting. Good work.')}</p>
          ) : (
            <ul className="list">
              {owedList.map(([id, amount]) => (
                <li key={id}>
                  <Chip tone="warn">{t('Anadaiwa', 'Owes')}</Chip>
                  <span className="li-main"><strong>{nameOf(id)}</strong><span>{t('Pesa ya delivery haijakabidhiwa', 'Delivery cash not handed in')}</span></span>
                  <span className="li-amt">{tsh(amount)}</span>
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => act.handIn(id)}>{t('Amekabidhi', 'Handed in')}</button>
                </li>
              ))}
              {d.pending.map((sh) => (
                <li key={sh.id}>
                  <Chip tone="bad">{t('Upungufu', 'Shortage')}</Chip>
                  <span className="li-main"><strong>{nameOf(sh.workerId)}</strong><span>{fmtDate(sh.date, lang)}, {p(SECTIONS[sh.section])}</span></span>
                  <span className="li-amt">{tsh(sh.amount)}</span>
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => act.resolve(sh.id, 'approved')}>{t('Idhinisha', 'Approve')}</button>
                  <button type="button" className="btn-ghost" onClick={() => act.resolve(sh.id, 'rejected')}>{t('Kataa', 'Reject')}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="foot">
        <span>{t('Hii ni data ya mfano.', 'This is sample data.')}</span>
        <button type="button" className="btn-ghost" onClick={act.reset}>{t('Rudisha data ya mfano', 'Reset sample data')}</button>
      </div>
    </div>
  );
}

/* =====================================================================
   FUNGA SIKU  (close the day, six steps)
   ===================================================================== */
function ExpenseForm({ act, defaultSection = 'banda' }) {
  const { t, p } = useI();
  const [cat, setCat] = useState('malighafi');
  const [amount, setAmount] = useState(null);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('droo');
  const [section, setSection] = useState(defaultSection);
  const submit = () => {
    if (!amount) return;
    act.addExpense({ cat, amount, reason: reason.trim() || p(CATS[cat]), from, section: from === 'droo' ? section : undefined });
    setAmount(null);
    setReason('');
  };
  return (
    <div className="panel">
      <h3>{t('Ongeza matumizi', 'Add an expense')}</h3>
      <div className="grid2">
        <Select label={t('Aina', 'Category')} value={cat} onChange={setCat}>
          {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{p(v)}</option>)}
        </Select>
        <MoneyInput label={t('Kiasi', 'Amount')} value={amount} onChange={setAmount} />
      </div>
      <label className="field">
        <span className="field-label">{t('Sababu', 'Reason')}</span>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Kwa mfano: mtungi wa gesi', 'For example: gas cylinder')} />
      </label>
      <div className="field">
        <span className="field-label">{t('Ililipwa kutoka', 'Paid from')}</span>
        <Seg label={t('Ililipwa kutoka', 'Paid from')} value={from} onChange={setFrom} options={[['droo', t('Droo', 'Till')], ['simu', t('Pesa za simu', 'Mobile money')], ['nyingine', t('Nyingine', 'Other')]]} />
      </div>
      {from === 'droo' ? (
        <Select label={t('Droo ya sehemu ipi', 'Which till')} value={section} onChange={setSection}>
          {SEC.map((s) => <option key={s} value={s}>{p(SECTIONS[s])}</option>)}
        </Select>
      ) : null}
      <button type="button" className="btn btn-brand" disabled={!amount} onClick={submit}><Icon name="plus" size={18} />{t('Weka matumizi', 'Save expense')}</button>
    </div>
  );
}

function SalesStep({ db, d, act }) {
  const { t, p } = useI();
  const cashiers = d.active.filter((w) => w.role === 'keshia');
  const y = HISTORY[HISTORY.length - 1];
  const yest = t('Jana', 'Yesterday');
  return (
    <div className="stack">
      {SEC.map((s) => (
        <section className="panel" key={s}>
          <h2>{p(SECTIONS[s])}</h2>
          <div className="grid2">
            <MoneyInput label={t('Pesa taslimu', 'Cash')} value={db.sales[s].cash} onChange={(v) => act.setSale(s, 'cash', v)} hint={`${yest}: ${tsh(y[s].cash)}`} />
            <MoneyInput label={t('Pesa za simu', 'Mobile money')} value={db.sales[s].mobile} onChange={(v) => act.setSale(s, 'mobile', v)} hint={`${yest}: ${tsh(y[s].mobile)}`} />
          </div>
          <Select label={t('Keshia wa siku', 'Cashier of the day')} value={db.sales[s].cashier} onChange={(v) => act.setCashier(s, v)}>
            {cashiers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <div className="totalline"><Leader strong label={t(`Jumla ya ${p(SECTIONS[s]).toLowerCase()}`, `${p(SECTIONS[s])} total`)} value={tsh(d.sales[s])} /></div>
        </section>
      ))}
      <div className="livebar" aria-live="polite">
        <span>{t('Mauzo ya siku nzima', 'Sales for the whole day')}</span>
        <strong><span className="cur">TSh</span>{num(d.salesToday)}</strong>
      </div>
    </div>
  );
}

function DeliveryStep({ db, d, act }) {
  const { t, p } = useI();
  const [workerId, setWorkerId] = useState(() => d.active.find((w) => w.role === 'mpishi')?.id || d.active[0]?.id);
  const [section, setSection] = useState('mgahawa');
  const [amount, setAmount] = useState(null);
  const [method, setMethod] = useState('cash');
  const cooks = d.active;
  const name = (id) => db.workers.find((w) => w.id === id)?.name;
  return (
    <div className="stack">
      <p className="notice"><Icon name="info" size={20} /><span>{t('Delivery ni bure kwa mteja. Unaandika tu nani alipeleka na pesa alizopokea.', 'Delivery is free for the customer. You only record who took it and any cash received.')}</span></p>
      {db.deliveries.length === 0 ? <p className="empty">{t('Hakuna delivery leo.', 'No deliveries today.')}</p> : (
        <ul className="list">
          {db.deliveries.map((x) => (
            <li key={x.id}>
              <span className="li-main"><strong>{name(x.workerId)}</strong><span>{p(SECTIONS[x.section])}, {x.method === 'cash' ? t('pesa taslimu', 'cash') : t('pesa za simu', 'mobile money')}</span></span>
              <span className="li-amt">{tsh(x.amount)}</span>
              {x.method === 'mobile' ? <Chip>{t('Hakuna cha kukabidhi', 'Nothing to hand in')}</Chip>
                : x.handedIn ? <Chip tone="good">{t('Imekabidhiwa', 'Handed in')}</Chip>
                : <button type="button" className="btn btn-quiet btn-small" onClick={() => act.handInOne(x.id)}>{t('Amekabidhi', 'Handed in')}</button>}
              <button type="button" className="btn-danger-ghost" aria-label={t('Futa', 'Delete')} onClick={() => act.removeDelivery(x.id)}><Icon name="trash" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="panel">
        <h3>{t('Ongeza delivery', 'Add a delivery')}</h3>
        <div className="grid2">
          <Select label={t('Aliyepeleka', 'Taken by')} value={workerId} onChange={setWorkerId}>{cooks.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
          <Select label={t('Sehemu', 'Section')} value={section} onChange={setSection}>{SEC.map((s) => <option key={s} value={s}>{p(SECTIONS[s])}</option>)}</Select>
        </div>
        <MoneyInput label={t('Kiasi cha oda', 'Order amount')} value={amount} onChange={setAmount} />
        <div className="field">
          <span className="field-label">{t('Mteja alilipa kwa', 'Customer paid by')}</span>
          <Seg label={t('Njia ya malipo', 'Payment method')} value={method} onChange={setMethod} options={[['cash', t('Pesa taslimu', 'Cash')], ['mobile', t('Pesa za simu', 'Mobile money')]]} />
        </div>
        <button type="button" className="btn btn-brand" disabled={!amount} onClick={() => { act.addDelivery({ workerId, section, amount, method, handedIn: method === 'mobile' }); setAmount(null); }}><Icon name="plus" size={18} />{t('Weka delivery', 'Save delivery')}</button>
      </div>
    </div>
  );
}

function ExpensesStep({ db, d, act }) {
  const { t, p, lang } = useI();
  const today = db.expenses.filter((e) => e.date === TODAY);
  return (
    <div className="stack">
      {today.length === 0 ? <p className="empty">{t('Hakuna matumizi yaliyoandikwa leo.', 'No expenses recorded today.')}</p> : (
        <ul className="list">
          {today.map((e) => (
            <li key={e.id}>
              <span className="li-main"><strong>{e.reason}</strong><span>{p(CATS[e.cat])}, {e.from === 'droo' ? `${t('droo ya', 'till of')} ${p(SECTIONS[e.section]).toLowerCase()}` : e.from === 'simu' ? t('pesa za simu', 'mobile money') : t('nyingine', 'other')}</span></span>
              <span className="li-amt">{tsh(e.amount)}</span>
              <button type="button" className="btn-danger-ghost" aria-label={t('Futa', 'Delete')} onClick={() => act.removeExpense(e.id)}><Icon name="trash" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="ledger"><Leader strong label={t('Matumizi ya leo', "Today's expenses")} value={tsh(d.expToday)} /></div>
      <p className="notice"><Icon name="info" size={20} /><span>{t('Pesa zilizotoka kwenye droo hupunguza pesa inayotarajiwa kwenye hatua ya kuhesabu.', 'Cash paid out of the till lowers the expected cash in the cash count step.')}</span></p>
      <ExpenseForm act={act} />
    </div>
  );
}

function CashStep({ db, d, act }) {
  const { t, p } = useI();
  return (
    <div className="stack">
      {SEC.map((s) => {
        const c = d.cash[s];
        const tone = c.diff == null ? null : c.diff === 0 ? 'good' : c.diff < 0 ? 'bad' : 'warn';
        const cashier = db.workers.find((w) => w.id === db.sales[s].cashier)?.name;
        return (
          <section className="stack" key={s}>
            <h2>{p(SECTIONS[s])}</h2>
            <div className="ledger">
              <Leader label={t('Mauzo ya pesa taslimu', 'Cash sales')} value={tsh(c.cashSales)} />
              <Leader label={t('Pesa ya delivery isiyokabidhiwa', 'Delivery cash not handed in')} value={`− ${tsh(c.undelivered)}`} />
              <Leader label={t('Zilizotoka kwenye droo', 'Paid out of the till')} value={`− ${tsh(c.payouts)}`} />
              <Leader strong label={t('Pesa inayotarajiwa', 'Expected cash')} value={tsh(c.expected)} />
            </div>
            <div className="stack">
              <MoneyInput
                label={t('Pesa uliyohesabu kwenye droo', 'Cash you counted in the till')}
                hint={t(`Hesabu pamoja na chenji ya kudumu ya ${tsh(c.float)}.`, `Count everything, including the ${tsh(c.float)} change float.`)}
                value={c.counted}
                onChange={(v) => act.setCounted(s, v)}
              />
              {c.counted != null ? (
                <>
                  <div className="ledger">
                    <Leader label={t('Ukiondoa chenji ya kudumu', 'Minus the change float')} value={`− ${tsh(c.float)}`} />
                    <Leader label={t('Pesa ya mauzo uliyohesabu', 'Sales cash you counted')} value={tsh(c.counted - c.float)} />
                    <Leader strong tone={tone} label={t('Tofauti', 'Difference')} value={c.diff === 0 ? tsh(0) : signed(c.diff)} />
                  </div>
                  <p className={`verdict ${tone}`}>
                    <Icon name={tone === 'good' ? 'check' : 'alert'} size={20} />
                    {c.diff === 0 ? t('Sawa. Hakuna tofauti.', 'All good. No difference.')
                      : c.diff < 0 ? t(`Upungufu wa ${tsh(-c.diff)}. Utaandikwa kwa jina la ${cashier}.`, `Shortage of ${tsh(-c.diff)}. It will be recorded under ${cashier}.`)
                      : t(`Ziada ya ${tsh(c.diff)}. Angalia kama kuna mauzo yaliyokosekana.`, `Surplus of ${tsh(c.diff)}. Check for missing sales.`)}
                  </p>
                </>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AttendanceStep({ db, d, act }) {
  const { t, p } = useI();
  return (
    <div className="stack">
      <p className="notice"><Icon name="info" size={20} /><span>{t('Siku ya mapumziko, ruhusa na likizo zinajazwa zenyewe kutoka kwenye rekodi. Wewe unaandika waliobaki.', 'Days off, permissions and holidays fill in from the records. You only mark the others.')}</span></p>
      <ul className="list">
        {d.active.map((w) => {
          const s = d.status[w.id];
          return (
            <li key={w.id} className="att-row">
              <Initials name={w.name} />
              <span className="li-main"><strong>{w.name}</strong><span>{p(ROLES[w.role])}</span></span>
              {s.locked ? (
                <Chip tone="info">{p(STATUS[s.key])}{s.locked === 'leave' ? ` ${t('(kwenye rekodi)', '(on record)')}` : ` ${t('(kila wiki)', '(weekly)')}`}</Chip>
              ) : (
                <Seg label={w.name} value={s.key} onChange={(v) => act.setAttendance(w.id, v)} disabled={!!db.closed}
                  options={[['present', t('Yupo', 'Present')], ['late', t('Amechelewa', 'Late')], ['absent', t('Hakuja', 'Absent')]]} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewStep({ db, d, act, setStep }) {
  const { t, p } = useI();
  const closed = !!db.closed;
  const count = (k) => d.active.filter((w) => d.status[w.id].key === k).length;
  const blocked = d.missing.length > 0;
  return (
    <div className="stack">
      <div className={`ledger${closed ? ' stamped' : ''}`}>
        {closed ? <span className="stamp">{t('IMEFUNGWA', 'CLOSED')}</span> : null}
        <Leader label={t('Mauzo ya banda', 'Stall sales')} value={tsh(d.sales.banda)} />
        <Leader label={t('Mauzo ya mgahawa', 'Restaurant sales')} value={tsh(d.sales.mgahawa)} />
        <Leader strong label={t('Jumla ya mauzo', 'Total sales')} value={tsh(d.salesToday)} />
        <Leader label={t('Matumizi ya leo', "Today's expenses")} value={`− ${tsh(d.expToday)}`} />
        <Leader label={t('Pesa ya delivery inayodaiwa', 'Delivery cash still owed')} value={tsh(sum(Object.values(d.owed)))} />
        {SEC.map((s) => (
          <Leader key={s} tone={d.cash[s].diff === 0 ? 'good' : d.cash[s].diff < 0 ? 'bad' : 'warn'} label={`${t('Tofauti', 'Difference')}: ${p(SECTIONS[s]).toLowerCase()}`} value={d.cash[s].diff == null ? '—' : d.cash[s].diff === 0 ? tsh(0) : signed(d.cash[s].diff)} />
        ))}
        <Leader label={t('Waliohudhuria', 'Present')} value={`${count('present') + count('late')} / ${d.active.length}`} />
      </div>

      {blocked && !closed ? (
        <div className="notice warn">
          <Icon name="alert" size={20} />
          <span>{t('Andika mahudhurio ya ', 'Mark attendance for ')}<strong>{d.missing.map((w) => w.name).join(', ')}</strong>{t(' kabla ya kufunga.', ' before closing.')}{' '}
            <button type="button" className="btn-ghost" style={{ minHeight: 0, padding: 0 }} onClick={() => setStep(4)}>{t('Nenda mahudhurio', 'Go to attendance')}</button></span>
        </div>
      ) : null}
      {closed ? (
        <div className="notice good"><Icon name="check" size={20} /><span>{t('Siku imefungwa. Marekebisho yanaongezwa kama rekodi mpya inayobaki na ile ya awali.', 'The day is closed. Corrections are added as new entries that keep the original.')}</span></div>
      ) : (
        <button type="button" className="btn btn-primary" disabled={blocked} onClick={act.closeDay}>{t('Funga siku ya leo', "Close today's books")}</button>
      )}
    </div>
  );
}

function FungaView({ db, d, act, step, setStep }) {
  const { t, p } = useI();
  const closed = !!db.closed;
  const go = (n) => setStep(Math.max(0, Math.min(5, n)));
  const Body = [SalesStep, DeliveryStep, ExpensesStep, CashStep, AttendanceStep][step];
  return (
    <div>
      <header className="page-head">
        <p className="muted">{t(`Hatua ${step + 1} ya 6`, `Step ${step + 1} of 6`)}</p>
        <h1>{p(STEPS[step])}</h1>
      </header>
      <ol className="stepper" aria-label={t('Hatua', 'Steps')}>
        {STEPS.map((s, i) => (
          <li key={i} className={`${i === step ? 'on' : ''}${closed || db.visited.includes(i) ? ' done' : ''}`}>
            <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
              <span className="n">{closed || db.visited.includes(i) ? <Icon name="check" size={14} /> : i + 1}</span>
              <span className="lbl">{p(s)}</span>
            </button>
          </li>
        ))}
      </ol>
      {closed && step < 5 ? <p className="notice good" style={{ marginBottom: '1rem' }}><Icon name="check" size={20} /><span>{t('Siku hii imefungwa. Unaweza kuangalia tu.', 'This day is closed. You can only look.')}</span></p> : null}
      <fieldset className="plain" disabled={closed && step < 5}>
        {step < 5 ? <Body db={db} d={d} act={act} /> : <ReviewStep db={db} d={d} act={act} setStep={setStep} />}
      </fieldset>
      <div className="step-actions">
        <button type="button" className="btn btn-quiet" disabled={step === 0} onClick={() => go(step - 1)}><Icon name="back" size={18} />{t('Nyuma', 'Back')}</button>
        {step < 5 ? <button type="button" className="btn btn-primary" onClick={() => { act.visit(step); go(step + 1); }}>{t('Endelea', 'Continue')}<Icon name="next" size={18} /></button> : <span />}
      </div>
    </div>
  );
}

/* =====================================================================
   WAFANYAKAZI  (workers)
   ===================================================================== */
function WorkerForm({ act, onDone }) {
  const { t, p } = useI();
  const [f, setF] = useState({ name: '', role: 'mpishi', pay: 'daily', rate: null, dayOff: 1, phone: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="panel" style={{ marginBottom: '1rem' }}>
      <h3>{t('Mfanyakazi mpya', 'New worker')}</h3>
      <label className="field"><span className="field-label">{t('Jina kamili', 'Full name')}</span><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="grid2">
        <Select label={t('Cheo', 'Role')} value={f.role} onChange={(v) => set('role', v)}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{p(v)}</option>)}</Select>
        <label className="field"><span className="field-label">{t('Simu', 'Phone')}</span><input type="text" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
      </div>
      <div className="field"><span className="field-label">{t('Analipwa', 'Paid')}</span><Seg label={t('Aina ya malipo', 'Pay type')} value={f.pay} onChange={(v) => set('pay', v)} options={[['daily', t('Kwa siku', 'Daily')], ['monthly', t('Mshahara wa mwezi', 'Monthly salary')]]} /></div>
      <div className="grid2">
        <MoneyInput label={f.pay === 'daily' ? t('Kiwango cha siku', 'Daily rate') : t('Mshahara wa mwezi', 'Monthly salary')} value={f.rate} onChange={(v) => set('rate', v)} />
        <Select label={t('Siku ya mapumziko', 'Weekly day off')} value={String(f.dayOff)} onChange={(v) => set('dayOff', Number(v))}>{DAYS[0].map((dn, i) => <option key={i} value={i}>{p([dn, DAYS[1][i]])}</option>)}</Select>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn btn-brand" disabled={!f.name.trim() || !f.rate} onClick={() => { act.addWorker({ ...f, name: f.name.trim() }); onDone(); }}>{t('Hifadhi mfanyakazi', 'Save worker')}</button>
        <button type="button" className="btn btn-quiet" onClick={onDone}>{t('Ghairi', 'Cancel')}</button>
      </div>
    </div>
  );
}

function MonthCal({ w, db, d }) {
  const { t, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const lead = (new Date(2026, 8, 1).getDay() + 6) % 7;
  const head = [1, 2, 3, 4, 5, 6, 0].map((i) => DAYS_SHORT[L][i]);
  const cells = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    return { day, key: day === 30 ? d.status[w.id]?.key : dayStatus(w, db, day) };
  });
  return (
    <div className="stack" style={{ gap: '0.9rem' }}>
      <div className="cal">
        {head.map((h) => <span className="hd" key={h}>{h}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {cells.map(({ day, key }) => (
          <span key={day} className={`c ${key || 'unmarked'}${day === 30 ? ' today' : ''}`} title={`${day} ${SHORT[L][8]}: ${key ? STATUS[key][L] : t('Hajaandikwa', 'Not marked')}`}>{day}</span>
        ))}
      </div>
      <div className="legend">
        <span><i className="present" />{t('Amehudhuria', 'Present')}</span>
        <span><i className="late" />{t('Amechelewa', 'Late')}</span>
        <span><i className="absent" />{t('Hakuja', 'Absent')}</span>
        <span><i className="leave" />{t('Ruhusa au likizo', 'Permission or holiday')}</span>
        <span><i />{t('Mapumziko', 'Day off')}</span>
      </div>
    </div>
  );
}

function WorkerDetail({ w, db, d, act, onBack }) {
  const { t, p, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const [tab, setTab] = useState('overview');
  const [type, setType] = useState('permission');
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(TODAY);
  const [reason, setReason] = useState('');
  const [adv, setAdv] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [why, setWhy] = useState('left');
  const sal = d.salary.find((r) => r.w.id === w.id);
  const leaves = db.leaves.filter((l) => l.workerId === w.id).sort((a, b) => (a.from < b.from ? 1 : -1));
  const advs = db.advances.filter((a) => a.workerId === w.id);
  const shorts = db.shortages.filter((x) => x.workerId === w.id);
  const owed = d.owed[w.id] || 0;
  const pending = db.shortages.filter((x) => x.workerId === w.id && x.status === 'pending');
  const blocked = owed > 0 || pending.length > 0;
  const salaryLeft = !db.salary.paid[w.id];
  return (
    <aside className="wl-detail">
      <button type="button" className="btn btn-quiet btn-small back-btn" onClick={onBack}><Icon name="back" size={18} />{t('Wafanyakazi wote', 'All workers')}</button>
      <header className="whead">
        <Initials name={w.name} size="lg" />
        <div>
          <h1>{w.name}</h1>
          <p className="muted">{p(ROLES[w.role])}, {w.phone}</p>
          <div className="chips">
            <StatusChip k={d.status[w.id].key} />
            <Chip>{w.pay === 'daily' ? `${tsh(w.rate)} ${t('kwa siku', 'per day')}` : `${tsh(w.rate)} ${t('kwa mwezi', 'per month')}`}</Chip>
          </div>
        </div>
      </header>

      <Tabs label={t('Taarifa za mfanyakazi', 'Worker details')} value={tab} onChange={setTab}
        items={[['overview', t('Muhtasari', 'Overview')], ['leave', t('Ruhusa na likizo', 'Leave')], ['money', t('Pesa', 'Money')]]} />

      {tab === 'overview' ? (
        <div className="stack view">
          <section className="stack">
            <h2>{t('Mahudhurio ya Septemba', 'September attendance')}</h2>
            <MonthCal w={w} db={db} d={d} />
          </section>
          <section className="stack">
            <h2>{t('Siku zilizohesabiwa', 'Days counted')}</h2>
            <div className="ledger">
              {['present', 'late', 'absent', 'permission', 'holiday', 'dayoff'].map((k) => (
                <Leader key={k} label={p(STATUS[k])} value={`${sal.stats[k] || 0} ${t('siku', 'days')}`} />
              ))}
            </div>
          </section>
          <section className="stack">
            <h2>{t('Siku ya mapumziko', 'Weekly day off')}</h2>
            <Select label={t('Kila wiki', 'Every week')} value={String(w.dayOff)} onChange={(v) => act.patchWorker(w.id, { dayOff: Number(v) })}>
              {DAYS[0].map((dn, i) => <option key={i} value={i}>{p([dn, DAYS[1][i]])}</option>)}
            </Select>
          </section>

          <section className="stack danger-zone">
            <h2>{t('Ondoa mfanyakazi', 'Remove worker')}</h2>
            <p className="muted">{t('Hafutwi kabisa. Anatoka kwenye orodha za kila siku, lakini historia yake ya mishahara, mahudhurio na pesa inabaki. Unaweza kumrudisha wakati wowote.', 'The worker is not erased. They leave the daily lists, but the history of pay, attendance and cash stays. You can restore them at any time.')}</p>
            {!confirming ? (
              <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}><Icon name="trash" size={18} />{t(`Ondoa ${w.name}`, `Remove ${w.name}`)}</button>
            ) : (
              <div className="panel danger-panel">
                <h3>{t(`Kumwondoa ${w.name}?`, `Remove ${w.name}?`)}</h3>
                {owed > 0 ? (
                  <div className="notice warn">
                    <Icon name="alert" size={20} />
                    <span>{t(`Anadaiwa pesa ya delivery ya ${tsh(owed)}. Weka alama kuwa amekabidhi kwanza.`, `Owes ${tsh(owed)} in delivery cash. Mark it as handed in first.`)}{' '}
                      <button type="button" className="btn-ghost" style={{ minHeight: 0, padding: 0 }} onClick={() => act.handIn(w.id)}>{t('Amekabidhi', 'Handed in')}</button></span>
                  </div>
                ) : null}
                {pending.map((sh) => (
                  <div className="notice warn" key={sh.id}>
                    <Icon name="alert" size={20} />
                    <span>{t(`Ana upungufu wa ${tsh(sh.amount)} unaosubiri idhini yako.`, `Has a ${tsh(sh.amount)} shortage waiting for your approval.`)}{' '}
                      <button type="button" className="btn-ghost" style={{ minHeight: 0, padding: '0 0.5rem 0 0' }} onClick={() => act.resolve(sh.id, 'approved')}>{t('Idhinisha', 'Approve')}</button>
                      <button type="button" className="btn-ghost" style={{ minHeight: 0, padding: 0 }} onClick={() => act.resolve(sh.id, 'rejected')}>{t('Kataa', 'Reject')}</button></span>
                  </div>
                ))}
                {!blocked && salaryLeft ? <p className="notice"><Icon name="info" size={20} /><span>{t('Mshahara wake wa Septemba utabaki kwenye orodha ya mishahara hadi ulipwe.', 'The September salary stays on the salary list until it is paid.')}</span></p> : null}
                <Select label={t('Sababu', 'Reason')} value={why} onChange={setWhy}>
                  <option value="left">{t('Ameacha kazi', 'Left the job')}</option>
                  <option value="ended">{t('Ameachishwa kazi', 'Contract ended')}</option>
                  <option value="other">{t('Nyingine', 'Other')}</option>
                </Select>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-danger-solid" disabled={blocked} onClick={() => { act.removeWorker(w.id, why); onBack(); }}>{t('Ndiyo, mwondoe', 'Yes, remove')}</button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>{t('Ghairi', 'Cancel')}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'leave' ? (
        <div className="stack view">
          {leaves.length === 0 ? <p className="empty">{t('Hakuna ruhusa wala likizo bado.', 'No permissions or holidays yet.')}</p> : (
            <ul className="list">
              {leaves.map((l) => (
                <li key={l.id}>
                  <Chip tone="info">{p(STATUS[l.type])}</Chip>
                  <span className="li-main"><strong>{fmtRange(l.from, l.to, lang)}</strong><span>{l.reason}</span></span>
                  <button type="button" className="btn-danger-ghost" aria-label={t('Futa', 'Delete')} onClick={() => act.removeLeave(l.id)}><Icon name="trash" size={18} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="panel">
            <h3>{t('Ongeza ruhusa au likizo', 'Add a permission or holiday')}</h3>
            <Seg label={t('Aina', 'Type')} value={type} onChange={setType} options={[['permission', t('Ruhusa', 'Permission')], ['holiday', t('Likizo', 'Holiday')]]} />
            <div className="grid2">
              <label className="field"><span className="field-label">{t('Kuanzia', 'From')}</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></label>
              <label className="field"><span className="field-label">{t('Hadi', 'To')}</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
            <label className="field"><span className="field-label">{t('Sababu', 'Reason')}</span><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <button type="button" className="btn btn-brand" disabled={!from || !to} onClick={() => { act.addLeave({ workerId: w.id, type, from, to, reason: reason.trim() || '—' }); setReason(''); }}><Icon name="plus" size={18} />{t('Weka rekodi', 'Save record')}</button>
          </div>
        </div>
      ) : null}

      {tab === 'money' ? (
        <div className="stack view">
          <section className="stack">
            <h2>{t('Malipo', 'Pay')}</h2>
            <div className="ledger">
              <Leader label={w.pay === 'daily' ? t('Kiwango cha siku', 'Daily rate') : t('Mshahara wa mwezi', 'Monthly salary')} value={tsh(w.rate)} />
              <Leader label={t('Mshahara wa msingi (Septemba)', 'Base pay (September)')} value={tsh(sal.base)} />
              <Leader label={t('Advansi', 'Advances')} value={sal.adv ? `− ${tsh(sal.adv)}` : tsh(0)} />
              <Leader label={t('Upungufu ulioidhinishwa', 'Approved shortages')} value={sal.short ? `− ${tsh(sal.short)}` : tsh(0)} />
              <Leader strong label={t('Mshahara halisi', 'Net pay')} value={tsh(sal.net)} />
            </div>
          </section>
          <section className="stack">
            <h2>{t('Advansi za mshahara', 'Salary advances')}</h2>
            {advs.length === 0 ? <p className="empty">{t('Hakuna advansi.', 'No advances.')}</p> : (
              <ul className="list">{advs.map((a) => <li key={a.id}><span className="li-main"><strong>{fmtDate(a.date, lang)}</strong></span><span className="li-amt">{tsh(a.amount)}</span></li>)}</ul>
            )}
            <div className="panel">
              <MoneyInput label={t('Advansi mpya', 'New advance')} value={adv} onChange={setAdv} />
              <button type="button" className="btn btn-quiet" disabled={!adv} onClick={() => { act.addAdvance({ workerId: w.id, amount: adv, date: TODAY }); setAdv(null); }}>{t('Weka advansi', 'Save advance')}</button>
            </div>
          </section>
          <section className="stack">
            <h2>{t('Tofauti za pesa', 'Cash differences')}</h2>
            {shorts.length === 0 ? <p className="empty">{t('Hakuna upungufu.', 'No shortages.')}</p> : (
              <ul className="list">
                {shorts.map((x) => (
                  <li key={x.id}>
                    <span className="li-main"><strong>{fmtDate(x.date, lang)}</strong><span>{p(SECTIONS[x.section])}</span></span>
                    <span className="li-amt">{tsh(x.amount)}</span>
                    <Chip tone={x.status === 'approved' ? 'bad' : x.status === 'pending' ? 'warn' : 'neutral'}>{x.status === 'approved' ? t('Imekatwa', 'Deducted') : x.status === 'pending' ? t('Inasubiri', 'Pending') : t('Imekataliwa', 'Rejected')}</Chip>
                  </li>
                ))}
              </ul>
            )}
            {owed > 0 ? <p className="notice warn"><Icon name="alert" size={20} /><span>{t(`Anadaiwa pesa ya delivery ya ${tsh(owed)}.`, `Owes ${tsh(owed)} in delivery cash.`)}</span></p> : null}
          </section>
        </div>
      ) : null}
    </aside>
  );
}

function WorkersView({ db, d, act }) {
  const { t, p, lang } = useI();
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const w = db.workers.find((x) => x.id === sel && isActive(x));
  const removed = db.workers.filter((x) => !isActive(x));
  const whyText = { left: t('Ameacha kazi', 'Left the job'), ended: t('Ameachishwa kazi', 'Contract ended'), other: t('Nyingine', 'Other') };
  return (
    <div className={`workers-layout${w ? ' has-sel' : ''}`}>
      <div className="wl-list">
        <header className="page-head row-head">
          <div>
            <h1>{t('Wafanyakazi', 'Workers')}</h1>
            <p className="muted">{t(`${d.active.length} kwenye orodha`, `${d.active.length} on the list`)}</p>
          </div>
          <button type="button" className="btn btn-brand" onClick={() => setAdding(true)}><Icon name="plus" size={18} />{t('Ongeza', 'Add')}</button>
        </header>
        {adding ? <WorkerForm act={act} onDone={() => setAdding(false)} /> : null}
        <ul className="list">
          {d.active.map((x) => (
            <li key={x.id} style={{ padding: 0 }}>
              <button type="button" className={`wrow${sel === x.id ? ' on' : ''}`} onClick={() => setSel(x.id)}>
                <Initials name={x.name} />
                <span className="li-main"><strong>{x.name}</strong><span>{p(ROLES[x.role])}, {x.pay === 'daily' ? `${tsh(x.rate)} ${t('kwa siku', 'per day')}` : `${tsh(x.rate)} ${t('kwa mwezi', 'per month')}`}</span></span>
                <StatusChip k={d.status[x.id].key} />
              </button>
            </li>
          ))}
        </ul>
        {removed.length > 0 ? (
          <div className="stack" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-quiet btn-small" style={{ alignSelf: 'flex-start' }} aria-expanded={showRemoved} onClick={() => setShowRemoved((v) => !v)}>
              {t(`Walioondolewa (${removed.length})`, `Removed (${removed.length})`)}
            </button>
            {showRemoved ? (
              <ul className="list">
                {removed.map((x) => (
                  <li key={x.id}>
                    <Initials name={x.name} />
                    <span className="li-main"><strong>{x.name}</strong><span>{p(ROLES[x.role])}, {fmtDate(x.removedOn, lang)}, {whyText[x.removedWhy] || ''}</span></span>
                    <button type="button" className="btn btn-quiet btn-small" onClick={() => act.restoreWorker(x.id)}>{t('Rudisha', 'Restore')}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      {w ? <WorkerDetail key={w.id} w={w} db={db} d={d} act={act} onBack={() => setSel(null)} /> : <div className="wl-empty muted">{t('Chagua mfanyakazi kuona mahudhurio, ruhusa, likizo, advansi na tofauti za pesa.', 'Pick a worker to see attendance, leave, advances and cash differences.')}</div>}
    </div>
  );
}

/* =====================================================================
   FEDHA  (money: expenses, salaries, reports)
   ===================================================================== */
function CategoryBars({ db }) {
  const { t, p } = useI();
  const byCat = Object.keys(CATS).map((k) => ({ k, v: sum(db.expenses.filter((e) => e.cat === k), (e) => e.amount) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const max = byCat[0]?.v || 1;
  return (
    <div className="bars" role="list" aria-label={t('Matumizi kwa aina', 'Expenses by category')}>
      {byCat.map((c) => (
        <div className="bar-line" role="listitem" key={c.k}>
          <div className="top"><span>{p(CATS[c.k])}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{tsh(c.v)}</strong></div>
          <div className="track"><div className="fill" style={{ width: `${(c.v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function DiffChip({ n }) {
  return n === 0 ? <Chip tone="good">0</Chip> : <Chip tone={n < 0 ? 'bad' : 'warn'}>{signed(n)}</Chip>;
}

function DownloadButtons({ files, act, label }) {
  const { t } = useI();
  return (
    <div className="dl">
      <button type="button" className="btn btn-brand" onClick={() => act.save(files.pdf)}><Icon name="download" size={18} />{t('Pakua PDF', 'Download PDF')}</button>
      <button type="button" className="btn btn-quiet" onClick={() => act.save(files.csv)}><Icon name="download" size={18} />{t('Pakua Excel', 'Download Excel')}</button>
      {label ? <small className="muted dl-note">{label}</small> : null}
    </div>
  );
}

function DayDetail({ rec, db, act, onBack }) {
  const { t, p, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const exp = db.expenses.filter((e) => e.date === rec.iso);
  const expTotal = sum(exp, (e) => e.amount);
  const files = useMemo(() => dayFiles(rec, exp, lang), [rec, db.expenses, lang]);
  const bTot = rec.banda.cash + rec.banda.mobile;
  const gTot = rec.mgahawa.cash + rec.mgahawa.mobile;
  const open = rec.live && !db.closed;
  return (
    <div className="stack">
      <button type="button" className="btn btn-quiet btn-small" style={{ alignSelf: 'flex-start' }} onClick={onBack}><Icon name="back" size={18} />{t('Rudi kwenye mwezi', 'Back to the month')}</button>
      <div>
        <h2 style={{ fontSize: '1.5rem' }}>{DAYS[L][rec.dow]}, {rec.d} {MONTHS[L][rec.m]} 2026</h2>
        <p style={{ marginTop: '0.35rem' }}>{open ? <Chip tone="warn">{t('Haijafungwa bado', 'Not closed yet')}</Chip> : <Chip tone="good">{t('Imefungwa', 'Closed')}</Chip>}</p>
      </div>
      <div className="ledger">
        <Leader label={`${p(SECTIONS.banda)}: ${t('pesa taslimu', 'cash')}`} value={tsh(rec.banda.cash)} />
        <Leader label={`${p(SECTIONS.banda)}: ${t('pesa za simu', 'mobile money')}`} value={tsh(rec.banda.mobile)} />
        <Leader strong label={t('Jumla ya banda', 'Stall total')} value={tsh(bTot)} />
        <Leader label={`${p(SECTIONS.mgahawa)}: ${t('pesa taslimu', 'cash')}`} value={tsh(rec.mgahawa.cash)} />
        <Leader label={`${p(SECTIONS.mgahawa)}: ${t('pesa za simu', 'mobile money')}`} value={tsh(rec.mgahawa.mobile)} />
        <Leader strong label={t('Jumla ya mgahawa', 'Restaurant total')} value={tsh(gTot)} />
        <Leader strong label={t('Jumla ya mauzo', 'Total sales')} value={tsh(rec.total)} />
        <Leader label={t('Matumizi ya siku', "Day's expenses")} value={`− ${tsh(expTotal)}`} />
        <Leader strong tone={rec.diff === 0 ? 'good' : rec.diff < 0 ? 'bad' : 'warn'} label={t('Tofauti ya pesa', 'Cash difference')} value={rec.diff === 0 ? tsh(0) : signed(rec.diff)} />
      </div>
      <h2>{t('Matumizi ya siku hii', 'Expenses on this day')}</h2>
      {exp.length === 0 ? <p className="empty">{t('Hakuna matumizi yaliyoandikwa siku hii.', 'No expenses recorded on this day.')}</p> : (
        <ul className="list">
          {exp.map((e) => (
            <li key={e.id}><Chip>{p(CATS[e.cat])}</Chip><span className="li-main"><strong>{e.reason}</strong></span><span className="li-amt">{tsh(e.amount)}</span></li>
          ))}
        </ul>
      )}
      <DownloadButtons files={files} act={act} label={t('Faili la siku hii tu.', 'A file for this day only.')} />
    </div>
  );
}

function SalesTab({ db, d, act }) {
  const { t, p, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const [month, setMonth] = useState(8);
  const [dayIso, setDayIso] = useState(null);
  const days = useMemo(() => daysOf(month, db, d), [month, db, d]);
  const files = useMemo(() => monthFiles(days, month, lang), [days, month, lang]);
  const rec = days.find((r) => r.iso === dayIso);
  if (rec) return <DayDetail rec={rec} db={db} act={act} onBack={() => setDayIso(null)} />;

  const total = sum(days, (r) => r.total);
  const cash = sum(days, (r) => r.banda.cash + r.mgahawa.cash);
  const mobile = sum(days, (r) => r.banda.mobile + r.mgahawa.mobile);
  const banda = sum(days, (r) => r.banda.cash + r.banda.mobile);
  const best = days.reduce((a, b) => (b.total > a.total ? b : a));
  const max = Math.max(...days.map((r) => r.total));
  const rows = [...days].reverse();
  const mobilePct = Math.round((mobile / total) * 100);
  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">{t('Chagua mwezi', 'Choose a month')}</span>
        <Seg label={t('Mwezi', 'Month')} value={month} onChange={setMonth} options={MONTH_OPTIONS.map((m) => [m, MONTHS[L][m]])} />
      </div>

      <div className="salesgrid">
        <div className="ledger">
          <Leader strong label={t(`Mauzo ya ${MONTHS[0][month]}`, `${MONTHS[1][month]} sales`)} sub={t(`Siku ${days.length}`, `${days.length} days`)} value={tsh(total)} />
          <Leader label={t('Pesa taslimu', 'Cash')} value={tsh(cash)} />
          <Leader label={t('Pesa za simu', 'Mobile money')} value={tsh(mobile)} />
          <Leader label={t('Wastani kwa siku', 'Average per day')} value={tsh(total / days.length)} />
          <Leader label={t('Siku bora', 'Best day')} sub={`${DAYS[L][best.dow]} ${fmtDate(best.iso, lang)}`} value={tsh(best.total)} />
        </div>
        <section className="panel">
          <h2>{t('Zinatoka wapi', 'Where it comes from')}</h2>
          <div className="donut-row">
            <Donut parts={[{ v: cash }, { v: mobile }]}>
              <strong>{mobilePct}%</strong>
              <small className="muted">{t('kwa simu', 'by phone')}</small>
            </Donut>
            <div className="key">
              <div><i className="k0" /><span>{t('Pesa taslimu', 'Cash')}</span><strong>{tsh(cash)}</strong></div>
              <div><i className="k1" /><span>{t('Pesa za simu', 'Mobile money')}</span><strong>{tsh(mobile)}</strong></div>
            </div>
          </div>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <div className="splitbar" role="img" aria-label={`${p(SECTIONS.banda)} ${Math.round((banda / total) * 100)}%, ${p(SECTIONS.mgahawa)} ${Math.round(((total - banda) / total) * 100)}%`}>
              <span style={{ flex: banda }} /><span style={{ flex: total - banda }} />
            </div>
            <div className="splitkey">
              <div><i className="k0" /><span>{p(SECTIONS.banda)}</span><strong>{tsh(banda)}</strong></div>
              <div><i className="k1" /><span>{p(SECTIONS.mgahawa)}</span><strong>{tsh(total - banda)}</strong></div>
            </div>
          </div>
        </section>
      </div>

      <DownloadButtons files={files} act={act} label={t(`Faili la ${MONTHS[0][month]} mzima.`, `A file for all of ${MONTHS[1][month]}.`)} />

      <h2>{t('Siku kwa siku', 'Day by day')}</h2>
      <p className="muted" style={{ marginTop: '-0.75rem' }}>{t('Bonyeza tarehe kuona siku hiyo kwa undani na kuipakua.', 'Tap a date to see that day in detail and download it.')}</p>
      <table className="tbl">
        <thead><tr><th>{t('Tarehe', 'Date')}</th><th className="r">{t('Banda', 'Stall')}</th><th className="r">{t('Mgahawa', 'Restaurant')}</th><th className="r">{t('Jumla', 'Total')}</th><th className="r">{t('Tofauti', 'Difference')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.iso}>
              <td className="who">
                <button type="button" className="datebtn" onClick={() => setDayIso(r.iso)}>{DAYS_SHORT[L][r.dow]} {fmtDate(r.iso, lang)}</button>
                {r.live && !db.closed ? <> <Chip tone="warn">{t('Haijafungwa', 'Open')}</Chip></> : null}
              </td>
              <td className="r" data-label={t('Banda', 'Stall')}>{num(r.banda.cash + r.banda.mobile)}</td>
              <td className="r" data-label={t('Mgahawa', 'Restaurant')}>{num(r.mgahawa.cash + r.mgahawa.mobile)}</td>
              <td className="r databar" style={{ '--w': Math.round((r.total / max) * 100) }} data-label={t('Jumla', 'Total')}><strong>{num(r.total)}</strong></td>
              <td className="r" data-label={t('Tofauti', 'Difference')}><DiffChip n={r.diff} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="who">{t('Jumla', 'Total')}</td><td className="r" data-label={t('Banda', 'Stall')}>{num(banda)}</td><td className="r" data-label={t('Mgahawa', 'Restaurant')}>{num(total - banda)}</td><td className="r" data-label={t('Jumla', 'Total')}>{num(total)}</td><td className="r" data-label={t('Tofauti', 'Difference')}>{signed(sum(days, (r) => r.diff))}</td></tr></tfoot>
      </table>
    </div>
  );
}

function ExpensesTab({ db, d, act }) {
  const { t, p, lang } = useI();
  const list = [...db.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return (
    <div className="stack">
      <div className="ledger">
        <Leader strong label={t('Matumizi ya Septemba', 'September expenses')} value={tsh(d.monthExp)} />
        <Leader label={t('Ya leo', 'Today')} value={tsh(d.expToday)} />
      </div>
      <h2>{t('Kwa aina', 'By category')}</h2>
      <CategoryBars db={db} />
      <h2>{t('Yaliyoandikwa hivi karibuni', 'Recently recorded')}</h2>
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <Chip>{p(CATS[e.cat])}</Chip>
            <span className="li-main"><strong>{e.reason}</strong><span>{fmtDate(e.date, lang)}</span></span>
            <span className="li-amt">{tsh(e.amount)}</span>
          </li>
        ))}
      </ul>
      <ExpenseForm act={act} />
    </div>
  );
}

function SalariesTab({ db, d, act }) {
  const { t, p } = useI();
  const locked = db.salary.status !== 'draft';
  const pendingSum = sum(d.pending, (s) => s.amount);
  const kinds = ['permission', 'holiday', 'dayoff'];
  return (
    <div className="stack">
      <div className="ledger">
        <Leader strong label={t('Mishahara ya Septemba', 'September salaries')} value={tsh(d.salaryTotal)} sub={locked ? t('Imeidhinishwa na kufungwa', 'Approved and locked') : t('Rasimu, bado unaweza kubadilisha', 'Draft, you can still change it')} />
      </div>

      {pendingSum > 0 ? <p className="notice warn"><Icon name="alert" size={20} /><span>{t(`Upungufu wa ${tsh(pendingSum)} unasubiri idhini yako na haujajumuishwa.`, `A shortage of ${tsh(pendingSum)} is waiting for your approval and is not included.`)}</span></p> : null}

      <table className="tbl">
        <thead><tr><th>{t('Mfanyakazi', 'Worker')}</th><th className="r">{t('Msingi', 'Base pay')}</th><th className="r">{t('Advansi', 'Advances')}</th><th className="r">{t('Upungufu', 'Shortages')}</th><th className="r">{t('Halisi', 'Net pay')}</th><th className="r">{t('Malipo', 'Paid')}</th></tr></thead>
        <tbody>
          {d.salary.map((r) => (
            <tr key={r.w.id}>
              <td className="who">{r.w.name}<br /><small className="muted">{r.w.pay === 'daily' ? t('Kwa siku', 'Daily') : t('Mwezi', 'Monthly')}</small>{!isActive(r.w) ? <> <Chip>{t('Ameondolewa', 'Removed')}</Chip></> : null}</td>
              <td className="r" data-label={t('Msingi', 'Base pay')}>{num(r.base)}</td>
              <td className="r" data-label={t('Advansi', 'Advances')}>{r.adv ? `− ${num(r.adv)}` : '—'}</td>
              <td className="r" data-label={t('Upungufu', 'Shortages')}>{r.short ? `− ${num(r.short)}` : '—'}</td>
              <td className="r" data-label={t('Halisi', 'Net pay')}><strong>{num(r.net)}</strong></td>
              <td className="r" data-label={t('Malipo', 'Paid')}>
                {locked ? (db.salary.paid[r.w.id] ? <Chip tone="good">{t('Amelipwa', 'Paid')}</Chip> : <button type="button" className="btn btn-quiet btn-small" onClick={() => act.markPaid(r.w.id)}>{t('Weka amelipwa', 'Mark paid')}</button>) : <Chip>{t('Bado', 'Not yet')}</Chip>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="who">{t('Jumla', 'Total')}</td><td className="r" data-label={t('Msingi', 'Base pay')}>{num(sum(d.salary, (r) => r.base))}</td><td className="r" data-label={t('Advansi', 'Advances')}>{num(sum(d.salary, (r) => r.adv))}</td><td className="r" data-label={t('Upungufu', 'Shortages')}>{num(sum(d.salary, (r) => r.short))}</td><td className="r" data-label={t('Halisi', 'Net pay')}>{num(d.salaryTotal)}</td><td /></tr></tfoot>
      </table>

      {!locked ? <button type="button" className="btn btn-primary" onClick={act.approveSalary}>{t('Idhinisha orodha ya mishahara', 'Approve the salary list')}</button> : <p className="notice good"><Icon name="check" size={20} /><span>{t('Orodha imefungwa. Sasa unaweza kuwalipa wafanyakazi na kuweka alama.', 'The list is locked. You can now pay the workers and mark them.')}</span></p>}

      <section className="panel">
        <h2>{t('Siku hizi zinahesabiwaje?', 'How do these days count?')}</h2>
        <p className="muted">{t('Unaweka mara moja. Mshahara wa mwezi: siku iliyochaguliwa inakatwa (mshahara ÷ 30 kwa siku). Malipo ya siku: siku iliyochaguliwa inalipwa.', 'Set once. Monthly salary: a chosen day is deducted (salary ÷ 30 per day). Daily pay: a chosen day is paid.')}</p>
        <div className="rules">
          {kinds.map((k) => (
            <div className="rule" key={k}>
              <strong>{p(STATUS[k])}</strong>
              <div className="field">
                <span className="field-label">{t('Mshahara wa mwezi: akatwe?', 'Monthly salary: deduct it?')}</span>
                <Seg label={`${p(STATUS[k])}, ${t('mshahara wa mwezi', 'monthly salary')}`} disabled={locked} value={db.rules[k].cut ? 'y' : 'n'} onChange={(v) => act.setRule(k, 'cut', v === 'y')} options={[['y', t('Ndiyo', 'Yes')], ['n', t('Hapana', 'No')]]} />
              </div>
              <div className="field">
                <span className="field-label">{t('Malipo ya siku: alipwe?', 'Daily pay: pay it?')}</span>
                <Seg label={`${p(STATUS[k])}, ${t('malipo ya siku', 'daily pay')}`} disabled={locked} value={db.rules[k].pay ? 'y' : 'n'} onChange={(v) => act.setRule(k, 'pay', v === 'y')} options={[['y', t('Ndiyo', 'Yes')], ['n', t('Hapana', 'No')]]} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportsTab({ db, d, act }) {
  const { t, p, lang } = useI();
  const L = lang === 'sw' ? 0 : 1;
  const days = daysOf(8, db, d);
  const bars = days.map((r) => ({
    value: r.total, hot: r.live, label: r.d === 1 || r.d % 5 === 0 || r.live ? String(r.d) : '', tip: `${r.d} ${SHORT[L][8]}: TSh ${num(r.total)}`,
  }));
  const profit = d.monthSales - d.monthExp - d.salaryTotal;
  return (
    <div className="stack">
      <div className="ledger">
        <Leader label={t('Mauzo ya Septemba', 'September sales')} value={tsh(d.monthSales)} />
        <Leader label={t('Matumizi', 'Expenses')} value={`− ${tsh(d.monthExp)}`} />
        <Leader label={t('Mishahara', 'Salaries')} value={`− ${tsh(d.salaryTotal)}`} />
        <Leader strong tone={profit >= 0 ? 'good' : 'bad'} label={t('Faida ya mwezi', "Month's profit")} value={tsh(profit)} />
      </div>

      <section className="panel">
        <h2>{t('Mauzo kwa siku', 'Sales by day')}</h2>
        <BarChart bars={bars} label={t('Chati ya mauzo ya kila siku ya Septemba. Leo imeangaziwa kwa dhahabu.', "Chart of each day's sales in September. Today is highlighted in gold.")} />
      </section>

      <section className="panel">
        <h2>{t('Matumizi kwa aina', 'Expenses by category')}</h2>
        <CategoryBars db={db} />
      </section>

      <DownloadButtons files={monthFiles(days, 8, lang)} act={act} label={t('Mauzo ya Septemba kwa kila siku.', "September's sales, day by day.")} />
    </div>
  );
}

function FedhaView({ db, d, act, tab, setTab }) {
  const { t } = useI();
  const Tab = { mauzo: SalesTab, matumizi: ExpensesTab, mishahara: SalariesTab, ripoti: ReportsTab }[tab];
  return (
    <div>
      <header className="page-head"><h1>{t('Fedha', 'Money')}</h1></header>
      <Tabs label={t('Sehemu ya fedha', 'Money section')} value={tab} onChange={setTab}
        items={[['mauzo', t('Mauzo', 'Sales')], ['matumizi', t('Matumizi', 'Expenses')], ['mishahara', t('Mishahara', 'Salaries')], ['ripoti', t('Ripoti', 'Reports')]]} />
      <div className="view" key={tab}><Tab db={db} d={d} act={act} /></div>
    </div>
  );
}

/* =====================================================================
   APP SHELL
   ===================================================================== */
const NAV = [
  ['leo', ['Leo', 'Today'], 'home'],
  ['funga', ['Funga siku', 'Close day'], 'book'],
  ['wafanyakazi', ['Wafanyakazi', 'Workers'], 'users'],
  ['fedha', ['Fedha', 'Money'], 'wallet'],
];

export default function App() {
  const [lang, setLang] = useState('sw');
  const [theme, setTheme] = useState(null);
  const [view, setView] = useState('leo');
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('mauzo');
  const [db, setDb] = useState(seed);
  const [toast, setToast] = useState(null);
  const d = useMemo(() => derive(db), [db]);

  useEffect(() => {
    const r = document.documentElement;
    if (theme) r.dataset.theme = theme; else delete r.dataset.theme;
  }, [theme]);
  useEffect(() => { document.documentElement.lang = lang === 'sw' ? 'sw' : 'en'; }, [lang]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view, step, tab]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const up = (fn) => setDb((cur) => ({ ...cur, ...fn(cur) }));
  const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  const act = {
    toast: setToast,
    save: async (file) => {
      const r = await saveFile(file.filename, file.data);
      if (r === 'saved') setToast(lang === 'sw' ? `Faili limehifadhiwa: ${file.filename}` : `File saved: ${file.filename}`);
      else if (r === 'failed') setToast(lang === 'sw' ? 'Faili halikuweza kuhifadhiwa. Jaribu tena.' : 'The file could not be saved. Try again.');
    },
    reset: () => { setDb(seed()); setStep(0); setToast(lang === 'sw' ? 'Data ya mfano imerudishwa.' : 'Sample data restored.'); },
    visit: (i) => up((c) => ({ visited: c.visited.includes(i) ? c.visited : [...c.visited, i] })),
    setSale: (s, f, v) => up((c) => ({ sales: { ...c.sales, [s]: { ...c.sales[s], [f]: v } } })),
    setCashier: (s, v) => up((c) => ({ sales: { ...c.sales, [s]: { ...c.sales[s], cashier: v } } })),
    addDelivery: (x) => up((c) => ({ deliveries: [...c.deliveries, { id: uid('d'), ...x }] })),
    removeDelivery: (id) => up((c) => ({ deliveries: c.deliveries.filter((x) => x.id !== id) })),
    handInOne: (id) => up((c) => ({ deliveries: c.deliveries.map((x) => (x.id === id ? { ...x, handedIn: true } : x)) })),
    handIn: (workerId) => up((c) => ({ deliveries: c.deliveries.map((x) => (x.workerId === workerId && x.method === 'cash' ? { ...x, handedIn: true } : x)) })),
    addExpense: (e) => up((c) => ({ expenses: [...c.expenses, { id: uid('e'), date: TODAY, ...e }] })),
    removeExpense: (id) => up((c) => ({ expenses: c.expenses.filter((x) => x.id !== id) })),
    setCounted: (s, v) => up((c) => ({ counted: { ...c.counted, [s]: v } })),
    setAttendance: (id, v) => up((c) => ({ attendance: { ...c.attendance, [id]: v } })),
    closeDay: () => {
      up((c) => {
        const calc = cashCalc(c);
        const fresh = SEC.filter((s) => calc[s].diff != null && calc[s].diff < 0).map((s) => ({ id: uid('s'), workerId: c.sales[s].cashier, date: TODAY, amount: -calc[s].diff, status: 'pending', section: s }));
        return { closed: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), shortages: [...c.shortages, ...fresh], visited: [0, 1, 2, 3, 4, 5] };
      });
      setView('leo');
    },
    addWorker: (w) => up((c) => ({ workers: [...c.workers, { id: uid('w'), ...w }] })),
    removeWorker: (id, why) => {
      up((c) => {
        const spare = c.workers.find((x) => isActive(x) && x.id !== id && x.role === 'keshia');
        const sales = { ...c.sales };
        SEC.forEach((s) => { if (sales[s].cashier === id && spare) sales[s] = { ...sales[s], cashier: spare.id }; });
        const attendance = { ...c.attendance };
        delete attendance[id];
        return { sales, attendance, workers: c.workers.map((x) => (x.id === id ? { ...x, active: false, removedOn: TODAY, removedWhy: why } : x)) };
      });
      setToast(lang === 'sw' ? 'Mfanyakazi ameondolewa. Historia yake imehifadhiwa.' : 'Worker removed. The history is kept.');
    },
    restoreWorker: (id) => {
      up((c) => ({ workers: c.workers.map((x) => (x.id === id ? { ...x, active: true, removedOn: undefined, removedWhy: undefined } : x)) }));
      setToast(lang === 'sw' ? 'Mfanyakazi amerudishwa.' : 'Worker restored.');
    },
    patchWorker: (id, patch) => up((c) => ({ workers: c.workers.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    addLeave: (l) => up((c) => ({ leaves: [...c.leaves, { id: uid('l'), ...l }] })),
    removeLeave: (id) => up((c) => ({ leaves: c.leaves.filter((l) => l.id !== id) })),
    addAdvance: (a) => up((c) => ({ advances: [...c.advances, { id: uid('a'), ...a }] })),
    resolve: (id, status) => up((c) => ({ shortages: c.shortages.map((s) => (s.id === id ? { ...s, status } : s)) })),
    setRule: (k, f, v) => up((c) => ({ rules: { ...c.rules, [k]: { ...c.rules[k], [f]: v } } })),
    approveSalary: () => up((c) => ({ salary: { ...c.salary, status: 'approved' } })),
    markPaid: (id) => up((c) => ({ salary: { ...c.salary, paid: { ...c.salary.paid, [id]: true } } })),
  };

  const go = (v, st) => { setView(v); if (st != null) setStep(st); };
  const t = (sw, en) => (lang === 'sw' ? sw : en);
  const L = lang === 'sw' ? 0 : 1;

  const controls = (
    <div className="tools">
      <div className="langsw" role="group" aria-label={t('Lugha', 'Language')}>
        <button type="button" aria-pressed={lang === 'sw'} onClick={() => setLang('sw')}>SW</button>
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      </div>
      <button type="button" className="tool" onClick={() => setTheme((cur) => (cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'))} aria-label={t('Badilisha mandhari', 'Change theme')}>
        <Icon name="moon" size={20} />
      </button>
    </div>
  );

  const nav = (
    <>
      {NAV.map(([key, label, icon]) => (
        <button key={key} type="button" aria-current={view === key ? 'page' : undefined} onClick={() => go(key)}>
          <Icon name={icon} />
          <span>{label[L]}</span>
          {key === 'funga' && !db.closed ? <span className="dot" title={t('Bado haijafungwa', 'Not closed yet')} /> : null}
        </button>
      ))}
    </>
  );

  return (
    <LangCtx.Provider value={{ lang }}>
      <div className="app">
        <header className="topbar">
          <div className="brand"><Logo size={34} /><span>Daftari</span></div>
          {controls}
        </header>
        <aside className="side">
          <div className="side-top">
            <div className="brand"><Logo size={42} /><span>Daftari</span></div>
            <div className="kanga" aria-hidden="true" />
            <div className="datecard">
              <span className="dc-day">30</span>
              <span className="dc-rest"><strong>{DAYS[L][TODAY_DOW]}</strong><small>{MONTHS[L][8]} 2026</small></span>
            </div>
          </div>
          <nav aria-label={t('Menyu kuu', 'Main menu')}>{nav}</nav>
          <div className="side-bottom">
            <div className="me"><span className="av t2" aria-hidden="true">M</span><span><strong>{t('Meneja', 'Manager')}</strong><small>{t('Ruhusa zote', 'Full access')}</small></span></div>
            {controls}
          </div>
        </aside>
        <main className="main">
          <div className="view" key={view === 'funga' ? `funga${step}` : view}>
            {view === 'leo' ? <LeoView db={db} d={d} act={act} go={go} /> : null}
            {view === 'funga' ? <FungaView db={db} d={d} act={act} step={step} setStep={setStep} /> : null}
            {view === 'wafanyakazi' ? <WorkersView db={db} d={d} act={act} /> : null}
            {view === 'fedha' ? <FedhaView db={db} d={d} act={act} tab={tab} setTab={setTab} /> : null}
          </div>
        </main>
        <nav className="tabbar" aria-label={t('Menyu kuu', 'Main menu')}>{nav}</nav>
        {toast ? <div className="toast" role="status">{toast}</div> : null}
      </div>
    </LangCtx.Provider>
  );
}
