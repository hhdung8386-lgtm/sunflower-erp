import React, { useState } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

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
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Product item fields (single item for simplicity, extensible)
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [material, setMaterial] = useState('Decal giấy');
  const [quantity, setQuantity] = useState(1000);
  const [price, setPrice] = useState(1000);
  
  // Base64 Image Preview
  const [base64Image, setBase64Image] = useState<string>('');
  
  // External drive links
  const [pdfLink, setPdfLink] = useState('');
  const [excelLink, setExcelLink] = useState('');
  const [aiLink, setAiLink] = useState('');
  const [corelLink, setCorelLink] = useState('');
  const [contractLink, setContractLink] = useState('');
  const [quoteLink, setQuoteLink] = useState('');

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
          <h1 className="page-title">TIẾP NHẬN ĐƠN HÀNG (SALES PO)</h1>
          <p className="page-subtitle">Nhập đơn hàng mới, upload ảnh mẫu nén Base64, quản lý tệp đính kèm và theo dõi timeline tiến độ đơn hàng.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={handleOpenAddModal}>Tạo Đơn Hàng PO Mới</button>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="Tìm kiếm mã PO, tên khách hàng, sản phẩm..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
          <button className="btn btn-outline" onClick={() => setSearchTerm('')}>Xóa Lọc</button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã PO</th>
                <th>Khách Hàng</th>
                <th>Sản Phẩm</th>
                <th>SL Đặt</th>
                <th>Tổng Tiền (Net)</th>
                <th>Ngày Giao Dự Kiến</th>
                <th>Trạng Thái Hiện Tại</th>
                <th>Thao Tác</th>
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
                    <td>{new Date(po.expectedDeliveryDate).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`badge ${
                        po.status === 'delivered' || po.status === 'debt_collected' ? 'badge-success' :
                        po.status === 'producing' ? 'badge-info' : 'badge-warning'
                      }`}>{PO_STATES.find(s => s.value === po.status)?.label}</span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedPO(po)}>Chi Tiết Timeline</button>
                    </td>
                  </tr>
                );
              })}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Không có đơn hàng nào khớp với tìm kiếm.</td>
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
                CHI TIẾT TIẾN ĐỘ PO: {selectedPO.poCode} - {selectedPO.customerName}
              </span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedPO(null)}>Đóng chi tiết</button>
            </div>

            {/* Status changer for authorized roles */}
            {(currentUser.role === 'admin' || currentUser.role === 'sale' || currentUser.role === 'producer') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600 }}>Cập nhật nhanh tiến độ PO:</span>
                <select 
                  value={selectedPO.status} 
                  onChange={(e) => updatePOStatus(selectedPO.id, e.target.value)}
                  style={{ width: '220px' }}
                >
                  {PO_STATES.map(state => (
                    <option key={state.value} value={state.value}>{state.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>* Sẽ tự động ghi lại nhật ký xử lý đơn</span>
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
                      <span className="step-label">{state.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="details-grid">
              {/* Product specifications and mock preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Thông tin kỹ thuật sản phẩm</h3>
                  <table style={{ border: 'none' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Tên tem nhãn:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.productName}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Kích thước:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.size}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Chất liệu decal:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.material}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Số lượng:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.quantity?.toLocaleString()} tem</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Đơn giá:</td>
                        <td style={{ border: 'none', padding: '6px 0' }}>{selectedPO.items[0]?.price?.toLocaleString()} đ/tem</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600, border: 'none', padding: '6px 0' }}>Trị giá PO (Sau chiết khấu):</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary)', border: 'none', padding: '6px 0' }}>
                          {selectedPO.netAmount?.toLocaleString()} đ (Đã trừ {selectedPO.discountAmount?.toLocaleString()} đ chiết khấu)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* File link manager */}
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Thư mục file dùng chung (Liên kết Google Drive)</h3>
                  <div className="file-links-list">
                    {selectedPO.links.pdfLink && <a href={selectedPO.links.pdfLink} target="_blank" rel="noopener noreferrer" className="file-link-item">File Đính Kèm PDF</a>}
                    {selectedPO.links.excelLink && <a href={selectedPO.links.excelLink} target="_blank" rel="noopener noreferrer" className="file-link-item">File Excel Nhu Cầu</a>}
                    {selectedPO.links.aiLink && <a href={selectedPO.links.aiLink} target="_blank" rel="noopener noreferrer" className="file-link-item">File Thiết Kế Gốc AI</a>}
                    {selectedPO.links.corelLink && <a href={selectedPO.links.corelLink} target="_blank" rel="noopener noreferrer" className="file-link-item">File Thiết Kế Corel</a>}
                    {selectedPO.links.contractLink && <a href={selectedPO.links.contractLink} target="_blank" rel="noopener noreferrer" className="file-link-item">Hợp Đồng PO</a>}
                    {selectedPO.links.quoteLink && <a href={selectedPO.links.quoteLink} target="_blank" rel="noopener noreferrer" className="file-link-item">Báo Giá Gửi Khách</a>}
                    {!Object.values(selectedPO.links).some(Boolean) && <span>Chưa đính kèm bất kỳ liên kết ngoài nào cho đơn này.</span>}
                  </div>
                </div>
              </div>

              {/* Design Preview and Activity Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '12px', textAlign: 'left', color: 'var(--color-primary)' }}>Hình ảnh mẫu duyệt</h3>
                  {selectedPO.items[0]?.previewImage ? (
                    <img 
                      src={selectedPO.items[0].previewImage} 
                      alt="Ảnh mẫu tem nhãn" 
                      style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', color: 'var(--color-text-muted)', backgroundColor: '#f8fafc', border: '1px dashed var(--color-border)' }}>
                      Không có ảnh mẫu Base64 nào được upload.
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Nhật ký xử lý đơn hàng</h3>
                  <div className="timeline" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedPO.historyLogs.map((log: any, idx: number) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <span className="timeline-title">{PO_STATES.find(s => s.value === log.status)?.label || log.status}</span>
                          <span className="timeline-date">{new Date(log.updatedAt).toLocaleString('vi-VN')} - Bởi: {log.updatedBy}</span>
                          <span style={{ fontSize: '12px' }}>{log.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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
              <span style={{ fontWeight: 700, fontSize: '16px' }}>TẠO MỚI ĐƠN HÀNG KHÁCH HÀNG (PO)</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>Khách Hàng Đặt Hàng *</label>
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName} (Chiết khấu: {c.discountRate}%)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ngày Giao Hàng Dự Kiến *</label>
                    <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Ghi Chú Yêu Cầu Của Khách Hàng</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Chi tiết yêu cầu in, gia công, bế cuộn/tờ..." />
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px', marginTop: '10px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>Ảnh mẫu thiết kế / Tem nhãn (Base64)</h4>
                    <div className="image-upload-box">
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>Nhấn vào để chọn ảnh tải lên</span>
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
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Chi tiết sản phẩm đặt in</h4>
                    <div className="form-group">
                      <label>Tên Sản Phẩm Tem Nhãn *</label>
                      <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ví dụ: Tem barcode, tem nước rửa chén..." required />
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>Kích Thước *</label>
                        <input type="text" value={size} onChange={(e) => setSize(e.target.value)} placeholder="VD: 50x30mm" required />
                      </div>
                      <div className="form-group">
                        <label>Chất Liệu Decal *</label>
                        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                          <option value="Decal giấy Fasson">Decal giấy Fasson</option>
                          <option value="Decal nhựa đục">Decal nhựa đục</option>
                          <option value="Decal nhựa trong">Decal nhựa trong</option>
                          <option value="Decal bạc (PET)">Decal bạc (PET)</option>
                          <option value="Tem QR vỡ/giấy">Tem QR vỡ/giấy</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>Số Lượng (Cái/Tem) *</label>
                        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label>Đơn Giá (đ/Tem) *</label>
                        <input type="number" min="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)' }}>
                      Giá trị chưa VAT: {(quantity * price).toLocaleString()} đ
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Đường dẫn file thiết kế (Google Drive Link)</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Link File PDF</label>
                        <input type="url" value={pdfLink} onChange={(e) => setPdfLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>Link File Excel BOM</label>
                        <input type="url" value={excelLink} onChange={(e) => setExcelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>Link File Thiết Kế AI</label>
                        <input type="url" value={aiLink} onChange={(e) => setAiLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>Link File Corel (CDR)</label>
                        <input type="url" value={corelLink} onChange={(e) => setCorelLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                    <div className="form-grid" style={{ marginTop: '8px' }}>
                      <div className="form-group">
                        <label>Link Hợp Đồng</label>
                        <input type="url" value={contractLink} onChange={(e) => setContractLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <div className="form-group">
                        <label>Link Báo Giá</label>
                        <input type="url" value={quoteLink} onChange={(e) => setQuoteLink(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Đơn Hàng PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
