import { motion } from 'framer-motion';
import { useMemo } from 'react';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

interface FloatingBall {
  id: number;
  label: string;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
}

function buildBall(seed: number): FloatingBall {
  const letter = LETTERS[seed % LETTERS.length];
  const number = 1 + Math.floor(Math.random() * 75);
  return {
    id: seed,
    label: `${letter}${number}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 34 + Math.random() * 26,
    duration: 6 + Math.random() * 6,
    delay: Math.random() * 4,
  };
}

interface Props {
  count?: number;
}

export default function FloatingBalls({ count = 9 }: Props) {
  const balls = useMemo(() => Array.from({ length: count }, (_, i) => buildBall(i)), [count]);

  return (
    <div className="floating-balls" aria-hidden="true">
      {balls.map((ball) => (
        <motion.div
          key={ball.id}
          className="floating-ball"
          style={{ left: `${ball.left}%`, top: `${ball.top}%`, width: ball.size, height: ball.size }}
          animate={{ y: [0, -18, 0], rotate: [0, 6, -6, 0] }}
          transition={{ duration: ball.duration, repeat: Infinity, ease: 'easeInOut', delay: ball.delay }}
        >
          <span>{ball.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
