import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'motion/react';
import { kfmt, num, sum } from '../format.js';

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <div className="tip"><small>{d.tip || d.label}</small><b>TSh {num(d.value)}</b></div>;
};

const Grad = ({ id, from, to }) => (
  <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
);

/* bars: [{ label, value, hot, tip }] */
export function BarsChart({ bars, label, height = 230, dense }) {
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 10, right: 4, left: -14, bottom: 0 }} barCategoryGap={dense ? '18%' : '28%'}>
          <Grad id="gBar" from="var(--emerald-500)" to="var(--emerald-700)" />
          <Grad id="gHot" from="var(--brass-400)" to="var(--brass-600)" />
          <CartesianGrid vertical={false} strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={dense ? 'preserveStartEnd' : 0} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={kfmt} width={50} />
          <Tooltip content={<Tip />} cursor={{ fill: 'color-mix(in srgb, var(--emerald-500) 10%, transparent)', radius: 8 }} />
          <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={48} animationDuration={900} animationEasing="ease-out">
            {bars.map((b, i) => <Cell key={i} fill={b.hot ? 'url(#gHot)' : 'url(#gBar)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* A tiny white area sparkline for the dark ticket. */
export function Spark({ data }) {
  return (
    <div className="ticket-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs><linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
          <Area type="monotone" dataKey="value" stroke="#e3b655" strokeWidth={2.5} fill="url(#gSpark)" animationDuration={1200} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ parts, children, size = 168 }) {
  const total = sum(parts, (x) => x.v);
  const data = total ? parts : [{ v: 1, color: 'var(--surface-3)', name: '' }];
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="v" innerRadius="68%" outerRadius="100%" paddingAngle={total ? 4 : 0} cornerRadius={8} stroke="none" startAngle={90} endAngle={-270} animationDuration={1000}>
            {data.map((x, i) => <Cell key={i} fill={x.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">{children}</div>
    </div>
  );
}

export function Ring({ done, now, total = 6, size = 112 }) {
  const r = 46; const C = 2 * Math.PI * r; const gap = 14; const seg = C / total - gap;
  return (
    <svg className="ring" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${done} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <circle
          key={i} cx="60" cy="60" r={r} fill="none" strokeWidth="9" strokeLinecap="round" style={{ '--i': i }}
          className={`seg-c${i < done ? ' on' : i === now ? ' now' : ''}`} strokeDasharray={`${seg} ${C - seg}`}
          transform={`rotate(${-90 + (360 / total) * i + (gap / 2 / C) * 360} 60 60)`}
        />
      ))}
      <text x="60" y="69" textAnchor="middle" fontSize="30">{done}<tspan className="sub" fontSize="15">/{total}</tspan></text>
    </svg>
  );
}

export function CatBars({ rows }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="catbars">
      {rows.map((r, i) => (
        <div className="catbar" key={r.key}>
          <div className="head"><span>{r.name}</span><strong>TSh {num(r.amount)}</strong></div>
          <div className="track">
            <motion.div className="fillbar" initial={{ width: 0 }} whileInView={{ width: `${(r.amount / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
