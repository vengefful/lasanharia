// Lembra o telefone usado na fidelidade neste aparelho. Conveniência por-aparelho,
// igual ao customerInfo, mas em chave própria — separação semântica e evita conflito.
// Não é cadastro, não vai pro backend. Telefone livre que o cliente sempre pode trocar.

const STORAGE_KEY = 'lasanharia-loyalty-phone';

export function loadLoyaltyPhone(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLoyaltyPhone(phone: string) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = phone.trim();
    if (trimmed) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // bloqueado/cheio — é só conveniência, ignora.
  }
}
