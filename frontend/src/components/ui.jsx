import { useEffect, useId, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle, Info, TrayArrowDown, Warning, WarningCircle, X } from '@phosphor-icons/react';
import { num, sum } from '../format.js';
import { useI } from '../i18n.jsx';
import { ROLES, STATUS } from '../vocab.js';

export const Logo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="#0b5d49" />
    <rect width="40" height="40" rx="11" fill="url(#lg)" />
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#000" stopOpacity=".1" /></linearGradient>
    </defs>
    <path d="M11.5 8.5h13.2a3 3 0 0 1 3 3V31H14.5a3 3 0 0 1-3-3V8.5Z" fill="#fff" fillOpacity=".96" />
    <path d="M15.5 15h8M15.5 19.5h8M15.5 24h5" stroke="#0b5d49" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M23.2 8.5h4.5v12l-2.25-1.8-2.25 1.8v-12Z" fill="#e2a233" />
  </svg>
);

export const Chip = ({ tone = 'neutral', className = '', children }) => <span className={`chip chip-${tone} ${className}`}>{children}</span>;

/* Counts up from the previous value. Respects reduced motion. */
export function CountUp({ value, duration = 1.1 }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => num(v));
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { mv.set(value); return undefined; }
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, duration, mv]);
  return <motion.span>{text}</motion.span>;
}

export const Money = ({ v, sign }) => (
  <>{sign && v < 0 ? '−' : ''}<span className="cur">TSh</span>{num(Math.abs(v))}</>
);

export const Leader = ({ label, value, tone, strong, sub, idx }) => (
  <div className={`lrow${strong ? ' strong' : ''}${tone ? ` tone-${tone}` : ''}`} style={idx != null ? { '--i': idx } : undefined}>
    <span className="lab">{label}{sub ? <small>{sub}</small> : null}</span>
    <span className="dots" aria-hidden="true" />
    <span className="amt">{value}</span>
  </div>
);

export function Seg({ options, value, onChange, label, disabled, full }) {
  const id = useId();
  return (
    <div className={`seg${full ? ' full' : ''}`} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button type="button" key={v} aria-pressed={value === v} disabled={disabled} onClick={() => onChange(v)}>
          {value === v ? <motion.span layoutId={id} className="thumb" transition={{ type: 'spring', stiffness: 520, damping: 38 }} /> : null}
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs({ items, value, onChange, label }) {
  const id = useId();
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map(([v, text]) => (
        <button key={v} type="button" role="tab" className="tab" aria-selected={value === v} onClick={() => onChange(v)}>
          {text}
          {value === v ? <motion.span layoutId={id} className="bar" transition={{ type: 'spring', stiffness: 500, damping: 40 }} /> : null}
        </button>
      ))}
    </div>
  );
}

export const MoneyInput = ({ label, value, onChange, hint, autoFocus }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <span className="money">
      <span className="cur">TSh</span>
      <input
        inputMode="numeric" autoComplete="off" autoFocus={autoFocus} value={value == null ? '' : num(value)} placeholder="0"
        onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ''); onChange(v === '' ? null : Number(v)); }}
      />
    </span>
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
);

export const TextField = ({ label, value, onChange, hint, error, textarea, ...rest }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {textarea
      ? <textarea value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      : <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />}
    {error ? <span className="field-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
  </label>
);

export const SelectField = ({ label, value, onChange, children, hint }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
);

const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
export const Avatar = ({ name, size }) => (
  <span className={`av t${hash(name) % 6}${size === 'lg' ? ' lg' : ''}`} aria-hidden="true">
    {name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
  </span>
);

export const StatusChip = ({ k }) => {
  const { p, t } = useI();
  if (!k) return <Chip tone="warn">{t('Hajaandikwa', 'Not marked')}</Chip>;
  return <Chip tone={STATUS[k][2]}>{p(STATUS[k])}</Chip>;
};
export const RoleLabel = ({ role }) => { const { p } = useI(); return p(ROLES[role]); };

export const Skeleton = ({ h = 20, w = '100%', r }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
export const PageSkeleton = () => (
  <div className="stack" aria-busy="true"><Skeleton h={44} w="50%" /><Skeleton h={260} r={28} /><div className="grid-2"><Skeleton h={200} /><Skeleton h={200} /></div></div>
);

export const Empty = ({ children, icon: I = TrayArrowDown }) => (
  <div className="empty"><I size={28} weight="duotone" />{children}</div>
);

const CALLOUT_ICON = { info: Info, good: CheckCircle, warn: Warning, bad: WarningCircle };
export const Callout = ({ tone = 'info', children }) => {
  const I = CALLOUT_ICON[tone] || Info;
  return <div className={`callout callout-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}><I size={20} weight="duotone" /><div>{children}</div></div>;
};

export function Btn({ loading, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spin" aria-hidden="true" /> : null}{children}
    </button>
  );
}

export function Modal({ open, onClose, title, description, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal" aria-describedby={description ? undefined : undefined}>
          <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
          {description ? <Dialog.Description className="muted">{description}</Dialog.Description> : null}
          <Dialog.Close asChild><button type="button" className="icon-plain x" aria-label="Close"><X size={18} weight="bold" /></button></Dialog.Close>
          <div style={{ marginTop: 18 }}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* Page-level motion: a soft rise, children stagger in. */
export const Page = ({ children }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </motion.div>
);
export const Rise = ({ children, delay = 0, className, as = 'div', ...rest }) => {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }} {...rest}>
      {children}
    </M>
  );
};

export const Total = ({ rows, field }) => sum(rows, (r) => r[field]);
