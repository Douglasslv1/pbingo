import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import AcceptTermsCard from '../AcceptTermsCard';
import AppHeader from '../AppHeader';
import AuthForm from '../AuthForm';

/** Moldura das paginas de jogos de mesa: so mostra o jogo para quem entrou e aceitou os termos. */
export default function TablePage({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  return (
    <div className="app-shell">
      <AppHeader />
      <main>{!auth ? <AuthForm /> : auth.user.termsAccepted === false ? <AcceptTermsCard /> : children}</main>
    </div>
  );
}
