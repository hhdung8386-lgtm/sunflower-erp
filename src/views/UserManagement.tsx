import React, { useState } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { formatDateTime } from '../domain/dateFormatting';

interface UserManagementProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, currentUser, onRefresh }) => {
  const { t } = useLanguage();
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
      case 'admin': return t('Giám Đốc');
      case 'sale': return t('Nhân Viên Sale');
      case 'designer': return t('Thiết Kế');
      case 'purchaser': return t('Mua Vật Tư');
      case 'producer': return t('Sản Xuất');
      case 'accountant': return t('Kế Toán');
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

  const [allowedPages, setAllowedPages] = useState<string[]>([]);

  const ALL_PAGES = [
    { id: 'dashboard', label: t('Bảng Điều Khiển') },
    { id: 'chat', label: t('Kênh Trao Đổi') },
    { id: 'crm', label: t('Quản Lý Khách Hàng') },
    { id: 'leads', label: t('Khách Hàng Tiềm Năng') },
    { id: 'sales', label: t('Tiếp Nhận Đơn PO') },
    { id: 'design', label: t('Quản Lý Thiết Kế') },
    { id: 'purchase', label: t('Mua Hàng NCC') },
    { id: 'inventory', label: t('Quản Lý Kho') },
    { id: 'production', label: t('Lệnh Sản Xuất') },
    { id: 'delivery', label: t('Phiếu Giao Hàng') },
    { id: 'accounting', label: t('Quản Lý Kế Toán') },
    { id: 'users', label: t('Quản Lý Tài Khoản') },
    { id: 'recycle_bin', label: t('Kho Rác Hệ Thống') },
  ];

  const getDefaultPagesForRole = (r: string): string[] => {
    switch (r) {
      case 'admin':
        return ['dashboard', 'chat', 'crm', 'leads', 'sales', 'design', 'purchase', 'inventory', 'production', 'delivery', 'accounting', 'users', 'recycle_bin'];
      case 'sale':
        return ['dashboard', 'chat', 'crm', 'leads', 'sales'];
      case 'designer':
        return ['dashboard', 'chat', 'design'];
      case 'purchaser':
        return ['dashboard', 'chat', 'purchase', 'inventory'];
      case 'producer':
        return ['dashboard', 'chat', 'production'];
      case 'accountant':
        return ['dashboard', 'chat', 'accounting'];
      default:
        return ['dashboard', 'chat'];
    }
  };

  const openAddModal = () => {
    setDisplayName('');
    setEmail('');
    setRole('sale');
    setActive(true);
    setAllowedPages(getDefaultPagesForRole('sale'));
    setShowAddModal(true);
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setRole(user.role);
    setActive(user.active);
    setAllowedPages(user.allowedPages || getDefaultPagesForRole(user.role));
    setShowEditModal(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email) return;

    const emailTrim = email.trim().toLowerCase();
    
    // Check if email already exists
    const exists = users.some(u => u.email.toLowerCase() === emailTrim);
    if (exists) {
      alert(t('Email này đã được đăng ký trên hệ thống.'));
      return;
    }

    const uid = `u-${Math.random().toString(36).substr(2, 9)}`;
    const newUser: UserProfile = {
      uid,
      displayName: displayName.trim(),
      email: emailTrim,
      role,
      active,
      allowedPages,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
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
      alert(t('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.'));
      return;
    }

    // Prevent changing ones own role
    if (selectedUser.uid === currentUser.uid && role !== 'admin') {
      alert(t('Bạn không thể tự thay đổi vai trò Admin của chính mình.'));
      return;
    }

    await dbService.updateDocument('users', selectedUser.uid, {
      displayName: displayName.trim(),
      role,
      active,
      allowedPages,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditModal(false);
    setSelectedUser(null);
    onRefresh();
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.uid === currentUser.uid) {
      alert(t('Bạn không thể tự khóa tài khoản của chính mình.'));
      return;
    }

    if (window.confirm(t(`Bạn có chắc chắn muốn thay đổi trạng thái tài khoản ${user.displayName}?`))) {
      await dbService.updateDocument('users', user.uid, {
        active: !user.active,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      });
      onRefresh();
    }
  };

  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.uid === currentUser.uid) {
      alert(t('Bạn không thể tự xóa tài khoản của chính mình.'));
      return;
    }

    if (window.confirm(t('Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản người dùng này?'))) {
      await dbService.deleteDocument('users', userToDelete.uid);
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
          <h1 className="page-title">{t('QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN')}</h1>
          <p className="page-subtitle">{t('Xem danh sách nhân sự, phân quyền vai trò phòng ban và quản lý trạng thái hoạt động.')}</p>
        </div>
        <button className="btn btn-primary btn-symbol" onClick={openAddModal} title={t('Thêm Người Dùng Mới')}>
          <Plus size={18} />
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder={t('Tìm theo tên hoặc email...')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="all">{t('Tất Cả Vai Trò')}</option>
              <option value="admin">{t('Giám Đốc')}</option>
              <option value="sale">{t('Nhân Viên Sale')}</option>
              <option value="designer">{t('Thiết Kế')}</option>
              <option value="purchaser">{t('Mua Vật Tư')}</option>
              <option value="producer">{t('Sản Xuất')}</option>
              <option value="accountant">{t('Kế Toán')}</option>
            </select>
            <button className="btn btn-outline" onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}>{t('Đặt Lại')}</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Họ Và Tên')}</th>
                <th>{t('Địa Chỉ Email')}</th>
                <th>{t('Vai Trò Phòng Ban')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Mật Khẩu Đăng Nhập')}</th>
                <th>{t('Ngày Khởi Tạo')}</th>
                <th>{t('Thao Tác')}</th>
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
                        <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '13px' }}>{t('Đang hoạt động')}</span>
                      ) : (
                        <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '13px' }}>{t('Bị vô hiệu hóa')}</span>
                      )}
                    </td>
                    <td>
                      <code>{getDefaultPassword(u.role)}</code>
                    </td>
                    <td>{u.createdAt || 'N/A'}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditModal(u)} title={t('Sửa')}>
                          <Pencil size={14} />
                        </button>
                        {!isSelf && (
                          <>
                            <button 
                              className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-outline'}`}
                              onClick={() => handleToggleStatus(u)}
                            >
                              {u.active ? t('Khóa Tài Khoản') : t('Kích Hoạt')}
                            </button>
                            <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteUser(u)} title={t('Xóa')}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>{t('Không tìm thấy tài khoản người dùng nào.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM NGƯỜI DÙNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Họ Và Tên Nhân Sự *')}</label>
                  <input 
                    type="text" 
                    placeholder={t('Nhập họ và tên đầy đủ...')} 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>{t('Địa Chỉ Email Văn Phòng *')}</label>
                  <input 
                    type="email" 
                    placeholder={t('ví dụ: user@sunflower.com')} 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Vai Trò Phòng Ban *')}</label>
                    <select 
                      value={role} 
                      onChange={e => {
                        const newRole = e.target.value as any;
                        setRole(newRole);
                        setAllowedPages(getDefaultPagesForRole(newRole));
                      }}
                    >
                      <option value="admin">{t('Giám Đốc')}</option>
                      <option value="sale">{t('Nhân Viên Sale')}</option>
                      <option value="designer">{t('Thiết Kế')}</option>
                      <option value="purchaser">{t('Mua Vật Tư')}</option>
                      <option value="producer">{t('Sản Xuất')}</option>
                      <option value="accountant">{t('Kế Toán')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Trạng Thái Ban Đầu')}</label>
                    <select 
                      value={active ? 'true' : 'false'} 
                      onChange={e => setActive(e.target.value === 'true')}
                    >
                      <option value="true">{t('Đang hoạt động')}</option>
                      <option value="false">{t('Tạm khóa')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>{t('Trang Được Phép Truy Cập')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', backgroundColor: 'var(--color-bg-light)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    {ALL_PAGES.map(page => (
                      <label key={page.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={allowedPages.includes(page.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedPages([...allowedPages, page.id]);
                            } else {
                              setAllowedPages(allowedPages.filter(id => id !== page.id));
                            }
                          }}
                        />
                        {page.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-light)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('Thông tin đăng nhập mặc định:')}</span>
                  <div style={{ marginTop: '6px', fontSize: '12px', display: 'grid', gridTemplateColumns: '150px 1fr', gap: '4px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Mật khẩu mặc định')}:</span>
                    <strong><code>{getDefaultPassword(role)}</code></strong>
                    
                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Quy định đổi vai:')}</span>
                    <span>{t('Hệ thống ERP hỗ trợ chuyển đổi nhanh vai trò trên thanh Header để tiện kiểm thử.')}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Tài Khoản')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA THÔNG TIN TÀI KHOẢN')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Địa Chỉ Email (Không thể thay đổi)')}</label>
                  <input type="text" value={selectedUser.email} disabled style={{ backgroundColor: 'var(--color-bg-light)' }} />
                </div>
                <div className="form-group">
                  <label>{t('Họ Và Tên Nhân Sự *')}</label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Vai Trò Phòng Ban *')}</label>
                    <select 
                      value={role} 
                      onChange={e => {
                        const newRole = e.target.value as any;
                        setRole(newRole);
                        setAllowedPages(getDefaultPagesForRole(newRole));
                      }}
                      disabled={selectedUser.uid === currentUser.uid} // Admin can't change their own role
                    >
                      <option value="admin">{t('Giám Đốc')}</option>
                      <option value="sale">{t('Nhân Viên Sale')}</option>
                      <option value="designer">{t('Thiết Kế')}</option>
                      <option value="purchaser">{t('Mua Vật Tư')}</option>
                      <option value="producer">{t('Sản Xuất')}</option>
                      <option value="accountant">{t('Kế Toán')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Trạng Thái Hoạt Động')}</label>
                    <select 
                      value={active ? 'true' : 'false'} 
                      onChange={e => setActive(e.target.value === 'true')}
                      disabled={selectedUser.uid === currentUser.uid} // Admin can't lock themselves
                    >
                      <option value="true">{t('Đang hoạt động')}</option>
                      <option value="false">{t('Vô hiệu hóa (Khóa)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>{t('Trang Được Phép Truy Cập')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', backgroundColor: 'var(--color-bg-light)', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    {ALL_PAGES.map(page => (
                      <label key={page.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={allowedPages.includes(page.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedPages([...allowedPages, page.id]);
                            } else {
                              setAllowedPages(allowedPages.filter(id => id !== page.id));
                            }
                          }}
                        />
                        {page.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-light)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('Thông tin bảo mật:')}</span>
                  <div style={{ marginTop: '6px', fontSize: '12px' }}>
                    {t('Nếu đổi vai trò phòng ban của nhân sự, mật khẩu đăng nhập của họ cũng sẽ tự động chuyển thành mật khẩu tương ứng với vai trò mới (ví dụ:')} <code>{getDefaultPassword(role)}</code> {t('để phù hợp với cơ chế xác thực gọn nhẹ.')}
                  </div>
                </div>

                {/* Audit trail */}
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <div>{t('Tạo bởi:')} {selectedUser.createdBy || t('Không xác định')} {selectedUser.createdAt && `(${selectedUser.createdAt})`}</div>
                  {selectedUser.updatedBy && (
                    <div>{t('Cập nhật bởi:')} {selectedUser.updatedBy} ({formatDateTime(selectedUser.updatedAt, t('vi-VN'), '')})</div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thay Đổi')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
