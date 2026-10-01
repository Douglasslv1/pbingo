import LegalDocument, { CONTACT_EMAIL, LegalSection } from '../components/LegalDocument';
import { useGameConfig } from '../hooks/useGameConfig';

export default function PrivacyPage() {
  const version = useGameConfig()?.termsVersion ?? '2026-10-01';
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  const sections: LegalSection[] = [
    {
      title: 'Quem cuida dos seus dados',
      content: (
        <p>
          O Pbingu é o controlador dos dados pessoais tratados na plataforma, nos termos da Lei Geral de Proteção de Dados
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
            <strong>Movimentações e jogo:</strong> compras de chaves, cartelas e rodadas dos Números da sorte, mesas e
            jogadas do Dominó, prêmios, saques e devoluções.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, data e hora de acesso e registros de erro.
          </li>
          <li>
            <strong>Pagamentos:</strong> o Pix é processado pelo Mercado Pago. Não recebemos dados da sua conta bancária,
            apenas a confirmação do pagamento.
          </li>
        </ul>
      ),
    },
    {
      title: 'Para que usamos e com qual base legal',
      content: (
        <ul>
          <li>
            <strong>Criar e manter sua conta, rodar as partidas, creditar prêmios e pagar saques</strong> - execução do
            contrato (art. 7, V da LGPD).
          </li>
          <li>
            <strong>Confirmar que você é maior de idade</strong> - execução do contrato e cumprimento de obrigação legal
            (art. 7, II e V).
          </li>
          <li>
            <strong>Guardar registros financeiros e de acesso</strong> - cumprimento de obrigação legal (art. 7, II),
            incluindo o Marco Civil da Internet.
          </li>
          <li>
            <strong>Segurança, prevenção a fraudes e limite de tentativas de acesso</strong> - legítimo interesse (art. 7,
            IX) e proteção do crédito.
          </li>
          <li>
            <strong>Enviar e-mails de serviço</strong>, como a redefinição de senha - execução do contrato. Não enviamos
            publicidade.
          </li>
        </ul>
      ),
    },
    {
      title: 'Com quem compartilhamos',
      content: (
        <>
          <p>Não vendemos seus dados. Eles são compartilhados apenas com quem precisamos para operar o serviço:</p>
          <ul>
            <li>
              <strong>Mercado Pago</strong> - processamento dos pagamentos via Pix.
            </li>
            <li>
              <strong>Brevo</strong> - envio dos e-mails de serviço.
            </li>
            <li>
              <strong>Railway</strong> - hospedagem do sistema e do banco de dados.
            </li>
            <li>
              <strong>Autoridades</strong> - quando houver obrigação legal ou ordem judicial.
            </li>
          </ul>
          <p>
            Alguns desses fornecedores mantém servidores fora do Brasil. Nesses casos, a transferência internacional
            ocorre para a execução do contrato com você (art. 33, IX da LGPD), com fornecedores que adotam medidas de
            segurança compatíveis com a lei.
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
            Registros financeiros (compras, prêmios e saques, com CPF e chave Pix): pelo prazo exigido pela legislação,
            mesmo após o encerramento da conta.
          </li>
          <li>Depois desses prazos, os dados são eliminados ou anonimizados.</li>
        </ul>
      ),
    },
    {
      title: 'Como protegemos',
      content: (
        <ul>
          <li>Toda a comunicação com o Pbingu é criptografada (HTTPS).</li>
          <li>Senhas são guardadas com criptografia de mão única (bcrypt) e nunca podem ser lidas por ninguém.</li>
          <li>O acesso ao banco de dados é restrito, e os dados de saque só são vistos por quem processa o pagamento.</li>
          <li>Ao trocar a senha, todas as sessões abertas em outros aparelhos são encerradas.</li>
        </ul>
      ),
    },
    {
      title: 'Seus direitos',
      content: (
        <>
          <p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
          <ul>
            <li>confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessarios ou tratados em desconformidade com a lei;</li>
            <li>portabilidade dos dados;</li>
            <li>informação sobre com quem compartilhamos seus dados;</li>
            <li>eliminação dos dados e encerramento da conta, respeitados os prazos legais de guarda.</li>
          </ul>
          <p>
            Faça o pedido pelo e-mail {email}. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional
            de Proteção de Dados (ANPD).
          </p>
        </>
      ),
    },
    {
      title: 'Cookies e armazenamento no navegador',
      content: (
        <p>
          Não usamos cookies de rastreamento nem de publicidade. Guardamos no seu navegador apenas os dados da sua sessão,
          para você continuar conectado. Ao clicar em Sair, eles são apagados.
        </p>
      ),
    },
    {
      title: 'Menores de idade',
      content: (
        <p>
          O Pbingu é proibido para menores de 18 anos e não coleta dados deles de forma intencional. Se identificarmos uma
          conta de menor, ela será encerrada e os dados eliminados, salvo o que a lei obrigar a guardar.
        </p>
      ),
    },
    {
      title: 'Mudanças nesta política',
      content: (
        <p>
          Quando esta política mudar, a data da versão no topo será atualizada e você precisará aceitar a nova versão
          antes de continuar usando o Pbingu.
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      title="Política de Privacidade"
      version={version}
      intro={
        <p>
          Esta política explica quais dados pessoais o Pbingu coleta, para que usa, com quem compartilha e como você pode
          exercer seus direitos.
        </p>
      }
      sections={sections}
    />
  );
}
