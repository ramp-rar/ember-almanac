import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES } from '@/lib/i18n/messages';

/** Every string reachable in a message tree; functions are called with sample arguments. */
function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') {
    const args = Array.from({ length: node.length }, (_, i) => (i % 2 ? 7 : 'X'));
    return [[path, String((node as (...a: unknown[]) => unknown)(...args))]];
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe('translations', () => {
  it('every locale has the same keys, and no empty string', () => {
    const keys = (l: (typeof LOCALES)[number]) => strings(MESSAGES[l]).map(([p]) => p);
    for (const l of LOCALES) {
      expect(keys(l)).toEqual(keys('en'));
      for (const [p, s] of strings(MESSAGES[l])) expect(s.trim(), `${l}:${p}`).not.toBe('');
    }
  });

  it('no word mixes Latin and Cyrillic letters (typo guard for ru and tg)', () => {
    const mixed = /[A-Za-z][Ѐ-ӿ]|[Ѐ-ӿ][A-Za-z]/;
    for (const l of ['ru', 'tg'] as const) {
      for (const [p, s] of strings(MESSAGES[l]))
        expect(mixed.test(s), `${l}:${p} "${s}"`).toBe(false);
    }
  });

  it('twelve month names in each locale', () => {
    for (const l of LOCALES) {
      expect(MESSAGES[l].monthsLong).toHaveLength(12);
      expect(MESSAGES[l].monthsShort).toHaveLength(12);
    }
  });
});
