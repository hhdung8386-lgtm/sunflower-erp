import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PageBackButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  className?: string;
}

export const PageBackButton: React.FC<PageBackButtonProps> = ({
  onClick,
  label,
  title,
  className = ''
}) => {
  const { t } = useLanguage();
  const buttonLabel = label || t('Quay lại');

  return (
    <button
      type="button"
      className={`app-back-button ${className}`.trim()}
      onClick={onClick}
      title={title || buttonLabel}
    >
      <span className="app-back-button__icon"><ArrowLeft size={15} /></span>
      <span>{buttonLabel}</span>
    </button>
  );
};
