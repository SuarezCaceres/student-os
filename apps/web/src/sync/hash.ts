/**
 * JSON canonico (claves ordenadas, `undefined` omitido) y hash corto para detectar cambios.
 * El hash NO es criptografico: solo sirve para comparar versiones de un mismo registro.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue;
    parts.push(`${JSON.stringify(key)}:${stableStringify(item)}`);
  }
  return `{${parts.join(',')}}`;
}

/** cyrb53: hash de 53 bits, suficiente para detectar ediciones de un registro. */
export function hashString(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function hashData(data: unknown): string {
  return hashString(stableStringify(data));
}

/** Copia profunda a JSON puro (descarta `undefined`, funciones y referencias compartidas). */
export function toPlainJson<T>(value: T): T {
  return value === undefined ? (null as T) : (JSON.parse(JSON.stringify(value)) as T);
}
