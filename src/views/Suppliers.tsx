import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Star,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getSourcingTypeLabel,
  normalizeSupplierRecords,
  type SourcingType,
  type SupplierContactRecord,
  type SupplierDocumentRecord,
  type SupplierRecord
} from '../domain/purchaseModels';
import { formatDate, formatDateTime } from '../domain/dateFormatting';
import { dbService, type UserProfile } from '../services/firebaseService';
import './Purchase.css';

type UnknownRecord = Record<string, unknown>;

interface SuppliersProps {
  purchaseOrders: UnknownRecord[];
  currentUser: UserProfile;
  users: UserProfile[];
}

interface SupplierFormState {
  supplierName: string;
  supplierCode: string;
  taxCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  province: string;
  categoriesText: string;
  serviceTypes: SourcingType[];
  paymentTerms: string;
  bankName: string;
  bankAccount: string;
  assignedPurchaserId: string;
  rating: number;
  note: string;
}

const EMPTY_FORM: SupplierFormState = {
  supplierName: '',
  supplierCode: '',
  taxCode: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  province: '',
  categoriesText: '',
  serviceTypes: [],
  paymentTerms: '',
  bankName: '',
  bankAccount: '',
  assignedPurchaserId: '',
  rating: 0,
  note: ''
};

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

const parseCategories = (value: string): string[] => Array.from(new Set(
  value.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean)
));

export const Suppliers: React.FC<SuppliersProps> = ({ purchaseOrders, currentUser, users }) => {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [invoices, setInvoices] = useState<UnknownRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState('');
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [activityNote, setActivityNote] = useState('');
  const [contactDraft, setContactDraft] = useState({ name: '', role: '', phone: '', email: '' });
  const [historyMonth, setHistoryMonth] = useState('all');

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

  const purchasers = useMemo(() => users.filter(user => user.role === 'purchaser'), [users]);
  const selectedSupplier = suppliers.find(supplier => supplier.id === selectedSupplierId) || null;
  const categories = useMemo(() => Array.from(new Set(
    suppliers.flatMap(supplier => supplier.categories)
  )).sort(), [suppliers]);
  const months = useMemo(() => Array.from(new Set(
    purchaseOrders.map(order => asText(order.createdAt).slice(0, 7)).filter(Boolean)
  )).sort().reverse(), [purchaseOrders]);

  const getSupplierOrders = useCallback((supplierId: string): UnknownRecord[] => purchaseOrders
    .filter(order => asText(order.supplierId) === supplierId && order.deleted !== true)
    .sort((a, b) => Date.parse(asText(b.createdAt)) - Date.parse(asText(a.createdAt))), [purchaseOrders]);

  const getSupplierDebt = (supplierId: string): number => invoices
    .filter(invoice => invoice.type === 'payable' && asText(invoice.customerId) === supplierId)
    .reduce((total, invoice) => total + Math.max(0, asNumber(invoice.amount) - asNumber(invoice.paidAmount)), 0);

  const filteredSuppliers = useMemo(() => suppliers.filter(supplier => {
    const orders = getSupplierOrders(supplier.id);
    const matchesSearch = matchesEveryTerm(searchTerm, [
      supplier.supplierCode,
      supplier.supplierName,
      supplier.taxCode,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.address,
      supplier.province,
      supplier.categories,
      supplier.note,
      orders.map(order => [order.purCode, order.linkedPoCode, asArray(order.items).map(item => item.materialName)])
    ]);
    const matchesCategory = categoryFilter === 'all' || supplier.categories.includes(categoryFilter);
    const matchesMonth = monthFilter === 'all' || orders.some(order => asText(order.createdAt).startsWith(monthFilter));
    return matchesSearch && matchesCategory && matchesMonth;
  }), [categoryFilter, getSupplierOrders, monthFilter, searchTerm, suppliers]);

  const openCreateForm = () => {
    setEditingSupplierId('');
    setForm({
      ...EMPTY_FORM,
      assignedPurchaserId: currentUser.role === 'purchaser' ? currentUser.uid : ''
    });
    setShowForm(true);
  };

  const openEditForm = (supplier: SupplierRecord) => {
    setEditingSupplierId(supplier.id);
    setForm({
      supplierName: supplier.supplierName,
      supplierCode: supplier.supplierCode,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      province: supplier.province,
      categoriesText: supplier.categories.join(', '),
      serviceTypes: supplier.serviceTypes,
      paymentTerms: supplier.paymentTerms,
      bankName: supplier.bankName,
      bankAccount: supplier.bankAccount,
      assignedPurchaserId: supplier.assignedPurchaserId,
      rating: supplier.rating,
      note: supplier.note
    });
    setShowForm(true);
  };

  const updateForm = <K extends keyof SupplierFormState>(field: K, value: SupplierFormState[K]) => {
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const toggleServiceType = (value: SourcingType) => {
    updateForm('serviceTypes', form.serviceTypes.includes(value)
      ? form.serviceTypes.filter(item => item !== value)
      : [...form.serviceTypes, value]);
  };

  const handleSaveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.supplierName.trim()) return;
    const assignedPurchaser = purchasers.find(user => user.uid === form.assignedPurchaserId);
    const current = suppliers.find(supplier => supplier.id === editingSupplierId);
    const primaryContact: SupplierContactRecord = {
      id: current?.contacts.find(contact => contact.primary)?.id || `supplier-contact-${Date.now()}`,
      name: form.contactPerson.trim(),
      role: 'Liên hệ chính',
      phone: form.phone.trim(),
      email: form.email.trim(),
      primary: true
    };
    const payload = {
      supplierCode: form.supplierCode.trim() || `NCC-${String(suppliers.length + 1).padStart(4, '0')}`,
      supplierName: form.supplierName.trim(),
      taxCode: form.taxCode.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      province: form.province.trim(),
      categories: parseCategories(form.categoriesText),
      serviceTypes: form.serviceTypes,
      paymentTerms: form.paymentTerms.trim(),
      bankName: form.bankName.trim(),
      bankAccount: form.bankAccount.trim(),
      assignedPurchaserId: form.assignedPurchaserId,
      assignedPurchaserName: assignedPurchaser?.displayName || '',
      status: current?.status || 'active',
      rating: Number(form.rating),
      note: form.note.trim(),
      contacts: [primaryContact, ...(current?.contacts || []).filter(contact => !contact.primary)],
      updatedBy: currentUser.displayName
    };

    if (editingSupplierId) {
      await dbService.updateDocument('suppliers', editingSupplierId, payload);
    } else {
      const created = await dbService.addDocument('suppliers', {
        ...payload,
        contracts: [],
        documents: [],
        activities: [],
        createdAt: new Date().toISOString(),
        createdBy: currentUser.displayName,
        deleted: false
      });
      setSelectedSupplierId(created.id);
    }
    setShowForm(false);
  };

  const handleAddActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier || !activityNote.trim()) return;
    const now = new Date().toISOString();
    const activity = {
      id: `supplier-activity-${now}`,
      type: 'note',
      note: activityNote.trim(),
      occurredAt: now,
      createdById: currentUser.uid,
      createdByName: currentUser.displayName
    };
    await dbService.updateDocument('suppliers', selectedSupplier.id, {
      activities: [activity, ...selectedSupplier.activities],
      updatedBy: currentUser.displayName
    });
    setActivityNote('');
  };

  const handleAddContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier || !contactDraft.name.trim()) return;
    const now = new Date().toISOString();
    const contact: SupplierContactRecord = {
      id: `supplier-contact-${now}`,
      name: contactDraft.name.trim(),
      role: contactDraft.role.trim(),
      phone: contactDraft.phone.trim(),
      email: contactDraft.email.trim(),
      primary: false
    };
    await dbService.updateDocument('suppliers', selectedSupplier.id, {
      contacts: [...selectedSupplier.contacts, contact],
      updatedBy: currentUser.displayName
    });
    setContactDraft({ name: '', role: '', phone: '', email: '' });
  };

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSupplier) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const now = new Date().toISOString();
    const document: SupplierDocumentRecord = {
      id: `supplier-document-${now}`,
      name: file.name,
      category: 'other',
      data,
      uploadedAt: now,
      uploadedBy: currentUser.displayName
    };
    await dbService.updateDocument('suppliers', selectedSupplier.id, {
      documents: [document, ...selectedSupplier.documents],
      updatedBy: currentUser.displayName
    });
    event.target.value = '';
  };

  const totalSpend = purchaseOrders.reduce((sum, order) => sum + (order.deleted === true ? 0 : asNumber(order.totalPrice)), 0);
  const supplierWithOrdersCount = suppliers.filter(supplier => getSupplierOrders(supplier.id).length > 0).length;

  if (selectedSupplier) {
    const supplierOrders = getSupplierOrders(selectedSupplier.id);
    const visibleOrders = historyMonth === 'all'
      ? supplierOrders
      : supplierOrders.filter(order => asText(order.createdAt).startsWith(historyMonth));
    const supplierSpend = supplierOrders.reduce((sum, order) => sum + asNumber(order.totalPrice), 0);
    const supplierDebt = getSupplierDebt(selectedSupplier.id);
    return (
      <div className="suppliers-page">
        <div className="supplier-detail-header">
          <button type="button" className="btn btn-outline" onClick={() => setSelectedSupplierId('')}>
            ← {t('Quay lại danh sách')}
          </button>
          <div>
            <h1>{selectedSupplier.supplierName}</h1>
            <p>{selectedSupplier.supplierCode || selectedSupplier.id} · {selectedSupplier.categories.join(', ') || t('Chưa phân loại')}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => openEditForm(selectedSupplier)}><Pencil size={15} /> {t('Chỉnh sửa')}</button>
        </div>

        <div className="supplier-kpi-grid">
          <div><ReceiptText size={18} /><strong>{supplierOrders.length}</strong><span>{t('Đơn mua')}</span></div>
          <div><Building2 size={18} /><strong>{supplierSpend.toLocaleString('vi-VN')} đ</strong><span>{t('Tổng giá trị mua')}</span></div>
          <div><CalendarDays size={18} /><strong>{formatDate(asText(supplierOrders[0]?.createdAt), 'vi-VN', '—')}</strong><span>{t('Lần mua gần nhất')}</span></div>
          <div><Star size={18} /><strong>{selectedSupplier.rating || '—'}/5</strong><span>{t('Đánh giá')}</span></div>
          <div><FileText size={18} /><strong>{supplierDebt.toLocaleString('vi-VN')} đ</strong><span>{t('Công nợ phải trả')}</span></div>
        </div>

        <div className="supplier-detail-grid">
          <section className="purchase-panel">
            <h2>{t('Thông tin doanh nghiệp')}</h2>
            <div className="supplier-info-grid">
              <div><Building2 size={15} /><span>{t('Mã số thuế')}</span><strong>{selectedSupplier.taxCode || '—'}</strong></div>
              <div><MapPin size={15} /><span>{t('Địa chỉ')}</span><strong>{selectedSupplier.address || '—'}</strong></div>
              <div><Phone size={15} /><span>{t('Điện thoại')}</span><strong>{selectedSupplier.phone || '—'}</strong></div>
              <div><Mail size={15} /><span>Email</span><strong>{selectedSupplier.email || '—'}</strong></div>
              <div><ReceiptText size={15} /><span>{t('Điều khoản thanh toán')}</span><strong>{selectedSupplier.paymentTerms || '—'}</strong></div>
              <div><Building2 size={15} /><span>{t('Tài khoản ngân hàng')}</span><strong>{[selectedSupplier.bankName, selectedSupplier.bankAccount].filter(Boolean).join(' · ') || '—'}</strong></div>
            </div>
            {selectedSupplier.note && <div className="supplier-note"><strong>{t('Ghi chú')}</strong><p>{selectedSupplier.note}</p></div>}
          </section>

          <section className="purchase-panel">
            <h2>{t('Người liên hệ')}</h2>
            <div className="supplier-contact-list">
              {selectedSupplier.contacts.map(contact => (
                <div key={contact.id}>
                  <strong>{contact.name || '—'} {contact.primary && <span>{t('Chính')}</span>}</strong>
                  <small>{contact.role || t('Chưa có chức danh')}</small>
                  <small>{[contact.phone, contact.email].filter(Boolean).join(' · ') || '—'}</small>
                </div>
              ))}
            </div>
            <form className="supplier-inline-form" onSubmit={handleAddContact}>
              <input value={contactDraft.name} onChange={event => setContactDraft(previous => ({ ...previous, name: event.target.value }))} placeholder={t('Tên liên hệ')} required />
              <input value={contactDraft.role} onChange={event => setContactDraft(previous => ({ ...previous, role: event.target.value }))} placeholder={t('Chức vụ')} />
              <input value={contactDraft.phone} onChange={event => setContactDraft(previous => ({ ...previous, phone: event.target.value }))} placeholder={t('Số điện thoại')} />
              <input value={contactDraft.email} onChange={event => setContactDraft(previous => ({ ...previous, email: event.target.value }))} placeholder="Email" />
              <button className="btn btn-outline" type="submit"><Plus size={14} /> {t('Thêm liên hệ')}</button>
            </form>
          </section>
        </div>

        <section className="purchase-panel">
          <div className="panel-heading-row">
            <h2>{t('Lịch sử đơn mua')}</h2>
            <select value={historyMonth} onChange={event => setHistoryMonth(event.target.value)}>
              <option value="all">{t('Tất cả tháng')}</option>
              {months.map(month => <option key={month} value={month}>{month}</option>)}
            </select>
          </div>
          <div className="table-container">
            <table className="purchase-table">
              <thead><tr><th>{t('Mã đơn mua')}</th><th>{t('PO khách hàng')}</th><th>{t('Mặt hàng')}</th><th>{t('Giá trị')}</th><th>{t('Ngày đặt')}</th></tr></thead>
              <tbody>
                {visibleOrders.map(order => <tr key={asText(order.id)}>
                  <td><strong>{asText(order.purCode)}</strong></td>
                  <td>{asText(order.linkedPoCode) || '—'}</td>
                  <td>{asArray(order.items).map(item => asText(item.materialName ?? item.productName)).filter(Boolean).join(', ') || '—'}</td>
                  <td>{asNumber(order.totalPrice).toLocaleString('vi-VN')} đ</td>
                  <td>{formatDate(asText(order.createdAt))}</td>
                </tr>)}
                {visibleOrders.length === 0 && <tr><td colSpan={5} className="purchase-empty">{t('Chưa có giao dịch trong khoảng thời gian này.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="supplier-detail-grid">
          <section className="purchase-panel">
            <div className="panel-heading-row"><h2>{t('Hợp đồng và tài liệu')}</h2><label className="btn btn-outline supplier-upload"><Paperclip size={14} /> {t('Tải tài liệu')}<input type="file" onChange={handleUploadDocument} /></label></div>
            <div className="supplier-document-list">
              {selectedSupplier.documents.map(document => <a key={document.id} href={document.data} download={document.name}><FileText size={15} /><span>{document.name}</span><small>{formatDateTime(document.uploadedAt)}</small></a>)}
              {selectedSupplier.contracts.map((contract, index) => <div key={asText(contract.id) || String(index)}><FileText size={15} /><span>{asText(contract.contractNo) || `${t('Hợp đồng')} ${index + 1}`}</span><small>{formatDate(asText(contract.signDate))}</small></div>)}
              {selectedSupplier.documents.length === 0 && selectedSupplier.contracts.length === 0 && <p className="purchase-empty">{t('Chưa có tài liệu.')}</p>}
            </div>
          </section>

          <section className="purchase-panel">
            <h2>{t('Nhật ký làm việc')}</h2>
            <form className="supplier-activity-form" onSubmit={handleAddActivity}>
              <textarea rows={3} value={activityNote} onChange={event => setActivityNote(event.target.value)} placeholder={t('Ghi lại cuộc gọi, báo giá, đánh giá chất lượng...')} />
              <button className="btn btn-primary" type="submit"><MessageSquarePlus size={14} /> {t('Lưu nhật ký')}</button>
            </form>
            <div className="supplier-activity-list">
              {selectedSupplier.activities.map(activity => <div key={activity.id}><strong>{activity.createdByName || t('Hệ thống')}</strong><small>{formatDateTime(activity.occurredAt)}</small><p>{activity.note}</p></div>)}
              {selectedSupplier.activities.length === 0 && <p className="purchase-empty">{t('Chưa có nhật ký làm việc.')}</p>}
            </div>
          </section>
        </div>

        {showForm && renderSupplierForm()}
      </div>
    );
  }

  function renderSupplierForm() {
    return (
      <div className="modal-overlay">
        <div className="modal-content supplier-form-modal">
          <div className="modal-header"><strong>{editingSupplierId ? t('CHỈNH SỬA NHÀ CUNG CẤP') : t('THÊM NHÀ CUNG CẤP')}</strong><button type="button" className="btn btn-outline btn-symbol-sm" onClick={() => setShowForm(false)}><X size={15} /></button></div>
          <form onSubmit={handleSaveSupplier}>
            <div className="modal-body supplier-form-grid">
              <div className="form-group supplier-form-wide"><label>{t('Tên nhà cung cấp *')}</label><input value={form.supplierName} onChange={event => updateForm('supplierName', event.target.value)} required /></div>
              <div className="form-group"><label>{t('Mã NCC')}</label><input value={form.supplierCode} onChange={event => updateForm('supplierCode', event.target.value)} placeholder={t('Tự động nếu để trống')} /></div>
              <div className="form-group"><label>{t('Mã số thuế')}</label><input value={form.taxCode} onChange={event => updateForm('taxCode', event.target.value)} /></div>
              <div className="form-group"><label>{t('Người liên hệ chính')}</label><input value={form.contactPerson} onChange={event => updateForm('contactPerson', event.target.value)} /></div>
              <div className="form-group"><label>{t('Điện thoại')}</label><input value={form.phone} onChange={event => updateForm('phone', event.target.value)} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} /></div>
              <div className="form-group"><label>{t('Tỉnh / thành')}</label><input value={form.province} onChange={event => updateForm('province', event.target.value)} /></div>
              <div className="form-group supplier-form-wide"><label>{t('Địa chỉ')}</label><input value={form.address} onChange={event => updateForm('address', event.target.value)} /></div>
              <div className="form-group supplier-form-wide"><label>{t('Nhóm hàng / năng lực cung cấp')}</label><input value={form.categoriesText} onChange={event => updateForm('categoriesText', event.target.value)} placeholder={t('Ví dụ: decal giấy, mực in, gia công flexo')} /></div>
              <div className="form-group supplier-form-wide"><label>{t('Loại hình cung ứng')}</label><div className="supplier-checkboxes">{(['finished_good', 'raw_material', 'subcontract'] as SourcingType[]).map(type => <label key={type}><input type="checkbox" checked={form.serviceTypes.includes(type)} onChange={() => toggleServiceType(type)} /> {getSourcingTypeLabel(type)}</label>)}</div></div>
              <div className="form-group"><label>{t('Điều khoản thanh toán')}</label><input value={form.paymentTerms} onChange={event => updateForm('paymentTerms', event.target.value)} /></div>
              <div className="form-group"><label>{t('Ngân hàng')}</label><input value={form.bankName} onChange={event => updateForm('bankName', event.target.value)} /></div>
              <div className="form-group"><label>{t('Số tài khoản')}</label><input value={form.bankAccount} onChange={event => updateForm('bankAccount', event.target.value)} /></div>
              <div className="form-group"><label>{t('Mua hàng phụ trách')}</label><select value={form.assignedPurchaserId} onChange={event => updateForm('assignedPurchaserId', event.target.value)}><option value="">{t('Chưa phân công')}</option>{purchasers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></div>
              <div className="form-group"><label>{t('Đánh giá (0-5)')}</label><input type="number" min="0" max="5" step="0.5" value={form.rating} onChange={event => updateForm('rating', Number(event.target.value))} /></div>
              <div className="form-group supplier-form-wide"><label>{t('Ghi chú nội bộ')}</label><textarea rows={3} value={form.note} onChange={event => updateForm('note', event.target.value)} /></div>
            </div>
            <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>{t('Hủy')}</button><button type="submit" className="btn btn-primary">{t('Lưu nhà cung cấp')}</button></div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div><h1 className="page-title">{t('DANH SÁCH NHÀ CUNG CẤP')}</h1><p className="page-subtitle">{t('Quản lý hồ sơ, năng lực, lịch sử mua hàng, tài liệu và công nợ của toàn bộ nhà cung cấp.')}</p></div>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}><Plus size={16} /> {t('Thêm NCC')}</button>
      </div>

      <div className="supplier-kpi-grid">
        <div><Building2 size={18} /><strong>{suppliers.length}</strong><span>{t('Tổng NCC')}</span></div>
        <div><ReceiptText size={18} /><strong>{supplierWithOrdersCount}</strong><span>{t('Đã phát sinh đơn')}</span></div>
        <div><FileText size={18} /><strong>{totalSpend.toLocaleString('vi-VN')} đ</strong><span>{t('Tổng giá trị mua')}</span></div>
      </div>

      <section className="supplier-toolbar">
        <div className="purchase-search"><Search size={16} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={t('Tìm NCC, MST, liên hệ, mặt hàng, mã PO hoặc đơn mua...')} /></div>
        <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">{t('Tất cả nhóm hàng')}</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
        <select value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">{t('Tất cả tháng')}</option>{months.map(month => <option key={month}>{month}</option>)}</select>
      </section>

      <section className="purchase-panel">
        <div className="table-container">
          <table className="supplier-table">
            <thead><tr><th>{t('Nhà cung cấp')}</th><th>{t('Liên hệ')}</th><th>{t('Nhóm hàng')}</th><th>{t('Số đơn')}</th><th>{t('Tổng mua')}</th><th>{t('Lần mua gần nhất')}</th><th>{t('Công nợ')}</th><th>{t('Đánh giá')}</th></tr></thead>
            <tbody>
              {filteredSuppliers.map(supplier => {
                const orders = getSupplierOrders(supplier.id);
                const spend = orders.reduce((sum, order) => sum + asNumber(order.totalPrice), 0);
                return <tr key={supplier.id} onClick={() => setSelectedSupplierId(supplier.id)}>
                  <td><strong>{supplier.supplierName}</strong><span>{supplier.supplierCode || supplier.id}</span></td>
                  <td><strong>{supplier.contactPerson || '—'}</strong><span>{supplier.phone || supplier.email || '—'}</span></td>
                  <td>{supplier.categories.join(', ') || '—'}</td>
                  <td><strong>{orders.length}</strong></td>
                  <td><strong>{spend.toLocaleString('vi-VN')} đ</strong></td>
                  <td>{formatDate(asText(orders[0]?.createdAt), 'vi-VN', '—')}</td>
                  <td>{getSupplierDebt(supplier.id).toLocaleString('vi-VN')} đ</td>
                  <td>{supplier.rating ? `${supplier.rating}/5` : '—'}</td>
                </tr>;
              })}
              {filteredSuppliers.length === 0 && <tr><td colSpan={8} className="purchase-empty">{t('Không tìm thấy nhà cung cấp phù hợp.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {showForm && renderSupplierForm()}
    </div>
  );
};
