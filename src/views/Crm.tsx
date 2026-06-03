import React, { useState } from 'react';
import { dbService } from '../services/firebaseService';

interface CrmProps {
  customers: any[];
  pos: any[];
  users: any[];
  currentUser: any;
  onRefresh: () => void;
}

export const Crm: React.FC<CrmProps> = ({ customers, pos, users, currentUser, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'needs_care'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [assignedSaleId, setAssignedSaleId] = useState('');
  const [discountRate, setDiscountRate] = useState(0);
  const [debtLimit, setDebtLimit] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('30 ngày');
  const [note, setNote] = useState('');

  const saleUsers = users.filter(u => u.role === 'sale');

  // Handle opening create modal
  const openAddModal = () => {
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTaxCode('');
    setAssignedSaleId(currentUser.role === 'sale' ? currentUser.uid : (saleUsers[0]?.uid || ''));
    setDiscountRate(0);
    setDebtLimit(50000000);
    setPaymentTerms('30 ngày');
    setNote('');
    setShowAddModal(true);
  };

  // Handle opening edit modal
  const openEditModal = (cust: any) => {
    setCompanyName(cust.companyName);
    setContactPerson(cust.contactPerson);
    setPhone(cust.phone);
    setEmail(cust.email);
    setAddress(cust.address);
    setTaxCode(cust.taxCode);
    setAssignedSaleId(cust.assignedSaleId);
    setDiscountRate(cust.discountRate);
    setDebtLimit(cust.debtLimit);
    setPaymentTerms(cust.paymentTerms);
    setNote(cust.note);
    setSelectedCustomer(cust);
    setShowEditModal(true);
  };

  // Create customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    await dbService.addDocument('customers', {
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountRate: Number(discountRate),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note,
      lastOrderAt: null
    });

    setShowAddModal(false);
    onRefresh();
  };

  // Edit customer
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    await dbService.updateDocument('customers', selectedCustomer.id, {
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountRate: Number(discountRate),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note
    });

    setShowEditModal(false);
    setSelectedCustomer(null);
    onRefresh();
  };

  // Delete customer
  const handleDeleteCustomer = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) {
      await dbService.deleteDocument('customers', id);
      setSelectedCustomer(null);
      onRefresh();
    }
  };

  // Order history helper for selected customer
  const getCustomerOrders = (custId: string) => {
    return pos.filter(po => po.customerId === custId);
  };

  // Order frequency (orders per month)
  const calculateFrequency = (custId: string) => {
    const orders = getCustomerOrders(custId);
    if (orders.length === 0) return '0 đơn/tháng';
    
    // Calculate months between first order and now
    const dates = orders.map(o => new Date(o.orderDate).getTime());
    const minDate = new Date(Math.min(...dates));
    const now = new Date();
    const diffMonths = Math.max(1, (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth()));
    
    return `${(orders.length / diffMonths).toFixed(1)} đơn/tháng`;
  };

  // Filter and search
  const today = new Date();
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.phone.includes(searchTerm);
    
    if (filterType === 'needs_care') {
      if (!c.lastOrderAt) return matchesSearch;
      const diffTime = Math.abs(today.getTime() - new Date(c.lastOrderAt).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return matchesSearch && diffDays > 30; // 30+ days inactive
    }
    return matchesSearch;
  });

  return (
    <div className="crm-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">QUẢN LÝ KHÁCH HÀNG (CRM)</h1>
          <p className="page-subtitle">Quản lý danh sách, hồ sơ liên hệ, hạn mức công nợ và cảnh báo chăm sóc khách hàng.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={openAddModal}>Thêm Khách Hàng Mới</button>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Tìm tên công ty, liên hệ, SĐT..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <button className="btn btn-outline" onClick={() => setSearchTerm('')}>Xóa Tìm Kiếm</button>
          </div>
          <div className="tab-container" style={{ borderBottom: 'none' }}>
            <button 
              className={`tab-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              Tất Cả Khách Hàng ({customers.length})
            </button>
            <button 
              className={`tab-btn ${filterType === 'needs_care' ? 'active' : ''}`}
              onClick={() => setFilterType('needs_care')}
              style={{ color: 'var(--color-danger)' }}
            >
              Cần Chăm Sóc (&gt;30 ngày chưa đặt)
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tên Công Ty</th>
                <th>Người Liên Hệ</th>
                <th>Điện Thoại</th>
                <th>Chiết Khấu</th>
                <th>Hạn Mức Nợ</th>
                <th>Đơn Cuối Cùng</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(cust => {
                const customerOrders = getCustomerOrders(cust.id);
                // Check if inactive
                let isInactive = false;
                if (cust.lastOrderAt) {
                  const diffTime = Math.abs(today.getTime() - new Date(cust.lastOrderAt).getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  isInactive = diffDays > 30;
                } else {
                  isInactive = true;
                }

                return (
                  <tr key={cust.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomer(cust)}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{cust.companyName}</span>
                        {isInactive && (
                          <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                            [CẢNH BÁO: CHƯA PHÁT SINH ĐƠN MỚI &gt; 30 NGÀY]
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{cust.contactPerson}</td>
                    <td>{cust.phone}</td>
                    <td>{cust.discountRate}%</td>
                    <td>{cust.debtLimit.toLocaleString()} đ</td>
                    <td>{cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString('vi-VN') : 'Chưa có'}</td>
                    <td>
                      <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(cust)}>Chi Tiết</button>
                        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                          <>
                            <button className="btn btn-sm btn-outline" onClick={() => openEditModal(cust)}>Sửa</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCustomer(cust.id)}>Xóa</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Không tìm thấy khách hàng nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED CUSTOMER DETAIL */}
      {selectedCustomer && (
        <div className="details-grid">
          <div className="card">
            <div className="card-header">
              <span className="card-title">HỒ SƠ KHÁCH HÀNG: {selectedCustomer.companyName}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(null)}>Đóng chi tiết</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Mã số thuế:</span>
                <span>{selectedCustomer.taxCode || 'Chưa cung cấp'}</span>
                
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Địa chỉ giao hàng:</span>
                <span>{selectedCustomer.address}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Email:</span>
                <span>{selectedCustomer.email || 'Chưa cung cấp'}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Sale phụ trách:</span>
                <span>{users.find(u => u.uid === selectedCustomer.assignedSaleId)?.displayName || 'Chưa phân công'}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Điều khoản nợ:</span>
                <span>{selectedCustomer.paymentTerms} (Hạn mức: {selectedCustomer.debtLimit.toLocaleString()} đ)</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Tần suất đặt hàng:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{calculateFrequency(selectedCustomer.id)}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Ghi chú kinh doanh:</span>
                <span>{selectedCustomer.note || 'Không có ghi chú'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">LỊCH SỬ ĐƠN HÀNG (PO)</span>
            </div>
            <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Ngày Đặt</th>
                    <th>Trị Giá (Net)</th>
                    <th>Tiến Độ</th>
                  </tr>
                </thead>
                <tbody>
                  {getCustomerOrders(selectedCustomer.id).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{new Date(po.orderDate).toLocaleDateString('vi-VN')}</td>
                      <td>{po.netAmount.toLocaleString()} đ</td>
                      <td>
                        <span className={`badge ${
                          po.status === 'delivered' || po.status === 'debt_collected' ? 'badge-success' : 'badge-warning'
                        }`}>{po.status.replace('_', ' ').toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                  {getCustomerOrders(selectedCustomer.id).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>Chưa phát sinh đơn hàng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>THÊM KHÁCH HÀNG MỚI</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tên Công Ty *</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Người Liên Hệ</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Số Điện Thoại</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Mã Số Thuế</label>
                    <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Địa Chỉ Giao Hàng</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Chiết Khấu Mặc Định (%)</label>
                    <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>Hạn Mức Công Nợ (đ)</label>
                    <input type="number" min="0" value={debtLimit} onChange={e => setDebtLimit(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Điều Khoản Thanh Toán</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                      <option value="Thanh toán trước">Thanh toán trước</option>
                      <option value="Thanh toán khi nhận hàng">Thanh toán khi nhận hàng</option>
                      <option value="30 ngày">30 ngày kể từ khi giao hàng</option>
                      <option value="45 ngày">45 ngày kể từ khi giao hàng</option>
                      <option value="60 ngày">60 ngày kể từ khi giao hàng</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Sale Phụ Trách</label>
                    <select value={assignedSaleId} onChange={e => setAssignedSaleId(e.target.value)} disabled={currentUser.role === 'sale'}>
                      {saleUsers.map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Ghi Chú Yêu Cầu Riêng</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Khách Hàng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>CHỈNH SỬA HỒ SƠ KHÁCH HÀNG</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleEditCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tên Công Ty *</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Người Liên Hệ</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Số Điện Thoại</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Mã Số Thuế</label>
                    <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Địa Chỉ Giao Hàng</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Chiết Khấu Mặc Định (%)</label>
                    <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>Hạn Mức Công Nợ (đ)</label>
                    <input type="number" min="0" value={debtLimit} onChange={e => setDebtLimit(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Điều Khoản Thanh Toán</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                      <option value="Thanh toán trước">Thanh toán trước</option>
                      <option value="Thanh toán khi nhận hàng">Thanh toán khi nhận hàng</option>
                      <option value="30 ngày">30 ngày kể từ khi giao hàng</option>
                      <option value="45 ngày">45 ngày kể từ khi giao hàng</option>
                      <option value="60 ngày">60 ngày kể từ khi giao hàng</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Sale Phụ Trách</label>
                    <select value={assignedSaleId} onChange={e => setAssignedSaleId(e.target.value)} disabled={currentUser.role === 'sale'}>
                      {saleUsers.map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Ghi Chú Yêu Cầu Riêng</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Cập Nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
