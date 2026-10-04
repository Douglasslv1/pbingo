import BoardRoom from '../components/board/BoardRoom';
import { XadrezRules } from '../components/board/BoardRules';
import { predictXadrez } from '../components/board/optimisticMove';
import GamePage from '../components/GamePage';
import XadrezGame from '../components/xadrez/XadrezGame';
import type { XadrezAction, XadrezTableView } from '../types';

export default function XadrezPage() {
  return (
    <GamePage>
      <BoardRoom<XadrezTableView, XadrezAction>
        game="xadrez"
        title="Xadrez"
        intro="Xadrez pelas regras oficiais, com roque, en passant e promoção."
        Rules={XadrezRules}
        Game={XadrezGame}
        predict={predictXadrez}
      />
    </GamePage>
  );
}
