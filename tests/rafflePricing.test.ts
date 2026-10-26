import { describe, expect, it } from 'vitest';
import { quoteRaffle, raffleSchema, resultSchema } from '../src/modules/raffles/raffles.schemas';

const discounts = [{ minQuantity: 10, percent: 10 }, { minQuantity: 20, percent: 20 }];
describe('Rifas: preços e validação de regras', () => {
  it.each([[1, 500, 0], [9, 4500, 0], [10, 4500, 10], [19, 8550, 10], [20, 8000, 20], [21, 8400, 20]])(
    '%i bilhetes custam %i centavos com %i%% de desconto', (quantity, totalCents, discountPercent) => {
      expect(quoteRaffle(500, discounts, quantity)).toMatchObject({ totalCents, discountPercent });
    },
  );
  it('usa a maior faixa independentemente da ordem e arredonda apenas o total', () => {
    expect(quoteRaffle(199, [...discounts].reverse(), 11).totalCents).toBe(1970);
    expect(quoteRaffle(199, discounts, 20).totalCents).toBe(3184);
    expect(quoteRaffle(199, [], 20).totalCents).toBe(3980);
  });
  const input = {
    title: 'Rifa da semana', description: 'Prêmio da semana', image: 'https://example.com/premio.png', prize: 'Bicicleta',
    priceCents: 500, discounts, digits: 3, lottery: 'Loteria Federal', contest: '1234', prizePosition: 1,
    closesAt: '2027-01-01T19:00:00Z', drawAt: '2027-01-01T20:00:00Z',
  };
  it('aceita regras consistentes e converte as datas', () => {
    expect(raffleSchema.parse(input).drawAt).toBeInstanceOf(Date);
  });
  it.each([
    { discounts: [{ minQuantity: 10, percent: 20 }, { minQuantity: 20, percent: 10 }] },
    { discounts: [{ minQuantity: 10, percent: 10 }, { minQuantity: 10, percent: 20 }] },
    { digits: 1 }, { digits: 6 }, { priceCents: 0 }, { priceCents: 1.5 },
    { closesAt: '2027-01-02T19:00:00Z' }, { image: 'javascript:alert(1)' },
    { image: 'data:image/svg+xml;base64,PHN2Zz4=' },
  ])('recusa regras inválidas: %j', (invalid) => {
    expect(raffleSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
  });
  it.each(['https://caixa.gov.br.evil.com', 'https://evil.com/caixa.gov.br', 'http://caixa.gov.br', 'https://caixa.gov.br@evil.com'])('recusa fonte %s', (source) => {
    expect(resultSchema.safeParse({ resultNumber: '12345', resultSource: source }).success).toBe(false);
  });
  it('aceita resultado com zeros à esquerda e fonte oficial HTTPS', () => {
    expect(resultSchema.parse({ resultNumber: '00123', resultSource: 'https://loterias.caixa.gov.br/Paginas/Federal.aspx' }).resultNumber).toBe('00123');
  });
});
