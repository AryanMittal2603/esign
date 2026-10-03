/** Guilloche rosette — the security-print motif from our signed PDFs, drawn as slowly turning line art. */
const LAYERS = [
  { petals: 18, base: 150, amp: 34, turns: 20, color: "#A8BBC2", op: 0.42, spin: "rosette-a" },
  { petals: 12, base: 112, amp: 26, turns: 16, color: "#B76A3B", op: 0.22, spin: "rosette-b" },
  { petals: 24, base: 196, amp: 22, turns: 24, color: "#8FBFD0", op: 0.35, spin: "rosette-a" },
];

const PATHS = LAYERS.map((l) =>
  Array.from({ length: l.turns }, (_, k) => {
    const phase = ((k / l.turns) * Math.PI * 2) / l.petals;
    let d = "";
    for (let i = 0; i <= 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const r = l.base + l.amp * Math.sin(l.petals * (a + phase));
      d += `${i ? "L" : "M"}${(260 + r * Math.cos(a)).toFixed(1)} ${(260 + r * Math.sin(a)).toFixed(1)}`;
    }
    return d + "Z";
  }),
);

export function Rosette({ size = 520, style, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <div aria-hidden="true" className={className} style={{ width: size, height: size, pointerEvents: "none", ...style }}>
      {LAYERS.map((l, li) => (
        // each layer is its own element so it spins about its own centre
        <svg key={li} viewBox="0 0 520 520" className={l.spin} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {PATHS[li].map((d, k) => <path key={k} d={d} fill="none" stroke={l.color} strokeOpacity={l.op} strokeWidth="0.7" />)}
        </svg>
      ))}
    </div>
  );
}
