import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './context/LanguageContext.tsx'

// Reset stale local storage mock data once on startup
if (!localStorage.getItem('erp_clean_slate_reset_v2')) {
  const keysToClear = [
    'erp_customers',
    'erp_pos',
    'erp_designs',
    'erp_suppliers',
    'erp_purchase_orders',
    'erp_production_commands',
    'erp_deliveries',
    'erp_delivery_vehicles',
    'erp_invoices',
    'erp_inventory',
    'erp_users',
    'erp_current_user'
  ];
  keysToClear.forEach(key => localStorage.removeItem(key));
  localStorage.setItem('erp_clean_slate_reset_v2', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
