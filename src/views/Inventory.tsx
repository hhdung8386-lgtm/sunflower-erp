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

  const fetchInventory = async () => {
    const data = await dbService.getCollection('inventory');
    setInventoryList(data);
  };

  useEffect(() => {
    fetchInventory();
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
      updatedAt: new Date().toISOString()
    });

    setShowAdjustModal(false);
    fetchInventory();
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
                      {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                        <button className="btn btn-sm btn-outline" onClick={() => handleOpenAdjust(item)}>
                          {t('Cập Nhật Tồn Kho')}
                        </button>
                      )}
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
    </div>
  );
};
