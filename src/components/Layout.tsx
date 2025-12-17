
import React from 'react';
import { Link } from 'react-router-dom';

import { siteConfig } from '../config';
import BackToTop from './BackToTop';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="header-branding">
          <img src={siteConfig.logo} alt="Logo" className="site-logo" />
          <div>
            <h1 className="site-title">
              <Link to="/">{siteConfig.title}</Link>
            </h1>
            <p className="site-description">{siteConfig.description}</p>
          </div>
          <LanguageSwitcher />
        </div>
        <nav className="header-nav">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/tags">{t('nav.tags')}</Link>
          <Link to="/categories">{t('nav.categories')}</Link>
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer>
        &copy; {new Date().getFullYear()} {siteConfig.title}
      </footer>
      <BackToTop />
    </div>
  );
};

export default Layout;
