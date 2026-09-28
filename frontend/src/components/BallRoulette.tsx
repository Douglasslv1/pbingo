import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export interface DrawEvent {
  number: number;
  seq: number;
  animate: boolean;
}

interface Props {
  lastDrawn: DrawEvent | null;
  ballMin?: number;
  ballMax?: number;
}

const SPIN_DURATION_MS = 1100;
const SPIN_TICK_MS = 70;

function bingoLetterFor(n: number): string {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

export default function BallRoulette({ lastDrawn, ballMin = 1, ballMax = 75 }: Props) {
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [tickKey, setTickKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastDrawn) {
      return;
    }

    if (!lastDrawn.animate) {
      setDisplayNumber(lastDrawn.number);
      setSpinning(false);
      setTickKey((k) => k + 1);
      return;
    }

    setSpinning(true);

    intervalRef.current = setInterval(() => {
      const random = ballMin + Math.floor(Math.random() * (ballMax - ballMin + 1));
      setDisplayNumber(random);
      setTickKey((k) => k + 1);
    }, SPIN_TICK_MS);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayNumber(lastDrawn.number);
      setTickKey((k) => k + 1);
      setSpinning(false);
    }, SPIN_DURATION_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDrawn?.seq, lastDrawn?.animate]);

  const letter = displayNumber !== null ? bingoLetterFor(displayNumber) : null;

  return (
    <div className="roulette">
      <div className={spinning ? 'roulette-window spinning' : 'roulette-window settled'}>
        <AnimatePresence mode="popLayout">
          {displayNumber !== null && (
            <motion.div
              key={tickKey}
              className="roulette-ball"
              initial={{
                y: spinning ? -50 : -70,
                opacity: 0,
                scale: spinning ? 0.85 : 0.4,
                rotate: spinning ? -10 : -25,
              }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              exit={{ y: 50, opacity: 0, scale: 0.85 }}
              transition={
                spinning ? { duration: 0.07, ease: 'linear' } : { type: 'spring', stiffness: 320, damping: 14 }
              }
            >
              <span className="roulette-letter">{letter}</span>
              <span className="roulette-number">{displayNumber}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="roulette-caption">
        {spinning ? 'Sorteando...' : displayNumber !== null ? 'Numero sorteado' : 'Aguardando sorteio'}
      </p>
    </div>
  );
}
