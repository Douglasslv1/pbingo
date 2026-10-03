import { useCallback, useEffect, useRef, useState } from 'react';
import { playTones } from '../sounds';

const STORAGE_KEY = 'pbingu_sound';

function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Dois bipes curtos: chegou a sua vez. */
const playChime = () => playTones([[660, 0], [880, 0.18]]);

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
