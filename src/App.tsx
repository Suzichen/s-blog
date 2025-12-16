
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { siteConfig } from './config';
import Layout from './components/Layout';
import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import CategoryList from './pages/CategoryList';
import TagList from './pages/TagList';

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
          <Route path="/categories" element={<CategoryList />} />
          <Route path="/tags" element={<TagList />} />
          <Route path="/categories/:category" element={<div>Category Filter (TODO)</div>} />
          <Route path="/tags/:tag" element={<div>Tag Filter (TODO)</div>} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
