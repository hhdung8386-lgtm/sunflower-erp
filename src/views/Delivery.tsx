import React, { useState, useEffect, useRef } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';

interface DeliveryProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Delivery: React.FC<DeliveryProps> = ({ pos, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  
  // Signature Modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signingOrderPoId, setSigningOrderPoId] = useState('');
  
  // Signature Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form states - Delivery Trip
  const [region, setRegion] = useState('Hải Dương');
  const [driverName, setDriverName] = useState('Lê Văn Tài');
  const [vehiclePlate, setVehiclePlate] = useState('34C-888.99');
  const [assignedSaleId, setAssignedSaleId] = useState('u-sale');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Refresh delivery trips list
  const fetchDeliveries = async () => {
    const list = await dbService.getCollection('deliveries');
    setDeliveries(list);
  };

  useEffect(() => {
    fetchDeliveries();
    setDeliveryDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  }, [pos]);

  const handleOpenAddTrip = () => {
    setSelectedOrderIds([]);
    setShowAddTripModal(true);
  };

  // Grouping logic: Get packed orders that matches selected region
  const getPackedOrdersInRegion = () => {
    return pos.filter(po => {
      const isPacked = po.status === 'packed';
      // Mapped address match (simple keyword match)
      const matchesRegion = po.customerName.toLowerCase().includes(region.toLowerCase()) || 
                            po.notes.toLowerCase().includes(region.toLowerCase()) ||
                            (region === 'Hải Dương' && (po.customerName.includes('AQUA') || po.customerName.includes('Brother') || po.customerName.includes('Trancy')));
      return isPacked || (po.status === 'producing' && matchesRegion); // Allow planning producing ones as well
    });
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để giao!');
      return;
    }

    const delCode = `DEL-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Group orders structure
    const tripOrders = selectedOrderIds.map(poId => {
      const po = pos.find(p => p.id === poId);
      return {
        poId,
        customerId: po.customerId,
        customerName: po.customerName,
        deliveryAddress: po.notes.includes('địa chỉ') ? po.notes : 'Kho Khách Hàng (Theo hồ sơ CRM)',
        deliveredQty: po.items[0]?.quantity || 0,
        status: 'pending',
        signatureImage: '',
        note: ''
      };
    });

    const newTrip = {
      delCode,
      deliveryDate: new Date(deliveryDate).toISOString(),
      region,
      driverName,
      vehiclePlate,
      assignedSaleId,
      status: 'planning',
      orders: tripOrders
    };

    await dbService.addDocument('deliveries', newTrip);

    // Update customer PO statuses in the database to "delivering"
    for (const poId of selectedOrderIds) {
      const po = pos.find(p => p.id === poId);
      if (po) {
        const updatedLogs = [
          ...po.historyLogs,
          {
            status: 'delivering',
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: `Lập chuyến xe giao hàng ${delCode} khu vực ${region}. Xe: ${vehiclePlate}. Tài xế: ${driverName}.`
          }
        ];
        await dbService.updateDocument('pos', po.id, {
          status: 'delivering',
          historyLogs: updatedLogs
        });
      }
    }

    setShowAddTripModal(false);
    fetchDeliveries();
    onRefresh();
  };

  const updateTripStatus = async (tripId: string, newStatus: string) => {
    await dbService.updateDocument('deliveries', tripId, { status: newStatus });
    setSelectedTrip((prev: any) => prev ? { ...prev, status: newStatus } : null);
    fetchDeliveries();
    onRefresh();
  };

  // Sign canvas drawing helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Save drawing canvas to Base64 and confirm order delivered
  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTrip) return;

    // Convert Canvas drawing directly into Base64 String
    const signatureBase64 = canvas.toDataURL('image/png');
    
    // Update order state inside the current delivery trip
    const updatedOrders = selectedTrip.orders.map((ord: any) => {
      if (ord.poId === signingOrderPoId) {
        return {
          ...ord,
          status: 'success',
          signatureImage: signatureBase64,
          note: 'Khách hàng nhận đủ, không khiếu nại chất lượng'
        };
      }
      return ord;
    });

    await dbService.updateDocument('deliveries', selectedTrip.id, {
      orders: updatedOrders
    });

    // Also update the actual Customer PO status to "delivered" (this auto-creates invoice!)
    const po = pos.find(p => p.id === signingOrderPoId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'delivered',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Khách hàng ký nhận biên bản bàn giao thành công. Chữ ký số lưu trữ trên hệ thống.`
        }
      ];

      // Auto update PO status to delivered
      await dbService.updateDocument('pos', po.id, {
        status: 'delivered',
        historyLogs: updatedLogs
      });

      // Create accounts receivable VAT invoice automatically!
      const invoiceCode = `VAT-${po.poCode.replace('PO-','')}`;
      await dbService.addDocument('invoices', {
        invoiceCode,
        poId: po.id,
        customerId: po.customerId,
        companyName: po.customerName,
        type: 'receivable',
        amount: po.netAmount,
        paidAmount: 0,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    setShowSignatureModal(false);
    setSelectedTrip((prev: any) => ({ ...prev, orders: updatedOrders }));
    fetchDeliveries();
    onRefresh();
  };

  const handleOpenSignature = (poId: string) => {
    setSigningOrderPoId(poId);
    setShowSignatureModal(true);
    // Timeout to clear canvas after DOM loads
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
        }
      }
    }, 100);
  };

  return (
    <div className="delivery-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ĐIỀU HÀNH & KẾ HOẠCH GIAO HÀNG')}</h1>
          <p className="page-subtitle">{t('Gom đơn hàng đã đóng gói theo khu vực, lập chuyến xe và ký xác nhận giao nhận trực tuyến (Base64).')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'producer' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={handleOpenAddTrip}>{t('Lập Chuyến')}</button>
        )}
      </div>

      <div className="card">
        <span className="card-title">{t('Các Chuyến Giao Hàng Đang Điều Phối')}</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã Chuyến')}</th>
                <th>{t('Khu Vực Tuyến Đường Giao Hàng *')}</th>
                <th>{t('Tên Tài Xế Phụ Trách *')}</th>
                <th>{t('Biển Số Xe Vận Chuyển *')}</th>
                <th>{t('Nhân Viên Sale Đi Cùng (Nếu có)')}</th>
                <th>{t('expectedDeliveryDate')}</th>
                <th>{t('Số Đơn')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(del => (
                <tr key={del.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTrip(del)}>
                  <td style={{ fontWeight: 600 }}>{del.delCode}</td>
                  <td style={{ fontWeight: 500 }}>{t(del.region)}</td>
                  <td>{del.driverName}</td>
                  <td>{del.vehiclePlate}</td>
                  <td>{currentUser.displayName} ({t('Sale Phụ Trách')})</td>
                  <td>{new Date(del.deliveryDate).toLocaleDateString(t('vi-VN'))}</td>
                  <td>{del.orders.length} {t('đơn')}</td>
                  <td>
                    <span className={`badge ${
                      del.status === 'completed' ? 'badge-success' :
                      del.status === 'delivering' ? 'badge-info' : 'badge-warning'
                    }`}>{del.status === 'completed' ? t('Giao Thành Công') : del.status === 'delivering' ? t('Đang Đi Giao') : t('Đang lập chuyến')}</span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setSelectedTrip(del)}>{t('Chi Tiết')}</button>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>{t('Không có chuyến giao hàng nào.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED DELIVERY TRIP DETAIL */}
      {selectedTrip && (
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--color-primary)' }}>
              {t('CHI TIẾT CHUYẾN ĐI')}: {selectedTrip.delCode} ({t(selectedTrip.region)})
            </span>
            <button className="btn btn-sm btn-outline" onClick={() => setSelectedTrip(null)}>{t('Đóng chi tiết')}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
            <div><span style={{ fontWeight: 600 }}>{t('driverName')}:</span> {selectedTrip.driverName}</div>
            <div><span style={{ fontWeight: 600 }}>{t('vehiclePlate')}:</span> {selectedTrip.vehiclePlate}</div>
            <div><span style={{ fontWeight: 600 }}>{t('expectedDeliveryDate')}:</span> {new Date(selectedTrip.deliveryDate).toLocaleDateString(t('vi-VN'))}</div>
            <div><span style={{ fontWeight: 600 }}>{t('Trạng Thái')}:</span> {t(selectedTrip.status.toUpperCase())}</div>
          </div>

          {selectedTrip.status === 'planning' && (
            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'delivering')}>
                {t('Đang Đi Giao')}
              </button>
              <button className="btn btn-danger" onClick={() => dbService.deleteDocument('deliveries', selectedTrip.id).then(() => { setSelectedTrip(null); fetchDeliveries(); })} style={{ width: 'auto' }}>
                {t('Hủy')}
              </button>
            </div>
          )}
          
          {selectedTrip.status === 'delivering' && (
            <button className="btn btn-success" onClick={() => updateTripStatus(selectedTrip.id, 'completed')}>
              {t('Giao Thành Công')}
            </button>
          )}

          <h3 style={{ fontSize: '14px', marginTop: '10px', color: 'var(--color-primary)' }}>{t('Chọn Các Đơn Hàng Sẵn Sàng Giao (QC Đã Duyệt)')}:</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Khách Hàng')}</th>
                  <th>{t('Địa Chỉ Giao')}</th>
                  <th>{t('Số Lượng')} ({t('tem')})</th>
                  <th>{t('XÁC NHẬN KÝ NHẬN GIAO HÀNG')}</th>
                  <th>{t('Trạng Thái')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedTrip.orders.map((ord: any) => (
                  <tr key={ord.poId}>
                    <td style={{ fontWeight: 600 }}>{ord.customerName}</td>
                    <td>{ord.deliveryAddress}</td>
                    <td>{ord.deliveredQty.toLocaleString()}</td>
                    <td>
                      {ord.signatureImage ? (
                        <img 
                          src={ord.signatureImage} 
                          alt="Chữ ký nhận hàng" 
                          style={{ maxHeight: '40px', border: '1px solid var(--color-border)', padding: '2px' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Chưa ký nhận')}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        ord.status === 'success' ? 'badge-success' : 'badge-warning'
                      }`}>{ord.status === 'success' ? t('Giao Thành Công') : t('Chờ giao')}</span>
                    </td>
                    <td>
                      {ord.status !== 'success' && selectedTrip.status === 'delivering' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOpenSignature(ord.poId)}>
                          {t('Xác Nhận Đã Giao')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE TRIP MODAL */}
      {showAddTripModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('LẬP CHUYẾN XE GIAO HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddTripModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreateTrip}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Khu Vực Tuyến Đường Giao Hàng *')}</label>
                    <select value={region} onChange={e => setRegion(e.target.value)}>
                      <option value="Hải Dương">{t('Tỉnh Hải Dương (GomAqua/Brother/Trancy)')}</option>
                      <option value="Bắc Ninh">{t('Tỉnh Bắc Ninh (Samsung)')}</option>
                      <option value="Hà Nội">{t('Thành Phố Hà Nội')}</option>
                      <option value="Hưng Yên">{t('Tỉnh Hưng Yên')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required />
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Tên Tài Xế Phụ Trách *')}</label>
                    <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Biển Số Xe Vận Chuyển *')}</label>
                    <input type="text" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} required />
                  </div>
                </div>

                <h3 style={{ fontSize: '13px', marginTop: '16px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                  {t('Chọn Các Đơn Hàng Sẵn Sàng Giao (QC Đã Duyệt)')} "{t(region)}":
                </h3>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px' }}>
                  {getPackedOrdersInRegion().map(po => {
                    const isChecked = selectedOrderIds.includes(po.id);
                    return (
                      <div key={po.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <input 
                          type="checkbox" 
                          id={`chk-${po.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds([...selectedOrderIds, po.id]);
                            } else {
                              setSelectedOrderIds(selectedOrderIds.filter(id => id !== po.id));
                            }
                          }}
                          style={{ width: 'auto' }}
                        />
                        <label htmlFor={`chk-${po.id}`} style={{ fontWeight: 'normal', cursor: 'pointer' }}>
                          <strong>{po.poCode}</strong> - {po.customerName} | {t('Sản Phẩm')}: {po.items[0]?.productName} ({t('Số Lượng')}: {po.items[0]?.quantity?.toLocaleString()} {t('tem')})
                        </label>
                      </div>
                    );
                  })}
                  {getPackedOrdersInRegion().length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                      {t('Không có lịch giao hàng sắp tới.')}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddTripModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Chuyến Xe')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIGNATURE DRAWING PAD DIALOG (Base64 signature canvas) */}
      {showSignatureModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('XÁC NHẬN KÝ NHẬN GIAO HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowSignatureModal(false)}>{t('Hủy')}</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                {t('Bấm chuột/Vẽ ngón tay lên khung dưới đây để ký nhận biên bản:')}
              </p>
              
              <canvas 
                ref={canvasRef}
                width="360" 
                height="180" 
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{ border: '2px solid var(--color-primary)', borderRadius: '4px', cursor: 'crosshair', backgroundColor: '#ffffff' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={clearCanvas}>{t('Xóa Chữ Ký')}</button>
                <button type="button" className="btn btn-sm btn-success" onClick={saveSignature}>{t('Xác Nhận Đã Giao')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
