import React from 'react';
import { Link } from 'react-router-dom';

import { siteConfig } from '../config';
import BackToTop from './BackToTop';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useScrollToTop } from '../hooks/useScrollToTop';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useScrollToTop();
  const { t } = useTranslation();
  return (
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
          <nav className="flex gap-6">
            <Link to="/" className="text-secondary font-medium hover:text-primary transition-colors">{t('nav.home')}</Link>
            <Link to="/archives" className="text-secondary font-medium hover:text-primary transition-colors">{t('common.archives', 'Archives')}</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[800px] mx-auto p-4 md:p-8">
        {children}
      </main>
      <footer className="py-8 text-center text-secondary text-sm border-t border-border">
        &copy; {new Date().getFullYear()} {siteConfig.title}
      </footer>
      <BackToTop />
    </div>
  );
};

export default Layout;
