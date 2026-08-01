import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Search,
  ShoppingBag,
  Truck,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDate } from '../domain/dateFormatting';
import {
  buildSupplierRecommendations,
  getSourcingTypeLabel,
  normalizeSupplierRecords,
  type ProcurementRequestRecord,
  type ProcurementStatus,
  type SourcingType,
  type SupplierRecord
} from '../domain/purchaseModels';
import { backfillProcurementRequests } from '../services/procurementService';
import { dbService, type UserProfile } from '../services/firebaseService';
import './Purchase.css';

type UnknownRecord = Record<string, unknown>;

interface PurchaseProps {
  pos: UnknownRecord[];
  purchaseOrders: UnknownRecord[];
  procurementRequests: ProcurementRequestRecord[];
  currentUser: UserProfile;
  onRefresh: () => void;
  users: UserProfile[];
}

const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const asNumber = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const asArray = (value: unknown): UnknownRecord[] => Array.isArray(value) ? value as UnknownRecord[] : [];

const normalizeSearchText = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/đ/g, 'd');

const matchesEveryTerm = (search: string, values: unknown[]): boolean => {
  const terms = normalizeSearchText(search).trim().split(/\s+/).filter(Boolean);
  const haystack = normalizeSearchText(values.filter(Boolean).join(' '));
  return terms.every(term => haystack.includes(term));
};

const ACTIVE_STATUSES: ProcurementStatus[] = ['new', 'reviewing', 'quoting', 'supplier_selected'];
const PURCHASE_PAGE_REFERENCE_TIME = Date.now();

export const Purchase: React.FC<PurchaseProps> = ({
  pos,
  purchaseOrders,
  procurementRequests,
  currentUser,
  onRefresh,
  users
}) => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [invoices, setInvoices] = useState<UnknownRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourcingFilter, setSourcingFilter] = useState<'all' | SourcingType>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [activeListView, setActiveListView] = useState<'requests' | 'orders'>('requests');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [expectedReceiveDate, setExpectedReceiveDate] = useState('');
  const [assignedPurchaserId, setAssignedPurchaserId] = useState('');
  const [sourcingType, setSourcingType] = useState<SourcingType>('subcontract');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribeSuppliers = dbService.subscribeCollection('suppliers', data => {
      setSuppliers(normalizeSupplierRecords(data).filter(supplier => !supplier.deleted));
    });
    const unsubscribeInvoices = dbService.subscribeCollection('invoices', data => setInvoices(data));
    return () => {
      unsubscribeSuppliers();
      unsubscribeInvoices();
    };
  }, []);

  useEffect(() => {
    if (pos.length === 0) return;
    void backfillProcurementRequests(pos, currentUser).catch(error => {
      console.error('Unable to synchronize procurement requests:', error);
    });
  }, [currentUser, pos]);

  const purchasers = useMemo(() => users.filter(user => user.role === 'purchaser'), [users]);
  const months = useMemo(() => Array.from(new Set([
    ...procurementRequests.map(request => request.createdAt.slice(0, 7)),
    ...purchaseOrders.map(order => asText(order.createdAt).slice(0, 7))
  ].filter(Boolean))).sort().reverse(), [procurementRequests, purchaseOrders]);

  const accessibleRequests = useMemo(() => procurementRequests.filter(request => {
    if (request.deleted) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'accountant') return true;
    return !request.assignedPurchaserId || request.assignedPurchaserId === currentUser.uid;
  }), [currentUser.role, currentUser.uid, procurementRequests]);

  const filteredRequests = useMemo(() => accessibleRequests.filter(request => {
    const matchesSourcing = sourcingFilter === 'all' || request.sourcingType === sourcingFilter;
    const matchesMonth = monthFilter === 'all' || request.createdAt.startsWith(monthFilter);
    const matchesSearch = matchesEveryTerm(searchTerm, [
      request.requestCode,
      request.poCode,
      request.customerName,
      request.productCode,
      request.productName,
      request.material,
      request.size,
      request.selectedSupplierName,
      request.assignedPurchaserName,
      getSourcingTypeLabel(request.sourcingType)
    ]);
    return ACTIVE_STATUSES.includes(request.status) && matchesSourcing && matchesMonth && matchesSearch;
  }), [accessibleRequests, monthFilter, searchTerm, sourcingFilter]);

  const filteredPurchaseOrders = useMemo(() => purchaseOrders.filter(order => {
    if (order.deleted === true) return false;
    const matchesSourcing = sourcingFilter === 'all' || asText(order.sourcingType) === sourcingFilter;
    const matchesMonth = monthFilter === 'all' || asText(order.createdAt).startsWith(monthFilter);
    const matchesSearch = matchesEveryTerm(searchTerm, [
      order.purCode,
      order.supplierName,
      order.linkedPoCode,
      order.assignedPurchaserName,
      asArray(order.items).map(item => [
        item.productCode,
        item.productName,
        item.materialName,
        item.size
      ])
    ]);
    return matchesSourcing && matchesMonth && matchesSearch;
  }), [monthFilter, purchaseOrders, searchTerm, sourcingFilter]);

  const selectedRequest = accessibleRequests.find(request => request.id === selectedRequestId) || null;
  const recommendations = useMemo(() => selectedRequest
    ? buildSupplierRecommendations(selectedRequest, suppliers, purchaseOrders)
    : [], [purchaseOrders, selectedRequest, suppliers]);

  const selectedSupplierHistory = useMemo(() => purchaseOrders
    .filter(order => order.deleted !== true && asText(order.supplierId) === supplierId)
    .sort((a, b) => Date.parse(asText(b.createdAt)) - Date.parse(asText(a.createdAt)))
    .flatMap(order => {
      const items = asArray(order.items);
      return (items.length > 0 ? items : [{}]).map((item, itemIndex) => ({
        key: `${asText(order.id) || asText(order.purCode)}-${asText(item.poItemId) || itemIndex}`,
        orderCode: asText(order.purCode),
        orderedAt: asText(order.createdAt),
        receivedAt: asText(order.actualReceiveDate),
        productName: asText(item.materialName ?? item.productName) || '—',
        quantity: asNumber(item.quantity),
        unit: asText(item.unit),
        unitPrice: asNumber(item.unitPrice),
        totalPrice: asNumber(item.totalPrice) || asNumber(item.quantity) * asNumber(item.unitPrice)
      }));
    }), [purchaseOrders, supplierId]);

  const selectedSupplierName = suppliers.find(supplier => supplier.id === supplierId)?.supplierName || '';

  const openRequest = (request: ProcurementRequestRecord) => {
    const recommended = buildSupplierRecommendations(request, suppliers, purchaseOrders)[0];
    setSelectedRequestId(request.id);
    setSupplierId(request.selectedSupplierId || recommended?.supplier.id || '');
    setUnitPrice(request.selectedUnitPrice || recommended?.lastUnitPrice || 0);
    setExpectedReceiveDate(request.requiredDate?.slice(0, 10) || '');
    setAssignedPurchaserId(
      request.assignedPurchaserId
      || (currentUser.role === 'purchaser' ? currentUser.uid : purchasers[0]?.uid || '')
    );
    setSourcingType(request.sourcingType);
  };

  const handleUpdateRequestStatus = async (request: ProcurementRequestRecord, status: ProcurementStatus) => {
    const purchaser = purchasers.find(user => user.uid === (request.assignedPurchaserId || assignedPurchaserId));
    await dbService.updateDocument('procurement_requests', request.id, {
      status,
      assignedPurchaserId: request.assignedPurchaserId || assignedPurchaserId,
      assignedPurchaserName: request.assignedPurchaserName || purchaser?.displayName || '',
      updatedBy: currentUser.displayName
    });
  };

  const handleCreatePurchaseOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRequest || !supplierId || unitPrice <= 0 || !expectedReceiveDate) return;
    const supplier = suppliers.find(candidate => candidate.id === supplierId);
    if (!supplier) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const purchaser = purchasers.find(user => user.uid === assignedPurchaserId);
      const purCode = `PUR-${now.slice(2, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const totalPrice = selectedRequest.quantity * unitPrice;
      const createdOrder = await dbService.addDocument('purchase_orders', {
        purCode,
        procurementRequestId: selectedRequest.id,
        supplierId: supplier.id,
        supplierName: supplier.supplierName,
        linkedPoId: selectedRequest.poId,
        linkedPoCode: selectedRequest.poCode,
        sourcingType,
        items: [{
          poItemId: selectedRequest.poItemId,
          productCode: selectedRequest.productCode,
          productName: selectedRequest.productName,
          materialName: selectedRequest.material || selectedRequest.productName,
          size: selectedRequest.size,
          quantity: selectedRequest.quantity,
          unit: selectedRequest.unit,
          unitPrice,
          totalPrice
        }],
        totalPrice,
        status: 'ordered',
        expectedReceiveDate: new Date(`${expectedReceiveDate}T00:00:00`).toISOString(),
        actualReceiveDate: '',
        assignedPurchaserId,
        assignedPurchaserName: purchaser?.displayName || '',
        createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        createdAt: now
      });

      await dbService.updateDocument('procurement_requests', selectedRequest.id, {
        sourcingType,
        status: 'ordered',
        selectedSupplierId: supplier.id,
        selectedSupplierName: supplier.supplierName,
        selectedUnitPrice: unitPrice,
        assignedPurchaserId,
        assignedPurchaserName: purchaser?.displayName || '',
        purchaseOrderId: createdOrder.id,
        purchaseOrderCode: purCode,
        updatedBy: currentUser.displayName
      });

      const po = pos.find(candidate => asText(candidate.id) === selectedRequest.poId);
      if (po) {
        const updatedItems = asArray(po.items).map((item, index) => (
          asText(item.itemId) === selectedRequest.poItemId || index === selectedRequest.poItemIndex
            ? {
                ...item,
                sourcingType,
                supplierId: supplier.id,
                supplierName: supplier.supplierName,
                purchasePrice: unitPrice,
                purchaseNeedsReview: false
              }
            : item
        ));
        await dbService.updateDocument('pos', selectedRequest.poId, {
          items: updatedItems,
          purchaseProgress: 'supplier_ordered',
          historyLogs: [
            ...asArray(po.historyLogs),
            {
              status: asText(po.status),
              updatedBy: currentUser.displayName,
              updatedAt: now,
              note: `Mua hàng đã chọn ${supplier.supplierName} cho ${selectedRequest.productName}; đơn mua ${purCode}, giá ${unitPrice.toLocaleString('vi-VN')} đ/${selectedRequest.unit}.`
            }
          ]
        });
      }

      setSelectedRequestId('');
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReceiveOrder = async (order: UnknownRecord) => {
    if (!window.confirm(`${t('Xác nhận đã nhận đủ hàng cho')} ${asText(order.purCode)}?`)) return;
    const now = new Date().toISOString();
    const request = procurementRequests.find(candidate => candidate.id === asText(order.procurementRequestId));
    const orderItems = asArray(order.items);

    if (asText(order.sourcingType) === 'raw_material') {
      const inventory = await dbService.getCollection('inventory');
      for (const item of orderItems) {
        const materialName = asText(item.materialName ?? item.productName);
        const match = inventory.find(candidate => normalizeSearchText(candidate.materialName) === normalizeSearchText(materialName));
        if (match) {
          await dbService.updateDocument('inventory', match.id, {
            qtyInStock: asNumber(match.qtyInStock) + asNumber(item.quantity),
            updatedAt: now
          });
        } else {
          await dbService.addDocument('inventory', {
            materialName,
            category: normalizeSearchText(materialName).includes('muc') ? 'ink' : normalizeSearchText(materialName).includes('mang') ? 'film' : 'paper',
            qtyInStock: asNumber(item.quantity),
            qtyReserved: 0,
            minQtyAlert: 50,
            unit: asText(item.unit),
            defaultSupplierId: asText(order.supplierId),
            createdAt: now
          });
        }
      }
    }

    const invoiceExists = invoices.some(invoice => (
      invoice.type === 'payable' && asText(invoice.poId) === asText(order.id)
    ));
    if (!invoiceExists) {
      await dbService.addDocument('invoices', {
        invoiceCode: `INV-${asText(order.purCode).replace('PUR-', '')}`,
        poId: asText(order.id),
        poCode: asText(order.purCode),
        customerId: asText(order.supplierId),
        customerName: asText(order.supplierName),
        type: 'payable',
        amount: asNumber(order.totalPrice),
        paidAmount: 0,
        status: 'unpaid',
        dueDate: new Date(Date.parse(now) + 30 * 86_400_000).toISOString(),
        createdAt: now
      });
    }

    await dbService.updateDocument('purchase_orders', asText(order.id), {
      status: 'received',
      actualReceiveDate: now,
      updatedBy: currentUser.displayName
    });
    if (request) {
      await dbService.updateDocument('procurement_requests', request.id, {
        status: 'received',
        updatedBy: currentUser.displayName
      });
      const po = pos.find(candidate => asText(candidate.id) === request.poId);
      if (po) {
        await dbService.updateDocument('pos', request.poId, {
          purchaseProgress: 'materials_received',
          historyLogs: [...asArray(po.historyLogs), {
            status: asText(po.status),
            updatedBy: currentUser.displayName,
            updatedAt: now,
            note: `Đã nhận hàng từ ${asText(order.supplierName)} theo đơn ${asText(order.purCode)}.`
          }]
        });
      }
    }
    onRefresh();
  };

  return (
    <div className="purchase-page">
      <div className="page-header">
        <div><h1 className="page-title">{t('MUA HÀNG')}</h1><p className="page-subtitle">{t('Tiếp nhận nhu cầu từ Sale PO, chọn phương án cung ứng, đề xuất nhà cung cấp và theo dõi đơn mua.')}</p></div>
      </div>

      <section className="purchase-panel purchase-list-card">
        <div className="purchase-list-tabs" role="tablist" aria-label={t('Chọn danh sách mua hàng')}>
          <button type="button" className={`purchase-list-tab ${activeListView === 'requests' ? 'is-active' : ''}`} onClick={() => { setActiveListView('requests'); setSearchTerm(''); }} role="tab" aria-selected={activeListView === 'requests'}>
            <ClipboardList size={16} /><span>{t('Yêu cầu từ Sale PO')}</span><span className="purchase-list-tab__count">{filteredRequests.length}</span>
          </button>
          <button type="button" className={`purchase-list-tab ${activeListView === 'orders' ? 'is-active' : ''}`} onClick={() => { setActiveListView('orders'); setSearchTerm(''); }} role="tab" aria-selected={activeListView === 'orders'}>
            <ShoppingBag size={16} /><span>{t('Đơn mua đã phát hành')}</span><span className="purchase-list-tab__count">{filteredPurchaseOrders.length}</span>
          </button>
        </div>

        <div className="purchase-toolbar">
          <div className="purchase-search"><Search size={16} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={activeListView === 'requests' ? t('Tìm mã PO, khách hàng, mã hàng, vật liệu hoặc NCC...') : t('Tìm mã đơn mua, NCC, PO khách hàng hoặc mặt hàng...')} /></div>
          <select value={sourcingFilter} onChange={event => setSourcingFilter(event.target.value as typeof sourcingFilter)}><option value="all">{t('Tất cả phương án')}</option>{(['finished_good', 'raw_material', 'subcontract'] as SourcingType[]).map(type => <option key={type} value={type}>{getSourcingTypeLabel(type)}</option>)}</select>
          <select value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">{t('Tất cả tháng')}</option>{months.map(month => <option key={month}>{month}</option>)}</select>
        </div>

        {activeListView === 'requests' ? (
          <div className="table-container">
            <table className="purchase-request-table">
              <thead><tr><th>{t('Yêu cầu / PO')}</th><th>{t('Khách hàng')}</th><th>{t('Mặt hàng')}</th><th>{t('Phương án cung ứng')}</th><th>{t('Số lượng')}</th><th>{t('Ngày cần')}</th><th>{t('Mua hàng phụ trách')}</th><th>{t('NCC')}</th><th>{t('Thao tác')}</th></tr></thead>
              <tbody>
                {filteredRequests.map(request => <tr key={request.id}>
                  <td><strong className="purchase-request-code">{request.requestCode}{request.status === 'new' && <span className="purchase-new-tag"><i />NEW</span>}</strong><span>{request.poCode}</span></td>
                  <td><strong>{request.customerName || '—'}</strong></td>
                  <td><strong>{request.productName}</strong><span>{[request.productCode, request.material, request.size].filter(Boolean).join(' · ')}</span></td>
                  <td><span className={`sourcing-badge sourcing-badge--${request.sourcingType}`}>{getSourcingTypeLabel(request.sourcingType)}</span></td>
                  <td><strong>{request.quantity.toLocaleString('vi-VN')} {request.unit}</strong></td>
                  <td><span className={request.requiredDate && Date.parse(request.requiredDate) < PURCHASE_PAGE_REFERENCE_TIME && request.status !== 'received' ? 'purchase-date-overdue' : ''}>{formatDate(request.requiredDate, 'vi-VN', '—')}</span></td>
                  <td>{request.assignedPurchaserName || t('Chưa phân công')}</td>
                  <td>{request.selectedSupplierName || '—'}</td>
                  <td><div className="purchase-row-actions">
                    {request.status === 'new' && <button type="button" className="btn btn-sm btn-outline" onClick={() => handleUpdateRequestStatus(request, 'reviewing')}>{t('Tiếp nhận')}</button>}
                    {ACTIVE_STATUSES.includes(request.status) && <button type="button" className="btn btn-sm btn-primary" onClick={() => openRequest(request)}>{t('Chọn NCC')}</button>}
                    {request.purchaseOrderCode && <span>{request.purchaseOrderCode}</span>}
                  </div></td>
                </tr>)}
                {filteredRequests.length === 0 && <tr><td colSpan={9} className="purchase-empty">{t('Không có yêu cầu mua hàng phù hợp.')}</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container">
            <table className="purchase-table">
              <thead><tr><th>{t('Mã đơn mua')}</th><th>{t('Nhà cung cấp')}</th><th>{t('PO khách hàng')}</th><th>{t('Mặt hàng')}</th><th>{t('Giá trị')}</th><th>{t('Ngày nhận dự kiến')}</th><th>{t('Thao tác')}</th></tr></thead>
              <tbody>
                {filteredPurchaseOrders.map(order => <tr key={asText(order.id)}>
                  <td><strong>{asText(order.purCode)}</strong></td><td>{asText(order.supplierName)}</td><td>{asText(order.linkedPoCode) || '—'}</td>
                  <td>{asArray(order.items).map(item => `${asText(item.materialName ?? item.productName)} (${asNumber(item.quantity).toLocaleString('vi-VN')} ${asText(item.unit)})`).join(', ')}</td>
                  <td><strong>{asNumber(order.totalPrice).toLocaleString('vi-VN')} đ</strong></td><td>{formatDate(asText(order.expectedReceiveDate), 'vi-VN', '—')}</td>
                  <td>{asText(order.status) !== 'received' && <button type="button" className="btn btn-sm btn-outline" onClick={() => handleReceiveOrder(order)}><Truck size={14} /> {t('Xác nhận nhận hàng')}</button>}</td>
                </tr>)}
                {filteredPurchaseOrders.length === 0 && <tr><td colSpan={7} className="purchase-empty">{t('Chưa có đơn mua phù hợp.')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content procurement-modal">
            <div className="modal-header"><div><strong>{t('CHỌN NHÀ CUNG CẤP')}</strong><span>{selectedRequest.requestCode} · {selectedRequest.poCode}</span></div><button type="button" className="btn btn-outline btn-symbol-sm" onClick={() => setSelectedRequestId('')}><X size={16} /></button></div>
            <form onSubmit={handleCreatePurchaseOrder}>
              <div className="modal-body">
                <div className="procurement-context">
                  <div><span>{t('Khách hàng')}</span><strong>{selectedRequest.customerName}</strong></div><div><span>{t('Mặt hàng')}</span><strong>{selectedRequest.productName}</strong></div><div><span>{t('Quy cách')}</span><strong>{[selectedRequest.material, selectedRequest.size].filter(Boolean).join(' · ') || '—'}</strong></div><div><span>{t('Số lượng')}</span><strong>{selectedRequest.quantity.toLocaleString('vi-VN')} {selectedRequest.unit}</strong></div>
                </div>

                <section className="recommendation-section">
                  <div className="panel-heading-row"><h3>{t('NCC được đề xuất từ lịch sử mua')}</h3><small>{t('Điểm dựa trên mặt hàng tương tự, giá, số lần mua, giao đúng hạn và đánh giá.')}</small></div>
                  <div className="recommendation-grid">
                    {recommendations.map((recommendation, index) => <button type="button" key={recommendation.supplier.id} className={`recommendation-card ${supplierId === recommendation.supplier.id ? 'is-selected' : ''}`} onClick={() => { setSupplierId(recommendation.supplier.id); if (recommendation.lastUnitPrice) setUnitPrice(recommendation.lastUnitPrice); }}>
                      <div><span>#{index + 1}</span><strong>{recommendation.score} {t('điểm')}</strong></div>
                      <h4>{recommendation.supplier.supplierName}</h4>
                      {recommendation.reasons.slice(0, 3).map(reason => <p key={reason}>• {reason}</p>)}
                    </button>)}
                    {recommendations.length === 0 && <div className="purchase-empty">{t('Chưa có NCC hoạt động. Hãy thêm NCC trong Danh sách nhà cung cấp.')}</div>}
                  </div>

                  {supplierId && (
                    <div className="supplier-supply-history">
                      <div className="supplier-supply-history__header">
                        <div><strong>{t('Lịch sử cung ứng')}</strong><span>{selectedSupplierName}</span></div>
                        <span>{selectedSupplierHistory.length} {t('lần cung ứng')}</span>
                      </div>
                      {selectedSupplierHistory.length > 0 ? (
                        <div className="table-container supplier-supply-history__table-wrap">
                          <table>
                            <thead><tr><th>{t('Đơn mua')}</th><th>{t('Ngày đặt')}</th><th>{t('Mặt hàng')}</th><th>{t('Số lượng')}</th><th>{t('Đơn giá')}</th><th>{t('Thành tiền')}</th><th>{t('Ngày nhận')}</th></tr></thead>
                            <tbody>{selectedSupplierHistory.map(history => <tr key={history.key}>
                              <td><strong>{history.orderCode || '—'}</strong></td>
                              <td>{formatDate(history.orderedAt, 'vi-VN', '—')}</td>
                              <td>{history.productName}</td>
                              <td>{history.quantity.toLocaleString('vi-VN')} {history.unit}</td>
                              <td>{history.unitPrice.toLocaleString('vi-VN')} đ</td>
                              <td><strong>{history.totalPrice.toLocaleString('vi-VN')} đ</strong></td>
                              <td>{formatDate(history.receivedAt, 'vi-VN', '—')}</td>
                            </tr>)}</tbody>
                          </table>
                        </div>
                      ) : <p className="purchase-empty">{t('Nhà cung cấp này chưa có lần cung ứng nào trước đây.')}</p>}
                    </div>
                  )}
                </section>

                <div className="procurement-form-grid">
                  <div className="form-group"><label>{t('Phương án cung ứng')}</label><select value={sourcingType} onChange={event => setSourcingType(event.target.value as SourcingType)}>{(['finished_good', 'raw_material', 'subcontract'] as SourcingType[]).map(type => <option key={type} value={type}>{getSourcingTypeLabel(type)}</option>)}</select></div>
                  <div className="form-group"><label>{t('Nhà cung cấp *')}</label><select value={supplierId} onChange={event => setSupplierId(event.target.value)} required><option value="">{t('Chọn nhà cung cấp')}</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>)}</select></div>
                  <div className="form-group"><label>{t('Đơn giá mua *')}</label><input type="number" min="1" value={unitPrice} onChange={event => setUnitPrice(Number(event.target.value))} required /></div>
                  <div className="form-group"><label>{t('Ngày nhận dự kiến *')}</label><input type="date" value={expectedReceiveDate} onChange={event => setExpectedReceiveDate(event.target.value)} required /></div>
                  <div className="form-group"><label>{t('Nhân viên mua hàng')}</label><select value={assignedPurchaserId} onChange={event => setAssignedPurchaserId(event.target.value)}><option value="">{t('Chưa phân công')}</option>{purchasers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></div>
                  <div className="procurement-total"><span>{t('Tổng tiền dự kiến')}</span><strong>{(selectedRequest.quantity * unitPrice).toLocaleString('vi-VN')} đ</strong></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setSelectedRequestId('')}>{t('Hủy')}</button><button type="submit" className="btn btn-primary" disabled={isSaving || !supplierId}>{isSaving ? t('Đang lưu...') : t('Chọn NCC & tạo đơn mua')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
