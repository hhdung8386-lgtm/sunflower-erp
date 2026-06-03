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
import { UserManagement } from './views/UserManagement';
import { useLanguage } from './context/LanguageContext';

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const { t, language, setLanguage } = useLanguage();
  
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
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('erp_remembered_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('erp_remember_me') === 'true';
  });
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
      await authService.login(username, password);
      if (rememberMe) {
        localStorage.setItem('erp_remembered_username', username);
        localStorage.setItem('erp_remember_me', 'true');
      } else {
        localStorage.removeItem('erp_remembered_username');
        localStorage.removeItem('erp_remember_me');
      }
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
      case 'users':
        if (user.role !== 'admin') {
          // React state updates during render are allowed if guarded or deferred,
          // but we can schedule it in useEffect or do a simple redirect check.
          // Let's do activePage state reset.
          setTimeout(() => setActivePage('dashboard'), 0);
          return null;
        }
        return <UserManagement users={users} currentUser={user} onRefresh={refreshData} />;
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
      <div className="login-split-container">
        {/* Left Panel: Slogans, Image, Flow, Grid */}
        <div className="login-left-banner">
          <div className="login-left-content">
            <div className="login-brand-header">
              <span className="brand-logo-icon">🌻</span>
              <span className="brand-name">SUNFLOWER</span>
            </div>
            <h1 className="login-banner-title">{t('SUNFLOWER LABEL MANUFACTURING')}</h1>
            <p className="login-banner-subtitle">{t('Hệ Thống Quản Trị Sản Xuất Tem Nhãn')}</p>
            
            <div className="printing-image-container">
              <img 
                src="/src/assets/printing_machine.png" 
                alt="Flexo Printing Machine" 
                className="printing-machine-img" 
                decoding="async"
                loading="eager"
              />
            </div>

            {/* 6-step flow */}
            <div className="timeline-flow-container">
              <h3 className="timeline-title">{t('Quy Trình Hoạt Động Cốt Lõi')}</h3>
              <div className="timeline-flow">
                <div className="timeline-step">
                  <div className="step-num">1</div>
                  <div className="step-text">{t('Khách Hàng & CRM')}</div>
                </div>
                <div className="timeline-step">
                  <div className="step-num">2</div>
                  <div className="step-text">{t('Tiếp Nhận PO')}</div>
                </div>
                <div className="timeline-step">
                  <div className="step-num">3</div>
                  <div className="step-text">{t('Thiết Kế & Duyệt')}</div>
                </div>
                <div className="timeline-step">
                  <div className="step-num">4</div>
                  <div className="step-text">{t('Mua Hàng & NCC')}</div>
                </div>
                <div className="timeline-step">
                  <div className="step-num">5</div>
                  <div className="step-text">{t('Lệnh Sản Xuất')}</div>
                </div>
                <div className="timeline-step">
                  <div className="step-num">6</div>
                  <div className="step-text">{t('Giao Hàng & Ký')}</div>
                </div>
              </div>
            </div>

            {/* 8-box grid */}
            <div className="feature-grid-container">
              <h3 className="grid-title">{t('Hệ Thống Phân Hệ Chức Năng')}</h3>
              <div className="feature-grid">
                <div className="grid-item">
                  <div className="grid-item-name">{t('Khách Hàng (CRM)')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Tiếp Nhận Đơn (Sale PO)')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Thiết Kế & Layout')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Mua Hàng & NCC')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Kho Nguyên Vật Tư')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Lệnh Sản Xuất (LSX)')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Kế Hoạch Giao Hàng')}</div>
                </div>
                <div className="grid-item">
                  <div className="grid-item-name">{t('Kế Toán & Lãi Gộp')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Login card */}
        <div className="login-right-pane">
          <div className="login-right-header">
            <button 
              className="lang-toggle-btn" 
              onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>{language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
            </button>
          </div>

          <div className="login-right-card">
            <h2 className="login-card-title">{t('Chào mừng đến với SUNFLOWER')}</h2>
            <p className="login-card-subtitle">{t('Đăng nhập để bắt đầu phiên làm việc')}</p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label>{t('Tên đăng nhập')}</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    placeholder={t('Nhập tên đăng nhập hoặc email')} 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="login-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('Mật Khẩu Đăng Nhập')}</label>
                <div className="input-wrapper password-input-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder={t('Mật khẩu của bạn')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="login-input"
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      /* Eye Off Icon */
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      /* Eye Icon */
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember-me">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={e => setRememberMe(e.target.checked)} 
                  />
                  <span>{t('Ghi nhớ đăng nhập')}</span>
                </label>
              </div>

              {errorMsg && (
                <div className="login-error-alert">
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="login-btn-submit">
                {t('Đăng Nhập')}
              </button>
            </form>

            {/* Demo Credentials Section */}
            <div className="demo-credentials">
              <h4>{t('Tài khoản Demo thử nghiệm nhanh:')}</h4>
              <ul>
                <li><strong>{t('Giám đốc')}:</strong> <code>admin</code> / <code>admin123</code></li>
                <li><strong>Sale:</strong> <code>sale</code> / <code>sale123</code></li>
                <li><strong>{t('Thiết kế')}:</strong> <code>designer</code> / <code>design123</code></li>
                <li><strong>{t('Mua hàng')}:</strong> <code>purchase</code> / <code>purchase123</code></li>
                <li><strong>{t('Sản xuất')}:</strong> <code>produce</code> / <code>produce123</code></li>
                <li><strong>{t('Kế toán')}:</strong> <code>accountant</code> / <code>account123</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Layout
  return (
    <div className="app-container">
      {/* Mobile backdrop overlay */}
      <div 
        className={`sidebar-overlay-mobile ${isSidebarOpen ? 'show' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* APP SIDEBAR NAVIGATION (Strictly Text Links, No Icons) */}
      <aside className={`app-sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">SUNFLOWER</span>
        </div>
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActivePage('dashboard'); setIsSidebarOpen(false); }}
          >
            {t('Tổng Quan Dashboards')}
          </button>
          
          <button 
            className={`sidebar-item ${activePage === 'crm' ? 'active' : ''}`}
            onClick={() => { setActivePage('crm'); setIsSidebarOpen(false); }}
          >
            {t('Khách Hàng (CRM)')}
          </button>

          {(user.role === 'admin' || user.role === 'sale') && (
            <button 
              className={`sidebar-item ${activePage === 'sales' ? 'active' : ''}`}
              onClick={() => { setActivePage('sales'); setIsSidebarOpen(false); }}
            >
              {t('Tiếp Nhận Đơn (Sale PO)')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'designer') && (
            <button 
              className={`sidebar-item ${activePage === 'design' ? 'active' : ''}`}
              onClick={() => { setActivePage('design'); setIsSidebarOpen(false); }}
            >
              {t('Thiết Kế & Layout')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'purchaser') && (
            <button 
              className={`sidebar-item ${activePage === 'purchase' ? 'active' : ''}`}
              onClick={() => { setActivePage('purchase'); setIsSidebarOpen(false); }}
            >
              {t('Mua Hàng & NCC')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'purchaser' || user.role === 'producer') && (
            <button 
              className={`sidebar-item ${activePage === 'inventory' ? 'active' : ''}`}
              onClick={() => { setActivePage('inventory'); setIsSidebarOpen(false); }}
            >
              {t('Kho Nguyên Vật Tư')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'producer') && (
            <button 
              className={`sidebar-item ${activePage === 'production' ? 'active' : ''}`}
              onClick={() => { setActivePage('production'); setIsSidebarOpen(false); }}
            >
              {t('Lệnh Sản Xuất (LSX)')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'producer' || user.role === 'sale') && (
            <button 
              className={`sidebar-item ${activePage === 'delivery' ? 'active' : ''}`}
              onClick={() => { setActivePage('delivery'); setIsSidebarOpen(false); }}
            >
              {t('Kế Hoạch Giao Hàng')}
            </button>
          )}

          {(user.role === 'admin' || user.role === 'accountant') && (
            <button 
              className={`sidebar-item ${activePage === 'accounting' ? 'active' : ''}`}
              onClick={() => { setActivePage('accounting'); setIsSidebarOpen(false); }}
            >
              {t('Kế Toán & Lãi Gộp')}
            </button>
          )}

          {user.role === 'admin' && (
            <button 
              className={`sidebar-item ${activePage === 'users' ? 'active' : ''}`}
              onClick={() => { setActivePage('users'); setIsSidebarOpen(false); }}
            >
              {t('Quản Lý Tài Khoản')}
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <button 
            className="btn btn-outline" 
            style={{ width: '100%' }} 
            onClick={() => { handleLogout(); setIsSidebarOpen(false); }}
          >
            {t('Đăng Xuất')}
          </button>
        </div>
      </aside>

      {/* APP HEADER */}
      <header className="app-header">
        <div className="header-title-container">
          {/* Hamburger menu toggle button for mobile */}
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Menu</span>
          </button>
          <span className="header-title">{t('SUNFLOWER LABEL MANUFACTURING ERP')}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Globe Language Toggle */}
          <button 
            className="lang-toggle-btn" 
            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            title={language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>{language === 'vi' ? 'EN' : 'VI'}</span>
          </button>

          {/* DEMO LIVE SWITCH ROLE SELECTOR (Extremely Convenient for Testing) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-block' }}>{t('Chuyển nhanh vai trò:')}</span>
            <select 
              value={user.role} 
              onChange={e => handleSwitchRole(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', width: '115px' }}
            >
              <option value="admin">{t('Giám Đốc')}</option>
              <option value="sale">{t('Nhân Viên Sale')}</option>
              <option value="designer">{t('Thiết Kế')}</option>
              <option value="purchaser">{t('Mua Vật Tư')}</option>
              <option value="producer">{t('Sản Xuất')}</option>
              <option value="accountant">{t('Kế Toán')}</option>
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
