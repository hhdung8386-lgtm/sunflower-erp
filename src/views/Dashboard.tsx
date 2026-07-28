import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { BarChart, DonutChart } from '../components/VisualCharts';
import { ensureReceivableInvoice } from '../services/poWorkflowService';
import { calculatePOItemFinancials } from '../domain/poFinancials';
import { 
  ArrowLeft, Clock, Trash2, Plus, Check, CheckCircle, 
  AlertCircle, Calendar, User, DollarSign, Sliders, 
  BarChart2, PieChart, Bell, Eye, Pencil, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  getPOBadgeClass,
  getPOHistoryStatusLabel,
  getPOQueueLabel,
  getPOQueueStatus,
  getPOQueueUpdate,
  isPOCompleted,
  isPOInQueue,
  PO_QUEUE_STATES,
  POQueueStatus
} from '../domain/poWorkflow';

interface DashboardProps {
  user: UserProfile;
  pos: any[];
  customers: any[];
  inventory: any[];
  purchaseOrders: any[];
  productionCommands: any[];
  deliveries: any[];
  invoices: any[];
  onNavigate: (page: string) => void;
  onOpenPO: (poId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  pos,
  customers,
  inventory,
  purchaseOrders,
  productionCommands,
  deliveries,
  invoices,
  onNavigate,
  onOpenPO
}) => {
  const { t } = useLanguage();

  // Filter out deleted documents
  const activePOsList = (pos || []).filter(po => !po.deleted);
  const activeCustomersList = (customers || []).filter(c => !c.deleted);
  const activeInventoryList = (inventory || []).filter(i => !i.deleted);
  const activePurchaseOrdersList = (purchaseOrders || []).filter(pur => !pur.deleted);
  const activeProductionCommandsList = (productionCommands || []).filter(cmd => !cmd.deleted);
  const activeDeliveriesList = (deliveries || []).filter(d => !d.deleted);
  const activeInvoicesList = (invoices || []).filter(inv => !inv.deleted);

  // Timeframe states
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Drill-down sub-view state
  const [selectedProgressCategory, setSelectedProgressCategory] = useState<POQueueStatus | null>(null);
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reminders DB state
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');

  // Load reminders
  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const data = await dbService.getCollection('reminders');
        setReminders(data);
      } catch (err) {
        console.error("Error loading reminders:", err);
      }
    };
    fetchReminders();
  }, []);

  const matchesTimeframe = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    
    if (filterMode === 'range') {
      if (!startDate && !endDate) return true;
      const start = startDate ? new Date(startDate + 'T00:00:00') : new Date('1970-01-01');
      const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2100-01-01');
      return date >= start && date <= end;
    } else {
      const yearMatch = date.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'all' || (date.getMonth() + 1).toString() === selectedMonth;
      return yearMatch && monthMatch;
    }
  };

  const filteredPOs = activePOsList.filter(po => matchesTimeframe(po.orderDate || po.createdAt));
  const filteredInvoices = activeInvoicesList.filter(inv => matchesTimeframe(inv.createdAt || inv.date));
  const filteredPurchaseOrders = activePurchaseOrdersList.filter(pur => matchesTimeframe(pur.createdAt));
  const filteredProductionCommands = activeProductionCommandsList.filter(cmd => matchesTimeframe(cmd.startedAt || cmd.createdAt));
  const filteredDeliveries = activeDeliveriesList.filter(del => matchesTimeframe(del.deliveryDate || del.createdAt));

  // Calculations helper
  const activePOs = filteredPOs.filter(po => !isPOCompleted(po));
  
  // CSKH: Customers with lastOrderAt older than 30 days
  const today = new Date();
  const inactiveCustomers = activeCustomersList.filter(c => {
    if (!c.lastOrderAt) return true;
    const diffTime = Math.abs(today.getTime() - new Date(c.lastOrderAt).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  });

  // Financial calculations
  const totalRevenue = filteredInvoices
    .filter(inv => inv.type === 'receivable' && inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  
  const arDebt = filteredInvoices
    .filter(inv => inv.type === 'receivable' && inv.status !== 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) - Number(inv.paidAmount)), 0);

  const apDebt = filteredPurchaseOrders
    .filter(pur => pur.status !== 'received')
    .reduce((sum, pur) => sum + Number(pur.totalPrice), 0);

  // Warning for low stock materials
  const lowStockMaterials = activeInventoryList.filter(item => item.qtyInStock < item.minQtyAlert);

  // Category filters mapping for clicking
  const getCategoryPOs = (category: POQueueStatus) => filteredPOs.filter(po => isPOInQueue(po, category));

  const categoryLabels = Object.fromEntries(
    PO_QUEUE_STATES.map(state => [state.value, t(state.label)])
  ) as Record<POQueueStatus, string>;

  const poQueueChartData = PO_QUEUE_STATES
    .filter(state => state.value !== 'completed')
    .map(state => ({
      status: state.value,
      label: t(state.label),
      color: state.color,
      value: filteredPOs.filter(po => isPOInQueue(po, state.value)).length
    }));

  // Reminder managers
  const handleAddReminderSubmit = async (poId: string, poCode: string) => {
    if (!newReminderText.trim() || !newReminderDate) return;
    const newRem = {
      poId,
      poCode,
      message: newReminderText.trim(),
      date: newReminderDate,
      completed: false,
      createdBy: user.displayName,
      createdAt: new Date().toISOString()
    };
    try {
      const created = await dbService.addDocument('reminders', newRem);
      setReminders(prev => [...prev, created]);
      setNewReminderText('');
      setNewReminderDate('');
      alert(t('Đã thêm nhắc nhở thành công!'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReminder = async (remId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa nhắc nhở này?'))) {
      try {
        await dbService.deleteDocument('reminders', remId);
        setReminders(prev => prev.filter(r => r.id !== remId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleReminder = async (remId: string, completed: boolean) => {
    try {
      await dbService.updateDocument('reminders', remId, { completed });
      setReminders(prev => prev.map(r => r.id === remId ? { ...r, completed } : r));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (poId: string, status: POQueueStatus) => {
    try {
      const targetPo = pos.find(p => p.id === poId);
      if (!targetPo) return;
      
      const updatedLogs = [
        ...targetPo.historyLogs,
        {
          status,
          updatedBy: user.displayName,
          updatedAt: new Date().toISOString(),
          note: `Thay đổi hàng đợi từ Bảng Điều Khiển sang: ${getPOQueueLabel(status)}`
        }
      ];

      await dbService.updateDocument('pos', poId, {
        ...getPOQueueUpdate(status, status === 'waiting_delivery'
          ? { deliveryStage: targetPo.deliveryStage || 'customer_outbound' }
          : {}),
        updatedBy: `${user.displayName} (${user.role.toUpperCase()})`,
        updatedAt: new Date().toISOString(),
        historyLogs: updatedLogs
      });
      if (status === 'waiting_receivable') {
        await ensureReceivableInvoice(targetPo, `${user.displayName} (${user.role.toUpperCase()})`);
      }
      alert(t('Cập nhật trạng thái thành công!'));
    } catch (err) {
      console.error(err);
    }
  };

  // DRILL-DOWN SUB-VIEW RENDERING
  if (selectedProgressCategory) {
    const categoryPOs = getCategoryPOs(selectedProgressCategory);

    return (
      <div className="dashboard-view dashboard-po-drilldown" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">{t('CHI TIẾT TIẾN ĐỘ ĐƠN HÀNG')}</h1>
            <p className="page-subtitle">
              {t('Phân nhóm:')} <strong>{categoryLabels[selectedProgressCategory]}</strong> ({categoryPOs.length} {t('đơn hàng')})
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSelectedProgressCategory(null);
              setExpandedPoId(null);
            }}
            title={t('Quay lại Dashboard')}
          >
            <ArrowLeft size={16} />
            {t('Thoát bảng PO')}
          </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>{t('Mã PO')}</th>
                  <th>{t('Tên Khách Hàng')}</th>
                  <th>{t('Ngày Đặt')}</th>
                  <th>{t('Hạn Giao Hàng')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Tổng Tiền (gồm VAT)')}</th>
                  <th>{t('Trạng Thái Hiện Tại')}</th>
                  <th>{t('Người Phụ Trách')}</th>
                  <th>{t('Thao Tác')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryPOs.map(po => {
                  const isExpanded = expandedPoId === po.id;
                  const poReminders = reminders.filter(r => r.poId === po.id);
                  
                  return (
                    <React.Fragment key={po.id}>
                      <tr 
                        onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                        style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'var(--color-bg-light)' : 'transparent' }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>{po.poCode}</td>
                        <td>{po.customerName}</td>
                        <td>{po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : ''}</td>
                        <td>{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('vi-VN') : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{(po.netAmount || po.totalAmount || 0).toLocaleString()} đ</td>
                        <td>
                          <span className={`badge ${getPOBadgeClass(po)}`}>
                            {t(getPOQueueLabel(po))}
                          </span>
                        </td>
                        <td>{po.createdBy || t('Không rõ')}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenPO(po.id);
                            }}
                          >
                            {t('Mở PO')}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: '20px', backgroundColor: '#f8fafc', borderBottom: '2px solid var(--color-border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }} className="po-details-expand-grid">
                              {/* Left: Items list & Calculations */}
                              <div>
                                <h4 style={{ color: 'var(--color-primary-dark)', fontSize: '14px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Sliders size={16} />
                                  <span>{t('Danh Sách Sản Phẩm & Quy Cách')}</span>
                                </h4>

                                <div className="po-inline-grid-container" style={{ marginBottom: '14px' }}>
                                  <table className="po-inline-grid" style={{ minWidth: '1250px' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: '6px 8px' }}>STT</th>
                                        <th style={{ padding: '6px 8px' }}>Mã Hàng</th>
                                        <th style={{ padding: '6px 8px' }}>Tên Hàng</th>
                                        <th style={{ padding: '6px 8px' }}>Quy Cách / Chất Liệu</th>
                                        <th style={{ padding: '6px 8px' }}>ĐVT</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>SL</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Đơn Giá</th>
                                        <th style={{ padding: '6px 8px' }}>Nhà Cung Cấp</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Thuế (%)</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Chiết Khấu</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Thành Tiền (gồm VAT)</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>KPI PO</th>
                                        <th style={{ padding: '6px 8px' }}>File Liên Quan</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(po.items || []).map((item: any, idx: number) => {
                                        const financials = calculatePOItemFinancials(item);

                                        const images = item.previewImages || (item.previewImage ? [item.previewImage] : []);

                                        return (
                                          <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td style={{ fontWeight: 'bold' }}>{item.productCode}</td>
                                            <td>{item.productName}</td>
                                            <td>{item.size || '—'}<br /><small>{item.material || '—'}</small></td>
                                            <td>{item.unit || 'cái'}</td>
                                            <td style={{ textAlign: 'right' }}>{financials.quantity.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right' }}>{financials.unitPrice.toLocaleString()} đ</td>
                                            <td>{item.supplierName || 'Chưa chọn'}</td>
                                            <td style={{ textAlign: 'right' }}>{financials.vatRate}%</td>
                                            <td style={{ textAlign: 'right' }}>
                                              {financials.discountType === 'amount'
                                                ? `${Math.round(financials.discountAmount).toLocaleString()} đ`
                                                : `${financials.discountRate}%`}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary-dark)' }}>{Math.round(financials.amountWithVat).toLocaleString()} đ</td>
                                            <td style={{ textAlign: 'right' }}>{financials.kpiPo.toFixed(1)}%</td>
                                            <td>
                                              <div style={{ display: 'flex', gap: '4px' }}>
                                                {images.map((img: string, iIdx: number) => (
                                                  <img 
                                                    key={iIdx}
                                                    src={img} 
                                                    alt="layout" 
                                                    style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--color-border)' }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setPreviewImage(img);
                                                    }}
                                                  />
                                                ))}
                                                {images.length === 0 && <span style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('Chưa có')}</span>}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Quick transition status */}
                                {(user.role === 'admin' || user.role === 'sale' || user.role === 'producer') && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('Cập nhật nhanh trạng thái PO:')}</span>
                                    <select 
                                      value={getPOQueueStatus(po)}
                                      onChange={(e) => handleUpdateStatus(po.id, e.target.value as POQueueStatus)}
                                      style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    >
                                      {PO_QUEUE_STATES.map(state => (
                                        <option key={state.value} value={state.value}>{state.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              {/* Right: Vertical Timeline & Reminders */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* REMINDERS MANAGER */}
                                <div style={{ backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
                                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Bell size={14} />
                                    <span>{t('Lời Nhắc Nhở Đơn Hàng')} ({poReminders.length})</span>
                                  </h4>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
                                    {poReminders.map(rem => (
                                      <div key={rem.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderBottom: '1px solid #f1f5f9', fontSize: '12.5px' }}>
                                        <input 
                                          type="checkbox" 
                                          checked={rem.completed} 
                                          onChange={(e) => handleToggleReminder(rem.id, e.target.checked)}
                                        />
                                        <span style={{ 
                                          flex: 1, 
                                          textDecoration: rem.completed ? 'line-through' : 'none',
                                          color: rem.completed ? 'var(--color-text-muted)' : 'var(--color-text-main)'
                                        }}>
                                          {rem.message}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                          ({new Date(rem.date).toLocaleDateString('vi-VN')})
                                        </span>
                                        <button 
                                          type="button" 
                                          onClick={() => handleDeleteReminder(rem.id)}
                                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ))}
                                    {poReminders.length === 0 && (
                                      <span style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                                        {t('Chưa có lời nhắc nhở nào cho đơn này.')}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                      type="text" 
                                      placeholder={t('Nội dung nhắc...')}
                                      value={newReminderText}
                                      onChange={(e) => setNewReminderText(e.target.value)}
                                      style={{ flex: 1, padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                    />
                                    <input 
                                      type="date"
                                      value={newReminderDate}
                                      onChange={(e) => setNewReminderDate(e.target.value)}
                                      style={{ padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', width: '120px' }}
                                    />
                                    <button 
                                      type="button" 
                                      className="btn btn-sm btn-primary"
                                      onClick={() => handleAddReminderSubmit(po.id, po.poCode)}
                                      style={{ padding: '4px 10px' }}
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Compact queue timeline; legacy log labels remain readable. */}
                                <div style={{ backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px' }}>
                                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} />
                                    <span>{t('Nhật Ký & Timeline Tiến Độ')}</span>
                                  </h4>

                                  <div className="timeline" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                    {(po.historyLogs || []).map((log: any, lIdx: number) => (
                                      <div key={lIdx} className="timeline-item" style={{ paddingBottom: '10px' }}>
                                        <div className="timeline-marker" style={{ width: '8px', height: '8px', top: '4px' }}></div>
                                        <div className="timeline-content" style={{ marginLeft: '16px' }}>
                                          <span className="timeline-title" style={{ fontSize: '12px', fontWeight: 700 }}>
                                            {t(getPOHistoryStatusLabel(log.status))}
                                          </span>
                                          <span className="timeline-date" style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block' }}>
                                            {new Date(log.updatedAt).toLocaleString('vi-VN')} - {t('Nhân sự:')} {log.updatedBy}
                                          </span>
                                          {log.note && <span style={{ fontSize: '11.5px', display: 'block', color: 'var(--color-text-main)' }}>{log.note}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {categoryPOs.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                      {t('Không có đơn hàng PO nào thuộc nhóm tiến độ này.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LIGHTBOX LAYOUT ZOOM */}
        {previewImage && (
          <div 
            className="modal-overlay" 
            onClick={() => setPreviewImage(null)} 
            style={{ zIndex: 1300, background: 'rgba(0,0,0,0.8)' }}
          >
            <div 
              className="modal-content" 
              style={{ maxWidth: '90%', maxHeight: '90%', padding: '10px', position: 'relative', background: 'transparent', boxShadow: 'none' }} 
              onClick={e => e.stopPropagation()}
            >
              <button 
                type="button" 
                style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-10px', 
                  backgroundColor: 'white', 
                  color: 'black', 
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px', 
                  height: '28px', 
                  fontSize: '16px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} 
                onClick={() => setPreviewImage(null)}
              >
                ×
              </button>
              <img 
                src={previewImage} 
                alt="Layout Zoom" 
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '4px', border: '2px solid white' }} 
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // STANDARD DASHBOARD VIEW
  return (
    <div className="dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER SECTION */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">{t('BẢNG ĐIỀU KHIỂN TỔNG QUAN')}</h1>
          <p className="page-subtitle">{t('Xin chào,')} {user.displayName} | {t('Vai trò:')} {user.role.toUpperCase()}</p>
        </div>
        
        {/* TIME RANGE & DATE FILTERS */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#f1f5f9', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
          {/* Toggle filter mode */}
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden', marginRight: '6px' }}>
            <button 
              className={`btn btn-sm ${filterMode === 'month' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: 0, border: 'none' }}
              onClick={() => setFilterMode('month')}
            >
              {t('Theo Tháng')}
            </button>
            <button 
              className={`btn btn-sm ${filterMode === 'range' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: 0, border: 'none' }}
              onClick={() => setFilterMode('range')}
            >
              {t('Khoảng Ngày')}
            </button>
          </div>

          {filterMode === 'month' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12.5px', backgroundColor: '#fff' }}
                >
                  <option value="all">{t('Tất cả tháng')}</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={(i + 1).toString()}>{t('Tháng')} {i + 1}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12.5px', backgroundColor: '#fff' }}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12.5px' }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('đến')}</span>
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12.5px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ADMIN / GIÁM ĐỐC VIEW */}
      {user.role === 'admin' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card dashboard-metric-card dashboard-metric-card--revenue">
              <span className="metric-title">{t('DOANH THU ĐÃ THU')}</span>
              <span className="metric-value">{totalRevenue.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Từ các hóa đơn đã thanh toán')}</span>
            </div>
            <div className="metric-card dashboard-metric-card dashboard-metric-card--receivable">
              <span className="metric-title">{t('CÔNG NỢ PHẢI THU (AR)')}</span>
              <span className="metric-value">{arDebt.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Khách hàng chưa thanh toán hết')}</span>
            </div>
            <div className="metric-card dashboard-metric-card dashboard-metric-card--payable">
              <span className="metric-title">{t('CÔNG NỢ PHẢI TRẢ (AP)')}</span>
              <span className="metric-value">{apDebt.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Phải trả nhà cung cấp vật tư')}</span>
            </div>
            <div className="metric-card dashboard-metric-card dashboard-metric-card--active">
              <span className="metric-title">{t('ĐƠN ĐANG XỬ LÝ')}</span>
              <span className="metric-value">{activePOs.length} {t('đơn')}</span>
              <span className="metric-sub">{t('Tổng số PO chưa hoàn thành')}</span>
            </div>
          </div>

          {/* LSX Transfer Approvals Alert Card */}
          {activeProductionCommandsList.some(cmd => cmd.status === 'transfer_pending') && (
            <div className="card" style={{ border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)', margin: '0 0 20px 0' }}>
              <span className="card-title" style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
                {t('Có Yêu Cầu Phê Duyệt Bàn Giao Lệnh Sản Xuất')}
              </span>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                {t('Thợ máy đang báo gặp sự cố và yêu cầu chuyển giao lại lệnh in/bế cho thợ khác. Vui lòng phê duyệt.')}
              </p>
              <button 
                className="btn btn-outline" 
                onClick={() => onNavigate('production')}
                style={{ fontWeight: 600, color: 'var(--color-warning)', borderColor: 'var(--color-warning)', padding: '6px 12px', fontSize: '12.5px' }}
              >
                {t('XỬ LÝ NGAY TẠI TRANG SẢN XUẤT')} →
              </button>
            </div>
          )}

          {/* CHARTS CONTAINER + DYNAMIC INTERACTIVE CARDS */}
          <div className="charts-row-mobile" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%', marginBottom: '10px' }}>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <div className="card-header">
                <span className="card-title">{t('Cơ Cấu Doanh Thu & Công Nợ')}</span>
              </div>
              <BarChart 
                data={[
                  { label: t('Doanh Thu'), value: totalRevenue },
                  { label: t('Phải Thu (AR)'), value: arDebt },
                  { label: t('Phải Trả (AP)'), value: apDebt }
                ]} 
                yAxisSuffix=" đ" 
              />
            </div>

            <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <span className="card-title">{t('Hàng Đợi Xử Lý PO')}</span>
              </div>
              <div
                style={{ display: 'flex', gap: '18px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}
                className="po-donut-row-interactive"
              >
                <div className="po-queue-donut">
                  <DonutChart data={poQueueChartData} />
                </div>
                <div className="po-queue-actions">
                  {poQueueChartData.map(state => (
                    <button
                      key={state.status}
                      type="button"
                      onClick={() => setSelectedProgressCategory(state.status)}
                      className="po-progress-card-btn"
                      title={t('Click để xem danh sách đơn hàng chi tiết')}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${state.color}55`,
                        borderLeft: `4px solid ${state.color}`,
                        backgroundColor: '#ffffff',
                        color: '#1f2937',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        textAlign: 'left'
                      }}
                    >
                      <span>{t(state.label)}</span>
                      <strong style={{ color: state.color, fontSize: '17px' }}>{state.value}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="details-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">{t('Cần Chăm Sóc (Khách > 30 ngày chưa đặt đơn)')}</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('crm')}>{t('Xem chi tiết')}</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Tên Công Ty')}</th>
                      <th>{t('Người Liên Hệ')}</th>
                      <th>{t('Ngày Đặt Cuối')}</th>
                      <th>{t('Trạng Thái')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveCustomers.length > 0 ? (
                      inactiveCustomers.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.companyName}</td>
                          <td>{c.contactPerson}</td>
                          <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('vi-VN') : t('Chưa từng đặt')}</td>
                          <td>
                            <span className="badge badge-danger">{t('Khóa')} / {t('Lâu Chưa Đặt')}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>{t('Không có khách hàng nào quá hạn đặt hàng.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">{t('Đơn Hàng Sắp Giao Trong Tuần')}</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('delivery')}>{t('Xem chuyến đi')}</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Mã Chuyến')}</th>
                      <th>{t('Khu Vực')}</th>
                      <th>{t('Ngày Giao')}</th>
                      <th>{t('Trạng Trạng Thái')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.length > 0 ? (
                      filteredDeliveries.slice(0, 5).map(del => (
                        <tr key={del.id}>
                          <td style={{ fontWeight: 600 }}>{del.delCode}</td>
                          <td>{del.region}</td>
                          <td>{new Date(del.deliveryDate).toLocaleDateString('vi-VN')}</td>
                          <td>
                            <span className={`badge ${del.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                              {del.status === 'completed' ? t('Hoàn thành') : t('Đang lập kế hoạch')}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>{t('Không có lịch giao hàng sắp tới.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SALE VIEW */}
      {user.role === 'sale' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">{t('Tổng Đơn Của Tôi')}</span>
              <span className="metric-value">{filteredPOs.filter(po => po.saleId === user.uid).length} {t('đơn')}</span>
              <span className="metric-sub">{t('Doanh số phụ trách')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Chờ Khách Duyệt Màu')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {filteredPOs.filter(po => (
                  po.saleId === user.uid &&
                  isPOInQueue(po, 'waiting_design') &&
                  (po.designProgress === 'customer_approval_pending' || po.status === 'layout_pending')
                )).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Cần đôn đốc khách chốt')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Khách Hàng Của Tôi')}</span>
              <span className="metric-value">
                {activeCustomersList.filter(c => c.assignedSaleId === user.uid).length} {t('Khách')}
              </span>
              <span className="metric-sub">{t('Trong tệp chăm sóc')}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">{t('Theo Dõi Tiến Độ Đơn Hàng PO Gần Đây')}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Visual navigation category buttons */}
                <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_design')}>{t('Chờ thiết kế')}</button>
                <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_production')}>{t('Chờ sản xuất')}</button>
                <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_delivery')}>{t('Chờ giao')}</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onNavigate('sales')}>{t('Tạo đơn hàng mới')}</button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã PO')}</th>
                    <th>{t('Khách Hàng')}</th>
                    <th>{t('Ngày Đặt')}</th>
                    <th>{t('Trị Giá')}</th>
                    <th>{t('Tiến Độ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.filter(po => po.saleId === user.uid).slice(0, 8).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{po.customerName}</td>
                      <td>{new Date(po.orderDate).toLocaleDateString('vi-VN')}</td>
                      <td>{po.netAmount.toLocaleString()} đ</td>
                      <td>
                        <span className={`badge ${getPOBadgeClass(po)}`}>{t(getPOQueueLabel(po))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DESIGNER VIEW */}
      {user.role === 'designer' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Chờ Thiết Kế')}</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>
                {filteredPOs.filter(po => (
                  isPOInQueue(po, 'waiting_design') && !['customer_approval_pending', 'revision_requested'].includes(po.designProgress)
                )).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Yêu cầu thiết kế mới từ Sale')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Đang Gửi Duyệt')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {filteredPOs.filter(po => (
                  isPOInQueue(po, 'waiting_design') &&
                  (['customer_approval_pending', 'revision_requested'].includes(po.designProgress) || ['design_sent', 'layout_pending'].includes(po.status))
                )).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đang chờ khách duyệt layout/màu')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Thiết Kế Đã Duyệt Chốt')}</span>
              <span className="metric-value" style={{ color: 'var(--color-success)' }}>
                {filteredPOs.filter(po => !isPOInQueue(po, 'waiting_design')).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đã bàn giao để mua hàng/sản xuất')}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">{t('Nhiệm Vụ Thiết Kế Chờ Xử Lý')}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_design')}>{t('Đơn Chờ Thiết Kế')}</button>
                <button className="btn btn-sm btn-primary" onClick={() => onNavigate('design')}>{t('Vào trang thiết kế')}</button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã PO')}</th>
                    <th>{t('Sản Phẩm')}</th>
                    <th>{t('Quy Cách/Kích Thước')}</th>
                    <th>{t('Ghi Chú Yêu Cầu')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.filter(po => isPOInQueue(po, 'waiting_design')).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{po.items.map((i: any) => i.productName).join(', ')}</td>
                      <td>{po.items.map((i: any) => `${i.size} (${i.material})`).join(', ')}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{po.notes}</td>
                    </tr>
                  ))}
                  {filteredPOs.filter(po => isPOInQueue(po, 'waiting_design')).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>{t('Tất cả các đơn đã hoàn thành thiết kế!')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* PURCHASER VIEW */}
      {user.role === 'purchaser' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">{t('Vật Tư Cảnh Báo Sắp Thiếu')}</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>{lowStockMaterials.length} loại</span>
              <span className="metric-sub">{t('Dưới định mức tồn kho tối thiểu')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Mua Hàng Đã Gửi NCC')}</span>
              <span className="metric-value">
                {filteredPurchaseOrders.filter(pur => pur.status === 'ordered' || pur.status === 'confirmed').length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Chờ NCC giao hàng/xác nhận')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Mua Chờ Nhập Kho')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {filteredPurchaseOrders.filter(pur => pur.status === 'shipping').length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đang trên đường vận chuyển')}</span>
            </div>
          </div>

          <div className="details-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">{t('Cảnh Báo Tồn Kho Thấp')}</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('inventory')}>{t('Vào Kho')}</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Tên Vật Tư')}</th>
                      <th>{t('Hiện Có')}</th>
                      <th>{t('Ngưỡng Cảnh Báo')}</th>
                      <th>{t('Đơn Vị')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockMaterials.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.materialName}</td>
                        <td style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{item.qtyInStock}</td>
                        <td>{item.minQtyAlert}</td>
                        <td>{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">{t('Đơn Mua Hàng Gần Đây')}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_delivery')}>{t('Theo dõi hàng PO')}</button>
                  <button className="btn btn-sm btn-primary" onClick={() => onNavigate('purchase')}>{t('Mua Vật Tư')}</button>
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Mã Đơn Mua')}</th>
                      <th>{t('Nhà Cung Cấp')}</th>
                      <th>{t('Tổng Giá Trị')}</th>
                      <th>{t('Trạng Thái')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchaseOrders.slice(0, 5).map(pur => (
                      <tr key={pur.id}>
                        <td style={{ fontWeight: 600 }}>{pur.purCode}</td>
                        <td>{pur.supplierName}</td>
                        <td>{pur.totalPrice.toLocaleString()} đ</td>
                        <td>
                          <span className={`badge ${
                            pur.status === 'received' ? 'badge-success' : 'badge-warning'
                          }`}>{pur.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PRODUCER VIEW */}
      {user.role === 'producer' && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">{t('LSX Đang Sản Xuất')}</span>
              <span className="metric-value" style={{ color: 'var(--color-info)' }}>
                {filteredProductionCommands.filter(cmd => cmd.status === 'producing').length} lệnh
              </span>
              <span className="metric-sub">{t('Đang chạy trên các máy in')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Chờ Sản Xuất')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {filteredPOs.filter(po => isPOInQueue(po, 'waiting_production')).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đã duyệt layout, đủ vật tư')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('LSX Đã Hoàn Thành')}</span>
              <span className="metric-value">
                {filteredProductionCommands.filter(cmd => cmd.status === 'completed').length} lệnh
              </span>
              <span className="metric-sub">{t('Đã hoàn thành bàn giao QC')}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">{t('Tiến Độ Lệnh Sản Xuất Hiện Tại')}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-sm btn-outline" style={{ fontSize: '11px' }} onClick={() => setSelectedProgressCategory('waiting_production')}>{t('Theo dõi hàng PO')}</button>
                <button className="btn btn-sm btn-primary" onClick={() => onNavigate('production')}>{t('Vào Xưởng')}</button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã LSX')}</th>
                    <th>{t('Sản Phẩm')}</th>
                    <th>{t('Máy In')}</th>
                    <th>{t('Ca Làm')}</th>
                    <th>{t('SL Yêu Cầu')}</th>
                    <th>{t('Trạng Thái')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductionCommands.map(cmd => (
                    <tr key={cmd.id}>
                      <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                      <td>{cmd.productName}</td>
                      <td>{cmd.machineId}</td>
                      <td>{cmd.shift}</td>
                      <td>{cmd.qtyToProduce.toLocaleString()} tem</td>
                      <td>
                        <span className={`badge ${
                          cmd.status === 'completed' ? 'badge-success' : 'badge-info'
                        }`}>{cmd.status === 'completed' ? t('Xong') : t('Đang in')}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredProductionCommands.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '16px' }}>{t('Hiện tại không có lệnh sản xuất nào đang chạy.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
