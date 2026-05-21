import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useSiteConfig, useAlbumConfig } from '../context';
import BackToTop from './BackToTop';
import LanguageSwitcher from './LanguageSwitcher';
import SearchOverlay from './SearchOverlay';
import { LinksSection, SocialLinksSection } from './RightSidebar';
import { useTranslation } from 'react-i18next';
import { useScrollToTop } from '../hooks/useScrollToTop';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useScrollToTop();
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const albumConfig = useAlbumConfig();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <header className="p-4 md:p-8 bg-bg border-b border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
              <img src={siteConfig.logo} alt="Logo" className="h-20 w-20 object-cover rounded-full" />
              <div>
                <h1 className="m-0 font-light text-3xl">
                  <Link to="/" className="text-primary hover:text-primary no-underline font-main">
                    {siteConfig.title}
                  </Link>
                </h1>
                <p className="m-0 text-sm opacity-80">{siteConfig.description}</p>
              </div>
              <LanguageSwitcher />
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 items-center">
              <div className="flex gap-4 items-center">
                <Link to="/" className="text-secondary font-medium hover:text-primary transition-colors whitespace-nowrap">{t('nav.home')}</Link>
                <Link to="/archives" className="text-secondary font-medium hover:text-primary transition-colors whitespace-nowrap">{t('common.archives', 'Archives')}</Link>
                {albumConfig.enabled && (
                  <Link to="/albums" className="text-secondary font-medium hover:text-primary transition-colors whitespace-nowrap">{t('nav.albums')}</Link>
                )}
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="text-secondary hover:text-primary transition-colors focus:outline-none"
                  aria-label="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[800px] mx-auto p-4 md:p-8">
          {children}
        </main>
        <footer className="py-8 text-center text-secondary text-sm border-t border-border">
          <div className="xl:hidden mb-6 flex flex-col items-center gap-4">
            <LinksSection />
            <SocialLinksSection />
          </div>
          <div>&copy; {new Date().getFullYear()} {siteConfig.title}</div>
          <div className="mt-1 opacity-60">
            Powered by <a href="https://github.com/Suzichen/s-blog" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary transition-colors underline">S-Blog</a>
          </div>
        </footer>
        <BackToTop />
      </div>
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Layout;

