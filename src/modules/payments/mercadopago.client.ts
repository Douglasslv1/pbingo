import { MercadoPagoConfig, Payment } from 'mercadopago';
import { env } from '../../config/env';

const client = new MercadoPagoConfig({ accessToken: env.mercadoPagoAccessToken });

export const mpPaymentClient = new Payment(client);
