import React, { useState } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';

interface UserManagementProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, currentUser, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'sale' | 'designer' | 'purchaser' | 'producer' | 'accountant'>('sale');
  const [active, setActive] = useState(true);

  // Map roles to Vietnamese text
  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'admin': return 'Giám Đốc (Admin)';
      case 'sale': return 'Nhân Viên Sale';
      case 'designer': return 'Thiết Kế';
      case 'purchaser': return 'Mua Vật Tư';
      case 'producer': return 'Sản Xuất';
      case 'accountant': return 'Kế Toán';
      default: return r;
    }
  };

  // Map roles to default passwords for user reference
  const getDefaultPassword = (r: string) => {
    switch (r) {
      case 'admin': return 'admin123';
      case 'sale': return 'sale123';
      case 'designer': return 'design123';
      case 'purchaser': return 'purchase123';
      case 'producer': return 'produce123';
      case 'accountant': return 'account123';
      default: return '123456';
    }
  };

  const openAddModal = () => {
    setDisplayName('');
    setEmail('');
    setRole('sale');
    setActive(true);
    setShowAddModal(true);
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setRole(user.role);
    setActive(user.active);
    setShowEditModal(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email) return;

    const emailTrim = email.trim().toLowerCase();
    
    // Check if email already exists
    const exists = users.some(u => u.email.toLowerCase() === emailTrim);
    if (exists) {
      alert('Email này đã được đăng ký trên hệ thống.');
      return;
    }

    const uid = `u-${Math.random().toString(36).substr(2, 9)}`;
    const newUser: UserProfile = {
      uid,
      displayName: displayName.trim(),
      email: emailTrim,
      role,
      active,
      createdAt: new Date().toISOString().split('T')[0]
    };

    await dbService.addDocument('users', newUser);
    setShowAddModal(false);
    onRefresh();
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Prevent deactivating oneself
    if (selectedUser.uid === currentUser.uid && !active) {
      alert('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.');
      return;
    }

    // Prevent changing ones own role
    if (selectedUser.uid === currentUser.uid && role !== 'admin') {
      alert('Bạn không thể tự thay đổi vai trò Admin của chính mình.');
      return;
    }

    await dbService.updateDocument('users', selectedUser.uid, {
      displayName: displayName.trim(),
      role,
      active
    });

    setShowEditModal(false);
    setSelectedUser(null);
    onRefresh();
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.uid === currentUser.uid) {
      alert('Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }

    const action = user.active ? 'vô hiệu hóa' : 'kích hoạt';
    if (window.confirm(`Bạn có chắc chắn muốn ${action} tài khoản ${user.displayName}?`)) {
      await dbService.updateDocument('users', user.uid, {
        active: !user.active
      });
      onRefresh();
    }
  };

  // Search and filter logic
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="users-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN</h1>
          <p className="page-subtitle">Xem danh sách nhân sự, phân quyền vai trò phòng ban và quản lý trạng thái hoạt động.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>Thêm Người Dùng Mới</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Tìm theo tên hoặc email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="all">Tất Cả Vai Trò</option>
              <option value="admin">Giám Đốc (Admin)</option>
              <option value="sale">Nhân Viên Sale</option>
              <option value="designer">Thiết Kế</option>
              <option value="purchaser">Mua Vật Tư</option>
              <option value="producer">Sản Xuất</option>
              <option value="accountant">Kế Toán</option>
            </select>
            <button className="btn btn-outline" onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}>Đặt Lại</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Họ Và Tên</th>
                <th>Địa Chỉ Email</th>
                <th>Vai Trò Phòng Ban</th>
                <th>Trạng Thái</th>
                <th>Mật Khẩu Đăng Nhập</th>
                <th>Ngày Khởi Tạo</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isSelf = u.uid === currentUser.uid;
                return (
                  <tr key={u.uid}>
                    <td style={{ fontWeight: 600 }}>
                      {u.displayName} {isSelf && <span style={{ color: 'var(--color-primary)', fontSize: '11px' }}>(Bạn)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-outline">{getRoleLabel(u.role)}</span>
                    </td>
                    <td>
                      {u.active ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '13px' }}>Đang hoạt động</span>
                      ) : (
                        <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '13px' }}>Bị vô hiệu hóa</span>
                      )}
                    </td>
                    <td>
                      <code>{getDefaultPassword(u.role)}</code>
                    </td>
                    <td>{u.createdAt || 'N/A'}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-outline" onClick={() => openEditModal(u)}>Sửa</button>
                        {!isSelf && (
                          <button 
                            className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-outline'}`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.active ? 'Khóa Tài Khoản' : 'Kích Hoạt'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Không tìm thấy tài khoản người dùng nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>THÊM NGƯỜI DÙNG MỚI</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Họ Và Tên Nhân Sự *</label>
                  <input 
                    type="text" 
                    placeholder="Nhập họ và tên đầy đủ..." 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Địa Chỉ Email Văn Phòng *</label>
                  <input 
                    type="email" 
                    placeholder="ví dụ: user@sunflower.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Vai Trò Phòng Ban *</label>
                    <select 
                      value={role} 
                      onChange={e => setRole(e.target.value as any)}
                    >
                      <option value="admin">Giám Đốc (Admin)</option>
                      <option value="sale">Nhân Viên Sale</option>
                      <option value="designer">Thiết Kế</option>
                      <option value="purchaser">Mua Vật Tư</option>
                      <option value="producer">Sản Xuất</option>
                      <option value="accountant">Kế Toán</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng Thái Ban Đầu</label>
                    <select 
                      value={active ? 'true' : 'false'} 
                      onChange={e => setActive(e.target.value === 'true')}
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Tạm khóa</option>
                    </select>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-light)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Thông tin đăng nhập mặc định:</span>
                  <div style={{ marginTop: '6px', fontSize: '12px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mật khẩu mặc định:</span>
                    <strong><code>{getDefaultPassword(role)}</code></strong>
                    
                    <span style={{ color: 'var(--color-text-muted)' }}>Quy định đổi vai:</span>
                    <span>Hệ thống ERP hỗ trợ chuyển đổi nhanh vai trò trên thanh Header để tiện kiểm thử.</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Tài Khoản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>CHỈNH SỬA THÔNG TIN TÀI KHOẢN</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Địa Chỉ Email (Không thể thay đổi)</label>
                  <input type="text" value={selectedUser.email} disabled style={{ backgroundColor: 'var(--color-bg-light)' }} />
                </div>
                <div className="form-group">
                  <label>Họ Và Tên Nhân Sự *</label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Vai Trò Phòng Ban *</label>
                    <select 
                      value={role} 
                      onChange={e => setRole(e.target.value as any)}
                      disabled={selectedUser.uid === currentUser.uid} // Admin can't change their own role
                    >
                      <option value="admin">Giám Đốc (Admin)</option>
                      <option value="sale">Nhân Viên Sale</option>
                      <option value="designer">Thiết Kế</option>
                      <option value="purchaser">Mua Vật Tư</option>
                      <option value="producer">Sản Xuất</option>
                      <option value="accountant">Kế Toán</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng Thái Hoạt Động</label>
                    <select 
                      value={active ? 'true' : 'false'} 
                      onChange={e => setActive(e.target.value === 'true')}
                      disabled={selectedUser.uid === currentUser.uid} // Admin can't lock themselves
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Vô hiệu hóa (Khóa)</option>
                    </select>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-light)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Thông tin bảo mật:</span>
                  <div style={{ marginTop: '6px', fontSize: '12px' }}>
                    Nếu đổi vai trò phòng ban của nhân sự, mật khẩu đăng nhập của họ cũng sẽ tự động chuyển thành mật khẩu tương ứng với vai trò mới (ví dụ: <code>{getDefaultPassword(role)}</code>) để phù hợp với cơ chế xác thực gọn nhẹ.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
