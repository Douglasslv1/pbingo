import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link active' : 'nav-link';
}

/** Cabecalho comum das paginas do app: marca a esquerda e menu a direita. */
export default function AppHeader() {
  const { auth, logout } = useAuth();

  return (
    <header className="app-header">
      <Link to="/" className="brand">
        Pbingu
      </Link>
      <nav className="app-nav" aria-label="Menu principal">
        <NavLink to="/app" className={navClass}>
          Jogar
        </NavLink>
        {auth?.user.role === 'ADMIN' && (
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
