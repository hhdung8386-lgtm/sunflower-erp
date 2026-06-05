import React from 'react';
import { UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { BarChart, DonutChart } from '../components/VisualCharts';

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
  onNavigate
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
  const [selectedMonth, setSelectedMonth] = React.useState<string>('all');
  const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());

  const matchesTimeframe = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    
    const yearMatch = date.getFullYear().toString() === selectedYear;
    const monthMatch = selectedMonth === 'all' || (date.getMonth() + 1).toString() === selectedMonth;
    
    return yearMatch && monthMatch;
  };

  const filteredPOs = activePOsList.filter(po => matchesTimeframe(po.orderDate || po.createdAt));
  const filteredInvoices = activeInvoicesList.filter(inv => matchesTimeframe(inv.createdAt || inv.date));
  const filteredPurchaseOrders = activePurchaseOrdersList.filter(pur => matchesTimeframe(pur.createdAt));
  const filteredProductionCommands = activeProductionCommandsList.filter(cmd => matchesTimeframe(cmd.startedAt || cmd.createdAt));
  const filteredDeliveries = activeDeliveriesList.filter(del => matchesTimeframe(del.deliveryDate || del.createdAt));

  // Calculations helper
  const activePOs = filteredPOs.filter(po => !['delivered', 'debt_collected', 'discounted'].includes(po.status));
  const newPOs = filteredPOs.filter(po => po.status === 'receive_po');
  const producingPOs = filteredPOs.filter(po => po.status === 'producing');
  const pendingApprovalPOs = filteredPOs.filter(po => po.status === 'layout_pending' || po.status === 'design_sent');
  
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

  return (
    <div className="dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">{t('BẢNG ĐIỀU KHIỂN TỔNG QUAN')}</h1>
          <p className="page-subtitle">{t('Xin chào,')} {user.displayName} | {t('Vai trò:')} {user.role.toUpperCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tháng')}</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="all">{t('Tất cả tháng')}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={(i + 1).toString()}>{t('Tháng')} {i + 1}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Năm')}</label>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '13px', backgroundColor: '#fff' }}
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>
      </div>

      {/* ADMIN / GIÁM ĐỐC VIEW */}
      {(user.role === 'admin') && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">{t('DOANH THU ĐÃ THU')}</span>
              <span className="metric-value">{totalRevenue.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Từ các hóa đơn đã thanh toán')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('CÔNG NỢ PHẢI THU (AR)')}</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>{arDebt.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Khách hàng chưa thanh toán hết')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('CÔNG NỢ PHẢI TRẢ (AP)')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>{apDebt.toLocaleString()} đ</span>
              <span className="metric-sub">{t('Phải trả nhà cung cấp vật tư')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('ĐƠN ĐANG XỬ LÝ')}</span>
              <span className="metric-value">{activePOs.length} {t('đơn')}</span>
              <span className="metric-sub">{t('Tổng số PO chưa hoàn thành')}</span>
            </div>
          </div>

          {/* LSX Transfer Approvals Alert Card */}
          {activeProductionCommandsList.some(cmd => cmd.status === 'transfer_pending') && (
            <div className="card" style={{ border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)', margin: '0 0 20px 0' }}>
              <span className="card-title" style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
                ⏳ {t('Có Yêu Cầu Phê Duyệt Bàn Giao Lệnh Sản Xuất')}
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

          {/* Visual Charts Container (Bar and Donut) */}
          <div className="charts-row-mobile" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
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
            <div className="card" style={{ flex: '1 1 300px' }}>
              <div className="card-header">
                <span className="card-title">{t('Tiến Độ Các Đơn Hàng PO Hiện Tại')}</span>
              </div>
              <DonutChart 
                data={[
                  { label: t('Mới Nhận PO'), value: filteredPOs.filter(p => p.status === 'receive_po').length, color: '#94a3b8' },
                  { label: t('Đang Thiết Kế'), value: filteredPOs.filter(p => ['design_sent', 'layout_pending'].includes(p.status)).length, color: '#f59e0b' },
                  { label: t('Đang Sản Xuất'), value: filteredPOs.filter(p => ['production_pending', 'producing'].includes(p.status)).length, color: '#3b82f6' },
                  { label: t('Đã Giao Hàng'), value: filteredPOs.filter(p => ['delivered', 'debt_collected'].includes(p.status)).length, color: '#10b981' }
                ]} 
              />
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
                {filteredPOs.filter(po => po.saleId === user.uid && po.status === 'layout_pending').length} {t('đơn')}
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
            <div className="card-header">
              <span className="card-title">{t('Theo Dõi Đơn Hàng Mới Nhất')}</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('sales')}>{t('Tạo đơn hàng mới')}</button>
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
                  {filteredPOs.filter(po => po.saleId === user.uid).slice(0, 5).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{po.customerName}</td>
                      <td>{new Date(po.orderDate).toLocaleDateString('vi-VN')}</td>
                      <td>{po.netAmount.toLocaleString()} đ</td>
                      <td>
                        <span className={`badge ${
                          po.status === 'delivered' || po.status === 'debt_collected' ? 'badge-success' :
                          po.status === 'producing' ? 'badge-info' : 'badge-warning'
                        }`}>{po.status.replace('_', ' ').toUpperCase()}</span>
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
                {filteredPOs.filter(po => po.status === 'receive_po').length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Yêu cầu thiết kế mới từ Sale')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Đơn Đang Gửi Duyệt')}</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {filteredPOs.filter(po => po.status === 'design_sent' || po.status === 'layout_pending').length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đang chờ khách duyệt layout/màu')}</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">{t('Thiết Kế Đã Duyệt Chốt')}</span>
              <span className="metric-value" style={{ color: 'var(--color-success)' }}>
                {filteredPOs.filter(po => !['receive_po', 'design_sent', 'layout_pending'].includes(po.status)).length} {t('đơn')}
              </span>
              <span className="metric-sub">{t('Đã bàn giao để mua hàng/sản xuất')}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('Nhiệm Vụ Thiết Kế Chờ Xử Lý')}</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('design')}>{t('Vào trang thiết kế')}</button>
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
                  {filteredPOs.filter(po => po.status === 'receive_po').map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{po.items.map((i: any) => i.productName).join(', ')}</td>
                      <td>{po.items.map((i: any) => `${i.size} (${i.material})`).join(', ')}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{po.notes}</td>
                    </tr>
                  ))}
                  {filteredPOs.filter(po => po.status === 'receive_po').length === 0 && (
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
              <div className="card-header">
                <span className="card-title">{t('Đơn Mua Hàng Gần Đây')}</span>
                <button className="btn btn-sm btn-primary" onClick={() => onNavigate('purchase')}>{t('Mua Vật Tư')}</button>
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
                {filteredPOs.filter(po => po.status === 'production_pending').length} {t('đơn')}
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
            <div className="card-header">
              <span className="card-title">{t('Tiến Độ Lệnh Sản Xuất Hiện Tại')}</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('production')}>{t('Vào Xưởng')}</button>
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
