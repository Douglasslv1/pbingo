import { useState } from 'react';
import AdminDominoPanel from '../components/admin/AdminDominoPanel';
import AdminOverviewPanel from '../components/admin/AdminOverviewPanel';
import AdminTrucoPanel from '../components/admin/AdminTrucoPanel';
import AdminWithdrawalsPanel from '../components/admin/AdminWithdrawalsPanel';
import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';

const SECTIONS = [
  { label: 'Visão geral', title: 'Visão geral', Panel: AdminOverviewPanel },
  { label: 'Saques', title: 'Saques', Panel: AdminWithdrawalsPanel },
  { label: 'Dominó', title: 'Mesas de dominó', Panel: AdminDominoPanel },
  { label: 'Truco', title: 'Mesas de truco', Panel: AdminTrucoPanel },
];

export default function AdminPage() {
  const { auth } = useAuth();
  const [current, setCurrent] = useState(SECTIONS[0]);
  // Abas ja abertas continuam montadas (so escondidas): voltar a elas e instantaneo
  const [visited, setVisited] = useState(() => new Set([current]));
  const open = (section: (typeof SECTIONS)[number]) => {
    setCurrent(section);
    setVisited((previous) => new Set(previous).add(section));
  };

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
                    onClick={() => open(section)}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
            {SECTIONS.filter((section) => visited.has(section)).map((section) => (
              <div key={section.label} hidden={section !== current}>
                <section.Panel />
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
