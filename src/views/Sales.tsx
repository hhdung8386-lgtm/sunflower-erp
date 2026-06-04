import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { FloatingChat } from '../components/FloatingChat';

interface SalesProps {
  pos: any[];
  customers: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
  initialSelectedPoId?: string;
  messages: any[];
  users: UserProfile[];
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

export const Sales: React.FC<SalesProps> = ({ pos, customers, currentUser, onRefresh, initialSelectedPoId, messages, users }) => {
  const { t } = useLanguage();
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-select PO when initialSelectedPoId changes
  useEffect(() => {
    if (initialSelectedPoId) {
      const po = pos.find(p => p.id === initialSelectedPoId);
      if (po) {
        setSelectedPO(po);
      }
    }
  }, [initialSelectedPoId, pos]);

  // Load suppliers locally
  const [suppliers, setSuppliers] = useState<any[]>([]);
  useEffect(() => {
    const fetchSuppliers = async () => {
      const data = await dbService.getCollection('suppliers');
      setSuppliers(data);
    };
    fetchSuppliers();
  }, []);

  // Multi-item PO states
  const [poItems, setPoItems] = useState<any[]>([]);

  // Item popup form states
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemProductCode, setItemProductCode] = useState('MANUAL');
  const [itemProductName, setItemProductName] = useState('');
  const [itemSize, setItemSize] = useState('100x100mm');
  const [itemMaterial, setItemMaterial] = useState('Decal Giấy Fasson AW0339F');
  const [itemQuantity, setItemQuantity] = useState(1000);
  const [itemPrice, setItemPrice] = useState(1000);
  const [itemSupplierId, setItemSupplierId] = useState('');
  const [itemPurchasePrice, setItemPurchasePrice] = useState(0);

  // File upload Base64 states
  const [pdfFile, setPdfFile] = useState('');
  const [excelFile, setExcelFile] = useState('');
  const [aiFile, setAiFile] = useState('');
  const [corelFile, setCorelFile] = useState('');
  const [contractFile, setContractFile] = useState('');
  const [quoteFile, setQuoteFile] = useState('');

  // Edit File upload Base64 states
  const [editPdfFile, setEditPdfFile] = useState('');
  const [editExcelFile, setEditExcelFile] = useState('');
  const [editAiFile, setEditAiFile] = useState('');
  const [editCorelFile, setEditCorelFile] = useState('');
  const [editContractFile, setEditContractFile] = useState('');
  const [editQuoteFile, setEditQuoteFile] = useState('');

  const handleLinkFileChange = (e: React.ChangeEvent<HTMLInputElement>, setBase64: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

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
    setPoItems(po.items || []);
    setEditPdfFile(po.links?.pdfLink || '');
    setEditExcelFile(po.links?.excelLink || '');
    setEditAiFile(po.links?.aiLink || '');
    setEditCorelFile(po.links?.corelLink || '');
    setEditContractFile(po.links?.contractLink || '');
    setEditQuoteFile(po.links?.quoteLink || '');
    setSelectedPO(po);
    setShowEditModal(true);
  };

  const handleEditPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO || poItems.length === 0) return;

    const subtotal = poItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.price)), 0);
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
        note: `${t('Chỉnh sửa thông số đơn hàng PO')} (Tổng trị giá: ${subtotal.toLocaleString()} đ)`
      }
    ];

    await dbService.updateDocument('pos', selectedPO.id, {
      expectedDeliveryDate: new Date(editExpectedDeliveryDate).toISOString(),
      notes: editNotes,
      items: poItems,
      totalAmount: subtotal,
      discountAmount,
      netAmount,
      links: {
        pdfLink: editPdfFile,
        excelLink: editExcelFile,
        aiLink: editAiFile,
        corelLink: editCorelFile,
        contractLink: editContractFile,
        quoteLink: editQuoteFile
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
    setPoItems([]);
    setPdfFile('');
    setExcelFile('');
    setAiFile('');
    setCorelFile('');
    setContractFile('');
    setQuoteFile('');
    setShowAddModal(true);
  };

  const addPredefinedItem = (prod: any) => {
    if (poItems.some(i => i.productCode === prod.productCode)) return;

    setPoItems([...poItems, {
      itemId: `item-${Math.random().toString(36).substr(2, 9)}`,
      productCode: prod.productCode,
      productName: prod.productName,
      size: prod.productType === 'muc_in' ? prod.specifications.size : `${prod.specifications.width}x${prod.specifications.height}mm`,
      material: prod.productType === 'tem_trang_cuon' ? 'Decal Giấy Fasson AW0339F' : (prod.productType === 'muc_in' ? 'Mực in' : 'Decal nhựa PVC'),
      quantity: 1000,
      price: prod.currentPrice,
      supplierId: '',
      supplierName: '',
      purchasePrice: 0,
      workType: prod.productType === 'muc_in' ? 'mua_nvl' : 'gia_cong',
      previewImage: prod.layoutUrl || '',
      specifications: prod.specifications || {}
    }]);
  };

  const openAddItemModal = () => {
    setItemProductCode('MANUAL');
    setItemProductName('');
    setItemSize('100x100mm');
    setItemMaterial('Decal Giấy Fasson AW0339F');
    setItemQuantity(1000);
    setItemPrice(1000);
    setItemSupplierId('');
    setItemPurchasePrice(0);
    setEditingItemIndex(null);
    setShowItemModal(true);
  };

  const openEditItemModal = (index: number) => {
    const item = poItems[index];
    setItemProductCode(item.productCode || 'MANUAL');
    setItemProductName(item.productName || '');
    setItemSize(item.size || '100x100mm');
    setItemMaterial(item.material || 'Decal Giấy Fasson AW0339F');
    setItemQuantity(Number(item.quantity) || 1000);
    setItemPrice(Number(item.price) || 1000);
    setItemSupplierId(item.supplierId || '');
    setItemPurchasePrice(Number(item.purchasePrice) || 0);
    setEditingItemIndex(index);
    setShowItemModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemProductName) {
      alert(t('Vui lòng nhập tên sản phẩm!'));
      return;
    }

    const sup = suppliers.find(s => s.id === itemSupplierId);
    const supplierName = sup ? sup.supplierName : '';
    let workType = 'gia_cong';
    if (itemProductCode.includes('5.07.006') || itemProductCode === 'MUC_IN') {
      workType = 'mua_nvl';
    }

    const newItem = {
      itemId: editingItemIndex !== null ? poItems[editingItemIndex].itemId : `item-${Math.random().toString(36).substr(2, 9)}`,
      productCode: itemProductCode,
      productName: itemProductName,
      size: itemSize,
      material: itemMaterial,
      quantity: Number(itemQuantity),
      price: Number(itemPrice),
      supplierId: itemSupplierId,
      supplierName: supplierName,
      purchasePrice: Number(itemPurchasePrice),
      workType: workType,
      previewImage: editingItemIndex !== null ? poItems[editingItemIndex].previewImage : '',
      specifications: editingItemIndex !== null ? poItems[editingItemIndex].specifications : {}
    };

    if (editingItemIndex !== null) {
      const updated = [...poItems];
      updated[editingItemIndex] = newItem;
      setPoItems(updated);
    } else {
      setPoItems([...poItems, newItem]);
    }

    setShowItemModal(false);
  };

  const removePoItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const updatePoItemField = (index: number, field: string, value: any) => {
    const updated = [...poItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'supplierId') {
      const sup = suppliers.find(s => s.id === value);
      updated[index].supplierName = sup ? sup.supplierName : '';
    }
    setPoItems(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || poItems.length === 0) {
      alert('Vui lòng chọn khách hàng và thêm ít nhất 1 sản phẩm vào đơn hàng!');
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Calculations
    const subtotal = poItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.price)), 0);
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
      items: poItems,
      totalAmount: subtotal,
      discountAmount,
      netAmount,
      links: {
        pdfLink: pdfFile,
        excelLink: excelFile,
        aiLink: aiFile,
        corelLink: corelFile,
        contractLink: contractFile,
        quoteLink: quoteFile
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

  const filteredPOs = pos.filter(po => {
    // Filter by sale role: only show POs where saleId matches
    if (currentUser.role === 'sale' && po.saleId && po.saleId !== currentUser.uid) {
      return false;
    }
    return (
      po.poCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.items.some((i: any) => i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="sales-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('TIẾP NHẬN ĐƠN HÀNG (SALES PO)')}</h1>
          <p className="page-subtitle">{t('Tạo đơn hàng PO mới, theo dõi 15 trạng thái sản xuất và quản lý file thiết kế, thông số kỹ thuật.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary btn-symbol" onClick={handleOpenAddModal} title={t('TẠO ĐƠN HÀNG PO MỚI')}>+</button>
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
          <button className="btn btn-outline btn-symbol" onClick={() => setSearchTerm('')} title={t('Xóa Tìm Kiếm')}>✕</button>
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
                    <button className="btn btn-sm btn-primary btn-symbol-sm" onClick={() => handleOpenEditModal(selectedPO)} title={t('Sửa')}>✎</button>
                    <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeletePO(selectedPO.id)} title={t('Xóa')}>✕</button>
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
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Chi Tiết Các Mặt Hàng Trong PO:')}</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('Mã Hàng')}</th>
                          <th>{t('Tên Hàng')}</th>
                          <th>{t('Quy Cách')}</th>
                          <th>{t('Số Lượng')}</th>
                          <th>{t('Đơn Giá')}</th>
                          <th>{t('Thành Tiền')}</th>
                          <th>{t('Phân Bổ NCC')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPO.items?.map((item: any, idx: number) => (
                          <tr key={item.itemId || idx}>
                            <td style={{ fontWeight: 600 }}>{item.productCode || 'N/A'}</td>
                            <td>{item.productName}</td>
                            <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {item.size} ({item.material})
                            </td>
                            <td>{item.quantity?.toLocaleString()}</td>
                            <td>{item.price?.toLocaleString()} đ</td>
                            <td>{(item.quantity * item.price)?.toLocaleString()} đ</td>
                            <td>
                              {item.supplierName ? (
                                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                  {item.supplierName} ({item.purchasePrice?.toLocaleString()} đ)
                                </span>
                              ) : (
                                <span style={{ fontStyle: 'italic', color: 'var(--color-warning)' }}>{t('Chưa phân bổ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '12px', padding: '12px 0 0 0', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{t('Tổng giá trị đơn hàng (Net):')}</span>
                    <span style={{ color: 'var(--color-primary)', fontSize: '15px' }}>{selectedPO.netAmount?.toLocaleString()} đ</span>
                  </div>
                </div>

                {/* File link manager */}
                <div style={{ border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '4px' }}>
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Tài Liệu Đính Kèm Đơn Hàng:')}</h3>
                  <div className="file-links-list">
                    {selectedPO.links?.pdfLink && (
                      <a href={selectedPO.links.pdfLink} download={`PDF_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải PDF Đơn Hàng')}
                      </a>
                    )}
                    {selectedPO.links?.excelLink && (
                      <a href={selectedPO.links.excelLink} download={`Excel_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải Excel Báo Giá')}
                      </a>
                    )}
                    {selectedPO.links?.aiLink && (
                      <a href={selectedPO.links.aiLink} download={`AI_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải Thiết Kế Gốc AI')}
                      </a>
                    )}
                    {selectedPO.links?.corelLink && (
                      <a href={selectedPO.links.corelLink} download={`Corel_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải Thiết Kế Corel (.cdr)')}
                      </a>
                    )}
                    {selectedPO.links?.contractLink && (
                      <a href={selectedPO.links.contractLink} download={`HopDong_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải Hợp Đồng')}
                      </a>
                    )}
                    {selectedPO.links?.quoteLink && (
                      <a href={selectedPO.links.quoteLink} download={`BaoGia_${selectedPO.poCode}`} className="file-link-item" style={{ marginRight: '8px', marginBottom: '8px', display: 'inline-block' }}>
                        {t('Tải Bản Báo Giá')}
                      </a>
                    )}
                    {!Object.values(selectedPO.links || {}).some(Boolean) && <span>{t('Chưa có tài liệu đính kèm nào được tải lên.')}</span>}
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
          <div className="modal-content" style={{ maxWidth: '950px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('TẠO MỚI ĐƠN HÀNG KHÁCH HÀNG (PO)')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Chọn Khách Hàng *')}</label>
                    <select value={customerId} onChange={(e) => {
                      setCustomerId(e.target.value);
                      setPoItems([]); // Reset items when customer changes
                    }} required>
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
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Chi tiết giao hàng, yêu cầu riêng...')} rows={2} />
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Tải Bản Cứng Đơn Hàng / Báo Giá')}</h4>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File PDF Đơn Hàng')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setPdfFile)} style={{ fontSize: '11px' }} />
                      {pdfFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('Bản Báo Giá Excel')}</label>
                      <input type="file" accept=".xls,.xlsx" onChange={e => handleLinkFileChange(e, setExcelFile)} style={{ fontSize: '11px' }} />
                      {excelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Thiết kế AI')}</label>
                      <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setAiFile)} style={{ fontSize: '11px' }} />
                      {aiFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Thiết kế Corel (.cdr)')}</label>
                      <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setCorelFile)} style={{ fontSize: '11px' }} />
                      {corelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Hợp Đồng')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setContractFile)} style={{ fontSize: '11px' }} />
                      {contractFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11.5px' }}>{t('Bản Báo Giá')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setQuoteFile)} style={{ fontSize: '11px' }} />
                      {quoteFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Catalog products lists */}
                  <div style={{ border: '1px dashed var(--color-border)', padding: '12px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                    <h4 style={{ color: 'var(--color-primary)', marginBottom: '8px' }}>
                      {t('1. Danh Mục Thiết Lập Sẵn Của Khách Hàng')}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {customers.find(c => c.id === customerId)?.products?.map((prod: any) => (
                        <button 
                          key={prod.id} 
                          type="button" 
                          className="btn btn-sm btn-outline"
                          onClick={() => addPredefinedItem(prod)}
                          style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 10px' }}
                        >
                          + {prod.productCode} ({prod.productName})
                        </button>
                      ))}
                      {(!customers.find(c => c.id === customerId)?.products || customers.find(c => c.id === customerId)?.products.length === 0) && (
                        <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                          {t('Khách hàng này chưa có danh mục mã hàng thiết lập sẵn. Vui lòng thêm dòng thủ công.')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected items list */}
                  <div style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ color: 'var(--color-primary)' }}>{t('2. Danh Sách Mã Hàng Chọn Đặt (PO Items)')}</h4>
                      <button type="button" className="btn btn-sm btn-outline btn-symbol" onClick={openAddItemModal} title={t('Thêm Dòng Thủ Công')}>+</button>
                    </div>

                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Mã Hàng')}</th>
                            <th>{t('Tên Hàng')}</th>
                            <th>{t('Quy Cách & Chất Liệu')}</th>
                            <th>{t('SL')}</th>
                            <th>{t('ĐG Bán')}</th>
                            <th>{t('Nhà Cung Cấp')}</th>
                            <th>{t('Giá Mua')}</th>
                            <th style={{ width: '90px' }}>{t('Thao tác')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poItems.map((item, index) => (
                            <tr key={item.itemId || index}>
                              <td style={{ fontWeight: 600 }}>{item.productCode}</td>
                              <td>{item.productName}</td>
                              <td>{item.size} ({item.material})</td>
                              <td>{item.quantity?.toLocaleString()}</td>
                              <td>{item.price?.toLocaleString()} đ</td>
                              <td>{item.supplierName || t('Chưa chọn')}</td>
                              <td>{item.purchasePrice?.toLocaleString()} đ</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditItemModal(index)} title={t('Sửa')}>✎</button>
                                  <button type="button" className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => removePoItem(index)} title={t('Xóa')}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {poItems.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                {t('Chưa chọn sản phẩm nào. Nhấp vào danh mục hoặc thêm dòng thủ công.')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '13px', color: 'var(--color-primary)', textAlign: 'right' }}>
                      {t('Tổng giá trị PO (chưa VAT):')} {poItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()} đ
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
          <div className="modal-content" style={{ maxWidth: '950px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA THÔNG TIN PO')}: {selectedPO.poCode}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditPO}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Khách Hàng')}</label>
                    <input type="text" value={selectedPO.customerName} disabled style={{ backgroundColor: '#f1f5f9' }} />
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={editExpectedDeliveryDate} onChange={(e) => setEditExpectedDeliveryDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Ghi Chú Đơn Hàng')}</label>
                    <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder={t('Chi tiết giao hàng, yêu cầu riêng...')} rows={2} />
                  </div>

                  <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Tải Bản Cứng Đơn Hàng / Báo Giá')}</h4>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File PDF Đơn Hàng')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setEditPdfFile)} style={{ fontSize: '11px' }} />
                      {editPdfFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('Bản Báo Giá Excel')}</label>
                      <input type="file" accept=".xls,.xlsx" onChange={e => handleLinkFileChange(e, setEditExcelFile)} style={{ fontSize: '11px' }} />
                      {editExcelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Thiết kế AI')}</label>
                      <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setEditAiFile)} style={{ fontSize: '11px' }} />
                      {editAiFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Thiết kế Corel (.cdr)')}</label>
                      <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setEditCorelFile)} style={{ fontSize: '11px' }} />
                      {editCorelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11.5px' }}>{t('File Hợp Đồng')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setEditContractFile)} style={{ fontSize: '11px' }} />
                      {editContractFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11.5px' }}>{t('Bản Báo Giá')}</label>
                      <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setEditQuoteFile)} style={{ fontSize: '11px' }} />
                      {editQuoteFile && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>{t('Đã chọn file')}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Catalog products lists */}
                  <div style={{ border: '1px dashed var(--color-border)', padding: '12px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                    <h4 style={{ color: 'var(--color-primary)', marginBottom: '8px' }}>
                      {t('1. Danh Mục Thiết Lập Sẵn Của Khách Hàng')}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {customers.find(c => c.id === selectedPO.customerId)?.products?.map((prod: any) => (
                        <button 
                          key={prod.id} 
                          type="button" 
                          className="btn btn-sm btn-outline"
                          onClick={() => addPredefinedItem(prod)}
                          style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 10px' }}
                        >
                          + {prod.productCode} ({prod.productName})
                        </button>
                      ))}
                      {(!customers.find(c => c.id === selectedPO.customerId)?.products || customers.find(c => c.id === selectedPO.customerId)?.products.length === 0) && (
                        <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                          {t('Khách hàng này chưa có danh mục mã hàng thiết lập sẵn. Vui lòng thêm dòng thủ công.')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected items list */}
                  <div style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ color: 'var(--color-primary)' }}>{t('2. Danh Sách Mã Hàng Chọn Đặt (PO Items)')}</h4>
                      <button type="button" className="btn btn-sm btn-outline btn-symbol" onClick={openAddItemModal} title={t('Thêm Dòng Thủ Công')}>+</button>
                    </div>

                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Mã Hàng')}</th>
                            <th>{t('Tên Hàng')}</th>
                            <th>{t('Quy Cách & Chất Liệu')}</th>
                            <th>{t('SL')}</th>
                            <th>{t('ĐG Bán')}</th>
                            <th>{t('Nhà Cung Cấp')}</th>
                            <th>{t('Giá Mua')}</th>
                            <th style={{ width: '90px' }}>{t('Thao tác')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poItems.map((item, index) => (
                            <tr key={item.itemId || index}>
                              <td style={{ fontWeight: 600 }}>{item.productCode}</td>
                              <td>{item.productName}</td>
                              <td>{item.size} ({item.material})</td>
                              <td>{item.quantity?.toLocaleString()}</td>
                              <td>{item.price?.toLocaleString()} đ</td>
                              <td>{item.supplierName || t('Chưa chọn')}</td>
                              <td>{item.purchasePrice?.toLocaleString()} đ</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditItemModal(index)} title={t('Sửa')}>✎</button>
                                  <button type="button" className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => removePoItem(index)} title={t('Xóa')}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {poItems.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                {t('Chưa chọn sản phẩm nào. Nhấp vào danh mục hoặc thêm dòng thủ công.')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '12px', fontWeight: 600, fontSize: '13px', color: 'var(--color-primary)', textAlign: 'right' }}>
                      {t('Tổng giá trị PO (chưa VAT):')} {poItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString()} đ
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

      {/* PO ITEM EDITOR MODAL */}
      {showItemModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>
                {editingItemIndex !== null ? t('CHỈNH SỬA MẶT HÀNG PO') : t('THÊM MỚI MẶT HÀNG PO')}
              </span>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowItemModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Mã Hàng')}</label>
                  <input 
                    type="text" 
                    value={itemProductCode} 
                    onChange={e => setItemProductCode(e.target.value)} 
                    placeholder="MANUAL, 5.07.006..."
                  />
                </div>
                <div className="form-group">
                  <label>{t('Tên Hàng *')}</label>
                  <input 
                    type="text" 
                    value={itemProductName} 
                    onChange={e => setItemProductName(e.target.value)} 
                    placeholder={t('Nhập tên sản phẩm nhãn hiệu...')}
                    required
                  />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Quy Cách / Kích Thước')}</label>
                    <input 
                      type="text" 
                      value={itemSize} 
                      onChange={e => setItemSize(e.target.value)} 
                      placeholder="100x100mm, 40mm x 300m..."
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Chất Liệu')}</label>
                    <input 
                      type="text" 
                      value={itemMaterial} 
                      onChange={e => setItemMaterial(e.target.value)} 
                      placeholder="Decal giấy, Decal nhựa..."
                    />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng *')}</label>
                    <input 
                      type="number" 
                      value={itemQuantity} 
                      onChange={e => setItemQuantity(Number(e.target.value))} 
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Giá Bán (đ) *')}</label>
                    <input 
                      type="number" 
                      value={itemPrice} 
                      onChange={e => setItemPrice(Number(e.target.value))} 
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Nhà Cung Cấp')}</label>
                    <select 
                      value={itemSupplierId} 
                      onChange={e => setItemSupplierId(e.target.value)}
                    >
                      <option value="">{t('Chọn NCC...')}</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.supplierName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Giá Mua / Giá Vốn (đ)')}</label>
                    <input 
                      type="number" 
                      value={itemPurchasePrice} 
                      onChange={e => setItemPurchasePrice(Number(e.target.value))} 
                      min="0"
                      placeholder={t('Giá vốn')}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowItemModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Mặt Hàng')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {selectedPO && (
        <FloatingChat 
          currentUser={currentUser}
          type="po"
          targetId={selectedPO.id}
          targetCode={selectedPO.poCode}
          messages={messages}
          users={users}
        />
      )}
    </div>
  );
};
