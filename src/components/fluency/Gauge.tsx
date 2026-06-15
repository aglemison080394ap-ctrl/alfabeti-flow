import React from 'react';

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  suffix?: string;
  color?: string;
}

const Gauge: React.FC<GaugeProps> = ({ value, max, label, suffix = '', color = '#2563eb' }) => {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = -90 + pct * 180;
  const r = 80;
  const cx = 100;
  const cy = 100;
  const start = polar(cx, cy, r, -90);
  const end = polar(cx, cy, r, 90);
  const needle = polar(cx, cy, r - 12, angle);
  const gradId = React.useMemo(() => `g-${Math.random().toString(36).slice(2, 10)}`, []);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          stroke={`url(#g-${label})`}
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill={color} />
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-foreground" fontSize="22" fontWeight="700">
          {value.toFixed(value < 10 && suffix !== '%' ? 2 : 1)}{suffix}
        </text>
      </svg>
      <p className="text-xs font-medium text-muted-foreground mt-1 text-center">{label}</p>
    </div>
  );
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default Gauge;
