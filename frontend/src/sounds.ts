/** Sons curtos gerados no navegador (sem arquivo de audio): cada nota e [frequencia, inicio em segundos]. */
export function playTones(notes: Array<[number, number]>, wave: OscillatorType = 'sine', volume = 0.2): void {
  try {
    const context = new AudioContext();
    notes.forEach(([frequency, delay]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.15);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.16);
    });
    setTimeout(() => context.close(), Math.max(...notes.map(([, delay]) => delay)) * 1000 + 600);
  } catch {
    // Navegador sem audio (ou bloqueado ate a primeira interacao): segue sem som
  }
}
