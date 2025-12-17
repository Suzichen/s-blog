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

  useEffect(() => {
    // Reset slugger for new content
    slugger.reset();

    const lines = content.split(/\r?\n/);
    const matches: Heading[] = [];
    let inCodeBlock = false;

    // Helper to strip markdown formatting for slug generation matches rehype-slug
    const stripMarkdown = (markdown: string) => {
        return markdown
            // Strip links: [text](url) -> text
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            // Strip bold/italic: **text** or __text__ -> text
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            // Strip code: `text` -> text
            .replace(/`([^`]+)`/g, '$1')
            // Strip *text* or _text_
            .replace(/(\*|_)(.*?)\1/g, '$2');
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Code block detection
        if (trimmedLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) continue;

        let level = 0;
        let text = '';

        // ATX Headings (e.g. # Title)
        const atxMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (atxMatch) {
            level = atxMatch[1].length;
            text = atxMatch[2].trim();
        } 
        // Setext Headings
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

  const { t } = useTranslation();

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="toc" aria-label="Table of Contents">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 'bold' }}>{t('common.toc')}</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {headings.map((heading) => (
          <li 
            key={heading.id} 
            style={{ 
              marginBottom: '0', 
              marginLeft: `${(heading.level - 1) * 1}rem`,
              lineHeight: '1.2'
            }}
          >
            <a 
                href={`#${heading.id}`}
                style={{ 
                    textDecoration: 'none', 
                    color: '#007bff',
                    fontSize: '0.85rem',
                    display: 'block',
                    padding: '1px 0'
                }}
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
