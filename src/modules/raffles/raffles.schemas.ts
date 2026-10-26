import { z } from 'zod';

export const discountSchema = z.object({
  minQuantity: z.number().int().min(2).max(1000),
  percent: z.number().int().min(1).max(90),
});

const imageSchema = z.string().max(1500000).refine((value) => {
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Envie uma imagem PNG, JPEG ou WebP de até 1 MB ou uma URL HTTPS');

export const raffleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(10000),
  image: imageSchema,
  prize: z.string().trim().min(3).max(255),
  priceCents: z.number().int().min(1).max(10000000),
  discounts: z.array(discountSchema).max(20).default([]),
  digits: z.number().int().min(1).max(5),
  lottery: z.string().trim().min(3).max(80),
  contest: z.string().trim().min(1).max(40),
  prizePosition: z.number().int().min(1).max(10),
  closesAt: z.coerce.date(),
  drawAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (value.closesAt > value.drawAt) context.addIssue({ code: 'custom', message: 'Encerre as vendas antes do sorteio', path: ['closesAt'] });
  const tiers = [...value.discounts].sort((a, b) => a.minQuantity - b.minQuantity);
  tiers.forEach((tier, i) => {
    if (i && (tier.minQuantity === tiers[i - 1].minQuantity || tier.percent <= tiers[i - 1].percent)) {
      context.addIssue({ code: 'custom', message: 'As faixas devem ter quantidades únicas e descontos crescentes', path: ['discounts'] });
    }
    if (tier.minQuantity > 10 ** value.digits) context.addIssue({ code: 'custom', message: 'Faixa de desconto maior que a quantidade de bilhetes', path: ['discounts'] });
  });
});

export const quantitySchema = z.object({ quantity: z.number().int().min(1).max(1000) });
export const resultSchema = z.object({
  resultNumber: z.string().regex(/^\d{1,30}$/, 'Informe o número premiado completo, somente dígitos'),
  resultSource: z.string().url().max(2000).refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'caixa.gov.br' || url.hostname.endsWith('.caixa.gov.br'));
  }, 'Use o link HTTPS do resultado oficial no domínio caixa.gov.br'),
});
export type RaffleInput = z.infer<typeof raffleSchema>;
export type Discount = z.infer<typeof discountSchema>;

export function quoteRaffle(priceCents: number, discounts: Discount[], quantity: number) {
  const discountPercent = discounts.filter((tier) => quantity >= tier.minQuantity)
    .reduce((best, tier) => Math.max(best, tier.percent), 0);
  const subtotalCents = priceCents * quantity;
  const totalCents = Math.round(subtotalCents * (100 - discountPercent) / 100);
  return { quantity, unitPriceCents: priceCents, discountPercent, subtotalCents, totalCents };
}
