/**
 * Personagens da Arena: um por jogador, escolhido no inicio da partida. Cada um e um estilo de jogo,
 * nenhum e melhor que os outros. O poder de uso unico fica no registro de habilidades (campo `character`).
 */
export const CHARACTERS = {
  RUNNER: { name: 'Corredor', description: 'Arrancada: uma vez por partida, +3 casas num movimento.' },
  GUARDIAN: { name: 'Guardião', description: 'Fortificar: uma vez por partida, arma uma peça para ignorar uma captura.' },
  HUNTER: { name: 'Caçador', description: 'Passiva: cada captura dá +1 de energia a mais.' },
  TRICKSTER: { name: 'Trapaceiro', description: 'Truque: uma vez por partida, troca de lugar duas peças suas, sem gastar energia.' },
};

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
