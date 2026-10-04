import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';
import TournamentBanner from './TournamentBanner';
import VenoxBadge from './VenoxBadge';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link';
}

/** Cabecalho comum das paginas do app: marca a esquerda e menu a direita. */
export default function AppHeader() {
  const { auth, logout } = useAuth();
  const isAdmin = auth?.user.role === 'ADMIN';

  return (
    <header className="app-header">
      <Link to="/" className="brand-link" aria-label="Pbingu - página inicial">
        <Logo size={30} />
      </Link>
      <nav className="app-nav" aria-label="Menu principal">
        {auth && <VenoxBadge />}
        <NavLink to="/jogos" className={navClass}>
          Jogos
        </NavLink>
        <NavLink to="/app" className={navClass}>
          Carteira
        </NavLink>
        <NavLink to="/torneios" className={navClass}>
          Torneios
        </NavLink>
        <NavLink to="/ranking" className={navClass}>
          Ranking
        </NavLink>
        {auth && (
          <NavLink to="/perfil" className={navClass}>
            Perfil
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin" className={navClass}>
            Admin
          </NavLink>
        )}
        <NavLink to="/suporte" className={navClass}>
          Suporte
        </NavLink>
        {auth && (
          <button type="button" className="nav-link" onClick={logout}>
            Sair
          </button>
        )}
      </nav>
      {auth && <TournamentBanner />}
    </header>
  );
}
