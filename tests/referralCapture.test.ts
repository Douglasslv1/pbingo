import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureReferral, clearReferral, getReferral } from '../frontend/src/referral';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  clearReferral();
});
afterEach(() => { clearReferral(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Captura do link de indicação', () => {
  it('guarda a primeira indicação e não troca ao navegar por outro link', () => {
    captureReferral('?ref=parceiro-a', false);
    captureReferral('?ref=parceiro-b', false);
    expect(getReferral()).toBe('parceiro-a');
  });
  it('ignora indicação quando a pessoa já está autenticada', () => {
    captureReferral('?ref=parceiro-a', true);
    expect(getReferral()).toBeUndefined();
  });
  it('expira a indicação após 30 dias sem concluir o cadastro', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    captureReferral('?ref=parceiro-a', false);
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    expect(getReferral()).toBeUndefined();
  });
  it('permite remover a indicação antes do cadastro e não aceita código malformado', () => {
    captureReferral('?ref=parceiro-a', false); clearReferral();
    captureReferral('?ref=%3Cscript%3E', false);
    expect(getReferral()).toBeUndefined();
  });
  it('normaliza o código sem confundir outros parâmetros', () => {
    captureReferral('?utm_source=campanha&ref=PARCEIRO-123', false);
    expect(getReferral()).toBe('parceiro-123');
  });
  it('mantém a indicação em memória se o navegador bloquear o armazenamento', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    captureReferral('?ref=parceiro-a', false);
    expect(getReferral()).toBe('parceiro-a');
  });
});
