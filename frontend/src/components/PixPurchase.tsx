import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useGameConfig } from '../hooks/useGameConfig';

interface Charge {
  transactionId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
}

interface Props {
  onWalletChange: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export default function PixPurchase({ onWalletChange }: Props) {
  const { auth } = useAuth();
  const config = useGameConfig();
  const [creditsAmount, setCreditsAmount] = useState(10);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(transactionId: string) {
    if (!auth) return;
    const startedAt = Date.now();
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.getPixChargeStatus(auth.token, transactionId);

        if (result.status === 'COMPLETED') {
          stopPolling();
          setCharge(null);
          await onWalletChange();
        } else if (result.status === 'FAILED') {
          stopPolling();
          setCharge(null);
          setError('Pagamento nao aprovado. Tente gerar uma nova cobranca.');
        } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
        }
      } catch {
        // falha transitoria de rede durante o polling: tenta novamente no proximo ciclo
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleCreateCharge(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await api.createPixCharge(auth.token, creditsAmount);
      setCharge({
        transactionId: result.transactionId,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
      });
      startPolling(result.transactionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar cobranca Pix');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!charge?.qrCode) return;
    await navigator.clipboard.writeText(charge.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCancel() {
    stopPolling();
    setCharge(null);
  }

  if (charge) {
    return (
      <div className="pix-charge">
        {charge.qrCodeBase64 && (
          <img className="pix-qr" src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="QR Code Pix" />
        )}
        {charge.qrCode && (
          <div className="pix-copy">
            <textarea readOnly value={charge.qrCode} rows={3} />
            <button type="button" onClick={handleCopy}>
              {copied ? 'Copiado!' : 'Copiar codigo'}
            </button>
          </div>
        )}
        <p className="info">Aguardando confirmacao do pagamento...</p>
        <button type="button" className="link" onClick={handleCancel}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreateCharge}>
      <label>
        Comprar chaves via Pix
        <input type="number" min={1} value={creditsAmount} onChange={(e) => setCreditsAmount(Number(e.target.value))} />
      </label>
      {config && (
        <p className="hint">
          {formatBrl(config.creditPriceBrl)} por chave - total <strong>{formatBrl(creditsAmount * config.creditPriceBrl)}</strong>
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Gerando cobranca...' : 'Gerar cobranca Pix'}
      </button>
    </form>
  );
}
