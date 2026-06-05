import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Pencil, X, Download, FileSpreadsheet } from 'lucide-react';

interface PurchaseProps {
  pos: any[];
  purchaseOrders: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
  users: UserProfile[];
}

export const Purchase: React.FC<PurchaseProps> = ({ pos, purchaseOrders, currentUser, onRefresh, users }) => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // Modal states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showAddPurModal, setShowAddPurModal] = useState(false);
  const [showEditPurModal, setShowEditPurModal] = useState(false);
  const [selectedPur, setSelectedPur] = useState<any | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  // Supplier Contracts States
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [contractNo, setContractNo] = useState('');
  const [contractSignDate, setContractSignDate] = useState('');
  const [contractExpiryDate, setContractExpiryDate] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [contractFile, setContractFile] = useState('');

  // Supplier Debt States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payNote, setPayNote] = useState('');

  // Form states - Supplier
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Form states - Edit Supplier
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Form states - Purchase Order (PUR)
  const [supplierId, setSupplierId] = useState('');
  const [linkedPoId, setLinkedPoId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('m²');
  const [unitPrice, setUnitPrice] = useState(10000);
  const [expectedReceiveDate, setExpectedReceiveDate] = useState('');

  // Form states - Edit PUR
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editLinkedPoId, setEditLinkedPoId] = useState('');
  const [editMaterialName, setEditMaterialName] = useState('');
  const [editQuantity, setEditQuantity] = useState(100);
  const [editUnit, setEditUnit] = useState('m²');
  const [editUnitPrice, setEditUnitPrice] = useState(10000);
  const [editExpectedReceiveDate, setEditExpectedReceiveDate] = useState('');

  const [addAssignedPurchaserId, setAddAssignedPurchaserId] = useState('');
  const [editAssignedPurchaserId, setEditAssignedPurchaserId] = useState('');

  const purchasers = (users || []).filter(u => u.role === 'purchaser');

  const handleExportCSV = () => {
    const headers = [
      t('Mã Đơn Mua'),
      t('Nhà Cung Cấp'),
      t('Chi Tiết Vật Tư'),
      t('Giá Trị'),
      t('PO Liên Kết'),
      t('Người Phụ Trách'),
      t('Ngày Nhận Dự Kiến'),
      t('Trạng Thái')
    ];

    const rows = filteredPurchaseOrders.map(pur => [
      pur.purCode,
      pur.supplierName,
      pur.items?.map((i: any) => `${i.materialName} (${i.quantity} ${i.unit})`).join('; ') || '',
      pur.totalPrice,
      pur.linkedPoCode || '',
      pur.assignedPurchaserName || '',
      pur.expectedReceiveDate ? new Date(pur.expectedReceiveDate).toLocaleDateString('vi-VN') : '',
      pur.status === 'received' ? t('Đã nhận kho') : t(pur.status)
    ]);

    let csvContent = '\uFEFF'; // BOM
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
    link.setAttribute('download', `ERP_DanhSach_MuaHang_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPurchaseOrders = (purchaseOrders || [])
    .filter(pur => !pur.deleted)
    .filter(pur => {
      if (currentUser.role === 'admin' || currentUser.role === 'accountant') return true;
      return pur.assignedPurchaserId === currentUser.uid || 
             (!pur.assignedPurchaserId && (pur.createdBy || '').includes(currentUser.displayName));
    });

  const handleOpenEditSupplier = (sup: any) => {
    setSelectedSupplier(sup);
    setEditSupplierName(sup.supplierName);
    setEditContactPerson(sup.contactPerson || '');
    setEditPhone(sup.phone || '');
    setEditEmail(sup.email || '');
    setEditAddress(sup.address || '');
    setShowEditSupplierModal(true);
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !editSupplierName) return;

    await dbService.updateDocument('suppliers', selectedSupplier.id, {
      supplierName: editSupplierName,
      contactPerson: editContactPerson,
      phone: editPhone,
      email: editEmail,
      address: editAddress,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditSupplierModal(false);
    setSelectedSupplier(null);
    const updated = await dbService.getCollection('suppliers');
    setSuppliers(updated);
  };

  const handleDeleteSupplier = async (supId: string) => {
    const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (Giám Đốc/Admin):'));
    if (password === 'admin123' || password === '123456') {
      await dbService.updateDocument('suppliers', supId, {
        deleted: true,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      });
      const updated = await dbService.getCollection('suppliers');
      setSuppliers(updated);
      alert(t('Đã chuyển nhà cung cấp vào Kho Rác.'));
    } else if (password !== null) {
      alert(t('Mật khẩu không chính xác. Xóa thất bại.'));
    }
  };

  const handleOpenEditPur = (pur: any) => {
    setSelectedPur(pur);
    setEditSupplierId(pur.supplierId);
    setEditLinkedPoId(pur.linkedPoId || '');
    const item = pur.items?.[0] || {};
    setEditMaterialName(item.materialName || '');
    setEditQuantity(item.quantity || 100);
    setEditUnit(item.unit || 'm²');
    setEditUnitPrice(item.unitPrice || 10000);
    setEditExpectedReceiveDate(new Date(pur.expectedReceiveDate).toISOString().split('T')[0]);
    setEditAssignedPurchaserId(pur.assignedPurchaserId || '');
    setShowEditPurModal(true);
  };

  const handleEditPurSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPur || !editSupplierId || !editMaterialName) return;

    const supplier = suppliers.find(s => s.id === editSupplierId);
    const linkedPo = pos.find(p => p.id === editLinkedPoId);
    const subtotal = Number(editQuantity) * Number(editUnitPrice);

    const finalPurchaserName = purchasers.find(u => u.uid === editAssignedPurchaserId)?.displayName || '';

    await dbService.updateDocument('purchase_orders', selectedPur.id, {
      supplierId: editSupplierId,
      supplierName: supplier?.supplierName || '',
      linkedPoId: editLinkedPoId || '',
      linkedPoCode: linkedPo?.poCode || 'Không có',
      items: [
        {
          materialName: editMaterialName,
          quantity: Number(editQuantity),
          unit: editUnit,
          unitPrice: Number(editUnitPrice),
          totalPrice: subtotal
        }
      ],
      totalPrice: subtotal,
      expectedReceiveDate: new Date(editExpectedReceiveDate).toISOString(),
      assignedPurchaserId: editAssignedPurchaserId,
      assignedPurchaserName: finalPurchaserName,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditPurModal(false);
    setSelectedPur(null);
    setEditAssignedPurchaserId('');
    onRefresh();
  };

  const handleDeletePur = async (purId: string) => {
    const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (Giám Đốc/Admin):'));
    if (password === 'admin123' || password === '123456') {
      await dbService.updateDocument('purchase_orders', purId, {
        deleted: true,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      });
      setSelectedPur(null);
      onRefresh();
      alert(t('Đã chuyển đơn mua hàng NCC vào Kho Rác.'));
    } else if (password !== null) {
      alert(t('Mật khẩu không chính xác. Xóa thất bại.'));
    }
  };

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setContractFile(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !contractNo) return;

    const newContract = {
      id: `contr-${Math.random().toString(36).substr(2, 9)}`,
      contractNo,
      signDate: contractSignDate,
      expiryDate: contractExpiryDate,
      value: Number(contractValue),
      fileUrl: contractFile,
      status: new Date(contractExpiryDate).getTime() > Date.now() ? 'active' : 'expired',
      createdAt: new Date().toISOString()
    };

    const updatedContracts = [...(selectedSupplier.contracts || []), newContract];

    await dbService.updateDocument('suppliers', selectedSupplier.id, {
      contracts: updatedContracts
    });

    setSelectedSupplier({ ...selectedSupplier, contracts: updatedContracts });
    const updated = await dbService.getCollection('suppliers');
    setSuppliers(updated);

    setShowAddContractModal(false);
    setContractNo('');
    setContractFile('');
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa hợp đồng này?'))) {
      const updatedContracts = (selectedSupplier.contracts || []).filter((c: any) => c.id !== contractId);
      
      await dbService.updateDocument('suppliers', selectedSupplier.id, {
        contracts: updatedContracts
      });

      setSelectedSupplier({ ...selectedSupplier, contracts: updatedContracts });
      const updated = await dbService.getCollection('suppliers');
      setSuppliers(updated);
    }
  };

  const handleOpenPayment = (inv: any) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.amount - inv.paidAmount);
    setPayNote('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || payAmount <= 0) return;

    const newPaidAmount = selectedInvoice.paidAmount + Number(payAmount);
    const newStatus = newPaidAmount >= selectedInvoice.amount ? 'paid' : 'partially_paid';

    await dbService.updateDocument('invoices', selectedInvoice.id, {
      paidAmount: newPaidAmount,
      status: newStatus,
      paymentNote: payNote,
      updatedAt: new Date().toISOString()
    });

    setShowPaymentModal(false);
    setSelectedInvoice(null);

    const invInvoices = await dbService.getCollection('invoices');
    setInvoices(invInvoices);
    onRefresh();
  };

  useEffect(() => {
    const fetchData = async () => {
      const supList = await dbService.getCollection('suppliers');
      const invList = await dbService.getCollection('inventory');
      const invInvoices = await dbService.getCollection('invoices');
      setSuppliers(supList);
      setInventory(invList);
      setInvoices(invInvoices);
      if (supList.length > 0) setSupplierId(supList[0].id);
      if (pos.length > 0) setLinkedPoId(pos[0].id);
    };
    fetchData();
  }, [pos]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) return;

    await dbService.addDocument('suppliers', {
      supplierName,
      contactPerson,
      phone,
      email,
      address,
      contracts: [],
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    });

    setShowAddSupplierModal(false);
    setSupplierName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    
    const updated = await dbService.getCollection('suppliers');
    setSuppliers(updated);
  };

  const handleCreatePur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !materialName || !quantity || !unitPrice) return;

    const supplier = suppliers.find(s => s.id === supplierId);
    const linkedPo = pos.find(p => p.id === linkedPoId);

    const subtotal = quantity * unitPrice;
    const purCode = `PUR-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalPurchaserId = addAssignedPurchaserId || (currentUser.role === 'purchaser' ? currentUser.uid : '');
    const finalPurchaserName = purchasers.find(u => u.uid === finalPurchaserId)?.displayName || (currentUser.role === 'purchaser' ? currentUser.displayName : '');

    const newPur = {
      purCode,
      supplierId,
      supplierName: supplier?.supplierName || '',
      linkedPoId: linkedPoId || '',
      linkedPoCode: linkedPo?.poCode || 'Không có',
      items: [
        {
          materialName,
          quantity: Number(quantity),
          unit,
          unitPrice: Number(unitPrice),
          totalPrice: subtotal
        }
      ],
      totalPrice: subtotal,
      status: 'ordered',
      expectedReceiveDate: new Date(expectedReceiveDate).toISOString(),
      actualReceiveDate: '',
      assignedPurchaserId: finalPurchaserId,
      assignedPurchaserName: finalPurchaserName,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('purchase_orders', newPur);

    // If purchase links to a PO, update PO timeline and log
    if (linkedPoId) {
      const updatedLogs = [
        ...linkedPo.historyLogs,
        {
          status: 'supplier_ordered',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Đã đặt mua vật tư (${materialName} x ${quantity} ${unit}) của nhà cung cấp: ${supplier?.supplierName}`
        }
      ];
      await dbService.updateDocument('pos', linkedPo.id, {
        status: 'supplier_ordered',
        historyLogs: updatedLogs
      });
    }

    setShowAddPurModal(false);
    setMaterialName('');
    setQuantity(100);
    setUnitPrice(10000);
    setAddAssignedPurchaserId('');
    onRefresh();
  };

  const updatePurStatus = async (purId: string, newStatus: string) => {
    const pur = purchaseOrders.find(p => p.id === purId);
    if (!pur) return;

    const updates: any = { status: newStatus };
    
    if (newStatus === 'received') {
      updates.actualReceiveDate = new Date().toISOString();
      
      // AUTO INCREMENT WAREHOUSE INVENTORY QUANTITY
      const invList = await dbService.getCollection('inventory');
      for (const purItem of pur.items) {
        const matchItem = invList.find((item: any) => item.materialName.toLowerCase() === purItem.materialName.toLowerCase());
        if (matchItem) {
          const newQty = Number(matchItem.qtyInStock) + Number(purItem.quantity);
          await dbService.updateDocument('inventory', matchItem.id, {
            qtyInStock: newQty,
            updatedAt: new Date().toISOString()
          });
        } else {
          await dbService.addDocument('inventory', {
            materialName: purItem.materialName,
            category: purItem.materialName.toLowerCase().includes('mực') ? 'ink' : 
                      purItem.materialName.toLowerCase().includes('màng') ? 'film' : 'paper',
            qtyInStock: Number(purItem.quantity),
            qtyReserved: 0,
            minQtyAlert: 50,
            unit: purItem.unit,
            defaultSupplierId: pur.supplierId
          });
        }
      }

      // Also automatically create a payable invoice in invoices collection
      const invoiceCode = `INV-${pur.purCode.replace('PUR-','')}`;
      await dbService.addDocument('invoices', {
        invoiceCode,
        poId: pur.id,
        poCode: pur.purCode,
        customerId: pur.supplierId,
        customerName: pur.supplierName,
        type: 'payable',
        amount: pur.totalPrice,
        paidAmount: 0,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });

      // If linked to customer PO, update customer PO status to NCC confirmed / production pending
      if (pur.linkedPoId) {
        const po = pos.find(p => p.id === pur.linkedPoId);
        if (po) {
          const updatedLogs = [
            ...po.historyLogs,
            {
              status: 'supplier_confirmed',
              updatedBy: currentUser.displayName,
              updatedAt: new Date().toISOString(),
              note: `Nguyên vật liệu đã về kho (${pur.items.map((i: any) => i.materialName).join(', ')}). Sẵn sàng chuyển lệnh in.`
            }
          ];
          await dbService.updateDocument('pos', po.id, {
            status: 'supplier_confirmed',
            historyLogs: updatedLogs
          });
        }
      }
    }

    await dbService.updateDocument('purchase_orders', purId, updates);
    setSelectedPur((prev: any) => prev ? { ...prev, ...updates } : null);

    const invInvoices = await dbService.getCollection('invoices');
    setInvoices(invInvoices);
    onRefresh();
  };

  const payableInvoices = invoices.filter(inv => inv.type === 'payable');

  return (
    <div className="purchase-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('MUA HÀNG VÀ ĐẶT HÀNG NCC')}</h1>
          <p className="page-subtitle">{t('Tạo yêu cầu mua decal, mực in, màng từ NCC, đối chiếu BOM và theo dõi tiến độ giao hàng của NCC.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline btn-symbol" onClick={() => setShowAddSupplierModal(true)} title={t('Thêm Nhà Cung Cấp')}>
              <Plus size={18} />
            </button>
            <button className="btn btn-primary btn-symbol" onClick={() => setShowAddPurModal(true)} title={t('TẠO ĐƠN MUA HÀNG VẬT TƯ MỚI')}>
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="details-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="card-title" style={{ margin: 0 }}>{t('Đơn Đặt Mua Vật Tư Nhà Cung Cấp')}</span>
            <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleExportCSV}>
              <FileSpreadsheet size={16} />
              <span>{t('Xuất Excel')}</span>
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Mã Đơn Mua')}</th>
                  <th>{t('Nhà Cung Cấp')}</th>
                  <th>{t('Chi tiết vật tư cần mua')}</th>
                  <th>{t('Giá Trị')}</th>
                  <th>{t('PO Liên Kết')}</th>
                  <th>{t('Trạng Thái')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchaseOrders.map(pur => (
                  <tr key={pur.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPur(pur)}>
                    <td style={{ fontWeight: 600 }}>{pur.purCode}</td>
                    <td>{pur.supplierName}</td>
                    <td style={{ fontWeight: 500 }}>{pur.items?.map((i: any) => `${i.materialName} (${i.quantity} ${i.unit})`).join(', ')}</td>
                    <td>{pur.totalPrice?.toLocaleString()} đ</td>
                    <td>{pur.linkedPoCode || t('Không')}</td>
                    <td>
                      <span className={`badge ${
                        pur.status === 'received' ? 'badge-success' : 'badge-warning'
                      }`}>{pur.status === 'received' ? t('Đã nhận kho') : t(pur.status)}</span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedPur(pur)}>{t('Chi Tiết')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <span className="card-title">{t('Danh Sách Nhà Cung Cấp')}</span>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Tên Nhà Cung Cấp')}</th>
                  <th>{t('Liên Hệ')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.filter(s => !s.deleted).map(sup => (
                  <tr key={sup.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedSupplier(sup)}>
                    <td style={{ fontWeight: 600 }}>{sup.supplierName}</td>
                    <td>
                      <div>{sup.contactPerson || t('Chưa cung cấp')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{sup.phone}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditSupplier(sup)} title={t('Sửa')}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteSupplier(sup.id)} title={t('Xóa')}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SUPPLIER DEBT TRACKING (PAYABLE INVOICES) */}
      <div className="card" style={{ marginTop: '10px' }}>
        <span className="card-title">{t('Theo Dõi Công Nợ Phải Trả Nhà Cung Cấp')}</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã Công Nợ')}</th>
                <th>{t('Đơn Mua Hàng')}</th>
                <th>{t('Nhà Cung Cấp')}</th>
                <th>{t('Phải Trả (đ)')}</th>
                <th>{t('Đã Trả (đ)')}</th>
                <th>{t('Còn Nợ (đ)')}</th>
                <th>{t('Hạn Thanh Toán')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {payableInvoices.map(inv => {
                const remaining = inv.amount - inv.paidAmount;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoiceCode}</td>
                    <td style={{ fontWeight: 500 }}>{inv.poCode}</td>
                    <td>{inv.customerName}</td>
                    <td>{inv.amount?.toLocaleString()} đ</td>
                    <td style={{ color: 'var(--color-success)' }}>{inv.paidAmount?.toLocaleString()} đ</td>
                    <td style={{ color: remaining > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: remaining > 0 ? 600 : 400 }}>
                      {remaining?.toLocaleString()} đ
                    </td>
                    <td>{new Date(inv.dueDate).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`badge ${
                        inv.status === 'paid' ? 'badge-success' :
                        inv.status === 'partially_paid' ? 'badge-info' : 'badge-warning'
                      }`}>
                        {inv.status === 'paid' ? t('Đã thanh toán') :
                         inv.status === 'partially_paid' ? t('Thanh toán một phần') : t('Chưa thanh toán')}
                      </span>
                    </td>
                    <td>
                      {inv.status !== 'paid' && (currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOpenPayment(inv)}>
                          {t('Thanh Toán')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {payableInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {t('Không có công nợ nhà cung cấp nào.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED PURCHASE DIALOG */}
      {selectedPur && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHI TIẾT ĐƠN MUA HÀNG')}: {selectedPur.purCode}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                  <>
                    <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditPur(selectedPur)} title={t('Sửa')}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeletePur(selectedPur.id)} title={t('Xóa')}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedPur(null)}>{t('Đóng')}</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{t('Nhà Cung Cấp')}:</span>
                <span>{selectedPur.supplierName}</span>

                <span style={{ fontWeight: 600 }}>{t('PO Liên Kết')}:</span>
                <span>{selectedPur.linkedPoCode}</span>

                <span style={{ fontWeight: 600 }}>{t('Chi tiết vật tư cần mua')}:</span>
                <div>
                  {selectedPur.items?.map((i: any, idx: number) => (
                    <div key={idx}>{i.materialName}: {i.quantity} {i.unit} ({t('Đơn Giá')}: {i.unitPrice?.toLocaleString()} đ)</div>
                  ))}
                </div>

                <span style={{ fontWeight: 600 }}>{t('Thành Tiền')}:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{selectedPur.totalPrice?.toLocaleString()} đ</span>

                <span style={{ fontWeight: 600 }}>{t('Ngày Giao Dự Kiến')}:</span>
                <span>{new Date(selectedPur.expectedReceiveDate).toLocaleDateString(t('vi-VN'))}</span>

                {selectedPur.actualReceiveDate && (
                  <>
                    <span style={{ fontWeight: 600 }}>{t('Ngày nhận kho thực tế')}:</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      {new Date(selectedPur.actualReceiveDate).toLocaleString(t('vi-VN'))}
                    </span>
                  </>
                )}

                <span style={{ fontWeight: 600 }}>{t('Nhân viên mua hàng')}:</span>
                <span>{selectedPur.assignedPurchaserName || t('Chưa phân công')}</span>
              </div>

              {selectedPur.status !== 'received' && (currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                <div style={{ border: '1px solid var(--color-border)', padding: '12px', borderRadius: '4px', marginTop: '10px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Cập nhật trạng thái đơn hàng sang')}:</h4>
                  <div className="btn-group" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => updatePurStatus(selectedPur.id, 'confirmed')}>{t('NCC xác nhận')}</button>
                    <button className="btn btn-sm btn-outline" onClick={() => updatePurStatus(selectedPur.id, 'shipping')}>{t('Đang giao')}</button>
                    <button className="btn btn-sm btn-success" onClick={() => updatePurStatus(selectedPur.id, 'received')}>
                      {t('Báo Nhận Kho')}
                    </button>
                  </div>
                </div>
              )}

              {/* Audit trail */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <div>{t('Tạo bởi:')} {selectedPur.createdBy || t('Không xác định')} {selectedPur.createdAt && `(${new Date(selectedPur.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                {selectedPur.updatedBy && (
                  <div>{t('Cập nhật bởi:')} {selectedPur.updatedBy} ({new Date(selectedPur.updatedAt).toLocaleString(t('vi-VN'))})</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedPur(null)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showAddPurModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('TẠO ĐƠN MUA HÀNG VẬT TƯ MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddPurModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreatePur}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Chọn Nhà Cung Cấp *')}</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                    <option value="">{t('-- Chọn Nhà Cung Cấp --')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>{t('Chọn Đơn Hàng PO Cần Mua Vật Tư (Đối Chiếu BOM)')}</label>
                  <select value={linkedPoId} onChange={e => setLinkedPoId(e.target.value)}>
                    <option value="">{t('-- Không liên kết PO (Mua tồn kho dự phòng) --')}</option>
                    {pos.filter(p => !['delivered', 'debt_collected'].includes(p.status)).map(po => (
                      <option key={po.id} value={po.id}>{po.poCode} - {po.customerName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Chi tiết vật tư cần mua')}</h4>
                  <div className="form-group">
                    <label>{t('Tên Vật Tư / Quy Cách')} *</label>
                    <input 
                      type="text" 
                      value={materialName} 
                      onChange={e => setMaterialName(e.target.value)} 
                      placeholder={t('Ví dụ: Giấy decal Fasson AW0339F, Mực DIC Cyan...')} 
                      required 
                    />
                  </div>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                    <div className="form-group">
                      <label>{t('Số Lượng')} *</label>
                      <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required />
                    </div>
                    <div className="form-group">
                      <label>{t('Đơn Vị')} *</label>
                      <select value={unit} onChange={e => setUnit(e.target.value)}>
                        <option value="m²">m²</option>
                        <option value="kg">kg</option>
                        <option value="cuộn">{t('cuộn')}</option>
                        <option value="hộp">{t('hộp')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Đơn Giá Nhập (đ) *')}</label>
                    <input type="number" min="1" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('Ngày Nhận Hàng Dự Kiến *')}</label>
                  <input 
                    type="date" 
                    value={expectedReceiveDate} 
                    onChange={e => setExpectedReceiveDate(e.target.value)} 
                    required 
                  />
                </div>

                {currentUser.role === 'admin' && (
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Nhân viên mua hàng phụ trách')}</label>
                    <select value={addAssignedPurchaserId} onChange={e => setAddAssignedPurchaserId(e.target.value)}>
                      <option value="">-- {t('Chưa phân công')} --</option>
                      {purchasers.map(p => (
                        <option key={p.uid} value={p.uid}>{p.displayName} ({p.email})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddPurModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Tạo Đơn Mua Hàng')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM NHÀ CUNG CẤP VẬT TƯ MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddSupplierModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Nhà Cung Cấp')} *</label>
                  <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t('Người Liên Hệ')}</label>
                  <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Điện Thoại')}</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Địa chỉ văn phòng / Nhà xưởng')}</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddSupplierModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Nhà Cung Cấp')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA HỒ SƠ NHÀ CUNG CẤP')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditSupplierModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditSupplierSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Nhà Cung Cấp')} *</label>
                  <input type="text" value={editSupplierName} onChange={e => setEditSupplierName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t('Người Liên Hệ')}</label>
                  <input type="text" value={editContactPerson} onChange={e => setEditContactPerson(e.target.value)} />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Điện Thoại')}</label>
                    <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email')}</label>
                    <input type="email" value={editEmail} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Địa chỉ văn phòng / Nhà xưởng')}</label>
                  <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditSupplierModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PURCHASE ORDER MODAL */}
      {showEditPurModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA ĐƠN MUA HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditPurModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditPurSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Chọn Nhà Cung Cấp *')}</label>
                  <select value={editSupplierId} onChange={e => setEditSupplierId(e.target.value)} required>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>{t('Chọn Đơn Hàng PO Cần Mua Vật Tư (Đối Chiếu BOM)')}</label>
                  <select value={editLinkedPoId} onChange={e => setEditLinkedPoId(e.target.value)}>
                    <option value="">{t('-- Không liên kết PO (Mua tồn kho dự phòng) --')}</option>
                    {pos.filter(p => !['delivered', 'debt_collected'].includes(p.status)).map(po => (
                      <option key={po.id} value={po.id}>{po.poCode} - {po.customerName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>{t('Chi tiết vật tư cần mua')}</h4>
                  <div className="form-group">
                    <label>{t('Tên Vật Tư / Quy Cách')} *</label>
                    <input 
                      type="text" 
                      value={editMaterialName} 
                      onChange={e => setEditMaterialName(e.target.value)} 
                      placeholder={t('Ví dụ: Giấy decal Fasson AW0339F, Mực DIC Cyan...')} 
                      required 
                    />
                  </div>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                    <div className="form-group">
                      <label>{t('Số Lượng')} *</label>
                      <input type="number" min="1" value={editQuantity} onChange={e => setEditQuantity(Number(e.target.value))} required />
                    </div>
                    <div className="form-group">
                      <label>{t('Đơn Vị')} *</label>
                      <select value={editUnit} onChange={e => setEditUnit(e.target.value)}>
                        <option value="m²">m²</option>
                        <option value="kg">kg</option>
                        <option value="cuộn">{t('cuộn')}</option>
                        <option value="hộp">{t('hộp')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Đơn Giá Nhập (đ) *')}</label>
                    <input type="number" min="1" value={editUnitPrice} onChange={e => setEditUnitPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('Ngày Nhận Hàng Dự Kiến *')}</label>
                  <input 
                    type="date" 
                    value={editExpectedReceiveDate} 
                    onChange={e => setEditExpectedReceiveDate(e.target.value)} 
                    required 
                  />
                </div>

                {currentUser.role === 'admin' && (
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Nhân viên mua hàng phụ trách')}</label>
                    <select value={editAssignedPurchaserId} onChange={e => setEditAssignedPurchaserId(e.target.value)}>
                      <option value="">-- {t('Chưa phân công')} --</option>
                      {purchasers.map(p => (
                        <option key={p.uid} value={p.uid}>{p.displayName} ({p.email})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditPurModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER DETAILS MODAL (WITH CONTRACTS LIST) */}
      {selectedSupplier && !showEditSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('HỒ SƠ NHÀ CUNG CẤP')}: {selectedSupplier.supplierName}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedSupplier(null)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', borderRight: '1px solid var(--color-border-light)', paddingRight: '16px' }}>
                <h4 style={{ color: 'var(--color-primary)', marginBottom: '4px' }}>{t('Thông Tin Liên Hệ')}</h4>
                <div><strong>{t('Tên NCC')}:</strong> {selectedSupplier.supplierName}</div>
                <div><strong>{t('Người Liên Hệ')}:</strong> {selectedSupplier.contactPerson || t('Chưa cung cấp')}</div>
                <div><strong>{t('Điện Thoại')}:</strong> {selectedSupplier.phone || t('Chưa cung cấp')}</div>
                <div><strong>{t('Email')}:</strong> {selectedSupplier.email || t('Chưa cung cấp')}</div>
                <div><strong>{t('Địa chỉ')}:</strong> {selectedSupplier.address || t('Chưa cung cấp')}</div>

                <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <div>{t('Tạo bởi:')} {selectedSupplier.createdBy || t('Không xác định')}</div>
                  {selectedSupplier.createdAt && <div>{new Date(selectedSupplier.createdAt).toLocaleString('vi-VN')}</div>}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: 'var(--color-primary)' }}>{t('Danh Sách Hợp Đồng Cung Ứng')}</h4>
                  {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                    <button className="btn btn-sm btn-primary btn-symbol-sm" onClick={() => setShowAddContractModal(true)} title={t('Thêm Hợp Đồng')}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Số HĐ')}</th>
                        <th>{t('Ngày Ký')}</th>
                        <th>{t('Hết Hạn')}</th>
                        <th>{t('Trị Giá')}</th>
                        <th>{t('Bản Scan')}</th>
                        <th>{t('Thao Tác')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSupplier.contracts || []).map((contr: any) => (
                        <tr key={contr.id}>
                          <td style={{ fontWeight: 600 }}>{contr.contractNo}</td>
                          <td>{new Date(contr.signDate).toLocaleDateString('vi-VN')}</td>
                          <td>{new Date(contr.expiryDate).toLocaleDateString('vi-VN')}</td>
                          <td>{contr.value?.toLocaleString()} đ</td>
                          <td>
                            {contr.fileUrl ? (
                              <a href={contr.fileUrl} download={`HopDong_${contr.contractNo}`} className="btn btn-sm btn-outline">
                                {t('Tải file')}
                              </a>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{t('Không có')}</span>
                            )}
                          </td>
                          <td>
                            {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                              <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteContract(contr.id)} title={t('Xóa')}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(selectedSupplier.contracts || []).length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {t('Chưa lưu hợp đồng nào với nhà cung cấp này.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                <button className="btn btn-primary" onClick={() => handleOpenEditSupplier(selectedSupplier)}>{t('Sửa Hồ Sơ')}</button>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedSupplier(null)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CONTRACT MODAL */}
      {showAddContractModal && selectedSupplier && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('THÊM HỢP ĐỒNG NHÀ CUNG CẤP')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddContractModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddContractSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Số Hợp Đồng *')}</label>
                  <input type="text" value={contractNo} onChange={e => setContractNo(e.target.value)} required placeholder="VD: HĐ-NCC-2026-01" />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Ngày Ký HĐ *')}</label>
                    <input type="date" value={contractSignDate} onChange={e => setContractSignDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Hết Hạn HĐ *')}</label>
                    <input type="date" value={contractExpiryDate} onChange={e => setContractExpiryDate(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Giá Trị Hợp Đồng (đ) *')}</label>
                  <input type="number" min="0" value={contractValue} onChange={e => setContractValue(Number(e.target.value))} required />
                </div>
                <div className="form-group">
                  <label>{t('Tải Bản Scan Hợp Đồng (PDF/Ảnh) *')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={handleContractFileChange} style={{ fontSize: '12px' }} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddContractModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Tải Lên Hợp Đồng')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER DEBT PAYMENT MODAL */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('THANH TOÁN CÔNG NỢ NHÀ CUNG CẤP')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowPaymentModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '4px' }}>
                  <div><strong>{t('Mã công nợ:')}</strong> {selectedInvoice.invoiceCode}</div>
                  <div><strong>{t('Nhà cung cấp:')}</strong> {selectedInvoice.customerName}</div>
                  <div><strong>{t('Tổng nợ ban đầu:')}</strong> {selectedInvoice.amount?.toLocaleString()} đ</div>
                  <div><strong>{t('Đã thanh toán:')}</strong> {selectedInvoice.paidAmount?.toLocaleString()} đ</div>
                  <div><strong>{t('Số nợ còn lại:')}</strong> {(selectedInvoice.amount - selectedInvoice.paidAmount)?.toLocaleString()} đ</div>
                </div>

                <div className="form-group">
                  <label>{t('Số Tiền Thanh Toán Đợt Này (đ) *')}</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedInvoice.amount - selectedInvoice.paidAmount}
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('Ghi chú giao dịch (Phương thức, Mã tham chiếu...)')}</label>
                  <textarea
                    value={payNote}
                    onChange={e => setPayNote(e.target.value)}
                    placeholder={t('Ví dụ: Chuyển khoản Techcombank, Ủy nhiệm chi số UCF-828')}
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Xác Nhận Thanh Toán')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
