import AppHeader from '../components/AppHeader';
import GameCards from '../components/GameCards';

/** Todos os jogos num lugar so (o menu tem um item "Jogos" em vez de um link por jogo). */
export default function GamesPage() {
  return (
    <div className="app-shell games-page">
      <AppHeader />
      <main>
        <h1>Jogos</h1>
        <GameCards />
      </main>
    </div>
  );
}
