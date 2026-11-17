import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-900/10 via-slate-100 to-blue-800/15 dark:from-blue-950 dark:via-slate-900 dark:to-slate-800 text-slate-500 dark:text-slate-400 p-4 text-center ${className}`}
      >
        <ImageIcon className="w-7 h-7 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium line-clamp-2 max-w-[200px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
