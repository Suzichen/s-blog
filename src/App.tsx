
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { siteConfig } from './config';
import Layout from './components/Layout';

const Home = React.lazy(() => import('./pages/Home'));
const PostDetail = React.lazy(() => import('./pages/PostDetail'));
const CategoryDetail = React.lazy(() => import('./pages/CategoryDetail'));
const TagDetail = React.lazy(() => import('./pages/TagDetail'));
const Archives = React.lazy(() => import('./pages/Archives'));

const App: React.FC = () => {
  const { i18n, t } = useTranslation();

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
        <React.Suspense fallback={<div className="flex justify-center py-20 animate-pulse">{t('common.loading') || 'Loading...'}</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:slug" element={<PostDetail />} />
            <Route path="/categories/:category" element={<CategoryDetail />} />
            <Route path="/tags/:tag" element={<TagDetail />} />
            <Route path="/archives" element={<Archives />} />
            <Route path="/archives/:year" element={<Archives />} />
            <Route path="/archives/:year/:month" element={<Archives />} />
          </Routes>
        </React.Suspense>
      </Layout>
    </Router>
  );
};

export default App;
