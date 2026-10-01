import { useState } from 'react';
import AdminDominoPanel from '../components/admin/AdminDominoPanel';
import AdminOverviewPanel from '../components/admin/AdminOverviewPanel';
import AdminWithdrawalsPanel from '../components/admin/AdminWithdrawalsPanel';
import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';

const SECTIONS = [
  { label: 'Visão geral', title: 'Visão geral', Panel: AdminOverviewPanel },
  { label: 'Saques', title: 'Saques', Panel: AdminWithdrawalsPanel },
  { label: 'Dominó', title: 'Mesas de dominó', Panel: AdminDominoPanel },
];

export default function AdminPage() {
  const { auth } = useAuth();
  const [current, setCurrent] = useState(SECTIONS[0]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        {!auth ? (
          <AuthForm />
        ) : (
          <>
            <div className="admin-sections">
              <h1>{current.title}</h1>
              <nav className="app-nav" aria-label="Seções do admin">
                {SECTIONS.map((section) => (
                  <button
                    key={section.label}
                    type="button"
                    className={section === current ? 'nav-link active' : 'nav-link'}
                    onClick={() => setCurrent(section)}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
            <current.Panel />
          </>
        )}
      </main>
    </div>
  );
}
