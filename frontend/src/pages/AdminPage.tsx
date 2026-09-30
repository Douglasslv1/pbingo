import { useState } from 'react';
import AdminDominoPanel from '../components/admin/AdminDominoPanel';
import AdminWithdrawalsPanel from '../components/admin/AdminWithdrawalsPanel';
import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';

type Section = 'withdrawals' | 'domino';

export default function AdminPage() {
  const { auth } = useAuth();
  const [section, setSection] = useState<Section>('withdrawals');

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        {!auth ? (
          <AuthForm />
        ) : (
          <>
            <div className="admin-sections">
              <h1>{section === 'withdrawals' ? 'Saques' : 'Mesas de domino'}</h1>
              <nav className="app-nav" aria-label="Secoes do admin">
                <button
                  type="button"
                  className={section === 'withdrawals' ? 'nav-link active' : 'nav-link'}
                  onClick={() => setSection('withdrawals')}
                >
                  Saques
                </button>
                <button
                  type="button"
                  className={section === 'domino' ? 'nav-link active' : 'nav-link'}
                  onClick={() => setSection('domino')}
                >
                  Domino
                </button>
              </nav>
            </div>
            {section === 'withdrawals' ? <AdminWithdrawalsPanel /> : <AdminDominoPanel />}
          </>
        )}
      </main>
    </div>
  );
}
