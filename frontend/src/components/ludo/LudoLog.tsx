import type { LudoEventId, LudoGameView, LudoLogEntry } from '../../types';
import { ABILITY_ICONS, CHARACTER_ICONS } from './LudoAbilities';
import { TILE_ICONS } from './LudoBoard';
import { BASE, FINISH } from './ludoGeometry';

type Special = NonNullable<NonNullable<LudoGameView['lastMove']>['special']>;

const EVENT_TEXT: Record<LudoEventId, string> = {
  ADVANCE: 'AVANÇO GERAL · todas as peças na volta andaram 1 casa',
  ENERGY: 'ENERGIA · todos ganharam +1 de energia',
  CHARGE: 'CARGA · todos ganharam +2 de carga da ultimate',
};

const abilityName = (game: LudoGameView, id: string) => game.abilities.find((ability) => ability.id === id)?.name ?? '';

/** O que uma casa especial fez (portal, bau ou evento). */
export function specialText(game: LudoGameView, special: Special, who: string): string {
  const icon = TILE_ICONS[special.tile];
  if (special.tile === 'PORTAL') return `${icon} PORTAL · a peça de ${who} saltou para o próximo portal`;
  if (special.tile === 'EVENT') return `${icon} EVENTO: ${EVENT_TEXT[special.event]}`;
  return `${icon} BAÚ · ${who} ganhou ${abilityName(game, special.ability)} (sai de graça)`;
}

function entryText(game: LudoGameView, entry: LudoLogEntry, nameOf: (seat: number) => string): string {
  const who = nameOf(entry.seat);
  if (entry.type === 'PICK') {
    const character = game.characterCatalog.find((item) => item.id === entry.character)?.name;
    return `${CHARACTER_ICONS[entry.character]} ${who} escolheu ${character}`;
  }
  if (entry.type === 'ROLL') return `🎲 ${who} tirou ${entry.value}`;
  if (entry.type === 'PASS') return `⏭️ ${who} passou a vez`;
  if (entry.type === 'ABILITY') return `${ABILITY_ICONS[entry.ability]} ${who} usou ${abilityName(game, entry.ability)}`;
  return [
    entry.from === BASE
      ? `🚪 ${who} tirou uma peça da base`
      : entry.to === FINISH
        ? `🏁 ${who} levou uma peça ao centro`
        : `➡️ ${who} andou ${entry.to - entry.from} casas`,
    ...entry.captured.map((capture) => (nameOf(capture.seat) === 'Você' ? '💥 capturou sua peça' : `💥 capturou a peça de ${nameOf(capture.seat)}`)),
    entry.special && specialText(game, entry.special, who),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Historico da partida, do mais recente ao mais antigo (vem do servidor: continua la depois de recarregar). */
export default function LudoLog({ game, nameOf }: { game: LudoGameView; nameOf: (seat: number) => string }) {
  if (game.log.length === 0) return null;
  return (
    <details className="ludo-log">
      <summary>Histórico da partida</summary>
      <ol>
        {[...game.log].reverse().map((entry) => (
          <li key={`${entry.move}-${entry.type}`} className={`ludo-color-${game.colors[entry.seat]}`}>
            {entryText(game, entry, nameOf)}
          </li>
        ))}
      </ol>
    </details>
  );
}
