import { Link } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import Dashboard from '../components/Dashboard';
import { useAuth } from '../hooks/useAuth';

export default function AppPage() {
  const { auth } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header app-header-nav">
        <Link to="/" className="brand">
          Pbingo
        </Link>
        <Link to="/suporte" className="link">
          Suporte
        </Link>
      </header>
      <main>{auth ? <Dashboard /> : <AuthForm />}</main>
    </div>
  );
}
