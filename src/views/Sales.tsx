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
  const isFull = currentUser.role === 'admin' || currentUser.role === 'accountant';
  const isSaleOnly = currentUser.role === 'sale' || currentUser.role === 'designer';
  const isPurchaseOnly = currentUser.role === 'purchaser';
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

  const [customerPoCode, setCustomerPoCode] = useState('');
  const [editCustomerPoCode, setEditCustomerPoCode] = useState('');
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [isEditRepoMode, setIsEditRepoMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
    setEditCustomerPoCode(po.customerPoCode || '');
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
      customerPoCode: editCustomerPoCode,
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
    const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (Giám Đốc/Admin):'));
    if (password === 'admin123' || password === '123456') {
      await dbService.updateDocument('pos', poId, {
        deleted: true,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      });
      setSelectedPO(null);
      onRefresh();
      alert(t('Đã chuyển đơn hàng PO vào Kho Rác.'));
    } else if (password !== null) {
      alert(t('Mật khẩu không chính xác. Xóa thất bại.'));
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
    setCustomerPoCode('');
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

    // Auto sequential YYYYMM code
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO-${yyyy}${mm}-`;
    
    const monthPOs = pos.filter(p => p.poCode && p.poCode.startsWith(prefix));
    let maxSeq = 0;
    monthPOs.forEach(p => {
      const parts = p.poCode.split('-');
      if (parts.length === 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    const poCode = `${prefix}${nextSeq}`;

    const newPO = {
      poCode,
      customerPoCode: customerPoCode || poCode, // If custom code empty, fallback to generated code
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

  const handleExportCSV = () => {
    const headers = [
      t('Mã PO Nội bộ'),
      t('Mã PO Khách hàng'),
      t('Tên Khách Hàng'),
      t('Ngày Đặt Hàng'),
      t('Ngày Giao Dự Kiến'),
      t('Tổng Giá Trị'),
      t('Trạng Thái')
    ];

    const rows = filteredPOs.map(po => [
      po.poCode,
      po.customerPoCode || '',
      po.customerName,
      po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : '',
      po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('vi-VN') : '',
      po.netAmount,
      t(PO_STATES.find(s => s.value === po.status)?.label || po.status)
    ]);

    let csvContent = '\uFEFF'; // BOM for Excel UTF-8
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(val => {
        const strVal = String(val ?? '');
        return `"${strVal.replace(/"/g, '""')}"`;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ERP_DanhSach_PO_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPOs = pos.filter(po => {
    if (po.deleted === true) return false;
    
    // Filter by sale role: only show POs where saleId matches or assignedSaleId matches or created by self
    if (currentUser.role === 'sale') {
      const createdBySelf = po.createdBy && po.createdBy.includes(currentUser.displayName);
      const isOwner = po.saleId === currentUser.uid;
      const isAssigned = po.assignedSaleId === currentUser.uid;
      if (!isOwner && !isAssigned && !createdBySelf) {
        return false;
      }
    }
    return (
      po.poCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.customerPoCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && !selectedPO && (
          <button className="btn btn-primary btn-symbol" onClick={handleOpenAddModal} title={t('TẠO ĐƠN HÀNG PO MỚI')}>+</button>
        )}
      </div>

      {!selectedPO && (
        <div className="card">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder={t('Nhập mã PO, tên sản phẩm hoặc khách hàng...')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '400px', flex: 1 }}
            />
            <button className="btn btn-outline btn-symbol" onClick={() => setSearchTerm('')} title={t('Xóa Tìm Kiếm')}>✕</button>
            <button className="btn btn-outline" onClick={handleExportCSV}>
              📥 {t('Xuất Excel')}
            </button>
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
                      <td style={{ fontWeight: 600 }}>
                        {po.poCode}
                        {po.customerPoCode && po.customerPoCode !== po.poCode && (
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                            ({po.customerPoCode})
                          </span>
                        )}
                      </td>
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
                        <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); setSelectedPO(po); }}>{t('Chi Tiết')}</button>
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
      )}

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
                          
                          {/* Sale columns */}
                          {(isFull || isSaleOnly) && (
                            <>
                              <th>{t('Đơn Giá Bán')}</th>
                              <th>{t('Thành Tiền Bán')}</th>
                            </>
                          )}
                          
                          {/* Purchase columns */}
                          {(isFull || isPurchaseOnly) && (
                            <>
                              <th>{t('Nhà Cung Cấp')}</th>
                              <th>{t('Đơn Giá Mua')}</th>
                              <th>{t('Thành Tiền Mua')}</th>
                            </>
                          )}
                          
                          {/* Profit columns */}
                          {isFull && (
                            <th>{t('Lợi Nhuận Gộp')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPO.items?.map((item: any, idx: number) => {
                          const sellingTotal = item.quantity * item.price;
                          const buyingTotal = item.quantity * (item.purchasePrice || 0);
                          const profit = sellingTotal - buyingTotal;
                          
                          return (
                            <tr key={item.itemId || idx}>
                              <td style={{ fontWeight: 600 }}>{item.productCode || 'N/A'}</td>
                              <td>{item.productName}</td>
                              <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {item.size} ({item.material})
                              </td>
                              <td>{item.quantity?.toLocaleString()}</td>
                              
                              {/* Sale cells */}
                              {(isFull || isSaleOnly) && (
                                <>
                                  <td>{item.price?.toLocaleString()} đ</td>
                                  <td>{sellingTotal?.toLocaleString()} đ</td>
                                </>
                              )}
                              
                              {/* Purchase cells */}
                              {(isFull || isPurchaseOnly) && (
                                <>
                                  <td>
                                    {item.supplierName ? (
                                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                        {item.supplierName}
                                      </span>
                                    ) : (
                                      <span style={{ fontStyle: 'italic', color: 'var(--color-warning)' }}>{t('Chưa phân bổ')}</span>
                                    )}
                                  </td>
                                  <td>{(item.purchasePrice || 0)?.toLocaleString()} đ</td>
                                  <td>{buyingTotal?.toLocaleString()} đ</td>
                                </>
                              )}
                              
                              {/* Profit cells */}
                              {isFull && (
                                <td style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
                                  {profit?.toLocaleString()} đ
                                </td>
                              )}
                            </tr>
                          );
                        })}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {Object.entries(selectedPO.links || {}).map(([key, value]) => {
                      if (!value || typeof value !== 'string') return null;
                      const isImage = value.startsWith('data:image/');
                      
                      const labels: { [key: string]: string } = {
                        pdfLink: t('PDF Đơn Hàng'),
                        excelLink: t('Excel Báo Giá'),
                        aiLink: t('Thiết Kế Gốc AI'),
                        corelLink: t('Thiết Kế Corel (.cdr)'),
                        contractLink: t('Hợp Đồng'),
                        quoteLink: t('Bản Báo Giá')
                      };
                      const label = labels[key] || key;
                      
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', border: '1px solid var(--color-border)', borderRadius: '4px', backgroundColor: 'var(--color-bg-light)' }}>
                          {isImage ? (
                            <img 
                              src={value} 
                              alt={label} 
                              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--color-border)' }} 
                              onClick={() => setPreviewImage(value)}
                              title={t('Click để phóng to')}
                            />
                          ) : (
                            <span style={{ padding: '6px 8px', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color: '#475569', border: '1px solid #cbd5e1' }}>DOC</span>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {isImage ? t('Hình ảnh (Base64)') : t('Tài liệu đính kèm')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {isImage && (
                              <button type="button" className="btn btn-sm btn-outline" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => setPreviewImage(value)}>
                                {t('Xem')}
                              </button>
                            )}
                            <a href={value} download={`${label}_${selectedPO.poCode}`} className="btn btn-sm btn-primary" style={{ padding: '2px 8px', fontSize: '10px', textDecoration: 'none', textAlign: 'center' }}>
                              {t('Tải về')}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                    {!Object.values(selectedPO.links || {}).some(Boolean) && (
                      <span className="text-muted" style={{ gridColumn: 'span 2' }}>{t('Chưa có tài liệu đính kèm nào được tải lên.')}</span>
                    )}
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
                    <label>{t('Mã PO Khách Hàng (Tùy chọn)')}</label>
                    <input 
                      type="text" 
                      value={customerPoCode} 
                      onChange={(e) => setCustomerPoCode(e.target.value)} 
                      placeholder={t('Ví dụ: VFT26-553...')} 
                    />
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
                    {customerId && (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline" 
                        style={{ marginBottom: '12px', width: '100%', display: 'block' }}
                        onClick={() => {
                          setIsEditRepoMode(false);
                          setShowRepoModal(true);
                        }}
                      >
                        📁 {t('Nhúp từ kho tệp khách hàng')}
                      </button>
                    )}
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
                    <label>{t('Mã PO Khách Hàng')}</label>
                    <input 
                      type="text" 
                      value={editCustomerPoCode} 
                      onChange={(e) => setEditCustomerPoCode(e.target.value)} 
                      placeholder={t('Ví dụ: VFT26-553...')} 
                    />
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
                    {selectedPO.customerId && (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline" 
                        style={{ marginBottom: '12px', width: '100%', display: 'block' }}
                        onClick={() => {
                          setIsEditRepoMode(true);
                          setShowRepoModal(true);
                        }}
                      >
                        📁 {t('Nhúp từ kho tệp khách hàng')}
                      </button>
                    )}
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

      {/* Customer Repo Pick Modal */}
      {showRepoModal && (isEditRepoMode ? selectedPO : true) && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>
                📂 {t('KHO LƯU TRỮ TỆP KHÁCH HÀNG')}: {
                  isEditRepoMode 
                    ? selectedPO.customerName 
                    : customers.find(c => c.id === customerId)?.companyName || ''
                }
              </span>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowRepoModal(false)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {(() => {
                const targetCust = isEditRepoMode 
                  ? customers.find(c => c.id === selectedPO.customerId)
                  : customers.find(c => c.id === customerId);
                
                if (!targetCust || !targetCust.files || targetCust.files.length === 0) {
                  return (
                    <p className="text-center text-muted" style={{ padding: '20px' }}>
                      {t('Kho lưu trữ của khách hàng này hiện tại chưa có tệp tin nào.')}
                    </p>
                  );
                }

                return (
                  <div>
                    <p style={{ fontSize: '12.5px', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
                      {t('Chọn một tệp từ kho lưu trữ để đính kèm vào phần tương ứng:')}
                    </p>
                    
                    {Object.entries(
                      targetCust.files.reduce((acc: any, file: any) => {
                        const folderName = file.folder || t('Chưa phân mục');
                        if (!acc[folderName]) acc[folderName] = [];
                        acc[folderName].push(file);
                        return acc;
                      }, {})
                    ).map(([folderName, folderFiles]: any) => (
                      <div key={folderName} style={{ marginBottom: '16px' }}>
                        <h5 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                          📁 {folderName}
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {folderFiles.map((file: any, fIdx: number) => (
                            <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }}>
                              <span style={{ fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }} title={file.name}>📄 {file.name}</span>
                              <div>
                                <select 
                                  onChange={(e) => {
                                    const target = e.target.value;
                                    if (!target) return;
                                    
                                    if (isEditRepoMode) {
                                      if (target === 'pdf') setEditPdfFile(file.base64);
                                      if (target === 'excel') setEditExcelFile(file.base64);
                                      if (target === 'ai') setEditAiFile(file.base64);
                                      if (target === 'corel') setEditCorelFile(file.base64);
                                      if (target === 'contract') setEditContractFile(file.base64);
                                      if (target === 'quote') setEditQuoteFile(file.base64);
                                    } else {
                                      if (target === 'pdf') setPdfFile(file.base64);
                                      if (target === 'excel') setExcelFile(file.base64);
                                      if (target === 'ai') setAiFile(file.base64);
                                      if (target === 'corel') setCorelFile(file.base64);
                                      if (target === 'contract') setContractFile(file.base64);
                                      if (target === 'quote') setQuoteFile(file.base64);
                                    }
                                    
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

      {/* Image Preview Zoom Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '90%', maxHeight: '90%', padding: '10px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-outline" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '1.2rem', zIndex: 10 }} onClick={() => setPreviewImage(null)}>×</button>
            <img src={previewImage} alt="Preview Zoom" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <a href={previewImage} download={`Preview_${Date.now()}.jpg`} className="btn btn-primary">{t('Tải Ảnh Về')}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
