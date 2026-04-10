
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSiteConfig, useAlbumConfig } from './context';
import Layout from './components/Layout';
import Home from './pages/Home';
import PostDetail from './pages/PostDetail';
import CategoryDetail from './pages/CategoryDetail';
import TagDetail from './pages/TagDetail';
import Archives from './pages/Archives';
import Albums from './pages/Albums';
import AlbumDetail from './pages/AlbumDetail';

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const siteConfig = useSiteConfig();
  const albumConfig = useAlbumConfig();

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
          <Route path="/archives" element={<Archives />} />
          <Route path="/archives/:year" element={<Archives />} />
          <Route path="/archives/:year/:month" element={<Archives />} />
          <Route path="/albums" element={albumConfig.enabled ? <Albums /> : <Navigate to="/" replace />} />
          <Route path="/albums/:dirname" element={albumConfig.enabled ? <AlbumDetail /> : <Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
