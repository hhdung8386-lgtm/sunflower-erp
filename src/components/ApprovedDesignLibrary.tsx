import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileArchive, Image as ImageIcon, Search } from 'lucide-react';
import './CustomerHistory.css';

interface DesignVersion {
  versionNumber?: number;
  previewImage?: string;
  aiLink?: string;
  corelLink?: string;
  comment?: string;
  feedbackAt?: string;
  createdAt?: string;
}

interface DesignRecord {
  id: string;
  poId: string;
  status?: string;
  currentVersion?: number;
  versions?: DesignVersion[];
  fileUrl?: string;
  aiLink?: string;
  corelLink?: string;
  notes?: string;
  updatedAt?: string;
}

interface POItemRecord {
  productCode?: string;
  productName?: string;
  size?: string;
  material?: string;
  specifications?: Record<string, unknown>;
}

interface PORecord {
  id: string;
  poCode?: string;
  customerId?: string;
  customerName?: string;
  items?: POItemRecord[];
}

interface ApprovedDesignLibraryProps {
  designs: DesignRecord[];
  pos: PORecord[];
}

interface ApprovedTemplate {
  design: DesignRecord;
  po: PORecord;
  item: POItemRecord;
  version: DesignVersion;
}

const formatDate = (value?: string): string => {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleDateString('vi-VN');
};

export const ApprovedDesignLibrary: React.FC<ApprovedDesignLibraryProps> = ({ designs, pos }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');

  const approvedTemplates = useMemo<ApprovedTemplate[]>(() => designs
    .filter(design => design.status === 'approved' && ((design.versions?.length || 0) > 0 || !!design.fileUrl))
    .map(design => {
      const po = pos.find(candidate => candidate.id === design.poId);
      const version = design.versions?.[design.versions.length - 1] || (design.fileUrl ? {
        versionNumber: design.currentVersion || 1,
        previewImage: design.fileUrl,
        aiLink: design.aiLink,
        corelLink: design.corelLink,
        comment: design.notes,
        createdAt: design.updatedAt
      } : undefined);
      if (!po || !version) return null;
      return { design, po, item: po.items?.[0] || {}, version };
    })
    .filter((template): template is ApprovedTemplate => template !== null)
    .sort((a, b) => {
      const aDate = new Date(a.version.feedbackAt || a.design.updatedAt || a.version.createdAt || 0).getTime();
      const bDate = new Date(b.version.feedbackAt || b.design.updatedAt || b.version.createdAt || 0).getTime();
      return bDate - aDate;
    }), [designs, pos]);

  const customers = useMemo(() => Array.from(new Map(
    approvedTemplates.map(template => [template.po.customerId || template.po.customerName, {
      id: template.po.customerId || template.po.customerName || '',
      name: template.po.customerName || 'Chưa xác định'
    }])
  ).values()).filter(customer => customer.id), [approvedTemplates]);

  const filteredTemplates = approvedTemplates.filter(template => {
    const haystack = [
      template.po.customerName,
      template.po.poCode,
      template.item.productCode,
      template.item.productName,
      template.item.size,
      template.item.material
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi');
    const matchesSearch = haystack.includes(searchQuery.trim().toLocaleLowerCase('vi'));
    const matchesCustomer = customerFilter === 'all' || (template.po.customerId || template.po.customerName) === customerFilter;
    return matchesSearch && matchesCustomer;
  });

  return (
    <div className="approved-library">
      <div className="card approved-library__intro">
        <div>
          <span className="card-title">KHO MẪU THIẾT KẾ ĐÃ DUYỆT</span>
          <p>Tìm lại mẫu chuẩn theo khách hàng, mã hàng hoặc PO cũ. Đơn đặt lại sẽ tự sao chép mẫu vào phiên bản mới để kiểm tra và xác nhận.</p>
        </div>
        <div className="approved-library__count">
          <CheckCircle2 size={20} />
          <strong>{approvedTemplates.length}</strong>
          <span>mẫu đã duyệt</span>
        </div>
      </div>

      <div className="card approved-library__filters">
        <div className="approved-library__search">
          <Search size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Tìm khách hàng, mã hàng, tên sản phẩm hoặc PO..."
          />
        </div>
        <select value={customerFilter} onChange={event => setCustomerFilter(event.target.value)}>
          <option value="all">Tất cả khách hàng</option>
          {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </div>

      <div className="approved-library__grid">
        {filteredTemplates.map(({ design, po, item, version }) => (
          <article className="approved-template-card" key={design.id}>
            <div className="approved-template-card__preview">
              {version.previewImage ? (
                <img src={version.previewImage} alt={`Mẫu ${item.productName || po.poCode || ''}`} />
              ) : (
                <div className="approved-template-card__placeholder"><ImageIcon size={30} /><span>Chưa có ảnh xem trước</span></div>
              )}
              <span className="approved-template-card__status"><CheckCircle2 size={13} /> Đã duyệt</span>
            </div>
            <div className="approved-template-card__body">
              <div className="approved-template-card__customer">{po.customerName || 'Chưa xác định khách hàng'}</div>
              <h3>{item.productName || 'Sản phẩm chưa đặt tên'}</h3>
              <div className="approved-template-card__code">{item.productCode || 'Chưa có mã hàng'} · {po.poCode || 'PO chưa xác định'}</div>
              <dl>
                <div><dt>Quy cách</dt><dd>{item.size || 'Chưa khai báo'}</dd></div>
                <div><dt>Chất liệu</dt><dd>{item.material || 'Chưa khai báo'}</dd></div>
                <div><dt>Phiên bản</dt><dd>v{version.versionNumber || design.currentVersion || 1}</dd></div>
                <div><dt>Ngày duyệt</dt><dd>{formatDate(version.feedbackAt || design.updatedAt || version.createdAt)}</dd></div>
              </dl>
              {version.comment && <p className="approved-template-card__note">{version.comment}</p>}
              <div className="approved-template-card__links">
                {version.aiLink && <a href={version.aiLink} target="_blank" rel="noopener noreferrer"><FileArchive size={14} /> File AI</a>}
                {version.corelLink && <a href={version.corelLink} target="_blank" rel="noopener noreferrer"><FileArchive size={14} /> File Corel</a>}
                {!version.aiLink && !version.corelLink && <span>Chưa có liên kết file gốc</span>}
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="card approved-library__empty">
          <ImageIcon size={32} />
          <strong>Chưa tìm thấy mẫu thiết kế đã duyệt</strong>
          <span>Mẫu sẽ tự xuất hiện ở đây sau khi khách hàng phê duyệt thiết kế.</span>
        </div>
      )}
    </div>
  );
};
