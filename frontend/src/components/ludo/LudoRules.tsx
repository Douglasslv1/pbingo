/** Regras do Ludo, usadas no jogo e nos Termos de Uso. */
export default function LudoRules() {
  return (
    <div className="truco-rules">
      <h3>Objetivo</h3>
      <p>
        Cada jogador tem 4 peças na sua base. Vence quem levar primeiro as <strong>4 peças ao centro</strong> do tabuleiro.
      </p>
      <h3>Na sua vez</h3>
      <ul>
        <li>Jogue o dado e escolha uma peça para andar o número que saiu.</li>
        <li>
          A peça só <strong>sai da base com um 6</strong>, direto para a casa de saída da sua cor.
        </li>
        <li>
          As peças dão a volta no tabuleiro e sobem pela <strong>reta final da sua cor</strong>. Para chegar ao centro é
          preciso o número exato.
        </li>
        <li>Se nenhuma peça puder andar com o número que saiu, a vez passa sozinha.</li>
        <li>
          Tirou <strong>6</strong>, capturou uma peça ou chegou ao centro? Jogue de novo. Três 6 seguidos perdem a vez.
        </li>
      </ul>
      <h3>Captura e casas seguras</h3>
      <ul>
        <li>Parar na casa de uma peça adversária a manda de volta para a base dela.</li>
        <li>
          Não há captura nas <strong>casas seguras</strong>: as casas de saída (coloridas) e as marcadas com ★. Duas peças
          da mesma cor na mesma casa também se protegem.
        </li>
      </ul>
      <h3>Arena: energia</h3>
      <ul>
        <li>
          Na modalidade <strong>Arena</strong>, cada jogador junta <strong>energia</strong> ⚡, de 0 a 10.
        </li>
        <li>Ganha 1 de energia por peça adversária capturada e 1 ao parar numa casa ⚡ (só passar por ela não conta).</li>
        <li>Quem tem a peça capturada também ganha 1 de energia, para voltar ao jogo.</li>
      </ul>
      <h3>Arena: habilidades</h3>
      <ul>
        <li>
          Na sua vez, gaste energia numa habilidade. É <strong>uma habilidade por vez</strong> (as jogadas extras do 6
          contam como a mesma vez).
        </li>
        <li>
          🛡️ <strong>Escudo</strong> (2): protege uma peça contra captura até a sua próxima vez.
        </li>
        <li>
          🚀 <strong>Impulso</strong> (2): depois do dado, soma 2 casas ao movimento (não vale para sair da base).
        </li>
        <li>
          🧲 <strong>Puxão</strong> (3): uma peça adversária volta 2 casas. Não vale em casa segura nem em peça com escudo.
        </li>
        <li>
          🔄 <strong>Troca</strong> (3): troca de lugar duas peças suas que estão na volta do tabuleiro.
        </li>
        <li>
          🎲 <strong>Segunda chance</strong> (4): depois do dado, joga de novo; o novo número vale.
        </li>
        <li>
          💨 <strong>Fuga</strong> (3): arma uma peça; se ela for capturada, volta 3 casas em vez de ir para a base. Vale
          até ser usada.
        </li>
        <li>
          Se nenhuma peça puder andar mas uma habilidade puder ajudar, a vez espera você decidir: use a habilidade ou
          passe a vez.
        </li>
      </ul>
      <h3>Arena: personagens</h3>
      <ul>
        <li>
          Antes do primeiro dado, cada jogador escolhe um personagem, pela ordem da mesa. Nenhum é melhor que os outros:
          cada um é um estilo de jogo.
        </li>
        <li>
          🏃 <strong>Corredor</strong>: Arrancada, uma vez por partida, soma 3 casas a um movimento.
        </li>
        <li>
          🏰 <strong>Guardião</strong>: Fortificar, uma vez por partida, arma uma peça que ignora a próxima captura e
          fica onde está.
        </li>
        <li>
          🏹 <strong>Caçador</strong>: cada captura dá 1 de energia a mais.
        </li>
        <li>
          🃏 <strong>Trapaceiro</strong>: Truque, uma vez por partida, troca de lugar duas peças suas sem gastar energia.
        </li>
        <li>Os poderes não gastam energia, mas contam como a habilidade da vez.</li>
      </ul>
      <h3>Arena: ultimate</h3>
      <ul>
        <li>
          A <strong>carga da ultimate</strong> 🔥 vai de 0 a 10: +1 por movimento, +2 por captura, +2 quando sua peça é
          capturada e +2 por peça que chega ao centro.
        </li>
        <li>
          Com a carga cheia, use a ultimate do seu personagem. Ela zera a carga e conta como a habilidade da vez.
        </li>
        <li>
          🏃 Corredor, <strong>Velocidade máxima</strong>: antes de jogar o dado, joga dois dados e você escolhe qual usar.
        </li>
        <li>
          🏰 Guardião, <strong>Fortaleza</strong>: todas as suas peças na volta do tabuleiro ganham escudo até a sua
          próxima vez.
        </li>
        <li>
          🏹 Caçador, <strong>Caçada</strong>: nesta vez, cada captura dá +3 casas no movimento seguinte (até 2 capturas).
        </li>
        <li>
          🃏 Trapaceiro, <strong>Caos</strong>: troca de lugar uma peça sua com uma adversária, ambas na volta do tabuleiro.
          Não vale em casa segura, em peça com escudo nem se uma delas passaria da entrada da reta final.
        </li>
      </ul>
      <h3>Tempo e dados verificáveis</h3>
      <ul>
        <li>Cada ação (jogar o dado ou mover) tem 30 segundos. Se o tempo acabar, o sistema joga por você.</li>
        <li>
          Os dados saem de uma semente secreta sorteada pelo servidor no início da partida. Durante o jogo você vê o código
          (SHA-256) dela; no fim, a semente é revelada e qualquer um confere que nenhum dado foi alterado.
        </li>
      </ul>
    </div>
  );
}
