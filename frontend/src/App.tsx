import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import AdminPage from './pages/AdminPage';
import AppPage from './pages/AppPage';
import DamasPage from './pages/DamasPage';
import DominoPage from './pages/DominoPage';
import GamesPage from './pages/GamesPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import ProfilePage from './pages/ProfilePage';
import RankingPage from './pages/RankingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import TrucoPage from './pages/TrucoPage';
import XadrezPage from './pages/XadrezPage';
import LudoPage from './pages/LudoPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/suporte" element={<SupportPage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/domino" element={<DominoPage />} />
          <Route path="/truco" element={<TrucoPage />} />
          <Route path="/damas" element={<DamasPage />} />
          <Route path="/xadrez" element={<XadrezPage />} />
          <Route path="/ludo" element={<LudoPage />} />
          <Route path="/jogos" element={<GamesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
