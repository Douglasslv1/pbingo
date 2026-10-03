import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatBrl } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import { useGameConfig } from '../../hooks/useGameConfig';
import { useTurnAlert } from '../../hooks/useTurnAlert';
import type { LudoAbilityId, LudoAbilityTarget, LudoAction, LudoGameView, LudoTableView } from '../../types';
import GameTable from '../tables/GameTable';
import VictoryOverlay from '../tables/VictoryOverlay';
import LudoAbilities, { ABILITY_ICONS, CHARACTER_ICONS } from './LudoAbilities';
import LudoBoard from './LudoBoard';
import LudoDice from './LudoDice';
import { COLOR_NAMES, FINISH } from './ludoGeometry';

interface Props {
  table: LudoTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: LudoAction) => void;
  onComeBack: () => void;
  onBackToLobby: () => void;
}

/** O que a ultima habilidade fez, para todos verem (ex.: "Ana protegeu uma peça"). */
function abilityNews(game: LudoGameView, nameOf: (seat: number) => string): string | null {
  const used = game.lastAbility;
  // So logo depois de usada (a jogada automatica seguinte tambem conta)
  if (!used || game.moveCount - used.move > 1) return null;
  const who = nameOf(used.seat);
  const name = game.abilities.find((ability) => ability.id === used.ability)?.name ?? '';
  const text: Record<LudoAbilityId, string> = {
    SHIELD: `${who} protegeu uma peça até a próxima vez`,
    BOOST: `${who} ganhou casas extras neste movimento`,
    PULL: `${who} puxou uma peça de ${nameOf(used.targetSeat ?? 0)} para trás`,
    SWAP: `${who} trocou duas peças de lugar`,
    SECOND_CHANCE: `${who} jogou o dado de novo`,
    ESCAPE: `${who} armou uma fuga numa peça`,
    DASH: `${who} ganhou casas extras neste movimento`,
    FORTIFY: `${who} fortificou uma peça`,
    TRICK: `${who} trocou duas peças de lugar`,
    MAX_SPEED: `${who} jogou dois dados para escolher um`,
    FORTRESS: `${who} protegeu todas as peças até a próxima vez`,
    HUNT: `${who} começou a caçada: capturas dão casas extras`,
    CHAOS: `${who} trocou uma peça de lugar com uma de ${nameOf(used.targetSeat ?? 0)}`,
  };
  return `${ABILITY_ICONS[used.ability]} ${name.toUpperCase()} · ${text[used.ability]}`;
}

/** Barra de 0 ao maximo (energia, ultimate). */
function Meter({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div className={className}>
      <span>{label}</span>
      <div className="ludo-energy-bar" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? 'on' : undefined} />
        ))}
      </div>
      <strong>
        {value}/{max}
      </strong>
    </div>
  );
}

export default function LudoGame({ table, busy, error, onAction, onComeBack, onBackToLobby }: Props) {
  const game = table.game;
  const [selected, setSelected] = useState<LudoAbilityId | null>(null);
  /** Primeira peca escolhida para a Troca. */
  const [picked, setPicked] = useState<number | null>(null);
  // Qualquer jogada nova cancela a escolha de habilidade em andamento
  useEffect(() => {
    setSelected(null);
    setPicked(null);
  }, [game?.moveCount]);
  const playing = table.status === 'PLAYING' && game?.status === 'PLAYING';
  const myTurn = playing && game?.turn === table.mySeat;
  const countdown = useCountdown(playing ? table.turnDeadline : null);
  const { soundOn, toggleSound } = useTurnAlert(myTurn);
  const turnSeconds = useGameConfig()?.ludoTurnSeconds ?? 30;
  if (!game || table.mySeat === null) return null;

  const mySeat = table.mySeat;
  const player = (seat: number) => table.players.find((p) => p.seat === seat);
  const nameOf = (seat: number) => (player(seat)?.isMe ? 'Você' : (player(seat)?.name ?? `Lugar ${seat + 1}`));
  const urgent = countdown !== null && countdown <= 10;
  const iAmAway = player(mySeat)?.away ?? false;
  const home = (seat: number) => game.pieces[seat].filter((progress) => progress === FINISH).length;
  const winner = game.result?.winner ?? null;
  const characterOf = (seat: number) => game.characterCatalog.find((item) => item.id === game.characters[seat]);

  const seats = game.pieces.map((_, seat) => ({
    name: nameOf(seat),
    tag: [COLOR_NAMES[game.colors[seat]], characterOf(seat) && `${CHARACTER_ICONS[characterOf(seat)!.id]} ${characterOf(seat)!.name}`]
      .filter(Boolean)
      .join(' · '),
    away: player(seat)?.away,
    hand: (
      <span className="label">
        {home(seat)}/4 no centro{game.energy && ` · ⚡ ${game.energy[seat]}`}
      </span>
    ),
    className: `ludo-seat ludo-color-${game.colors[seat]}`,
  }));

  const ability = game.abilities.find((item) => item.id === selected);
  const options = selected ? (game.abilityOptions[selected] ?? []) : [];
  // Pecas que acendem: alvos da habilidade escolhida ou, sem ela, as que podem andar
  const selectable =
    !myTurn || busy
      ? []
      : ability?.target === 'OWN_AND_OPPONENT'
        ? // Caos: primeiro uma peca sua, depois as adversarias que podem trocar com ela
          options.flatMap(({ targetSeat, pieces }) =>
            picked === null
              ? [{ seat: mySeat, piece: pieces![0] }]
              : pieces![0] === picked
                ? [{ seat: targetSeat!, piece: pieces![1] }]
                : [],
          )
        : ability && ability.target !== 'NONE'
        ? options
            .filter((option) => picked === null || option.pieces?.includes(picked))
            .flatMap((option) =>
              (option.pieces ?? [])
                .filter((piece) => piece !== picked)
                .map((piece) => ({ seat: option.targetSeat ?? mySeat, piece })),
            )
        : game.legalPieces.map((piece) => ({ seat: mySeat, piece }));

  function applyAbility(target: LudoAbilityTarget) {
    if (selected) onAction({ type: 'ABILITY', ability: selected, ...target });
    setSelected(null);
    setPicked(null);
  }

  function onSelect(seat: number, piece: number) {
    if (!ability || ability.target === 'NONE') return onAction({ type: 'MOVE', piece });
    if (ability.target === 'OWN_AND_OPPONENT') {
      return picked === null ? setPicked(piece) : applyAbility({ targetSeat: seat, pieces: [picked, piece] });
    }
    if (ability.target === 'OPPONENT_PIECE') return applyAbility({ targetSeat: seat, pieces: [piece] });
    if (ability.target === 'OWN_PIECE_PAIR' && picked === null) return setPicked(piece);
    applyAbility({ pieces: picked === null ? [piece] : [picked, piece] });
  }

  const news = abilityNews(game, nameOf);
  const newsIsUltimate = game.abilities.find((item) => item.id === game.lastAbility?.ability)?.ultimate;
  const escaped = game.lastMove?.escaped ?? [];
  const fortified = game.lastMove?.fortified ?? [];
  const roll = game.lastRoll;
  const situation = !playing
    ? ''
    : game.phase === 'PICK'
      ? myTurn
        ? 'Escolha seu personagem.'
        : `${nameOf(game.turn)} está escolhendo o personagem...`
      : myTurn
      ? game.phase === 'ROLL'
        ? `Sua vez: jogue o dado${game.bonus ? ` (+${game.bonus} casas no movimento)` : ''}.`
        : game.phase === 'CHOOSE'
          ? 'Velocidade máxima: escolha um dos dois dados.'
          : game.legalPieces.length === 0
          ? `Você tirou ${game.dice} e nenhuma peça pode andar. Use uma habilidade ou passe a vez.`
          : `Você tirou ${game.dice}${game.bonus ? ` +${game.bonus} casas` : ''}: toque numa peça destacada.`
      : `Vez de ${nameOf(game.turn)}...`;

  return (
    <div className="card domino-game ludo-game">
      <div className="domino-header">
        <span className="label">
          Ludo {game.mode === 'ARENA' ? 'Arena' : 'Clássico'} · {game.pieces.length === 2 ? 'mano a mano' : '4 jogadores'} ·{' '}
          {Number(table.prizePool) === 0 ? 'partida gratuita' : `prêmio ${formatBrl(table.prizePool)}`}
        </span>
        <button type="button" className="link" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? 'Som: ligado' : 'Som: desligado'}
        </button>
      </div>

      <GameTable seats={seats} mySeat={mySeat} turnSeat={playing ? game.turn : null} countdown={countdown}>
        <LudoBoard game={game} mySeat={mySeat} selectable={selectable} onSelect={onSelect} />
      </GameTable>

      {winner !== null ? (
        <div className="domino-result">
          <VictoryOverlay
            won={winner === mySeat}
            headline={winner === mySeat ? 'Vitória!' : 'Derrota'}
            detail={`${nameOf(winner)} levou as 4 peças ao centro.`}
          />
          <h3>{winner === mySeat ? 'Você venceu!' : 'Fim de partida'}</h3>
          <p>{`${nameOf(winner)} levou as 4 peças ao centro.`}</p>
          <p className="label ludo-fairness">
            Semente dos dados: <code>{game.seed}</code>. O código mostrado durante a partida é o SHA-256 dela: com os dois,
            qualquer um confere que nenhum dado foi alterado.
          </p>
          <button type="button" onClick={onBackToLobby}>
            Jogar de novo
          </button>
        </div>
      ) : (
        <>
          {iAmAway && (
            <div className="banner away-banner">
              <span>Você ficou ausente e o sistema está jogando por você.</span>
              <button type="button" onClick={onComeBack} disabled={busy}>
                Voltei
              </button>
            </div>
          )}

          {myTurn && countdown !== null && (
            <div className={urgent ? 'turn-bar urgent' : 'turn-bar'} aria-hidden="true">
              <div style={{ width: `${Math.min((countdown / turnSeconds) * 100, 100)}%` }} />
            </div>
          )}

          <AnimatePresence>
            {news && (
              <motion.p
                key={game.lastAbility!.move}
                className={newsIsUltimate ? 'banner ludo-news ultimate' : 'banner ludo-news'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {news}
              </motion.p>
            )}
          </AnimatePresence>
          {escaped.length > 0 && (
            <p className="banner ludo-news">💨 FUGA! A peça de {escaped.map((escape) => nameOf(escape.seat)).join(' e ')} escapou da captura.</p>
          )}
          {fortified.length > 0 && (
            <p className="banner ludo-news">
              🏰 FORTIFICADA! A peça de {fortified.map((victim) => nameOf(victim.seat)).join(' e ')} ignorou a captura.
            </p>
          )}

          {game.phase === 'PICK' ? (
            <div className="ludo-abilities">
              <p className={myTurn ? 'domino-turn mine' : 'domino-turn'}>{situation}</p>
              <div className="ludo-ability-list ludo-character-list">
                {game.characterCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={myTurn ? 'ludo-ability usable' : 'ludo-ability'}
                    onClick={() => onAction({ type: 'PICK', character: item.id })}
                    disabled={!myTurn || busy}
                  >
                    <span className="ludo-ability-icon" aria-hidden="true">
                      {CHARACTER_ICONS[item.id]}
                    </span>
                    <span>{item.name}</span>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ludo-controls">
              <LudoDice
                value={roll?.value ?? null}
                rollId={game.rolls}
                rolling={busy && myTurn && game.phase === 'ROLL'}
                color={roll ? game.colors[roll.seat] : null}
                onRoll={myTurn && game.phase === 'ROLL' ? () => onAction({ type: 'ROLL' }) : undefined}
              />
              <div>
                <p className={myTurn ? 'domino-turn mine' : 'domino-turn'}>{situation}</p>
                {roll && <p className="label">Último dado: {nameOf(roll.seat)} tirou {roll.value}.</p>}
                {myTurn && game.phase === 'CHOOSE' && (
                  <div className="ludo-choices">
                    {game.diceChoices!.map((value, index) => (
                      <button key={index} type="button" onClick={() => onAction({ type: 'CHOOSE', index })} disabled={busy}>
                        🎲 {value}
                      </button>
                    ))}
                  </div>
                )}
                {myTurn && game.phase === 'MOVE' && game.legalPieces.length === 0 && (
                  <button type="button" className="secondary" onClick={() => onAction({ type: 'PASS' })} disabled={busy}>
                    Passar a vez
                  </button>
                )}
              </div>
            </div>
          )}
          {game.energy && <Meter label="⚡ Energia" value={game.energy[mySeat]} max={game.maxEnergy} className="ludo-energy" />}
          {game.ultimate && game.characters[mySeat] && (
            <Meter label="🔥 Ultimate" value={game.ultimate[mySeat]} max={game.ultimateMax} className="ludo-energy ludo-ultimate" />
          )}
          {game.abilities.length > 0 && game.phase !== 'PICK' && (
            <LudoAbilities
              game={game}
              mySeat={mySeat}
              myTurn={myTurn}
              busy={busy}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setPicked(null);
              }}
              onUse={applyAbility}
            />
          )}
          {picked !== null && (
            <p className="domino-turn mine">
              {ability?.target === 'OWN_AND_OPPONENT'
                ? 'Agora toque na peça adversária que vai trocar de lugar com a sua.'
                : 'Agora toque na outra peça que vai trocar de lugar.'}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <p className="label ludo-fairness" title={game.commitment}>
            Dados verificáveis · código {game.commitment.slice(0, 12)}
          </p>
        </>
      )}
    </div>
  );
}
