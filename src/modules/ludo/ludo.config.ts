/** Numeros do Ludo num lugar so: ajustar o balanceamento nao mexe no motor. */
export const LUDO_CONFIG = {
  maxEnergy: 10,
  /** Energia ganha por peca capturada. */
  captureEnergy: 1,
  /** Energia ganha ao parar numa casa de energia. */
  energyTileEnergy: 1,
  /** Casas de energia: posicao dentro de cada quarto da volta (0 = saida da cor, 8 = estrela). */
  energyTileOffsets: [4, 11],
};

export type LudoMode = 'CLASSICO' | 'ARENA';

/** O que cada modalidade liga. O Classico e o Ludo tradicional; a Arena soma os recursos estrategicos. */
export const LUDO_MODES: Record<LudoMode, { energyEnabled: boolean }> = {
  CLASSICO: { energyEnabled: false },
  ARENA: { energyEnabled: true },
};
