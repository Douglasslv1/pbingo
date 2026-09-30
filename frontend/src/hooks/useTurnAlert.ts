import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pbingu_sound';

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Dois bipes curtos gerados no navegador (sem arquivo de audio). */
function playChime(): void {
  try {
    const context = new AudioContext();
    [0, 0.18].forEach((delay, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = index === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.15);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.16);
    });
    setTimeout(() => context.close(), 600);
  } catch {
    // Navegador sem audio (ou bloqueado ate a primeira interacao): segue sem som
  }
}

/**
 * Avisa com som e vibracao quando a vez passa a ser do jogador.
 * A preferencia de som fica salva neste navegador.
 */
export function useTurnAlert(myTurn: boolean) {
  const [soundOn, setSoundOn] = useState(readSoundPreference);
  const wasMyTurn = useRef(myTurn);

  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      if (soundOn) playChime();
      navigator.vibrate?.(200);
    }
    wasMyTurn.current = myTurn;
  }, [myTurn, soundOn]);

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // Armazenamento bloqueado: vale so ate recarregar a pagina
      }
      return next;
    });
  }, []);

  return { soundOn, toggleSound };
}
