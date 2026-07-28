import React, { useEffect, useState } from 'react';
import { Archive, CheckCircle2, FolderOpen } from 'lucide-react';
import { ApprovedDesignLibrary } from '../components/ApprovedDesignLibrary';
import { useLanguage } from '../context/LanguageContext';
import { DesignPOLike, DesignRecord, DesignVersion } from '../domain/designWorkflow';
import { dbService, UserProfile } from '../services/firebaseService';
import '../components/CustomerHistory.css';
import './Design.css';

interface DesignLibraryProps {
  pos: DesignPOLike[];
  currentUser: UserProfile;
}

export const DesignLibrary: React.FC<DesignLibraryProps> = ({ pos, currentUser }) => {
  const { t } = useLanguage();
  const [designs, setDesigns] = useState<DesignRecord[]>([]);

  useEffect(() => dbService.subscribeCollection('designs', data => setDesigns(data as DesignRecord[])), []);

  const approvedCount = designs.filter(design => design.status === 'approved').length;
  const versionCount = designs.reduce((total, design) => total + (design.versions?.length || (design.fileUrl ? 1 : 0)), 0);
  const sourceFileCount = designs.reduce((total, design) => total + (design.versions || []).filter((version: DesignVersion) => (
    version.aiLink || version.corelLink
  )).length, 0);

  return (
    <div className="design-library-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('KHO THIẾT KẾ & LAYOUT')}</h1>
          <p className="page-subtitle">{t('Kho tài sản thiết kế của công ty, lưu mẫu chuẩn theo mã khách hàng, sản phẩm và phiên bản.')}</p>
        </div>
      </div>

      <div className="design-library-metrics">
        <div className="design-metric-card">
          <CheckCircle2 size={20} />
          <div><strong>{approvedCount}</strong><span>{t('Mẫu đã được khách hàng duyệt')}</span></div>
        </div>
        <div className="design-metric-card">
          <Archive size={20} />
          <div><strong>{versionCount}</strong><span>{t('Phiên bản đang được lưu trữ')}</span></div>
        </div>
        <div className="design-metric-card">
          <FolderOpen size={20} />
          <div><strong>{sourceFileCount}</strong><span>{t('Phiên bản có file thiết kế gốc')}</span></div>
        </div>
      </div>

      <ApprovedDesignLibrary designs={designs} pos={pos} currentUser={currentUser} />
    </div>
  );
};
