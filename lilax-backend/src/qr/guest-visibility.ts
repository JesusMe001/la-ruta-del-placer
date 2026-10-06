// Qué puede ver el huésped en su menú QR y en su cuenta.
//
// El catálogo que viene del ERP (Informix) mezcla productos reales de venta
// con ítems INTERNOS que solo la cajera/administración debe manejar: cobros por
// daños a la habitación, recargos, cortesías, anticipos, etc. Esos nunca se
// deben ofrecer como "producto" al huésped.
//
// Las listas se comparan sin tildes ni mayúsculas y por PALABRA completa, así
// "DAÑO HABITACION" se oculta pero "DANONE" o "RON RESERVA" no.
//
// Se pueden agregar palabras sin tocar código con la variable de entorno
//   GUEST_MENU_HIDE_KEYWORDS="palabra1,palabra2"
// y mostrar solo productos con foto con
//   GUEST_MENU_ONLY_WITH_IMAGE=true

const DEFAULT_INTERNAL_KEYWORDS = [
  'dano',
  'danos',
  'deterioro',
  'faltante',
  'faltantes',
  'perdida',
  'multa',
  'penalidad',
  'recargo',
  'recargos',
  'cortesia',
  'cortesias',
  'gift card',
  'anticipo',
  'propina',
  'descuento',
  'ajuste',
];

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatcher(): RegExp {
  const extra = (process.env.GUEST_MENU_HIDE_KEYWORDS ?? '')
    .split(',')
    .map((k) => normalizeText(k))
    .filter(Boolean);
  const all = Array.from(new Set([...DEFAULT_INTERNAL_KEYWORDS, ...extra]));
  return new RegExp(`\\b(?:${all.map(escapeRegex).join('|')})\\b`);
}

const matcher = buildMatcher();

// true si el producto o su categoría es de uso interno (no para el huésped).
export function isInternalGuestItem(
  productName: string | null | undefined,
  categoryName?: string | null,
): boolean {
  return matcher.test(normalizeText(productName)) || matcher.test(normalizeText(categoryName));
}

export function onlyWithImage(): boolean {
  return (process.env.GUEST_MENU_ONLY_WITH_IMAGE ?? 'false').toLowerCase() === 'true';
}
