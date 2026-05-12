import { describe, it, expect } from 'vitest';
import { resolvePostUrl } from './resolvePostUrl';

describe('resolvePostUrl', () => {
  it('returns localized URL when currentLang is in availableLanguages', () => {
    const url = resolvePostUrl('hello-world', ['zh-CN', 'ja'], 'zh-CN');
    expect(url).toBe('/posts/hello-world.zh-CN.md');
  });

  it('returns default URL when currentLang is not in availableLanguages', () => {
    const url = resolvePostUrl('hello-world', ['zh-CN', 'ja'], 'en');
    expect(url).toBe('/posts/hello-world.md');
  });

  it('returns default URL when availableLanguages is empty', () => {
    const url = resolvePostUrl('about', [], 'zh-CN');
    expect(url).toBe('/posts/about.md');
  });

  it('handles single language in availableLanguages', () => {
    const url = resolvePostUrl('about', ['en'], 'en');
    expect(url).toBe('/posts/about.en.md');
  });

  it('is case-sensitive for language codes', () => {
    const url = resolvePostUrl('about', ['zh-CN'], 'zh-cn');
    expect(url).toBe('/posts/about.md');
  });
});
