import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGameConfig } from '../hooks/useGameConfig';
import Logo from './Logo';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link';
}

/** Cabecalho comum das paginas do app: marca a esquerda e menu a direita. */
export default function AppHeader() {
  const { auth, logout } = useAuth();
  const config = useGameConfig();
  const isAdmin = auth?.user.role === 'ADMIN';
  // Liberacao gradual: enquanto desligados, so administradores veem o domino e o truco
  const showDomino = config?.dominoEnabled || isAdmin;
  const showTruco = config?.trucoEnabled || isAdmin;

  return (
    <header className="app-header">
      <Link to="/" className="brand-link" aria-label="Pbingu - página inicial">
        <Logo size={30} />
      </Link>
      <nav className="app-nav" aria-label="Menu principal">
        <NavLink to="/app" className={navClass}>
          Números da sorte
        </NavLink>
        {showDomino && (
          <NavLink to="/domino" className={navClass}>
            Dominó
          </NavLink>
        )}
        {showTruco && (
          <NavLink to="/truco" className={navClass}>
            Truco
          </NavLink>
        )}
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
    </header>
  );
}
