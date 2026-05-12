/**
 * Resolves the URL for a post's markdown file based on language availability.
 *
 * If `currentLang` is present in `availableLanguages`, returns the localized URL.
 * Otherwise, returns the default (non-localized) URL.
 *
 * @param slug - The post slug identifier
 * @param availableLanguages - List of language codes for which localized versions exist
 * @param currentLang - The user's current language setting
 * @returns The resolved URL path to the markdown file
 */
export function resolvePostUrl(
  slug: string,
  availableLanguages: string[],
  currentLang: string
): string {
  if (availableLanguages.includes(currentLang)) {
    return `/posts/${slug}.${currentLang}.md`;
  }
  return `/posts/${slug}.md`;
}
