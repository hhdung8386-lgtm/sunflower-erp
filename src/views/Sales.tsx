import React, { useState } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';

interface SalesProps {
  pos: any[];
  customers: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

// The 15 standard states from the requirements document
export const PO_STATES = [
  { value: 'receive_po', label: 'Đã nhận PO' },
  { value: 'bom_extracted', label: 'Đã bóc tách NVL' },
  { value: 'design_sent', label: 'Đã gửi thiết kế' },
  { value: 'layout_pending', label: 'Chờ khách duyệt' },
  { value: 'supplier_ordered', label: 'Đã đặt hàng NCC' },
  { value: 'supplier_confirmed', label: 'NCC xác nhận' },
  { value: 'production_pending', label: 'Chờ sản xuất' },
  { value: 'producing', label: 'Đang sản xuất' },
  { value: 'production_done', label: 'Sản xuất xong' },
  { value: 'qc_passed', label: 'QC hoàn thành' },
  { value: 'packed', label: 'Đã đóng gói' },
  { value: 'delivering', label: 'Đang giao hàng' },
  { value: 'delivered', label: 'Khách đã nhận' },
  { value: 'invoiced', label: 'Đã xuất hóa đơn' },
  { value: 'debt_collected', label: 'Đã thu công nợ' }
];

export const Sales: React.FC<SalesProps> = ({ pos, customers, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form fields (Create PO)
  const [customerId, setCustomerId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Product item fields
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [material, setMaterial] = useState('Decal giấy');
  const [quantity, setQuantity] = useState(1000);
  const [price, setPrice] = useState(1000);
  const [base64Image, setBase64Image] = useState<string>('');
  
  // External drive links
  const [pdfLink, setPdfLink] = useState('');
  const [excelLink, setExcelLink] = useState('');
  const [aiLink, setAiLink] = useState('');
  const [corelLink, setCorelLink] = useState('');
  const [contractLink, setContractLink] = useState('');
  const [quoteLink, setQuoteLink] = useState('');

  // Edit PO Form States
  const [editExpectedDeliveryDate, setEditExpectedDeliveryDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editMaterial, setEditMaterial] = useState('Decal giấy');
  const [editQuantity, setEditQuantity] = useState(1000);
  const [editPrice, setEditPrice] = useState(1000);
  const [editBase64Image, setEditBase64Image] = useState('');
  const [editPdfLink, setEditPdfLink] = useState('');
  const [editExcelLink, setEditExcelLink] = useState('');
  const [editAiLink, setEditAiLink] = useState('');
  const [editCorelLink, setEditCorelLink] = useState('');
  const [editContractLink, setEditContractLink] = useState('');
  const [editQuoteLink, setEditQuoteLink] = useState('');

  const handleOpenEditModal = (po: any) => {
    setEditExpectedDeliveryDate(new Date(po.expectedDeliveryDate).toISOString().split('T')[0]);
    setEditNotes(po.notes || '');
    const item = po.items[0] || {};
    setEditProductName(item.productName || '');
    setEditSize(item.size || '');
    setEditMaterial(item.material || 'Decal giấy');
    setEditQuantity(item.quantity || 1000);
    setEditPrice(item.price || 1000);
    setEditBase64Image(item.previewImage || '');
    setEditPdfLink(po.links?.pdfLink || '');
    setEditExcelLink(po.links?.excelLink || '');
    setEditAiLink(po.links?.aiLink || '');
    setEditCorelLink(po.links?.corelLink || '');
    setEditContractLink(po.links?.contractLink || '');
    setEditQuoteLink(po.links?.quoteLink || '');
    setSelectedPO(po);
    setShowEditModal(true);
  };

  const handleEditPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO || !editProductName || !editQuantity || !editPrice) return;

    const subtotal = Number(editQuantity) * Number(editPrice);
    const customer = customers.find(c => c.id === selectedPO.customerId);
    const discountRate = customer ? customer.discountRate : 0;
    const discountAmount = Math.round(subtotal * (discountRate / 100));
    const netAmount = subtotal - discountAmount;

    const updatedLogs = [
      ...selectedPO.historyLogs,
      {
        status: selectedPO.status,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `${t('Chỉnh sửa thông số đơn hàng')} (SL: ${editQuantity}, ĐG: ${editPrice})`
      }
    ];

    await dbService.updateDocument('pos', selectedPO.id, {
      expectedDeliveryDate: new Date(editExpectedDeliveryDate).toISOString(),
      notes: editNotes,
      items: [
        {
          ...selectedPO.items[0],
          productName: editProductName,
          size: editSize,
          material: editMaterial,
          quantity: Number(editQuantity),
          price: Number(editPrice),
          totalAmount: subtotal,
          previewImage: editBase64Image
        }
      ],
      totalAmount: subtotal,
      discountAmount,
      netAmount,
      links: {
        pdfLink: editPdfLink,
        excelLink: editExcelLink,
        aiLink: editAiLink,
        corelLink: editCorelLink,
        contractLink: editContractLink,
        quoteLink: editQuoteLink
      },
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString(),
      historyLogs: updatedLogs
    });

    setShowEditModal(false);
    setSelectedPO(null);
    onRefresh();
  };

  const handleDeletePO = async (poId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa đơn hàng PO này?'))) {
      await dbService.deleteDocument('pos', poId);
      setSelectedPO(null);
      onRefresh();
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setEditBase64Image(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Logic to process file uploads on client and convert to Base64 String
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize & compress image
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 70% quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setBase64Image(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModal = () => {
    setCustomerId(customers[0]?.id || '');
    setExpectedDeliveryDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setNotes('');
    setProductName('');
    setSize('100x100mm');
    setMaterial('Decal giấy');
    setQuantity(10000);
    setPrice(500);
    setBase64Image('');
    setPdfLink('');
    setExcelLink('');
    setAiLink('');
    setCorelLink('');
    setContractLink('');
    setQuoteLink('');
    setShowAddModal(true);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !productName || !quantity || !price) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Calculations
    const subtotal = quantity * price;
    const discountAmount = Math.round(subtotal * (customer.discountRate / 100));
    const netAmount = subtotal - discountAmount;
    const poCode = `PO-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPO = {
      poCode,
      customerId,
      customerName: customer.companyName,
      saleId: currentUser.uid,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(expectedDeliveryDate).toISOString(),
      status: 'receive_po',
      items: [
        {
          itemId: `item-${Math.random().toString(36).substr(2, 9)}`,
          productName,
          size,
          material,
          quantity: Number(quantity),
          price: Number(price),
          totalAmount: subtotal,
          previewImage: base64Image
        }
      ],
      totalAmount: subtotal,
      discountAmount,
      netAmount,
      links: {
        pdfLink,
        excelLink,
        aiLink,
        corelLink,
        contractLink,
        quoteLink
      },
      notes,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString(),
      updatedBy: '',
      updatedAt: '',
      historyLogs: [
        {
          status: 'receive_po',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: 'Khởi tạo đơn hàng mới trên ERP'
        }
      ]
    };

    // Update customer last order timestamp
    await dbService.addDocument('pos', newPO);
    await dbService.updateDocument('customers', customerId, {
      lastOrderAt: new Date().toISOString()
    });

    setShowAddModal(false);
    onRefresh();
  };

  const updatePOStatus = async (poId: string, newStatus: string) => {
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    const updatedLogs = [
      ...po.historyLogs,
      {
        status: newStatus,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Cập nhật trạng thái đơn hàng sang: ${PO_STATES.find(s => s.value === newStatus)?.label}`
      }
    ];

    await dbService.updateDocument('pos', poId, {
      status: newStatus,
      historyLogs: updatedLogs
    });

    // If status is "delivered", also create invoice automatically
    if (newStatus === 'delivered') {
      const invoiceCode = `INV-${po.poCode.replace('PO-','')}`;
      await dbService.addDocument('invoices', {
        invoiceCode,
        poId: po.id,
        customerId: po.customerId,
        type: 'receivable',
        amount: po.netAmount,
        paidAmount: 0,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    setSelectedPO((prev: any) => prev ? { ...prev, status: newStatus, historyLogs: updatedLogs } : null);
    onRefresh();
  };

  const filteredPOs = pos.filter(po => 
    po.poCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.items.some((i: any) => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="sales-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('TIẾP NHẬN ĐƠN HÀNG (SALES PO)')}</h1>
          <p className="page-subtitle">{t('Tạo đơn hàng PO mới, theo dõi 15 trạng thái sản xuất và quản lý file thiết kế, thông số kỹ thuật.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={handleOpenAddModal}>{t('TẠO ĐƠN HÀNG PO MỚI')}</button>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder={t('Nhập mã PO, tên sản phẩm hoặc khách hàng...')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
          <button className="btn btn-outline" onClick={() => setSearchTerm('')}>{t('Xóa Tìm Kiếm')}</button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã PO')}</th>
                <th>{t('Tên Công Ty')}</th>
                <th>{t('Sản Phẩm')}</th>
                <th>{t('Số Lượng')}</th>
                <th>{t('Thành Tiền')}</th>
                <th>{t('Ngày Giao Dự Kiến')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map(po => {
                const item = po.items[0] || {};
                return (
                  <tr key={po.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPO(po)}>
                    <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                    <td>{po.customerName}</td>
                    <td style={{ fontWeight: 500 }}>{item.productName}</td>
                    <td>{item.quantity?.toLocaleString()}</td>
                    <td>{po.netAmount?.toLocaleString()} đ</td>
                    <td>{new Date(po.expectedDeliveryDate).toLocaleDateString(t('vi-VN'))}</td>
                    <td>
                      <span className={`badge ${
                        po.status === 'delivered' || po.status === 'debt_collected' ? 'badge-success' :
                        po.status === 'producing' ? 'badge-info' : 'badge-warning'
                      }`}>{t(PO_STATES.find(s => s.value === po.status)?.label || '')}</span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedPO(po)}>{t('Chi Tiết')}</button>
                    </td>
                  </tr>
                );
              })}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>{t('Không tìm thấy đơn hàng PO nào.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO DETAIL PANEL WITH 15-STATE TIMELINE */}
      {selectedPO && (
        <div className="details-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                {t('CHI TIẾT TIẾN ĐỘ PO')}: {selectedPO.poCode} - {selectedPO.customerName}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={() => handleOpenEditModal(selectedPO)}>{t('Sửa')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePO(selectedPO.id)}>{t('Xóa')}</button>
                  </>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedPO(null)}>{t('Đóng chi tiết')}</button>
              </div>
            </div>

            {/* Status changer for authorized roles */}
            {(currentUser.role === 'admin' || currentUser.role === 'sale' || currentUser.role === 'producer') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600 }}>{t('Cập nhật nhanh tiến độ PO:')}</span>
                <select 
                  value={selectedPO.status} 
                  onChange={(e) => updatePOStatus(selectedPO.id, e.target.value)}
                  style={{ width: '220px' }}
                >
                  {PO_STATES.map(state => (
                    <option key={state.value} value={state.value}>{t(state.label)}</option>
                  ))}
                </select>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('* Sẽ tự động ghi lại nhật ký xử lý đơn')}</span>
              </div>
            )}

            {/* HORIZONTAL TIMELINE DISPLAY (15 States) */}
            <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
              <div className="order-progress-timeline" style={{ minWidth: '1500px' }}>
                {PO_STATES.map((state, idx) => {
                  const currentIdx = PO_STATES.findIndex(s => s.value === selectedPO.status);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;

                  return (
                    <div 
                      key={state.value} 
                      className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                    >
                      <div className="step-bubble">{isCompleted ? '✓' : idx + 1}</div>
                      <span className="step-label">{t(state.label)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="details-grid">
              {/* Product specifications and mock preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Thông số kỹ thuật đơn hàng:')}</h3>
                  <table style={{ border: 'none' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Tên Sản Phẩm Nhãn *')}:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.productName}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Kích Thước Quy Cách *')}:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.size}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Nguyên Vật Liệu *')}:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.material}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Số Lượng Đặt In *')}:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.quantity?.toLocaleString()} {t('tem')}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Đơn Giá In *')}:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.price?.toLocaleString()} đ/{t('tem')}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>{t('Thành Tiền Sau Chiết Khấu')}:</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary)', border: 'none', padding: '6px 0' }}>
                          {selectedPO.netAmount?.toLocaleString()} đ ({t('Đã áp dụng chiết khấu tự động từ hồ sơ khách hàng.')})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* File link manager */}
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Liên Kết File Bản Vẽ Gốc & Tài Liệu Lớn (Google Drive / OneDrive)')}</h3>
                  <div className="file-links-list">
                    {selectedPO.links.pdfLink && <a href={selectedPO.links.pdfLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn File PDF Đơn Hàng')}</a>}
                    {selectedPO.links.excelLink && <a href={selectedPO.links.excelLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn File Excel Báo Giá')}</a>}
                    {selectedPO.links.aiLink && <a href={selectedPO.links.aiLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}</a>}
                    {selectedPO.links.corelLink && <a href={selectedPO.links.corelLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn Thiết kế Corel Draw (.cdr)')}</a>}
                    {selectedPO.links.contractLink && <a href={selectedPO.links.contractLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn Hợp Đồng / Văn Bản Ký')}</a>}
                    {selectedPO.links.quoteLink && <a href={selectedPO.links.quoteLink} target="_blank" rel="noopener noreferrer" className="file-link-item">{t('Đường dẫn File Excel Báo Giá')}</a>}
                    {!Object.values(selectedPO.links).some(Boolean) && <span>{t('Chưa đính kèm bất kỳ liên kết ngoài nào cho đơn này.')}</span>}
                  </div>
                </div>
              </div>

              {/* Design Preview and Activity Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '12px', textAlign: 'left', color: 'var(--color-primary)' }}>{t('Hình Ảnh Nhãn Mẫu')}</h3>
                  {selectedPO.items[0]?.previewImage ? (
                    <img 
                      src={selectedPO.items[0].previewImage} 
                      alt="Ảnh mẫu tem nhãn" 
                      style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', color: 'var(--color-text-muted)', backgroundColor: '#f8fafc', border: '1px dashed var(--color-border)' }}>
                      {t('Không có ảnh mẫu Base64 nào được upload.')}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('LỊCH SỬ TRẠNG THÁI')}</h3>
                  <div className="timeline" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedPO.historyLogs.map((log: any, idx: number) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <span className="timeline-title">{t(PO_STATES.find(s => s.value === log.status)?.label || log.status)}</span>
                          <span className="timeline-date">{new Date(log.updatedAt).toLocaleString(t('vi-VN'))} - {t('Nhân Sự Thực Hiện')}: {log.updatedBy}</span>
                          <span style={{ fontSize: '12px' }}>{log.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>{t('Tạo bởi:')}</strong> {selectedPO.createdBy || t('Không xác định')} {selectedPO.createdAt && `(${new Date(selectedPO.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                  <div><strong>{t('Cập nhật bởi:')}</strong> {selectedPO.updatedBy || t('Chưa cập nhật')} {selectedPO.updatedAt && `(${new Date(selectedPO.updatedAt).toLocaleString(t('vi-VN'))})`}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PO MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('TẠO MỚI ĐƠN HÀNG KHÁCH HÀNG (PO)')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>{t('Chọn Khách Hàng *')}</label>
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName} ({t('Chiết khấu')}: {c.discountRate}%)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Ghi Chú Đơn Hàng')}</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Chi tiết yêu cầu in, gia công, bế cuộn/tờ...')} />
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px', marginTop: '10px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Hình Ảnh Nhãn Mẫu')}</h4>
                    <div className="image-upload-box">
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{t('Chọn ảnh mẫu')}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        style={{ display: 'block', margin: '8px auto', fontSize: '12px' }}
                      />
                      {base64Image && (
                        <img 
                          src={base64Image} 
                          alt="Preview" 
                          className="image-preview-thumbnail"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Chi tiết sản phẩm đặt in')}</h4>
                    <div className="form-group">
                      <label>{t('Tên Sản Phẩm Nhãn *')}</label>
                      <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t('ví dụ: Tem barcode, tem nước rửa chén...')} required />
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Kích Thước Quy Cách *')}</label>
                        <input type="text" value={size} onChange={(e) => setSize(e.target.value)} placeholder="VD: 50x30mm" required />
                      </div>
                      <div className="form-group">
                        <label>{t('Nguyên Vật Liệu *')}</label>
                        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                          <option value="Decal giấy Fasson">{t('Decal Giấy Fasson AW0339F')}</option>
                          <option value="Decal nhựa đục">{t('Decal Nhựa PVC Avery Dennison')}</option>
                          <option value="Decal nhựa trong">{t('Decal nhựa trong')}</option>
                          <option value="Decal bạc (PET)">{t('Decal bạc (PET)')}</option>
                          <option value="Tem QR vỡ/giấy">{t('Tem QR vỡ/giấy')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Số Lượng Đặt In *')} *</label>
                        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label>{t('Đơn Giá In *')} *</label>
                        <input type="number" min="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)' }}>
                      {t('Giá trị chưa VAT')}: {(quantity * price).toLocaleString()} đ
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Liên Kết File Bản Vẽ Gốc & Tài Liệu Lớn (Google Drive / OneDrive)')}</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>{t('Đường dẫn File PDF Đơn Hàng')}</label>
                        <input type="url" value={pdfLink} onChange={(e) => setPdfLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn File Excel Báo Giá')}</label>
                        <input type="url" value={excelLink} onChange={(e) => setExcelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}</label>
                        <input type="url" value={aiLink} onChange={(e) => setAiLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn Thiết kế Corel Draw (.cdr)')}</label>
                        <input type="url" value={corelLink} onChange={(e) => setCorelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Đường dẫn Hợp Đồng / Văn Bản Ký')}</label>
                        <input type="url" value={contractLink} onChange={(e) => setContractLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn File Excel Báo Giá')}</label>
                        <input type="url" value={quoteLink} onChange={(e) => setQuoteLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Đơn Hàng PO')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT PO MODAL */}
      {showEditModal && selectedPO && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA THÔNG TIN PO')}: {selectedPO.poCode}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditPO}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Thông tin chung')}</h4>
                    <div className="form-group">
                      <label>{t('Khách Hàng')}</label>
                      <input type="text" value={selectedPO.customerName} disabled style={{ backgroundColor: '#f1f5f9' }} />
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Ngày Giao Hàng Dự Kiến *')} *</label>
                      <input type="date" value={editExpectedDeliveryDate} onChange={(e) => setEditExpectedDeliveryDate(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Ghi chú y/c riêng của khách')}</label>
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} placeholder={t('Nhập ghi chú hoặc địa chỉ giao hàng riêng...')} />
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)', textAlign: 'left' }}>{t('Hình Ảnh Nhãn Mẫu')}</h4>
                    {editBase64Image && (
                      <img src={editBase64Image} alt="Preview" style={{ maxWidth: '100%', maxHeight: '120px', display: 'block', margin: '0 auto 10px', borderRadius: '4px' }} />
                    )}
                    <input type="file" accept="image/*" onChange={handleEditImageChange} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Quy cách & Giá bán')}</h4>
                    <div className="form-group">
                      <label>{t('Tên Sản Phẩm Nhãn *')} *</label>
                      <input type="text" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} required placeholder="Ví dụ: Nhãn Aqua 500ml" />
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Kích Thước Quy Cách *')} *</label>
                        <input type="text" value={editSize} onChange={(e) => setEditSize(e.target.value)} required placeholder="Ví dụ: 100x80mm" />
                      </div>
                      <div className="form-group">
                        <label>{t('Nguyên Vật Liệu *')} *</label>
                        <select value={editMaterial} onChange={(e) => setEditMaterial(e.target.value)}>
                          <option value="Decal Giấy Fasson AW0339F">{t('Decal Giấy Fasson AW0339F')}</option>
                          <option value="Decal Nhựa PVC Avery Dennison">{t('Decal Nhựa PVC Avery Dennison')}</option>
                          <option value="Decal Bạc/Nhôm bóng">{t('Decal Bạc/Nhôm bóng')}</option>
                          <option value="Tem QR vỡ/giấy">{t('Tem QR vỡ/giấy')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Số Lượng Đặt In *')} *</label>
                        <input type="number" min="1" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label>{t('Đơn Giá In *')} *</label>
                        <input type="number" min="1" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} required />
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)' }}>
                      {t('Giá trị chưa VAT')}: {(editQuantity * editPrice).toLocaleString()} đ
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Liên Kết File Bản Vẽ Gốc & Tài Liệu Lớn (Google Drive / OneDrive)')}</h4>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>{t('Đường dẫn File PDF Đơn Hàng')}</label>
                        <input type="url" value={editPdfLink} onChange={(e) => setEditPdfLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn File Excel Báo Giá')}</label>
                        <input type="url" value={editExcelLink} onChange={(e) => setEditExcelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}</label>
                        <input type="url" value={editAiLink} onChange={(e) => setEditAiLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn Thiết kế Corel Draw (.cdr)')}</label>
                        <input type="url" value={editCorelLink} onChange={(e) => setEditCorelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Đường dẫn Hợp Đồng / Văn Bản Ký')}</label>
                        <input type="url" value={editContractLink} onChange={(e) => setEditContractLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>{t('Đường dẫn File Excel Báo Giá')}</label>
                        <input type="url" value={editQuoteLink} onChange={(e) => setEditQuoteLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thay Đổi')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
