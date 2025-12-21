import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import postsData from '@/generated/manifest.json';
import type { PostMetadata } from '@/types/blog';

const posts: PostMetadata[] = postsData as PostMetadata[];

const ArchiveSidebar: React.FC = () => {
    const { t } = useTranslation();
    const { year: activeYear, month: activeMonth } = useParams<{ year?: string; month?: string }>();

    // Group by Year and Month
    const archives = useMemo(() => {
        const groups: Record<string, { count: number; months: Record<string, number> }> = {};

        posts.forEach((post) => {
            const date = new Date(post.date);
            const year = format(date, 'yyyy');
            const month = format(date, 'MM');

            if (!groups[year]) {
                groups[year] = { count: 0, months: {} };
            }
            groups[year].count++;
            groups[year].months[month] = (groups[year].months[month] || 0) + 1;
        });

        // Convert to sorted array
        return Object.entries(groups)
            .sort((a, b) => Number(b[0]) - Number(a[0])) // Descending Year
            .map(([year, data]) => ({
                year,
                count: data.count,
                months: Object.entries(data.months)
                    .sort((a, b) => Number(b[0]) - Number(a[0])) // Descending Month
                    .map(([month, count]) => ({
                        month,
                        count,
                    })),
            }));
    }, []);

    return (
        <div>
            <h3 className="text-base font-bold text-primary mb-6 flex items-center gap-2">
                <span className="text-xl">🗂</span> {t('common.archives', 'Archives')}
            </h3>

            <div className="flex flex-col gap-6">
                {/* Years List (Primary Filter) */}
                <div className="space-y-1">
                    {archives.map(({ year, count }) => (
                        <Link
                            key={year}
                            to={`/archives/${year}`}
                            className={`block px-3 py-2 rounded text-sm transition-colors flex justify-between items-center ${activeYear === year && !activeMonth
                                    ? 'bg-primary text-bg font-bold'
                                    : 'text-secondary hover:text-primary hover:bg-bg-secondary'
                                }`}
                        >
                            <span>{year} {t('common.year', 'Year')}</span>
                            <span className="opacity-70 text-xs">({count})</span>
                        </Link>
                    ))}
                </div>

                {/* Expanded Months List (if year is active, or just generic "All Months" list if desired) 
            Based on screenshot, it seems to list specific months directly.
            Let's list top 5 recent months globaly or stick to Year -> Month drilldown.
            User asked for Year navigation AND Month navigation. 
            Let's render a flattened view of "Recent Months" or similar if that helps, 
            but strictly following the request: "Layout like screenshot".
            Screenshot has a sidebar with "2023/9", "2023年11月", etc.
            This implies a mix. I will render the years tree expanded for the active year?
            Or just list all Year-Months? 
            Let's trying listing all Year-Months grouped by Year visually.
        */}
                <div className="border-t border-border pt-6">
                    {archives.map(({ year, months }) => (
                        <div key={`month-group-${year}`} className="mb-4">
                            <div className="text-xs font-bold text-secondary uppercase mb-2 ml-3 opacity-60">{year}</div>
                            {months.map(({ month, count }) => {
                                const isSelected = activeYear === year && activeMonth === month;
                                return (
                                    <Link
                                        key={`${year}-${month}`}
                                        to={`/archives/${year}/${month}`}
                                        className={`block px-3 py-1.5 rounded text-sm transition-colors flex justify-between items-center ${isSelected
                                                ? 'bg-accent text-white font-bold'
                                                : 'text-secondary hover:text-accent hover:bg-bg-secondary'
                                            }`}
                                    >
                                        <span>{month} {t('common.month', 'Month')}</span>
                                        <span className="opacity-70 text-xs">({count})</span>
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ArchiveSidebar;
