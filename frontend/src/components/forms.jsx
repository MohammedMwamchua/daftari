import { useState } from 'react';
import { FilePdf, FileXls, Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { api } from '../api.js';
import { useActions, useErr, useMeta } from '../hooks.js';
import { useI } from '../i18n.jsx';
import { PAID_FROM, SEC, SECTIONS } from '../vocab.js';
import { Btn, MoneyInput, Seg, SelectField, TextField } from './ui.jsx';

/* One form for every place an expense is added (close-day step and the Money tab). */
export function ExpenseForm({ date, onAdded }) {
  const { t, p, lang } = useI();
  const meta = useMeta().data;
  const act = useActions();
  const fail = useErr();
  const cats = meta.categories.filter((c) => c.active);
  const [cat, setCat] = useState(cats[0]?.key || '');
  const [amount, setAmount] = useState(null);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('simu');
  const [section, setSection] = useState('banda');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount || !reason.trim()) { toast.warning(t('Jaza kiasi na sababu.', 'Fill in the amount and the reason.')); return; }
    setBusy(true);
    try {
      await act.addExpense({ date, category: cat, amount, reason: reason.trim(), paid_from: from, section: from === 'droo' ? section : '' });
      setAmount(null); setReason('');
      toast.success(t('Matumizi yameandikwa.', 'Expense saved.'));
      onAdded?.();
    } catch (ex) { fail(ex); } finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid-2">
        <SelectField label={t('Kundi', 'Category')} value={cat} onChange={setCat}>
          {cats.map((c) => <option key={c.key} value={c.key}>{lang === 'sw' ? c.name_sw : c.name_en}</option>)}
        </SelectField>
        <MoneyInput label={t('Kiasi', 'Amount')} value={amount} onChange={setAmount} />
      </div>
      <TextField label={t('Sababu', 'Reason')} value={reason} onChange={setReason} placeholder={t('mf. Viazi na mafuta', 'e.g. Potatoes and oil')} maxLength={200} />
      <div className="row">
        <div className="field"><span className="field-label">{t('Imelipwa kutoka', 'Paid from')}</span>
          <Seg label={t('Imelipwa kutoka', 'Paid from')} value={from} onChange={setFrom} options={Object.entries(PAID_FROM).map(([k, v]) => [k, p(v)])} /></div>
        {from === 'droo' ? (
          <div className="field"><span className="field-label">{t('Droo ya', 'Which till')}</span>
            <Seg label={t('Droo ya', 'Which till')} value={section} onChange={setSection} options={SEC.map((s) => [s, p(SECTIONS[s])])} /></div>
        ) : null}
      </div>
      <div><Btn type="submit" className="btn-primary" loading={busy}><Plus size={18} weight="bold" />{t('Weka matumizi', 'Add expense')}</Btn></div>
    </form>
  );
}

/* Server-built PDF and Excel files. kind: 'month' | 'day' */
export function DownloadButtons({ kind, id }) {
  const { t, lang } = useI();
  const [busy, setBusy] = useState('');
  const get = async (file) => {
    setBusy(file);
    try {
      const name = await api.download(`/reports/${kind}/${id}/?file=${file}&lang=${lang}`, `mauzo-${id}.${file}`);
      toast.success(t(`Imepakuliwa: ${name}`, `Downloaded: ${name}`));
    } catch { toast.error(t('Imeshindwa kupakua.', 'Download failed.')); } finally { setBusy(''); }
  };
  return (
    <div className="row" style={{ gap: 8 }}>
      <Btn className="btn-small" loading={busy === 'pdf'} onClick={() => get('pdf')}><FilePdf size={18} weight="duotone" />{t('Pakua PDF', 'Download PDF')}</Btn>
      <Btn className="btn-small" loading={busy === 'xlsx'} onClick={() => get('xlsx')}><FileXls size={18} weight="duotone" />{t('Pakua Excel', 'Download Excel')}</Btn>
    </div>
  );
}

