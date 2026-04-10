import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GithubSlugger from 'github-slugger';

interface TableOfContentsProps {
  content: string;
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const slugger = new GithubSlugger();
  const { t } = useTranslation();

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

  return (
    <nav className="toc" aria-label="Table of Contents">
      <h2 className="text-xl font-bold mb-4 text-primary">{t('common.toc')}</h2>
      <ul className="list-none p-0 m-0">
        {headings.map((heading) => (
          <li 
            key={heading.id} 
            className="mb-0 leading-tight"
            style={{ marginLeft: `${(heading.level - 1) * 1}rem` }}
          >
            <a 
                href={`#${heading.id}`}
                className="block py-[2px] text-sm text-accent hover:text-blue-600 hover:underline transition-colors no-underline"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TableOfContents;
