import { Link } from 'react-router-dom';
import LegalDocument, { CONTACT_EMAIL, LegalSection } from '../components/LegalDocument';
import { formatBrl } from '../format';
import { useGameConfig } from '../hooks/useGameConfig';

// Valores usados enquanto as regras do servidor carregam (os mesmos padroes do backend)
const FALLBACK = {
  creditPriceBrl: 3.5,
  houseFeePercent: 20,
  minPlayersPerRound: 5,
  roundIntervalMinutes: 15,
  termsVersion: '2026-09-30.2',
  dominoTurnSeconds: 30,
  dominoQueueTimeoutMinutes: 10,
};

export default function TermsPage() {
  const config = { ...FALLBACK, ...useGameConfig() };
  const prizeShare = 100 - config.houseFeePercent;

  const sections: LegalSection[] = [
    {
      title: 'Quem pode usar o Pbingu',
      content: (
        <ul>
          <li>
            <strong>O Pbingu é proibido para menores de 18 anos.</strong> Ao criar a conta você declara sua data de
            nascimento, que confirma a maioridade.
          </li>
          <li>Cada pessoa pode ter apenas uma conta, com dados verdadeiros e atualizados.</li>
          <li>Você é responsável por manter sua senha em sigilo e por tudo o que for feito com a sua conta.</li>
        </ul>
      ),
    },
    {
      title: 'Chaves',
      content: (
        <ul>
          <li>
            Chaves são créditos de participação comprados via Pix, ao preço de {formatBrl(config.creditPriceBrl)} cada.
            Cada chave permite entrar em uma rodada dos Números da sorte (com uma cartela) ou em uma mesa de Dominó.
          </li>
          <li>Chaves não podem ser sacadas nem transferidas para outra conta.</li>
          <li>
            Chaves não utilizadas podem ser reembolsadas mediante pedido pelo nosso canal de contato, nos termos do Código
            de Defesa do Consumidor.
          </li>
          <li>A compra só é concluída quando o Mercado Pago confirma o pagamento do Pix.</li>
        </ul>
      ),
    },
    {
      title: 'Como funcionam os Números da sorte',
      content: (
        <ul>
          <li>
            As rodadas acontecem em horários fixos, a cada {config.roundIntervalMinutes} minutos. Antes do horário, a sala
            fica aberta para entrada e você pode sair recuperando a sua chave.
          </li>
          <li>
            A rodada só começa com pelo menos {config.minPlayersPerRound} jogadores diferentes. Se o mínimo não for
            atingido até o horário, ela é cancelada e todas as chaves são devolvidas.
          </li>
          <li>
            Os números de 1 a 75 são sorteados automaticamente pelo servidor, com gerador aleatório criptográfico, e
            transmitidos em tempo real. Ninguém, nem a equipe do Pbingu, escolhe os números.
          </li>
          <li>
            Vence quem completar primeiro todos os números da cartela. Se mais de uma cartela completar no mesmo número, o
            prêmio é dividido igualmente entre elas.
          </li>
          <li>
            De cada cartela, {prizeShare}% do valor vai para o prêmio da rodada e {config.houseFeePercent}% fica com o
            Pbingu como taxa de serviço.
          </li>
          <li>
            Se a rodada for interrompida por falha técnica, ela é retomada de onde parou assim que o sistema volta, sem
            perda para os jogadores.
          </li>
        </ul>
      ),
    },
    {
      title: 'Como funciona o Dominó',
      content: (
        <ul>
          <li>
            As mesas são de 4 jogadores. Você entra com 1 chave e a partida começa assim que a mesa completar. Se ela não
            completar em {config.dominoQueueTimeoutMinutes} minutos, é cancelada e todas as chaves são devolvidas. Antes do
            início, você pode sair e recuperar a sua chave.
          </li>
          <li>
            Modalidades: <strong>6 peças</strong> (cada jogador recebe 6 pedras e as 4 restantes ficam fora do jogo) e{' '}
            <strong>Burrinho</strong> (as 4 restantes formam o monte, e quem não tem pedra que encaixe compra até poder
            jogar). Formatos: <strong>individual</strong> ou <strong>em duplas</strong>, com o parceiro sentado à sua
            frente.
          </li>
          <li>
            As 28 pedras são embaralhadas pelo servidor com gerador aleatório criptográfico. Começa quem tiver a maior
            carroça distribuída, jogando essa carroça.
          </li>
          <li>
            Vence quem bater (jogar a última pedra da mão) - nas duplas, a dupla inteira vence. Se ninguém mais puder jogar
            (jogo trancado), vence a menor soma de pontos na mão (a soma da dupla, nas duplas). Empates dividem o prêmio
            igualmente.
          </li>
          <li>
            De cada entrada, {prizeShare}% vai para o prêmio da mesa e {config.houseFeePercent}% fica com o Pbingu como
            taxa de serviço.
          </li>
          <li>
            Cada jogador tem {config.dominoTurnSeconds} segundos por jogada. Quando não há pedra que encaixe, o sistema
            passa ou compra automaticamente. Se o tempo acabar, o sistema joga por você a maior pedra que encaixa.
          </li>
          <li>
            Depois de 2 tempos esgotados seguidos, você é marcado como ausente e o sistema passa a jogar por você até o fim
            da partida - a qualquer momento você pode voltar e retomar o controle. Desconexões não pausam a partida, e sair
            no meio dela não devolve a chave.
          </li>
          <li>
            Todas as jogadas ficam registradas. Em caso de reclamação, nossa equipe pode consultar as mãos e as jogadas da
            partida para apurar o que aconteceu.
          </li>
        </ul>
      ),
    },
    {
      title: 'Prêmios e saques',
      content: (
        <ul>
          <li>O prêmio ganho vai para o seu saldo de prêmios, que pode ser sacado via Pix.</li>
          <li>
            O saque é feito para uma chave Pix cadastrada no mesmo CPF informado no pedido. Pedidos com dados divergentes
            podem ser recusados, e nesse caso o valor volta integralmente para o seu saldo.
          </li>
          <li>Os saques são conferidos e pagos pela nossa equipe, normalmente em até 2 dias úteis.</li>
          <li>Podemos pedir documentos para confirmar sua identidade antes de pagar um saque.</li>
        </ul>
      ),
    },
    {
      title: 'Condutas proibidas',
      content: (
        <>
          <p>Não é permitido:</p>
          <ul>
            <li>criar mais de uma conta ou usar dados, CPF ou chave Pix de outra pessoa;</li>
            <li>usar robôs, scripts ou qualquer automação para jogar;</li>
            <li>explorar falhas do sistema ou tentar interferir no sorteio;</li>
            <li>
              no Dominó, combinar jogadas ou trocar informações sobre as pedras com outros jogadores da mesa (por
              mensagem, ligação ou qualquer outro meio), inclusive com o parceiro de dupla;
            </li>
            <li>usar o Pbingu para lavagem de dinheiro ou qualquer atividade ilegal.</li>
          </ul>
          <p>
            Nesses casos a conta pode ser suspensa ou encerrada, e prêmios obtidos de forma irregular podem ser retidos
            enquanto o caso é apurado.
          </p>
        </>
      ),
    },
    {
      title: 'Jogo responsável',
      content: (
        <ul>
          <li>Jogue apenas com dinheiro que você pode perder. Os jogos são entretenimento, não uma fonte de renda.</li>
          <li>
            Se quiser uma pausa ou encerrar sua conta para evitar jogar, peça pelo e-mail{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> e atenderemos o quanto antes.
          </li>
          <li>
            Se sentir que o jogo está fora de controle, procure ajuda. O CVV atende gratuitamente pelo telefone 188.
          </li>
        </ul>
      ),
    },
    {
      title: 'Disponibilidade e responsabilidades',
      content: (
        <p>
          Trabalhamos para manter o Pbingu no ar e seguro, mas o serviço pode passar por interrupções para manutenção ou
          por falhas de terceiros (internet, hospedagem, meio de pagamento). Não nos responsabilizamos por perdas
          causadas por problemas no seu aparelho ou conexão. Nenhuma disposição destes termos afasta os direitos que
          você tem pelo Código de Defesa do Consumidor.
        </p>
      ),
    },
    {
      title: 'Seus dados',
      content: (
        <p>
          O tratamento dos seus dados pessoais está descrito na nossa{' '}
          <Link to="/privacidade">Política de Privacidade</Link>, que faz parte destes termos.
        </p>
      ),
    },
    {
      title: 'Mudanças nestes termos',
      content: (
        <p>
          Podemos atualizar estes termos. Quando isso acontecer, a data da versão no topo muda e você precisará aceitar a
          nova versão antes de continuar jogando.
        </p>
      ),
    },
    {
      title: 'Contato e legislação',
      content: (
        <p>
          Fale com a gente pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Estes termos seguem a
          legislação brasileira.
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      title="Termos de Uso"
      version={config.termsVersion}
      intro={
        <p>
          Estes termos explicam as regras para usar o Pbingu, plataforma de jogos online (Números da sorte e Dominó) com
          prêmios em dinheiro. Ao criar sua conta, você concorda com eles.
        </p>
      }
      sections={sections}
    />
  );
}
