// Helpers puros do Programa de Fidelidade (ver CLAUDE.md, seção Programa de Fidelidade).
// Sem I/O — a manipulação real de pontos vive nas rotas, em transações.

/** Quantos pontos = 1 lasanha grátis. */
export const REWARD_THRESHOLD = 10;

/**
 * Normaliza um telefone para a forma canônica do programa: só dígitos, SEM o DDI 55.
 *
 * Exemplos:
 *   "(82) 99141-3741"     → "82991413741"
 *   "82991413741"         → "82991413741"
 *   "+55 82 99141-3741"   → "82991413741"
 *   "5582991413741"       → "82991413741"
 *   "55912345678"         → "55912345678"  (não é DDI; DDD 55 = Rio Grande do Sul)
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  // DDI 55: precisa ter pelo menos 12 dígitos (55 + DDD + 8/9 dígitos). DDDs no Brasil
  // têm 2 dígitos, então um número local válido tem 10 ou 11 dígitos. Se vier >= 12 e
  // começar com 55, assumimos que é DDI e tiramos.
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

/** Quantas lasanhas grátis o cliente pode resgatar com este saldo. */
export function rewardsFromPoints(points: number): number {
  return Math.floor(Math.max(0, points) / REWARD_THRESHOLD);
}
