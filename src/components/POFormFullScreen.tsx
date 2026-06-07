import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, X, Eye, Download, Folder, FileText, 
  ChevronDown, ChevronUp, Upload, HelpCircle, Save, Calendar, 
  Briefcase, CheckSquare, Layers
} from 'lucide-react';
import { dbService } from '../services/firebaseService';

interface POFormFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  po: any | null; // null if creating new PO
  onSave: (poData: any) => Promise<void>;
  customers: any[];
  suppliers: any[];
  users: any[];
  currentUser: any;
  t: (key: string) => string;
}

export default function POFormFullScreen({
  isOpen,
  onClose,
  po,
  onSave,
  customers,
  suppliers,
  users,
  currentUser,
  t
}: POFormFullScreenProps) {
  const [customerId, setCustomerId] = useState('');
  const [customerPoCode, setCustomerPoCode] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // File attachments (Base64 strings)
  const [pdfFile, setPdfFile] = useState('');
  const [excelFile, setExcelFile] = useState('');
  const [aiFile, setAiFile] = useState('');
  const [corelFile, setCorelFile] = useState('');
  const [contractFile, setContractFile] = useState('');
  const [quoteFile, setQuoteFile] = useState('');

  // PO Items state
  const [poItems, setPoItems] = useState<any[]>([]);

  // Department Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showAssignments, setShowAssignments] = useState(false);

  // Search popup state for history/catalog
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchRowIndex, setSearchRowIndex] = useState<number | null>(null);
  const [pastProducts, setPastProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal customer document repository state
  const [showRepoModal, setShowRepoModal] = useState(false);

  // Lightbox for image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    if (po) {
      setCustomerId(po.customerId || '');
      setCustomerPoCode(po.customerPoCode || '');
      setExpectedDeliveryDate(po.expectedDeliveryDate ? po.expectedDeliveryDate.split('T')[0] : '');
      setNotes(po.notes || '');
      
      // Load files
      setPdfFile(po.links?.pdfLink || '');
      setExcelFile(po.links?.excelLink || '');
      setAiFile(po.links?.aiLink || '');
      setCorelFile(po.links?.corelLink || '');
      setContractFile(po.links?.contractLink || '');
      setQuoteFile(po.links?.quoteLink || '');

      // Load items with backward compat for previewImage
      const items = (po.items || []).map((item: any) => ({
        ...item,
        itemId: item.itemId || `item-${Math.random().toString(36).substr(2, 9)}`,
        discountRate: item.discountRate !== undefined ? item.discountRate : 0,
        vatRate: item.vatRate !== undefined ? item.vatRate : 8,
        deliveryDate: item.deliveryDate ? item.deliveryDate.split('T')[0] : '',
        previewImages: item.previewImages || (item.previewImage ? [item.previewImage] : []),
        unit: item.unit || 'cái',
        material: item.material || 'Decal Giấy Fasson AW0339F',
        size: item.size || ''
      }));
      setPoItems(items);

      // Load assignments
      setAssignments(po.assignments || []);
    } else {
      // Defaults for creation
      setCustomerId(customers[0]?.id || '');
      setCustomerPoCode('');
      setExpectedDeliveryDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setNotes('');
      setPdfFile('');
      setExcelFile('');
      setAiFile('');
      setCorelFile('');
      setContractFile('');
      setQuoteFile('');
      setPoItems([]);
      setAssignments([]);
    }
  }, [po, isOpen, customers]);

  // Load repeat order products history for selected customer
  useEffect(() => {
    if (!customerId) return;
    const fetchPastProducts = async () => {
      try {
        const allPOs = await dbService.getCollection('pos');
        const customerPOs = allPOs.filter((p: any) => p.customerId === customerId && !p.deleted);
        const items: any[] = [];
        customerPOs.forEach((p: any) => {
          if (p.items) {
            p.items.forEach((item: any) => {
              items.push({
                ...item,
                poCode: p.poCode,
                orderDate: p.orderDate
              });
            });
          }
        });
        
        // Deduplicate by productCode
        const uniqueItems: any[] = [];
        const codes = new Set();
        items.forEach(item => {
          if (item.productCode && !codes.has(item.productCode)) {
            codes.add(item.productCode);
            uniqueItems.push(item);
          }
        });
        setPastProducts(uniqueItems);
      } catch (err) {
        console.error("Error fetching past products:", err);
      }
    };
    fetchPastProducts();
  }, [customerId]);

  if (!isOpen) return null;

  // Image compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleLinkFileChange = (e: React.ChangeEvent<HTMLInputElement>, setBase64: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const currentItem = poItems[rowIndex];
    const currentImages = [...(currentItem.previewImages || [])];
    
    if (currentImages.length + files.length > 5) {
      alert(t('Chỉ được tải lên tối đa 5 ảnh layout cho mỗi mặt hàng!'));
      return;
    }

    try {
      const compressedB64s = await Promise.all(
        Array.from(files).map(file => compressImage(file))
      );
      
      const updated = [...poItems];
      updated[rowIndex] = {
        ...currentItem,
        previewImages: [...currentImages, ...compressedB64s]
      };
      setPoItems(updated);
    } catch (error) {
      console.error("Failed to compress uploaded files:", error);
      alert(t('Lỗi khi nén ảnh layout. Vui lòng thử lại.'));
    }
    
    // Clear input
    e.target.value = '';
  };

  const deleteRowImage = (rowIndex: number, imgIndex: number) => {
    const updated = [...poItems];
    const images = [...(updated[rowIndex].previewImages || [])];
    images.splice(imgIndex, 1);
    updated[rowIndex].previewImages = images;
    setPoItems(updated);
  };

  // Add blank row
  const handleAddRow = () => {
    const currentCustomer = customers.find(c => c.id === customerId);
    const discountRate = currentCustomer ? currentCustomer.discountRate : 0;
    
    setPoItems([...poItems, {
      itemId: `item-${Math.random().toString(36).substr(2, 9)}`,
      productCode: '',
      productName: '',
      size: '',
      material: 'Decal Giấy Fasson AW0339F',
      unit: 'cái',
      quantity: 1000,
      price: 0,
      discountRate: discountRate,
      vatRate: 8,
      deliveryDate: expectedDeliveryDate || '',
      note: '',
      previewImages: [],
      supplierId: '',
      supplierName: '',
      purchasePrice: 0,
      workType: 'gia_cong',
      specifications: {}
    }]);
  };

  const handleRemoveRow = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleUpdateRowField = (index: number, field: string, value: any) => {
    const updated = [...poItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'supplierId') {
      const sup = suppliers.find(s => s.id === value);
      updated[index].supplierName = sup ? sup.supplierName : '';
    }
    
    // Auto-update work type based on product code
    if (field === 'productCode') {
      if (value.includes('5.07.006') || value === 'MUC_IN') {
        updated[index].workType = 'mua_nvl';
      } else {
        updated[index].workType = 'gia_cong';
      }
    }
    
    setPoItems(updated);
  };

  // Select item from Catalog or History search popup
  const handleSelectSearchedProduct = (product: any) => {
    if (searchRowIndex === null) return;
    
    const updated = [...poItems];
    updated[searchRowIndex] = {
      ...updated[searchRowIndex],
      productCode: product.productCode || product.code || 'MANUAL',
      productName: product.productName || product.name || '',
      size: product.size || (product.specifications ? `${product.specifications.width}x${product.specifications.height}mm` : ''),
      material: product.material || (product.productType === 'tem_trang_cuon' ? 'Decal Giấy Fasson AW0339F' : 'Decal nhựa PVC'),
      unit: product.unit || 'cái',
      price: product.currentPrice || product.price || 0,
      supplierId: product.supplierId || '',
      supplierName: product.supplierName || '',
      purchasePrice: product.purchasePrice || 0,
      workType: product.workType || (product.productType === 'muc_in' ? 'mua_nvl' : 'gia_cong'),
      previewImages: product.previewImages || (product.layoutUrl ? [product.layoutUrl] : (product.previewImage ? [product.previewImage] : [])),
      specifications: product.specifications || {}
    };

    setPoItems(updated);
    setSearchPopupOpen(false);
    setSearchRowIndex(null);
  };

  // Open product selector popup
  const openSearchPopup = (rowIndex: number) => {
    setSearchRowIndex(rowIndex);
    setSearchQuery('');
    setSearchPopupOpen(true);
  };

  // Assignments helpers
  const handleAddAssignment = () => {
    setAssignments([...assignments, {
      id: `assign-${Math.random().toString(36).substr(2, 9)}`,
      department: 'designer',
      userIds: [],
      description: '',
      dueDate: expectedDeliveryDate || '',
      priority: 'Bình thường'
    }]);
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleUpdateAssignment = (index: number, field: string, value: any) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: value };
    
    // Clear userIds if department changes so they select new ones matching the role
    if (field === 'department') {
      updated[index].userIds = [];
    }
    
    setAssignments(updated);
  };

  const handleToggleUserInAssignment = (index: number, userId: string) => {
    const updated = [...assignments];
    const currentUsers = [...(updated[index].userIds || [])];
    
    if (currentUsers.includes(userId)) {
      updated[index].userIds = currentUsers.filter(uid => uid !== userId);
    } else {
      updated[index].userIds = [...currentUsers, userId];
    }
    
    setAssignments(updated);
  };

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert(t('Vui lòng chọn khách hàng!'));
      return;
    }
    if (poItems.length === 0) {
      alert(t('Vui lòng thêm ít nhất 1 mặt hàng vào PO!'));
      return;
    }

    // Validate that all items have a name and quantity
    for (let i = 0; i < poItems.length; i++) {
      if (!poItems[i].productName) {
        alert(t(`Dòng ${i + 1}: Vui lòng nhập tên hàng!`));
        return;
      }
      if (!poItems[i].quantity || poItems[i].quantity <= 0) {
        alert(t(`Dòng ${i + 1}: Số lượng phải lớn hơn 0!`));
        return;
      }
    }

    // Calculate totals
    let totalQty = 0;
    let totalBeforeVat = 0;
    let totalAfterVat = 0;

    poItems.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const prc = Number(item.price) || 0;
      const disc = Number(item.discountRate) || 0;
      const vat = Number(item.vatRate) || 0;

      const sub = qty * prc * (1 - disc / 100);
      const withVat = sub * (1 + vat / 100);

      totalQty += qty;
      totalBeforeVat += sub;
      totalAfterVat += withVat;
    });

    const customerObj = customers.find(c => c.id === customerId);

    const poData = {
      id: po?.id || undefined,
      customerId,
      customerName: customerObj?.companyName || '',
      customerPoCode,
      expectedDeliveryDate: new Date(expectedDeliveryDate).toISOString(),
      notes,
      items: poItems,
      assignments,
      totalAmount: totalBeforeVat, // For consistency, totalAmount is subtotal
      discountAmount: poItems.reduce((acc, item) => {
        const qty = Number(item.quantity) || 0;
        const prc = Number(item.price) || 0;
        const disc = Number(item.discountRate) || 0;
        return acc + Math.round(qty * prc * (disc / 100));
      }, 0),
      netAmount: totalAfterVat, // Store final VAT-included total here or match DB convention
      links: {
        pdfLink: pdfFile,
        excelLink: excelFile,
        aiLink: aiFile,
        corelLink: corelFile,
        contractLink: contractFile,
        quoteLink: quoteFile
      }
    };

    onSave(poData);
  };

  // Calculations for totals footer
  const calculateFooter = () => {
    let totalQty = 0;
    let totalBeforeVat = 0;
    let totalVat = 0;
    let totalAfterVat = 0;

    poItems.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const prc = Number(item.price) || 0;
      const disc = Number(item.discountRate) || 0;
      const vat = Number(item.vatRate) || 0;

      const sub = qty * prc * (1 - disc / 100);
      const vatVal = sub * (vat / 100);
      const withVat = sub + vatVal;

      totalQty += qty;
      totalBeforeVat += sub;
      totalVat += vatVal;
      totalAfterVat += withVat;
    });

    return { totalQty, totalBeforeVat, totalVat, totalAfterVat };
  };

  const footerTotals = calculateFooter();

  // Catalog products + past history filter
  const currentCustomer = customers.find(c => c.id === customerId);
  const catalogProducts = currentCustomer?.products || [];
  
  const filteredCatalog = catalogProducts.filter((p: any) => 
    (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHistory = pastProducts.filter((p: any) => 
    (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Departments for tasks mapping
  const departments = [
    { value: 'designer', label: t('Thiết Kế (DESIGN)') },
    { value: 'producer', label: t('Sản Xuất (FACTORY)') },
    { value: 'purchaser', label: t('Mua Hàng (PURCHASE)') },
    { value: 'accountant', label: t('Kế Toán (ACCOUNTING)') },
    { value: 'sale', label: t('Kinh Doanh (SALES)') },
    { value: 'admin', label: t('Ban Giám Đốc (ADMIN)') }
  ];

  return (
    <div className="modal-overlay-fullscreen">
      <div className="modal-content-fullscreen">
        {/* HEADER */}
        <div style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-primary-dark)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>
                {po ? `${t('CHỈNH SỬA ĐƠN HÀNG PO')}: ${po.poCode}` : t('TẠO MỚI ĐƠN HÀNG KHÁCH HÀNG (PO)')}
              </h2>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: '2px 0 0 0' }}>
                {po ? `${t('Mã PO nội bộ:')} ${po.poCode}` : t('Khởi tạo tệp thông tin đơn hàng mới và phân công sản xuất')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={onClose}
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' }}
            >
              {t('Đóng / Hủy')}
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSubmit}
              style={{ 
                backgroundColor: 'white', 
                color: 'var(--color-primary-dark)', 
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save size={16} />
              <span>{t('Lưu Đơn Hàng PO')}</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{ 
          flex: 1, 
          display: 'grid', 
          gridTemplateColumns: '340px 1fr', 
          overflow: 'hidden'
        }} className="po-form-body-container">
          
          {/* LEFT SIDEBAR PANEL: Info, Files */}
          <div style={{ 
            borderRight: '1px solid var(--color-border)', 
            padding: '20px', 
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} />
              <span>{t('Thông Tin Khách Hàng')}</span>
            </h3>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Chọn Khách Hàng *')}</label>
              <select 
                value={customerId} 
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setPoItems([]); // Reset items on customer change
                }}
                disabled={!!po} // Cannot change customer when editing
                required
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({t('CK')}: {c.discountRate}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Mã PO Khách Hàng (Số PO)')}</label>
              <input 
                type="text" 
                value={customerPoCode} 
                onChange={(e) => setCustomerPoCode(e.target.value)} 
                placeholder={t('Ví dụ: VFT26-553...')} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Ngày Giao Hàng Dự Kiến *')}</label>
              <input 
                type="date" 
                value={expectedDeliveryDate} 
                onChange={(e) => setExpectedDeliveryDate(e.target.value)} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Ghi Chú Đơn Hàng')}</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder={t('Chi tiết giao hàng, yêu cầu riêng...')} 
                rows={3} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
              />
            </div>

            {/* Document upload / repository repo link */}
            <div style={{ 
              border: '1px solid var(--color-border-light)', 
              padding: '16px', 
              borderRadius: '8px', 
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--color-primary)' }}>
                {t('Tải Bản Cứng / Báo Giá')}
              </h4>

              {customerId && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline" 
                  onClick={() => setShowRepoModal(true)}
                  style={{ 
                    marginBottom: '14px', 
                    width: '100%', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px',
                    borderColor: 'var(--color-primary)',
                    color: 'var(--color-primary)'
                  }}
                >
                  <Folder size={14} />
                  <span>{t('Nhúp từ kho tệp khách hàng')}</span>
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File PDF Đơn Hàng')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setPdfFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {pdfFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('Bản Báo Giá Excel')}</label>
                  <input type="file" accept=".xls,.xlsx" onChange={e => handleLinkFileChange(e, setExcelFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {excelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Thiết kế AI')}</label>
                  <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setAiFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {aiFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Thiết kế Corel (.cdr)')}</label>
                  <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setCorelFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {corelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Hợp Đồng')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setContractFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {contractFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('Bản Báo Giá PDF')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setQuoteFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {quoteFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT GRID PANEL: Items Grid & Assignments */}
          <div style={{ 
            padding: '20px 24px', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* INLINE EDITING EXCEL-LIKE GRID */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                  {t('Danh Sách Mã Hàng Cần In & Sản Xuất (PO Items)')}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {t('Bấm 🔍 để nhập nhanh mã hàng từ Danh mục / Lịch sử khách hàng')}
                </span>
              </div>

              <div className="po-inline-grid-container">
                <table className="po-inline-grid">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                      <th style={{ width: '150px' }}>{t('Mã Hàng')}</th>
                      <th style={{ width: '220px' }}>{t('Tên Hàng *')}</th>
                      <th style={{ width: '140px' }}>{t('Quy Cách')}</th>
                      <th style={{ width: '140px' }}>{t('Chất Liệu')}</th>
                      <th style={{ width: '80px' }}>{t('ĐVT')}</th>
                      <th style={{ width: '90px' }}>{t('Số Lượng')}</th>
                      <th style={{ width: '110px' }}>{t('Đơn Giá')}</th>
                      <th style={{ width: '70px' }}>{t('CK (%)')}</th>
                      <th style={{ width: '120px' }}>{t('Thành Tiền (chưa VAT)')}</th>
                      <th style={{ width: '70px' }}>{t('Thuế (%)')}</th>
                      <th style={{ width: '120px' }}>{t('Thành Tiền (gồm VAT)')}</th>
                      <th style={{ width: '120px' }}>{t('Ngày Giao')}</th>
                      <th style={{ width: '160px' }}>{t('Ảnh Layout (Max 5)')}</th>
                      <th style={{ width: '150px' }}>{t('Ghi Chú')}</th>
                      <th style={{ width: '50px', textAlign: 'center' }} title={t('Xóa dòng')}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item, index) => {
                      const qty = Number(item.quantity) || 0;
                      const prc = Number(item.price) || 0;
                      const disc = Number(item.discountRate) || 0;
                      const vat = Number(item.vatRate) || 0;

                      const amountBeforeVat = qty * prc * (1 - disc / 100);
                      const amountWithVat = amountBeforeVat * (1 + vat / 100);

                      // Backward compatibility for layouts
                      const imagesList = item.previewImages || (item.previewImage ? [item.previewImage] : []);

                      return (
                        <tr key={item.itemId || index}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
                            {index + 1}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="text"
                                className="po-grid-input"
                                value={item.productCode}
                                onChange={(e) => handleUpdateRowField(index, 'productCode', e.target.value)}
                                placeholder="Mã..."
                              />
                              <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ padding: '4px 6px', height: '28px', border: '1px solid var(--color-border)' }}
                                onClick={() => openSearchPopup(index)}
                                title={t('Tìm kiếm nhanh')}
                              >
                                <Search size={12} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.productName}
                              onChange={(e) => handleUpdateRowField(index, 'productName', e.target.value)}
                              placeholder="Tên nhãn..."
                              list={`product-names-list-${index}`}
                            />
                            {/* Datalist for dropdown suggestion */}
                            <datalist id={`product-names-list-${index}`}>
                              {catalogProducts.map((p: any) => (
                                <option key={p.id} value={p.productName}>{p.productCode}</option>
                              ))}
                            </datalist>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.size}
                              onChange={(e) => handleUpdateRowField(index, 'size', e.target.value)}
                              placeholder="Ví dụ: 100x100mm"
                            />
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.material}
                              onChange={(e) => handleUpdateRowField(index, 'material', e.target.value)}
                              placeholder="Fasson AW0339F..."
                              list="materials-suggest"
                            />
                            <datalist id="materials-suggest">
                              <option value="Decal Giấy Fasson AW0339F" />
                              <option value="Decal Nhựa PVC Avery Dennison" />
                              <option value="Màng BOPP bóng 12mic" />
                              <option value="Giấy Ford" />
                            </datalist>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.unit}
                              onChange={(e) => handleUpdateRowField(index, 'unit', e.target.value)}
                              placeholder="cái"
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.quantity}
                              onChange={(e) => handleUpdateRowField(index, 'quantity', Number(e.target.value))}
                              min="1"
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.price}
                              onChange={(e) => handleUpdateRowField(index, 'price', Number(e.target.value))}
                              min="0"
                              step="any"
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.discountRate}
                              onChange={(e) => handleUpdateRowField(index, 'discountRate', Number(e.target.value))}
                              min="0"
                              max="100"
                            />
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-main)', textAlign: 'right' }}>
                            {Math.round(amountBeforeVat).toLocaleString()} đ
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.vatRate}
                              onChange={(e) => handleUpdateRowField(index, 'vatRate', Number(e.target.value))}
                              min="0"
                              max="100"
                            />
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary-dark)', textAlign: 'right' }}>
                            {Math.round(amountWithVat).toLocaleString()} đ
                          </td>
                          <td>
                            <input 
                              type="date"
                              className="po-grid-input"
                              value={item.deliveryDate}
                              onChange={(e) => handleUpdateRowField(index, 'deliveryDate', e.target.value)}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Multiple image thumbnails */}
                              {imagesList.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {imagesList.map((img: string, imgIdx: number) => (
                                    <div key={imgIdx} style={{ position: 'relative', width: '32px', height: '32px' }}>
                                      <img 
                                        src={img} 
                                        alt="layout" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--color-border)' }}
                                        onClick={() => setPreviewImage(img)}
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => deleteRowImage(index, imgIdx)}
                                        style={{
                                          position: 'absolute',
                                          top: '-4px',
                                          right: '-4px',
                                          backgroundColor: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '12px',
                                          height: '12px',
                                          fontSize: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Upload triggers */}
                              {imagesList.length < 5 && (
                                <label style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: 'var(--color-primary)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  border: '1px dashed var(--color-primary)',
                                  borderRadius: '4px',
                                  width: 'fit-content'
                                }}>
                                  <Upload size={10} />
                                  <span>+ Layout</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    multiple 
                                    onChange={(e) => handleRowFileChange(e, index)}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.note || ''}
                              onChange={(e) => handleUpdateRowField(index, 'note', e.target.value)}
                              placeholder="..."
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-danger"
                              style={{ padding: '4px 6px', minWidth: 'auto', background: 'transparent', color: '#ef4444', border: 'none' }}
                              onClick={() => handleRemoveRow(index)}
                              title={t('Xóa dòng')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* EMPTY PO ITEMS ROW */}
                    {poItems.length === 0 && (
                      <tr>
                        <td colSpan={16} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          {t('Chưa có mã hàng nào được thêm. Hãy chọn mã cũ từ 🔍 hoặc bấm "+ Thêm Dòng Mới"')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* FOOTER ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={handleAddRow}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Plus size={14} />
                  <span>{t('Thêm dòng mới')}</span>
                </button>

                {/* TOTAL SUMMARY CARD */}
                <div style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  minWidth: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('Tổng số lượng tem:')}</span>
                    <strong style={{ fontSize: '14px' }}>{footerTotals.totalQty.toLocaleString()} {t('cái')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
                    <span>{t('Tổng tiền chưa VAT:')}</span>
                    <span style={{ fontWeight: 600 }}>{Math.round(footerTotals.totalBeforeVat).toLocaleString()} đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                    <span>{t('Thuế GTGT (VAT):')}</span>
                    <span>{Math.round(footerTotals.totalVat).toLocaleString()} đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-primary-dark)', fontSize: '15px', fontWeight: 'bold', paddingTop: '4px' }}>
                    <span>{t('TỔNG CỘNG (GỒM VAT):')}</span>
                    <span>{Math.round(footerTotals.totalAfterVat).toLocaleString()} đ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DEPARTMENT WORK ASSIGNMENTS SECTION */}
            <div style={{ 
              border: '1px solid var(--color-border)', 
              borderRadius: '8px',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden'
            }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '14px 18px', 
                  backgroundColor: '#f8fafc',
                  borderBottom: showAssignments ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setShowAssignments(!showAssignments)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-primary-dark)', fontSize: '14px' }}>
                  <CheckSquare size={16} />
                  <span>{t('PHÂN CÔNG CÔNG VIỆC PHÒNG BAN')}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 'normal', 
                    backgroundColor: 'var(--color-primary-light)', 
                    color: 'var(--color-primary)', 
                    padding: '2px 6px', 
                    borderRadius: '999px' 
                  }}>
                    {assignments.length} {t('Phân công')}
                  </span>
                </div>
                {showAssignments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {showAssignments && (
                <div style={{ padding: '16px' }}>
                  <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '14px', marginTop: 0 }}>
                    {t('Giao phó công việc chi tiết cho các bộ phận như Thiết kế layout, In ấn, Đặt vật tư, Thanh toán... Kèm theo ngày đến hạn và mức độ khẩn cấp.')}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                    {assignments.map((assign, index) => {
                      // Users that match the role of the department
                      const deptUsers = users.filter(u => u.role === assign.department && u.active);

                      return (
                        <div key={assign.id} style={{ 
                          border: '1px solid var(--color-border-light)', 
                          borderRadius: '6px', 
                          padding: '12px',
                          backgroundColor: '#fafbfc',
                          display: 'grid',
                          gridTemplateColumns: '200px 1.5fr 150px 120px 30px',
                          gap: '12px',
                          alignItems: 'start'
                        }}>
                          {/* Department Selector */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Bộ phận chịu trách nhiệm')}</label>
                            <select
                              value={assign.department}
                              onChange={(e) => handleUpdateAssignment(index, 'department', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            >
                              {departments.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>

                            {/* Personnel check list */}
                            <div style={{ marginTop: '8px' }}>
                              <label style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                {t('Chọn Nhân Sự Phụ Trách')}
                              </label>
                              <div style={{ 
                                maxHeight: '100px', 
                                overflowY: 'auto', 
                                border: '1px solid #e2e8f0', 
                                padding: '4px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                              }}>
                                {deptUsers.map(u => (
                                  <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                                    <input 
                                      type="checkbox"
                                      checked={(assign.userIds || []).includes(u.uid)}
                                      onChange={() => handleToggleUserInAssignment(index, u.uid)}
                                    />
                                    <span>{u.displayName}</span>
                                  </label>
                                ))}
                                {deptUsers.length === 0 && (
                                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                    {t('Không có nhân sự cho bộ phận này')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Task Description */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Nội dung công việc bàn giao')}</label>
                            <textarea
                              value={assign.description}
                              onChange={(e) => handleUpdateAssignment(index, 'description', e.target.value)}
                              placeholder={t('Ví dụ: Bế tem trắng, gửi mẫu layout duyệt, đặt mua mực màu đen...')}
                              rows={3}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                          </div>

                          {/* Due date */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Hạn hoàn thành')}</label>
                            <input 
                              type="date"
                              value={assign.dueDate}
                              onChange={(e) => handleUpdateAssignment(index, 'dueDate', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                          </div>

                          {/* Priority Selector */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Độ ưu tiên')}</label>
                            <select
                              value={assign.priority}
                              onChange={(e) => handleUpdateAssignment(index, 'priority', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            >
                              <option value="Cực gấp">{t('Cực gấp')}</option>
                              <option value="Gấp">{t('Gấp')}</option>
                              <option value="Bình thường">{t('Bình thường')}</option>
                              <option value="Thong thả">{t('Thong thả')}</option>
                            </select>
                          </div>

                          {/* Delete Assignment Row */}
                          <div style={{ alignSelf: 'center', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              onClick={() => handleRemoveAssignment(index)}
                              title={t('Xóa phân công')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {assignments.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '20px', 
                        border: '1px dashed #cbd5e1', 
                        borderRadius: '6px', 
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                        fontSize: '12.5px'
                      }}>
                        {t('Chưa phân công công việc phòng ban nào cho PO này.')}
                      </div>
                    )}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline" 
                    onClick={handleAddAssignment}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                  >
                    <Plus size={14} />
                    <span>{t('Thêm phân công phòng ban')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH MÃ HÀNG POPUP (Catalog & Past History) */}
        {searchPopupOpen && searchRowIndex !== null && (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700, fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Search size={18} />
                  <span>{t('TÌM KIẾM MÃ HÀNG NHẬP NHANH')}</span>
                </span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setSearchPopupOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <input 
                    type="text" 
                    placeholder={t('Nhập mã hàng hoặc tên hàng cần tìm...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '320px', overflow: 'hidden' }}>
                  {/* Catalog list */}
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '13px', color: 'var(--color-primary)' }}>
                      {t('Danh Mục Đã Đăng Ký (Catalog)')}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                      {filteredCatalog.map((prod: any) => (
                        <div 
                          key={prod.id}
                          className="chat-suggestion-item"
                          onClick={() => handleSelectSearchedProduct(prod)}
                          style={{ borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{prod.productCode}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{prod.productName}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{prod.currentPrice?.toLocaleString()} đ</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{prod.specifications ? `${prod.specifications.width}x${prod.specifications.height}mm` : ''}</div>
                          </div>
                        </div>
                      ))}
                      {filteredCatalog.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                          {t('Không có sản phẩm nào khớp.')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* History list */}
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '13px', color: 'var(--color-success-dark)' }}>
                      {t('Lịch Sử Đã Đặt Đơn Hàng Cũ (History)')}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                      {filteredHistory.map((prod: any, pIdx: number) => (
                        <div 
                          key={pIdx}
                          className="chat-suggestion-item"
                          onClick={() => handleSelectSearchedProduct(prod)}
                          style={{ borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{prod.productCode}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{prod.productName}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                              {t('Từ đơn:')} {prod.poCode} ({new Date(prod.orderDate).toLocaleDateString(t('vi-VN'))})
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{prod.price?.toLocaleString()} đ</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{prod.size}</div>
                          </div>
                        </div>
                      ))}
                      {filteredHistory.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                          {t('Không có lịch sử cũ nào khớp.')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSearchPopupOpen(false)}>{t('Đóng')}</button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER REPOSITORY FILE PICKER MODAL */}
        {showRepoModal && (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700, fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Folder size={18} />
                  <span>
                    {t('KHO LƯU TRỮ TỆP KHÁCH HÀNG')}: {currentCustomer?.companyName || ''}
                  </span>
                </span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowRepoModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {(() => {
                  if (!currentCustomer || !currentCustomer.files || currentCustomer.files.length === 0) {
                    return (
                      <p className="text-center text-muted" style={{ padding: '20px' }}>
                        {t('Kho lưu trữ của khách hàng này hiện tại chưa có tệp tin nào.')}
                      </p>
                    );
                  }

                  // Group files by folder
                  const folderGroups = currentCustomer.files.reduce((acc: any, file: any) => {
                    const folderName = file.folder || t('Chưa phân mục');
                    if (!acc[folderName]) acc[folderName] = [];
                    acc[folderName].push(file);
                    return acc;
                  }, {});

                  return (
                    <div>
                      <p style={{ fontSize: '12.5px', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
                        {t('Chọn một tệp từ kho lưu trữ để đính kèm vào phần tương ứng:')}
                      </p>
                      
                      {Object.entries(folderGroups).map(([folderName, folderFiles]: any) => (
                        <div key={folderName} style={{ marginBottom: '16px' }}>
                          <h5 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginBottom: '8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <Folder size={14} />
                            <span>{folderName}</span>
                          </h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {folderFiles.map((file: any, fIdx: number) => (
                              <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }}>
                                <span style={{ fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={file.name}>
                                  <FileText size={14} />
                                  <span>{file.name}</span>
                                </span>
                                <div>
                                  <select 
                                    onChange={(e) => {
                                      const target = e.target.value;
                                      if (!target) return;
                                      
                                      if (target === 'pdf') setPdfFile(file.base64);
                                      if (target === 'excel') setExcelFile(file.base64);
                                      if (target === 'ai') setAiFile(file.base64);
                                      if (target === 'corel') setCorelFile(file.base64);
                                      if (target === 'contract') setContractFile(file.base64);
                                      if (target === 'quote') setQuoteFile(file.base64);
                                      
                                      alert(t(`Đã đính kèm tệp "${file.name}" vào trường ${target.toUpperCase()}`));
                                      e.target.value = ''; // reset
                                    }}
                                    style={{ padding: '2px 6px', fontSize: '11.5px', width: '150px' }}
                                  >
                                    <option value="">-- {t('Đính kèm vào')} --</option>
                                    <option value="pdf">{t('PDF Đơn Hàng')}</option>
                                    <option value="excel">{t('Bản Báo Giá Excel')}</option>
                                    <option value="ai">{t('File Thiết kế AI')}</option>
                                    <option value="corel">{t('File Thiết kế Corel')}</option>
                                    <option value="contract">{t('File Hợp Đồng')}</option>
                                    <option value="quote">{t('Bản Báo Giá PDF')}</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRepoModal(false)}>{t('Hoàn thành')}</button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE ZOOM LIGHTBOX */}
        {previewImage && (
          <div 
            className="modal-overlay" 
            onClick={() => setPreviewImage(null)} 
            style={{ zIndex: 1300, background: 'rgba(0,0,0,0.85)' }}
          >
            <div 
              className="modal-content" 
              style={{ maxWidth: '90%', maxHeight: '90%', padding: '12px', position: 'relative', background: 'transparent', boxShadow: 'none' }} 
              onClick={e => e.stopPropagation()}
            >
              <button 
                type="button" 
                style={{ 
                  position: 'absolute', 
                  top: '-15px', 
                  right: '-15px', 
                  backgroundColor: 'white', 
                  color: 'black', 
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px', 
                  height: '30px', 
                  fontSize: '18px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }} 
                onClick={() => setPreviewImage(null)}
              >
                ×
              </button>
              <img 
                src={previewImage} 
                alt="Layout Zoom" 
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '4px', border: '2px solid white' }} 
              />
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <a 
                  href={previewImage} 
                  download={`Layout_${Date.now()}.jpg`} 
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>{t('Tải Ảnh Về')}</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
