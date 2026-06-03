import React, { useState, useEffect } from 'react';
import { authService, dbService, UserProfile } from './services/firebaseService';
import { Dashboard } from './views/Dashboard';
import { Crm } from './views/Crm';
import { Sales } from './views/Sales';
import { Design } from './views/Design';
import { Purchase } from './views/Purchase';
import { Inventory } from './views/Inventory';
import { Production } from './views/Production';
import { Delivery } from './views/Delivery';
import { Accounting } from './views/Accounting';

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  
  // Real-time synchronization states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pos, setPOs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [productionCommands, setProductionCommands] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Authentication State Change
  useEffect(() => {
    const unsubAuth = authService.onAuthStateChanged((currUser) => {
      setUser(currUser);
    });
    return () => unsubAuth();
  }, []);

  // Set up real-time database subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubUsers = dbService.subscribeCollection('users', (data) => setUsers(data as UserProfile[]));
    const unsubCustomers = dbService.subscribeCollection('customers', setCustomers);
    const unsubPOs = dbService.subscribeCollection('pos', (data) => {
      // Sort newest first
      const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPOs(sorted);
    });
    const unsubPurchases = dbService.subscribeCollection('purchase_orders', setPurchaseOrders);
    const unsubProduction = dbService.subscribeCollection('production_commands', setProductionCommands);
    const unsubDeliveries = dbService.subscribeCollection('deliveries', setDeliveries);
    const unsubInvoices = dbService.subscribeCollection('invoices', setInvoices);
    const unsubInventory = dbService.subscribeCollection('inventory', setInventory);

    return () => {
      unsubUsers();
      unsubCustomers();
      unsubPOs();
      unsubPurchases();
      unsubProduction();
      unsubDeliveries();
      unsubInvoices();
      unsubInventory();
    };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await authService.login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập không thành công.');
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setActivePage('dashboard');
  };

  // Demo Switch Role Utility (Changes role on-the-fly for testing/reviewing)
  const handleSwitchRole = (newRole: any) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      role: newRole,
      displayName: `Đóng vai: ${newRole.toUpperCase()} - ${user.displayName.replace(/Đóng vai: [A-Z]+ - /, '')}`
    };
    setUser(updatedUser);
    localStorage.setItem('erp_current_user', JSON.stringify(updatedUser));
  };

  const refreshData = () => {
    // Triggers local list updates (Mock DB callbacks already trigger, this forces refresh where needed)
  };

  // View routing rendering selector
  const renderPageContent = () => {
    if (!user) return null;

    switch (activePage) {
      case 'crm':
        return <Crm customers={customers} pos={pos} users={users} currentUser={user} onRefresh={refreshData} />;
      case 'sales':
        return <Sales pos={pos} customers={customers} currentUser={user} onRefresh={refreshData} />;
      case 'design':
        return <Design pos={pos} currentUser={user} onRefresh={refreshData} />;
      case 'purchase':
        return <Purchase pos={pos} purchaseOrders={purchaseOrders} currentUser={user} onRefresh={refreshData} />;
      case 'inventory':
        return <Inventory currentUser={user} onRefresh={refreshData} />;
      case 'production':
        return <Production pos={pos} productionCommands={productionCommands} currentUser={user} onRefresh={refreshData} />;
      case 'delivery':
        return <Delivery pos={pos} currentUser={user} onRefresh={refreshData} />;
      case 'accounting':
        return <Accounting pos={pos} currentUser={user} onRefresh={refreshData} />;
      default:
        return (
          <Dashboard 
            user={user}
            pos={pos}
            customers={customers}
            inventory={inventory}
            purchaseOrders={purchaseOrders}
            productionCommands={productionCommands}
            deliveries={deliveries}
            invoices={invoices}
            onNavigate={(page) => setActivePage(page)}
          />
        );
    }
  };

  // Render Login Page
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-title">SUNFLOWER ERP</div>
          <div className="login-subtitle">Hệ Thống Quản Trị Sản Xuất Tem Nhãn</div>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Địa Chỉ Email Văn Phòng</label>
              <input 
                type="email" 
                placeholder="sale@sunflower.com, admin@..." 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Mật Khẩu Đăng Nhập</label>
              <input 
                type="password" 
                placeholder="Ví dụ: admin123, sale123..." 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--color-danger)', fontSize: '12.5px', textAlign: 'center', backgroundColor: 'var(--color-danger-bg)', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-danger-border)' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
              Đăng Nhập Vào Hệ Thống
            </button>
          </form>

          <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
            <strong>Tài khoản Demo thử nghiệm nhanh:</strong>
            <div style={{ marginTop: '4px' }}>
              • Giám đốc: <code>admin@sunflower.com</code> / mật khẩu <code>admin123</code><br />
              • Sale: <code>sale@sunflower.com</code> / mật khẩu <code>sale123</code><br />
              • Thiết kế: <code>designer@sunflower.com</code> / mật khẩu <code>design123</code><br />
              • Mua hàng: <code>purchase@sunflower.com</code> / mật khẩu <code>purchase123</code><br />
              • Sản xuất: <code>produce@sunflower.com</code> / mật khẩu <code>produce123</code><br />
              • Kế toán: <code>accountant@sunflower.com</code> / mật khẩu <code>account123</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Layout
  return (
    <div className="app-container">
      {/* APP SIDEBAR NAVIGATION (Strictly Text Links, No Icons) */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">SUNFLOWER ERP</span>
        </div>
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActivePage('dashboard')}
          >
            Tổng Quan Dashboards
          </button>
          
          <button 
            className={`sidebar-item ${activePage === 'crm' ? 'active' : ''}`}
            onClick={() => setActivePage('crm')}
          >
            Khách Hàng (CRM)
          </button>

          {(user.role === 'admin' || user.role === 'sale') && (
            <button 
              className={`sidebar-item ${activePage === 'sales' ? 'active' : ''}`}
              onClick={() => setActivePage('sales')}
            >
              Tiếp Nhận Đơn (Sale PO)
            </button>
          )}

          {(user.role === 'admin' || user.role === 'designer') && (
            <button 
              className={`sidebar-item ${activePage === 'design' ? 'active' : ''}`}
              onClick={() => setActivePage('design')}
            >
              Thiết Kế & Layout
            </button>
          )}

          {(user.role === 'admin' || user.role === 'purchaser') && (
            <button 
              className={`sidebar-item ${activePage === 'purchase' ? 'active' : ''}`}
              onClick={() => setActivePage('purchase')}
            >
              Mua Hàng & NCC
            </button>
          )}

          {(user.role === 'admin' || user.role === 'purchaser' || user.role === 'producer') && (
            <button 
              className={`sidebar-item ${activePage === 'inventory' ? 'active' : ''}`}
              onClick={() => setActivePage('inventory')}
            >
              Kho Nguyên Vật Tư
            </button>
          )}

          {(user.role === 'admin' || user.role === 'producer') && (
            <button 
              className={`sidebar-item ${activePage === 'production' ? 'active' : ''}`}
              onClick={() => setActivePage('production')}
            >
              Lệnh Sản Xuất (LSX)
            </button>
          )}

          {(user.role === 'admin' || user.role === 'producer' || user.role === 'sale') && (
            <button 
              className={`sidebar-item ${activePage === 'delivery' ? 'active' : ''}`}
              onClick={() => setActivePage('delivery')}
            >
              Kế Hoạch Giao Hàng
            </button>
          )}

          {(user.role === 'admin' || user.role === 'accountant') && (
            <button 
              className={`sidebar-item ${activePage === 'accounting' ? 'active' : ''}`}
              onClick={() => setActivePage('accounting')}
            >
              Kế Toán & Lãi Gộp
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleLogout}>
            Đăng Xuất
          </button>
        </div>
      </aside>

      {/* APP HEADER */}
      <header className="app-header">
        <div className="header-title-container">
          <span className="header-title">SUNFLOWER LABEL MANUFACTURING ERP</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* DEMO LIVE SWITCH ROLE SELECTOR (Extremely Convenient for Testing) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Chuyển nhanh vai trò:</span>
            <select 
              value={user.role} 
              onChange={e => handleSwitchRole(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', width: '130px' }}
            >
              <option value="admin">Giám Đốc</option>
              <option value="sale">Nhân Viên Sale</option>
              <option value="designer">Thiết Kế</option>
              <option value="purchaser">Mua Vật Tư</option>
              <option value="producer">Sản Xuất</option>
              <option value="accountant">Kế Toán</option>
            </select>
          </div>

          <div className="header-user-badge">
            <span style={{ fontWeight: 600 }}>{user.displayName}</span>
          </div>
        </div>
      </header>

      {/* APP MAIN CONTENT PORTAL */}
      <main className="app-main">
        {renderPageContent()}
      </main>
    </div>
  );
}

export default App;
