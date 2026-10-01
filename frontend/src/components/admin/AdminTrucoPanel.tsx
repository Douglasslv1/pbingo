import { formatBrl } from '../../format';
import type { AdminTrucoTableDetail } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';
import PlayingCard from '../truco/PlayingCard';
import { cardName, VALUE_NAME } from '../truco/trucoLabels';
import AdminTablesPanel, { TableDetailProps, useAdminTable } from './AdminTablesPanel';

type Move = AdminTrucoTableDetail['moves'][number];

function describeMove(action: Move['action']): string {
  switch (action.type) {
    case 'PLAY':
      return `jogou ${action.card ? cardName(action.card) : `a carta ${action.index + 1}`}${action.covered ? ' (coberta)' : ''}`;
    case 'TRUCO':
      return action.value ? `pediu ${VALUE_NAME[action.value]} (vale ${action.value})` : 'pediu aumento';
    case 'ACCEPT':
      return 'aceitou';
    case 'RUN':
      return 'correu';
    case 'RAISE':
      return action.value ? `aceitou e pediu ${VALUE_NAME[action.value]} (vale ${action.value})` : 'aceitou e aumentou';
  }
}

function TrucoTableDetail({ tableId, onClose }: TableDetailProps) {
  const { detail, error } = useAdminTable<AdminTrucoTableDetail>('truco', tableId);

  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="label">Carregando mesa...</p>;

  const nameOf = (seat: number) => detail.players.find((p) => p.seat === seat)?.name ?? `Lugar ${seat + 1}`;
  const team = (seat: number) => (detail.teamMode === 'PAIRS' ? ` (dupla ${seat % 2 === 0 ? 'A' : 'B'})` : '');
  // Jogadas agrupadas por mao, com a vira de cada uma
  const hands = detail.moves.reduce<Array<{ hand: number; vira: Move['action']['vira']; moves: Move[] }>>((groups, move) => {
    const last = groups[groups.length - 1];
    if (last?.hand === move.action.hand) last.moves.push(move);
    else groups.push({ hand: move.action.hand, vira: move.action.vira, moves: [move] });
    return groups;
  }, []);

  return (
    <div className="card admin-domino-detail">
      <div className="withdrawal-row">
        <h3>
          Truco · {detail.teamMode === 'PAIRS' ? 'Duplas' : 'Mano a mano'} · {detail.stake}{' '}
          {detail.stake === 1 ? 'chave' : 'chaves'}
        </h3>
        <button type="button" className="link" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="label">
        Mesa {detail.id} · pote {formatBrl(detail.prizePool)} · criada {formatDateTime(detail.createdAt)}
        {detail.finishedAt && ` · encerrada ${formatDateTime(detail.finishedAt)}`}
      </p>
      {detail.score && (
        <p>
          Placar: dupla/lugar par <strong>{detail.score[0]}</strong> × <strong>{detail.score[1]}</strong> ímpar · mão{' '}
          {detail.handNumber}
        </p>
      )}

      <h4>Jogadores e cartas da mão atual</h4>
      <ul className="admin-domino-players">
        {detail.players.map((player) => (
          <li key={player.seat}>
            <div className="withdrawal-row">
              <span>
                <strong>
                  {player.seat + 1}. {player.name}
                  {team(player.seat)}
                </strong>{' '}
                <span className="label">{player.email}</span>
              </span>
              <span className="label">
                {player.prizeAmount && `prêmio ${formatBrl(player.prizeAmount)} · `}
                {player.timeouts} tempo(s) esgotado(s){player.away && ' · ausente'}
              </span>
            </div>
            <div className="truco-backs">
              {(player.hand ?? []).map((card) => (
                <PlayingCard key={card} card={card} size="small" />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h4>Jogadas ({detail.moves.length})</h4>
      {hands.map((group) => (
        <div key={group.hand}>
          <p className="label">
            Mão {group.hand} · vira {cardName(group.vira)}
          </p>
          <ol className="admin-domino-moves">
            {group.moves.map((move) => (
              <li key={move.moveNumber}>
                <span>
                  <strong>{nameOf(move.seat)}</strong> {describeMove(move.action)}
                  {move.automatic && <span className="away-badge">automática</span>}
                </span>
                <span className="label">{new Date(move.createdAt).toLocaleTimeString('pt-BR')}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export default function AdminTrucoPanel() {
  return (
    <AdminTablesPanel
      game="truco"
      describe={(table) => `Truco · ${table.teamMode === 'PAIRS' ? 'Duplas' : 'Mano a mano'}`}
      Detail={TrucoTableDetail}
    />
  );
}
