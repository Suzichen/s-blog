import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button 
        onClick={() => changeLanguage('zh')} 
        style={{ fontWeight: i18n.resolvedLanguage === 'zh' ? 'bold' : 'normal', border: 'none', background: 'none', cursor: 'pointer', padding: '0 5px' }}
      >
        中
      </button>
      <span style={{color: '#ccc'}}>|</span>
      <button 
        onClick={() => changeLanguage('en')} 
        style={{ fontWeight: i18n.resolvedLanguage?.startsWith('en') ? 'bold' : 'normal', border: 'none', background: 'none', cursor: 'pointer', padding: '0 5px' }}
      >
        En
      </button>
      <span style={{color: '#ccc'}}>|</span>
      <button 
        onClick={() => changeLanguage('ja')} 
        style={{ fontWeight: i18n.resolvedLanguage === 'ja' ? 'bold' : 'normal', border: 'none', background: 'none', cursor: 'pointer', padding: '0 5px' }}
      >
        日
      </button>
    </div>
  );
};

export default LanguageSwitcher;
