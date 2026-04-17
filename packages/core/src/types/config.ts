export interface SiteConfig {
  title: string;
  description: string;
  logo: string;
  favicon: string;
  siteUrl?: string; // Production URL, if not set, URL-dependent SEO features won't be generated
  author?: string;
  language?: string; // Default language code (e.g., 'en', 'zh-CN', 'ja')
  timezone?: string; // IANA timezone identifier (e.g., 'Asia/Shanghai')
}
