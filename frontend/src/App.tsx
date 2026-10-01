import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import AdminPage from './pages/AdminPage';
import AppPage from './pages/AppPage';
import DominoPage from './pages/DominoPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SupportPage from './pages/SupportPage';
import TermsPage from './pages/TermsPage';
import TrucoPage from './pages/TrucoPage';

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
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
