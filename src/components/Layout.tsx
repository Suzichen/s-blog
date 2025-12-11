
import React from 'react';
import { Link } from 'react-router-dom';

import { siteConfig } from '../config';
import BackToTop from './BackToTop';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
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
        </div>
        <nav className="header-nav">
          <Link to="/">Home</Link>
          <Link to="/tags">Tags</Link>
          <Link to="/categories">Categories</Link>
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
