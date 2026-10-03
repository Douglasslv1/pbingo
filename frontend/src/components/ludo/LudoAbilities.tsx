import type { LudoAbility, LudoAbilityId, LudoAbilityTarget, LudoCharacterId, LudoGameView } from '../../types';

export const ABILITY_ICONS: Record<LudoAbilityId, string> = {
  SHIELD: '🛡️',
  BOOST: '🚀',
  PULL: '🧲',
  SWAP: '🔄',
  SECOND_CHANCE: '🎲',
  ESCAPE: '💨',
  DASH: '🏃',
  FORTIFY: '🏰',
  TRICK: '🃏',
  MAX_SPEED: '⚡',
  FORTRESS: '🏯',
  HUNT: '🎯',
  CHAOS: '🌀',
};

export const CHARACTER_ICONS: Record<LudoCharacterId, string> = {
  RUNNER: '🏃',
  GUARDIAN: '🏰',
  HUNTER: '🏹',
  TRICKSTER: '🃏',
};

const TARGET_HINT: Record<LudoAbility['target'], string> = {
  NONE: '',
  OWN_PIECE: 'Toque numa peça sua destacada.',
  OPPONENT_PIECE: 'Toque numa peça adversária destacada.',
  OWN_PIECE_PAIR: 'Toque nas duas peças suas que vão trocar de lugar.',
  OWN_AND_OPPONENT: 'Toque numa peça sua e depois na peça adversária que vai trocar de lugar com ela.',
};

interface Props {
  game: LudoGameView;
  mySeat: number;
  myTurn: boolean;
  busy: boolean;
  selected: LudoAbilityId | null;
  onSelect: (ability: LudoAbilityId | null) => void;
  onUse: (target: LudoAbilityTarget) => void;
}

/**
 * Habilidades da Arena: tocar numa mostra o que ela faz (funciona no celular, sem depender de hover).
 * Sem alvo, usa com "Usar"; com alvo, as pecas validas acendem no tabuleiro.
 */
export default function LudoAbilities({ game, mySeat, myTurn, busy, selected, onSelect, onUse }: Props) {
  const ability = game.abilities.find((item) => item.id === selected);
  const usable = (id: LudoAbilityId) => myTurn && (game.abilityOptions[id]?.length ?? 0) > 0;
  // Poder e ultimate: so os do meu personagem; no lugar do custo, "1×" ou a carga que a ultimate pede
  const mine = game.abilities.filter((item) => !item.character || item.character === game.characters[mySeat]);
  const costOf = (item: LudoAbility) =>
    item.ultimate ? `🔥${game.ultimateMax}` : item.character ? (game.powerUsed[mySeat] ? 'usado' : '1×') : `⚡${item.cost}`;

  return (
    <div className="ludo-abilities">
      <div className="ludo-ability-list">
        {mine.map((item) => (
          <button
            key={item.id}
            type="button"
            className={['ludo-ability', item.ultimate && 'ultimate', usable(item.id) && 'usable', selected === item.id && 'selected']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(selected === item.id ? null : item.id)}
            aria-pressed={selected === item.id}
            title={`${item.name}: ${item.description}${item.character ? '' : ` Custo: ${item.cost} de energia.`}`}
          >
            <span className="ludo-ability-icon" aria-hidden="true">
              {ABILITY_ICONS[item.id]}
            </span>
            <span>{item.name}</span>
            <span className="ludo-ability-cost">{costOf(item)}</span>
          </button>
        ))}
      </div>

      {ability && (
        <div className="ludo-ability-detail">
          <strong>
            {ABILITY_ICONS[ability.id]} {ability.name} · {costOf(ability)}
          </strong>
          <p>{ability.description}</p>
          {usable(ability.id) ? (
            ability.target === 'NONE' ? (
              <button type="button" onClick={() => onUse({})} disabled={busy}>
                Usar {ability.name}
              </button>
            ) : (
              <p className="domino-turn mine">{TARGET_HINT[ability.target]}</p>
            )
          ) : (
            <p className="label">
              {!myTurn
                ? 'Disponível na sua vez.'
                : game.abilityUsed
                  ? 'Você já usou uma habilidade nesta vez.'
                  : ability.ultimate && (game.ultimate?.[mySeat] ?? 0) < game.ultimateMax
                    ? 'A ultimate ainda não está carregada.'
                    : !ability.ultimate && ability.character && game.powerUsed[mySeat]
                    ? 'Já usado nesta partida.'
                    : (game.energy?.[game.turn] ?? 0) < ability.cost
                      ? 'Energia insuficiente.'
                      : 'Não pode ser usada agora.'}
            </p>
          )}
          <button type="button" className="link" onClick={() => onSelect(null)}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
