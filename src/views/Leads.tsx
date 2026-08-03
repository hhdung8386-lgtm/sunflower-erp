import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Filter,
  List,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tags,
  TrendingUp,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type {
  CustomerRecord,
  LeadCompanySize,
  LeadFileRecord,
  LeadFilterDefinition,
  LeadRecord,
  LeadStage
} from '../domain/crmModels';
import { sortNewestFirst } from '../domain/recordOrdering';
import {
  createLeadDocumentIdFromTaxCode,
  findTaxCodeConflict,
  normalizeTaxCode,
  type TaxCodeConflictRecord
} from '../domain/taxCodeUniqueness';
import {
  findLeadFilterOption,
  findLeadFilterOptionId,
  getLeadFilterValues,
  LEAD_FILTER_IDS,
  mergeLeadFilterDefinitions,
} from '../domain/leadFilterConfig';
import {
  dbService,
  isDocumentAlreadyExistsError,
  type UserProfile
} from '../services/firebaseService';
import {
  LeadDynamicFields,
  LeadFilterAdminModal,
  LeadSalesWorkspace
} from '../components/LeadFilterSystem';
import './Leads.css';

interface LeadsProps {
  customers: CustomerRecord[];
  users: UserProfile[];
  currentUser: UserProfile;
  onNavigateToCrm: () => void;
  onConvertLead: (lead: LeadRecord) => void;
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
  discoveredById: string;
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

const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/đ/g, 'd');

const matchesEverySearchTerm = (searchTerm: string, values: unknown[]) => {
  const terms = normalizeSearchText(searchTerm).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeSearchText(values.filter(Boolean).join(' '));
  return terms.every(term => haystack.includes(term));
};

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
  discoveredById: currentUser.role === 'sale' ? currentUser.uid : '',
  nextFollowUpAt: '',
  note: ''
});

export const Leads: React.FC<LeadsProps> = ({
  customers,
  users,
  currentUser,
  onNavigateToCrm,
  onConvertLead
}) => {
  const { t } = useLanguage();
  const saleUsers = useMemo(() => users.filter(user => user.role === 'sale'), [users]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<'list' | 'performance'>('list');
  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [storedFilterDefinitions, setStoredFilterDefinitions] = useState<LeadFilterDefinition[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string[]>>({});
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState('');
  const [form, setForm] = useState<LeadFormState>(() => createEmptyForm(currentUser, saleUsers));
  const [uploadingFiles, setUploadingFiles] = useState<LeadFileRecord[]>([]);
  const [taxCodeSaveError, setTaxCodeSaveError] = useState('');

  useEffect(() => {
    const unsubscribe = dbService.subscribeCollection('leads', data => {
      setLeads(sortNewestFirst(data as LeadRecord[], lead => [lead.createdAt, lead.updatedAt]));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribeDefinitions = dbService.subscribeCollection('lead_filter_definitions', data => {
      setStoredFilterDefinitions(data as LeadFilterDefinition[]);
    });
    return unsubscribeDefinitions;
  }, []);

  const filterDefinitions = useMemo(
    () => mergeLeadFilterDefinitions(storedFilterDefinitions),
    [storedFilterDefinitions]
  );

  const accessibleLeads = useMemo(() => leads.filter(lead => {
    if (currentUser.role === 'admin') return true;
    return lead.assignedSaleId === currentUser.uid;
  }), [currentUser.role, currentUser.uid, leads]);

  const isOverdue = (lead: LeadRecord) => {
    if (!lead.nextFollowUpAt || ['won', 'lost', 'converted'].includes(lead.stage)) return false;
    const timestamp = new Date(lead.nextFollowUpAt).getTime();
    return Number.isFinite(timestamp) && timestamp < LEADS_PAGE_REFERENCE_TIME;
  };

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return accessibleLeads.filter(lead => {
      const leadFilterValues = getLeadFilterValues(lead, filterDefinitions);
      const matchesSearch = !normalizedSearch || matchesEverySearchTerm(normalizedSearch, [
        lead.companyName,
        lead.contactPerson,
        lead.phone,
        lead.email,
        lead.taxCode,
        lead.address,
        lead.province,
        lead.source,
        lead.expectedProducts,
        lead.note,
        lead.assignedSaleName,
        users.find(user => user.uid === lead.assignedSaleId)?.displayName,
        getStageLabel(lead.stage),
        COMPANY_SIZE_LABELS[lead.companySize],
        Object.entries(leadFilterValues).flatMap(([fieldId, optionIds]) => {
          const definition = filterDefinitions.find(field => field.id === fieldId);
          return optionIds.map(optionId => definition?.options.find(item => item.id === optionId)?.label || optionId);
        }),
        (lead.activities || []).map(activity => activity.note)
      ]);
      const matchesClassifications = Object.entries(dynamicFilters)
        .filter(([, selectedValues]) => selectedValues.length > 0)
        .every(([fieldId, selectedValues]) => {
          const currentValues = leadFilterValues[fieldId] || [];
          return selectedValues.some(value => currentValues.includes(value));
        });
      return matchesSearch
        && matchesClassifications;
    });
  }, [
    accessibleLeads,
    dynamicFilters,
    filterDefinitions,
    searchTerm,
    users
  ]);

  const pursuedLeadCount = accessibleLeads.filter(lead => {
    const markerValues = Object.values(getLeadFilterValues(lead, filterDefinitions)).flat();
    return ['quoted', 'negotiating'].includes(lead.stage)
      || ['preparing_quote', 'quote_sent', 'negotiating', 'price_negotiation', 'waiting_feedback'].some(marker => markerValues.includes(marker));
  }).length;

  const selectedLead = selectedLeadId
    ? leads.find(lead => lead.id === selectedLeadId) || null
    : null;

  const updateForm = <K extends keyof LeadFormState>(field: K, value: LeadFormState[K]) => {
    if (field === 'taxCode') setTaxCodeSaveError('');
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const editingLead = editingLeadId
    ? leads.find(lead => lead.id === editingLeadId) || null
    : null;
  const isTaxCodeLocked = Boolean(editingLeadId && normalizeTaxCode(editingLead?.taxCode));
  const taxCodeConflict = useMemo(() => findTaxCodeConflict(
    form.taxCode,
    leads,
    customers,
    editingLeadId,
    editingLead?.convertedCustomerId || ''
  ), [customers, editingLead?.convertedCustomerId, editingLeadId, form.taxCode, leads]);

  const describeTaxCodeConflict = (conflict: TaxCodeConflictRecord): string => {
    const saleName = conflict.assignedSaleName
      || users.find(user => user.uid === conflict.assignedSaleId)?.displayName
      || 'Sale khác';
    const profileType = conflict.recordType === 'customer' ? 'khách hàng CRM' : 'khách hàng tiềm năng';
    return `Mã số thuế này đã thuộc ${profileType} “${conflict.companyName}” và đang do ${saleName} phụ trách.`;
  };

  const openCreateForm = () => {
    setEditingLeadId('');
    setUploadingFiles([]);
    setForm(createEmptyForm(currentUser, saleUsers));
    setTaxCodeSaveError('');
    setShowLeadForm(true);
  };

  const openEditForm = (lead: LeadRecord) => {
    setEditingLeadId(lead.id);
    setUploadingFiles(lead.files || []);
    setTaxCodeSaveError('');
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
      discoveredById: lead.discoveredById || lead.createdById,
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
    const normalizedTaxCode = normalizeTaxCode(form.taxCode);
    if (!form.companyName.trim() || !normalizedTaxCode) return;

    const [latestLeadData, latestCustomerData] = await Promise.all([
      dbService.getCollection('leads'),
      dbService.getCollection('customers')
    ]);
    const latestConflict = findTaxCodeConflict(
      form.taxCode,
      latestLeadData as LeadRecord[],
      latestCustomerData as CustomerRecord[],
      editingLeadId,
      editingLead?.convertedCustomerId || ''
    );
    if (latestConflict) {
      setTaxCodeSaveError(describeTaxCodeConflict(latestConflict));
      return;
    }

    const assignedSale = saleUsers.find(user => user.uid === form.assignedSaleId);
    const discoveredById = form.discoveredById
      || (currentUser.role === 'sale' ? currentUser.uid : form.assignedSaleId);
    const discoveredBy = saleUsers.find(user => user.uid === discoveredById);
    const currentFilterValues = editingLead
      ? getLeadFilterValues(editingLead, filterDefinitions)
      : {};
    const profileFilterValues = {
      ...currentFilterValues,
      [LEAD_FILTER_IDS.companySize]: form.companySize ? [form.companySize] : [],
      [LEAD_FILTER_IDS.province]: [findLeadFilterOptionId(filterDefinitions, LEAD_FILTER_IDS.province, form.province)].filter(Boolean),
      [LEAD_FILTER_IDS.source]: [findLeadFilterOptionId(filterDefinitions, LEAD_FILTER_IDS.source, form.source)].filter(Boolean)
    };
    const now = new Date().toISOString();
    const payload = {
      name: form.companyName.trim(),
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      taxCode: normalizedTaxCode,
      address: form.address.trim(),
      province: form.province.trim(),
      companySize: form.companySize,
      source: form.source,
      potentialValue: Number(form.potentialValue),
      expectedProducts: form.expectedProducts.trim(),
      stage: form.stage,
      filterValues: profileFilterValues,
      assignedSaleId: form.assignedSaleId,
      assignedSaleName: assignedSale?.displayName || '',
      discoveredById,
      discoveredByName: discoveredBy?.displayName || currentUser.displayName,
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
      try {
        await dbService.addDocumentIfAbsent(
          'leads',
          createLeadDocumentIdFromTaxCode(normalizedTaxCode),
          {
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
          }
        );
      } catch (error) {
        if (!isDocumentAlreadyExistsError(error)) {
          setTaxCodeSaveError('Không thể xác minh mã số thuế trên hệ thống. Lead chưa được lưu; vui lòng thử lại.');
          return;
        }
        const existingLead = (error as { existingDocument?: LeadRecord }).existingDocument;
        setTaxCodeSaveError(existingLead
          ? describeTaxCodeConflict({
              id: existingLead.id,
              recordType: 'lead',
              companyName: existingLead.companyName,
              assignedSaleId: existingLead.assignedSaleId,
              assignedSaleName: existingLead.assignedSaleName
            })
          : 'Mã số thuế này vừa được một Sale khác đăng ký. Vui lòng kiểm tra lại.');
        return;
      }
    }

    setShowLeadForm(false);
  };

  const handleLeadFilterValueChange = async (
    lead: LeadRecord,
    field: LeadFilterDefinition,
    value: string,
    checked?: boolean
  ) => {
    const currentValues = getLeadFilterValues(lead, filterDefinitions);
    const previousFieldValues = currentValues[field.id] || [];
    let nextFieldValues: string[];

    if (field.type === 'multi_select') {
      nextFieldValues = checked
        ? Array.from(new Set([...previousFieldValues, value]))
        : previousFieldValues.filter(item => item !== value);
    } else if (field.type === 'checkbox') {
      nextFieldValues = checked ? ['true'] : [];
    } else {
      nextFieldValues = value ? [value] : [];
    }

    const nextFilterValues = { ...currentValues, [field.id]: nextFieldValues };
    const optionLabel = field.options.find(item => item.id === value)?.label || value || 'để trống';
    const actionLabel = field.type === 'multi_select' || field.type === 'checkbox'
      ? (checked ? 'Thêm' : 'Bỏ')
      : 'Cập nhật';
    const now = new Date().toISOString();
    const linkedProfileFields: Partial<Pick<LeadRecord, 'companySize' | 'province' | 'source'>> = {};
    if (field.id === LEAD_FILTER_IDS.companySize && ['', 'large', 'medium', 'small'].includes(value)) {
      linkedProfileFields.companySize = value as LeadCompanySize;
    }
    if (field.id === LEAD_FILTER_IDS.province) {
      linkedProfileFields.province = field.options.find(item => item.id === value)?.label || '';
    }
    if (field.id === LEAD_FILTER_IDS.source) {
      linkedProfileFields.source = field.options.find(item => item.id === value)?.label || '';
    }

    await dbService.updateDocument('leads', lead.id, {
      ...linkedProfileFields,
      filterValues: nextFilterValues,
      activities: [{
        id: `activity-filter-${now}`,
        type: 'filter_tag',
        note: `${actionLabel} ${field.name}: ${optionLabel}`,
        occurredAt: now,
        createdById: currentUser.uid,
        createdByName: currentUser.displayName
      }, ...(lead.activities || [])],
      updatedBy: currentUser.displayName
    });
  };

  const handleSaveFilterDefinition = async (definition: LeadFilterDefinition) => {
    await dbService.addDocument('lead_filter_definitions', {
      ...definition,
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDynamicFilterToggle = (field: LeadFilterDefinition, optionId: string, checked: boolean) => {
    setDynamicFilters(previous => {
      const fieldValues = previous[field.id] || [];
      return {
        ...previous,
        [field.id]: checked
          ? field.type === 'single_select' ? [optionId] : Array.from(new Set([...fieldValues, optionId]))
          : fieldValues.filter(item => item !== optionId)
      };
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

  const handleConvertLead = (lead: LeadRecord) => {
    const duplicate = findDuplicateCustomer(lead);
    if (duplicate) {
      window.alert(`Khách hàng có thể đã tồn tại trong CRM: ${duplicate.companyName} (${duplicate.customerCode || duplicate.id}).`);
      return;
    }
    if (!window.confirm(`Mở biểu mẫu khách hàng và đơn đầu tiên cho "${lead.companyName}"?`)) return;
    onConvertLead(lead);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDynamicFilters({});
  };

  const getClassificationLabel = (lead: LeadRecord, fieldId: string, fallback = '—') => {
    const optionId = getLeadFilterValues(lead, filterDefinitions)[fieldId]?.[0];
    return (optionId && findLeadFilterOption(filterDefinitions, fieldId, optionId)?.label) || fallback;
  };

  if (showLeadForm) {
    return renderLeadForm();
  }

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
            <p>{t('Thông tin, phân loại và kế hoạch chăm sóc khách hàng tiềm năng.')}</p>
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
              <span>{t('Tỉnh / thành')}</span><strong>{getClassificationLabel(selectedLead, LEAD_FILTER_IDS.province, selectedLead.province || '—')}</strong>
              <span>{t('Quy mô')}</span><strong>{getClassificationLabel(selectedLead, LEAD_FILTER_IDS.companySize, COMPANY_SIZE_LABELS[selectedLead.companySize])}</strong>
              <span>{t('Nguồn Lead')}</span><strong>{getClassificationLabel(selectedLead, LEAD_FILTER_IDS.source, selectedLead.source || '—')}</strong>
              <span>{t('Sale phụ trách')}</span><strong>{assignedSale?.displayName || selectedLead.assignedSaleName || 'Chưa phân công'}</strong>
              <span>{t('Lịch chăm sóc tiếp theo')}</span><strong className={isOverdue(selectedLead) ? 'lead-date-overdue' : ''}>{formatDateTime(selectedLead.nextFollowUpAt)}</strong>
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
            {(selectedLead.files || []).length > 0 && (
              <div className="lead-profile-files">
                <strong><Paperclip size={13} /> {t('Tài liệu đính kèm')}</strong>
                <div className="lead-files">
                  {(selectedLead.files || []).map(file => (
                    <a key={file.id} href={file.data || file.url} download={file.name} className="lead-file">
                      <FileText size={14} /><span>{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="lead-panel lead-classification-panel">
            <div className="lead-panel__title"><Tags size={17} /> {t('Phân loại khách hàng')}</div>
            <p className="lead-panel__hint">5 nhóm thông tin dùng để tìm và lọc Lead ngoài danh sách.</p>
            <LeadDynamicFields
              lead={selectedLead}
              definitions={filterDefinitions}
              canEditAll={currentUser.role === 'admin'}
              onChange={(field, value, checked) => handleLeadFilterValueChange(selectedLead, field, value, checked)}
            />
          </section>
        </div>
      </div>
    );
  }

  function renderLeadForm() {
    return (
      <div className="lead-form-page">
        <header className="lead-form-page__header">
          <button type="button" className="btn btn-outline" onClick={() => setShowLeadForm(false)}>
            <ArrowLeft size={16} /> {t('Quay lại')}
          </button>
          <div>
            <span>{editingLeadId ? t('CHỈNH SỬA HỒ SƠ') : t('HỒ SƠ MỚI')}</span>
            <h1>{editingLeadId ? t('Chỉnh sửa khách hàng tiềm năng') : t('Thêm khách hàng tiềm năng')}</h1>
            <p>{t('Ghi nhận thông tin doanh nghiệp và lịch phụ trách. Năm nhóm phân loại được cập nhật tại trang chi tiết Lead.')}</p>
          </div>
        </header>

        <form className="lead-form-page__form" onSubmit={handleSaveLead}>
          <div className="lead-form-page__content">
            <section className="lead-form-card">
              <div className="lead-form-card__heading">
                <Building2 size={18} />
                <div><h2>{t('Thông tin doanh nghiệp')}</h2><p>{t('Thông tin nhận diện và đầu mối liên hệ chính.')}</p></div>
              </div>
              <div className="lead-form-grid">
                <div className="form-group lead-form-grid__wide">
                  <label>{t('Tên doanh nghiệp *')}</label>
                  <input autoFocus value={form.companyName} onChange={event => updateForm('companyName', event.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t('Người liên hệ')}</label>
                  <input value={form.contactPerson} onChange={event => updateForm('contactPerson', event.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('Điện thoại')}</label>
                  <input type="tel" value={form.phone} onChange={event => updateForm('phone', event.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('Mã số thuế *')}</label>
                  <input
                    value={form.taxCode}
                    onChange={event => updateForm('taxCode', event.target.value)}
                    required
                    readOnly={isTaxCodeLocked}
                    aria-invalid={Boolean(taxCodeConflict || taxCodeSaveError)}
                    aria-describedby="lead-tax-code-guidance"
                  />
                  <span
                    id="lead-tax-code-guidance"
                    className={taxCodeConflict || taxCodeSaveError ? 'lead-tax-code-message is-error' : 'lead-tax-code-message'}
                  >
                    {(taxCodeConflict || taxCodeSaveError) && <AlertCircle size={13} />}
                    {taxCodeConflict
                      ? describeTaxCodeConflict(taxCodeConflict)
                      : taxCodeSaveError || (isTaxCodeLocked
                        ? t('Mã số thuế là định danh duy nhất và không thể thay đổi sau khi tạo Lead.')
                        : t('Mã số thuế được kiểm tra trên toàn bộ Lead và khách hàng CRM.'))}
                  </span>
                </div>
                <div className="form-group lead-form-grid__wide">
                  <label>{t('Địa chỉ')}</label>
                  <input value={form.address} onChange={event => updateForm('address', event.target.value)} />
                </div>
              </div>
            </section>

            <section className="lead-form-card">
              <div className="lead-form-card__heading">
                <CalendarClock size={18} />
                <div><h2>{t('Phụ trách và lịch làm việc')}</h2><p>{t('Thông tin phục vụ phân công và theo dõi của Sale.')}</p></div>
              </div>
              <div className="lead-form-grid">
                <div className="form-group">
                  <label>{t('Sale phụ trách')}</label>
                  <select value={form.assignedSaleId} onChange={event => updateForm('assignedSaleId', event.target.value)} disabled={currentUser.role === 'sale'}>
                    <option value="">{t('-- Chưa phân công --')}</option>
                    {saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                  </select>
                </div>
                {currentUser.role === 'admin' && (
                  <div className="form-group">
                    <label>{t('Sale tìm được Lead')}</label>
                    <select value={form.discoveredById} onChange={event => updateForm('discoveredById', event.target.value)}>
                      <option value="">{t('-- Chưa xác định --')}</option>
                      {saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group lead-form-grid__wide">
                  <label>{t('Lịch chăm sóc tiếp theo')}</label>
                  <input type="datetime-local" value={form.nextFollowUpAt} onChange={event => updateForm('nextFollowUpAt', event.target.value)} />
                </div>
                <div className="form-group lead-form-grid__wide">
                  <label>{t('Ghi chú')}</label>
                  <textarea rows={5} value={form.note} onChange={event => updateForm('note', event.target.value)} placeholder={t('Thông tin cần lưu ý khi làm việc với khách hàng...')} />
                </div>
                <div className="form-group lead-form-grid__wide">
                  <label>{t('Tài liệu đính kèm')}</label>
                  <div className="lead-file-dropzone">
                    <Paperclip size={18} />
                    <div><strong>{t('Chọn tệp từ máy tính')}</strong><span>{t('Có thể gắn nhiều báo giá, hình ảnh hoặc tài liệu liên quan.')}</span></div>
                    <input type="file" multiple onChange={handleLeadFilesChange} />
                  </div>
                  {uploadingFiles.length > 0 && (
                    <div className="lead-upload-list">
                      {uploadingFiles.map(file => (
                        <span key={file.id}>
                          <Paperclip size={12} /> {file.name}
                          <button type="button" onClick={() => setUploadingFiles(previous => previous.filter(item => item.id !== file.id))} aria-label={`${t('Bỏ tệp')} ${file.name}`}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
          <footer className="lead-form-page__footer">
            <span>{t('Các thay đổi chỉ được ghi nhận khi bấm Lưu.')}</span>
            <div>
              <button type="button" className="btn btn-outline" onClick={() => setShowLeadForm(false)}>{t('Hủy')}</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={Boolean(taxCodeConflict) || !normalizeTaxCode(form.taxCode)}
              >
                {editingLeadId ? t('Cập nhật Lead') : t('Lưu Lead')}
              </button>
            </div>
          </footer>
        </form>
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
        <div className="lead-page-actions">
          {currentUser.role === 'admin' && <button type="button" className="btn btn-outline" onClick={() => setShowFilterConfig(true)}><Settings2 size={16} /> {t('Cấu hình bộ lọc')}</button>}
          <button type="button" className="btn btn-primary" onClick={openCreateForm}><Plus size={16} /> {t('Thêm Lead')}</button>
        </div>
      </div>

      <div className="lead-workspace-tabs" role="tablist" aria-label="Không gian quản lý Lead">
        <button type="button" role="tab" aria-selected={workspaceTab === 'list'} className={workspaceTab === 'list' ? 'is-active' : ''} onClick={() => setWorkspaceTab('list')}><List size={16} /> Danh sách Lead <span>{accessibleLeads.length}</span></button>
        {currentUser.role === 'admin' && <button type="button" role="tab" aria-selected={workspaceTab === 'performance'} className={workspaceTab === 'performance' ? 'is-active' : ''} onClick={() => setWorkspaceTab('performance')}><Users size={16} /> Khách hàng của Sale</button>}
      </div>

      <div className="lead-summary-grid">
        <div className="lead-summary-card"><Users size={18} /><div><strong>{accessibleLeads.length}</strong><span>Tổng Lead</span></div></div>
        <div className="lead-summary-card"><TrendingUp size={18} /><div><strong>{pursuedLeadCount}</strong><span>Đang theo đuổi</span></div></div>
        <div className="lead-summary-card"><CalendarClock size={18} /><div><strong>{accessibleLeads.filter(isOverdue).length}</strong><span>Quá hạn chăm sóc</span></div></div>
        <div className="lead-summary-card"><CheckCircle2 size={18} /><div><strong>{accessibleLeads.filter(lead => lead.stage === 'converted').length}</strong><span>Đã chuyển đổi</span></div></div>
      </div>

      {workspaceTab === 'performance' && currentUser.role === 'admin' ? (
        <LeadSalesWorkspace
          leads={leads}
          saleUsers={saleUsers}
          definitions={filterDefinitions}
          onOpenLead={setSelectedLeadId}
        />
      ) : (
        <>
          <section className="lead-toolbar">
            <div className="lead-search">
              <Search size={16} />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={t('Tìm công ty, liên hệ, SĐT, địa chỉ, nhu cầu, nhãn...')} />
            </div>
            {filterDefinitions.filter(field => field.active).map(field => (
              <details key={field.id} className="lead-filter-menu lead-filter-menu--toolbar">
                <summary>{field.name}{(dynamicFilters[field.id] || []).length > 0 && <span>{dynamicFilters[field.id].length}</span>}</summary>
                <div className="lead-filter-menu__content">
                  <button
                    type="button"
                    className={(dynamicFilters[field.id] || []).length === 0 ? 'is-selected' : ''}
                    onClick={() => setDynamicFilters(previous => ({ ...previous, [field.id]: [] }))}
                  >
                    Tất cả {field.name.toLocaleLowerCase('vi-VN')}
                  </button>
                  {field.options.filter(option => option.active).map(option => {
                    const selected = (dynamicFilters[field.id] || []).includes(option.id);
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={selected ? 'is-selected' : ''}
                        onClick={() => handleDynamicFilterToggle(field, option.id, !selected)}
                      >
                        <i style={{ backgroundColor: option.color }} />
                        <span>{option.label}</span>
                        {selected && <CheckCircle2 size={14} />}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
            <button type="button" className="btn btn-outline btn-symbol" onClick={clearFilters} title={t('Xóa bộ lọc')}><Filter size={15} /></button>
          </section>

          <section className="lead-table-card">
            <div className="lead-table-result">Hiển thị <strong>{filteredLeads.length}</strong> / {accessibleLeads.length} Lead</div>
            <div className="table-container">
              <table className="lead-table lead-table--classified">
                <thead><tr><th>{t('Doanh nghiệp')}</th><th>{t('Liên hệ')}</th><th>{t('Nguồn / khu vực')}</th><th>{t('Giá trị tiềm năng')}</th><th>{t('Sale phụ trách')}</th><th>{t('Chăm sóc tiếp')}</th><th>{t('Thao tác')}</th></tr></thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                      <td><strong>{lead.companyName}</strong></td>
                      <td><strong>{lead.contactPerson || '—'}</strong><span>{lead.phone || lead.email || 'Chưa có liên hệ'}</span></td>
                      <td><strong>{getClassificationLabel(lead, LEAD_FILTER_IDS.source, lead.source || '—')}</strong><span>{getClassificationLabel(lead, LEAD_FILTER_IDS.province, lead.province || 'Chưa xác định')}</span></td>
                      <td><strong>{lead.potentialValue.toLocaleString('vi-VN')} đ</strong></td>
                      <td>{users.find(user => user.uid === lead.assignedSaleId)?.displayName || lead.assignedSaleName || 'Chưa phân công'}</td>
                      <td><span className={isOverdue(lead) ? 'lead-date-overdue' : ''}>{formatDateTime(lead.nextFollowUpAt)}</span></td>
                      <td><div className="lead-row-actions" onClick={event => event.stopPropagation()}><button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedLeadId(lead.id)}>{t('Chi tiết')}</button><button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditForm(lead)} title={t('Sửa')}><Pencil size={13} /></button></div></td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && <tr><td colSpan={7} className="lead-empty">{t('Không có Lead phù hợp với bộ lọc.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {showFilterConfig && currentUser.role === 'admin' && (
        <LeadFilterAdminModal
          definitions={filterDefinitions}
          onClose={() => setShowFilterConfig(false)}
          onSaveDefinition={handleSaveFilterDefinition}
        />
      )}
    </div>
  );
};
