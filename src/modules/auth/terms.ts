import { z } from 'zod';

/** Versao vigente dos Termos de Uso e da Politica de Privacidade. Mudou o texto? Mude a versao: todos aceitam de novo. */
export const CURRENT_TERMS_VERSION = '2026-09-30.2';

export const MINIMUM_AGE = 18;

/** Idade completa em anos numa data (considera se o aniversario ja passou no ano). */
export function ageOn(birthDate: Date, today: Date): number {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) {
    age -= 1;
  }
  return age;
}

/** Data de nascimento no formato AAAA-MM-DD, valida e de alguem com 18 anos ou mais. */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato AAAA-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00Z`))
  .refine((date) => !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 1900, {
    message: 'Data de nascimento inválida',
  })
  .refine((date) => ageOn(date, new Date()) >= MINIMUM_AGE, {
    message: `O Pbingu é permitido apenas para maiores de ${MINIMUM_AGE} anos`,
  });

export const acceptTermsField = z.literal(true, {
  errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade' }),
});

export function hasAcceptedCurrentTerms(user: { termsVersion: string | null; birthDate: Date | null }): boolean {
  return user.termsVersion === CURRENT_TERMS_VERSION && user.birthDate !== null;
}
