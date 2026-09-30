import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { mailer, parseAddress } from '../src/lib/mailer';

const message = { to: 'jogador@example.com', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' };
const originalEnv = { ...env };

function stubFetch(status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  Object.assign(env, originalEnv);
  vi.unstubAllGlobals();
});

describe('parseAddress', () => {
  it('separa nome e e-mail', () => {
    expect(parseAddress('Pbingu <pbingu@gmail.com>')).toEqual({ name: 'Pbingu', email: 'pbingu@gmail.com' });
    expect(parseAddress('pbingu@gmail.com')).toEqual({ email: 'pbingu@gmail.com' });
  });
});

describe('mailer', () => {
  it('usa o Brevo quando so BREVO_API_KEY esta configurada', async () => {
    Object.assign(env, { resendApiKey: '', brevoApiKey: 'brevo-key', emailFrom: 'Pbingu <pbingu@gmail.com>' });
    const fetchMock = stubFetch();

    await mailer.send(message);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('brevo-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: 'Pbingu', email: 'pbingu@gmail.com' },
      to: [{ email: 'jogador@example.com' }],
      subject: 'Assunto',
      htmlContent: '<p>Oi</p>',
      textContent: 'Oi',
    });
  });

  it('prefere o Resend quando as duas chaves existem', async () => {
    Object.assign(env, { resendApiKey: 'resend-key', brevoApiKey: 'brevo-key' });
    const fetchMock = stubFetch();

    await mailer.send(message);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer resend-key');
  });

  it('propaga a recusa do provedor como erro', async () => {
    Object.assign(env, { resendApiKey: '', brevoApiKey: 'brevo-key' });
    stubFetch(401);

    await expect(mailer.send(message)).rejects.toThrow(/Brevo recusou o envio \(401\)/);
  });

  it('falha em producao sem nenhum provedor configurado', async () => {
    Object.assign(env, { resendApiKey: '', brevoApiKey: '', isProduction: true });

    await expect(mailer.send(message)).rejects.toThrow(/Nenhum provedor de e-mail/);
  });
});
