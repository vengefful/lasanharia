/** URL do Google Maps que abre busca por um texto qualquer (coordenadas ou endereço). */
export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** URL do Google Maps a partir de lat/long. */
export function buildMapsUrlFromCoords(lat: number, lng: number): string {
  return buildMapsSearchUrl(`${lat},${lng}`);
}

/** Junta address + nº + bairro (+ cidade/UF da loja, se houver) para o Maps. Itens vazios são ignorados. */
export function joinAddressForMaps(parts: {
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const head = [parts.address, parts.addressNumber].filter(Boolean).join(', ');
  const trail: string[] = [];
  if (parts.neighborhood) trail.push(parts.neighborhood);
  if (parts.city) trail.push(parts.city);
  if (parts.state) trail.push(parts.state);
  return [head, ...trail].filter(Boolean).join(', ');
}
