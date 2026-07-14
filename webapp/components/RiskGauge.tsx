'use client';

interface RiskGaugeProps {
  score: number;
  size?: 'sm' | 'lg';
}

export default function RiskGauge({ score, size = 'lg' }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));

  const color =
    clamped <= 30 ? '#16a34a' : clamped <= 60 ? '#d97706' : '#dc2626';

  const label =
    clamped <= 30 ? 'Looks Safe' : clamped <= 60 ? 'Use Caution' : 'Likely Scam';

  const labelBg =
    clamped <= 30 ? '#dcfce7' : clamped <= 60 ? '#fef3c7' : '#fee2e2';

  // Semicircle from 180° to 0° (left to right across top)
  const r = size === 'lg' ? 72 : 52;
  const cx = size === 'lg' ? 92 : 66;
  const cy = size === 'lg' ? 88 : 64;
  const sw = size === 'lg' ? 13 : 10;
  const w  = size === 'lg' ? 184 : 132;
  const h  = size === 'lg' ? 100 : 74;

  const arcLength = Math.PI * r; // semicircle circumference
  const arcTarget = arcLength - (clamped / 100) * arcLength;

  function pt(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const trackStart = pt(180);
  const trackEnd   = pt(0);
  const fillEnd    = pt(180 - (clamped / 100) * 180);
  const largeArc   = clamped > 50 ? 1 : 0;

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`;
  const fillPath  = clamped === 0
    ? null
    : `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  const fontSize = size === 'lg' ? 30 : 22;
  const subSize  = size === 'lg' ? 11 : 9;

  return (
    <div className="flex flex-col items-center select-none">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round" />

        {/* Animated fill */}
        {fillPath && (
          <path
            className="gauge-arc"
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            style={{
              '--arc-length': `${arcLength}`,
              '--arc-target': `${arcTarget}`,
            } as React.CSSProperties}
          />
        )}

        {/* Score */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={fontSize} fontWeight="800" fill={color}>
          {clamped}
        </text>
        <text x={cx} y={cy + subSize + 2} textAnchor="middle" fontSize={subSize} fill="#9ca3af" fontWeight="500">
          / 100
        </text>
      </svg>

      <span
        className="mt-1.5 text-xs font-bold px-3 py-1 rounded-full tracking-wide uppercase"
        style={{ backgroundColor: labelBg, color }}
      >
        {label}
      </span>
    </div>
  );
}
