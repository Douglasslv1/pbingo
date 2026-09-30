import { env } from '../config/env';
import { logger } from './logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Separa "Nome <email@dominio>" em nome e e-mail; aceita tambem so o e-mail. */
export function parseAddress(address: string): { name?: string; email: string } {
  const match = address.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) {
    return { email: address.trim() };
  }
  return { name: match[1] || undefined, email: match[2].trim() };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, provider: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${provider} recusou o envio (${res.status}): ${await res.text()}`);
  }
}

function sendWithResend(message: EmailMessage): Promise<void> {
  return postJson(
    RESEND_URL,
    { Authorization: `Bearer ${env.resendApiKey}` },
    { from: env.emailFrom, to: [message.to], subject: message.subject, html: message.html, text: message.text },
    'Resend',
  );
}

function sendWithBrevo(message: EmailMessage): Promise<void> {
  return postJson(
    BREVO_URL,
    { 'api-key': env.brevoApiKey },
    {
      sender: parseAddress(env.emailFrom),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    },
    'Brevo',
  );
}

export const mailer = {
  /**
   * Envia pelo Resend (dominio proprio) ou, na falta dele, pelo Brevo (API HTTPS, funciona sem dominio).
   * Sem nenhuma chave, em desenvolvimento apenas registra o e-mail no console.
   */
  async send(message: EmailMessage): Promise<void> {
    if (env.resendApiKey) {
      return sendWithResend(message);
    }
    if (env.brevoApiKey) {
      return sendWithBrevo(message);
    }
    if (env.isProduction) {
      throw new Error('Nenhum provedor de e-mail configurado (RESEND_API_KEY ou BREVO_API_KEY)');
    }
    logger.info('E-mail de desenvolvimento (não enviado)', { to: message.to, subject: message.subject, text: message.text });
  },
};
