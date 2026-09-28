import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './hooks/useAuth';

function AppContent() {
  const { auth } = useAuth();
  return auth ? <Dashboard /> : <AuthForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <header className="app-header">
          <h1>Bingo Online</h1>
        </header>
        <main>
          <AppContent />
        </main>
      </div>
    </AuthProvider>
  );
}
