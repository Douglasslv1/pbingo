/** Numeros do Ludo num lugar so: ajustar o balanceamento nao mexe no motor. */
export const LUDO_CONFIG = {
  maxEnergy: 10,
  /** Energia ganha por peca capturada. */
  captureEnergy: 1,
  /** Energia de quem teve a peca capturada (ajuda quem esta atras, sem decidir a partida). */
  capturedEnergy: 1,
  /** Energia ganha ao parar numa casa de energia. */
  energyTileEnergy: 1,
  /** Casas de energia: posicao dentro de cada quarto da volta (0 = saida da cor, 8 = estrela). */
  energyTileOffsets: [4, 11],
  /** Energia a mais por captura do Cacador. */
  hunterCaptureEnergy: 1,
  /** Ultimate: a carga vai de 0 ao maximo; cheia, o jogador usa a ultimate do seu personagem e ela zera. */
  ultimateMax: 10,
  /** Carga por movimento, por captura, para quem tem a peca capturada e por peca que chega ao centro. */
  ultimateCharge: { move: 1, capture: 2, captured: 2, finish: 2 },
  abilities: {
    SHIELD: { cost: 2 },
    BOOST: { cost: 2, squares: 2 },
    PULL: { cost: 3, squares: 2 },
    SWAP: { cost: 3 },
    SECOND_CHANCE: { cost: 4 },
    ESCAPE: { cost: 3, squares: 3 },
    // Poderes dos personagens: uma vez por partida, sem energia
    DASH: { cost: 0, squares: 3 },
    FORTIFY: { cost: 0 },
    TRICK: { cost: 0 },
    // Ultimates (carga cheia, sem energia)
    MAX_SPEED: { cost: 0 },
    FORTRESS: { cost: 0 },
    /** Ate `captures` capturas da vez dao `squares` casas a mais no movimento seguinte. */
    HUNT: { cost: 0, squares: 3, captures: 2 },
    CHAOS: { cost: 0 },
  },
};

export type LudoMode = 'CLASSICO' | 'ARENA';

/** O que cada modalidade liga. O Classico e o Ludo tradicional; a Arena soma os recursos estrategicos. */
export const LUDO_MODES: Record<
  LudoMode,
  { energyEnabled: boolean; abilitiesEnabled: boolean; charactersEnabled: boolean; ultimatesEnabled: boolean }
> = {
  CLASSICO: { energyEnabled: false, abilitiesEnabled: false, charactersEnabled: false, ultimatesEnabled: false },
  ARENA: { energyEnabled: true, abilitiesEnabled: true, charactersEnabled: true, ultimatesEnabled: true },
};
