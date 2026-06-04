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
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  
  // Signature Modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signingOrderPoId, setSigningOrderPoId] = useState('');
  const [signingPo, setSigningPo] = useState<any | null>(null);
  const [deliveredQuantities, setDeliveredQuantities] = useState<{ [itemId: string]: number }>({});
  
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

  // Edit form states
  const [editRegion, setEditRegion] = useState('Hải Dương');
  const [editDriverName, setEditDriverName] = useState('Lê Văn Tài');
  const [editVehiclePlate, setEditVehiclePlate] = useState('34C-888.99');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editSelectedOrderIds, setEditSelectedOrderIds] = useState<string[]>([]);

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
  const getPackedOrdersInRegion = (reg: string) => {
    return pos.filter(po => {
      const isPacked = po.status === 'packed' || po.status === 'partially_delivered';
      const matchesRegion = po.customerName.toLowerCase().includes(reg.toLowerCase()) || 
                            (po.notes || '').toLowerCase().includes(reg.toLowerCase()) ||
                            (reg === 'Hải Dương' && (po.customerName.includes('AQUA') || po.customerName.includes('Brother') || po.customerName.includes('Trancy')));
      return isPacked && matchesRegion;
    });
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để giao!');
      return;
    }

    const delCode = `DEL-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const tripOrders = selectedOrderIds.map(poId => {
      const po = pos.find(p => p.id === poId);
      // Sum remaining qty for display
      const totalRemaining = po?.items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) - (Number(item.qtyDelivered) || 0)), 0) || 0;
      return {
        poId,
        customerId: po?.customerId || '',
        customerName: po?.customerName || '',
        deliveryAddress: po?.notes?.includes('địa chỉ') ? po.notes : 'Kho Khách Hàng (Theo hồ sơ CRM)',
        deliveredQty: totalRemaining,
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
      orders: tripOrders,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('deliveries', newTrip);

    // Update customer PO statuses to "delivering"
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

  const handleOpenEditTrip = (trip: any) => {
    setSelectedTrip(trip);
    setEditRegion(trip.region);
    setEditDriverName(trip.driverName);
    setEditVehiclePlate(trip.vehiclePlate);
    setEditDeliveryDate(new Date(trip.deliveryDate).toISOString().split('T')[0]);
    setEditSelectedOrderIds(trip.orders.map((o: any) => o.poId));
    setShowEditTripModal(true);
  };

  const handleEditTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    if (editSelectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để giao!');
      return;
    }

    const tripOrders = editSelectedOrderIds.map(poId => {
      const po = pos.find(p => p.id === poId);
      const existingOrder = selectedTrip.orders.find((o: any) => o.poId === poId);
      const totalRemaining = po?.items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) - (Number(item.qtyDelivered) || 0)), 0) || 0;
      return {
        poId,
        customerId: po?.customerId || existingOrder?.customerId || '',
        customerName: po?.customerName || existingOrder?.customerName || '',
        deliveryAddress: po?.notes?.includes('địa chỉ') ? po.notes : 'Kho Khách Hàng (Theo hồ sơ CRM)',
        deliveredQty: existingOrder ? existingOrder.deliveredQty : totalRemaining,
        status: existingOrder?.status || 'pending',
        signatureImage: existingOrder?.signatureImage || '',
        note: existingOrder?.note || ''
      };
    });

    await dbService.updateDocument('deliveries', selectedTrip.id, {
      region: editRegion,
      driverName: editDriverName,
      vehiclePlate: editVehiclePlate,
      deliveryDate: new Date(editDeliveryDate).toISOString(),
      orders: tripOrders,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditTripModal(false);
    setSelectedTrip(null);
    fetchDeliveries();
    onRefresh();
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa chuyến xe giao hàng này?'))) {
      const trip = deliveries.find(d => d.id === tripId);
      await dbService.deleteDocument('deliveries', tripId);
      
      if (trip) {
        for (const ord of trip.orders) {
          const po = pos.find(p => p.id === ord.poId);
          if (po && po.status === 'delivering') {
            const updatedLogs = [
              ...po.historyLogs,
              {
                status: 'packed',
                updatedBy: currentUser.displayName,
                updatedAt: new Date().toISOString(),
                note: `Đã hủy chuyến giao hàng ${trip.delCode}. Trạng thái PO quay lại chờ xe giao.`
              }
            ];
            await dbService.updateDocument('pos', po.id, {
              status: 'packed',
              historyLogs: updatedLogs
            });
          }
        }
      }

      setSelectedTrip(null);
      fetchDeliveries();
      onRefresh();
    }
  };

  const updateTripStatus = async (tripId: string, newStatus: string) => {
    await dbService.updateDocument('deliveries', tripId, { 
      status: newStatus,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });
    setSelectedTrip((prev: any) => prev ? { ...prev, status: newStatus } : null);
    fetchDeliveries();
    onRefresh();
  };

  const handleRevertTripStatus = async (trip: any) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn hoãn chuyến giao hàng này? Trạng thái các đơn hàng liên kết sẽ quay về "Đã đóng gói".'))) return;

    // 1. Revert trip status to planning
    await dbService.updateDocument('deliveries', trip.id, { 
      status: 'planning',
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    // 2. Revert PO statuses to packed
    if (trip.orders) {
      for (const ord of trip.orders) {
        const po = pos.find(p => p.id === ord.poId);
        if (po) {
          const updatedLogs = [
            ...po.historyLogs,
            {
              status: 'packed',
              updatedBy: currentUser.displayName,
              updatedAt: new Date().toISOString(),
              note: `Hoãn chuyến giao hàng ${trip.delCode}. Trạng thái PO quay lại chờ xe giao.`
            }
          ];
          await dbService.updateDocument('pos', po.id, {
            status: 'packed',
            historyLogs: updatedLogs
          });
        }
      }
    }

    setSelectedTrip((prev: any) => prev ? { ...prev, status: 'planning' } : null);
    fetchDeliveries();
    onRefresh();
  };

  // Sign canvas drawing helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
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

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTrip || !signingPo) return;

    const signatureBase64 = canvas.toDataURL('image/png');
    
    // Accumulate total items quantity delivered
    let currentTripDeliveredQty = 0;

    // Update PO items with newly delivered quantities
    const updatedItems = signingPo.items.map((item: any) => {
      const itemId = item.itemId || item.productCode;
      const currentDel = Number(deliveredQuantities[itemId]) || 0;
      currentTripDeliveredQty += currentDel;
      return {
        ...item,
        qtyDelivered: (Number(item.qtyDelivered) || 0) + currentDel
      };
    });

    // Check if fully delivered
    const isAllFullyDelivered = updatedItems.every((item: any) => (Number(item.qtyDelivered) || 0) >= Number(item.quantity));
    const finalPoStatus = isAllFullyDelivered ? 'delivered' : 'partially_delivered';

    // Calculate invoice amount for this specific delivery batch
    const batchInvoiceAmount = signingPo.items.reduce((sum: number, item: any) => {
      const itemId = item.itemId || item.productCode;
      const currentDel = Number(deliveredQuantities[itemId]) || 0;
      return sum + (currentDel * Number(item.price));
    }, 0);

    // Save updated items and status to PO
    const poLogs = [
      ...signingPo.historyLogs,
      {
        status: finalPoStatus,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Báo cáo giao hàng lẻ: ${signingPo.items.map((item: any) => {
          const itemId = item.itemId || item.productCode;
          const qty = deliveredQuantities[itemId] || 0;
          return `${item.productName} (Giao +${qty})`;
        }).join(', ')}. Chữ ký lưu trên hệ thống.`
      }
    ];

    await dbService.updateDocument('pos', signingPo.id, {
      items: updatedItems,
      status: finalPoStatus,
      historyLogs: poLogs
    });

    // Save dynamic receivable invoice for this batch
    if (batchInvoiceAmount > 0) {
      const invoiceCode = `VAT-${signingPo.poCode.replace('PO-','')}-${Math.floor(100 + Math.random() * 900)}`;
      await dbService.addDocument('invoices', {
        invoiceCode,
        poId: signingPo.id,
        poCode: signingPo.poCode,
        customerId: signingPo.customerId,
        companyName: signingPo.customerName,
        type: 'receivable',
        amount: batchInvoiceAmount,
        paidAmount: 0,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        createdAt: new Date().toISOString()
      });
    }

    // Update trip details
    const updatedOrders = selectedTrip.orders.map((ord: any) => {
      if (ord.poId === signingOrderPoId) {
        return {
          ...ord,
          status: 'success',
          deliveredQty: currentTripDeliveredQty,
          signatureImage: signatureBase64,
          note: finalPoStatus === 'delivered' ? 'Giao hoàn tất đơn' : 'Giao hàng một phần'
        };
      }
      return ord;
    });

    await dbService.updateDocument('deliveries', selectedTrip.id, {
      orders: updatedOrders
    });

    setShowSignatureModal(false);
    setSigningPo(null);
    setSelectedTrip((prev: any) => ({ ...prev, orders: updatedOrders }));
    fetchDeliveries();
    onRefresh();
  };

  const handleOpenSignature = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    setSigningOrderPoId(poId);
    setSigningPo(po);

    // Initialize quantities to remaining to deliver
    const initialQuantities: { [itemId: string]: number } = {};
    po.items?.forEach((item: any) => {
      const itemId = item.itemId || item.productCode;
      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
      initialQuantities[itemId] = Math.max(0, remaining);
    });
    setDeliveredQuantities(initialQuantities);

    setShowSignatureModal(true);
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

  const handleForceClosePO = async (po: any) => {
    const missingItems = po.items?.map((item: any) => {
      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
      return `${item.productName} (Thiếu ${remaining?.toLocaleString()} tem)`;
    }).join(', ') || '';

    if (window.confirm(t(`Bạn có chắc chắn muốn Force Close đóng đơn hàng PO này do dung sai sản xuất?\nChi tiết thiếu: ${missingItems}`))) {
      const now = new Date().toISOString();
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'delivered',
          updatedBy: currentUser.displayName,
          updatedAt: now,
          note: `Force Close đơn hàng theo số lượng thực tế đã giao. Lý do: Dung sai hao hụt sản xuất trong mức khách hàng chấp nhận.`
        }
      ];

      await dbService.updateDocument('pos', po.id, {
        status: 'delivered', 
        historyLogs: updatedLogs
      });

      onRefresh();
    }
  };

  return (
    <div className="delivery-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ĐIỀU HÀNH & KẾ HOẠCH GIAO HÀNG')}</h1>
          <p className="page-subtitle">{t('Gom đơn hàng đã đóng gói theo khu vực, lập chuyến xe ghép và xác nhận giao lẻ hoặc Force Close đơn.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'producer' || currentUser.role === 'sale') && (
          <button className="btn btn-primary btn-symbol" onClick={handleOpenAddTrip} title={t('Lập Chuyến Xe Ghép')}>+</button>
        )}
      </div>

      {/* SUGGESTION PANEL FOR TRUCK COMBINATION */}
      <div className="card" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '6px' }}>
        <h3 style={{ color: '#166534', marginBottom: '8px', fontSize: '15px', fontWeight: 700 }}>{t('Gợi Ý Gom Chuyến Xe Ghép Vận Chuyển')}</h3>
        <p style={{ fontSize: '13px', color: '#166534', marginBottom: '12px' }}>
          {t('Hệ thống phát hiện các đơn hàng đã đóng gói (packed) sẵn sàng giao theo các tuyến đường tỉnh. Hãy gom chuyến xe ghép chung để tối ưu chi phí vận tải.')}
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {['Hải Dương', 'Bắc Ninh', 'Hà Nội', 'Hưng Yên'].map(reg => {
            const packedCount = pos.filter(po => (po.status === 'packed' || po.status === 'partially_delivered') && (
              po.customerName.toLowerCase().includes(reg.toLowerCase()) || 
              (po.notes || '').toLowerCase().includes(reg.toLowerCase()) ||
              (reg === 'Hải Dương' && (po.customerName.includes('AQUA') || po.customerName.includes('Brother') || po.customerName.includes('Trancy')))
            )).length;

            return (
              <div key={reg} style={{ backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dcfce7', fontSize: '12.5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <strong>Tuyến {reg}</strong>: <span style={{ color: packedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 700 }}>{packedCount} đơn sẵn sàng</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* DUNG SAI & FORCE CLOSE PANEL */}
      <div className="card" style={{ marginTop: '10px' }}>
        <span className="card-title">{t('Quản Lý Đơn Giao Từng Phần & Đóng Đơn Dung Sai (Force Close)')}</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã PO')}</th>
                <th>{t('Khách Hàng')}</th>
                <th>{t('Tên Sản Phẩm')}</th>
                <th>{t('SL Yêu Cầu')}</th>
                <th>{t('Đã Giao Lũy Kế')}</th>
                <th>{t('Còn Thiếu')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {pos.filter(po => po.status === 'partially_delivered' || po.status === 'delivering').map(po => {
                const totalReq = po.items?.reduce((sum: number, i: any) => sum + Number(i.quantity), 0) || 0;
                const totalDel = po.items?.reduce((sum: number, i: any) => sum + (Number(i.qtyDelivered) || 0), 0) || 0;
                const totalRem = Math.max(0, totalReq - totalDel);

                return (
                  <tr key={po.id}>
                    <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                    <td>{po.customerName}</td>
                    <td>{po.items?.[0]?.productName} {po.items?.length > 1 ? `(+${po.items.length - 1} mặt hàng)` : ''}</td>
                    <td>{totalReq.toLocaleString()}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{totalDel.toLocaleString()}</td>
                    <td style={{ color: totalRem > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{totalRem.toLocaleString()}</td>
                    <td>
                      <span className="badge badge-warning">
                        {po.status === 'partially_delivered' ? t('Đang Giao Dở Dang') : t('Đang Đi Xe')}
                      </span>
                    </td>
                    <td>
                      {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleForceClosePO(po)}>
                          {t('Đóng đơn (Force Close)')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pos.filter(po => po.status === 'partially_delivered' || po.status === 'delivering').length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {t('Không có đơn hàng nào ở trạng thái giao hàng dở dang cần Force Close.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                <th>{t('Ngày Đi Giao')}</th>
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
                  <td>{new Date(del.deliveryDate).toLocaleDateString(t('vi-VN'))}</td>
                  <td>{del.orders?.length} {t('đơn')}</td>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedTrip.status === 'planning' && (currentUser.role === 'admin' || currentUser.role === 'producer' || currentUser.role === 'sale') && (
                <>
                  <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditTrip(selectedTrip)} title={t('Sửa')}>✎</button>
                  <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteTrip(selectedTrip.id)} title={t('Xóa')}>✕</button>
                </>
              )}
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedTrip(null)}>{t('Đóng chi tiết')}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
            <div><span style={{ fontWeight: 600 }}>{t('Tài Xế')}:</span> {selectedTrip.driverName}</div>
            <div><span style={{ fontWeight: 600 }}>{t('Biển Số Xe')}:</span> {selectedTrip.vehiclePlate}</div>
            <div><span style={{ fontWeight: 600 }}>{t('Ngày Giao Dự Kiến')}:</span> {new Date(selectedTrip.deliveryDate).toLocaleDateString(t('vi-VN'))}</div>
            <div><span style={{ fontWeight: 600 }}>{t('Trạng Thái Chuyến')}:</span> {t(selectedTrip.status.toUpperCase())}</div>
          </div>

          {selectedTrip.status === 'planning' && (
            <div className="btn-group" style={{ marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'delivering')}>
                {t('Đang Đi Giao')}
              </button>
            </div>
          )}
          
          {selectedTrip.status === 'delivering' && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => updateTripStatus(selectedTrip.id, 'completed')}>
                {t('Giao Thành Công Toàn Bộ')}
              </button>
              <button className="btn btn-outline" style={{ flex: 1, borderColor: 'var(--color-warning)', color: 'var(--color-warning)', fontWeight: 600 }} onClick={() => handleRevertTripStatus(selectedTrip)}>
                {t('↩ Hoãn Giao Hàng')}
              </button>
            </div>
          )}

          <h3 style={{ fontSize: '14px', marginTop: '20px', color: 'var(--color-primary)' }}>{t('Chi tiết đơn hàng thuộc chuyến')}:</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Khách Hàng')}</th>
                  <th>{t('Địa Chỉ Giao')}</th>
                  <th>{t('Số Lượng Còn Giao')}</th>
                  <th>{t('XÁC NHẬN KÝ NHẬN')}</th>
                  <th>{t('Trạng Thái')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedTrip.orders?.map((ord: any) => (
                  <tr key={ord.poId}>
                    <td style={{ fontWeight: 600 }}>{ord.customerName}</td>
                    <td>{ord.deliveryAddress}</td>
                    <td>{ord.deliveredQty?.toLocaleString()}</td>
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
                          {t('Xác Nhận Ký Nhận')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit trail */}
          <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <div>{t('Tạo bởi:')} {selectedTrip.createdBy || t('Không xác định')} {selectedTrip.createdAt && `(${new Date(selectedTrip.createdAt).toLocaleString(t('vi-VN'))})`}</div>
            {selectedTrip.updatedBy && (
              <div>{t('Cập nhật bởi:')} {selectedTrip.updatedBy} ({new Date(selectedTrip.updatedAt).toLocaleString(t('vi-VN'))})</div>
            )}
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
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                  {getPackedOrdersInRegion(region).map(po => {
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
                          <strong>{po.poCode}</strong> - {po.customerName} | {t('Sản Phẩm')}: {po.items?.[0]?.productName} ({t('SL Còn Lại')}: {po.items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) - (Number(i.qtyDelivered) || 0)), 0)?.toLocaleString()} {t('tem')})
                        </label>
                      </div>
                    );
                  })}
                  {getPackedOrdersInRegion(region).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {t('Không có lịch giao hàng sắp tới cho tuyến này.')}
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

      {/* EDIT TRIP MODAL */}
      {showEditTripModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA CHUYẾN XE GIAO HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditTripModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditTripSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Khu Vực Tuyến Đường Giao Hàng *')}</label>
                    <select value={editRegion} onChange={e => setEditRegion(e.target.value)}>
                      <option value="Hải Dương">{t('Tỉnh Hải Dương (GomAqua/Brother/Trancy)')}</option>
                      <option value="Bắc Ninh">{t('Tỉnh Bắc Ninh (Samsung)')}</option>
                      <option value="Hà Nội">{t('Thành Phố Hà Nội')}</option>
                      <option value="Hưng Yên">{t('Tỉnh Hưng Yên')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={editDeliveryDate} onChange={e => setEditDeliveryDate(e.target.value)} required />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Tên Tài Xế Phụ Trách *')}</label>
                    <input type="text" value={editDriverName} onChange={e => setEditDriverName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Biển Số Xe Vận Chuyển *')}</label>
                    <input type="text" value={editVehiclePlate} onChange={e => setEditVehiclePlate(e.target.value)} required />
                  </div>
                </div>

                <h3 style={{ fontSize: '13px', marginTop: '16px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                  {t('Chọn Các Đơn Hàng Sẵn Sàng Giao (QC Đã Duyệt)')} "{t(editRegion)}":
                </h3>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px' }}>
                  {getPackedOrdersInRegion(editRegion).map(po => {
                    const isChecked = editSelectedOrderIds.includes(po.id);
                    return (
                      <div key={po.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <input 
                          type="checkbox" 
                          id={`edit-chk-${po.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSelectedOrderIds([...editSelectedOrderIds, po.id]);
                            } else {
                              setEditSelectedOrderIds(editSelectedOrderIds.filter(id => id !== po.id));
                            }
                          }}
                          style={{ width: 'auto' }}
                        />
                        <label htmlFor={`edit-chk-${po.id}`} style={{ fontWeight: 'normal', cursor: 'pointer' }}>
                          <strong>{po.poCode}</strong> - {po.customerName} | {t('Sản Phẩm')}: {po.items?.[0]?.productName} ({t('SL Còn Lại')}: {po.items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) - (Number(i.qtyDelivered) || 0)), 0)?.toLocaleString()} {t('tem')})
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditTripModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật Chuyến')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIGNATURE & PARTIAL DELIVERY QUANTITY MODAL */}
      {showSignatureModal && signingPo && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('XÁC NHẬN GIAO LẺ & KÝ NHẬN')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowSignatureModal(false)}>{t('Hủy')}</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '4px' }}>
                <div><strong>{t('Khách Hàng:')}</strong> {signingPo.customerName}</div>
                <div><strong>{t('Đơn PO Gốc:')}</strong> {signingPo.poCode}</div>
              </div>

              <h4 style={{ color: 'var(--color-primary)', fontSize: '13px', margin: '4px 0' }}>{t('Chi Tiết Số Lượng Bàn Giao:')}</h4>
              <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                <table style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>{t('Tên Hàng')}</th>
                      <th>{t('SL Đặt')}</th>
                      <th>{t('Đã Giao')}</th>
                      <th style={{ width: '100px' }}>{t('Giao Đợt Này')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signingPo.items?.map((item: any) => {
                      const itemId = item.itemId || item.productCode;
                      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
                      return (
                        <tr key={itemId}>
                          <td style={{ fontWeight: 500 }}>{item.productName}</td>
                          <td>{item.quantity?.toLocaleString()}</td>
                          <td>{(item.qtyDelivered || 0)?.toLocaleString()}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={deliveredQuantities[itemId] !== undefined ? deliveredQuantities[itemId] : remaining}
                              onChange={e => setDeliveredQuantities({
                                ...deliveredQuantities,
                                [itemId]: Math.max(0, Math.min(remaining, Number(e.target.value)))
                              })}
                              style={{ width: '80px', padding: '4px', fontSize: '12px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0', textAlign: 'center' }}>
                {t('Ký tên nhận hàng trực tuyến vào khung dưới đây để hoàn tất giao lẻ:')}
              </p>
              
              <canvas 
                ref={canvasRef}
                width="460" 
                height="180" 
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{ border: '2px solid var(--color-primary)', borderRadius: '4px', cursor: 'crosshair', backgroundColor: '#ffffff', touchAction: 'none' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={clearCanvas}>{t('Xóa Chữ Ký')}</button>
                <button type="button" className="btn btn-sm btn-success" onClick={saveSignature}>{t('Xác Nhận Giao Hàng')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
