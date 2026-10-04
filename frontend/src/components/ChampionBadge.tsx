/** Selo publico de campeao de torneio ao lado do apelido (com a quantidade a partir de 2 titulos). */
export default function ChampionBadge({ titles }: { titles?: number }) {
  if (!titles) return null;
  const label = titles === 1 ? 'Campeão de torneio' : `${titles} títulos de torneio`;
  return (
    <span className="champion-mark" title={label} aria-label={label}>
      🏆{titles > 1 && titles}
    </span>
  );
}
