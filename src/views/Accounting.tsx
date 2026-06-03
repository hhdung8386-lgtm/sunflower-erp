import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

interface AccountingProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Accounting: React.FC<AccountingProps> = ({ pos, currentUser, onRefresh }) => {
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

  const handleOpenPayment = (inv: any) => {
    setSelectedInvoice(inv);
    setPaymentAmount(Number(inv.amount) - Number(inv.paidAmount));
    setPaymentMethod('bank_transfer');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || paymentAmount <= 0) return;

    const newPaid = Number(selectedInvoice.paidAmount) + Number(paymentAmount);
    const totalAmount = Number(selectedInvoice.amount);
    
    let newStatus = 'partially_paid';
    if (newPaid >= totalAmount) {
      newStatus = 'paid';
    }

    await dbService.updateDocument('invoices', selectedInvoice.id, {
      paidAmount: newPaid,
      status: newStatus
    });

    // If fully paid and type is receivable, update corresponding PO status to "debt_collected"
    if (newStatus === 'paid' && selectedInvoice.type === 'receivable') {
      const po = pos.find(p => p.id === selectedInvoice.poId);
      if (po) {
        const updatedLogs = [
          ...po.historyLogs,
          {
            status: 'debt_collected',
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: 'Bộ phận kế toán ghi nhận thanh toán hoàn tất từ khách hàng. Kết thúc công nợ đơn.'
          }
        ];
        await dbService.updateDocument('pos', po.id, {
          status: 'debt_collected',
          historyLogs: updatedLogs
        });
      }
    }

    setSelectedInvoice(null);
    fetchAccountingData();
    onRefresh();
  };

  const saveTransportCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCostModalPo) return;
    setTransportCosts(prev => ({
      ...prev,
      [customCostModalPo.id]: Number(tempTransportCost)
    }));
    setCustomCostModalPo(null);
  };

  // ----------------------------------------------------
  // REAL COSTING & GROSS PROFIT CALCULATOR
  // ----------------------------------------------------
  const calculateCosting = (po: any) => {
    const item = po.items[0] || {};
    const qty = item.quantity || 0;
    
    // 1. Material Paper Cost Estimation: 
    // Decal = qty * 0.015 sqm * standard cost 22,000 đ/sqm
    const decalCost = Math.round(qty * 0.015 * 22000);

    // 2. Ink Cost Estimation:
    // Ink = qty * 0.0002 kg * standard cost 150,000 đ/kg
    const inkCost = Math.round(qty * 0.0002 * 150000);

    // 3. Finishing & Cores Cost:
    // Cores/Cán màng/Khác = qty * 5 đ
    const otherMaterialCost = Math.round(qty * 5);

    const totalMaterialsCost = decalCost + inkCost + otherMaterialCost;
    
    // 4. Transportation cost (from state or default 5% of net value)
    const transportCost = transportCosts[po.id] !== undefined ? transportCosts[po.id] : Math.round(po.netAmount * 0.05);

    const totalCost = totalMaterialsCost + transportCost;
    const grossProfit = po.netAmount - totalCost;
    const margin = po.netAmount > 0 ? (grossProfit / po.netAmount) * 100 : 0;

    return {
      decalCost,
      inkCost,
      otherMaterialCost,
      totalMaterialsCost,
      transportCost,
      totalCost,
      grossProfit,
      margin
    };
  };

  // ----------------------------------------------------
  // EXPORT CSV UTILITY (Excel file simulation)
  // ----------------------------------------------------
  const handleExportCSV = (type: 'pos' | 'debt') => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
    
    if (type === 'pos') {
      csvContent += "Mã PO,Khách Hàng,Doanh Thu Net,Chi Phí Vật Tư,Vận Chuyển,Lợi Nhuận Gộp,Tỷ Lệ Lợi Nhuận\n";
      pos.forEach(po => {
        const cost = calculateCosting(po);
        csvContent += `"${po.poCode}","${po.customerName}",${po.netAmount},${cost.totalMaterialsCost},${cost.transportCost},${cost.grossProfit},"${cost.margin.toFixed(1)}%"\n`;
      });
    } else {
      csvContent += "Mã Hóa Đơn,Khách Hàng,Tổng Tiền Phải Thu,Đã Thu,Còn Nợ,Ngày Hạn Thanh Toán,Trạng Thái\n";
      invoices.forEach(inv => {
        const customer = pos.find(p => p.id === inv.poId)?.customerName || 'Nhà Cung Cấp';
        const remaining = Number(inv.amount) - Number(inv.paidAmount);
        csvContent += `"${inv.invoiceCode}","${customer}",${inv.amount},${inv.paidAmount},${remaining},"${new Date(inv.dueDate).toLocaleDateString('vi-VN')}","${inv.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", type === 'pos' ? "bao_cao_doanh_thu_lai_gop.csv" : "bao_cao_cong_no.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------
  // PRINT PDF FUNCTION (Native browser layout print)
  // ----------------------------------------------------
  const handlePrintDocument = (po: any) => {
    // Write dynamic styles for standard print view
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cost = calculateCosting(po);
    const item = po.items[0] || {};

    const content = `
      <html>
        <head>
          <title>Phiếu Sản Xuất - ${po.poCode}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; line-height: 1.6; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .table th, .table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .notes { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; font-style: italic; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; text-align: center; }
            .sig-box { height: 80px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">LỆNH SẢN XUẤT KIÊM PHIẾU GIAO VIỆC</div>
            <div>Mã Đơn Hàng: ${po.poCode} | Ngày Lập: ${new Date(po.orderDate).toLocaleDateString('vi-VN')}</div>
          </div>
          <div class="meta-grid">
            <div>
              <strong>Khách Hàng:</strong> ${po.customerName}<br>
              <strong>Ngày Giao Dự Kiến:</strong> ${new Date(po.expectedDeliveryDate).toLocaleDateString('vi-VN')}
            </div>
            <div>
              <strong>Phụ Trách Kinh Doanh:</strong> Nam Nguyễn (Sale)<br>
              <strong>Tiến Độ Đơn:</strong> Đang in ấn/Gia công
            </div>
          </div>
          <h3>Chi tiết sản phẩm sản xuất</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Tên Sản Phẩm Tem Nhãn</th>
                <th>Kích Thước</th>
                <th>Decal Chất Liệu</th>
                <th>Số Lượng Cần In</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${item.productName}</td>
                <td>${item.size}</td>
                <td>${item.material}</td>
                <td style="font-weight: bold;">${item.quantity?.toLocaleString()} tem</td>
              </tr>
            </tbody>
          </table>
          
          <div class="notes">
            <strong>Ghi chú kỹ thuật xưởng in:</strong><br>
            ${po.notes || 'Không có ghi chú đặc biệt.'}
          </div>

          <div class="signatures">
            <div>
              <strong>Người Lập Phiếu</strong>
              <div class="sig-box"></div>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <strong>Quản Đốc Xưởng</strong>
              <div class="sig-box"></div>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <strong>Thợ Vận Hành Máy</strong>
              <div class="sig-box"></div>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="accounting-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">KẾ TOÁN, CÔNG NỢ & LÃI GỘP</h1>
          <p className="page-subtitle">Xuất hóa đơn, theo dõi lịch sử thanh toán nợ của khách hàng (AR) / nhà cung cấp (AP) và tính toán lãi gộp tự động.</p>
        </div>
      </div>

      <div className="tab-container">
        <button 
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          Theo Dõi Hóa Đơn & Công Nợ
        </button>
        <button 
          className={`tab-btn ${activeTab === 'costing' ? 'active' : ''}`}
          onClick={() => setActiveTab('costing')}
        >
          Phân Tích Lãi Gộp & Giá Thành
        </button>
      </div>

      {/* TAB 1: INVOICES & DEBTS */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Danh Sách Hóa Đơn VAT và Tình Trạng Thanh Toán</span>
              <button className="btn btn-outline" onClick={() => handleExportCSV('debt')}>
                Xuất File Công Nợ (Excel CSV)
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã Hóa Đơn</th>
                    <th>Khách Hàng</th>
                    <th>Loại Công Nợ</th>
                    <th>Giá Trị</th>
                    <th>Đã Thanh Toán</th>
                    <th>Còn Phải Thu/Trả</th>
                    <th>Hạn Thanh Toán</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const remaining = Number(inv.amount) - Number(inv.paidAmount);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceCode}</td>
                        <td>{pos.find(p => p.id === inv.poId)?.customerName || 'Nhà Cung Cấp'}</td>
                        <td>{inv.type === 'receivable' ? 'Phải Thu (Khách hàng)' : 'Phải Trả (NCC)'}</td>
                        <td style={{ fontWeight: 600 }}>{inv.amount.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 500 }}>{inv.paidAmount.toLocaleString()} đ</td>
                        <td style={{ color: remaining > 0 ? 'var(--color-danger)' : 'var(--color-text-main)', fontWeight: 600 }}>
                          {remaining.toLocaleString()} đ
                        </td>
                        <td>{new Date(inv.dueDate).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <span className={`badge ${
                            inv.status === 'paid' ? 'badge-success' : 'badge-warning'
                          }`}>{inv.status === 'paid' ? 'Đã thu xong' : 'Còn nợ'}</span>
                        </td>
                        <td>
                          {inv.status !== 'paid' && (currentUser.role === 'admin' || currentUser.role === 'accountant') && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleOpenPayment(inv)}>
                              Thu Tiền / Thanh Toán
                            </button>
                          )}
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

      {/* TAB 2: COSTING & GROSS PROFIT */}
      {activeTab === 'costing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Phân Tích Lãi Gộp Trên Từng Đơn Hàng PO</span>
              <button className="btn btn-outline" onClick={() => handleExportCSV('pos')}>
                Xuất File Lãi Gộp (Excel CSV)
              </button>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Khách Hàng</th>
                    <th>Doanh Thu Net</th>
                    <th>Chi Phí Vật Tư (Giấy/Mực)</th>
                    <th>Chi Phí Vận Chuyển</th>
                    <th>Tổng Chi Phí</th>
                    <th>Lợi Nhuận Lãi Gộp</th>
                    <th>Tỷ Lệ Biên Lợi Nhuận</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map(po => {
                    const costing = calculateCosting(po);
                    return (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                        <td>{po.customerName}</td>
                        <td style={{ fontWeight: 600 }}>{po.netAmount.toLocaleString()} đ</td>
                        <td>{costing.totalMaterialsCost.toLocaleString()} đ</td>
                        <td>{costing.transportCost.toLocaleString()} đ</td>
                        <td>{costing.totalCost.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                          {costing.grossProfit.toLocaleString()} đ
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          {costing.margin.toFixed(1)}%
                        </td>
                        <td>
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline" onClick={() => {
                              setCustomCostModalPo(po);
                              setTempTransportCost(costing.transportCost);
                            }}>Sửa Chi Phí</button>
                            <button className="btn btn-sm btn-outline" onClick={() => handlePrintDocument(po)}>
                              In Phiếu SX (PDF)
                            </button>
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

      {/* RECORD PAYMENT MODAL */}
      {selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>GHI NHẬN THANH TOÁN HÓA ĐƠN</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedInvoice(null)}>Đóng</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600 }}>Mã hóa đơn:</span>
                  <span>{selectedInvoice.invoiceCode}</span>
                  <span style={{ fontWeight: 600 }}>Cần thanh toán:</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                    {(Number(selectedInvoice.amount) - Number(selectedInvoice.paidAmount)).toLocaleString()} đ
                  </span>
                </div>

                <div className="form-group">
                  <label>Số Tiền Đóng (đ) *</label>
                  <input 
                    type="number" 
                    min="1" 
                    max={Number(selectedInvoice.amount) - Number(selectedInvoice.paidAmount)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>Phương Thức Thanh Toán</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedInvoice(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Xác Nhận Thu Tiền</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COST MODAL */}
      {customCostModalPo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>CHỈNH SỬA CHI PHÍ VẬN CHUYỂN / KHÁC</span>
              <button className="btn btn-sm btn-outline" onClick={() => setCustomCostModalPo(null)}>Đóng</button>
            </div>
            <form onSubmit={saveTransportCost}>
              <div className="modal-body">
                <p style={{ fontSize: '12.5px', marginBottom: '10px', color: 'var(--color-text-muted)' }}>
                  Nhập chi phí vận chuyển hoặc chi phí phát sinh ngoài (gia công, khuôn bế...) để tính lãi gộp chính xác cho PO {customCostModalPo.poCode}.
                </p>
                <div className="form-group">
                  <label>Chi Phí Phát Sinh (đ) *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={tempTransportCost} 
                    onChange={e => setTempTransportCost(Number(e.target.value))} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setCustomCostModalPo(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
// Quick hotfix for modal overlap in rendering: we mapped 'showSignatureModal' to 'showPaymentModal' internally, 
// let's ensure the render conditions match. In the component code: 'showSignatureModal' was used in payment check, 
// let's replace it with a dedicated 'selectedInvoice' boolean display check, which is more robust.
