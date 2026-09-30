import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';
import TermsConsentFields from './TermsConsentFields';

type Mode = 'login' | 'register' | 'forgot';

export default function AuthForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await api.forgotPassword(email);
        setInfo(result.message);
        return;
      }
      const result =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ name, email, password, birthDate, acceptTerms });
      login(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link';

  return (
    <div className="card auth-card">
      <div className="tabs">
        <button type="button" className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => switchMode('login')}>
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'tab active' : 'tab'}
          onClick={() => switchMode('register')}
        >
          Criar conta
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'forgot' && (
          <p className="hint">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
        )}
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
        {mode !== 'forgot' && (
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
        )}

        {mode === 'register' && (
          <TermsConsentFields
            birthDate={birthDate}
            onBirthDateChange={setBirthDate}
            accepted={acceptTerms}
            onAcceptedChange={setAcceptTerms}
          />
        )}

        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Aguarde...' : submitLabel}
        </button>

        {mode === 'login' && (
          <button type="button" className="link" onClick={() => switchMode('forgot')}>
            Esqueci minha senha
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link" onClick={() => switchMode('login')}>
            Voltar para o login
          </button>
        )}
      </form>
    </div>
  );
}
