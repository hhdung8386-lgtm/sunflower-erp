import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

interface PurchaseProps {
  pos: any[];
  purchaseOrders: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Purchase: React.FC<PurchaseProps> = ({ pos, purchaseOrders, currentUser, onRefresh }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // Modal states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddPurModal, setShowAddPurModal] = useState(false);
  const [selectedPur, setSelectedPur] = useState<any | null>(null);

  // Form states - Supplier
  const [supplierName, setSupplierName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Form states - Purchase Order (PUR)
  const [supplierId, setSupplierId] = useState('');
  const [linkedPoId, setLinkedPoId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('m²');
  const [unitPrice, setUnitPrice] = useState(10000);
  const [expectedReceiveDate, setExpectedReceiveDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const supList = await dbService.getCollection('suppliers');
      const invList = await dbService.getCollection('inventory');
      setSuppliers(supList);
      setInventory(invList);
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
      address
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
      actualReceiveDate: ''
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
        // Try matching material name
        const matchItem = invList.find((item: any) => item.materialName.toLowerCase() === purItem.materialName.toLowerCase());
        if (matchItem) {
          const newQty = Number(matchItem.qtyInStock) + Number(purItem.quantity);
          await dbService.updateDocument('inventory', matchItem.id, {
            qtyInStock: newQty,
            updatedAt: new Date().toISOString()
          });
        } else {
          // If material not in warehouse inventory, automatically create a new inventory card
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
    onRefresh();
  };

  return (
    <div className="purchase-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">MUA HÀNG VÀ NHÀ CUNG CẤP</h1>
          <p className="page-subtitle">Quản lý nhà cung ứng vật tư, bóc tách nhu cầu sản xuất, tạo PO mua hàng và theo dõi tình trạng nhập kho nguyên liệu.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
          <div className="btn-group">
            <button className="btn btn-outline" onClick={() => setShowAddSupplierModal(true)}>Thêm Nhà Cung Cấp</button>
            <button className="btn btn-primary" onClick={() => setShowAddPurModal(true)}>Tạo Đơn Mua Vật Tư</button>
          </div>
        )}
      </div>

      <div className="details-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="card">
          <span className="card-title">Đơn Đặt Mua Vật Tư Nhà Cung Cấp</span>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã Đơn Mua</th>
                  <th>Nhà Cung Cấp</th>
                  <th>Vật Tư Đặt</th>
                  <th>Giá Trị</th>
                  <th>Liên Kết PO</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(pur => (
                  <tr key={pur.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPur(pur)}>
                    <td style={{ fontWeight: 600 }}>{pur.purCode}</td>
                    <td>{pur.supplierName}</td>
                    <td style={{ fontWeight: 500 }}>{pur.items.map((i: any) => `${i.materialName} (${i.quantity} ${i.unit})`).join(', ')}</td>
                    <td>{pur.totalPrice.toLocaleString()} đ</td>
                    <td>{pur.linkedPoCode || 'Không'}</td>
                    <td>
                      <span className={`badge ${
                        pur.status === 'received' ? 'badge-success' : 'badge-warning'
                      }`}>{pur.status === 'received' ? 'Đã nhập kho' : pur.status.toUpperCase()}</span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedPur(pur)}>Cập nhật</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAILED PURCHASE DIALOG */}
      {selectedPur && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>CẬP NHẬT ĐƠN MUA HÀNG: {selectedPur.purCode}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedPur(null)}>Đóng</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>Nhà cung cấp:</span>
                <span>{selectedPur.supplierName}</span>

                <span style={{ fontWeight: 600 }}>Đơn hàng liên quan:</span>
                <span>{selectedPur.linkedPoCode}</span>

                <span style={{ fontWeight: 600 }}>Danh sách vật tư:</span>
                <div>
                  {selectedPur.items.map((i: any, idx: number) => (
                    <div key={idx}>{i.materialName}: {i.quantity} {i.unit} (Đơn giá: {i.unitPrice.toLocaleString()} đ)</div>
                  ))}
                </div>

                <span style={{ fontWeight: 600 }}>Tổng giá trị:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{selectedPur.totalPrice.toLocaleString()} đ</span>

                <span style={{ fontWeight: 600 }}>Dự kiến nhận:</span>
                <span>{new Date(selectedPur.expectedReceiveDate).toLocaleDateString('vi-VN')}</span>

                {selectedPur.actualReceiveDate && (
                  <>
                    <span style={{ fontWeight: 600 }}>Ngày nhập kho thực tế:</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      {new Date(selectedPur.actualReceiveDate).toLocaleString('vi-VN')}
                    </span>
                  </>
                )}
              </div>

              {selectedPur.status !== 'received' && (currentUser.role === 'admin' || currentUser.role === 'purchaser') && (
                <div style={{ border: '1px solid var(--color-border)', padding: '12px', borderRadius: '4px', marginTop: '10px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>Điều chỉnh trạng thái giao hàng:</h4>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline" onClick={() => updatePurStatus(selectedPur.id, 'confirmed')}>NCC Xác Nhận</button>
                    <button className="btn btn-sm btn-outline" onClick={() => updatePurStatus(selectedPur.id, 'shipping')}>Đang Vận Chuyển</button>
                    <button className="btn btn-sm btn-success" onClick={() => updatePurStatus(selectedPur.id, 'received')}>
                      Đã Nhận (Cộng Kho)
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedPur(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>THÊM NHÀ CUNG CẤP VẬT TƯ MỚI</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddSupplierModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tên Nhà Cung Cấp *</label>
                  <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Người Liên Hệ</label>
                  <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Điện Thoại</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Địa Chỉ Văn Phòng / Kho</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddSupplierModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu NCC</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showAddPurModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>TẠO PO ĐƠN ĐẶT MUA VẬT TƯ</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddPurModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleCreatePur}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Chọn Nhà Cung Cấp *</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Liên Kết Với Đơn Khách Hàng (PO) nào?</label>
                  <select value={linkedPoId} onChange={e => setLinkedPoId(e.target.value)}>
                    <option value="">Không liên kết đơn cụ thể</option>
                    {pos.filter(p => !['delivered', 'debt_collected'].includes(p.status)).map(po => (
                      <option key={po.id} value={po.id}>{po.poCode} - {po.customerName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>Nội dung nguyên vật liệu cần đặt</h4>
                  <div className="form-group">
                    <label>Tên Nguyên Vật Tư *</label>
                    <input 
                      type="text" 
                      value={materialName} 
                      onChange={e => setMaterialName(e.target.value)} 
                      placeholder="Ví dụ: Giấy decal Fasson AW0339F, Mực DIC Cyan..." 
                      required 
                    />
                  </div>
                  <div className="form-grid" style={{ marginTop: '8px' }}>
                    <div className="form-group">
                      <label>Số Lượng Đặt *</label>
                      <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required />
                    </div>
                    <div className="form-group">
                      <label>Đơn Vị *</label>
                      <select value={unit} onChange={e => setUnit(e.target.value)}>
                        <option value="m²">m² (Decal, màng)</option>
                        <option value="kg">kg (Mực, keo)</option>
                        <option value="cuộn">cuộn (Lõi)</option>
                        <option value="hộp">hộp</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>Đơn Giá Nhập (đ) *</label>
                    <input type="number" min="1" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Ngày Dự Kiến Nhận Hàng *</label>
                  <input 
                    type="date" 
                    value={expectedReceiveDate} 
                    onChange={e => setExpectedReceiveDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddPurModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Gửi Đơn Đặt Mua</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
