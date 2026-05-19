import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const LazyImage: React.FC<LazyImageProps> = (props) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <img
      ref={imgRef}
      {...props}
      src={isIntersecting ? props.src : undefined}
      data-src={props.src}
      className={`${props.className || ''} ${!isIntersecting ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
      style={{
        ...props.style,
        minHeight: !isIntersecting ? '200px' : undefined,
      }}
    />
  );
};

export default LazyImage;
