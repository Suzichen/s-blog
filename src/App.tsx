
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { siteConfig } from './config';
import Layout from './components/Layout';
import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import CategoryDetail from './pages/CategoryDetail';
import TagDetail from './pages/TagDetail';

const App: React.FC = () => {
  const { i18n } = useTranslation();

  // Effect to update lang on change (for switcher)
  React.useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage || 'en';
  }, [i18n.resolvedLanguage]);

  React.useEffect(() => {
    // Update title
    document.title = siteConfig.title;

    // Update favicon
    const link = (document.querySelector("link[rel*='icon']") || document.createElement('link')) as HTMLLinkElement;
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = siteConfig.favicon;
    document.getElementsByTagName('head')[0].appendChild(link);
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<PostDetail />} />
          <Route path="/categories/:category" element={<CategoryDetail />} />
          <Route path="/tags/:tag" element={<TagDetail />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
