import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { CONTACT_EMAIL } from '../components/LegalDocument';

const FAQ_ITEMS = [
  {
    question: 'Qual a diferenca entre chaves e premios?',
    answer:
      'Chaves sao creditos de participacao comprados via Pix - servem so para entrar nas rodadas e nunca podem ser sacadas. Premios sao o saldo em reais que voce ganha ao vencer uma rodada, e esse sim pode ser sacado para sua conta.',
  },
  {
    question: 'Como funciona uma rodada dos Numeros da sorte?',
    answer:
      'As rodadas acontecem em horarios fixos, a cada 15 minutos (:00, :15, :30 e :45). Voce entra na sala usando 1 chave e pode sair antes do inicio recuperando a chave. A rodada so comeca com pelo menos 5 jogadores - se nao completar ate o horario, ela e cancelada e as chaves voltam para todos. Com o minimo atingido, o sorteio comeca: numeros sao sorteados automaticamente e transmitidos em tempo real. Quem completar a cartela primeiro leva o premio acumulado. Se mais de uma cartela completar no mesmo numero, o premio e dividido igualmente entre elas.',
  },
  {
    question: 'Como comprar chaves?',
    answer:
      'Na sua carteira, escolha a quantidade de chaves e gere uma cobranca Pix. Pague o QR code ou copie o codigo "copia e cola" no app do seu banco. O credito e confirmado automaticamente.',
  },
  {
    question: 'Como sacar meu premio?',
    answer:
      'Na carteira, informe o valor, seu CPF e uma chave Pix cadastrada no seu CPF. O pedido fica em analise e e pago via Pix pela equipe - acompanhe o status em "Meus saques". Se o saque for recusado, o valor volta integralmente para o seu saldo de premios.',
  },
  {
    question: 'E possivel meu saldo ficar negativo?',
    answer:
      'Nao. Toda a movimentacao de chaves e premios acontece dentro de transacoes protegidas no banco de dados, com uma regra que impede qualquer saldo abaixo de zero - mesmo sob uso simultaneo.',
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="app-shell">
      <AppHeader />

      <main>
        <div className="card">
          <h2>Central de ajuda</h2>
          <p className="label">Perguntas frequentes</p>

          <div className="faq">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div className={isOpen ? 'faq-item open' : 'faq-item'} key={item.question}>
                  <button
                    type="button"
                    className="faq-question"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    {item.question}
                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <p className="faq-answer">{item.answer}</p>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Nao encontrou o que precisava?</h2>
          <p>Fale direto com a nossa equipe:</p>
          <div className="contact-cards">
            <a className="contact-card" href={`mailto:${CONTACT_EMAIL}`}>
              <strong>E-mail</strong>
              <span>{CONTACT_EMAIL}</span>
            </a>
            <Link className="contact-card" to="/termos">
              <strong>Termos de Uso</strong>
              <span>Regras das rodadas, chaves e saques</span>
            </Link>
            <Link className="contact-card" to="/privacidade">
              <strong>Politica de Privacidade</strong>
              <span>Como cuidamos dos seus dados</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
