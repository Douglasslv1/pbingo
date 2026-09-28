import { useEffect, useState } from 'react';

export function useCountdown(target: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!target) {
      setRemaining(null);
      return;
    }
    const endsAt = target;

    function tick() {
      const diff = new Date(endsAt).getTime() - Date.now();
      setRemaining(Math.max(Math.ceil(diff / 1000), 0));
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}
