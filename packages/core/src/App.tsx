
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSiteConfig, useAlbumConfig } from './context';
import Layout from './components/Layout';

// Lazy-load route-level pages for code splitting
const Home = React.lazy(() => import('./pages/Home'));
const PostDetail = React.lazy(() => import('./pages/PostDetail'));
const CategoryDetail = React.lazy(() => import('./pages/CategoryDetail'));
const TagDetail = React.lazy(() => import('./pages/TagDetail'));
const Archives = React.lazy(() => import('./pages/Archives'));
const Albums = React.lazy(() => import('./pages/Albums'));
const AlbumDetail = React.lazy(() => import('./pages/AlbumDetail'));

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
        <Suspense fallback={<div className="w-full max-w-[800px] mx-auto py-8 text-center text-secondary"></div>}>
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
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
