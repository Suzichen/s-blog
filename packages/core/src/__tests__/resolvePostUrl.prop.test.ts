import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolvePostUrl } from '../utils/resolvePostUrl';

/**
 * Property 3: Frontend article URL resolution
 *
 * For any post metadata with a given slug and availableLanguages list,
 * and any current language setting: if the current language is present
 * in availableLanguages, the resolved fetch URL SHALL be
 * `/posts/{slug}.{currentLang}.md`; otherwise, the resolved fetch URL
 * SHALL be `/posts/{slug}.md`.
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('resolvePostUrl - Property 3: Frontend article URL resolution', () => {
  // Generator for valid slugs: alphanumeric with hyphens, starting with a letter, no dots
  const slugArb = fc
    .tuple(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      fc.array(
        fc.constantFrom(
          ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')
        ),
        { minLength: 0, maxLength: 20 }
      )
    )
    .map(([first, rest]) => first + rest.join(''))
    .filter((s) => !s.endsWith('-') && s.length > 0);

  // Generator for BCP 47-like language codes
  const langArb = fc.constantFrom(
    'zh-CN',
    'en',
    'ja',
    'ko',
    'fr',
    'de',
    'es',
    'pt-BR',
    'en-US',
    'zh-TW'
  );

  it('returns localized URL when currentLang is in availableLanguages (100+ iterations)', () => {
    fc.assert(
      fc.property(
        slugArb,
        fc.uniqueArray(langArb, { minLength: 1, maxLength: 5 }),
        (slug, availableLanguages) => {
          // Pick a language that IS in availableLanguages
          const currentLang =
            availableLanguages[
              Math.floor(Math.random() * availableLanguages.length)
            ];
          const url = resolvePostUrl(slug, availableLanguages, currentLang);
          expect(url).toBe(`/posts/${slug}.${currentLang}.md`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns default URL when currentLang is NOT in availableLanguages (100+ iterations)', () => {
    fc.assert(
      fc.property(
        slugArb,
        fc.uniqueArray(langArb, { minLength: 0, maxLength: 4 }),
        langArb,
        (slug, availableLanguages, currentLang) => {
          // Only test when currentLang is NOT in availableLanguages
          fc.pre(!availableLanguages.includes(currentLang));
          const url = resolvePostUrl(slug, availableLanguages, currentLang);
          expect(url).toBe(`/posts/${slug}.md`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resolvePostUrl returns correct URL based on language availability (combined property, 100+ iterations)', () => {
    fc.assert(
      fc.property(
        slugArb,
        fc.uniqueArray(langArb, { minLength: 0, maxLength: 5 }),
        langArb,
        (slug, availableLanguages, currentLang) => {
          const url = resolvePostUrl(slug, availableLanguages, currentLang);
          if (availableLanguages.includes(currentLang)) {
            expect(url).toBe(`/posts/${slug}.${currentLang}.md`);
          } else {
            expect(url).toBe(`/posts/${slug}.md`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
