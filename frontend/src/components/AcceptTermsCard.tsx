import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';
import TermsConsentFields from './TermsConsentFields';

/** Exibido a contas que ainda nao aceitaram a versao vigente dos termos. */
export default function AcceptTermsCard() {
  const { auth, updateUser } = useAuth();
  const [birthDate, setBirthDate] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const askBirthDate = !auth?.user.hasBirthDate;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setError(null);
    setLoading(true);
    try {
      updateUser(await api.acceptTerms(auth.token, askBirthDate ? birthDate : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card">
      <h2>Antes de continuar</h2>
      <p className="hint intro-hint">
        Atualizamos nossos Termos de Uso e a Política de Privacidade. Para jogar, comprar chaves ou sacar,
        {askBirthDate ? ' confirme sua idade e aceite os documentos.' : ' aceite os documentos.'}
      </p>
      <form onSubmit={handleSubmit}>
        <TermsConsentFields
          birthDate={askBirthDate ? birthDate : undefined}
          onBirthDateChange={setBirthDate}
          accepted={accepted}
          onAcceptedChange={setAccepted}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Confirmar e continuar'}
        </button>
      </form>
    </div>
  );
}
