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
  termsVersion: '2026-09-30',
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
            <strong>O Pbingu e proibido para menores de 18 anos.</strong> Ao criar a conta voce declara sua data de
            nascimento, que confirma a maioridade.
          </li>
          <li>Cada pessoa pode ter apenas uma conta, com dados verdadeiros e atualizados.</li>
          <li>Voce e responsavel por manter sua senha em sigilo e por tudo o que for feito com a sua conta.</li>
        </ul>
      ),
    },
    {
      title: 'Chaves',
      content: (
        <ul>
          <li>
            Chaves sao creditos de participacao comprados via Pix, ao preco de {formatBrl(config.creditPriceBrl)} cada.
            Cada chave permite entrar em uma rodada com uma cartela.
          </li>
          <li>Chaves nao podem ser sacadas nem transferidas para outra conta.</li>
          <li>
            Chaves nao utilizadas podem ser reembolsadas mediante pedido pelo nosso canal de contato, nos termos do Codigo
            de Defesa do Consumidor.
          </li>
          <li>A compra so e concluida quando o Mercado Pago confirma o pagamento do Pix.</li>
        </ul>
      ),
    },
    {
      title: 'Como funcionam os Numeros da sorte',
      content: (
        <ul>
          <li>
            As rodadas acontecem em horarios fixos, a cada {config.roundIntervalMinutes} minutos. Antes do horario, a sala
            fica aberta para entrada e voce pode sair recuperando a sua chave.
          </li>
          <li>
            A rodada so comeca com pelo menos {config.minPlayersPerRound} jogadores diferentes. Se o minimo nao for
            atingido ate o horario, ela e cancelada e todas as chaves sao devolvidas.
          </li>
          <li>
            Os numeros de 1 a 75 sao sorteados automaticamente pelo servidor, com gerador aleatorio criptografico, e
            transmitidos em tempo real. Ninguem, nem a equipe do Pbingu, escolhe os numeros.
          </li>
          <li>
            Vence quem completar primeiro todos os numeros da cartela. Se mais de uma cartela completar no mesmo numero, o
            premio e dividido igualmente entre elas.
          </li>
          <li>
            De cada cartela, {prizeShare}% do valor vai para o premio da rodada e {config.houseFeePercent}% fica com o
            Pbingu como taxa de servico.
          </li>
          <li>
            Se a rodada for interrompida por falha tecnica, ela e retomada de onde parou assim que o sistema volta, sem
            perda para os jogadores.
          </li>
        </ul>
      ),
    },
    {
      title: 'Premios e saques',
      content: (
        <ul>
          <li>O premio ganho vai para o seu saldo de premios, que pode ser sacado via Pix.</li>
          <li>
            O saque e feito para uma chave Pix cadastrada no mesmo CPF informado no pedido. Pedidos com dados divergentes
            podem ser recusados, e nesse caso o valor volta integralmente para o seu saldo.
          </li>
          <li>Os saques sao conferidos e pagos pela nossa equipe, normalmente em ate 2 dias uteis.</li>
          <li>Podemos pedir documentos para confirmar sua identidade antes de pagar um saque.</li>
        </ul>
      ),
    },
    {
      title: 'Condutas proibidas',
      content: (
        <>
          <p>Nao e permitido:</p>
          <ul>
            <li>criar mais de uma conta ou usar dados, CPF ou chave Pix de outra pessoa;</li>
            <li>usar robos, scripts ou qualquer automacao para jogar;</li>
            <li>explorar falhas do sistema ou tentar interferir no sorteio;</li>
            <li>usar o Pbingu para lavagem de dinheiro ou qualquer atividade ilegal.</li>
          </ul>
          <p>
            Nesses casos a conta pode ser suspensa ou encerrada, e premios obtidos de forma irregular podem ser retidos
            enquanto o caso e apurado.
          </p>
        </>
      ),
    },
    {
      title: 'Jogo responsavel',
      content: (
        <ul>
          <li>Jogue apenas com dinheiro que voce pode perder. Os jogos sao entretenimento, nao uma fonte de renda.</li>
          <li>
            Se quiser uma pausa ou encerrar sua conta para evitar jogar, peca pelo e-mail{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> e atenderemos o quanto antes.
          </li>
          <li>
            Se sentir que o jogo esta fora de controle, procure ajuda. O CVV atende gratuitamente pelo telefone 188.
          </li>
        </ul>
      ),
    },
    {
      title: 'Disponibilidade e responsabilidades',
      content: (
        <p>
          Trabalhamos para manter o Pbingu no ar e seguro, mas o servico pode passar por interrupcoes para manutencao ou
          por falhas de terceiros (internet, hospedagem, meio de pagamento). Nao nos responsabilizamos por perdas
          causadas por problemas no seu aparelho ou conexao. Nenhuma disposicao destes termos afasta os direitos que
          voce tem pelo Codigo de Defesa do Consumidor.
        </p>
      ),
    },
    {
      title: 'Seus dados',
      content: (
        <p>
          O tratamento dos seus dados pessoais esta descrito na nossa{' '}
          <Link to="/privacidade">Politica de Privacidade</Link>, que faz parte destes termos.
        </p>
      ),
    },
    {
      title: 'Mudancas nestes termos',
      content: (
        <p>
          Podemos atualizar estes termos. Quando isso acontecer, a data da versao no topo muda e voce precisara aceitar a
          nova versao antes de continuar jogando.
        </p>
      ),
    },
    {
      title: 'Contato e legislacao',
      content: (
        <p>
          Fale com a gente pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Estes termos seguem a
          legislacao brasileira.
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
          Estes termos explicam as regras para usar o Pbingu, plataforma de jogos online (Numeros da sorte e Domino) com
          premios em dinheiro. Ao criar sua conta, voce concorda com eles.
        </p>
      }
      sections={sections}
    />
  );
}
