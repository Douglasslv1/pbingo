import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminDominoPanel from '../components/admin/AdminDominoPanel';
import AdminBoardPanel from '../components/admin/AdminBoardPanel';
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
  { label: 'Damas', title: 'Mesas de damas', Panel: () => <AdminBoardPanel game="damas" title="Damas" /> },
  { label: 'Xadrez', title: 'Mesas de xadrez', Panel: () => <AdminBoardPanel game="xadrez" title="Xadrez" /> },
  { label: 'Ludo', title: 'Mesas de ludo', Panel: () => <AdminBoardPanel game="ludo" title="Ludo" /> },
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

  // A area e so do admin (o servidor ja recusa os dados): os demais nem veem o menu das secoes
  if (auth && auth.user.role !== 'ADMIN') return <Navigate to="/jogos" replace />;

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
