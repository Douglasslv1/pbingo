interface Props {
  /** Altura do icone em px. */
  size?: number;
  /** Mostra o nome ao lado do icone. */
  withName?: boolean;
}

/** Icone do Pbingu: uma bolinha da sorte na frente de uma pedra de domino - os dois jogos da casa. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <radialGradient id="logo-ball" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fef9c3" />
          <stop offset="1" stopColor="#facc15" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-bg)" />
      {/* Pedra de domino inclinada ao fundo */}
      <g transform="rotate(-14 38 30)">
        <rect x="29" y="8" width="20" height="38" rx="5" fill="#f8fafc" />
        <line x1="32" y1="27" x2="46" y2="27" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="34.5" cy="14" r="2.4" fill="#0f172a" />
        <circle cx="43.5" cy="21" r="2.4" fill="#0f172a" />
        <circle cx="39" cy="36.5" r="2.4" fill="#0f172a" />
      </g>
      {/* Bolinha da sorte na frente */}
      <circle cx="24" cy="40" r="15" fill="url(#logo-ball)" stroke="#ca8a04" strokeWidth="2" />
      <text x="24" y="46" textAnchor="middle" fontSize="17" fontWeight="800" fill="#422006" fontFamily="system-ui, sans-serif">
        7
      </text>
    </svg>
  );
}

export default function Logo({ size = 32, withName = true }: Props) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {withName && (
        <span className="logo-name" style={{ fontSize: size * 0.66 }}>
          P<span>bingu</span>
        </span>
      )}
    </span>
  );
}
