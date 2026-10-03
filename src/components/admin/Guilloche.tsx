/** Decorative security-print line pattern (same motif as the facial impression on signed PDFs). */
export function Guilloche({ color = "#FFFFFF", opacity = 0.09, lines = 14, width = 800, height = 220, style }: {
  color?: string; opacity?: number; lines?: number; width?: number; height?: number; style?: React.CSSProperties;
}) {
  const paths: string[] = [];
  for (let k = 0; k < lines; k++) {
    const phase = (k / lines) * Math.PI * 2;
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const y = height / 2 + height * 0.36 * Math.sin(t * Math.PI * 3 + phase) * Math.cos(t * Math.PI * 1.2 + phase / 2);
      d += `${i ? "L" : "M"}${(t * width).toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...style }}>
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
