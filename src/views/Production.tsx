import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';

interface ProductionProps {
  pos: any[];
  productionCommands: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Production: React.FC<ProductionProps> = ({ pos, productionCommands, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [showAddLsxModal, setShowAddLsxModal] = useState(false);
  const [showEditLsxModal, setShowEditLsxModal] = useState(false);
  const [selectedLsx, setSelectedLsx] = useState<any | null>(null);

  // Form states
  const [linkedPoId, setLinkedPoId] = useState('');
  const [machineId, setMachineId] = useState('Máy Flexo 8 màu');
  const [shift, setShift] = useState('Ca Sáng (08:00 - 18:00)');
  const [operatorName, setOperatorName] = useState('Thành Vũ (Sản xuất)');
  const [qtyToProduce, setQtyToProduce] = useState(10000);
  const [notes, setNotes] = useState('');

  // Edit form states
  const [editMachineId, setEditMachineId] = useState('');
  const [editShift, setEditShift] = useState('');
  const [editOperatorName, setEditOperatorName] = useState('');
  const [editQtyToProduce, setEditQtyToProduce] = useState(10000);
  const [editNotes, setEditNotes] = useState('');

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
      operatorName: operatorName,
      status: 'producing',
      scrapQty: 0,
      notes,
      startedAt: new Date().toISOString(),
      completedAt: '',
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('production_commands', newLsx);

    // Update customer PO status to "producing"
    const updatedLogs = [
      ...po.historyLogs,
      {
        status: 'producing',
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Phát hành Lệnh sản xuất ${lsxCode} giao phó thợ máy ${operatorName} đứng máy in ${machineId}.`
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

  const handleOpenEditLsx = (lsx: any) => {
    setEditMachineId(lsx.machineId);
    setEditShift(lsx.shift);
    setEditOperatorName(lsx.operatorName || '');
    setEditQtyToProduce(lsx.qtyToProduce);
    setEditNotes(lsx.notes || '');
    setShowEditLsxModal(true);
  };

  const handleEditLsxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLsx) return;

    await dbService.updateDocument('production_commands', selectedLsx.id, {
      machineId: editMachineId,
      shift: editShift,
      operatorName: editOperatorName,
      qtyToProduce: Number(editQtyToProduce),
      notes: editNotes,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditLsxModal(false);
    setSelectedLsx(null);
    onRefresh();
  };

  const handleDeleteLsx = async (lsxId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa lệnh sản xuất này?'))) {
      const lsx = productionCommands.find(l => l.id === lsxId);
      await dbService.deleteDocument('production_commands', lsxId);
      
      if (lsx) {
        const po = pos.find(p => p.id === lsx.poId);
        if (po) {
          const updatedLogs = [
            ...po.historyLogs,
            {
              status: 'supplier_confirmed',
              updatedBy: currentUser.displayName,
              updatedAt: new Date().toISOString(),
              note: `Đã hủy lệnh sản xuất ${lsx.lsxCode}. Trạng thái PO quay lại chờ sản xuất.`
            }
          ];
          await dbService.updateDocument('pos', po.id, {
            status: 'supplier_confirmed',
            historyLogs: updatedLogs
          });
        }
      }

      setSelectedLsx(null);
      onRefresh();
    }
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
      completedAt: now,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: now
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
          <h1 className="page-title">{t('LỆNH SẢN XUẤT (LSX)')}</h1>
          <p className="page-subtitle">{t('Phát hành lệnh sản xuất, phân bổ máy in, ca máy, thợ in và ghi nhận sản lượng hoàn thành, hao hụt.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'producer') && (
          <button className="btn btn-primary" onClick={handleOpenAddLsx}>{t('PHÁT HÀNH LỆNH SẢN XUẤT (LSX) MỚI')}</button>
        )}
      </div>

      <div className="card">
        <span className="card-title">{t('Danh Sách Lệnh Sản Xuất Đang Chạy và Đã Xong')}</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã LSX')}</th>
                <th>{t('Mã PO')}</th>
                <th>{t('Tên Tem Nhãn')}</th>
                <th>{t('Máy Sản Xuất')}</th>
                <th>{t('Ca Máy')}</th>
                <th>{t('Thợ Đứng Máy')}</th>
                <th>{t('SL Đặt')}</th>
                <th>{t('Hao Hụt (Phế phẩm)')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {productionCommands.map(cmd => (
                <tr key={cmd.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLsx(cmd)}>
                  <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                  <td>{cmd.poCode}</td>
                  <td style={{ fontWeight: 500 }}>{cmd.productName}</td>
                  <td>{t(cmd.machineId)}</td>
                  <td>{t(cmd.shift)}</td>
                  <td>{cmd.operatorName}</td>
                  <td>{cmd.qtyToProduce.toLocaleString()}</td>
                  <td>{cmd.scrapQty ? `${cmd.scrapQty.toLocaleString()} ${t('tem')}` : '0'}</td>
                  <td>
                    <span className={`badge ${
                      cmd.status === 'completed' ? 'badge-success' : 'badge-info'
                    }`}>{cmd.status === 'completed' ? t('Đã hoàn thành') : t('Đang in')}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                      {cmd.status !== 'completed' && (currentUser.role === 'admin' || currentUser.role === 'producer') ? (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => setSelectedLsx(cmd)}>
                            {t('Báo Cáo Hoàn Thành')}
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleOpenEditLsx(cmd)}>
                            {t('Sửa')}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteLsx(cmd.id)}>
                            {t('Xóa')}
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(cmd)}>{t('Chi Tiết')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {productionCommands.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>{t('Không có lệnh sản xuất nào được ghi nhận.')}</td>
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
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('PHÁT HÀNH LỆNH SẢN XUẤT (LSX) MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddLsxModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreateLsx}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Chọn Đơn Hàng PO Chờ Sản Xuất *')}</label>
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
                    <label>{t('Máy In Phân Công *')}</label>
                    <select value={machineId} onChange={e => setMachineId(e.target.value)}>
                      <option value="Máy Flexo 8 màu OMET">{t('Máy Flexo 8 màu OMET')}</option>
                      <option value="Máy Flexo 4 màu Gallus">{t('Máy Flexo 4 màu Gallus')}</option>
                      <option value="Máy in Offset Heidelberg">{t('Máy in Offset Heidelberg')}</option>
                      <option value="Máy in Kỹ thuật số Konica">{t('Máy in Kỹ thuật số Konica')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ca Sản Xuất *')}</label>
                    <select value={shift} onChange={e => setShift(e.target.value)}>
                      <option value="Ca Sáng (08:00 - 18:00)">{t('Ca Sáng (08:00 - 18:00)')}</option>
                      <option value="Ca Đêm (18:00 - 04:00)">{t('Ca Đêm (18:00 - 04:00)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng Tem Cần In *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={qtyToProduce} 
                      onChange={e => setQtyToProduce(Number(e.target.value))} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Người Đứng Máy Vận Hành')}</label>
                    <input type="text" value={operatorName} onChange={e => setOperatorName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Ghi Chú Kỹ Thuật Máy / Bế / Cán màng')}</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder={t('Ví dụ: Cán màng OPP mờ, bế cuộn phi 76 hướng tem ra ngoài...')} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddLsxModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Phát Hành Lệnh')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LSX DIALOG */}
      {showEditLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Chỉnh Sửa Lệnh Sản Xuất')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditLsxModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditLsxSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Máy In Phân Công *')}</label>
                    <select value={editMachineId} onChange={e => setEditMachineId(e.target.value)}>
                      <option value="Máy Flexo 8 màu OMET">{t('Máy Flexo 8 màu OMET')}</option>
                      <option value="Máy Flexo 4 màu Gallus">{t('Máy Flexo 4 màu Gallus')}</option>
                      <option value="Máy in Offset Heidelberg">{t('Máy in Offset Heidelberg')}</option>
                      <option value="Máy in Kỹ thuật số Konica">{t('Máy in Kỹ thuật số Konica')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ca Sản Xuất *')}</label>
                    <select value={editShift} onChange={e => setEditShift(e.target.value)}>
                      <option value="Ca Sáng (08:00 - 18:00)">{t('Ca Sáng (08:00 - 18:00)')}</option>
                      <option value="Ca Đêm (18:00 - 04:00)">{t('Ca Đêm (18:00 - 04:00)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng Tem Cần In *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editQtyToProduce} 
                      onChange={e => setEditQtyToProduce(Number(e.target.value))} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Người Đứng Máy Vận Hành')}</label>
                    <input type="text" value={editOperatorName} onChange={e => setEditOperatorName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Ghi Chú Kỹ Thuật Máy / Bế / Cán màng')}</label>
                  <textarea 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditLsxModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LSX DETAILS AND COMPLETION MODAL */}
      {selectedLsx && !showEditLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHI TIẾT LỆNH SẢN XUẤT')}: {selectedLsx.lsxCode}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedLsx.status === 'producing' && (currentUser.role === 'admin' || currentUser.role === 'producer') && (
                  <>
                    <button className="btn btn-sm btn-outline" onClick={() => handleOpenEditLsx(selectedLsx)}>{t('Sửa')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteLsx(selectedLsx.id)}>{t('Xóa')}</button>
                  </>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(null)}>{t('Đóng')}</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ fontWeight: 600 }}>{t('Tên Tem Nhãn')}:</span> {selectedLsx.productName}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Mã PO Gốc')}:</span> {selectedLsx.poCode}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Máy Phân Công')}:</span> {t(selectedLsx.machineId)}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ca Kíp Máy')}:</span> {t(selectedLsx.shift)}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Người Vận Hành')}:</span> {selectedLsx.operatorName}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Số Lượng Cần In')}:</span> {selectedLsx.qtyToProduce.toLocaleString()} {t('tem')}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ghi chú')}:</span> {selectedLsx.notes || t('Không có')}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ngày Lập Lệnh')}:</span> {new Date(selectedLsx.startedAt).toLocaleString('vi-VN')}</div>
                  {selectedLsx.completedAt && (
                    <div>
                      <span style={{ fontWeight: 600 }}>{t('Ngày Hoàn Thành')}:</span> {new Date(selectedLsx.completedAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', border: '1px solid var(--color-border-light)', padding: '6px', borderRadius: '4px' }}>
                  <h4 style={{ textAlign: 'left', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>{t('Mẫu màu in kỹ thuật')}:</h4>
                  {getPOItemImage(selectedLsx.poId) ? (
                    <img 
                      src={getPOItemImage(selectedLsx.poId)} 
                      alt="Layout in" 
                      style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', backgroundColor: '#f8fafc', color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Không có ảnh mẫu')}</div>
                  )}
                </div>
              </div>

              {selectedLsx.status === 'producing' && (currentUser.role === 'admin' || currentUser.role === 'producer') && (
                <form onSubmit={handleCompleteLsx} style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px', marginTop: '16px', backgroundColor: '#f8fafc' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-success)' }}>{t('Báo cáo kết quả hoàn thành sản xuất')}:</h3>
                  <div className="form-group">
                    <label>{t('Số Lượng Phế Phẩm / Hao Hụt Phát Sinh (Cái)*')}</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={scrapQty} 
                      onChange={e => setScrapQty(Number(e.target.value))} 
                      required 
                    />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('* Lượng tem in hỏng trong quá trình canh chỉnh chồng màu và bế decal')}</span>
                  </div>

                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label>{t('Ghi Chú Kết Quả Vận Hành (Hao hụt giấy, mực...)')}</label>
                    <textarea 
                      value={completionNotes} 
                      onChange={e => setCompletionNotes(e.target.value)} 
                      placeholder={t('VD: Chạy máy tốt, hao hụt 120 tem trong lúc set-up dao bế.')}
                    />
                  </div>

                  <button type="submit" className="btn btn-success" style={{ width: '100%', marginTop: '12px' }}>
                    {t('Xác Nhận Sản Xuất Xong (Tự Động Trừ Kho & Bàn Giao QC)')}
                  </button>
                </form>
              )}

              {/* Audit trail */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <div>{t('Tạo bởi:')} {selectedLsx.createdBy || t('Không xác định')} {selectedLsx.createdAt && `(${new Date(selectedLsx.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                {selectedLsx.updatedBy && (
                  <div>{t('Cập nhật bởi:')} {selectedLsx.updatedBy} ({new Date(selectedLsx.updatedAt).toLocaleString(t('vi-VN'))})</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedLsx(null)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
