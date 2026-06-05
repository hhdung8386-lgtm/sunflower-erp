import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Pencil } from 'lucide-react';

interface InventoryProps {
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [exportSlips, setExportSlips] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'inventory' | 'exports' | 'nxt'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'paper' | 'ink' | 'film' | 'others'>('all');
  
  // Quick adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');

  // CRUD modals and lists
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Add form states
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<'paper' | 'ink' | 'film' | 'others'>('paper');
  const [addQty, setAddQty] = useState(0);
  const [addMinAlert, setAddMinAlert] = useState(50);
  const [addUnit, setAddUnit] = useState('m²');
  const [addSupplierId, setAddSupplierId] = useState('');

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<'paper' | 'ink' | 'film' | 'others'>('paper');
  const [editMinAlert, setEditMinAlert] = useState(50);
  const [editUnit, setEditUnit] = useState('m²');
  const [editSupplierId, setEditSupplierId] = useState('');

  // Export slips states
  const [showAddExportModal, setShowAddExportModal] = useState(false);
  const [exportReason, setExportReason] = useState('Xuất sản xuất');
  const [exportPoCode, setExportPoCode] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [exportQty, setExportQty] = useState(1);

  const fetchInventory = async () => {
    const data = await dbService.getCollection('inventory');
    setInventoryList(data);
  };

  const fetchExportSlips = async () => {
    const data = await dbService.getCollection('warehouse_exports');
    setExportSlips(data);
  };

  const fetchPurchaseOrders = async () => {
    const data = await dbService.getCollection('purchase_orders');
    setPurchaseOrders(data);
  };

  const fetchSuppliers = async () => {
    const data = await dbService.getCollection('suppliers');
    setSuppliers(data);
  };

  const refreshAllData = async () => {
    await fetchInventory();
    await fetchExportSlips();
    await fetchPurchaseOrders();
    await fetchSuppliers();
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleOpenAdjust = (item: any) => {
    setSelectedItem(item);
    setAdjustQty(0);
    setAdjustType('add');
    setShowAdjustModal(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || adjustQty <= 0) return;

    let newQty = Number(selectedItem.qtyInStock);
    if (adjustType === 'add') {
      newQty += Number(adjustQty);
    } else {
      newQty = Math.max(0, newQty - Number(adjustQty));
    }

    await dbService.updateDocument('inventory', selectedItem.id, {
      qtyInStock: newQty,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowAdjustModal(false);
    refreshAllData();
    onRefresh();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName) return;

    await dbService.addDocument('inventory', {
      materialName: addName,
      category: addCategory,
      qtyInStock: Number(addQty),
      qtyReserved: 0,
      minQtyAlert: Number(addMinAlert),
      unit: addUnit,
      defaultSupplierId: addSupplierId || '',
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    });

    setShowAddModal(false);
    setAddName('');
    setAddCategory('paper');
    setAddQty(0);
    setAddMinAlert(50);
    setAddUnit('m²');
    setAddSupplierId('');
    
    refreshAllData();
    onRefresh();
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setEditName(item.materialName);
    setEditCategory(item.category);
    setEditMinAlert(item.minQtyAlert);
    setEditUnit(item.unit);
    setEditSupplierId(item.defaultSupplierId || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editName) return;

    await dbService.updateDocument('inventory', selectedItem.id, {
      materialName: editName,
      category: editCategory,
      minQtyAlert: Number(editMinAlert),
      unit: editUnit,
      defaultSupplierId: editSupplierId || '',
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditModal(false);
    setSelectedItem(null);
    refreshAllData();
    onRefresh();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa vật tư này khỏi danh mục kho?'))) {
      await dbService.deleteDocument('inventory', itemId);
      refreshAllData();
      onRefresh();
    }
  };

  const handleOpenAddExport = () => {
    if (inventoryList.length === 0) {
      alert('Không có nguyên vật liệu nào trong kho để xuất!');
      return;
    }
    setSelectedMaterialId(inventoryList[0].id);
    setExportQty(1);
    setExportReason('Xuất sản xuất');
    setExportPoCode('');
    setShowAddExportModal(true);
  };

  const handleAddExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || exportQty <= 0) return;

    const material = inventoryList.find(i => i.id === selectedMaterialId);
    if (!material) return;

    if (material.qtyInStock < exportQty) {
      alert(`Số lượng tồn kho không đủ để xuất! (Hiện có: ${material.qtyInStock} ${material.unit})`);
      return;
    }

    const pxkCode = `PXK-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newExport = {
      pxkCode,
      exportDate: new Date().toISOString(),
      reason: exportReason,
      linkedCode: exportPoCode || 'Không có',
      exportedBy: currentUser.displayName,
      items: [
        {
          materialId: selectedMaterialId,
          materialName: material.materialName,
          quantity: Number(exportQty),
          unit: material.unit
        }
      ],
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    // Deduct stock quantity
    const newQty = Number(material.qtyInStock) - Number(exportQty);
    await dbService.updateDocument('inventory', material.id, {
      qtyInStock: newQty,
      updatedAt: new Date().toISOString()
    });

    // Save export slip
    await dbService.addDocument('warehouse_exports', newExport);

    setShowAddExportModal(false);
    setExportPoCode('');
    setExportQty(1);
    
    refreshAllData();
    onRefresh();
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'paper': return t('Giấy decal cuộn');
      case 'ink': return t('Mực in Flexo');
      case 'film': return t('Màng bóng/mờ');
      default: return t('Vật tư phụ / Khác');
    }
  };

  const filteredInventory = inventoryList.filter(item => {
    const matchesSearch = item.materialName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('KHO NGUYÊN VẬT LIỆU & TỒN KHO')}</h1>
          <p className="page-subtitle">{t('Quản lý số lượng tồn kho khả dụng, lịch sử phiếu xuất kho vật tư và báo cáo Nhập Xuất Tồn.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline" onClick={handleOpenAddExport}>{t('Tạo Phiếu Xuất Kho')}</button>
            <button className="btn btn-primary btn-symbol" onClick={() => setShowAddModal(true)} title={t('Thêm Vật Tư Mới')}>
              <Plus size={18} />
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid var(--color-border-light)', paddingBottom: '10px' }}>
        <button className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('inventory')}>{t('Tồn Kho Hiện Tại')}</button>
        <button className={`btn ${activeTab === 'exports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('exports')}>{t('Lịch Sử Phiếu Xuất Kho')}</button>
        <button className={`btn ${activeTab === 'nxt' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('nxt')}>{t('Báo Cáo Nhập Xuất Tồn')}</button>
      </div>

      {activeTab === 'inventory' && (
        <div className="card">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder={t('Nhập tên vật tư cần tìm...')} 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <button className="btn btn-outline" onClick={() => setSearchTerm('')}>{t('Đặt Lại')}</button>
            </div>

            <div className="tab-container" style={{ borderBottom: 'none' }}>
              <button className={`tab-btn ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>{t('Tất cả')}</button>
              <button className={`tab-btn ${categoryFilter === 'paper' ? 'active' : ''}`} onClick={() => setCategoryFilter('paper')}>{t('Giấy decal cuộn')}</button>
              <button className={`tab-btn ${categoryFilter === 'ink' ? 'active' : ''}`} onClick={() => setCategoryFilter('ink')}>{t('Mực in Flexo')}</button>
              <button className={`tab-btn ${categoryFilter === 'film' ? 'active' : ''}`} onClick={() => setCategoryFilter('film')}>{t('Màng bóng/mờ')}</button>
              <button className={`tab-btn ${categoryFilter === 'others' ? 'active' : ''}`} onClick={() => setCategoryFilter('others')}>{t('Vật tư phụ / Khác')}</button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Tên Vật Tư')}</th>
                  <th>{t('Phân Nhóm')}</th>
                  <th>{t('Tồn Kho Thực Tế')}</th>
                  <th>{t('Giữ Chỗ Cho LSX')}</th>
                  <th>{t('Tồn Khả Dụng')}</th>
                  <th>{t('Ngưỡng Tối Thiểu')}</th>
                  <th>{t('Đơn Vị')}</th>
                  <th>{t('Trạng Thái')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const isLowStock = item.qtyInStock < item.minQtyAlert;
                  const netAvailable = item.qtyInStock - (item.qtyReserved || 0);

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.materialName}</td>
                      <td>{getCategoryLabel(item.category)}</td>
                      <td style={{ fontWeight: 600 }}>{item.qtyInStock?.toLocaleString()}</td>
                      <td>{item.qtyReserved || 0}</td>
                      <td style={{ fontWeight: 700, color: netAvailable < 0 ? 'var(--color-danger)' : 'var(--color-text-main)' }}>
                        {netAvailable?.toLocaleString()}
                      </td>
                      <td>{item.minQtyAlert}</td>
                      <td>{item.unit}</td>
                      <td>
                        {isLowStock ? (
                          <span className="badge badge-danger">{t('Cảnh Báo Tồn Kho Thấp')}</span>
                        ) : (
                          <span className="badge badge-success">{t('An Toàn')}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => { setSelectedItem(item); setShowDetailsModal(true); }}>
                            {t('Chi Tiết')}
                          </button>
                          {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                            <>
                              <button className="btn btn-sm btn-outline" onClick={() => handleOpenAdjust(item)}>
                                {t('Cập Nhật Tồn Kho')}
                              </button>
                              <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEdit(item)} title={t('Sửa')}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteItem(item.id)} title={t('Xóa')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>{t('Không tìm thấy nguyên vật liệu nào.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exports' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="card-title">{t('Nhật Ký Xuất Kho Nguyên Vật Tư')}</span>
            {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
              <button className="btn btn-primary" onClick={handleOpenAddExport}>{t('Tạo Phiếu Xuất Kho Mới')}</button>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Số Phiếu')}</th>
                  <th>{t('Ngày Xuất')}</th>
                  <th>{t('Lý Do Xuất')}</th>
                  <th>{t('Đơn LSX/PO')}</th>
                  <th>{t('Vật Tư Xuất')}</th>
                  <th>{t('Số Lượng Xuất')}</th>
                  <th>{t('Người Xuất')}</th>
                </tr>
              </thead>
              <tbody>
                {exportSlips.map(slip => {
                  const slipItem = slip.items?.[0] || {};
                  return (
                    <tr key={slip.id}>
                      <td style={{ fontWeight: 600 }}>{slip.pxkCode}</td>
                      <td>{new Date(slip.exportDate).toLocaleString('vi-VN')}</td>
                      <td style={{ fontWeight: 500 }}>{t(slip.reason)}</td>
                      <td>{slip.linkedCode}</td>
                      <td>{slipItem.materialName}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>-{slipItem.quantity?.toLocaleString()} {slipItem.unit}</td>
                      <td>{slip.exportedBy}</td>
                    </tr>
                  );
                })}
                {exportSlips.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {t('Chưa ghi nhận phiếu xuất kho vật tư nào.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'nxt' && (
        <div className="card">
          <span className="card-title">{t('Báo Cáo Nhập - Xuất - Tồn Kho Vật Tư')}</span>
          <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            {t('* Tồn đầu kỳ được tính tự động từ tồn cuối kỳ (tồn thực tế) cộng tổng lượng xuất trừ tổng lượng nhập.')}
          </p>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Tên Vật Tư')}</th>
                  <th>{t('Nhóm Vật Tư')}</th>
                  <th>{t('Đơn Vị')}</th>
                  <th>{t('Tồn Đầu Kỳ')}</th>
                  <th>{t('Nhập Trong Kỳ')}</th>
                  <th>{t('Xuất Trong Kỳ')}</th>
                  <th>{t('Tồn Cuối Kỳ')}</th>
                </tr>
              </thead>
              <tbody>
                {inventoryList.map(item => {
                  // Calculate dynamic Nhập
                  const totalImported = purchaseOrders
                    .filter(po => po.status === 'received')
                    .reduce((sum, po) => {
                      const found = po.items?.find((i: any) => i.materialName.toLowerCase() === item.materialName.toLowerCase());
                      return sum + (found ? Number(found.quantity) : 0);
                    }, 0);

                  // Calculate dynamic Xuất
                  const totalExported = exportSlips.reduce((sum, slip) => {
                    const found = slip.items?.find((i: any) => i.materialId === item.id || i.materialName.toLowerCase() === item.materialName.toLowerCase());
                    return sum + (found ? Number(found.quantity) : 0);
                  }, 0);

                  const endStock = item.qtyInStock;
                  const beginStock = Math.max(0, endStock + totalExported - totalImported);

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.materialName}</td>
                      <td>{getCategoryLabel(item.category)}</td>
                      <td>{item.unit}</td>
                      <td style={{ fontWeight: 500 }}>{beginStock?.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-success)', fontWeight: 500 }}>+{totalImported?.toLocaleString()}</td>
                      <td style={{ color: 'var(--color-danger)', fontWeight: 500 }}>-{totalExported?.toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>{endStock?.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {inventoryList.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>{t('Chưa có danh mục vật tư nào để tạo báo cáo.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CẬP NHẬT TỒN KHO VẬT TƯ')}: {selectedItem.materialName}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAdjustModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAdjustStock}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontWeight: 600 }}>{t('Hiện có:')}</span>
                  <span>{selectedItem.qtyInStock} {selectedItem.unit}</span>
                </div>
                
                <div className="form-group">
                  <label>{t('Loại Điều Chỉnh *')}</label>
                  <select value={adjustType} onChange={e => setAdjustType(e.target.value as 'add' | 'deduct')}>
                    <option value="add">{t('Nhập kho bổ sung (+)')}</option>
                    <option value="deduct">{t('Xuất kho / Điều chỉnh giảm (-)')}</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Số Lượng Điều Chỉnh')} ({selectedItem.unit}) *</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={adjustQty} 
                    onChange={e => setAdjustQty(Number(e.target.value))} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdjustModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật Kho')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Thêm Vật Tư Mới')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Tên Vật Tư')} *</label>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder={t('Ví dụ: Decal nhựa Fasson AW0339F...')} required />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Phân Nhóm')} *</label>
                    <select value={addCategory} onChange={e => setAddCategory(e.target.value as any)}>
                      <option value="paper">{t('Giấy decal cuộn')}</option>
                      <option value="ink">{t('Mực in Flexo')}</option>
                      <option value="film">{t('Màng bóng/mờ')}</option>
                      <option value="others">{t('Vật tư phụ / Khác')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Vị')} *</label>
                    <input type="text" value={addUnit} onChange={e => setAddUnit(e.target.value)} placeholder="m², kg, cuộn, hộp" required />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng Nhập Ban Đầu')}</label>
                    <input type="number" min="0" value={addQty} onChange={e => setAddQty(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>{t('Ngưỡng Cảnh Báo Tối Thiểu')}</label>
                    <input type="number" min="0" value={addMinAlert} onChange={e => setAddMinAlert(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Nhà Cung Cấp Mặc Định')}</label>
                  <select value={addSupplierId} onChange={e => setAddSupplierId(e.target.value)}>
                    <option value="">{t('-- Chọn nhà cung cấp --')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MATERIAL MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Chỉnh Sửa Vật Tư')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Tên Vật Tư')} *</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Phân Nhóm')} *</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value as any)}>
                      <option value="paper">{t('Giấy decal cuộn')}</option>
                      <option value="ink">{t('Mực in Flexo')}</option>
                      <option value="film">{t('Màng bóng/mờ')}</option>
                      <option value="others">{t('Vật tư phụ / Khác')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Vị')} *</label>
                    <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Ngưỡng Cảnh Báo Tối Thiểu')}</label>
                  <input type="number" min="0" value={editMinAlert} onChange={e => setEditMinAlert(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>{t('Nhà Cung Cấp Mặc Định')}</label>
                  <select value={editSupplierId} onChange={e => setEditSupplierId(e.target.value)}>
                    <option value="">{t('-- Chọn nhà cung cấp --')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ITEM DETAILS MODAL */}
      {showDetailsModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHI TIẾT VẬT TƯ')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowDetailsModal(false)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{t('Tên Vật Tư')}:</span>
                <span>{selectedItem.materialName}</span>
                <span style={{ fontWeight: 600 }}>{t('Phân Nhóm')}:</span>
                <span>{getCategoryLabel(selectedItem.category)}</span>
                <span style={{ fontWeight: 600 }}>{t('Tồn Kho Thực Tế')}:</span>
                <span>{selectedItem.qtyInStock?.toLocaleString()} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Giữ Chỗ Cho LSX')}:</span>
                <span>{selectedItem.qtyReserved || 0} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Tồn Khả Dụng')}:</span>
                <span>{(selectedItem.qtyInStock - (selectedItem.qtyReserved || 0))?.toLocaleString()} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Ngưỡng Tối Thiểu')}:</span>
                <span>{selectedItem.minQtyAlert} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Nhà Cung Cấp Mặc Định')}:</span>
                <span>{suppliers.find(s => s.id === selectedItem.defaultSupplierId)?.supplierName || t('Chưa gán')}</span>
              </div>
              
              {/* Audit trail */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <div>{t('Tạo bởi:')} {selectedItem.createdBy || t('Không xác định')} {selectedItem.createdAt && `(${new Date(selectedItem.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                {selectedItem.updatedBy && (
                  <div>{t('Cập nhật bởi:')} {selectedItem.updatedBy} ({new Date(selectedItem.updatedAt).toLocaleString(t('vi-VN'))})</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                <button className="btn btn-primary btn-symbol" onClick={() => { setShowDetailsModal(false); handleOpenEdit(selectedItem); }} title={t('Sửa')}>
                  <Pencil size={16} />
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowDetailsModal(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WAREHOUSE EXPORT SLIP */}
      {showAddExportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('TẠO PHIẾU XUẤT KHO VẬT TƯ')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddExportModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddExportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Chọn Nguyên Vật Tư Xuất *')}</label>
                  <select value={selectedMaterialId} onChange={e => setSelectedMaterialId(e.target.value)} required>
                    {inventoryList.map(item => (
                      <option key={item.id} value={item.id}>{item.materialName} ({t('Tồn thực tế')}: {item.qtyInStock} {item.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('Số Lượng Xuất Kho *')}</label>
                  <input
                    type="number"
                    min="1"
                    value={exportQty}
                    onChange={e => setExportQty(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t('Lý Do Xuất Kho *')}</label>
                  <select value={exportReason} onChange={e => setExportReason(e.target.value)}>
                    <option value="Xuất sản xuất">{t('Xuất sản xuất (Cho thợ in/bế)')}</option>
                    <option value="Xuất hủy phế phẩm">{t('Xuất hủy phế phẩm / lỗi hỏng')}</option>
                    <option value="Xuất trả nhà cung cấp">{t('Xuất trả nhà cung cấp')}</option>
                    <option value="Xuất khác">{t('Xuất điều chỉnh / Khác')}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('Mã Lệnh LSX / Đơn PO Liên Kết')}</label>
                  <input
                    type="text"
                    placeholder="VD: LSX-06041 or PO-06042"
                    value={exportPoCode}
                    onChange={e => setExportPoCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddExportModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Xác Nhận Xuất Kho')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
