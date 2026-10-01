import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AcceptTermsCard from './AcceptTermsCard';
import AppHeader from './AppHeader';
import AuthForm from './AuthForm';

/** Moldura das paginas de jogos: so mostra o jogo para quem entrou e aceitou os termos. */
export default function GamePage({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const ready = auth && auth.user.termsAccepted !== false;

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        {ready && auth.user.nickname === null && (
          <p className="banner nickname-nudge">
            Escolha seu apelido: é ele que aparece para os outros jogadores e no ranking.{' '}
            <Link to="/perfil">Escolher apelido</Link>
          </p>
        )}
        {!auth ? <AuthForm /> : ready ? children : <AcceptTermsCard />}
      </main>
    </div>
  );
}
