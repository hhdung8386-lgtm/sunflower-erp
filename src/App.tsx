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
import { ChatPage } from './views/ChatPage';
import { useLanguage } from './context/LanguageContext';
import { RecycleBin } from './views/RecycleBin';
import logo from './assets/logo.png';

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const { t, language, setLanguage } = useLanguage();

  const getDefaultPagesForRole = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return ['dashboard', 'chat', 'crm', 'sales', 'design', 'purchase', 'inventory', 'production', 'delivery', 'accounting', 'users', 'recycle_bin'];
      case 'sale':
        return ['dashboard', 'chat', 'crm', 'sales'];
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

  const isPageAllowed = (pageId: string): boolean => {
    if (!user) return false;
    const allowed = user.allowedPages || getDefaultPagesForRole(user.role);
    return allowed.includes(pageId);
  };
  
  // Collapsible sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('erp_sidebar_collapsed') === 'true';
  });
  
  // Real-time synchronization states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pos, setPOs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [productionCommands, setProductionCommands] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  // Navigation state links
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [selectedLsxId, setSelectedLsxId] = useState<string>('');

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
    const unsubMessages = dbService.subscribeCollection('messages', setMessages);

    return () => {
      unsubUsers();
      unsubCustomers();
      unsubPOs();
      unsubPurchases();
      unsubProduction();
      unsubDeliveries();
      unsubInvoices();
      unsubInventory();
      unsubMessages();
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

  const getUnreadChannelMessagesTotal = () => {
    if (!user) return 0;
    
    // Available channels for this role
    const channels = [
      { id: 'all', roles: ['admin', 'sale', 'designer', 'purchaser', 'producer', 'accountant'] },
      { id: 'accountant', roles: ['admin', 'accountant'] },
      { id: 'production', roles: ['admin', 'producer'] },
      { id: 'design', roles: ['admin', 'designer'] },
      { id: 'sale', roles: ['admin', 'sale'] },
      { id: 'purchase', roles: ['admin', 'purchaser'] },
    ];
    
    const userChannels = channels.filter(ch => ch.roles.includes(user.role));
    
    let total = 0;
    for (const ch of userChannels) {
      const lastReadStr = localStorage.getItem(`erp_last_read_ch_${ch.id}`);
      if (!lastReadStr) {
        total += messages.filter(msg => msg.type === 'channel' && msg.targetId === ch.id && msg.senderId !== user.uid).length;
      } else {
        const lastReadTime = new Date(lastReadStr).getTime();
        total += messages.filter(
          msg => msg.type === 'channel' && msg.targetId === ch.id && msg.senderId !== user.uid && new Date(msg.createdAt).getTime() > lastReadTime
        ).length;
      }
    }
    return total;
  };

  const refreshData = () => {
    // Triggers local list updates (Mock DB callbacks already trigger, this forces refresh where needed)
  };

  // View routing rendering selector
  const renderPageContent = () => {
    if (!user) return null;

    switch (activePage) {
      case 'crm':
        if (!isPageAllowed('crm')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Crm customers={customers} pos={pos} users={users} currentUser={user} onRefresh={refreshData} />;
      case 'sales':
        if (!isPageAllowed('sales')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return (
          <Sales 
            pos={pos} 
            customers={customers} 
            currentUser={user} 
            onRefresh={refreshData} 
            initialSelectedPoId={selectedPoId}
            messages={messages}
            users={users}
          />
        );
      case 'design':
        if (!isPageAllowed('design')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Design pos={pos} currentUser={user} onRefresh={refreshData} />;
      case 'purchase':
        if (!isPageAllowed('purchase')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Purchase pos={pos} purchaseOrders={purchaseOrders} currentUser={user} onRefresh={refreshData} users={users} />;
      case 'inventory':
        if (!isPageAllowed('inventory')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Inventory currentUser={user} onRefresh={refreshData} />;
      case 'production':
        if (!isPageAllowed('production')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return (
          <Production 
            pos={pos} 
            productionCommands={productionCommands} 
            currentUser={user} 
            onRefresh={refreshData} 
            initialSelectedLsxId={selectedLsxId}
            messages={messages}
            users={users}
          />
        );
      case 'delivery':
        if (!isPageAllowed('delivery')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Delivery pos={pos} currentUser={user} onRefresh={refreshData} />;
      case 'accounting':
        if (!isPageAllowed('accounting')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <Accounting pos={pos} currentUser={user} onRefresh={refreshData} users={users} />;
      case 'chat':
        if (!isPageAllowed('chat')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return (
          <ChatPage 
            currentUser={user}
            messages={messages}
            pos={pos}
            productionCommands={productionCommands}
            onNavigateToPO={(poId) => {
              setSelectedPoId(poId);
              setActivePage('sales');
            }}
            onNavigateToLSX={(lsxId) => {
              setSelectedLsxId(lsxId);
              setActivePage('production');
            }}
            users={users}
          />
        );
      case 'recycle_bin':
        if (!isPageAllowed('recycle_bin')) { setTimeout(() => setActivePage('dashboard'), 0); return null; }
        return <RecycleBin currentUser={user} onRefresh={refreshData} />;
      case 'users':
        if (!isPageAllowed('users')) {
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
      <div className="login-full-page">
        {/* Left Panel: Full-height Background Image + Overlay Text */}
        <div className="login-hero-panel">
          <div className="login-hero-overlay">
            <div className="login-hero-content">
              <div className="login-hero-badge">{t('SUNFLOWER LABEL ERP')}</div>
              <h1 className="login-hero-title">{t('SUNFLOWER LABEL ERP')}</h1>
              <p className="login-hero-sub">{t('Hệ thống quản trị sản xuất tem nhãn chuyên nghiệp')}</p>
              <div className="login-hero-divider"></div>
              <p className="login-hero-desc">
                {t('Giải pháp ERP toàn diện giúp tối ưu quy trình sản xuất tem nhãn từ nhận PO đến giao hàng và quản lý công nợ hiệu quả.')}
              </p>
              <div className="login-hero-flow">
                <span>PO</span>
                <span className="flow-arrow">→</span>
                <span>{t('Thiết kế')}</span>
                <span className="flow-arrow">→</span>
                <span>{t('Sản xuất')}</span>
                <span className="flow-arrow">→</span>
                <span>QC</span>
                <span className="flow-arrow">→</span>
                <span>{t('Giao hàng')}</span>
                <span className="flow-arrow">→</span>
                <span>{t('Thu công nợ')}</span>
              </div>
              <div className="login-hero-modules">
                <div className="hero-module">{t('Quản lý PO')}</div>
                <div className="hero-module">{t('Thiết kế & Duyệt mẫu')}</div>
                <div className="hero-module">{t('Theo dõi Sản xuất')}</div>
                <div className="hero-module">{t('Quản lý Nguyên vật liệu')}</div>
                <div className="hero-module">{t('Kiểm soát Chất lượng')}</div>
                <div className="hero-module">{t('Giao nhận & Giao hàng')}</div>
                <div className="hero-module">{t('Công nợ Khách hàng')}</div>
                <div className="hero-module">{t('Báo cáo & Phân tích')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Floating Login Card */}
        <div className="login-form-panel">
          <div className="login-card-glass">
            <div className="login-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <img src={logo} alt="Logo" style={{ height: '48px', width: '48px', marginBottom: '12px', objectFit: 'contain' }} />
              <h2 className="login-card-title">{t('Chào mừng trở lại')}</h2>
              <p className="login-card-subtitle">{t('Đăng nhập để tiếp tục làm việc')}</p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label className="login-label">{t('Tên đăng nhập')}</label>
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
                <label className="login-label">{t('Mật khẩu')}</label>
                <div className="input-wrapper password-input-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder={t('Nhập mật khẩu')}
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
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
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
                <div className="login-error-alert">{errorMsg}</div>
              )}

              <button type="submit" className="login-btn-submit">
                {t('Đăng Nhập Hệ Thống')}
              </button>
            </form>

            <div className="login-card-footer">
              <button 
                className="lang-toggle-btn" 
                onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span>{language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
              </button>
              <div className="login-footer-brand">
                <span>SUNFLOWER LABEL ERP v1.0</span>
                <span>© 2026 Sunflower Printing Solutions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Layout
  const unreadChannelCount = getUnreadChannelMessagesTotal();

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile backdrop overlay */}
      <div 
        className={`sidebar-overlay-mobile ${isSidebarOpen ? 'show' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* APP SIDEBAR NAVIGATION (Strictly Text Links, No Icons) */}
      <aside className={`app-sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logo} alt="Logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
          <span className="sidebar-logo-text">SUNFLOWER</span>
        </div>
        <nav className="sidebar-menu">
          {isPageAllowed('dashboard') && (
            <button 
              className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActivePage('dashboard'); setIsSidebarOpen(false); }}
            >
              {t('Tổng Quan Dashboards')}
            </button>
          )}

          {isPageAllowed('chat') && (
            <button 
              className={`sidebar-item ${activePage === 'chat' ? 'active' : ''}`}
              onClick={() => { setActivePage('chat'); setIsSidebarOpen(false); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{t('Kênh Thảo Luận')}</span>
              {unreadChannelCount > 0 && <span className="chat-channel-badge">{unreadChannelCount}</span>}
            </button>
          )}
          
          {isPageAllowed('crm') && (
            <button 
              className={`sidebar-item ${activePage === 'crm' ? 'active' : ''}`}
              onClick={() => { setActivePage('crm'); setIsSidebarOpen(false); }}
            >
              {t('Khách Hàng (CRM)')}
            </button>
          )}

          {isPageAllowed('sales') && (
            <button 
              className={`sidebar-item ${activePage === 'sales' ? 'active' : ''}`}
              onClick={() => { setActivePage('sales'); setIsSidebarOpen(false); }}
            >
              {t('Tiếp Nhận Đơn (Sale PO)')}
            </button>
          )}

          {isPageAllowed('design') && (
            <button 
              className={`sidebar-item ${activePage === 'design' ? 'active' : ''}`}
              onClick={() => { setActivePage('design'); setIsSidebarOpen(false); }}
            >
              {t('Thiết Kế & Layout')}
            </button>
          )}

          {isPageAllowed('purchase') && (
            <button 
              className={`sidebar-item ${activePage === 'purchase' ? 'active' : ''}`}
              onClick={() => { setActivePage('purchase'); setIsSidebarOpen(false); }}
            >
              {t('Mua Hàng & NCC')}
            </button>
          )}

          {isPageAllowed('inventory') && (
            <button 
              className={`sidebar-item ${activePage === 'inventory' ? 'active' : ''}`}
              onClick={() => { setActivePage('inventory'); setIsSidebarOpen(false); }}
            >
              {t('Kho Nguyên Vật Tư')}
            </button>
          )}

          {isPageAllowed('production') && (
            <button 
              className={`sidebar-item ${activePage === 'production' ? 'active' : ''}`}
              onClick={() => { setActivePage('production'); setIsSidebarOpen(false); }}
            >
              {t('Lệnh Sản Xuất (LSX)')}
            </button>
          )}

          {isPageAllowed('delivery') && (
            <button 
              className={`sidebar-item ${activePage === 'delivery' ? 'active' : ''}`}
              onClick={() => { setActivePage('delivery'); setIsSidebarOpen(false); }}
            >
              {t('Kế Hoạch Giao Hàng')}
            </button>
          )}

          {isPageAllowed('accounting') && (
            <button 
              className={`sidebar-item ${activePage === 'accounting' ? 'active' : ''}`}
              onClick={() => { setActivePage('accounting'); setIsSidebarOpen(false); }}
            >
              {t('Kế Toán & Lãi Gộp')}
            </button>
          )}

          {isPageAllowed('recycle_bin') && (
            <button 
              className={`sidebar-item ${activePage === 'recycle_bin' ? 'active' : ''}`}
              onClick={() => { setActivePage('recycle_bin'); setIsSidebarOpen(false); }}
              style={{ color: 'var(--color-danger)' }}
            >
              {t('Thùng Rác')}
            </button>
          )}

          {isPageAllowed('users') && (
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
          {/* Desktop sidebar toggle button */}
          <button 
            className="desktop-menu-btn" 
            onClick={() => {
              const nextVal = !isSidebarCollapsed;
              setIsSidebarCollapsed(nextVal);
              localStorage.setItem('erp_sidebar_collapsed', String(nextVal));
            }}
            title={isSidebarCollapsed ? t('Hiện menu') : t('Ẩn menu')}
          >
            ☰
          </button>
          
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
