import React from 'react';
import { UserProfile } from '../services/firebaseService';

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
  // Calculations helper
  const activePOs = pos.filter(po => !['delivered', 'debt_collected', 'discounted'].includes(po.status));
  const newPOs = pos.filter(po => po.status === 'receive_po');
  const producingPOs = pos.filter(po => po.status === 'producing');
  const pendingApprovalPOs = pos.filter(po => po.status === 'layout_pending' || po.status === 'design_sent');
  
  // CSKH: Customers with lastOrderAt older than 30 days
  const today = new Date();
  const inactiveCustomers = customers.filter(c => {
    if (!c.lastOrderAt) return true;
    const diffTime = Math.abs(today.getTime() - new Date(c.lastOrderAt).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
  });

  // Financial calculations
  const totalRevenue = invoices
    .filter(inv => inv.type === 'receivable' && inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  
  const arDebt = invoices
    .filter(inv => inv.type === 'receivable' && inv.status !== 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) - Number(inv.paidAmount)), 0);

  const apDebt = purchaseOrders
    .filter(pur => pur.status !== 'received')
    .reduce((sum, pur) => sum + Number(pur.totalPrice), 0);

  // Warning for low stock materials
  const lowStockMaterials = inventory.filter(item => item.qtyInStock < item.minQtyAlert);

  return (
    <div className="dashboard-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">BẢNG ĐIỀU KHIỂN TỔNG QUAN</h1>
          <p className="page-subtitle">Xin chào, {user.displayName} | Vai trò: {user.role.toUpperCase()}</p>
        </div>
      </div>

      {/* ADMIN / GIÁM ĐỐC VIEW */}
      {(user.role === 'admin') && (
        <>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-title">Doanh Thu Đã Thu</span>
              <span className="metric-value">{totalRevenue.toLocaleString()} đ</span>
              <span className="metric-sub">Từ các hóa đơn đã thanh toán</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Công Nợ Phải Thu (AR)</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>{arDebt.toLocaleString()} đ</span>
              <span className="metric-sub">Khách hàng chưa thanh toán hết</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Công Nợ Phải Trả (AP)</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>{apDebt.toLocaleString()} đ</span>
              <span className="metric-sub">Phải trả nhà cung cấp vật tư</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Đang Xử Lý</span>
              <span className="metric-value">{activePOs.length} đơn</span>
              <span className="metric-sub">Tổng số PO chưa hoàn thành</span>
            </div>
          </div>

          <div className="details-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Cần Chăm Sóc (Khách &gt; 30 ngày chưa đặt đơn)</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('crm')}>Xem chi tiết</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tên Công Ty</th>
                      <th>Người Liên Hệ</th>
                      <th>Ngày Đặt Cuối</th>
                      <th>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveCustomers.length > 0 ? (
                      inactiveCustomers.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.companyName}</td>
                          <td>{c.contactPerson}</td>
                          <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('vi-VN') : 'Chưa từng đặt'}</td>
                          <td>
                            <span className="badge badge-danger">Lâu Chưa Đặt</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>Không có khách hàng nào quá hạn đặt hàng.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Đơn Hàng Sắp Giao Trong Tuần</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('delivery')}>Xem chuyến đi</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mã Chuyến</th>
                      <th>Khu Vực</th>
                      <th>Ngày Giao</th>
                      <th>Trạng Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.length > 0 ? (
                      deliveries.slice(0, 5).map(del => (
                        <tr key={del.id}>
                          <td style={{ fontWeight: 600 }}>{del.delCode}</td>
                          <td>{del.region}</td>
                          <td>{new Date(del.deliveryDate).toLocaleDateString('vi-VN')}</td>
                          <td>
                            <span className={`badge ${del.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                              {del.status === 'completed' ? 'Hoàn thành' : 'Đang lập kế hoạch'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>Không có lịch giao hàng sắp tới.</td>
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
              <span className="metric-title">Tổng Đơn Của Tôi</span>
              <span className="metric-value">{pos.filter(po => po.saleId === user.uid).length} đơn</span>
              <span className="metric-sub">Doanh số phụ trách</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Chờ Khách Duyệt Màu</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {pos.filter(po => po.saleId === user.uid && po.status === 'layout_pending').length} đơn
              </span>
              <span className="metric-sub">Cần đôn đốc khách chốt</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Khách Hàng Của Tôi</span>
              <span className="metric-value">
                {customers.filter(c => c.assignedSaleId === user.uid).length} khách
              </span>
              <span className="metric-sub">Trong tệp chăm sóc</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Theo Dõi Đơn Hàng Mới Nhất</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('sales')}>Tạo đơn hàng mới</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Khách Hàng</th>
                    <th>Ngày Nhận</th>
                    <th>Trị Giá</th>
                    <th>Tiến Độ</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.filter(po => po.saleId === user.uid).slice(0, 5).map(po => (
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
              <span className="metric-title">Đơn Chờ Thiết Kế</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>
                {pos.filter(po => po.status === 'receive_po').length} đơn
              </span>
              <span className="metric-sub">Yêu cầu thiết kế mới từ Sale</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Đang Gửi Duyệt</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {pos.filter(po => po.status === 'design_sent' || po.status === 'layout_pending').length} đơn
              </span>
              <span className="metric-sub">Đang chờ khách duyệt layout/màu</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Thiết Kế Đã Duyệt Chốt</span>
              <span className="metric-value" style={{ color: 'var(--color-success)' }}>
                {pos.filter(po => !['receive_po', 'design_sent', 'layout_pending'].includes(po.status)).length} đơn
              </span>
              <span className="metric-sub">Đã bàn giao để mua hàng/sản xuất</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Nhiệm Vụ Thiết Kế Chờ Xử Lý</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('design')}>Vào trang thiết kế</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Sản Phẩm</th>
                    <th>Quy Cách/Kích Thước</th>
                    <th>Ghi Chú Yêu Cầu</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.filter(po => po.status === 'receive_po').map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{po.items.map((i: any) => i.productName).join(', ')}</td>
                      <td>{po.items.map((i: any) => `${i.size} (${i.material})`).join(', ')}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{po.notes}</td>
                    </tr>
                  ))}
                  {pos.filter(po => po.status === 'receive_po').length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>Tất cả các đơn đã hoàn thành thiết kế!</td>
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
              <span className="metric-title">Vật Tư Cảnh Báo Sắp Thiếu</span>
              <span className="metric-value" style={{ color: 'var(--color-danger)' }}>{lowStockMaterials.length} loại</span>
              <span className="metric-sub">Dưới định mức tồn kho tối thiểu</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Mua Hàng Đã Gửi NCC</span>
              <span className="metric-value">
                {purchaseOrders.filter(pur => pur.status === 'ordered' || pur.status === 'confirmed').length} đơn
              </span>
              <span className="metric-sub">Chờ NCC giao hàng/xác nhận</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Mua Chờ Nhập Kho</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {purchaseOrders.filter(pur => pur.status === 'shipping').length} đơn
              </span>
              <span className="metric-sub">Đang trên đường vận chuyển</span>
            </div>
          </div>

          <div className="details-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Cảnh Báo Tồn Kho Thấp</span>
                <button className="btn btn-sm btn-outline" onClick={() => onNavigate('inventory')}>Vào Kho</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tên Vật Tư</th>
                      <th>Hiện Có</th>
                      <th>Ngưỡng Cảnh Báo</th>
                      <th>Đơn Vị</th>
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
                <span className="card-title">Đơn Mua Hàng Gần Đây</span>
                <button className="btn btn-sm btn-primary" onClick={() => onNavigate('purchase')}>Mua Vật Tư</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mã Đơn Mua</th>
                      <th>Nhà Cung Cấp</th>
                      <th>Tổng Giá Trị</th>
                      <th>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.slice(0, 5).map(pur => (
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
              <span className="metric-title">LSX Đang Sản Xuất</span>
              <span className="metric-value" style={{ color: 'var(--color-info)' }}>
                {productionCommands.filter(cmd => cmd.status === 'producing').length} lệnh
              </span>
              <span className="metric-sub">Đang chạy trên các máy in</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">Đơn Chờ Sản Xuất</span>
              <span className="metric-value" style={{ color: 'var(--color-warning)' }}>
                {pos.filter(po => po.status === 'production_pending').length} đơn
              </span>
              <span className="metric-sub">Đã duyệt layout, đủ vật tư</span>
            </div>
            <div className="metric-card">
              <span className="metric-title">LSX Đã Hoàn Thành</span>
              <span className="metric-value">
                {productionCommands.filter(cmd => cmd.status === 'completed').length} lệnh
              </span>
              <span className="metric-sub">Đã hoàn thành bàn giao QC</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Tiến Độ Lệnh Sản Xuất Hiện Tại</span>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('production')}>Vào Xưởng</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã LSX</th>
                    <th>Sản Phẩm</th>
                    <th>Máy In</th>
                    <th>Ca Làm</th>
                    <th>SL Yêu Cầu</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {productionCommands.map(cmd => (
                    <tr key={cmd.id}>
                      <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                      <td>{cmd.productName}</td>
                      <td>{cmd.machineId}</td>
                      <td>{cmd.shift}</td>
                      <td>{cmd.qtyToProduce.toLocaleString()} tem</td>
                      <td>
                        <span className={`badge ${
                          cmd.status === 'completed' ? 'badge-success' : 'badge-info'
                        }`}>{cmd.status === 'completed' ? 'Xong' : 'Đang in'}</span>
                      </td>
                    </tr>
                  ))}
                  {productionCommands.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '16px' }}>Hiện tại không có lệnh sản xuất nào đang chạy.</td>
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
