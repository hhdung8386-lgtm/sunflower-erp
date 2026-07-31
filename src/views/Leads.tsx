import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Filter,
  KanbanSquare,
  List,
  Mail,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type {
  CustomerRecord,
  LeadActivityRecord,
  LeadCompanySize,
  LeadFileRecord,
  LeadRecord,
  LeadStage
} from '../domain/crmModels';
import { sortNewestFirst } from '../domain/recordOrdering';
import { dbService, type UserProfile } from '../services/firebaseService';
import './Leads.css';

interface LeadsProps {
  customers: CustomerRecord[];
  users: UserProfile[];
  currentUser: UserProfile;
  onNavigateToCrm: () => void;
}

interface LeadFormState {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxCode: string;
  address: string;
  province: string;
  companySize: LeadCompanySize;
  source: string;
  potentialValue: number;
  expectedProducts: string;
  stage: LeadStage;
  assignedSaleId: string;
  nextFollowUpAt: string;
  note: string;
}

const LEAD_STAGES: Array<{ id: LeadStage; label: string }> = [
  { id: 'new', label: 'Mới tiếp nhận' },
  { id: 'contacted', label: 'Đã liên hệ' },
  { id: 'quoted', label: 'Đã gửi báo giá' },
  { id: 'negotiating', label: 'Đang đàm phán' },
  { id: 'won', label: 'Thành công' },
  { id: 'lost', label: 'Không thành công' },
  { id: 'converted', label: 'Đã chuyển đổi' }
];

const ACTIVE_LEAD_STAGES = LEAD_STAGES.filter(stage => stage.id !== 'converted');

const LEAD_SOURCES = [
  'Giám đốc giới thiệu',
  'Sale tự tìm kiếm',
  'Khách hàng giới thiệu',
  'Website',
  'Mạng xã hội',
  'Hội chợ / sự kiện',
  'Khác'
];

const COMPANY_SIZE_LABELS: Record<LeadCompanySize, string> = {
  '': 'Chưa xác định',
  large: 'Doanh nghiệp lớn',
  medium: 'Doanh nghiệp vừa',
  small: 'Doanh nghiệp nhỏ'
};

const LEADS_PAGE_REFERENCE_TIME = Date.now();

const formatDateTime = (value: string) => {
  if (!value) return 'Chưa đặt lịch';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa đặt lịch' : date.toLocaleString('vi-VN');
};

const toDateTimeLocal = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const getStageLabel = (stage: LeadStage) => (
  LEAD_STAGES.find(item => item.id === stage)?.label || stage
);

const createEmptyForm = (currentUser: UserProfile, saleUsers: UserProfile[]): LeadFormState => ({
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  taxCode: '',
  address: '',
  province: '',
  companySize: '',
  source: '',
  potentialValue: 0,
  expectedProducts: '',
  stage: 'new',
  assignedSaleId: currentUser.role === 'sale' ? currentUser.uid : (saleUsers[0]?.uid || ''),
  nextFollowUpAt: '',
  note: ''
});

export const Leads: React.FC<LeadsProps> = ({
  customers,
  users,
  currentUser,
  onNavigateToCrm
}) => {
  const { t } = useLanguage();
  const saleUsers = useMemo(() => users.filter(user => user.role === 'sale'), [users]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [saleFilter, setSaleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | LeadCompanySize>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState('');
  const [form, setForm] = useState<LeadFormState>(() => createEmptyForm(currentUser, saleUsers));
  const [activityType, setActivityType] = useState('call');
  const [activityNote, setActivityNote] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<LeadFileRecord[]>([]);

  useEffect(() => {
    const unsubscribe = dbService.subscribeCollection('leads', data => {
      setLeads(sortNewestFirst(data as LeadRecord[], lead => [lead.createdAt, lead.updatedAt]));
    });
    return unsubscribe;
  }, []);

  const accessibleLeads = useMemo(() => leads.filter(lead => {
    if (currentUser.role === 'admin') return true;
    return lead.assignedSaleId === currentUser.uid;
  }), [currentUser.role, currentUser.uid, leads]);

  const provinces = useMemo(() => Array.from(new Set(
    accessibleLeads.map(lead => lead.province).filter(Boolean)
  )).sort(), [accessibleLeads]);

  const sources = useMemo(() => Array.from(new Set([
    ...LEAD_SOURCES,
    ...accessibleLeads.map(lead => lead.source).filter(Boolean)
  ])), [accessibleLeads]);

  const isOverdue = (lead: LeadRecord) => {
    if (!lead.nextFollowUpAt || ['won', 'lost', 'converted'].includes(lead.stage)) return false;
    const timestamp = new Date(lead.nextFollowUpAt).getTime();
    return Number.isFinite(timestamp) && timestamp < LEADS_PAGE_REFERENCE_TIME;
  };

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return accessibleLeads.filter(lead => {
      const matchesSearch = !normalizedSearch || [
        lead.companyName,
        lead.contactPerson,
        lead.phone,
        lead.email,
        lead.taxCode
      ].some(value => value.toLowerCase().includes(normalizedSearch));
      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
      const matchesSale = saleFilter === 'all' || lead.assignedSaleId === saleFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      const matchesProvince = provinceFilter === 'all' || lead.province === provinceFilter;
      const matchesSize = sizeFilter === 'all' || lead.companySize === sizeFilter;
      return matchesSearch
        && matchesStage
        && matchesSale
        && matchesSource
        && matchesProvince
        && matchesSize
        && (!onlyOverdue || isOverdue(lead));
    });
  }, [
    accessibleLeads,
    onlyOverdue,
    provinceFilter,
    saleFilter,
    searchTerm,
    sizeFilter,
    sourceFilter,
    stageFilter
  ]);

  const selectedLead = selectedLeadId
    ? leads.find(lead => lead.id === selectedLeadId) || null
    : null;

  const updateForm = <K extends keyof LeadFormState>(field: K, value: LeadFormState[K]) => {
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const openCreateForm = () => {
    setEditingLeadId('');
    setUploadingFiles([]);
    setForm(createEmptyForm(currentUser, saleUsers));
    setShowLeadForm(true);
  };

  const openEditForm = (lead: LeadRecord) => {
    setEditingLeadId(lead.id);
    setUploadingFiles(lead.files || []);
    setForm({
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      phone: lead.phone,
      email: lead.email,
      taxCode: lead.taxCode,
      address: lead.address,
      province: lead.province,
      companySize: lead.companySize,
      source: lead.source,
      potentialValue: lead.potentialValue,
      expectedProducts: lead.expectedProducts,
      stage: lead.stage,
      assignedSaleId: lead.assignedSaleId,
      nextFollowUpAt: toDateTimeLocal(lead.nextFollowUpAt),
      note: lead.note
    });
    setShowLeadForm(true);
  };

  const handleLeadFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const nextFiles = await Promise.all(files.map(file => new Promise<LeadFileRecord>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `lead-file-${file.lastModified}-${file.name}`,
        name: file.name,
        url: '',
        data: String(reader.result || '')
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setUploadingFiles(previous => [...previous, ...nextFiles]);
  };

  const handleSaveLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.companyName.trim()) return;

    const assignedSale = saleUsers.find(user => user.uid === form.assignedSaleId);
    const now = new Date().toISOString();
    const payload = {
      name: form.companyName.trim(),
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      taxCode: form.taxCode.trim(),
      address: form.address.trim(),
      province: form.province.trim(),
      companySize: form.companySize,
      source: form.source,
      potentialValue: Number(form.potentialValue),
      expectedProducts: form.expectedProducts.trim(),
      stage: form.stage,
      assignedSaleId: form.assignedSaleId,
      assignedSaleName: assignedSale?.displayName || '',
      reminderTime: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : '',
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : '',
      note: form.note.trim(),
      files: uploadingFiles,
      updatedAt: now,
      updatedBy: currentUser.displayName
    };

    if (editingLeadId) {
      await dbService.updateDocument('leads', editingLeadId, payload);
    } else {
      await dbService.addDocument('leads', {
        ...payload,
        activities: [{
          id: `activity-${now}`,
          type: 'created',
          note: 'Khởi tạo khách hàng tiềm năng',
          occurredAt: now,
          createdById: currentUser.uid,
          createdByName: currentUser.displayName
        }],
        createdAt: now,
        createdById: currentUser.uid
      });
    }

    setShowLeadForm(false);
  };

  const handleAddActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLead || !activityNote.trim()) return;
    const now = new Date().toISOString();
    const activity: LeadActivityRecord = {
      id: `activity-${now}`,
      type: activityType,
      note: activityNote.trim(),
      occurredAt: now,
      createdById: currentUser.uid,
      createdByName: currentUser.displayName
    };
    await dbService.updateDocument('leads', selectedLead.id, {
      activities: [activity, ...(selectedLead.activities || [])],
      updatedAt: now,
      updatedBy: currentUser.displayName
    });
    setActivityNote('');
  };

  const handleQuickStageChange = async (lead: LeadRecord, stage: LeadStage) => {
    if (lead.stage === stage) return;
    const now = new Date().toISOString();
    await dbService.updateDocument('leads', lead.id, {
      stage,
      activities: [{
        id: `activity-${now}`,
        type: 'status',
        note: `Chuyển trạng thái: ${getStageLabel(lead.stage)} → ${getStageLabel(stage)}`,
        occurredAt: now,
        createdById: currentUser.uid,
        createdByName: currentUser.displayName
      }, ...(lead.activities || [])],
      updatedAt: now,
      updatedBy: currentUser.displayName
    });
  };

  const findDuplicateCustomer = (lead: LeadRecord) => {
    const companyName = lead.companyName.trim().toLowerCase();
    const phone = lead.phone.replace(/\s/g, '');
    const taxCode = lead.taxCode.replace(/\s/g, '');
    return customers.find(customer => (
      (companyName && customer.companyName.trim().toLowerCase() === companyName)
      || (phone && customer.phone.replace(/\s/g, '') === phone)
      || (taxCode && customer.taxCode.replace(/\s/g, '') === taxCode)
    ));
  };

  const generateCustomerCode = () => {
    const usedCodes = new Set(
      customers
        .map(customer => customer.customerCode?.trim().toUpperCase())
        .filter(Boolean)
    );
    let sequence = customers.length + 1;
    let customerCode = `KH-${String(sequence).padStart(4, '0')}`;
    while (usedCodes.has(customerCode)) {
      sequence += 1;
      customerCode = `KH-${String(sequence).padStart(4, '0')}`;
    }
    return customerCode;
  };

  const handleConvertLead = async (lead: LeadRecord) => {
    const duplicate = findDuplicateCustomer(lead);
    if (duplicate) {
      window.alert(`Khách hàng có thể đã tồn tại trong CRM: ${duplicate.companyName} (${duplicate.customerCode || duplicate.id}).`);
      return;
    }
    if (!window.confirm(`Chuyển "${lead.companyName}" thành khách hàng chính thức?`)) return;

    const now = new Date().toISOString();
    const customerCode = generateCustomerCode();
    const customer = await dbService.addDocument('customers', {
      customerCode,
      customerRank: '',
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      taxCode: lead.taxCode,
      assignedSaleId: lead.assignedSaleId,
      sourceLeadId: lead.id,
      convertedAt: now,
      discountType: 'percent',
      discountRate: 0,
      discountAmount: 0,
      debtLimit: 0,
      paymentTerms: '30 ngày',
      note: [lead.note, lead.expectedProducts ? `Nhu cầu dự kiến: ${lead.expectedProducts}` : ''].filter(Boolean).join('\n'),
      procurementPhone: '',
      warehousePhone: '',
      bankAccount: '',
      contacts: [{
        id: 'primary',
        name: lead.contactPerson,
        role: 'primary',
        phone: lead.phone,
        email: lead.email,
        note: ''
      }],
      products: [],
      documents: [],
      contracts: [],
      files: (lead.files || []).map(file => ({
        ...file,
        folder: 'Tài liệu từ Lead',
        createdAt: now,
        createdById: currentUser.uid
      })),
      lastOrderAt: null,
      createdAt: now,
      createdById: currentUser.uid,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: '',
      updatedBy: ''
    });

    await dbService.updateDocument('leads', lead.id, {
      stage: 'converted',
      convertedCustomerId: customer.id,
      convertedAt: now,
      activities: [{
        id: `activity-${now}`,
        type: 'converted',
        note: `Đã chuyển thành khách hàng ${customerCode}`,
        occurredAt: now,
        createdById: currentUser.uid,
        createdByName: currentUser.displayName
      }, ...(lead.activities || [])],
      updatedAt: now,
      updatedBy: currentUser.displayName
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStageFilter('all');
    setSaleFilter('all');
    setSourceFilter('all');
    setProvinceFilter('all');
    setSizeFilter('all');
    setOnlyOverdue(false);
  };

  if (selectedLead) {
    const assignedSale = users.find(user => user.uid === selectedLead.assignedSaleId);
    return (
      <div className="lead-detail-page">
        <div className="lead-detail-header">
          <button type="button" className="btn btn-outline" onClick={() => setSelectedLeadId('')}>
            <ArrowLeft size={16} /> {t('Quay lại danh sách')}
          </button>
          <div>
            <div className="lead-detail-title">
              <span className={`lead-stage-badge lead-stage-badge--${selectedLead.stage}`}>{getStageLabel(selectedLead.stage)}</span>
              <h1>{selectedLead.companyName}</h1>
            </div>
            <p>{t('Theo dõi toàn bộ thông tin và lịch sử chăm sóc khách hàng tiềm năng.')}</p>
          </div>
          <div className="lead-detail-actions">
            <button type="button" className="btn btn-outline" onClick={() => openEditForm(selectedLead)}>
              <Pencil size={15} /> {t('Chỉnh sửa')}
            </button>
            {!['converted', 'lost'].includes(selectedLead.stage) && (
              <button type="button" className="btn btn-primary" onClick={() => handleConvertLead(selectedLead)}>
                <UserCheck size={15} /> {t('Chuyển thành khách hàng')}
              </button>
            )}
            {selectedLead.stage === 'converted' && (
              <button type="button" className="btn btn-primary" onClick={onNavigateToCrm}>
                <Building2 size={15} /> {t('Mở CRM')}
              </button>
            )}
          </div>
        </div>

        <div className="lead-detail-layout">
          <section className="lead-panel">
            <div className="lead-panel__title"><Building2 size={17} /> {t('Hồ sơ doanh nghiệp')}</div>
            <div className="lead-info-grid">
              <span>{t('Người liên hệ')}</span><strong>{selectedLead.contactPerson || '—'}</strong>
              <span>{t('Điện thoại')}</span><strong>{selectedLead.phone || '—'}</strong>
              <span>Email</span><strong>{selectedLead.email || '—'}</strong>
              <span>{t('Mã số thuế')}</span><strong>{selectedLead.taxCode || '—'}</strong>
              <span>{t('Địa chỉ')}</span><strong>{selectedLead.address || '—'}</strong>
              <span>{t('Tỉnh / thành')}</span><strong>{selectedLead.province || '—'}</strong>
              <span>{t('Quy mô')}</span><strong>{COMPANY_SIZE_LABELS[selectedLead.companySize]}</strong>
              <span>{t('Nguồn Lead')}</span><strong>{selectedLead.source || '—'}</strong>
              <span>{t('Sale phụ trách')}</span><strong>{assignedSale?.displayName || selectedLead.assignedSaleName || 'Chưa phân công'}</strong>
              <span>{t('Giá trị tiềm năng')}</span><strong>{selectedLead.potentialValue.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div className="lead-note-block">
              <strong>{t('Nhu cầu sản phẩm')}</strong>
              <p>{selectedLead.expectedProducts || t('Chưa cập nhật nhu cầu sản phẩm.')}</p>
            </div>
            <div className="lead-note-block">
              <strong>{t('Ghi chú')}</strong>
              <p>{selectedLead.note || t('Chưa có ghi chú.')}</p>
            </div>
          </section>

          <section className="lead-panel">
            <div className="lead-panel__title"><CalendarClock size={17} /> {t('Tiến độ chăm sóc')}</div>
            <label className="lead-field-label">{t('Trạng thái')}</label>
            <select
              value={selectedLead.stage}
              onChange={event => handleQuickStageChange(selectedLead, event.target.value as LeadStage)}
              disabled={selectedLead.stage === 'converted'}
            >
              {LEAD_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
            <div className={`lead-follow-up ${isOverdue(selectedLead) ? 'is-overdue' : ''}`}>
              <CalendarClock size={16} />
              <div><span>{t('Lịch chăm sóc tiếp theo')}</span><strong>{formatDateTime(selectedLead.nextFollowUpAt)}</strong></div>
            </div>
            <form className="lead-activity-form" onSubmit={handleAddActivity}>
              <label className="lead-field-label">{t('Thêm nhật ký chăm sóc')}</label>
              <div className="lead-activity-form__controls">
                <select value={activityType} onChange={event => setActivityType(event.target.value)}>
                  <option value="call">{t('Gọi điện')}</option>
                  <option value="meeting">{t('Gặp mặt')}</option>
                  <option value="email">{t('Email')}</option>
                  <option value="quotation">{t('Gửi báo giá')}</option>
                  <option value="note">{t('Ghi chú')}</option>
                </select>
                <input value={activityNote} onChange={event => setActivityNote(event.target.value)} placeholder={t('Nội dung trao đổi hoặc kết quả chăm sóc...')} required />
                <button type="submit" className="btn btn-primary"><MessageSquarePlus size={15} /> {t('Thêm')}</button>
              </div>
            </form>
          </section>

          <section className="lead-panel lead-panel--wide">
            <div className="lead-panel__title"><TrendingUp size={17} /> {t('Lịch sử chăm sóc')}</div>
            <div className="lead-timeline">
              {(selectedLead.activities || []).map(activity => (
                <div key={activity.id} className="lead-timeline-item">
                  <span className="lead-timeline-dot" />
                  <div>
                    <strong>{activity.note}</strong>
                    <span>{formatDateTime(activity.occurredAt)} · {String(activity.createdByName || activity.createdById || '')}</span>
                  </div>
                </div>
              ))}
              {(selectedLead.activities || []).length === 0 && <div className="lead-empty">{t('Chưa có lịch sử chăm sóc.')}</div>}
            </div>
          </section>

          <section className="lead-panel lead-panel--wide">
            <div className="lead-panel__title"><Paperclip size={17} /> {t('Tài liệu Lead')}</div>
            <div className="lead-files">
              {(selectedLead.files || []).map(file => (
                <a key={file.id} href={file.data || file.url} download={file.name} className="lead-file">
                  <FileText size={16} /><span>{file.name}</span>
                </a>
              ))}
              {(selectedLead.files || []).length === 0 && <div className="lead-empty">{t('Chưa có tài liệu đính kèm.')}</div>}
            </div>
          </section>
        </div>

        {showLeadForm && renderLeadForm()}
      </div>
    );
  }

  function renderLeadForm() {
    return (
      <div className="modal-overlay">
        <div className="modal-content lead-form-modal">
          <div className="modal-header">
            <strong>{editingLeadId ? t('CHỈNH SỬA KHÁCH HÀNG TIỀM NĂNG') : t('THÊM KHÁCH HÀNG TIỀM NĂNG')}</strong>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowLeadForm(false)}>{t('Đóng')}</button>
          </div>
          <form onSubmit={handleSaveLead}>
            <div className="modal-body">
              <div className="lead-form-section">
                <h3>{t('Thông tin doanh nghiệp')}</h3>
                <div className="lead-form-grid">
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Tên doanh nghiệp *')}</label>
                    <input value={form.companyName} onChange={event => updateForm('companyName', event.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Người liên hệ')}</label>
                    <input value={form.contactPerson} onChange={event => updateForm('contactPerson', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Điện thoại')}</label>
                    <input value={form.phone} onChange={event => updateForm('phone', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Mã số thuế')}</label>
                    <input value={form.taxCode} onChange={event => updateForm('taxCode', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Tỉnh / thành')}</label>
                    <input value={form.province} onChange={event => updateForm('province', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Quy mô doanh nghiệp')}</label>
                    <select value={form.companySize} onChange={event => updateForm('companySize', event.target.value as LeadCompanySize)}>
                      {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Địa chỉ')}</label>
                    <input value={form.address} onChange={event => updateForm('address', event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="lead-form-section">
                <h3>{t('Thông tin cơ hội')}</h3>
                <div className="lead-form-grid">
                  <div className="form-group">
                    <label>{t('Nguồn Lead')}</label>
                    <select value={form.source} onChange={event => updateForm('source', event.target.value)}>
                      <option value="">{t('-- Chọn nguồn --')}</option>
                      {LEAD_SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Giá trị tiềm năng (đ)')}</label>
                    <input type="number" min="0" value={form.potentialValue} onChange={event => updateForm('potentialValue', Number(event.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>{t('Trạng thái')}</label>
                    <select value={form.stage} onChange={event => updateForm('stage', event.target.value as LeadStage)}>
                      {ACTIVE_LEAD_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Sale phụ trách')}</label>
                    <select
                      value={form.assignedSaleId}
                      onChange={event => updateForm('assignedSaleId', event.target.value)}
                      disabled={currentUser.role === 'sale'}
                    >
                      <option value="">{t('-- Chưa phân công --')}</option>
                      {saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Lịch chăm sóc tiếp theo')}</label>
                    <input type="datetime-local" value={form.nextFollowUpAt} onChange={event => updateForm('nextFollowUpAt', event.target.value)} />
                  </div>
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Nhu cầu sản phẩm dự kiến')}</label>
                    <textarea rows={3} value={form.expectedProducts} onChange={event => updateForm('expectedProducts', event.target.value)} placeholder={t('Loại tem, quy cách, chất liệu, sản lượng dự kiến...')} />
                  </div>
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Ghi chú')}</label>
                    <textarea rows={3} value={form.note} onChange={event => updateForm('note', event.target.value)} />
                  </div>
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Tài liệu đính kèm')}</label>
                    <input type="file" multiple onChange={handleLeadFilesChange} />
                    {uploadingFiles.length > 0 && (
                      <div className="lead-upload-list">
                        {uploadingFiles.map(file => (
                          <span key={file.id}>
                            <Paperclip size={12} /> {file.name}
                            <button type="button" onClick={() => setUploadingFiles(previous => previous.filter(item => item.id !== file.id))}><X size={12} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowLeadForm(false)}>{t('Hủy')}</button>
              <button type="submit" className="btn btn-primary">{editingLeadId ? t('Cập nhật Lead') : t('Lưu Lead')}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="leads-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('KHÁCH HÀNG TIỀM NĂNG (LEAD)')}</h1>
          <p className="page-subtitle">{t('Quản lý cơ hội bán hàng, lịch chăm sóc và chuyển đổi Lead thành khách hàng chính thức.')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={16} /> {t('Thêm Lead')}
        </button>
      </div>

      <div className="lead-summary-grid">
        <div className="lead-summary-card"><Users size={18} /><div><strong>{accessibleLeads.length}</strong><span>Tổng Lead</span></div></div>
        <div className="lead-summary-card"><TrendingUp size={18} /><div><strong>{accessibleLeads.filter(lead => ['quoted', 'negotiating'].includes(lead.stage)).length}</strong><span>Đang theo đuổi</span></div></div>
        <div className="lead-summary-card"><CalendarClock size={18} /><div><strong>{accessibleLeads.filter(isOverdue).length}</strong><span>Quá hạn chăm sóc</span></div></div>
        <div className="lead-summary-card"><CheckCircle2 size={18} /><div><strong>{accessibleLeads.filter(lead => lead.stage === 'converted').length}</strong><span>Đã chuyển đổi</span></div></div>
      </div>

      <section className="lead-toolbar">
        <div className="lead-search">
          <Search size={16} />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={t('Tìm công ty, người liên hệ, SĐT, mã số thuế...')} />
        </div>
        <select value={stageFilter} onChange={event => setStageFilter(event.target.value as 'all' | LeadStage)}>
          <option value="all">{t('Tất cả trạng thái')}</option>
          {LEAD_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
        {currentUser.role === 'admin' && (
          <select value={saleFilter} onChange={event => setSaleFilter(event.target.value)}>
            <option value="all">{t('Tất cả Sale')}</option>
            {saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
          </select>
        )}
        <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}>
          <option value="all">{t('Tất cả nguồn')}</option>
          {sources.map(source => <option key={source} value={source}>{source}</option>)}
        </select>
        <select value={provinceFilter} onChange={event => setProvinceFilter(event.target.value)}>
          <option value="all">{t('Tất cả tỉnh/thành')}</option>
          {provinces.map(province => <option key={province} value={province}>{province}</option>)}
        </select>
        <select value={sizeFilter} onChange={event => setSizeFilter(event.target.value as 'all' | LeadCompanySize)}>
          <option value="all">{t('Tất cả quy mô')}</option>
          <option value="large">{COMPANY_SIZE_LABELS.large}</option>
          <option value="medium">{COMPANY_SIZE_LABELS.medium}</option>
          <option value="small">{COMPANY_SIZE_LABELS.small}</option>
        </select>
        <label className={`lead-overdue-toggle ${onlyOverdue ? 'is-active' : ''}`}>
          <input type="checkbox" checked={onlyOverdue} onChange={event => setOnlyOverdue(event.target.checked)} />
          <CalendarClock size={14} /> {t('Quá hạn')}
        </label>
        <button type="button" className="btn btn-outline btn-symbol" onClick={clearFilters} title={t('Xóa bộ lọc')}><Filter size={15} /></button>
        <div className="lead-view-toggle">
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} title={t('Dạng danh sách')}><List size={16} /></button>
          <button type="button" className={viewMode === 'kanban' ? 'is-active' : ''} onClick={() => setViewMode('kanban')} title="Kanban"><KanbanSquare size={16} /></button>
        </div>
      </section>

      {viewMode === 'list' ? (
        <section className="lead-table-card">
          <div className="table-container">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>{t('Doanh nghiệp')}</th>
                  <th>{t('Liên hệ')}</th>
                  <th>{t('Nguồn / khu vực')}</th>
                  <th>{t('Giá trị tiềm năng')}</th>
                  <th>{t('Sale phụ trách')}</th>
                  <th>{t('Chăm sóc tiếp')}</th>
                  <th>{t('Trạng thái')}</th>
                  <th>{t('Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                    <td><strong>{lead.companyName}</strong><span>{COMPANY_SIZE_LABELS[lead.companySize]}</span></td>
                    <td><strong>{lead.contactPerson || '—'}</strong><span>{lead.phone || lead.email || 'Chưa có liên hệ'}</span></td>
                    <td><strong>{lead.source || '—'}</strong><span>{lead.province || 'Chưa xác định'}</span></td>
                    <td><strong>{lead.potentialValue.toLocaleString('vi-VN')} đ</strong></td>
                    <td>{users.find(user => user.uid === lead.assignedSaleId)?.displayName || lead.assignedSaleName || 'Chưa phân công'}</td>
                    <td><span className={isOverdue(lead) ? 'lead-date-overdue' : ''}>{formatDateTime(lead.nextFollowUpAt)}</span></td>
                    <td><span className={`lead-stage-badge lead-stage-badge--${lead.stage}`}>{getStageLabel(lead.stage)}</span></td>
                    <td>
                      <div className="lead-row-actions" onClick={event => event.stopPropagation()}>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedLeadId(lead.id)}>{t('Chi tiết')}</button>
                        <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditForm(lead)} title={t('Sửa')}><Pencil size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && <tr><td colSpan={8} className="lead-empty">{t('Không có Lead phù hợp với bộ lọc.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="lead-kanban">
          {ACTIVE_LEAD_STAGES.map(stage => {
            const stageLeads = filteredLeads.filter(lead => lead.stage === stage.id);
            return (
              <div key={stage.id} className="lead-kanban-column">
                <div className="lead-kanban-column__header">
                  <span>{stage.label}</span><strong>{stageLeads.length}</strong>
                </div>
                <div className="lead-kanban-column__body">
                  {stageLeads.map(lead => (
                    <button type="button" key={lead.id} className="lead-kanban-card" onClick={() => setSelectedLeadId(lead.id)}>
                      <strong>{lead.companyName}</strong>
                      <span><Phone size={12} /> {lead.phone || 'Chưa có SĐT'}</span>
                      <span><Mail size={12} /> {lead.email || 'Chưa có email'}</span>
                      <span><MapPin size={12} /> {lead.province || 'Chưa có khu vực'}</span>
                      <span className={isOverdue(lead) ? 'lead-date-overdue' : ''}><CalendarClock size={12} /> {formatDateTime(lead.nextFollowUpAt)}</span>
                    </button>
                  ))}
                  {stageLeads.length === 0 && <div className="lead-kanban-empty">{t('Chưa có Lead')}</div>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {showLeadForm && renderLeadForm()}
    </div>
  );
};
