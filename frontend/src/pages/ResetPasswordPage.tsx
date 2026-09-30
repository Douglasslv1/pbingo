import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('As senhas nao conferem');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      // Sessoes antigas deixam de valer no servidor; limpa a deste navegador tambem
      logout();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header app-header-nav">
        <Link to="/" className="brand">
          Pbingo
        </Link>
      </header>
      <main>
        <div className="card auth-card">
          <h2>Nova senha</h2>
          {!token ? (
            <p className="error">Link invalido. Peca um novo link em "Esqueci minha senha".</p>
          ) : done ? (
            <>
              <p className="info">Senha redefinida com sucesso!</p>
              <Link to="/app" className="cta-button">
                Entrar
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <label>
                Nova senha
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirme a nova senha
                <input
                  type="password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
