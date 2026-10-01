/** Regras das damas brasileiras, usadas no jogo e nos Termos de Uso. */
export function DamasRules() {
  return (
    <div className="truco-rules">
      <h3>Tabuleiro e peças</h3>
      <p>
        Tabuleiro de 8×8, jogado só nas casas escuras. Cada jogador começa com 12 pedras; as cores são sorteadas e as{' '}
        <strong>brancas começam</strong>.
      </p>
      <h3>Movimento</h3>
      <ul>
        <li>
          A <strong>pedra</strong> anda uma casa na diagonal, sempre para a frente.
        </li>
        <li>
          A pedra que termina o lance na última linha do adversário vira <strong>dama</strong>. A dama anda quantas casas
          quiser na diagonal, para frente ou para trás.
        </li>
      </ul>
      <h3>Captura</h3>
      <ul>
        <li>
          Captura-se pulando a peça adversária na diagonal até a casa vazia logo depois. A <strong>pedra captura para a
          frente e para trás</strong>; a dama captura a qualquer distância e pode parar em qualquer casa vazia depois da
          peça capturada.
        </li>
        <li>
          A <strong>captura é obrigatória</strong>. Se depois de capturar ainda der para capturar de novo, o lance
          continua (captura em sequência).
        </li>
        <li>
          <strong>Lei da maioria</strong>: havendo mais de uma captura possível, é obrigatório o caminho que captura mais
          peças (dama e pedra contam igual).
        </li>
        <li>
          As peças capturadas só saem do tabuleiro no fim do lance: não dá para pular a mesma peça duas vezes. Uma pedra
          que só passa pela última linha no meio de uma captura não vira dama.
        </li>
      </ul>
      <h3>Fim da partida</h3>
      <ul>
        <li>Vence quem deixar o adversário sem peças ou sem nenhum lance possível.</li>
        <li>Empate: 20 lances seguidos de cada lado feitos só com damas, sem nenhuma captura.</li>
        <li>Desistir ou deixar o tempo do lance acabar é derrota.</li>
      </ul>
    </div>
  );
}

/** Regras do xadrez (FIDE), usadas no jogo e nos Termos de Uso. */
export function XadrezRules() {
  return (
    <div className="truco-rules">
      <h3>Objetivo</h3>
      <p>
        Dar <strong>xeque-mate</strong>: atacar o rei adversário de forma que ele não tenha como escapar. As cores são
        sorteadas e as <strong>brancas começam</strong>.
      </p>
      <h3>As peças</h3>
      <ul>
        <li>♚ Rei: uma casa em qualquer direção. Nunca pode ficar em xeque.</li>
        <li>♛ Dama: quantas casas quiser na reta ou na diagonal.</li>
        <li>♜ Torre: quantas casas quiser na reta. ♝ Bispo: na diagonal.</li>
        <li>♞ Cavalo: em "L" (2 casas numa direção e 1 para o lado), pulando as outras peças.</li>
        <li>
          ♟ Peão: anda 1 casa para a frente (2 no primeiro lance) e captura na diagonal. Ao chegar à última linha, vira a
          peça que você escolher (dama, torre, bispo ou cavalo).
        </li>
      </ul>
      <h3>Lances especiais</h3>
      <ul>
        <li>
          <strong>Roque</strong>: o rei anda 2 casas na direção da torre, e a torre passa para o outro lado dele. Só vale se
          nenhum dos dois se moveu, se não há peças entre eles e se o rei não está, não passa nem termina em casa atacada.
        </li>
        <li>
          <strong>En passant</strong>: se um peão adversário avança 2 casas e para ao lado do seu, você pode capturá-lo
          como se tivesse andado só 1 - mas apenas no lance seguinte.
        </li>
      </ul>
      <h3>Fim da partida</h3>
      <ul>
        <li>Vitória: xeque-mate, desistência do adversário ou tempo do lance do adversário esgotado.</li>
        <li>
          Empate: <strong>afogamento</strong> (quem joga não tem lance e não está em xeque), a mesma posição 3 vezes, 50
          lances de cada lado sem captura nem movimento de peão, ou peças insuficientes para dar mate (ex.: só os reis).
        </li>
      </ul>
    </div>
  );
}
