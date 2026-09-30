import type { Withdrawal } from '../types';
import { formatDateTime, WITHDRAWAL_STATUS_LABELS } from '../withdrawalFormat';

interface Props {
  withdrawals: Withdrawal[];
}

export default function WithdrawalHistory({ withdrawals }: Props) {
  if (withdrawals.length === 0) {
    return null;
  }

  return (
    <div className="withdrawal-history">
      <h3>Meus saques</h3>
      <ul>
        {withdrawals.map((withdrawal) => (
          <li key={withdrawal.id}>
            <div className="withdrawal-row">
              <span>R$ {Number(withdrawal.amountFiat).toFixed(2)}</span>
              <span className={`status-chip status-${withdrawal.status.toLowerCase()}`}>
                {WITHDRAWAL_STATUS_LABELS[withdrawal.status]}
              </span>
            </div>
            <span className="label">{formatDateTime(withdrawal.createdAt)}</span>
            {withdrawal.status === 'REJECTED' && withdrawal.rejectionReason && (
              <span className="label">Motivo: {withdrawal.rejectionReason} (valor devolvido ao saldo)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
