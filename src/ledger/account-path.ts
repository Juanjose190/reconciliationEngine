/**
 * Nomenclatura de cuentas (HU 2.2).
 *
 * Una cuenta es una ruta de segmentos separados por ":" — de lo general a lo específico:
 *
 *   world                       cuenta de referencia (origen/destino del dinero externo)
 *   banks:bancolombia:main      cuentas reales en entidades externas
 *   blockchain:btc:treasury     direcciones/custodia en cadena
 *   users:alice:wallet          saldos de clientes finales
 *   fees:platform               comisiones cobradas
 *   suspense:unmatched          partidas pendientes de conciliar
 *
 * El tenant NO va en la ruta: cada tenant tiene su propio ledger.
 */
export const WORLD = 'world';

export const ACCOUNT_ROOTS = ['banks', 'blockchain', 'users', 'fees', 'suspense'] as const;

const SEGMENT = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_DEPTH = 6;

export function isWorld(address: string): boolean {
  return address === WORLD;
}

export function validateAccount(address: string): string | null {
  if (typeof address !== 'string' || address.length === 0) return 'La cuenta es obligatoria';
  if (isWorld(address)) return null;

  const segments = address.split(':');
  if (segments.length < 2) {
    return `La cuenta "${address}" necesita al menos 2 segmentos (raíz:nombre), p. ej. users:alice`;
  }
  if (segments.length > MAX_DEPTH) return `La cuenta "${address}" supera ${MAX_DEPTH} niveles`;
  if (!segments.every((s) => SEGMENT.test(s))) {
    return `La cuenta "${address}" solo admite letras, números, "_" y "-" en cada segmento`;
  }
  if (!(ACCOUNT_ROOTS as readonly string[]).includes(segments[0])) {
    return `Raíz "${segments[0]}" no permitida. Usa una de: ${ACCOUNT_ROOTS.join(', ')}`;
  }
  return null;
}

export function buildAccount(...segments: string[]): string {
  const address = segments.join(':');
  const error = validateAccount(address);
  if (error) throw new Error(error);
  return address;
}

const ASSET = /^[A-Z][A-Z0-9]{0,15}(\/\d{1,2})?$/;

export function validateAsset(asset: string): string | null {
  return typeof asset === 'string' && ASSET.test(asset)
    ? null
    : `Asset "${asset}" inválido. Formato esperado: UNIDAD/DECIMALES, p. ej. USD/2`;
}
