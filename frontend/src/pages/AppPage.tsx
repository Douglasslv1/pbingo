import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import Dashboard from '../components/Dashboard';
import { useAuth } from '../hooks/useAuth';

export default function AppPage() {
  const { auth } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />
      <main>{auth ? <Dashboard /> : <AuthForm />}</main>
    </div>
  );
}
