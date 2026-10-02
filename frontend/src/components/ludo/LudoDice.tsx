import { motion } from 'framer-motion';

/** Posicao dos pontos de cada face (quadrado 0-1). */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

interface Props {
  value: number | null;
  /** Numero do dado na partida: cada rolagem nova gira o dado. */
  rollId: number;
  /** Esperando a resposta do servidor: o dado treme. */
  rolling: boolean;
  /** Cor de quem rolou. */
  color: number | null;
  onRoll?: () => void;
}

/** Dado da partida. O valor vem sempre do servidor; o giro e so animacao. */
export default function LudoDice({ value, rollId, rolling, color, onRoll }: Props) {
  const face = (
    <motion.svg
      key={rollId}
      viewBox="0 0 100 100"
      className={`ludo-dice${color === null ? '' : ` ludo-color-${color}`}`}
      initial={{ rotate: -200, scale: 0.4 }}
      animate={rolling ? { rotate: [0, -12, 12, 0] } : { rotate: 0, scale: 1 }}
      transition={rolling ? { duration: 0.3, repeat: Infinity } : { type: 'spring', stiffness: 260, damping: 15 }}
      role="img"
      aria-label={value ? `Dado: ${value}` : 'Dado'}
    >
      <rect x={4} y={4} width={92} height={92} rx={18} className="ludo-dice-face" />
      {(value ? PIPS[value] : []).map(([x, y], index) => (
        <circle key={index} cx={x * 100} cy={y * 100} r={9} className="ludo-dice-pip" />
      ))}
    </motion.svg>
  );

  return onRoll ? (
    <button type="button" className="ludo-dice-button" onClick={onRoll} disabled={rolling} aria-label="Jogar o dado">
      {face}
      <span>{rolling ? 'Rolando...' : 'Jogar o dado'}</span>
    </button>
  ) : (
    face
  );
}
