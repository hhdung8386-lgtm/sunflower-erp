import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

interface InventoryProps {
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ currentUser, onRefresh }) => {
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
      case 'paper': return 'Decal / Giấy';
      case 'ink': return 'Mực In';
      case 'film': return 'Màng Cán';
      default: return 'Lõi & Vật Tư Khác';
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
          <h1 className="page-title">QUẢN LÝ KHO VẬT TƯ</h1>
          <p className="page-subtitle">Xem tình hình tồn kho thực tế, tồn kho giữ chỗ cho lệnh in và thiết lập cảnh báo khi vật tư xuống dưới định mức tối thiểu.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Tìm kiếm vật tư..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <button className="btn btn-outline" onClick={() => setSearchTerm('')}>Xóa Lọc</button>
          </div>

          <div className="tab-container" style={{ borderBottom: 'none' }}>
            <button className={`tab-btn ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>Tất Cả</button>
            <button className={`tab-btn ${categoryFilter === 'paper' ? 'active' : ''}`} onClick={() => setCategoryFilter('paper')}>Giấy/Decal</button>
            <button className={`tab-btn ${categoryFilter === 'ink' ? 'active' : ''}`} onClick={() => setCategoryFilter('ink')}>Mực In</button>
            <button className={`tab-btn ${categoryFilter === 'film' ? 'active' : ''}`} onClick={() => setCategoryFilter('film')}>Màng Cán</button>
            <button className={`tab-btn ${categoryFilter === 'others' ? 'active' : ''}`} onClick={() => setCategoryFilter('others')}>Lõi & Khác</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tên Vật Tư</th>
                <th>Phân Nhóm</th>
                <th>Tồn Kho Thực Tế</th>
                <th>Giữ Chỗ Cho LSX</th>
                <th>Tồn Khả Dụng</th>
                <th>Ngưỡng Tối Thiểu</th>
                <th>Đơn Vị</th>
                <th>Cảnh Báo</th>
                <th>Thao Tác</th>
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
                        <span className="badge badge-danger">Yêu Cầu Mua Gấp</span>
                      ) : (
                        <span className="badge badge-success">An Toàn</span>
                      )}
                    </td>
                    <td>
                      {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                        <button className="btn btn-sm btn-outline" onClick={() => handleOpenAdjust(item)}>
                          Điều Chỉnh Kho
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>Không có vật tư nào được tìm thấy.</td>
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
              <span style={{ fontWeight: 700, fontSize: '16px' }}>ĐIỀU CHỈNH KHO: {selectedItem.materialName}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAdjustModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleAdjustStock}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontWeight: 600 }}>Hiện có:</span>
                  <span>{selectedItem.qtyInStock} {selectedItem.unit}</span>
                </div>
                
                <div className="form-group">
                  <label>Loại Điều Chỉnh *</label>
                  <select value={adjustType} onChange={e => setAdjustType(e.target.value as 'add' | 'deduct')}>
                    <option value="add">Nhập kho bổ sung (+)</option>
                    <option value="deduct">Xuất kho / Điều chỉnh giảm (-)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>Số Lượng Điều Chỉnh ({selectedItem.unit}) *</label>
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
                <button type="button" className="btn btn-outline" onClick={() => setShowAdjustModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Xác Nhận Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
