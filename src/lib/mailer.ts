import { env } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

async function sendWithResend(message: EmailMessage): Promise<void> {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.emailFrom, ...message, to: [message.to] }),
  });

  if (!res.ok) {
    throw new Error(`Resend recusou o envio (${res.status}): ${await res.text()}`);
  }
}

export const mailer = {
  /** Envia pelo Resend; sem RESEND_API_KEY (desenvolvimento), apenas registra o e-mail no console. */
  async send(message: EmailMessage): Promise<void> {
    if (!env.resendApiKey) {
      if (env.isProduction) {
        throw new Error('RESEND_API_KEY nao configurada: e-mail nao enviado');
      }
      console.log(`[e-mail de desenvolvimento] para ${message.to}: ${message.subject}\n${message.text}`);
      return;
    }
    await sendWithResend(message);
  },
};
