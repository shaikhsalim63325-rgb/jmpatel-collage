import React from 'react';

interface CollegeLogoProps {
  className?: string;
}

export const CollegeLogo: React.FC<CollegeLogoProps> = ({ className = 'w-9 h-9' }) => {
  return (
    <img
      src="/assets/aistudio/image_7a27b95d.png"
      alt="SKM'S J.M. Patel College of Commerce Logo"
      referrerPolicy="no-referrer"
      className={`bg-white rounded-xl p-0.5 object-contain border border-slate-200/80 dark:border-slate-700 ${className}`}
    />
  );
};
