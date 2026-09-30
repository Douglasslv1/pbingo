import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import type { DominoMatchItem, Page, RoundHistoryItem, TransactionItem } from '../types';
import { formatDateTime } from '../withdrawalFormat';
import { MODE_LABELS, TEAM_LABELS } from './domino/dominoLabels';

export type Tab = 'transactions' | 'rounds' | 'domino';

interface TransactionView {
  title: string;
  amount: string;
  positive: boolean;
  note?: string;
}

const WITHDRAWAL_STATUS_NOTES: Record<string, string> = {
  PENDING: 'Em analise',
  COMPLETED: 'Pago',
  REJECTED: 'Recusado - valor devolvido',
};

/** Rotulo conforme o jogo; movimentacoes antigas sem jogo registrado recebem um rotulo neutro. */
function byGame(transaction: TransactionItem, bingo: string, domino: string, unknown: string): string {
  if (transaction.game === 'BINGO') return bingo;
  if (transaction.game === 'DOMINO') return domino;
  return unknown;
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
        title: byGame(transaction, 'Cartela de bingo', 'Entrada em mesa de domino', 'Chave usada'),
        amount: `-${keys(transaction.amountCredits)}`,
        positive: false,
      };
    case 'PRIZE_PAYOUT':
      return {
        title: byGame(transaction, 'Premio no bingo', 'Premio no domino', 'Premio recebido'),
        amount: `+${formatBrl(transaction.amountFiat)}`,
        positive: true,
      };
    case 'KEY_REFUND':
      return {
        title: byGame(
          transaction,
          'Chave devolvida (rodada cancelada ou saida)',
          'Chave devolvida (mesa cancelada ou saida)',
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
  if (round.winningTickets === 0) return 'Nao ganhou';
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
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar o historico');
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
  { value: 'rounds', label: 'Bingo' },
  { value: 'domino', label: 'Domino' },
];

const DOMINO_OUTCOME: Record<DominoMatchItem['outcome'], string> = {
  WON: 'Venceu',
  LOST: 'Nao venceu',
  CANCELLED: 'Cancelada - chave devolvida',
};

interface Props {
  initialTab?: Tab;
}

export default function HistoryPanel({ initialTab = 'transactions' }: Props) {
  const { auth } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const token = auth?.token ?? '';

  const fetchTransactions = useCallback((cursor?: string) => api.getMyTransactions(token, cursor), [token]);
  const fetchRounds = useCallback((cursor?: string) => api.getMyRoundHistory(token, cursor), [token]);
  const fetchMatches = useCallback((cursor?: string) => api.getMyDominoMatches(token, cursor), [token]);
  const transactions = usePagedList(fetchTransactions);
  const rounds = usePagedList(fetchRounds);
  const matches = usePagedList(fetchMatches);
  const active = tab === 'transactions' ? transactions : tab === 'rounds' ? rounds : matches;
  const { reload } = active;

  // Recarrega ao trocar de aba para mostrar movimentacoes recentes
  useEffect(() => {
    if (token) reload();
  }, [reload, token]);

  return (
    <div className="card">
      <h2>Historico</h2>
      <div className="tabs">
        {TABS.map((option) => (
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
                {formatDateTime(round.startedAt)} · premio da rodada {formatBrl(round.accumulatedPrize)}
              </span>
            </li>
          ))}

        {tab === 'domino' &&
          matches.items.map((match) => (
            <li key={match.tableId}>
              <div className="withdrawal-row">
                <span>
                  {MODE_LABELS[match.mode]} · {TEAM_LABELS[match.teamMode]}
                </span>
                <strong className={match.outcome === 'WON' ? 'amount-in' : undefined}>
                  {match.outcome === 'WON' ? `Venceu +${formatBrl(match.prizeWon)}` : DOMINO_OUTCOME[match.outcome]}
                </strong>
              </div>
              <span className="label">
                {formatDateTime(match.playedAt)}
                {match.reason && ` · ${match.reason === 'DOMINO' ? 'terminou em batida' : 'jogo trancado'}`}
              </span>
            </li>
          ))}
      </ul>

      {active.nextCursor && (
        <button type="button" className="link" onClick={active.loadMore} disabled={active.loading}>
          {active.loading ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
