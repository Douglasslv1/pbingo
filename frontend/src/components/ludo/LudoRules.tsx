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
        <li>A energia vai liberar as habilidades, que chegam nas próximas versões.</li>
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
