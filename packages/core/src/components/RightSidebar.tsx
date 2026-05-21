import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteConfig } from '../context';
import SocialIcon from './SocialIcon';
import type { SocialLinkItem } from '../types/config';

function resolveUrl(item: SocialLinkItem, siteUrl?: string): string | null {
  if (item.url) return item.url;
  if (item.platform === 'rss' && siteUrl) return `${siteUrl.replace(/\/$/, '')}/rss.xml`;
  return null;
}

export const LinksSection: React.FC = () => {
  const { t } = useTranslation();
  const { links } = useSiteConfig();

  if (!links || links.enabled === false) return null;
  const entries = Object.entries(links.items || {});
  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm uppercase tracking-wider font-bold text-secondary mb-4 pb-2 border-b border-border">
        {t('widget.links', 'Links')}
      </h3>
      <ul className="list-none p-0 m-0">
        {entries.map(([name, url]) => (
          <li key={name} className="mb-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent no-underline transition-colors"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const SocialLinksSection: React.FC = () => {
  const { t } = useTranslation();
  const { socialLinks, siteUrl } = useSiteConfig();

  if (!socialLinks || socialLinks.enabled === false) return null;

  const resolved = (socialLinks.items || [])
    .map((item) => ({ ...item, resolvedUrl: resolveUrl(item, siteUrl) }))
    .filter((item) => item.resolvedUrl !== null);

  if (resolved.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm uppercase tracking-wider font-bold text-secondary mb-4 pb-2 border-b border-border">
        {t('widget.social', 'Social')}
      </h3>
      <div className="flex flex-wrap gap-3">
        {resolved.map((item) => (
          <a
            key={item.platform + item.resolvedUrl}
            href={item.resolvedUrl!}
            target="_blank"
            rel="noopener noreferrer"
            title={item.label || item.platform}
            className="text-secondary hover:text-primary transition-colors"
          >
            <SocialIcon platform={item.platform} icon={item.icon} size={22} />
          </a>
        ))}
      </div>
    </section>
  );
};

const RightSidebar: React.FC = () => (
  <div className="flex flex-col gap-8">
    <LinksSection />
    <SocialLinksSection />
  </div>
);

export default RightSidebar;
