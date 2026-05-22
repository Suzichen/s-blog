import React from 'react';
import LazyImage from './LazyImage';

interface ImageWithCaptionProps {
  src?: string;
  alt?: string;
  title?: string;
  onClick?: () => void;
}

const ImageWithCaption: React.FC<ImageWithCaptionProps> = ({ src, alt, title, onClick }) => {
  const caption = title || alt || '';

  return (
    <figure className="post-figure">
      <LazyImage
        src={src}
        alt={alt}
        title={title}
        className="cursor-pointer"
        onClick={onClick}
      />
      {caption && (
        <figcaption>
          <span className="figcaption-icon">✏️</span> {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default ImageWithCaption;
