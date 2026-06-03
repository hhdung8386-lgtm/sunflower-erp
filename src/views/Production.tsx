import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

interface ProductionProps {
  pos: any[];
  productionCommands: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Production: React.FC<ProductionProps> = ({ pos, productionCommands, currentUser, onRefresh }) => {
  const [showAddLsxModal, setShowAddLsxModal] = useState(false);
  const [selectedLsx, setSelectedLsx] = useState<any | null>(null);

  // Form states
  const [linkedPoId, setLinkedPoId] = useState('');
  const [machineId, setMachineId] = useState('Máy Flexo 8 màu');
  const [shift, setShift] = useState('Ca Sáng (08:00 - 18:00)');
  const [operatorName, setOperatorName] = useState('Thành Vũ (Sản xuất)');
  const [qtyToProduce, setQtyToProduce] = useState(10000);
  const [notes, setNotes] = useState('');

  // Complete LSX states
  const [scrapQty, setScrapQty] = useState(0);
  const [completionNotes, setCompletionNotes] = useState('');

  useEffect(() => {
    // Auto select first PO if available
    const activePOs = pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed');
    if (activePOs.length > 0) {
      setLinkedPoId(activePOs[0].id);
      const item = activePOs[0].items[0] || {};
      setQtyToProduce(item.quantity || 10000);
    }
  }, [pos]);

  const handleOpenAddLsx = () => {
    const activePOs = pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed');
    if (activePOs.length === 0) {
      alert('Không có đơn hàng nào ở trạng thái "Chờ sản xuất" hoặc "NCC xác nhận vật tư đủ" để lập lệnh!');
      return;
    }
    setShowAddLsxModal(true);
  };

  const handleCreateLsx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedPoId) return;

    const po = pos.find(p => p.id === linkedPoId);
    if (!po) return;

    const lsxCode = `LSX-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newLsx = {
      lsxCode,
      poId: linkedPoId,
      poCode: po.poCode,
      productName: po.items[0]?.productName || 'Tem nhãn',
      qtyToProduce: Number(qtyToProduce),
      machineId,
      shift,
      operatorId: currentUser.uid,
      operatorName: currentUser.displayName,
      status: 'producing',
      scrapQty: 0,
      notes,
      startedAt: new Date().toISOString(),
      completedAt: ''
    };

    await dbService.addDocument('production_commands', newLsx);

    // Update customer PO status to "producing"
    const updatedLogs = [
      ...po.historyLogs,
      {
        status: 'producing',
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Phát hành Lệnh sản xuất ${lsxCode} giao phó thợ máy ${currentUser.displayName} đứng máy in ${machineId}.`
      }
    ];

    await dbService.updateDocument('pos', po.id, {
      status: 'producing',
      historyLogs: updatedLogs
    });

    setShowAddLsxModal(false);
    setNotes('');
    onRefresh();
  };

  const handleCompleteLsx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLsx) return;

    const now = new Date().toISOString();
    
    // Update LSX
    await dbService.updateDocument('production_commands', selectedLsx.id, {
      status: 'completed',
      scrapQty: Number(scrapQty),
      notes: `${selectedLsx.notes || ''} | Ghi chú hoàn thành: ${completionNotes}`,
      completedAt: now
    });

    // Update PO status to "production_done"
    const po = pos.find(p => p.id === selectedLsx.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'production_done',
          updatedBy: currentUser.displayName,
          updatedAt: now,
          note: `Lệnh sản xuất ${selectedLsx.lsxCode} hoàn thành. Số lượng in phế phẩm hao hụt: ${scrapQty}. Chuyển QC.`
        },
        {
          status: 'qc_passed',
          updatedBy: 'Hệ thống QC (Tự động)',
          updatedAt: now,
          note: 'QC kiểm tra đạt tiêu chuẩn chất lượng tem nhãn. Chuyển đóng gói.'
        },
        {
          status: 'packed',
          updatedBy: 'Kho đóng gói (Tự động)',
          updatedAt: now,
          note: 'Đơn hàng đóng thùng, dán nhãn giao hàng. Sẵn sàng chờ xe giao.'
        }
      ];

      await dbService.updateDocument('pos', po.id, {
        status: 'packed', // Advance straight to packed ready for delivery dispatching!
        historyLogs: updatedLogs
      });
    }

    // AUTO WAREHOUSE DEDUCTION FOR MATERIALS USED
    // In our simplified ERP logic, running an LSX uses decal and ink:
    // Decal = quantity * 0.02 sqm, Ink = quantity * 0.0001 kg.
    const invList = await dbService.getCollection('inventory');
    const decalQtyNeeded = Math.round(selectedLsx.qtyToProduce * 0.015); // e.g. 150sqm for 10k items
    const inkQtyNeeded = Math.round(selectedLsx.qtyToProduce * 0.0002 * 10) / 10; // e.g. 2kg

    // Deduct Decal
    const decalItem = invList.find((item: any) => item.category === 'paper');
    if (decalItem) {
      await dbService.updateDocument('inventory', decalItem.id, {
        qtyInStock: Math.max(0, Number(decalItem.qtyInStock) - decalQtyNeeded),
        updatedAt: now
      });
    }

    // Deduct Ink
    const inkItem = invList.find((item: any) => item.category === 'ink');
    if (inkItem) {
      await dbService.updateDocument('inventory', inkItem.id, {
        qtyInStock: Math.max(0, Number(inkItem.qtyInStock) - inkQtyNeeded),
        updatedAt: now
      });
    }

    setSelectedLsx(null);
    setScrapQty(0);
    setCompletionNotes('');
    onRefresh();
  };

  const getPOItemImage = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    return po?.items[0]?.previewImage || '';
  };

  return (
    <div className="production-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">QUẢN LÝ SẢN XUẤT ( LSX )</h1>
          <p className="page-subtitle">Nhận lệnh in ấn từ phòng kinh doanh, thiết lập phân ca sản xuất đứng máy và ghi nhận sản lượng thực tế/hao hụt nguyên vật liệu.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'producer') && (
          <button className="btn btn-primary" onClick={handleOpenAddLsx}>Phát Hành Lệnh Sản Xuất (LSX)</button>
        )}
      </div>

      <div className="card">
        <span className="card-title">Danh Sách Lệnh Sản Xuất Đang Chạy và Đã Xong</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã LSX</th>
                <th>Mã PO</th>
                <th>Tên Tem Nhãn</th>
                <th>Máy Sản Xuất</th>
                <th>Ca Máy</th>
                <th>Thợ Đứng Máy</th>
                <th>SL Đặt</th>
                <th>Hao Hụt (Phế phẩm)</th>
                <th>Trạng Thái</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {productionCommands.map(cmd => (
                <tr key={cmd.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLsx(cmd)}>
                  <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                  <td>{cmd.poCode}</td>
                  <td style={{ fontWeight: 500 }}>{cmd.productName}</td>
                  <td>{cmd.machineId}</td>
                  <td>{cmd.shift}</td>
                  <td>{cmd.operatorName}</td>
                  <td>{cmd.qtyToProduce.toLocaleString()}</td>
                  <td>{cmd.scrapQty ? `${cmd.scrapQty.toLocaleString()} tem` : '0'}</td>
                  <td>
                    <span className={`badge ${
                      cmd.status === 'completed' ? 'badge-success' : 'badge-info'
                    }`}>{cmd.status === 'completed' ? 'Đã hoàn thành' : 'Đang in'}</span>
                  </td>
                  <td>
                    {cmd.status !== 'completed' && (currentUser.role === 'admin' || currentUser.role === 'producer') ? (
                      <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); setSelectedLsx(cmd); }}>
                        Báo Cáo Hoàn Thành
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(cmd)}>Chi Tiết</button>
                    )}
                  </td>
                </tr>
              ))}
              {productionCommands.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>Không có lệnh sản xuất nào được khởi tạo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE LSX DIALOG */}
      {showAddLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>PHÁT HÀNH LỆNH SẢN XUẤT MỚI (LSX)</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddLsxModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleCreateLsx}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Chọn Đơn Hàng PO Chờ Sản Xuất *</label>
                  <select 
                    value={linkedPoId} 
                    onChange={e => {
                      setLinkedPoId(e.target.value);
                      const po = pos.find(p => p.id === e.target.value);
                      if (po && po.items[0]) setQtyToProduce(po.items[0].quantity);
                    }} 
                    required
                  >
                    {pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed').map(po => (
                      <option key={po.id} value={po.id}>{po.poCode} - {po.customerName} ({po.items[0]?.productName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Máy In Phân Công *</label>
                    <select value={machineId} onChange={e => setMachineId(e.target.value)}>
                      <option value="Máy Flexo 8 màu OMET">Máy Flexo 8 màu OMET</option>
                      <option value="Máy Flexo 4 màu Gallus">Máy Flexo 4 màu Gallus</option>
                      <option value="Máy in Offset Heidelberg">Máy in Offset Heidelberg</option>
                      <option value="Máy in Kỹ thuật số Konica">Máy in Kỹ thuật số Konica</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ca Sản Xuất *</label>
                    <select value={shift} onChange={e => setShift(e.target.value)}>
                      <option value="Ca Sáng (08:00 - 18:00)">Ca Sáng (08:00 - 18:00)</option>
                      <option value="Ca Đêm (18:00 - 04:00)">Ca Đêm (18:00 - 04:00)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <label>Số Lượng Tem Cần In *</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={qtyToProduce} 
                      onChange={e => setQtyToProduce(Number(e.target.value))} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Người Đứng Máy Vận Hành</label>
                    <input type="text" value={operatorName} onChange={e => setOperatorName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>Ghi Chú Kỹ Thuật Máy / Bế / Cán màng</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="Ví dụ: Cán màng OPP mờ, bế cuộn phi 76 hướng tem ra ngoài..." 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddLsxModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Khởi Chạy Máy (Phát Lệnh)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LSX DETAILS AND COMPLETION MODAL */}
      {selectedLsx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>CHI TIẾT LỆNH SẢN XUẤT: {selectedLsx.lsxCode}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(null)}>Đóng</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ fontWeight: 600 }}>Tên Tem Nhãn:</span> {selectedLsx.productName}</div>
                  <div><span style={{ fontWeight: 600 }}>Mã PO Gốc:</span> {selectedLsx.poCode}</div>
                  <div><span style={{ fontWeight: 600 }}>Máy Phân Công:</span> {selectedLsx.machineId}</div>
                  <div><span style={{ fontWeight: 600 }}>Ca Kíp Máy:</span> {selectedLsx.shift}</div>
                  <div><span style={{ fontWeight: 600 }}>Người Vận Hành:</span> {selectedLsx.operatorName}</div>
                  <div><span style={{ fontWeight: 600 }}>Số Lượng Cần In:</span> {selectedLsx.qtyToProduce.toLocaleString()} tem</div>
                  <div><span style={{ fontWeight: 600 }}>Ngày Lập Lệnh:</span> {new Date(selectedLsx.startedAt).toLocaleString('vi-VN')}</div>
                  {selectedLsx.completedAt && (
                    <div>
                      <span style={{ fontWeight: 600 }}>Ngày Hoàn Thành:</span> {new Date(selectedLsx.completedAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', border: '1px solid var(--color-border-light)', padding: '6px', borderRadius: '4px' }}>
                  <h4 style={{ textAlign: 'left', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>Mẫu màu in kỹ thuật:</h4>
                  {getPOItemImage(selectedLsx.poId) ? (
                    <img 
                      src={getPOItemImage(selectedLsx.poId)} 
                      alt="Layout in" 
                      style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', backgroundColor: '#f8fafc', color: 'var(--color-text-muted)', fontSize: '12px' }}>Không có ảnh mẫu</div>
                  )}
                </div>
              </div>

              {selectedLsx.status === 'producing' && (currentUser.role === 'admin' || currentUser.role === 'producer') && (
                <form onSubmit={handleCompleteLsx} style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px', marginTop: '16px', backgroundColor: '#f8fafc' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-success)' }}>Báo cáo kết quả hoàn thành sản xuất:</h3>
                  <div className="form-group">
                    <label>Số Lượng Phế Phẩm / Hao Hụt Phát Sinh (Cái)*</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={scrapQty} 
                      onChange={e => setScrapQty(Number(e.target.value))} 
                      required 
                    />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>* Lượng tem in hỏng trong quá trình canh chỉnh chồng màu và bế decal</span>
                  </div>

                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label>Ghi Chú Kết Quả Vận Hành (Hao hụt giấy, mực...)</label>
                    <textarea 
                      value={completionNotes} 
                      onChange={e => setCompletionNotes(e.target.value)} 
                      placeholder="VD: Chạy máy tốt, hao hụt 120 tem trong lúc set-up dao bế."
                    />
                  </div>

                  <button type="submit" className="btn btn-success" style={{ width: '100%', marginTop: '12px' }}>
                    Xác Nhận Sản Xuất Xong (Tự Động Trừ Kho & Bàn Giao QC)
                  </button>
                </form>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedLsx(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
