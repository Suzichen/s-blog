export interface SiteConfig {
  title: string;
  description: string;
  logo: string;
  favicon: string;
  siteUrl?: string; // Production URL, if not set, URL-dependent SEO features won't be generated
  author?: string;
  language?: string; // Default language code (e.g., 'en', 'zh-CN', 'ja')
}

export const siteConfig: SiteConfig = {
  title: "S-blog",
  description: "Simple writing. Super performance. A blog system.",
  logo: "/logo.png",
  favicon: "/favicon.ico",
  siteUrl: "https://s-blog.me",
  author: "Suzichen",
  language: "en",
};
