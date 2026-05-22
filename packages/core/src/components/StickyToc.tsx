import React, { useState, useEffect, useRef } from 'react';
import TableOfContents from './TableOfContents';

interface StickyTocProps {
  content: string;
  visible: boolean;
}

const StickyToc: React.FC<StickyTocProps> = ({ content, visible }) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Collapse when hidden
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  // Auto-collapse on outside pointer or page scroll (not TOC internal scroll)
  useEffect(() => {
    if (!expanded) return;
    let armed = false;
    const raf = requestAnimationFrame(() => { armed = true; });
    const collapse = () => { if (armed) setExpanded(false); };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (armed && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    // Use document scroll (captures page scroll but not internal overflow scroll)
    document.addEventListener('scroll', collapse, { passive: true });
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('mousedown', onPointer);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', collapse);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [expanded]);

  if (!visible) return null;

  return (
    <div ref={containerRef} className="xl:hidden fixed top-0 left-0 w-full z-50 shadow-md animate-slide-down [&>nav]:rounded-none [&>nav]:border-x-0 [&>nav]:border-t-0">
      <TableOfContents
        content={content}
        collapsible
        compact
        expanded={expanded}
        onExpandChange={setExpanded}
      />
    </div>
  );
};

export default React.memo(StickyToc);
