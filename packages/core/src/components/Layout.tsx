import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { useSiteConfig, useAlbumConfig } from '../context';
import BackToTop from './BackToTop';
import LanguageSwitcher from './LanguageSwitcher';
import SearchOverlay from './SearchOverlay';
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
                {siteConfig.siteUrl && (
                  <a
                    href={`${siteConfig.siteUrl.replace(/\/$/, '')}/rss.xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-primary transition-colors"
                    aria-label="RSS"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="6.18" cy="17.82" r="2.18"/><path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
                    </svg>
                  </a>
                )}
                {siteConfig.github && (
                  <a
                    href={siteConfig.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-primary transition-colors"
                    aria-label="GitHub"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </a>
                )}
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[800px] mx-auto p-4 md:p-8">
          {children}
        </main>
        <footer className="py-8 text-center text-secondary text-sm border-t border-border">
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

