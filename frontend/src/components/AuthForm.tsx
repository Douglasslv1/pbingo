import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';

type Mode = 'login' | 'register';

export default function AuthForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'login' ? await api.login({ email, password }) : await api.register({ name, email, password });
      login(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexao com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card">
      <div className="tabs">
        <button type="button" className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'tab active' : 'tab'}
          onClick={() => setMode('register')}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
        )}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
