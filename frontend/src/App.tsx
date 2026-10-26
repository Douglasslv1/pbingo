import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ReferralCapture from './components/ReferralCapture';
import PartnerPage from './pages/PartnerPage';
import { AuthProvider } from './hooks/useAuth';
import { PlayerStatusProvider } from './hooks/usePlayerStatus';
import AdminPage from './pages/AdminPage';
import AppPage from './pages/AppPage';
import DamasPage from './pages/DamasPage';
import DominoPage from './pages/DominoPage';
import GamesPage from './pages/GamesPage';
import HomePage from './pages/HomePage';
import PrivacyPage from './pages/PrivacyPage';
import ProfilePage from './pages/ProfilePage';
import RankingPage from './pages/RankingPage';
import TournamentsPage from './pages/TournamentsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import TrucoPage from './pages/TrucoPage';
import XadrezPage from './pages/XadrezPage';
import LudoPage from './pages/LudoPage';
import RafflesPage from './pages/RafflesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ReferralCapture />
        <PlayerStatusProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/suporte" element={<SupportPage />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/rifas" element={<RafflesPage />} />
            <Route path="/parceiro" element={<PartnerPage />} />
            <Route path="/domino" element={<DominoPage />} />
            <Route path="/truco" element={<TrucoPage />} />
            <Route path="/damas" element={<DamasPage />} />
            <Route path="/xadrez" element={<XadrezPage />} />
            <Route path="/ludo" element={<LudoPage />} />
            <Route path="/jogos" element={<GamesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/torneios" element={<TournamentsPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
          </Routes>
        </PlayerStatusProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
