import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useGameConfig } from '../hooks/useGameConfig';
import type { DominoMatchItem, Page, RoundHistoryItem, TransactionItem, TrucoMatchItem } from '../types';
import { formatDateTime } from '../withdrawalFormat';
import { MODE_LABELS, TEAM_LABELS } from './domino/dominoLabels';

export type Tab = 'transactions' | 'rounds' | 'domino' | 'truco';

interface TransactionView {
  title: string;
  amount: string;
  positive: boolean;
  note?: string;
}

const WITHDRAWAL_STATUS_NOTES: Record<string, string> = {
  PENDING: 'Em análise',
  COMPLETED: 'Pago',
  REJECTED: 'Recusado - valor devolvido',
};

/** Rotulo conforme o jogo; movimentacoes antigas sem jogo registrado recebem um rotulo neutro. */
function byGame(transaction: TransactionItem, labels: Record<'BINGO' | 'DOMINO' | 'TRUCO', string>, unknown: string): string {
  return labels[transaction.game as keyof typeof labels] ?? unknown;
}

function describeTransaction(transaction: TransactionItem): TransactionView {
  const keys = (count: number) => `${count} ${count === 1 ? 'chave' : 'chaves'}`;

  switch (transaction.type) {
    case 'PURCHASE_CREDITS':
      return {
        title: 'Compra de chaves (Pix)',
        amount: `+${keys(transaction.amountCredits)}`,
        positive: true,
        note: formatBrl(transaction.amountFiat),
      };
    case 'SPEND_KEY':
      return {
        title: byGame(
          transaction,
          { BINGO: 'Cartela - Números da sorte', DOMINO: 'Entrada em mesa de Dominó', TRUCO: 'Entrada em mesa de Truco' },
          'Chave usada',
        ),
        amount: `-${keys(transaction.amountCredits)}`,
        positive: false,
      };
    case 'PRIZE_PAYOUT':
      return {
        title: byGame(
          transaction,
          { BINGO: 'Prêmio - Números da sorte', DOMINO: 'Prêmio no Dominó', TRUCO: 'Prêmio no Truco' },
          'Prêmio recebido',
        ),
        amount: `+${formatBrl(transaction.amountFiat)}`,
        positive: true,
      };
    case 'KEY_REFUND':
      return {
        title: byGame(
          transaction,
          {
            BINGO: 'Chave devolvida (rodada cancelada ou saída)',
            DOMINO: 'Chave devolvida (mesa cancelada ou saída)',
            TRUCO: 'Chave devolvida (mesa cancelada ou saída)',
          },
          'Chave devolvida',
        ),
        amount: `+${keys(transaction.amountCredits)}`,
        positive: true,
      };
    case 'WITHDRAWAL':
      return {
        title: 'Saque via Pix',
        amount: `-${formatBrl(transaction.amountFiat)}`,
        positive: false,
        note: WITHDRAWAL_STATUS_NOTES[transaction.status] ?? transaction.status,
      };
  }
}

function describeRoundResult(round: RoundHistoryItem): string {
  if (round.status === 'CANCELLED') return 'Cancelada - chave devolvida';
  if (round.status !== 'FINISHED') return 'Em andamento';
  if (round.winningTickets === 0) return 'Não ganhou';
  return `Ganhou ${formatBrl(round.prizeWon)}`;
}

/** Carrega uma lista paginada por cursor, acumulando as paginas ao clicar em "Carregar mais". */
function usePagedList<T>(fetchPage: (cursor?: string) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchPage(cursor);
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar o histórico');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const reload = useCallback(() => load(), [load]);
  const loadMore = () => {
    if (nextCursor) load(nextCursor);
  };

  return { items, nextCursor, loading, error, reload, loadMore };
}

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'transactions', label: 'Extrato' },
  { value: 'rounds', label: 'Números da sorte' },
  { value: 'domino', label: 'Dominó' },
  { value: 'truco', label: 'Truco' },
];

const MATCH_OUTCOME: Record<DominoMatchItem['outcome'], string> = {
  WON: 'Venceu',
  LOST: 'Não venceu',
  CANCELLED: 'Cancelada - chave devolvida',
};

/** Titulo e detalhe de uma partida de domino ou truco no historico. */
function describeMatch(match: DominoMatchItem | TrucoMatchItem): { title: string; note: string | null } {
  const stake = match.stake > 1 ? ` · mesa de ${match.stake} chaves` : '';
  if ('reason' in match) {
    return {
      title: `${MODE_LABELS[match.mode]} · ${TEAM_LABELS[match.teamMode]}${stake}`,
      note: match.reason && (match.reason === 'DOMINO' ? 'terminou em batida' : 'jogo trancado'),
    };
  }
  const mine = match.mySeat % 2;
  return {
    title: `Truco · ${TEAM_LABELS[match.teamMode]}${stake}`,
    note: match.score ? `placar ${match.score[mine]} × ${match.score[1 - mine]}` : null,
  };
}

interface Props {
  initialTab?: Tab;
}

export default function HistoryPanel({ initialTab = 'transactions' }: Props) {
  const { auth } = useAuth();
  const config = useGameConfig();
  const [tab, setTab] = useState<Tab>(initialTab);
  const showTruco = config?.trucoEnabled || auth?.user.role === 'ADMIN';
  const token = auth?.token ?? '';

  const fetchTransactions = useCallback((cursor?: string) => api.getMyTransactions(token, cursor), [token]);
  const fetchRounds = useCallback((cursor?: string) => api.getMyRoundHistory(token, cursor), [token]);
  const fetchDomino = useCallback(
    (cursor?: string) => api.getMyMatches<DominoMatchItem>('domino', token, cursor),
    [token],
  );
  const fetchTruco = useCallback((cursor?: string) => api.getMyMatches<TrucoMatchItem>('truco', token, cursor), [token]);
  const lists = {
    transactions: usePagedList(fetchTransactions),
    rounds: usePagedList(fetchRounds),
    domino: usePagedList(fetchDomino),
    truco: usePagedList(fetchTruco),
  };
  const { transactions, rounds } = lists;
  const active = lists[tab];
  const matches = tab === 'domino' ? lists.domino.items : tab === 'truco' ? lists.truco.items : [];
  const { reload } = active;

  // Recarrega ao trocar de aba para mostrar movimentacoes recentes
  useEffect(() => {
    if (token) reload();
  }, [reload, token]);

  return (
    <div className="card">
      <h2>Histórico</h2>
      <div className="tabs">
        {TABS.filter((option) => option.value !== 'truco' || showTruco).map((option) => (
          <button
            key={option.value}
            type="button"
            className={tab === option.value ? 'tab active' : 'tab'}
            onClick={() => setTab(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {active.error && <p className="error">{active.error}</p>}
      {!active.error && !active.loading && active.items.length === 0 && (
        <p className="label">Nada por aqui ainda.</p>
      )}

      <ul className="history-list">
        {tab === 'transactions' &&
          transactions.items.map((transaction) => {
            const view = describeTransaction(transaction);
            return (
              <li key={transaction.id}>
                <div className="withdrawal-row">
                  <span>{view.title}</span>
                  <strong className={view.positive ? 'amount-in' : 'amount-out'}>{view.amount}</strong>
                </div>
                <span className="label">
                  {formatDateTime(transaction.createdAt)}
                  {view.note && ` · ${view.note}`}
                </span>
              </li>
            );
          })}

        {tab === 'rounds' &&
          rounds.items.map((round) => (
            <li key={round.roundId}>
              <div className="withdrawal-row">
                <span>
                  {round.ticketsCount} {round.ticketsCount === 1 ? 'cartela' : 'cartelas'}
                </span>
                <strong className={round.winningTickets > 0 ? 'amount-in' : undefined}>
                  {describeRoundResult(round)}
                </strong>
              </div>
              <span className="label">
                {formatDateTime(round.startedAt)} · prêmio da rodada {formatBrl(round.accumulatedPrize)}
              </span>
            </li>
          ))}

        {matches.map((match) => {
          const { title, note } = describeMatch(match);
          return (
            <li key={match.tableId}>
              <div className="withdrawal-row">
                <span>{title}</span>
                <strong className={match.outcome === 'WON' ? 'amount-in' : undefined}>
                  {match.outcome === 'WON' && Number(match.prizeWon) > 0
                    ? `Venceu +${formatBrl(match.prizeWon)}`
                    : MATCH_OUTCOME[match.outcome]}
                </strong>
              </div>
              <span className="label">
                {formatDateTime(match.playedAt)}
                {note && ` · ${note}`}
              </span>
            </li>
          );
        })}
      </ul>

      {active.nextCursor && (
        <button type="button" className="link" onClick={active.loadMore} disabled={active.loading}>
          {active.loading ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
