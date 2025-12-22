import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      "nav": {
        "home": "Home",
        "tags": "Tags",
        "categories": "Categories"
      },
      "common": {
        "readMore": "Read more",
        "postNotFound": "Post not found",
        "loading": "Loading...",
        "toc": "Table of Contents",
        "prevPost": "Previous Post",
        "nextPost": "Next Post",
        "tags": "Tags",
        "archives": "Archives",
        "year": "Year",
        "month": "Month",
        "noPosts": "No posts found.",
        "searchPlaceholder": "Type to search...",
        "noResults": "No matching posts found.",
        "categories": "Categories"
      },
      "titles": {
        "categories": "Categories",
        "tags": "Tags"
      }
    }
  },
  zh: {
    translation: {
      "nav": {
        "home": "首页",
        "tags": "标签",
        "categories": "分类"
      },
      "common": {
        "readMore": "阅读更多",
        "postNotFound": "文章未找到",
        "loading": "加载中...",
        "toc": "目录",
        "prevPost": "上一篇",
        "nextPost": "下一篇",
        "tags": "标签",
        "archives": "归档",
        "year": "年",
        "month": "月",
        "noPosts": "暂无文章。",
        "searchPlaceholder": "输入关键字搜索...",
        "noResults": "未找到匹配的文章。",
        "categories": "分类"
      },
      "titles": {
        "categories": "文章分类",
        "tags": "文章标签"
      }
    }
  },
  ja: {
    translation: {
      "nav": {
        "home": "ホーム",
        "tags": "タグ",
        "categories": "カテゴリー"
      },
      "common": {
        "readMore": "続きを読む",
        "postNotFound": "記事が見つかりません",
        "loading": "読み込み中...",
        "toc": "目次",
        "prevPost": "前の記事",
        "nextPost": "次の記事",
        "tags": "タグ",
        "archives": "アーカイブ",
        "year": "年",
        "month": "月",
        "noPosts": "記事が見つかりません。",
        "searchPlaceholder": "検索キーワードを入力...",
        "noResults": "一致する記事が見つかりません。",
        "categories": "カテゴリー"
      },
      "titles": {
        "categories": "カテゴリー",
        "tags": "タグ"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    },
    detection: {
      // order and from where user language should be detected
      order: ['localStorage', 'navigator'],
      // keys or params to lookup language from
      lookupLocalStorage: 'i18nextLng',
      // cache user language on
      caches: ['localStorage'],
    }
  });

export default i18n;
