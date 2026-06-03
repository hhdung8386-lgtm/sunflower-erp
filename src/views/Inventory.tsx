import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';

interface InventoryProps {
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [inventoryList, setInventoryList] = useState<any[]>([]);
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
  const [suppliers, setSuppliers] = useState<any[]>([]);

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

  const fetchInventory = async () => {
    const data = await dbService.getCollection('inventory');
    setInventoryList(data);
  };

  useEffect(() => {
    fetchInventory();
    const fetchSuppliers = async () => {
      const supList = await dbService.getCollection('suppliers');
      setSuppliers(supList);
    };
    fetchSuppliers();
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
    fetchInventory();
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
    
    fetchInventory();
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
    fetchInventory();
    onRefresh();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa vật tư này khỏi danh mục kho?'))) {
      await dbService.deleteDocument('inventory', itemId);
      fetchInventory();
      onRefresh();
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'paper': return t('Giấy decal cuộn');
      case 'ink': return t('Mực in Flexo');
      case 'film': return t('Màng bóng/mờ');
      default: return t('Vật tư phụ / Khác');
    }
  };

  // Filter and search
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
          <p className="page-subtitle">{t('Quản lý số lượng tồn kho khả dụng của decal cuộn, mực in, màng cán và tự động cảnh báo tồn kho thấp.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>{t('Thêm Vật Tư Mới')}</button>
        )}
      </div>

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
                    <td style={{ fontWeight: 600 }}>{item.qtyInStock}</td>
                    <td>{item.qtyReserved || 0}</td>
                    <td style={{ fontWeight: 700, color: netAvailable < 0 ? 'var(--color-danger)' : 'var(--color-text-main)' }}>
                      {netAvailable}
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
                            <button className="btn btn-sm btn-outline" onClick={() => handleOpenEdit(item)}>
                              {t('Sửa')}
                            </button>
                            <button className="btn btn-sm btn-outline btn-danger" onClick={() => handleDeleteItem(item.id)}>
                              {t('Xóa')}
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
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Thêm Vật Tư Mới')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Vật Tư')} *</label>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder={t('Ví dụ: Decal nhựa Fasson...')} required />
                </div>
                <div className="form-grid">
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
                <div className="form-grid">
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
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Chỉnh Sửa Vật Tư')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Vật Tư')} *</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="form-grid">
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
                <span>{selectedItem.qtyInStock} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Giữ Chỗ Cho LSX')}:</span>
                <span>{selectedItem.qtyReserved || 0} {selectedItem.unit}</span>
                <span style={{ fontWeight: 600 }}>{t('Tồn Khả Dụng')}:</span>
                <span>{selectedItem.qtyInStock - (selectedItem.qtyReserved || 0)} {selectedItem.unit}</span>
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
                <button className="btn btn-primary" onClick={() => { setShowDetailsModal(false); handleOpenEdit(selectedItem); }}>{t('Sửa')}</button>
              )}
              <button className="btn btn-outline" onClick={() => setShowDetailsModal(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
