import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { BarChart } from '../components/VisualCharts';

interface AccountingProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Accounting: React.FC<AccountingProps> = ({ pos, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'invoices' | 'costing'>('invoices');
  
  // Payment modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  
  // Custom manual cost adjustments for costing tab
  const [transportCosts, setTransportCosts] = useState<{ [poId: string]: number }>({});
  const [customCostModalPo, setCustomCostModalPo] = useState<any | null>(null);
  const [tempTransportCost, setTempTransportCost] = useState(0);

  const fetchAccountingData = async () => {
    const invList = await dbService.getCollection('invoices');
    const purList = await dbService.getCollection('purchase_orders');
    setInvoices(invList);
    setPurchaseOrders(purList);
  };

  useEffect(() => {
    fetchAccountingData();
  }, [pos]);

  // Handle invoice payment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const currentPaid = Number(selectedInvoice.paidAmount) || 0;
    const newPaid = currentPaid + Number(paymentAmount);
    const invoiceTotal = Number(selectedInvoice.amount);
    
    let status = 'partially_paid';
    if (newPaid >= invoiceTotal) {
      status = 'paid';
    }

    // Update in database
    await dbService.updateDocument('invoices', selectedInvoice.id, {
      paidAmount: newPaid,
      status: status
    });

    // If fully paid, optionally update PO status to debt_collected
    if (status === 'paid') {
      const linkedPo = pos.find(p => p.id === selectedInvoice.poId);
      if (linkedPo) {
        await dbService.updateDocument('pos', linkedPo.id, {
          status: 'debt_collected'
        });
        // Log history
        const logs = linkedPo.historyLogs || [];
        logs.push({
          status: 'debt_collected',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: t('Đã hoàn thành thu hồi công nợ hóa đơn')
        });
        await dbService.updateDocument('pos', linkedPo.id, { historyLogs: logs });
      }
    }

    setSelectedInvoice(null);
    setPaymentAmount(0);
    fetchAccountingData();
    onRefresh();
  };

  // Costing calculations for PO
  const calculateCosting = (po: any) => {
    const revenue = po.netAmount || po.totalAmount || 0;
    
    // Estimate Raw Material Cost from BOM:
    // Decal: 1.1 sqm per 10 sqm label, roughly 50,000 VND / sqm
    // Ink: 0.05 kg per 10,000 labels, roughly 120,000 VND / kg
    // Film: 1.05 sqm per 10 sqm, roughly 15,000 VND / sqm
    const quantity = po.items?.[0]?.quantity || 10000;
    const sizeStr = po.items?.[0]?.size || '100x100mm';
    
    // Calculate square meters
    let w = 100, h = 100;
    const parts = sizeStr.toLowerCase().replace('mm', '').split('x');
    if (parts.length === 2) {
      w = parseInt(parts[0]) || 100;
      h = parseInt(parts[1]) || 100;
    }
    const sqm = (w * h * quantity) / 1000000;
    
    const decalCost = sqm * 32000; // Average cost of paper decal
    const inkCost = (quantity / 1000) * 1500; // Ink cost
    const filmCost = po.items?.[0]?.material.includes('nhựa') ? sqm * 12000 : 0;
    const coreCost = Math.ceil(quantity / 5000) * 8000; // Core cost
    
    const materialCost = Math.round(decalCost + inkCost + filmCost + coreCost);
    const transportCost = transportCosts[po.id] || 350000; // Default or customized transport cost
    const totalCost = materialCost + transportCost;
    
    const grossProfit = revenue - totalCost;
    const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      revenue,
      materialCost,
      transportCost,
      totalCost,
      grossProfit,
      marginPercent
    };
  };

  const handleOpenCostModal = (po: any) => {
    setCustomCostModalPo(po);
    setTempTransportCost(transportCosts[po.id] || 350000);
  };

  const handleSaveCustomCost = () => {
    if (customCostModalPo) {
      setTransportCosts({
        ...transportCosts,
        [customCostModalPo.id]: Number(tempTransportCost)
      });
      setCustomCostModalPo(null);
    }
  };

  // CSV Export for Accountant
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Mã PO,Khách Hàng,Doanh Thu (đ),Chi Phí Vật Tư (đ),Vận Chuyển (đ),Tổng Chi Phí (đ),Lợi Nhuận (đ),Tỷ Suất Lãi Gộp (%)\n";
    
    pos.forEach(po => {
      const c = calculateCosting(po);
      csvContent += `${po.poCode},${po.customerName},${c.revenue},${c.materialCost},${c.transportCost},${c.totalCost},${c.grossProfit},${c.marginPercent.toFixed(1)}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_Lai_Gop_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printWorkOrder = (po: any) => {
    const c = calculateCosting(po);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${t('In Phiếu SX')} - ${po.poCode}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; line-height: 1.6; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 22px; font-weight: bold; color: #1e3a8a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .sig-box { width: 200px; height: 100px; border: 1px dashed #999; margin-top: 10px; text-align: center; line-height: 100px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">PHIẾU YÊU CẦU SẢN XUẤT VÀ TÍNH PHÍ</div>
            <div>Mã PO: ${po.poCode} | Ngày in: ${new Date().toLocaleDateString('vi-VN')}</div>
          </div>
          <div class="grid">
            <div>
              <strong>Khách Hàng:</strong> ${po.customerName}<br>
              <strong>Ngày Đặt PO:</strong> ${new Date(po.orderDate).toLocaleDateString('vi-VN')}<br>
              <strong>Ngày Giao Dự Kiến:</strong> ${new Date(po.expectedDeliveryDate).toLocaleDateString('vi-VN')}
            </div>
            <div>
              <strong>Trạng Thái Sản Xuất:</strong> ${po.status.toUpperCase()}<br>
              <strong>Ghi Chú Đơn Hàng:</strong> ${po.notes || 'Không có'}
            </div>
          </div>
          <h3>Thông số tem nhãn và định phí</h3>
          <table>
            <thead>
              <tr>
                <th>Tên sản phẩm</th>
                <th>Quy cách</th>
                <th>Vật liệu</th>
                <th>Số lượng đặt</th>
                <th>Ước tính Chi Phí</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${po.items?.[0]?.productName}</td>
                <td>${po.items?.[0]?.size}</td>
                <td>${po.items?.[0]?.material}</td>
                <td>${po.items?.[0]?.quantity.toLocaleString()} tem</td>
                <td>${c.totalCost.toLocaleString()} đ</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <div>
              <div>Đại Diện Bán Hàng</div>
              <div class="sig-box">Ký tên</div>
            </div>
            <div>
              <div>Quản Đốc Phân Xưởng</div>
              <div class="sig-box">Ký tên</div>
            </div>
            <div>
              <div>Kế Toán Trưởng</div>
              <div class="sig-box">Ký tên</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Compile costing profit margin percentage data for top 5 POs
  const profitMarginChartData = pos
    .map(po => {
      const calc = calculateCosting(po);
      return {
        label: po.poCode,
        value: Math.max(0, Math.round(calc.marginPercent))
      };
    })
    .slice(0, 5);

  return (
    <div className="accounting-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('KẾ TOÁN & CÔNG NỢ - LÃI GỘP')}</h1>
          <p className="page-subtitle">{t('Theo dõi công nợ phải thu (AR) / phải trả (AP), hóa đơn VAT, phân tích lãi gộp của từng PO thực tế.')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-container">
        <button 
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          {t('Công Nợ Phải Thu')} ({invoices.filter(i => i.type === 'receivable').length}) & Phải Trả ({invoices.filter(i => i.type === 'payable').length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'costing' ? 'active' : ''}`}
          onClick={() => setActiveTab('costing')}
        >
          {t('Báo Cáo Lãi Gộp Đơn Hàng')} ({pos.length})
        </button>
      </div>

      {/* TAB 1: INVOICES & AR/AP LEDGER */}
      {activeTab === 'invoices' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('Số Hóa Đơn')}</th>
                  <th>{t('Mã PO')}</th>
                  <th>{t('Khách Hàng')} / {t('Nhà Cung Cấp')}</th>
                  <th>{t('Loại')}</th>
                  <th>{t('Trị Giá')}</th>
                  <th>{t('Đã Thanh Toán')}</th>
                  <th>{t('Cần Thu')} / {t('Cần Trả')}</th>
                  <th>{t('Hạn Nợ')}</th>
                  <th>{t('Trạng Thái')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const linkedPo = pos.find(p => p.id === inv.poId);
                  const isReceivable = inv.type === 'receivable';
                  const balance = Number(inv.amount) - (Number(inv.paidAmount) || 0);
                  
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceCode}</td>
                      <td>{linkedPo ? linkedPo.poCode : 'N/A'}</td>
                      <td>
                        {isReceivable ? 
                          (linkedPo ? linkedPo.customerName : t('Khách Hàng')) : 
                          t('Nhà Cung Cấp Vật Tư')
                        }
                      </td>
                      <td>
                        <span className={`badge ${isReceivable ? 'badge-info' : 'badge-warning'}`}>
                          {isReceivable ? t('Công Nợ Phải Thu') : t('Công Nợ Phải Trả')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()} đ</td>
                      <td style={{ color: 'var(--color-success)' }}>{(inv.paidAmount || 0).toLocaleString()} đ</td>
                      <td style={{ color: balance > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                        {balance.toLocaleString()} đ
                      </td>
                      <td>{new Date(inv.dueDate).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`badge ${
                          inv.status === 'paid' ? 'badge-success' :
                          inv.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {inv.status === 'paid' ? t('Đã thanh toán') :
                           inv.status === 'partially_paid' ? t('Thanh toán 1 phần') : t('Quá Hạn')}
                        </span>
                      </td>
                      <td>
                        {balance > 0 ? (
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => { setSelectedInvoice(inv); setPaymentAmount(balance); }}
                          >
                            {isReceivable ? t('Thu Nợ') : t('Trả Tiền')}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>Xong</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>{t('Không có hóa đơn kế toán nào.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GROSS PROFIT COSTING ANALYTICS */}
      {activeTab === 'costing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Profit Margin Chart Section */}
          {profitMarginChartData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{t('Tỷ Suất Lãi Gộp (%) - Top 5 Đơn Hàng PO')}</span>
              </div>
              <BarChart data={profitMarginChartData} yAxisSuffix="%" height={220} />
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('Báo Cáo Lãi Gộp Đơn Hàng')}</span>
              <div className="btn-group">
                <button className="btn btn-primary" onClick={handleExportCSV}>{t('Xuất Excel Báo Cáo')}</button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã PO')}</th>
                    <th>{t('Khách Hàng')}</th>
                    <th>{t('Doanh Thu')}</th>
                    <th>{t('Chi Phí Nguyên Vật Liệu')}</th>
                    <th>{t('Chi Phí Khác (Vận chuyển/Ngoài)')}</th>
                    <th>{t('Lợi Nhuận Lãi Gộp')}</th>
                    <th>{t('Tỷ Suất Lãi Gộp (%)')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map(po => {
                    const c = calculateCosting(po);
                    const isEstimated = !['delivered', 'debt_collected'].includes(po.status);
                    
                    return (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                        <td>{po.customerName}</td>
                        <td style={{ fontWeight: 600 }}>{c.revenue.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{c.materialCost.toLocaleString()} đ</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{c.transportCost.toLocaleString()} đ</span>
                            <button 
                              className="btn btn-sm btn-outline" 
                              onClick={() => handleOpenCostModal(po)}
                              style={{ padding: '2px 6px', fontSize: '10.5px' }}
                            >
                              Sửa
                            </button>
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>{c.grossProfit.toLocaleString()} đ</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', color: c.marginPercent > 30 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                              {c.marginPercent.toFixed(1)}%
                            </span>
                            {isEstimated && (
                              <span style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                ({t('Chưa Giao Hàng (Lãi dự kiến)')})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline" onClick={() => printWorkOrder(po)}>{t('In Phiếu SX')}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PAYMENT RECORD MODAL */}
      {selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>{t('Thu / Chi Công Nợ Hóa Don')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedInvoice(null)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', fontSize: '13px' }}>
                  <strong>{t('Số Hóa Đơn')}:</strong> <span>{selectedInvoice.invoiceCode}</span>
                  <strong>{t('Loại')}:</strong> <span>{selectedInvoice.type === 'receivable' ? t('Thu Nợ từ Khách') : t('Chi Trả mua vật tư')}</span>
                  <strong>{t('Hạn nợ thanh toán:')}</strong> <span>{new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}</span>
                  <strong>{t('Trị Giá')}:</strong> <span style={{ fontWeight: 700 }}>{selectedInvoice.amount.toLocaleString()} đ</span>
                  <strong>{t('Đã Thanh Toán')}:</strong> <span style={{ color: 'var(--color-success)' }}>{(selectedInvoice.paidAmount || 0).toLocaleString()} đ</span>
                </div>
                
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: '10px 0' }} />
                
                <div className="form-group">
                  <label>{t('Số tiền thanh toán lần này *')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    max={Number(selectedInvoice.amount) - (Number(selectedInvoice.paidAmount) || 0)}
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(Number(e.target.value))} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>{t('Điều Khoản Thanh Toán')}</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="bank_transfer">{t('Chuyển khoản Ngân hàng')}</option>
                    <option value="cash">{t('Tiền mặt')}</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedInvoice(null)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Giao Dịch')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM TRANSPORT COST ADJUSTMENT MODAL */}
      {customCostModalPo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>CẬP NHẬT CHI PHÍ VẬN CHUYỂN / PHÁT SINH</span>
              <button className="btn btn-sm btn-outline" onClick={() => setCustomCostModalPo(null)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px' }}>Điều chỉnh chi phí vận chuyển hoặc thuê gia công ngoài cho đơn hàng: <strong>{customCostModalPo.poCode}</strong></p>
              <div className="form-group">
                <label>Chi phí vận chuyển & gia công phát sinh (đ)*</label>
                <input 
                  type="number" 
                  value={tempTransportCost} 
                  onChange={e => setTempTransportCost(Number(e.target.value))} 
                  required 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setCustomCostModalPo(null)}>{t('Hủy')}</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveCustomCost}>{t('Cập Nhật')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
