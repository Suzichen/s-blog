import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GithubSlugger from 'github-slugger';
import { useNavigate, useLocation } from 'react-router-dom';

interface TableOfContentsProps {
  content: string;
  collapsible?: boolean;
  compact?: boolean;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, collapsible = false, compact = false, expanded: controlledExpanded, onExpandChange }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;
  const toggleExpanded = () => {
    const next = !isExpanded;
    if (isControlled) {
      onExpandChange?.(next);
    } else {
      setInternalExpanded(next);
    }
  };
  const slugger = new GithubSlugger();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    slugger.reset();

    const lines = content.split(/\r?\n/);
    const matches: Heading[] = [];
    let inCodeBlock = false;

    // Helper to strip markdown formatting
    const stripMarkdown = (markdown: string) => {
        return markdown
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/(\*|_)(.*?)\1/g, '$2');
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) continue;

        let level = 0;
        let text = '';

        const atxMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (atxMatch) {
            level = atxMatch[1].length;
            text = atxMatch[2].trim();
        } 
        else if (i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/^=+$/) && trimmedLine.length > 0) {
                level = 1;
                text = trimmedLine;
            } else if (nextLine.match(/^-+$/) && trimmedLine.length > 0) {
                level = 2;
                text = trimmedLine;
            }
        }

        if (level > 0 && level <= 6) { 
            const cleanText = stripMarkdown(text);
            const id = slugger.slug(cleanText);
            matches.push({ level, text: cleanText, id });
        }
    }

    setHeadings(matches);
  }, [content]);

  if (headings.length === 0) {
    return null;
  }

  const tocList = (
    <ul className="list-none p-0 m-0">
      {headings.map((heading) => (
        <li 
          key={heading.id} 
          className="mb-0 leading-tight"
          style={{ marginLeft: `${(heading.level - 1) * 1}rem` }}
        >
          <a 
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`${location.pathname}#${heading.id}`);
              }}
              className="block py-[2px] text-sm text-accent hover:text-blue-600 hover:underline transition-colors no-underline"
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );

  if (collapsible) {
    return (
      <nav className={`bg-bg-alt border border-border rounded ${compact ? 'p-2' : 'p-4'}`} aria-label="Table of Contents">
        <button
          onClick={toggleExpanded}
          className={`flex items-center gap-2 w-full text-left font-bold text-primary bg-transparent border-none cursor-pointer p-0 ${compact ? 'text-sm' : ''}`}
        >
          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
          <span>{t('common.toc')}</span>
        </button>
        {isExpanded && <div className={compact ? 'mt-2 max-h-[60vh] overflow-y-auto overscroll-contain' : 'mt-3'}>{tocList}</div>}
      </nav>
    );
  }

  return (
    <nav className="toc" aria-label="Table of Contents">
      <h2 className="text-xl font-bold mb-4 text-primary">{t('common.toc')}</h2>
      {tocList}
    </nav>
  );
};

export default TableOfContents;
