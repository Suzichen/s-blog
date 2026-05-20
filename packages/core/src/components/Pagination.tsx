import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

function getPageUrl(page: number): string {
  return page === 1 ? '/' : `/page/${page}`;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('...');
  pages.push(total);

  return pages;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages }) => {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav className="flex items-center justify-between border-t border-border pt-6 mt-12" aria-label="Pagination">
      <div className="shrink-0">
        {currentPage > 1 && (
          <Link to={getPageUrl(currentPage - 1)} className="text-accent hover:underline no-underline">
            {t('pagination.prev')}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 mx-2 overflow-hidden">
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 sm:px-2 text-secondary">…</span>
          ) : page === currentPage ? (
            <span key={page} className="px-1.5 sm:px-2 font-bold text-primary">{page}</span>
          ) : (
            <Link key={page} to={getPageUrl(page)} className="px-1.5 sm:px-2 text-accent hover:underline no-underline">
              {page}
            </Link>
          )
        )}
      </div>

      <div className="shrink-0 text-right">
        {currentPage < totalPages && (
          <Link to={getPageUrl(currentPage + 1)} className="text-accent hover:underline no-underline">
            {t('pagination.next')}
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Pagination;
