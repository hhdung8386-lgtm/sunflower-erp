import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { FloatingChat } from '../components/FloatingChat';
import POFormFullScreen from '../components/POFormFullScreen';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  X, 
  Check, 
  Copy,
  Folder, 
  FileText, 
  FileSpreadsheet
} from 'lucide-react';

interface SalesProps {
  pos: any[];
  customers: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
  initialSelectedPoId?: string;
  initialRepeatPoId?: string;
  onRepeatOrderOpened?: () => void;
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

export const Sales: React.FC<SalesProps> = ({ pos, customers, currentUser, onRefresh, initialSelectedPoId, initialRepeatPoId, onRepeatOrderOpened, messages, users }) => {
  const { t } = useLanguage();
  const isFull = currentUser.role === 'admin' || currentUser.role === 'accountant';
  const isSaleOnly = currentUser.role === 'sale' || currentUser.role === 'designer';
  const isPurchaseOnly = currentUser.role === 'purchaser';
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [repeatSourcePO, setRepeatSourcePO] = useState<any | null>(null);
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

  useEffect(() => {
    if (!initialRepeatPoId) return;
    const sourcePO = pos.find(po => po.id === initialRepeatPoId);
    if (!sourcePO) return;
    setSelectedPO(null);
    setRepeatSourcePO(sourcePO);
    setShowEditModal(false);
    setShowAddModal(true);
    onRepeatOrderOpened?.();
  }, [initialRepeatPoId, onRepeatOrderOpened, pos]);

  // Load suppliers locally
  const [suppliers, setSuppliers] = useState<any[]>([]);
  useEffect(() => {
    const fetchSuppliers = async () => {
      const data = await dbService.getCollection('suppliers');
      setSuppliers(data);
    };
    fetchSuppliers();
  }, []);

  // Modal lightbox preview image
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  const handleUpdateItemDiscount = async (itemIdx: number, newDiscount: number) => {
    if (!selectedPO) return;
    
    const updatedItems = selectedPO.items.map((item: any, idx: number) => {
      if (idx === itemIdx) {
        return { ...item, discountRate: newDiscount };
      }
      return item;
    });

    let totalBeforeVat = 0;
    let totalAfterVat = 0;
    let discountAmount = 0;

    updatedItems.forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const prc = Number(item.price) || 0;
      const disc = Number(item.discountRate) || 0;
      const vat = Number(item.vatRate) || 0;

      const sub = qty * prc * (1 - disc / 100);
      const withVat = sub * (1 + vat / 100);

      totalBeforeVat += sub;
      totalAfterVat += withVat;
      discountAmount += Math.round(qty * prc * (disc / 100));
    });

    const updatedPO = {
      ...selectedPO,
      items: updatedItems,
      totalAmount: Math.round(totalBeforeVat),
      discountAmount: Math.round(discountAmount),
      netAmount: Math.round(totalAfterVat),
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      items: updatedItems,
      totalAmount: updatedPO.totalAmount,
      discountAmount: updatedPO.discountAmount,
      netAmount: updatedPO.netAmount,
      updatedBy: updatedPO.updatedBy,
      updatedAt: updatedPO.updatedAt
    });

    setSelectedPO(updatedPO);
    onRefresh();
  };

  const handleUpdateItemNotes = async (itemIdx: number, fieldName: 'saleNotes' | 'designNotes', value: string) => {
    if (!selectedPO) return;
    
    const updatedItems = selectedPO.items.map((item: any, idx: number) => {
      if (idx === itemIdx) {
        return { ...item, [fieldName]: value };
      }
      return item;
    });

    const updatedPO = {
      ...selectedPO,
      items: updatedItems,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      items: updatedItems,
      updatedBy: updatedPO.updatedBy,
      updatedAt: updatedPO.updatedAt
    });

    setSelectedPO(updatedPO);
  };

  const handleUploadItemFiles = async (itemIdx: number, fieldName: 'saleLayouts' | 'designLayouts', files: FileList | null) => {
    if (!selectedPO || !files) return;

    const base64Promises = Array.from(files).map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });

    try {
      const base64Files = await Promise.all(base64Promises);
      
      const updatedItems = selectedPO.items.map((item: any, idx: number) => {
        if (idx === itemIdx) {
          const currentFiles = item[fieldName] || [];
          return { ...item, [fieldName]: [...currentFiles, ...base64Files] };
        }
        return item;
      });

      const updatedPO = {
        ...selectedPO,
        items: updatedItems,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      };

      await dbService.updateDocument('pos', selectedPO.id, {
        items: updatedItems,
        updatedBy: updatedPO.updatedBy,
        updatedAt: updatedPO.updatedAt
      });

      setSelectedPO(updatedPO);
    } catch (err) {
      console.error(err);
      alert(t('Lỗi khi tải file lên.'));
    }
  };

  const handleRemoveItemFile = async (itemIdx: number, fieldName: 'saleLayouts' | 'designLayouts', fileIdx: number) => {
    if (!selectedPO) return;

    const updatedItems = selectedPO.items.map((item: any, idx: number) => {
      if (idx === itemIdx) {
        const currentFiles = item[fieldName] || [];
        return { ...item, [fieldName]: currentFiles.filter((_: any, i: number) => i !== fileIdx) };
      }
      return item;
    });

    const updatedPO = {
      ...selectedPO,
      items: updatedItems,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      items: updatedItems,
      updatedBy: updatedPO.updatedBy,
      updatedAt: updatedPO.updatedAt
    });

    setSelectedPO(updatedPO);
  };

  const handleAddChecklistItem = async () => {
    if (!selectedPO || !newChecklistText.trim()) return;
    
    const newItem = {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      content: newChecklistText.trim(),
      completed: false,
      updatedAt: new Date().toISOString(),
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
    };

    const updatedChecklist = [...(selectedPO.internalChecklist || []), newItem];

    const updatedPO = {
      ...selectedPO,
      internalChecklist: updatedChecklist
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      internalChecklist: updatedChecklist
    });

    setSelectedPO(updatedPO);
    setNewChecklistText('');
    onRefresh();
  };

  const handleToggleChecklistItem = async (taskId: string) => {
    if (!selectedPO) return;

    const updatedChecklist = (selectedPO.internalChecklist || []).map((item: any) => {
      if (item.id === taskId) {
        return {
          ...item,
          completed: !item.completed,
          updatedAt: new Date().toISOString(),
          updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
        };
      }
      return item;
    });

    const updatedPO = {
      ...selectedPO,
      internalChecklist: updatedChecklist
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      internalChecklist: updatedChecklist
    });

    setSelectedPO(updatedPO);
    onRefresh();
  };

  const handleRemoveChecklistItem = async (taskId: string) => {
    if (!selectedPO) return;

    const updatedChecklist = (selectedPO.internalChecklist || []).filter((item: any) => item.id !== taskId);

    const updatedPO = {
      ...selectedPO,
      internalChecklist: updatedChecklist
    };

    await dbService.updateDocument('pos', selectedPO.id, {
      internalChecklist: updatedChecklist
    });

    setSelectedPO(updatedPO);
    onRefresh();
  };

  const handleOpenEditModal = (po: any) => {
    setSelectedPO(po);
    setShowEditModal(true);
  };

  const handleOpenRepeatOrder = (po: any) => {
    setRepeatSourcePO(po);
    setSelectedPO(null);
    setShowEditModal(false);
    setShowAddModal(true);
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

  const handleSavePO = async (poData: any) => {
    if (poData.id) {
      // Editing existing PO
      const subtotal = poData.totalAmount;
      const discountAmount = poData.discountAmount;
      const netAmount = poData.netAmount;

      const updatedLogs = [
        ...selectedPO.historyLogs,
        {
          status: selectedPO.status,
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `${t('Chỉnh sửa thông số đơn hàng PO')} (Tổng trị giá: ${subtotal.toLocaleString()} đ)`
        }
      ];

      await dbService.updateDocument('pos', poData.id, {
        expectedDeliveryDate: poData.expectedDeliveryDate,
        notes: poData.notes,
        customerPoCode: poData.customerPoCode,
        items: poData.items,
        assignments: poData.assignments || [],
        totalAmount: subtotal,
        discountAmount,
        netAmount,
        links: poData.links,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString(),
        historyLogs: updatedLogs
      });

      setShowEditModal(false);
      setSelectedPO(null);
    } else {
      // Creating new PO
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

      let reusableDesign: any | null = null;
      let reusableVersion: any | null = null;
      if (poData.repeatSourcePoId && poData.designReuseRequested) {
        const designList = await dbService.getCollection('designs');
        reusableDesign = designList.find((design: any) => (
          design.poId === poData.repeatSourcePoId && design.status === 'approved'
        )) || null;
        reusableVersion = reusableDesign?.versions?.find((version: any) => (
          version.versionNumber === reusableDesign.currentVersion
        )) || reusableDesign?.versions?.[reusableDesign.versions.length - 1] || (reusableDesign?.fileUrl ? {
          versionNumber: reusableDesign.currentVersion || 1,
          previewImage: reusableDesign.fileUrl,
          aiLink: reusableDesign.aiLink || '',
          corelLink: reusableDesign.corelLink || '',
          comment: reusableDesign.notes || '',
          createdAt: reusableDesign.updatedAt || reusableDesign.createdAt || ''
        } : null);
      }

      const initialStatus = reusableVersion ? 'layout_pending' : 'receive_po';
      const newItems = poData.items.map((item: any, index: number) => index === 0 && reusableVersion
        ? {
            ...item,
            previewImage: reusableVersion.previewImage || item.previewImage || '',
            previewImages: reusableVersion.previewImage
              ? Array.from(new Set([reusableVersion.previewImage, ...(item.previewImages || [])]))
              : (item.previewImages || []),
            designReuseStatus: 'pending_verification'
          }
        : item);

      const newPO = {
        poCode,
        customerPoCode: poData.customerPoCode || poCode,
        customerId: poData.customerId,
        customerName: poData.customerName,
        saleId: currentUser.uid,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: poData.expectedDeliveryDate,
        status: initialStatus,
        items: newItems,
        assignments: poData.assignments || [],
        totalAmount: poData.totalAmount,
        discountAmount: poData.discountAmount,
        netAmount: poData.netAmount,
        links: poData.links,
        notes: poData.notes,
        orderType: poData.orderType || 'new',
        repeatSourcePoId: poData.repeatSourcePoId || '',
        repeatSourcePoCode: poData.repeatSourcePoCode || '',
        designReuseRequested: Boolean(poData.designReuseRequested),
        designReuseStatus: reusableVersion ? 'pending_verification' : (poData.designReuseRequested ? 'source_not_approved' : ''),
        createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        createdAt: new Date().toISOString(),
        updatedBy: '',
        updatedAt: '',
        historyLogs: [
          {
            status: initialStatus,
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: reusableVersion
              ? `Tạo đơn đặt lại từ ${poData.repeatSourcePoCode}. Đã kế thừa mẫu thiết kế v${reusableVersion.versionNumber} đã duyệt và chuyển sang bước kiểm tra/xác nhận.`
              : poData.repeatSourcePoCode
                ? `Tạo đơn đặt lại từ ${poData.repeatSourcePoCode}. Đã kế thừa thông số; chưa tìm thấy mẫu thiết kế đã duyệt để tự động sử dụng.`
                : 'Khởi tạo đơn hàng mới trên ERP'
          }
        ]
      };

      const createdPO = await dbService.addDocument('pos', newPO);
      if (reusableDesign && reusableVersion) {
        const reusedVersion = {
          ...reusableVersion,
          versionNumber: 1,
          comment: `Tái sử dụng từ ${poData.repeatSourcePoCode} - mẫu v${reusableVersion.versionNumber}. ${reusableVersion.comment || ''}`.trim(),
          feedbackFromClient: '',
          feedbackAt: '',
          createdAt: new Date().toISOString(),
          createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
          reusedFromDesignId: reusableDesign.id,
          reusedFromPoId: poData.repeatSourcePoId,
          reusedFromVersion: reusableVersion.versionNumber
        };
        await dbService.addDocument('designs', {
          id: createdPO.id,
          poId: createdPO.id,
          designerId: currentUser.role === 'designer' ? currentUser.uid : 'u-designer',
          status: 'client_pending',
          currentVersion: 1,
          versions: [reusedVersion],
          reusedFromDesignId: reusableDesign.id,
          reusedFromPoId: poData.repeatSourcePoId,
          createdAt: new Date().toISOString()
        });
      }
      await dbService.updateDocument('customers', poData.customerId, {
        lastOrderAt: new Date().toISOString()
      });

      setShowAddModal(false);
      setRepeatSourcePO(null);
    }

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
          <button className="btn btn-primary btn-symbol" onClick={() => { setRepeatSourcePO(null); setShowAddModal(true); }} title={t('TẠO ĐƠN HÀNG PO MỚI')}>
            <Plus size={18} />
          </button>
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
            <button className="btn btn-outline btn-symbol" onClick={() => setSearchTerm('')} title={t('Xóa Tìm Kiếm')}>
              <X size={16} />
            </button>
            <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleExportCSV}>
              <FileSpreadsheet size={16} />
              <span>{t('Xuất Excel')}</span>
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
                    <button className="btn btn-sm btn-outline repeat-order-button" onClick={() => handleOpenRepeatOrder(selectedPO)} title="Tạo PO mới từ đơn này">
                      <Copy size={14} />
                      <span>Đặt lại từ PO này</span>
                    </button>
                    <button className="btn btn-sm btn-primary btn-symbol-sm" onClick={() => handleOpenEditModal(selectedPO)} title={t('Sửa')}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeletePO(selectedPO.id)} title={t('Xóa')}>
                      <Trash2 size={14} />
                    </button>
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
                      <div className="step-bubble">
                        {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                      </div>
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
                          <th>{t('Chi tiết')}</th>
                          <th>{t('Mã Hàng')}</th>
                          <th>{t('Tên Hàng')}</th>
                          <th>{t('Quy Cách')}</th>
                          <th>{t('Số Lượng')}</th>
                          
                          {/* Sale columns */}
                          {(isFull || isSaleOnly) && (
                            <>
                              <th>{t('Đơn Giá Bán')}</th>
                              <th>{t('CK (%)')}</th>
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
                            <>
                              <th>{t('Tiền Chênh (đ)')}</th>
                              <th>{t('Lợi Nhuận Gộp')}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPO.items?.map((item: any, idx: number) => {
                          const sellingTotal = item.quantity * item.price * (1 - (item.discountRate || 0) / 100);
                          const buyingTotal = item.quantity * (item.purchasePrice || 0);
                          const profit = sellingTotal - buyingTotal;
                          const itemId = item.itemId || `${idx}`;
                          
                          return (
                            <React.Fragment key={itemId}>
                              <tr>
                                <td>
                                  <button 
                                    type="button"
                                    className="btn btn-sm btn-outline"
                                    style={{ padding: '2px 6px', fontSize: '11px' }}
                                    onClick={() => {
                                      if (expandedItemIds.includes(itemId)) {
                                        setExpandedItemIds(expandedItemIds.filter(id => id !== itemId));
                                      } else {
                                        setExpandedItemIds([...expandedItemIds, itemId]);
                                      }
                                    }}
                                  >
                                    {expandedItemIds.includes(itemId) ? t('Ẩn') : t('Xem')}
                                  </button>
                                </td>
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
                                    <td>
                                      {(currentUser.role === 'admin' || currentUser.role === 'sale') ? (
                                        <input 
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={item.discountRate ?? 0}
                                          onChange={(e) => handleUpdateItemDiscount(idx, Number(e.target.value))}
                                          style={{ width: '55px', padding: '2px 4px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                        />
                                      ) : (
                                        <span>{item.discountRate || 0}%</span>
                                      )}
                                    </td>
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
                                  <>
                                    <td style={{ fontWeight: '500' }}>
                                      {((item.price * (1 - (item.discountRate || 0) / 100)) - (item.purchasePrice || 0))?.toLocaleString()} đ
                                    </td>
                                    <td style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
                                      {profit?.toLocaleString()} đ
                                    </td>
                                  </>
                                )}
                              </tr>
                              {expandedItemIds.includes(itemId) && (
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                  <td colSpan={isFull ? 12 : 8} style={{ padding: '16px', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                      {/* SALE PANEL */}
                                      <div style={{ borderRight: '1px solid var(--color-border-light)', paddingRight: '20px' }}>
                                        <h4 style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '14px', fontWeight: 'bold' }}>
                                          <span>📝</span> {t('Yêu Cầu & Tài Liệu Của Sale')}
                                        </h4>
                                        <div className="form-group" style={{ marginBottom: '12px' }}>
                                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '12.5px' }}>{t('Yêu cầu thiết kế / Ghi chú:')}</label>
                                          {(currentUser.role === 'admin' || currentUser.role === 'sale') ? (
                                            <textarea 
                                              className="form-control"
                                              style={{ width: '100%', minHeight: '60px', padding: '6px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                              value={item.saleNotes || ''}
                                              onChange={(e) => handleUpdateItemNotes(idx, 'saleNotes', e.target.value)}
                                              placeholder={t('Nhập ghi chú yêu cầu thiết kế...')}
                                            />
                                          ) : (
                                            <div style={{ padding: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', minHeight: '40px', fontSize: '13px' }}>
                                              {item.saleNotes || t('Không có ghi chú')}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="form-group" style={{ marginBottom: '12px' }}>
                                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '12.5px' }}>{t('Layout Sale Tải Lên (Hình ảnh/File):')}</label>
                                          {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                                            <input 
                                              type="file" 
                                              multiple
                                              accept="image/*"
                                              onChange={(e) => handleUploadItemFiles(idx, 'saleLayouts', e.target.files)}
                                              style={{ fontSize: '12px', marginBottom: '8px' }}
                                            />
                                          )}
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {(item.saleLayouts || []).map((fileUrl: string, fidx: number) => (
                                              <div key={fidx} style={{ position: 'relative', display: 'inline-block' }}>
                                                <img 
                                                  src={fileUrl} 
                                                  alt="Sale Layout" 
                                                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'zoom-in' }}
                                                  onClick={() => setPreviewImage(fileUrl)}
                                                />
                                                {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                                                  <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveItemFile(idx, 'saleLayouts', fidx)}
                                                    style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                  >
                                                    ×
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                            {(!item.saleLayouts || item.saleLayouts.length === 0) && (
                                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa tải lên file/hình ảnh')}</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {item.previewImage && (
                                          <div style={{ marginTop: '12px' }}>
                                            <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>{t('Hình ảnh Layout Thiết kế cũ:')}</label>
                                            <img 
                                              src={item.previewImage} 
                                              alt="Old Layout" 
                                              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'zoom-in' }}
                                              onClick={() => setPreviewImage(item.previewImage)}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {/* DESIGNER PANEL */}
                                      <div>
                                        <h4 style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '14px', fontWeight: 'bold' }}>
                                          <span>🎨</span> {t('Phản Hồi & File Thiết Kế Hoàn Thiện')}
                                        </h4>
                                        <div className="form-group" style={{ marginBottom: '12px' }}>
                                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '12.5px' }}>{t('Trả yêu cầu TK / Ghi chú Thiết kế:')}</label>
                                          {(currentUser.role === 'admin' || currentUser.role === 'designer') ? (
                                            <textarea 
                                              className="form-control"
                                              style={{ width: '100%', minHeight: '60px', padding: '6px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                              value={item.designNotes || ''}
                                              onChange={(e) => handleUpdateItemNotes(idx, 'designNotes', e.target.value)}
                                              placeholder={t('Nhập phản hồi từ bộ phận thiết kế...')}
                                            />
                                          ) : (
                                            <div style={{ padding: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', minHeight: '40px', fontSize: '13px' }}>
                                              {item.designNotes || t('Chưa có phản hồi thiết kế')}
                                            </div>
                                          )}
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '12px' }}>
                                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '12.5px' }}>{t('File Thiết Kế Up (Hoàn thiện):')}</label>
                                          {(currentUser.role === 'admin' || currentUser.role === 'designer') && (
                                            <input 
                                              type="file" 
                                              multiple
                                              accept="image/*"
                                              onChange={(e) => handleUploadItemFiles(idx, 'designLayouts', e.target.files)}
                                              style={{ fontSize: '12px', marginBottom: '8px' }}
                                            />
                                          )}
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {(item.designLayouts || []).map((fileUrl: string, fidx: number) => (
                                              <div key={fidx} style={{ position: 'relative', display: 'inline-block' }}>
                                                <img 
                                                  src={fileUrl} 
                                                  alt="Design Layout" 
                                                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'zoom-in' }}
                                                  onClick={() => setPreviewImage(fileUrl)}
                                                />
                                                {(currentUser.role === 'admin' || currentUser.role === 'designer') && (
                                                  <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveItemFile(idx, 'designLayouts', fidx)}
                                                    style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                  >
                                                    ×
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                            {(!item.designLayouts || item.designLayouts.length === 0) && (
                                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa có file thiết kế hoàn chỉnh')}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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
                  <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>✅ {t('MỤC PHẢN HỒI & TIẾN ĐỘ NỘI BỘ')}</h3>
                  
                  {/* Add checklist item */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input 
                      type="text" 
                      className="form-control"
                      style={{ flex: 1, padding: '4px 8px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      placeholder={t('Thêm phản hồi/tiến độ...')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddChecklistItem();
                      }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-sm btn-primary" 
                      onClick={handleAddChecklistItem}
                    >
                      {t('Thêm')}
                    </button>
                  </div>

                  {/* Checklist List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                    {(selectedPO.internalChecklist || []).map((task: any) => (
                      <div 
                        key={task.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '8px 10px', 
                          border: '1px solid var(--color-border-light)', 
                          borderRadius: '4px',
                          backgroundColor: task.completed ? '#f0fdf4' : '#fff'
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 'normal', fontSize: '13px', flex: 1 }}>
                          <input 
                            type="checkbox" 
                            checked={task.completed} 
                            onChange={() => handleToggleChecklistItem(task.id)}
                          />
                          <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#16a34a' : 'inherit' }}>
                            {task.content}
                          </span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {task.updatedBy?.split(' (')[0]}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveChecklistItem(task.id)}
                            style={{ background: 'transparent', border: 'none', color: 'red', cursor: 'pointer', fontSize: '12px' }}
                            title={t('Xóa')}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!selectedPO.internalChecklist || selectedPO.internalChecklist.length === 0) && (
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {t('Chưa có phản hồi/tiến độ công việc nào.')}
                      </span>
                    )}
                  </div>
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

      {/* FULLSCREEN PO FORM (CREATE & EDIT) */}
      {(showAddModal || showEditModal) && (
        <POFormFullScreen
          isOpen={showAddModal || showEditModal}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setRepeatSourcePO(null);
            setSelectedPO(null);
          }}
          po={showEditModal ? selectedPO : null}
          templatePo={showAddModal ? repeatSourcePO : null}
          onSave={handleSavePO}
          customers={customers}
          suppliers={suppliers}
          users={users}
          currentUser={currentUser}
          t={t}
        />
      )}

      {selectedPO && !showEditModal && (
        <FloatingChat 
          currentUser={currentUser}
          type="po"
          targetId={selectedPO.id}
          targetCode={selectedPO.poCode}
          messages={messages}
          users={users}
        />
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
