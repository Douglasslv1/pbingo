import type { TrucoCard } from '../../types';
import PlayingCard from './PlayingCard';
import { MANILHA_NICKNAME, RANKS, SUIT_NAME, SUIT_SYMBOL, SUITS } from './trucoLabels';

const ORDER_EXAMPLE = RANKS.map((rank, index) => `${rank}${['E', 'C', 'P', 'O'][index % 4]}` as TrucoCard);

/** Regras completas do Truco Paulista, com exemplos desenhados. Usadas no jogo e nos Termos de Uso. */
export default function TrucoRules() {
  return (
    <div className="truco-rules">
      <h3>Objetivo</h3>
      <p>
        Fazer <strong>12 pontos</strong> antes do adversário. Joga-se em <strong>mano a mano</strong> (2 jogadores) ou em{' '}
        <strong>duplas</strong> (4 jogadores, o parceiro senta à sua frente). Usa-se um baralho de 40 cartas, sem 8, 9, 10 e
        coringas.
      </p>

      <h3>A força das cartas</h3>
      <p>Da mais fraca para a mais forte (o naipe não importa, exceto nas manilhas):</p>
      <div className="truco-rules-cards">
        {ORDER_EXAMPLE.map((card) => (
          <PlayingCard key={card} card={card} size="small" />
        ))}
      </div>

      <h3>A manilha (as cartas mais fortes)</h3>
      <p>
        Depois de distribuir 3 cartas para cada um, uma carta é virada na mesa: a <strong>vira</strong>. As{' '}
        <strong>manilhas</strong> são as cartas do valor seguinte ao da vira e ganham de todas as outras. Depois do 3, volta
        para o 4.
      </p>
      <div className="truco-rules-example">
        <span>Vira</span>
        <PlayingCard card="7O" size="small" />
        <span>→ manilhas são as damas (Q):</span>
        {SUITS.map((suit) => (
          <PlayingCard key={suit} card={`Q${suit}` as TrucoCard} size="small" manilha />
        ))}
      </div>
      <p>
        Entre as manilhas, ganha pelo naipe:{' '}
        {SUITS.map((suit, index) => (
          <span key={suit}>
            {index > 0 && ' < '}
            <strong>
              {SUIT_SYMBOL[suit]} {SUIT_NAME[suit]}
            </strong>{' '}
            ({MANILHA_NICKNAME[suit]})
          </span>
        ))}
        .
      </p>

      <h3>Rodadas e a mão</h3>
      <ul>
        <li>
          Cada <strong>mão</strong> tem até 3 rodadas. Na rodada, cada um joga uma carta e a mais forte vence. Quem vencer{' '}
          <strong>2 rodadas</strong> leva a mão e marca os pontos dela.
        </li>
        <li>
          O carteador muda a cada mão. Começa o jogador seguinte a ele na mesa; nas rodadas seguintes, começa quem venceu a anterior.
        </li>
        <li>
          <strong>Empate ("cangou")</strong>: cartas de mesmo valor de times diferentes. Empate na 1ª rodada: vence a mão
          quem ganhar a 2ª (ou a 3ª, se a 2ª também empatar). Empate na 2ª ou 3ª: vence quem ganhou a 1ª. Se as 3 empatarem,
          ninguém marca ponto. Depois de um empate, quem abriu a rodada empatada abre a próxima.
        </li>
        <li>
          <strong>Carta coberta</strong>: a partir da 2ª rodada, você pode jogar uma carta virada para baixo. Ela não vale
          nada (perde para qualquer carta) e ninguém fica sabendo qual era.
        </li>
      </ul>

      <h3>Truco: aumentando o valor da mão</h3>
      <ul>
        <li>
          Toda mão vale <strong>1 ponto</strong>. Na sua vez, antes de jogar a carta, você pode pedir{' '}
          <strong>truco</strong>: a mão passa a valer 3.
        </li>
        <li>
          O próximo jogador do outro time responde: <strong>aceitar</strong> (a mão vale 3), <strong>correr</strong> (vocês
          ganham o valor que a mão tinha antes do pedido, 1 ponto) ou <strong>aumentar</strong> para seis.
        </li>
        <li>
          Os aumentos seguem <strong>truco (3) → seis (6) → nove (9) → doze (12)</strong>, sempre alternando: quem fez o último
          aumento aceito não pode pedir o próximo. Correr entrega o valor anterior ao pedido.
        </li>
      </ul>

      <h3>Mão de onze e mão de ferro</h3>
      <ul>
        <li>
          <strong>Mão de onze</strong>: o time que chega a 11 pontos vê as cartas (nas duplas, a do parceiro também) e
          decide antes de jogar: <strong>jogar</strong> (a mão vale 3) ou <strong>correr</strong> (o adversário ganha 1).
          Nessa mão ninguém pode pedir truco.
        </li>
        <li>
          <strong>Mão de ferro</strong>: os dois times com 11. Ninguém vê as próprias cartas: cada um escolhe uma carta às
          cegas. Não há truco, e quem vencer a mão vence a partida.
        </li>
      </ul>

      <h3>Tempo e prêmio</h3>
      <ul>
        <li>
          Cada jogador tem um tempo para agir (jogar ou responder a um pedido). Se o tempo acabar, o sistema joga a carta
          mais fraca ou corre do pedido. Dois tempos esgotados seguidos marcam o jogador como ausente e o sistema passa a
          jogar por ele até ele voltar.
        </li>
        <li>
          Cada jogador entra com o valor da mesa (1, 2 ou 5 chaves). O prêmio vai para quem vencer a partida; nas duplas, é
          dividido igualmente entre os dois.
        </li>
      </ul>
    </div>
  );
}
