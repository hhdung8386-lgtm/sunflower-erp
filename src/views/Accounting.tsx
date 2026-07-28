import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { BarChart } from '../components/VisualCharts';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { getPOQueueLabel, getPOQueueStatus, getPOQueueUpdate } from '../domain/poWorkflow';
import { sortNewestFirst } from '../domain/recordOrdering';

interface AccountingProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
  users: UserProfile[];
}

export const Accounting: React.FC<AccountingProps> = ({ pos, currentUser, onRefresh, users }) => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'invoices' | 'costing'>('invoices');
  
  // Dynamic collections
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Payment modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  
  // Cost modal states
  const [customCostModalPo, setCustomCostModalPo] = useState<any | null>(null);
  const [tempTransportCost, setTempTransportCost] = useState(0);
  const [tempLaborCost, setTempLaborCost] = useState(0);
  const [tempOtherCost, setTempOtherCost] = useState(0);

  // CRUD states
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);
  const [showDetailsInvoiceModal, setShowDetailsInvoiceModal] = useState(false);

  // Add form states
  const [addInvoiceCode, setAddInvoiceCode] = useState('');
  const [addPoId, setAddPoId] = useState('');
  const [addPartnerId, setAddPartnerId] = useState('');
  const [addPartnerName, setAddPartnerName] = useState('');
  const [addType, setAddType] = useState<'receivable' | 'payable'>('receivable');
  const [addAmount, setAddAmount] = useState(0);
  const [addPaidAmount, setAddPaidAmount] = useState(0);
  const [addDueDate, setAddDueDate] = useState('');

  // Edit form states
  const [editInvoiceCode, setEditInvoiceCode] = useState('');
  const [editPoId, setEditPoId] = useState('');
  const [editPartnerId, setEditPartnerId] = useState('');
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editType, setEditType] = useState<'receivable' | 'payable'>('receivable');
  const [editAmount, setEditAmount] = useState(0);
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editDueDate, setEditDueDate] = useState('');

  const [addAssignedAccountantId, setAddAssignedAccountantId] = useState('');
  const [editAssignedAccountantId, setEditAssignedAccountantId] = useState('');

  const accountants = (users || []).filter(u => u.role === 'accountant');
  const filteredInvoices = currentUser.role === 'admin'
    ? invoices
    : invoices.filter(inv => inv.assignedAccountantId === currentUser.uid || !inv.assignedAccountantId);

  const fetchAccountingData = async () => {
    const invList = await dbService.getCollection('invoices');
    const purList = await dbService.getCollection('purchase_orders');
    const custList = await dbService.getCollection('customers');
    const supList = await dbService.getCollection('suppliers');
    setInvoices(sortNewestFirst(invList, invoice => [invoice.createdAt]));
    setPurchaseOrders(sortNewestFirst(purList, purchaseOrder => [purchaseOrder.createdAt]));
    setCustomers(custList);
    setSuppliers(supList);
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
      status: status,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    // A fully paid receivable moves the customer PO to the discount-closing queue.
    if (status === 'paid') {
      const linkedPo = pos.find(p => p.id === selectedInvoice.poId);
      if (linkedPo && selectedInvoice.type === 'receivable') {
        const logs = [
          ...(linkedPo.historyLogs || []),
          {
            status: 'waiting_discount',
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: t('Đã hoàn thành thu hồi công nợ hóa đơn')
          }
        ];
        await dbService.updateDocument('pos', linkedPo.id, {
          ...getPOQueueUpdate('waiting_discount', { accountingProgress: 'paid' }),
          historyLogs: logs
        });
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
    const transportCost = po.transportCost !== undefined ? Number(po.transportCost) : 350000;
    const laborCost = Number(po.laborCost) || 0;
    const otherCost = Number(po.otherCost) || 0;
    
    const totalCost = materialCost + transportCost + laborCost + otherCost;
    const grossProfit = revenue - totalCost;
    const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      revenue,
      materialCost,
      transportCost,
      laborCost,
      otherCost,
      totalCost,
      grossProfit,
      marginPercent
    };
  };

  const handleOpenCostModal = (po: any) => {
    setCustomCostModalPo(po);
    setTempTransportCost(po.transportCost !== undefined ? Number(po.transportCost) : 350000);
    setTempLaborCost(Number(po.laborCost) || 0);
    setTempOtherCost(Number(po.otherCost) || 0);
  };

  const handleSaveCustomCost = async () => {
    if (customCostModalPo) {
      await dbService.updateDocument('pos', customCostModalPo.id, {
        transportCost: Number(tempTransportCost),
        laborCost: Number(tempLaborCost),
        otherCost: Number(tempOtherCost)
      });
      setCustomCostModalPo(null);
      fetchAccountingData();
      onRefresh();
    }
  };

  // CSV Export for Accountant
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Mã PO,Khách Hàng,Doanh Thu (đ),Chi Phí Vật Tư (đ),Nhân Công (đ),Vận Chuyển (đ),Chi Phí Khác (đ),Tổng Chi Phí (đ),Lợi Nhuận (đ),Tỷ Suất Lãi Gộp (%)\n";
    
    pos.forEach(po => {
      const c = calculateCosting(po);
      csvContent += `${po.poCode},${po.customerName},${c.revenue},${c.materialCost},${c.laborCost},${c.transportCost},${c.otherCost},${c.totalCost},${c.grossProfit},${c.marginPercent.toFixed(1)}%\n`;
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
              <strong>Hàng đợi xử lý:</strong> ${getPOQueueLabel(po)}<br>
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

  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvoiceCode || !addAmount) return;

    let partnerName = '';
    if (addType === 'receivable') {
      const c = customers.find(cust => cust.id === addPartnerId);
      partnerName = c?.companyName || addPartnerName || t('Khách Hàng');
    } else {
      const s = suppliers.find(sup => sup.id === addPartnerId);
      partnerName = s?.supplierName || addPartnerName || t('Nhà Cung Cấp');
    }

    const linkedPo = pos.find(p => p.id === addPoId);
    const finalAmount = Number(addAmount);
    const finalPaid = Number(addPaidAmount);
    const finalStatus = finalPaid >= finalAmount ? 'paid' : finalPaid > 0 ? 'partially_paid' : 'unpaid';

    const finalAccId = addAssignedAccountantId || (currentUser.role === 'accountant' ? currentUser.uid : '');
    const finalAccName = accountants.find(u => u.uid === finalAccId)?.displayName || (currentUser.role === 'accountant' ? currentUser.displayName : '');

    await dbService.addDocument('invoices', {
      invoiceCode: addInvoiceCode,
      poId: addPoId || '',
      poCode: linkedPo?.poCode || 'N/A',
      customerId: addPartnerId || '',
      companyName: partnerName,
      type: addType,
      amount: finalAmount,
      paidAmount: finalPaid,
      dueDate: new Date(addDueDate).toISOString(),
      status: finalStatus,
      assignedAccountantId: finalAccId,
      assignedAccountantName: finalAccName,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    });

    if (addType === 'receivable' && linkedPo) {
      const nextStatus = finalStatus === 'paid' ? 'waiting_discount' : 'waiting_receivable';
      await dbService.updateDocument('pos', linkedPo.id, {
        ...getPOQueueUpdate(nextStatus, {
          accountingProgress: finalStatus === 'paid' ? 'paid' : 'invoiced'
        }),
        historyLogs: [
          ...(linkedPo.historyLogs || []),
          {
            status: nextStatus,
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: `Đã ghi nhận hóa đơn ${addInvoiceCode}.`
          }
        ]
      });
    }

    setShowAddInvoiceModal(false);
    setAddInvoiceCode('');
    setAddPoId('');
    setAddPartnerId('');
    setAddPartnerName('');
    setAddAmount(0);
    setAddPaidAmount(0);
    setAddDueDate('');
    setAddAssignedAccountantId('');

    fetchAccountingData();
    onRefresh();
  };

  const handleOpenEditInvoice = (inv: any) => {
    setSelectedInvoice(inv);
    setEditInvoiceCode(inv.invoiceCode);
    setEditPoId(inv.poId || '');
    setEditPartnerId(inv.customerId || '');
    setEditPartnerName(inv.companyName || '');
    setEditType(inv.type);
    setEditAmount(inv.amount);
    setEditPaidAmount(inv.paidAmount || 0);
    setEditDueDate(new Date(inv.dueDate).toISOString().split('T')[0]);
    setEditAssignedAccountantId(inv.assignedAccountantId || '');
    setShowEditInvoiceModal(true);
  };

  const handleEditInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !editInvoiceCode) return;

    let partnerName = '';
    if (editType === 'receivable') {
      const c = customers.find(cust => cust.id === editPartnerId);
      partnerName = c?.companyName || editPartnerName || t('Khách Hàng');
    } else {
      const s = suppliers.find(sup => sup.id === editPartnerId);
      partnerName = s?.supplierName || editPartnerName || t('Nhà Cung Cấp');
    }

    const linkedPo = pos.find(p => p.id === editPoId);
    const finalPaid = Number(editPaidAmount);
    const finalAmount = Number(editAmount);
    const finalStatus = finalPaid >= finalAmount ? 'paid' : finalPaid > 0 ? 'partially_paid' : 'unpaid';

    const finalAccName = accountants.find(u => u.uid === editAssignedAccountantId)?.displayName || '';

    await dbService.updateDocument('invoices', selectedInvoice.id, {
      invoiceCode: editInvoiceCode,
      poId: editPoId,
      poCode: linkedPo?.poCode || 'N/A',
      customerId: editPartnerId,
      companyName: partnerName,
      type: editType,
      amount: finalAmount,
      paidAmount: finalPaid,
      dueDate: new Date(editDueDate).toISOString(),
      status: finalStatus,
      assignedAccountantId: editAssignedAccountantId,
      assignedAccountantName: finalAccName,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditInvoiceModal(false);
    setSelectedInvoice(null);
    setEditAssignedAccountantId('');
    fetchAccountingData();
    onRefresh();
  };

  const handleDeleteInvoice = async (invId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa hóa đơn này khỏi hệ thống?'))) {
      await dbService.deleteDocument('invoices', invId);
      setSelectedInvoice(null);
      fetchAccountingData();
      onRefresh();
    }
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
          {t('Công Nợ Phải Thu')} ({filteredInvoices.filter(i => i.type === 'receivable').length}) & Phải Trả ({filteredInvoices.filter(i => i.type === 'payable').length})
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
          {(currentUser.role === 'admin' || currentUser.role === 'accountant') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button className="btn btn-primary btn-symbol" onClick={() => {
                setAddDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                setShowAddInvoiceModal(true);
              }} title={t('Tạo Hóa Đơn Hàng Thủ Công')}>
                <Plus size={18} />
              </button>
            </div>
          )}
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
                {filteredInvoices.map(inv => {
                  const linkedPo = pos.find(p => p.id === inv.poId);
                  const isReceivable = inv.type === 'receivable';
                  const balance = Number(inv.amount) - (Number(inv.paidAmount) || 0);
                  
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceCode}</td>
                      <td>{linkedPo ? linkedPo.poCode : inv.poCode || 'N/A'}</td>
                      <td>{inv.companyName}</td>
                      <td>
                        <span className={`badge ${isReceivable ? 'badge-info' : 'badge-warning'}`}>
                          {isReceivable ? t('Công Nợ Phải Thu') : t('Công Nợ Phải Trả')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inv.amount?.toLocaleString()} đ</td>
                      <td style={{ color: 'var(--color-success)' }}>{(inv.paidAmount || 0).toLocaleString()} đ</td>
                      <td style={{ color: balance > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                        {balance?.toLocaleString()} đ
                      </td>
                      <td>{new Date(inv.dueDate).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`badge ${
                          inv.status === 'paid' ? 'badge-success' :
                          inv.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {inv.status === 'paid' ? t('Đã thanh toán') :
                           inv.status === 'partially_paid' ? t('Thanh toán 1 phần') : t('Chưa trả hết')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => { setSelectedInvoice(inv); setShowDetailsInvoiceModal(true); }}>{t('Chi Tiết')}</button>
                          {(currentUser.role === 'admin' || currentUser.role === 'accountant') && (
                            <>
                              <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditInvoice(inv)} title={t('Sửa')}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteInvoice(inv.id)} title={t('Xóa')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {balance > 0 && (
                            <button 
                              className="btn btn-sm btn-primary"
                              onClick={() => { setSelectedInvoice(inv); setPaymentAmount(balance); }}
                            >
                              {isReceivable ? t('Thu Nợ') : t('Trả Tiền')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>{t('Không có hóa đơn kế toán nào.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'costing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    <th>{t('Chi Phí NVL')}</th>
                    <th>{t('Nhân Công')}</th>
                    <th>{t('Vận Chuyển')}</th>
                    <th>{t('Chi Phí Khác')}</th>
                    <th>{t('Tổng Chi Phí')}</th>
                    <th>{t('Lãi Gộp')}</th>
                    <th>{t('Tỷ Suất (%)')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map(po => {
                    const c = calculateCosting(po);
                    const queueStatus = getPOQueueStatus(po);
                    const isEstimated = !['waiting_invoice', 'waiting_receivable', 'waiting_discount', 'completed'].includes(queueStatus);
                    
                    return (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                        <td>{po.customerName}</td>
                        <td style={{ fontWeight: 600 }}>{c.revenue?.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{c.materialCost?.toLocaleString()} đ</td>
                        <td>{c.laborCost?.toLocaleString()} đ</td>
                        <td>{c.transportCost?.toLocaleString()} đ</td>
                        <td>{c.otherCost?.toLocaleString()} đ</td>
                        <td style={{ fontWeight: 600 }}>{c.totalCost?.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 700 }}>{c.grossProfit?.toLocaleString()} đ</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', color: c.marginPercent > 30 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                              {c.marginPercent.toFixed(1)}%
                            </span>
                            {isEstimated && (
                              <span style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                ({t('Dự kiến')})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              className="btn btn-sm btn-outline btn-symbol-sm" 
                              onClick={() => handleOpenCostModal(po)}
                              title={t('Sửa Chi Phí')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => printWorkOrder(po)}>{t('In Phiếu')}</button>
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

      {/* MANUAL INVOICE CREATION MODAL */}
      {showAddInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Tạo Hóa Đơn Thủ Công')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddInvoiceModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddInvoiceSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Hóa Đơn')} *</label>
                    <input type="text" value={addInvoiceCode} onChange={e => setAddInvoiceCode(e.target.value)} placeholder="VD: VAT-Manual-102" required />
                  </div>
                  <div className="form-group">
                    <label>{t('Loại Hóa Đơn')} *</label>
                    <select value={addType} onChange={e => {
                      setAddType(e.target.value as any);
                      setAddPartnerId('');
                      setAddPartnerName('');
                    }}>
                      <option value="receivable">{t('Phải thu (AR)')}</option>
                      <option value="payable">{t('Phải trả (AP)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Chọn Đơn Hàng PO (nếu có)')}</label>
                    <select value={addPoId} onChange={e => setAddPoId(e.target.value)}>
                      <option value="">-- Không có --</option>
                      {pos.map(po => (
                        <option key={po.id} value={po.id}>{po.poCode} - {po.customerName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Hạn Nợ')} *</label>
                    <input type="date" value={addDueDate} onChange={e => setAddDueDate(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>{addType === 'receivable' ? t('Chọn Khách Hàng *') : t('Chọn Nhà Cung Cấp *')}</label>
                  <select value={addPartnerId} onChange={e => setAddPartnerId(e.target.value)}>
                    <option value="">-- Nhập thủ công phía dưới --</option>
                    {addType === 'receivable' ? 
                      customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>) :
                      suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)
                    }
                  </select>
                </div>

                {!addPartnerId && (
                  <div className="form-group">
                    <label>{t('Tên Đối Tác Nhập Thủ Công')}</label>
                    <input type="text" value={addPartnerName} onChange={e => setAddPartnerName(e.target.value)} placeholder="VD: Công ty TNHH ABC" />
                  </div>
                )}

                {currentUser.role === 'admin' && (
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Kế toán phụ trách')}</label>
                    <select value={addAssignedAccountantId} onChange={e => setAddAssignedAccountantId(e.target.value)}>
                      <option value="">-- {t('Chưa phân công')} --</option>
                      {accountants.map(acc => (
                        <option key={acc.uid} value={acc.uid}>{acc.displayName} ({acc.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Trị Giá Hóa Đơn (đ)')} *</label>
                    <input type="number" min="0" value={addAmount} onChange={e => setAddAmount(Number(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Đã Thanh Toán (đ)')}</label>
                    <input type="number" min="0" value={addPaidAmount} onChange={e => setAddPaidAmount(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddInvoiceModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVOICE MODAL */}
      {showEditInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Chỉnh Sửa Hóa Đơn')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditInvoiceModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditInvoiceSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Hóa Đơn')} *</label>
                    <input type="text" value={editInvoiceCode} onChange={e => setEditInvoiceCode(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Loại Hóa Đơn')} *</label>
                    <select value={editType} onChange={e => {
                      setEditType(e.target.value as any);
                      setEditPartnerId('');
                    }}>
                      <option value="receivable">{t('Phải thu (AR)')}</option>
                      <option value="payable">{t('Phải trả (AP)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Chọn Đơn Hàng PO')}</label>
                    <select value={editPoId} onChange={e => setEditPoId(e.target.value)}>
                      <option value="">-- Không có --</option>
                      {pos.map(po => (
                        <option key={po.id} value={po.id}>{po.poCode} - {po.customerName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Hạn Nợ')} *</label>
                    <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>{editType === 'receivable' ? t('Chọn Khách Hàng') : t('Chọn Nhà Cung Cấp')}</label>
                  <select value={editPartnerId} onChange={e => setEditPartnerId(e.target.value)}>
                    <option value="">-- Nhập thủ công phía dưới --</option>
                    {editType === 'receivable' ? 
                      customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>) :
                      suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)
                    }
                  </select>
                </div>

                {!editPartnerId && (
                  <div className="form-group">
                    <label>{t('Tên Đối Tác Nhập Thủ Công')}</label>
                    <input type="text" value={editPartnerName} onChange={e => setEditPartnerName(e.target.value)} />
                  </div>
                )}

                {currentUser.role === 'admin' && (
                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label>{t('Kế toán phụ trách')}</label>
                    <select value={editAssignedAccountantId} onChange={e => setEditAssignedAccountantId(e.target.value)}>
                      <option value="">-- {t('Chưa phân công')} --</option>
                      {accountants.map(acc => (
                        <option key={acc.uid} value={acc.uid}>{acc.displayName} ({acc.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Trị Giá Hóa Đơn (đ)')} *</label>
                    <input type="number" min="0" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Đã Thanh Toán (đ)')}</label>
                    <input type="number" min="0" value={editPaidAmount} onChange={e => setEditPaidAmount(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditInvoiceModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE DETAILS MODAL */}
      {showDetailsInvoiceModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHI TIẾT HÓA ĐƠN')}: {selectedInvoice.invoiceCode}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowDetailsInvoiceModal(false)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{t('Số Hóa Đơn')}:</span>
                <span>{selectedInvoice.invoiceCode}</span>
                <span style={{ fontWeight: 600 }}>{t('Mã PO')}:</span>
                <span>{selectedInvoice.poCode || 'N/A'}</span>
                <span style={{ fontWeight: 600 }}>{t('Đối Tác')}:</span>
                <span>{selectedInvoice.companyName}</span>
                <span style={{ fontWeight: 600 }}>{t('Loại')}:</span>
                <span>{selectedInvoice.type === 'receivable' ? t('Công Nợ Phải Thu') : t('Công Nợ Phải Trả')}</span>
                <span style={{ fontWeight: 600 }}>{t('Trị Giá')}:</span>
                <span style={{ fontWeight: 700 }}>{selectedInvoice.amount?.toLocaleString()} đ</span>
                <span style={{ fontWeight: 600 }}>{t('Đã Thanh Toán')}:</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{(selectedInvoice.paidAmount || 0).toLocaleString()} đ</span>
                <span style={{ fontWeight: 600 }}>{t('Cần Thu / Cần Trả')}:</span>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{(selectedInvoice.amount - (selectedInvoice.paidAmount || 0)).toLocaleString()} đ</span>
                <span style={{ fontWeight: 600 }}>{t('Hạn Nợ')}:</span>
                <span>{new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}</span>
                <span style={{ fontWeight: 600 }}>{t('Trạng Thái')}:</span>
                <span>{t(selectedInvoice.status.toUpperCase())}</span>
                <span style={{ fontWeight: 600 }}>{t('Kế toán phụ trách')}:</span>
                <span>{selectedInvoice.assignedAccountantName || t('Chưa phân công')}</span>
              </div>
              
              {/* Audit trail */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <div>{t('Tạo bởi:')} {selectedInvoice.createdBy || t('Không xác định')} {selectedInvoice.createdAt && `(${new Date(selectedInvoice.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                {selectedInvoice.updatedBy && (
                  <div>{t('Cập nhật bởi:')} {selectedInvoice.updatedBy} ({new Date(selectedInvoice.updatedAt).toLocaleString(t('vi-VN'))})</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {(currentUser.role === 'admin' || currentUser.role === 'accountant') && (
                <button className="btn btn-primary btn-symbol" onClick={() => { setShowDetailsInvoiceModal(false); handleOpenEditInvoice(selectedInvoice); }} title={t('Sửa')}>
                  <Pencil size={16} />
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowDetailsInvoiceModal(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PAYMENT RECORD MODAL */}
      {selectedInvoice && !showEditInvoiceModal && !showDetailsInvoiceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>{t('Thu / Chi Công Nợ Hóa Đơn')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedInvoice(null)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', fontSize: '13px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '4px' }}>
                  <strong>{t('Số Hóa Đơn')}:</strong> <span>{selectedInvoice.invoiceCode}</span>
                  <strong>{t('Loại')}:</strong> <span>{selectedInvoice.type === 'receivable' ? t('Thu Nợ từ Khách') : t('Chi Trả mua vật tư')}</span>
                  <strong>{t('Hạn nợ thanh toán:')}</strong> <span>{new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN')}</span>
                  <strong>{t('Trị Giá')}:</strong> <span style={{ fontWeight: 700 }}>{selectedInvoice.amount?.toLocaleString()} đ</span>
                  <strong>{t('Đã Thanh Toán')}:</strong> <span style={{ color: 'var(--color-success)' }}>{(selectedInvoice.paidAmount || 0).toLocaleString()} đ</span>
                </div>
                
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

      {/* CUSTOM GROSS PROFIT COST ADJUSTMENT MODAL */}
      {customCostModalPo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>CẬP NHẬT CHI PHÍ SẢN XUẤT ĐƠN HÀNG</span>
              <button className="btn btn-sm btn-outline" onClick={() => setCustomCostModalPo(null)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px' }}>Điều chỉnh các cấu thành chi phí thực tế cho PO: <strong>{customCostModalPo.poCode}</strong></p>
              <div className="form-group">
                <label>Chi phí vận chuyển thực tế (đ) *</label>
                <input 
                  type="number" 
                  value={tempTransportCost} 
                  onChange={e => setTempTransportCost(Number(e.target.value))} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Chi phí nhân công sản xuất (đ) *</label>
                <input 
                  type="number" 
                  value={tempLaborCost} 
                  onChange={e => setTempLaborCost(Number(e.target.value))} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Chi phí khác phát sinh (đ) *</label>
                <input 
                  type="number" 
                  value={tempOtherCost} 
                  onChange={e => setTempOtherCost(Number(e.target.value))} 
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
