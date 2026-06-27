// Centavos (int) → "R$ 12,34"
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// "R$ 12,34" ou "12,34" ou "12.34" → 1234 centavos. Devolve NaN se vazio/inválido.
export function parseMoneyToCents(input: string): number {
  if (!input) return NaN;
  const cleaned = input
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '') // remove separador de milhar
    .replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

// Mostra "11 98765-4321" se vier 11 dígitos; senão devolve como está.
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}
