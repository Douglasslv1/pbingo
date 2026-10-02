import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  /** true: o jogador venceu; false: perdeu; null: empate. */
  won: boolean | null;
  /** O grito do jogo ("Xeque-mate!", "Bateu!"). */
  headline: string;
  detail: string;
}

const COLORS = ['#22c55e', '#facc15', '#38bdf8', '#f472b6', '#f8fafc'];

/** Fim de partida em destaque: o grito do jogo, com confete para quem venceu. Some sozinho ou com um toque. */
export default function VictoryOverlay({ won, headline, detail }: Props) {
  const [open, setOpen] = useState(true);
  const confetti = useMemo(
    () =>
      won
        ? Array.from({ length: 60 }, (_, index) => ({
            left: Math.random() * 100,
            delay: Math.random() * 0.8,
            duration: 2.2 + Math.random() * 1.8,
            rotate: Math.random() * 720 - 360,
            color: COLORS[index % COLORS.length],
          }))
        : [],
    [won],
  );

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`victory-overlay ${won ? 'won' : won === false ? 'lost' : 'draw'}`}
          role="status"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {confetti.map((piece, index) => (
            <motion.span
              key={index}
              className="confetti"
              style={{ left: `${piece.left}%`, background: piece.color }}
              initial={{ y: '-10vh', rotate: 0 }}
              animate={{ y: '110vh', rotate: piece.rotate }}
              transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
            />
          ))}
          <motion.div
            className="victory-card"
            initial={{ scale: 0.3, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <h2>{headline}</h2>
            <p>{detail}</p>
            <span className="label">Toque para fechar</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
