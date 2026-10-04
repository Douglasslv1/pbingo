import BoardRoom from '../components/board/BoardRoom';
import { DamasRules } from '../components/board/BoardRules';
import DamasGame from '../components/damas/DamasGame';
import { predictDamas } from '../components/board/optimisticMove';
import GamePage from '../components/GamePage';
import type { DamasAction, DamasTableView } from '../types';

export default function DamasPage() {
  return (
    <GamePage>
      <BoardRoom<DamasTableView, DamasAction>
        game="damas"
        title="Damas"
        intro="Damas pela regra brasileira: captura obrigatória, lei da maioria e dama que voa."
        Rules={DamasRules}
        Game={DamasGame}
        predict={predictDamas}
      />
    </GamePage>
  );
}
