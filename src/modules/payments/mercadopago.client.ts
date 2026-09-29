import { MercadoPagoConfig, Order } from 'mercadopago';
import { env } from '../../config/env';

const client = new MercadoPagoConfig({ accessToken: env.mercadoPagoAccessToken });

export const mpOrderClient = new Order(client);
