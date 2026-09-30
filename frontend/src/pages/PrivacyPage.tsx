import LegalDocument, { CONTACT_EMAIL, LegalSection } from '../components/LegalDocument';
import { useGameConfig } from '../hooks/useGameConfig';

export default function PrivacyPage() {
  const version = useGameConfig()?.termsVersion ?? '2026-09-30';
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  const sections: LegalSection[] = [
    {
      title: 'Quem cuida dos seus dados',
      content: (
        <p>
          O Pbingu e o controlador dos dados pessoais tratados na plataforma, nos termos da Lei Geral de Protecao de Dados
          (Lei 13.709/2018 - LGPD). Para qualquer assunto sobre seus dados, inclusive com o encarregado, escreva para{' '}
          {email}.
        </p>
      ),
    },
    {
      title: 'Quais dados coletamos',
      content: (
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail, data de nascimento e senha (guardada apenas de forma criptografada,
            nunca em texto).
          </li>
          <li>
            <strong>Saques:</strong> CPF e chave Pix informados em cada pedido.
          </li>
          <li>
            <strong>Movimentacoes e jogo:</strong> compras de chaves, cartelas, rodadas, premios, saques e devolucoes.
          </li>
          <li>
            <strong>Dados tecnicos:</strong> endereco IP, data e hora de acesso e registros de erro.
          </li>
          <li>
            <strong>Pagamentos:</strong> o Pix e processado pelo Mercado Pago. Nao recebemos dados da sua conta bancaria,
            apenas a confirmacao do pagamento.
          </li>
        </ul>
      ),
    },
    {
      title: 'Para que usamos e com qual base legal',
      content: (
        <ul>
          <li>
            <strong>Criar e manter sua conta, rodar as partidas, creditar premios e pagar saques</strong> - execucao do
            contrato (art. 7, V da LGPD).
          </li>
          <li>
            <strong>Confirmar que voce e maior de idade</strong> - execucao do contrato e cumprimento de obrigacao legal
            (art. 7, II e V).
          </li>
          <li>
            <strong>Guardar registros financeiros e de acesso</strong> - cumprimento de obrigacao legal (art. 7, II),
            incluindo o Marco Civil da Internet.
          </li>
          <li>
            <strong>Seguranca, prevencao a fraudes e limite de tentativas de acesso</strong> - legitimo interesse (art. 7,
            IX) e protecao do credito.
          </li>
          <li>
            <strong>Enviar e-mails de servico</strong>, como a redefinicao de senha - execucao do contrato. Nao enviamos
            publicidade.
          </li>
        </ul>
      ),
    },
    {
      title: 'Com quem compartilhamos',
      content: (
        <>
          <p>Nao vendemos seus dados. Eles sao compartilhados apenas com quem precisamos para operar o servico:</p>
          <ul>
            <li>
              <strong>Mercado Pago</strong> - processamento dos pagamentos via Pix.
            </li>
            <li>
              <strong>Brevo</strong> - envio dos e-mails de servico.
            </li>
            <li>
              <strong>Railway</strong> - hospedagem do sistema e do banco de dados.
            </li>
            <li>
              <strong>Autoridades</strong> - quando houver obrigacao legal ou ordem judicial.
            </li>
          </ul>
          <p>
            Alguns desses fornecedores mantem servidores fora do Brasil. Nesses casos, a transferencia internacional
            ocorre para a execucao do contrato com voce (art. 33, IX da LGPD), com fornecedores que adotam medidas de
            seguranca compativeis com a lei.
          </p>
        </>
      ),
    },
    {
      title: 'Por quanto tempo guardamos',
      content: (
        <ul>
          <li>Dados da conta: enquanto ela estiver ativa.</li>
          <li>
            Registros de acesso (IP, data e hora): 6 meses, como exige o Marco Civil da Internet (Lei 12.965/2014).
          </li>
          <li>
            Registros financeiros (compras, premios e saques, com CPF e chave Pix): pelo prazo exigido pela legislacao,
            mesmo apos o encerramento da conta.
          </li>
          <li>Depois desses prazos, os dados sao eliminados ou anonimizados.</li>
        </ul>
      ),
    },
    {
      title: 'Como protegemos',
      content: (
        <ul>
          <li>Toda a comunicacao com o Pbingu e criptografada (HTTPS).</li>
          <li>Senhas sao guardadas com criptografia de mao unica (bcrypt) e nunca podem ser lidas por ninguem.</li>
          <li>O acesso ao banco de dados e restrito, e os dados de saque so sao vistos por quem processa o pagamento.</li>
          <li>Ao trocar a senha, todas as sessoes abertas em outros aparelhos sao encerradas.</li>
        </ul>
      ),
    },
    {
      title: 'Seus direitos',
      content: (
        <>
          <p>Pela LGPD (art. 18), voce pode pedir a qualquer momento:</p>
          <ul>
            <li>confirmacao de que tratamos seus dados e acesso a eles;</li>
            <li>correcao de dados incompletos, inexatos ou desatualizados;</li>
            <li>anonimizacao, bloqueio ou eliminacao de dados desnecessarios ou tratados em desconformidade com a lei;</li>
            <li>portabilidade dos dados;</li>
            <li>informacao sobre com quem compartilhamos seus dados;</li>
            <li>eliminacao dos dados e encerramento da conta, respeitados os prazos legais de guarda.</li>
          </ul>
          <p>
            Faca o pedido pelo e-mail {email}. Respondemos em ate 15 dias. Voce tambem pode reclamar a Autoridade Nacional
            de Protecao de Dados (ANPD).
          </p>
        </>
      ),
    },
    {
      title: 'Cookies e armazenamento no navegador',
      content: (
        <p>
          Nao usamos cookies de rastreamento nem de publicidade. Guardamos no seu navegador apenas os dados da sua sessao,
          para voce continuar conectado. Ao clicar em Sair, eles sao apagados.
        </p>
      ),
    },
    {
      title: 'Menores de idade',
      content: (
        <p>
          O Pbingu e proibido para menores de 18 anos e nao coleta dados deles de forma intencional. Se identificarmos uma
          conta de menor, ela sera encerrada e os dados eliminados, salvo o que a lei obrigar a guardar.
        </p>
      ),
    },
    {
      title: 'Mudancas nesta politica',
      content: (
        <p>
          Quando esta politica mudar, a data da versao no topo sera atualizada e voce precisara aceitar a nova versao
          antes de continuar usando o Pbingu.
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      title="Politica de Privacidade"
      version={version}
      intro={
        <p>
          Esta politica explica quais dados pessoais o Pbingu coleta, para que usa, com quem compartilha e como voce pode
          exercer seus direitos.
        </p>
      }
      sections={sections}
    />
  );
}
