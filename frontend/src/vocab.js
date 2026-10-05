/* Every label is a [Swahili, English] pair. */
export const DAYS = [
  ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
];
export const DAYS_SHORT = [
  ['Jpl', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Ijm', 'Jms'],
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
];
export const MONTHS = [
  ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
];
export const MONTHS_SHORT = [
  ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
];
export const SEC = ['banda', 'mgahawa'];
export const SECTIONS = { banda: ['Banda', 'Stall'], mgahawa: ['Mgahawa', 'Restaurant'] };
export const ROLES = {
  keshia: ['Keshia', 'Cashier'], mpishi: ['Mpishi', 'Cook'], mhudumu: ['Mhudumu', 'Waiter'],
  mwingine: ['Mfanyakazi mwingine', 'Other worker'],
};
export const STATUS = {
  present: ['Amehudhuria', 'Present', 'good'], late: ['Amechelewa', 'Late', 'warn'], absent: ['Hakuja', 'Absent', 'bad'],
  dayoff: ['Siku ya mapumziko', 'Day off', 'info'], permission: ['Ruhusa', 'Permission', 'info'], holiday: ['Likizo', 'Holiday', 'info'],
};
export const PAID_FROM = { droo: ['Droo', 'Till'], simu: ['Pesa za simu', 'Mobile money'], other: ['Nyingine', 'Other'] };
export const STEPS = [
  ['Mauzo', 'Sales'], ['Matumizi', 'Expenses'], ['Malipo', 'Daily pay'],
  ['Hesabu ya pesa', 'Cash count'], ['Mahudhurio', 'Attendance'], ['Funga siku', 'Close the day'],
];
export const REMOVE_REASONS = { left: ['Ameacha kazi', 'Left the job'], ended: ['Mkataba umeisha', 'Contract ended'], other: ['Nyingine', 'Other'] };
