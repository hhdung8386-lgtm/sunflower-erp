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
  Save,
  Search,
  SlidersHorizontal,
  Tags,
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
  LeadFilterDefinition,
  LeadRecord,
  LeadStage
} from '../domain/crmModels';
import { sortNewestFirst } from '../domain/recordOrdering';
import {
  getLeadFilterValues,
  mergeLeadFilterDefinitions,
  slugifyLeadFilterId
} from '../domain/leadFilterConfig';
import { dbService, type UserProfile } from '../services/firebaseService';
import {
  LeadDynamicFields,
  LeadFilterAdminModal,
  LeadPerformancePanel,
  LeadTagChips,
  type LeadSavedViewRecord,
  type LeadSavedViewState,
  type LeadCustomValueFilter
} from '../components/LeadFilterSystem';
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
  onNavigateToCrm
}) => {
  const { t } = useLanguage();
  const saleUsers = useMemo(() => users.filter(user => user.role === 'sale'), [users]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [saleFilter, setSaleFilter] = useState('all');
  const [finderFilter, setFinderFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | LeadCompanySize>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [workspaceTab, setWorkspaceTab] = useState<'list' | 'performance'>('list');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [storedFilterDefinitions, setStoredFilterDefinitions] = useState<LeadFilterDefinition[]>([]);
  const [savedViews, setSavedViews] = useState<LeadSavedViewRecord[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string[]>>({});
  const [dynamicValueFilters, setDynamicValueFilters] = useState<Record<string, LeadCustomValueFilter>>({});
  const [dynamicMatchMode, setDynamicMatchMode] = useState<'all' | 'any'>('all');
  const [potentialMin, setPotentialMin] = useState('');
  const [potentialMax, setPotentialMax] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [inactiveDays, setInactiveDays] = useState('');
  const [newSavedViewName, setNewSavedViewName] = useState('');
  const [newSavedViewVisibility, setNewSavedViewVisibility] = useState<'private' | 'admin' | 'all'>('all');
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

  useEffect(() => {
    const unsubscribeDefinitions = dbService.subscribeCollection('lead_filter_definitions', data => {
      setStoredFilterDefinitions(data as LeadFilterDefinition[]);
    });
    const unsubscribeViews = dbService.subscribeCollection('lead_saved_views', data => {
      setSavedViews(data as LeadSavedViewRecord[]);
    });
    return () => {
      unsubscribeDefinitions();
      unsubscribeViews();
    };
  }, []);

  const filterDefinitions = useMemo(
    () => mergeLeadFilterDefinitions(storedFilterDefinitions),
    [storedFilterDefinitions]
  );

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

  const getLastInteractionTime = (lead: LeadRecord) => {
    const activityTimes = (lead.activities || []).map(activity => new Date(activity.occurredAt).getTime()).filter(Number.isFinite);
    const updatedTime = new Date(lead.updatedAt || lead.createdAt).getTime();
    return Math.max(Number.isFinite(updatedTime) ? updatedTime : 0, ...activityTimes, 0);
  };

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return accessibleLeads.filter(lead => {
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
        Object.entries(getLeadFilterValues(lead)).flatMap(([fieldId, optionIds]) => {
          const definition = filterDefinitions.find(field => field.id === fieldId);
          return optionIds.map(optionId => definition?.options.find(item => item.id === optionId)?.label || optionId);
        }),
        (lead.activities || []).map(activity => activity.note)
      ]);
      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
      const matchesSale = saleFilter === 'all' || lead.assignedSaleId === saleFilter;
      const matchesFinder = finderFilter === 'all' || (lead.discoveredById || lead.createdById) === finderFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      const matchesProvince = provinceFilter === 'all' || lead.province === provinceFilter;
      const matchesSize = sizeFilter === 'all' || lead.companySize === sizeFilter;
      const leadFilterValues = getLeadFilterValues(lead);
      const dynamicMatches = Object.entries(dynamicFilters)
        .filter(([, selectedValues]) => selectedValues.length > 0)
        .map(([fieldId, selectedValues]) => {
          const currentValues = leadFilterValues[fieldId] || [];
          return dynamicMatchMode === 'all'
            ? selectedValues.every(value => currentValues.includes(value))
            : selectedValues.some(value => currentValues.includes(value));
        });
      const matchesDynamic = dynamicMatches.length === 0
        || (dynamicMatchMode === 'all' ? dynamicMatches.every(Boolean) : dynamicMatches.some(Boolean));
      const matchesDynamicValues = Object.entries(dynamicValueFilters).every(([fieldId, condition]) => {
        if (!condition.operator) return true;
        const definition = filterDefinitions.find(field => field.id === fieldId);
        const rawValue = leadFilterValues[fieldId]?.[0] || '';
        if (condition.operator === 'empty') return !rawValue;
        if (condition.operator === 'not_empty') return Boolean(rawValue);
        if (definition?.type === 'checkbox') {
          return condition.operator === 'true' ? rawValue === 'true' : rawValue !== 'true';
        }
        if (definition?.type === 'text') {
          const normalizedValue = normalizeSearchText(rawValue);
          const normalizedCondition = normalizeSearchText(condition.value);
          return condition.operator === 'not_contains'
            ? !normalizedValue.includes(normalizedCondition)
            : normalizedValue.includes(normalizedCondition);
        }
        if (definition?.type === 'number') {
          const numberValue = Number(rawValue);
          if (!rawValue || !Number.isFinite(numberValue)) return false;
          if (condition.operator === 'greater') return numberValue > Number(condition.value);
          if (condition.operator === 'less') return numberValue < Number(condition.value);
          if (condition.operator === 'between') return numberValue >= Number(condition.value) && numberValue <= Number(condition.valueTo);
          return numberValue === Number(condition.value);
        }
        if (definition?.type === 'date') {
          const dateValue = new Date(rawValue).getTime();
          if (!Number.isFinite(dateValue)) return false;
          const fromValue = new Date(condition.value).getTime();
          if (condition.operator === 'before') return dateValue < fromValue;
          if (condition.operator === 'after') return dateValue > fromValue;
          if (condition.operator === 'between') return dateValue >= fromValue && dateValue <= new Date(condition.valueTo).getTime();
          return dateValue === fromValue;
        }
        return true;
      });
      const potentialValue = Number(lead.potentialValue || 0);
      const matchesPotential = (!potentialMin || potentialValue >= Number(potentialMin))
        && (!potentialMax || potentialValue <= Number(potentialMax));
      const createdTime = new Date(lead.createdAt).getTime();
      const matchesCreatedDate = (!createdFrom || createdTime >= new Date(`${createdFrom}T00:00:00`).getTime())
        && (!createdTo || createdTime <= new Date(`${createdTo}T23:59:59`).getTime());
      const inactiveThreshold = Number(inactiveDays);
      const matchesInactive = !inactiveDays
        || (LEADS_PAGE_REFERENCE_TIME - getLastInteractionTime(lead)) >= inactiveThreshold * 86_400_000;
      return matchesSearch
        && matchesStage
        && matchesSale
        && matchesFinder
        && matchesSource
        && matchesProvince
        && matchesSize
        && matchesDynamic
        && matchesDynamicValues
        && matchesPotential
        && matchesCreatedDate
        && matchesInactive
        && (!onlyOverdue || isOverdue(lead));
    });
  }, [
    accessibleLeads,
    createdFrom,
    createdTo,
    dynamicFilters,
    dynamicMatchMode,
    dynamicValueFilters,
    filterDefinitions,
    finderFilter,
    inactiveDays,
    onlyOverdue,
    potentialMax,
    potentialMin,
    provinceFilter,
    saleFilter,
    searchTerm,
    sizeFilter,
    sourceFilter,
    stageFilter,
    users
  ]);

  const pursuedLeadCount = accessibleLeads.filter(lead => {
    const markerValues = Object.values(getLeadFilterValues(lead)).flat();
    return ['quoted', 'negotiating'].includes(lead.stage)
      || ['preparing_quote', 'quote_sent', 'negotiating', 'price_negotiation', 'waiting_feedback'].some(marker => markerValues.includes(marker));
  }).length;

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
    if (!form.companyName.trim()) return;

    const assignedSale = saleUsers.find(user => user.uid === form.assignedSaleId);
    const discoveredBy = saleUsers.find(user => user.uid === form.discoveredById);
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
      discoveredById: form.discoveredById || currentUser.uid,
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

  const handleLeadFilterValueChange = async (
    lead: LeadRecord,
    field: LeadFilterDefinition,
    value: string,
    checked?: boolean
  ) => {
    const currentValues = getLeadFilterValues(lead);
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

    await dbService.updateDocument('leads', lead.id, {
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

  const handleArchiveFilterDefinition = async (definition: LeadFilterDefinition) => {
    await dbService.addDocument('lead_filter_definitions', {
      ...definition,
      active: false,
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString()
    });
  };

  const getCurrentFilterState = (): LeadSavedViewState => ({
    searchTerm,
    stageFilter,
    saleFilter,
    finderFilter,
    sourceFilter,
    provinceFilter,
    sizeFilter,
    onlyOverdue,
    dynamicFilters,
    dynamicValueFilters,
    dynamicMatchMode,
    potentialMin,
    potentialMax,
    createdFrom,
    createdTo,
    inactiveDays
  });

  const applySavedView = (view: LeadSavedViewRecord) => {
    const state = view.state;
    setSearchTerm(state.searchTerm || '');
    setStageFilter((state.stageFilter || 'all') as 'all' | LeadStage);
    setSaleFilter(state.saleFilter || 'all');
    setFinderFilter(state.finderFilter || 'all');
    setSourceFilter(state.sourceFilter || 'all');
    setProvinceFilter(state.provinceFilter || 'all');
    setSizeFilter((state.sizeFilter || 'all') as 'all' | LeadCompanySize);
    setOnlyOverdue(Boolean(state.onlyOverdue));
    setDynamicFilters(state.dynamicFilters || {});
    setDynamicValueFilters(state.dynamicValueFilters || {});
    setDynamicMatchMode(state.dynamicMatchMode || 'all');
    setPotentialMin(state.potentialMin || '');
    setPotentialMax(state.potentialMax || '');
    setCreatedFrom(state.createdFrom || '');
    setCreatedTo(state.createdTo || '');
    setInactiveDays(state.inactiveDays || '');
    setWorkspaceTab('list');
  };

  const handleSaveCurrentView = async () => {
    const name = newSavedViewName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    await dbService.addDocument('lead_saved_views', {
      id: `lead-view-${slugifyLeadFilterId(name)}-${Date.now().toString(36)}`,
      name,
      ownerId: currentUser.uid,
      visibility: currentUser.role === 'admin' ? newSavedViewVisibility : 'private',
      state: getCurrentFilterState(),
      createdAt: now,
      updatedAt: now
    });
    setNewSavedViewName('');
  };

  const visibleSavedViews = savedViews.filter(view => (
    currentUser.role === 'admin' || view.visibility === 'all' || view.ownerId === currentUser.uid
  ));

  const handleDynamicFilterToggle = (fieldId: string, optionId: string, checked: boolean) => {
    setDynamicFilters(previous => {
      const fieldValues = previous[fieldId] || [];
      return {
        ...previous,
        [fieldId]: checked
          ? Array.from(new Set([...fieldValues, optionId]))
          : fieldValues.filter(item => item !== optionId)
      };
    });
  };

  const updateDynamicValueFilter = (fieldId: string, patch: Partial<LeadCustomValueFilter>) => {
    setDynamicValueFilters(previous => ({
      ...previous,
      [fieldId]: {
        operator: previous[fieldId]?.operator || '',
        value: previous[fieldId]?.value || '',
        valueTo: previous[fieldId]?.valueTo || '',
        ...patch
      }
    }));
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
    setFinderFilter('all');
    setSourceFilter('all');
    setProvinceFilter('all');
    setSizeFilter('all');
    setOnlyOverdue(false);
    setDynamicFilters({});
    setDynamicValueFilters({});
    setDynamicMatchMode('all');
    setPotentialMin('');
    setPotentialMax('');
    setCreatedFrom('');
    setCreatedTo('');
    setInactiveDays('');
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
            <LeadTagChips lead={selectedLead} definitions={filterDefinitions} limit={5} />
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
            <label className="lead-field-label">{t('Kết quả / giai đoạn chính')}</label>
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

          <section className="lead-panel lead-panel--wide lead-classification-panel">
            <div className="lead-panel__title"><Tags size={17} /> {t('Tiến độ bán hàng')}</div>
            <p className="lead-panel__hint">Có thể tích nhiều mục cùng lúc. Thay đổi được lưu ngay vào lịch sử chăm sóc.</p>
            <LeadDynamicFields
              lead={selectedLead}
              definitions={filterDefinitions}
              canEditAll={currentUser.role === 'admin'}
              onChange={(field, value, checked) => handleLeadFilterValueChange(selectedLead, field, value, checked)}
            />
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
                    <label>{t('Kết quả / giai đoạn chính')}</label>
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
                    <label>{t('Người tìm được Lead')}</label>
                    <select
                      value={form.discoveredById}
                      onChange={event => updateForm('discoveredById', event.target.value)}
                      disabled={currentUser.role === 'sale'}
                    >
                      <option value="">{t('-- Chưa xác định --')}</option>
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
        <button type="button" className="btn btn-primary" onClick={openCreateForm}><Plus size={16} /> {t('Thêm Lead')}</button>
      </div>

      <div className="lead-workspace-tabs" role="tablist" aria-label="Không gian quản lý Lead">
        <button type="button" role="tab" aria-selected={workspaceTab === 'list'} className={workspaceTab === 'list' ? 'is-active' : ''} onClick={() => setWorkspaceTab('list')}><List size={16} /> Danh sách Lead <span>{accessibleLeads.length}</span></button>
        {currentUser.role === 'admin' && <button type="button" role="tab" aria-selected={workspaceTab === 'performance'} className={workspaceTab === 'performance' ? 'is-active' : ''} onClick={() => setWorkspaceTab('performance')}><TrendingUp size={16} /> Hiệu quả Sale</button>}
      </div>

      <div className="lead-summary-grid">
        <div className="lead-summary-card"><Users size={18} /><div><strong>{accessibleLeads.length}</strong><span>Tổng Lead</span></div></div>
        <div className="lead-summary-card"><TrendingUp size={18} /><div><strong>{pursuedLeadCount}</strong><span>Đang theo đuổi</span></div></div>
        <div className="lead-summary-card"><CalendarClock size={18} /><div><strong>{accessibleLeads.filter(isOverdue).length}</strong><span>Quá hạn chăm sóc</span></div></div>
        <div className="lead-summary-card"><CheckCircle2 size={18} /><div><strong>{accessibleLeads.filter(lead => lead.stage === 'converted').length}</strong><span>Đã chuyển đổi</span></div></div>
      </div>

      {workspaceTab === 'performance' && currentUser.role === 'admin' ? (
        <LeadPerformancePanel
          leads={leads}
          saleUsers={saleUsers}
          isOverdue={isOverdue}
          onOpenSale={saleId => {
            setFinderFilter(saleId);
            setWorkspaceTab('list');
            setShowAdvancedFilters(true);
          }}
        />
      ) : (
        <>
          <section className="lead-saved-views">
            <div className="lead-saved-views__list">
              <span><Save size={14} /> Bộ lọc đã lưu</span>
              {visibleSavedViews.map(view => <button type="button" key={view.id} onClick={() => applySavedView(view)}>{view.name}</button>)}
              {visibleSavedViews.length === 0 && <em>Chưa có</em>}
            </div>
            <div className="lead-save-view-form">
              <input value={newSavedViewName} onChange={event => setNewSavedViewName(event.target.value)} placeholder="Tên bộ lọc mới..." />
              {currentUser.role === 'admin' && <select value={newSavedViewVisibility} onChange={event => setNewSavedViewVisibility(event.target.value as 'private' | 'admin' | 'all')}><option value="all">Dùng chung</option><option value="admin">Chỉ Admin</option><option value="private">Cá nhân</option></select>}
              <button type="button" className="btn btn-sm btn-outline" disabled={!newSavedViewName.trim()} onClick={handleSaveCurrentView}><Save size={13} /> Lưu</button>
            </div>
          </section>

          <section className="lead-toolbar">
            <div className="lead-search">
              <Search size={16} />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={t('Tìm công ty, liên hệ, SĐT, địa chỉ, nhu cầu, nhãn...')} />
            </div>
            {currentUser.role === 'admin' && <select value={saleFilter} onChange={event => setSaleFilter(event.target.value)}><option value="all">{t('Tất cả Sale phụ trách')}</option>{saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select>}
            <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="all">{t('Tất cả nguồn')}</option>{sources.map(source => <option key={source} value={source}>{source}</option>)}</select>
            <select value={provinceFilter} onChange={event => setProvinceFilter(event.target.value)}><option value="all">{t('Tất cả tỉnh/thành')}</option>{provinces.map(province => <option key={province} value={province}>{province}</option>)}</select>
            <select value={sizeFilter} onChange={event => setSizeFilter(event.target.value as 'all' | LeadCompanySize)}><option value="all">{t('Tất cả quy mô')}</option><option value="large">{COMPANY_SIZE_LABELS.large}</option><option value="medium">{COMPANY_SIZE_LABELS.medium}</option><option value="small">{COMPANY_SIZE_LABELS.small}</option></select>
            <select
              value={(dynamicFilters.lead_progress || [])[0] || 'all'}
              onChange={event => setDynamicFilters(event.target.value === 'all' ? {} : { lead_progress: [event.target.value] })}
            >
              <option value="all">{t('Tất cả tiến độ')}</option>
              {filterDefinitions[0].options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <label className={`lead-overdue-toggle ${onlyOverdue ? 'is-active' : ''}`}><input type="checkbox" checked={onlyOverdue} onChange={event => setOnlyOverdue(event.target.checked)} /><CalendarClock size={14} /> {t('Quá hạn')}</label>
            <button type="button" className="btn btn-outline btn-symbol" onClick={clearFilters} title={t('Xóa bộ lọc')}><Filter size={15} /></button>
            <div className="lead-view-toggle"><button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} title={t('Dạng danh sách')}><List size={16} /></button><button type="button" className={viewMode === 'kanban' ? 'is-active' : ''} onClick={() => setViewMode('kanban')} title="Kanban"><KanbanSquare size={16} /></button></div>
          </section>

          <section className="lead-quick-filters">
            {filterDefinitions.filter(field => field.active && field.showInQuickFilter && ['multi_select', 'single_select'].includes(field.type)).map(field => (
              <details key={field.id} className="lead-filter-menu">
                <summary>{field.name}{(dynamicFilters[field.id] || []).length > 0 && <span>{dynamicFilters[field.id].length}</span>}</summary>
                <div className="lead-filter-menu__content">
                  {field.options.filter(item => item.active).map(item => <label key={item.id}><input type="checkbox" checked={(dynamicFilters[field.id] || []).includes(item.id)} onChange={event => handleDynamicFilterToggle(field.id, item.id, event.target.checked)} /><i style={{ backgroundColor: item.color }} />{item.label}</label>)}
                </div>
              </details>
            ))}
          </section>

          {showAdvancedFilters && (
            <section className="lead-advanced-panel">
              <div className="lead-advanced-panel__header"><div><SlidersHorizontal size={17} /><strong>Bộ lọc nâng cao</strong><span>Kết hợp dữ liệu hệ thống và các trường do Admin cấu hình.</span></div><label>Điều kiện nhãn <select value={dynamicMatchMode} onChange={event => setDynamicMatchMode(event.target.value as 'all' | 'any')}><option value="all">Khớp tất cả</option><option value="any">Khớp bất kỳ</option></select></label></div>
              <div className="lead-system-filter-grid">
                {currentUser.role === 'admin' && <label><span>Người tìm Lead</span><select value={finderFilter} onChange={event => setFinderFilter(event.target.value)}><option value="all">Tất cả</option>{saleUsers.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></label>}
                <label><span>Tỉnh / thành</span><select value={provinceFilter} onChange={event => setProvinceFilter(event.target.value)}><option value="all">Tất cả</option>{provinces.map(province => <option key={province} value={province}>{province}</option>)}</select></label>
                <label><span>Quy mô</span><select value={sizeFilter} onChange={event => setSizeFilter(event.target.value as 'all' | LeadCompanySize)}><option value="all">Tất cả</option><option value="large">{COMPANY_SIZE_LABELS.large}</option><option value="medium">{COMPANY_SIZE_LABELS.medium}</option><option value="small">{COMPANY_SIZE_LABELS.small}</option></select></label>
                <label><span>Giá trị từ</span><input type="number" min="0" value={potentialMin} onChange={event => setPotentialMin(event.target.value)} placeholder="0" /></label>
                <label><span>Giá trị đến</span><input type="number" min="0" value={potentialMax} onChange={event => setPotentialMax(event.target.value)} placeholder="Không giới hạn" /></label>
                <label><span>Tạo từ ngày</span><input type="date" value={createdFrom} onChange={event => setCreatedFrom(event.target.value)} /></label>
                <label><span>Tạo đến ngày</span><input type="date" value={createdTo} onChange={event => setCreatedTo(event.target.value)} /></label>
                <label><span>Không tương tác ≥ ngày</span><input type="number" min="1" value={inactiveDays} onChange={event => setInactiveDays(event.target.value)} placeholder="Ví dụ: 15" /></label>
              </div>
              <div className="lead-advanced-fields">
                {filterDefinitions.filter(field => field.active && ['multi_select', 'single_select'].includes(field.type)).map(field => <div key={field.id}><strong>{field.name}</strong><div>{field.options.filter(item => item.active).map(item => <label key={item.id} className={(dynamicFilters[field.id] || []).includes(item.id) ? 'is-checked' : ''}><input type="checkbox" checked={(dynamicFilters[field.id] || []).includes(item.id)} onChange={event => handleDynamicFilterToggle(field.id, item.id, event.target.checked)} /><i style={{ backgroundColor: item.color }} />{item.label}</label>)}</div></div>)}
              </div>
              <div className="lead-custom-value-filters">
                {filterDefinitions.filter(field => field.active && !['multi_select', 'single_select'].includes(field.type)).map(field => {
                  const condition = dynamicValueFilters[field.id] || { operator: '', value: '', valueTo: '' };
                  return (
                    <div key={field.id}>
                      <strong>{field.name}</strong>
                      <select value={condition.operator} onChange={event => updateDynamicValueFilter(field.id, { operator: event.target.value })}>
                        <option value="">Không lọc</option>
                        {field.type === 'checkbox' ? <><option value="true">Có</option><option value="false">Không</option></> : <><option value="empty">Đang để trống</option><option value="not_empty">Không để trống</option></>}
                        {field.type === 'text' && <><option value="contains">Có chứa</option><option value="not_contains">Không chứa</option></>}
                        {field.type === 'number' && <><option value="equal">Bằng</option><option value="greater">Lớn hơn</option><option value="less">Nhỏ hơn</option><option value="between">Trong khoảng</option></>}
                        {field.type === 'date' && <><option value="equal">Đúng ngày</option><option value="before">Trước ngày</option><option value="after">Sau ngày</option><option value="between">Trong khoảng</option></>}
                      </select>
                      {!['', 'empty', 'not_empty', 'true', 'false'].includes(condition.operator) && <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={condition.value} onChange={event => updateDynamicValueFilter(field.id, { value: event.target.value })} placeholder="Giá trị lọc" />}
                      {condition.operator === 'between' && <input type={field.type === 'number' ? 'number' : 'date'} value={condition.valueTo} onChange={event => updateDynamicValueFilter(field.id, { valueTo: event.target.value })} placeholder="Đến" />}
                    </div>
                  );
                })}
              </div>
              <div className="lead-filter-result"><strong>{filteredLeads.length}</strong> Lead phù hợp với điều kiện hiện tại.</div>
            </section>
          )}

          {viewMode === 'list' ? (
            <section className="lead-table-card">
              <div className="lead-table-result">Hiển thị <strong>{filteredLeads.length}</strong> / {accessibleLeads.length} Lead</div>
              <div className="table-container">
                <table className="lead-table lead-table--classified">
                  <thead><tr><th>{t('Doanh nghiệp')}</th><th>{t('Liên hệ')}</th><th>{t('Nguồn / khu vực')}</th><th>{t('Giá trị tiềm năng')}</th><th>{t('Sale phụ trách')}</th><th>{t('Chăm sóc tiếp')}</th><th>{t('Tiến độ')}</th><th>{t('Thao tác')}</th></tr></thead>
                  <tbody>
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                        <td><strong>{lead.companyName}</strong><span>{COMPANY_SIZE_LABELS[lead.companySize]}</span></td>
                        <td><strong>{lead.contactPerson || '—'}</strong><span>{lead.phone || lead.email || 'Chưa có liên hệ'}</span></td>
                        <td><strong>{lead.source || '—'}</strong><span>{lead.province || 'Chưa xác định'}</span></td>
                        <td><strong>{lead.potentialValue.toLocaleString('vi-VN')} đ</strong></td>
                        <td>{users.find(user => user.uid === lead.assignedSaleId)?.displayName || lead.assignedSaleName || 'Chưa phân công'}</td>
                        <td><span className={isOverdue(lead) ? 'lead-date-overdue' : ''}>{formatDateTime(lead.nextFollowUpAt)}</span></td>
                        <td><LeadTagChips lead={lead} definitions={filterDefinitions} /></td>
                        <td><div className="lead-row-actions" onClick={event => event.stopPropagation()}><button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedLeadId(lead.id)}>{t('Chi tiết')}</button><button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditForm(lead)} title={t('Sửa')}><Pencil size={13} /></button></div></td>
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
                return <div key={stage.id} className="lead-kanban-column"><div className="lead-kanban-column__header"><span>{stage.label}</span><strong>{stageLeads.length}</strong></div><div className="lead-kanban-column__body">{stageLeads.map(lead => <button type="button" key={lead.id} className="lead-kanban-card" onClick={() => setSelectedLeadId(lead.id)}><strong>{lead.companyName}</strong><LeadTagChips lead={lead} definitions={filterDefinitions} limit={2} /><span><Phone size={12} /> {lead.phone || 'Chưa có SĐT'}</span><span><Mail size={12} /> {lead.email || 'Chưa có email'}</span><span><MapPin size={12} /> {lead.province || 'Chưa có khu vực'}</span><span className={isOverdue(lead) ? 'lead-date-overdue' : ''}><CalendarClock size={12} /> {formatDateTime(lead.nextFollowUpAt)}</span></button>)}{stageLeads.length === 0 && <div className="lead-kanban-empty">{t('Chưa có Lead')}</div>}</div></div>;
              })}
            </section>
          )}
        </>
      )}

      {showLeadForm && renderLeadForm()}
      {showFilterConfig && currentUser.role === 'admin' && (
        <LeadFilterAdminModal
          definitions={filterDefinitions}
          savedViews={savedViews}
          onClose={() => setShowFilterConfig(false)}
          onSaveDefinition={handleSaveFilterDefinition}
          onArchiveDefinition={handleArchiveFilterDefinition}
          onDeleteSavedView={async view => { await dbService.deleteDocument('lead_saved_views', view.id); }}
        />
      )}
    </div>
  );
};
