function checkDigit(digits: number[], weightStart: number): number {
  const sum = digits.reduce((acc, digit, index) => acc + digit * (weightStart - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Valida os digitos verificadores de um CPF (aceita com ou sem pontuacao). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split('').map(Number);
  return checkDigit(digits.slice(0, 9), 10) === digits[9] && checkDigit(digits.slice(0, 10), 11) === digits[10];
}
