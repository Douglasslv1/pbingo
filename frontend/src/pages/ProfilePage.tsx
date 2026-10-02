import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import GamePage from '../components/GamePage';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import type { Profile } from '../types';

const GAMES = [
  { key: 'TRUCO', label: 'Truco', unit: 'partidas' },
  { key: 'DOMINO', label: 'Dominó', unit: 'partidas' },
  { key: 'DAMAS', label: 'Damas', unit: 'partidas' },
  { key: 'XADREZ', label: 'Xadrez', unit: 'partidas' },
  { key: 'LUDO', label: 'Ludo', unit: 'partidas' },
  { key: 'BINGO', label: 'Números da sorte', unit: 'rodadas' },
] as const;

function NicknameForm({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const { auth, updateUser } = useAuth();
  const [nickname, setNickname] = useState(profile.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = profile.nicknameChangeAt !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.setNickname(auth.token, nickname);
      onSaved(saved);
      updateUser({ ...auth.user, nickname: saved.nickname });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o apelido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Seu apelido</h2>
      <p className="hint intro-hint">
        É o nome que os outros jogadores veem nas mesas e no ranking. Seu nome real ({profile.name}) nunca aparece para
        eles.
      </p>
      <label>
        Apelido
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          minLength={3}
          maxLength={20}
          placeholder="ex.: Rei_do_Zap"
          disabled={locked}
          required
        />
      </label>
      <p className="hint">
        De 3 a 20 caracteres: letras, números, "_", "." ou "-", sem espaços. Depois de escolhido, só pode ser trocado uma vez
        a cada 30 dias.
      </p>
      {locked ? (
        <p className="label">
          Você poderá trocar o apelido a partir de {new Date(profile.nicknameChangeAt!).toLocaleDateString('pt-BR')}.
        </p>
      ) : (
        <button type="submit" disabled={saving || nickname.trim() === (profile.nickname ?? '')}>
          {saving ? 'Salvando...' : profile.nickname ? 'Trocar apelido' : 'Salvar apelido'}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function ProfileContent() {
  const { auth } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api
      .getProfile(auth.token)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar o perfil'));
  }, [auth]);

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <div className="card">Carregando...</div>;

  return (
    <>
      <div className="card profile-header">
        <h1>{profile.displayName}</h1>
        <p className="label">
          {profile.email} · jogando desde {new Date(profile.memberSince).toLocaleDateString('pt-BR')}
        </p>
      </div>

      <NicknameForm profile={profile} onSaved={setProfile} />

      <div className="card">
        <h2>Seus números</h2>
        <p className="hint intro-hint">
          Os prêmios aparecem só aqui, para você. No <Link to="/ranking">ranking</Link> os outros jogadores veem apenas
          vitórias e partidas.
        </p>
        <div className="admin-overview">
          {GAMES.map(({ key, label, unit }) => {
            const stats = profile.games[key];
            const rate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
            return (
              <section key={key}>
                <h3>{label}</h3>
                <div className="round-stats">
                  <div>
                    <span className="label">Vitórias</span>
                    <strong>{stats.wins}</strong>
                    <span className="label">
                      de {stats.matches} {unit} ({rate}%)
                    </span>
                  </div>
                  <div>
                    <span className="label">Prêmios recebidos</span>
                    <strong>{formatBrl(stats.prizes)}</strong>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <GamePage>
      <ProfileContent />
    </GamePage>
  );
}
