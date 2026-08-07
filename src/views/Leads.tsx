import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
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
  LeadProfileFieldDefinition,
  LeadRecord,
  LeadStage
} from '../domain/crmModels';
import {
  findCandidateDuplicate,
  mapCandidateSourceToLeadSource,
  type LeadCandidateRecord
} from '../domain/leadCandidateModels';
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
  findLeadFilterParentOption,
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
import { LeadCandidateWorkspace } from '../components/LeadCandidateWorkspace';
import {
  LeadProfileFieldControl,
  LeadProfileStructureEditor
} from '../components/LeadProfileFields';
import {
  isLeadSystemProfileField,
  mergeLeadProfileFieldDefinitions
} from '../domain/leadProfileConfig';
import { PageBackButton } from '../components/PageBackButton';
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

const updateLeadFilterValues = (
  currentValues: Record<string, string[]>,
  field: LeadFilterDefinition,
  value: string,
  checked?: boolean
) => {
  const previousFieldValues = currentValues[field.id] || [];
  let nextFieldValues: string[];

  if (field.id === LEAD_FILTER_IDS.province) {
    const province = field.options.find(option => (
      option.id === value || (option.children || []).some(child => child.id === value)
    ));
    nextFieldValues = value && province
      ? value === province.id ? [province.id] : [province.id, value]
      : [];
  } else if (field.type === 'multi_select') {
    nextFieldValues = checked
      ? Array.from(new Set([...previousFieldValues, value]))
      : previousFieldValues.filter(item => item !== value);
  } else if (field.type === 'checkbox') {
    nextFieldValues = checked ? ['true'] : [];
  } else {
    nextFieldValues = value ? [value] : [];
  }

  return { ...currentValues, [field.id]: nextFieldValues };
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
  const [workspaceTab, setWorkspaceTab] = useState<'list' | 'performance' | 'data'>('list');
  const [candidates, setCandidates] = useState<LeadCandidateRecord[]>([]);
  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [isEditingProfileStructure, setIsEditingProfileStructure] = useState(false);
  const [storedFilterDefinitions, setStoredFilterDefinitions] = useState<LeadFilterDefinition[]>([]);
  const [profileDefinitions, setProfileDefinitions] = useState<LeadProfileFieldDefinition[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string[]>>({});
  const [openFilterId, setOpenFilterId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState('');
  const [convertingCandidateId, setConvertingCandidateId] = useState('');
  const [form, setForm] = useState<LeadFormState>(() => createEmptyForm(currentUser, saleUsers));
  const [formFilterValues, setFormFilterValues] = useState<Record<string, string[]>>({});
  const [formProfileValues, setFormProfileValues] = useState<Record<string, string[]>>({});
  const [uploadingFiles, setUploadingFiles] = useState<LeadFileRecord[]>([]);
  const [taxCodeSaveError, setTaxCodeSaveError] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');

  useEffect(() => {
    const unsubscribe = dbService.subscribeCollection('leads', data => {
      setLeads(sortNewestFirst(data as LeadRecord[], lead => [lead.createdAt, lead.updatedAt]));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-lead-filter-popover]')) {
        setOpenFilterId('');
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFilterId('');
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = dbService.subscribeCollection('lead_candidates', data => {
      setCandidates(sortNewestFirst(data as LeadCandidateRecord[], candidate => [candidate.createdAt, candidate.updatedAt]));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribeDefinitions = dbService.subscribeCollection('lead_filter_definitions', data => {
      setStoredFilterDefinitions(data as LeadFilterDefinition[]);
    });
    return unsubscribeDefinitions;
  }, []);

  useEffect(() => {
    const unsubscribeDefinitions = dbService.subscribeCollection('lead_profile_field_definitions', data => {
      const definitions = (data as LeadProfileFieldDefinition[])
        .map(field => ({ ...field, options: Array.isArray(field.options) ? field.options : [] }))
        .sort((a, b) => a.order - b.order);
      setProfileDefinitions(definitions);
    });
    return unsubscribeDefinitions;
  }, []);

  const filterDefinitions = useMemo(
    () => mergeLeadFilterDefinitions(storedFilterDefinitions),
    [storedFilterDefinitions]
  );

  const resolvedProfileDefinitions = useMemo(
    () => mergeLeadProfileFieldDefinitions(profileDefinitions),
    [profileDefinitions]
  );

  const customProfileDefinitions = useMemo(
    () => profileDefinitions.filter(definition => !isLeadSystemProfileField(definition)),
    [profileDefinitions]
  );

  const accessibleLeads = useMemo(() => leads.filter(lead => {
    if (currentUser.role === 'admin') return true;
    return lead.assignedSaleId === currentUser.uid;
  }), [currentUser.role, currentUser.uid, leads]);

  const accessibleCandidates = useMemo(() => candidates.filter(candidate => (
    currentUser.role === 'admin' || candidate.assignedSaleId === currentUser.uid
  )), [candidates, currentUser.role, currentUser.uid]);

  const quickFilterOptionsByField = useMemo(() => {
    const provinceValuesWithData = new Set(
      accessibleLeads.flatMap(lead => getLeadFilterValues(lead, filterDefinitions)[LEAD_FILTER_IDS.province] || [])
    );

    return Object.fromEntries(filterDefinitions.map(field => {
      const activeOptions = field.options.filter(option => option.active);
      if (field.id !== LEAD_FILTER_IDS.province) return [field.id, activeOptions];

      return [field.id, activeOptions.flatMap(province => {
        const activeAreasWithData = (province.children || []).filter(area => (
          area.active && provinceValuesWithData.has(area.id)
        ));
        const provinceHasData = provinceValuesWithData.has(province.id) || activeAreasWithData.length > 0;
        return provinceHasData ? [{ ...province, children: activeAreasWithData }] : [];
      })];
    }));
  }, [accessibleLeads, filterDefinitions]);

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
          return optionIds.map(optionId => findLeadFilterOption(filterDefinitions, fieldId, optionId)?.label || optionId);
        }),
        (lead.activities || []).map(activity => activity.note),
        Object.entries(lead.profileValues || {}).flatMap(([fieldId, fieldValues]) => {
          const definition = customProfileDefinitions.find(field => field.id === fieldId);
          return fieldValues.map(value => definition?.options.find(option => option.id === value)?.label || value);
        })
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
    users,
    customProfileDefinitions
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
  const convertingCandidate = convertingCandidateId
    ? candidates.find(candidate => candidate.id === convertingCandidateId) || null
    : null;
  const isTaxCodeLocked = Boolean(
    (editingLeadId && normalizeTaxCode(editingLead?.taxCode))
    || (convertingCandidateId && normalizeTaxCode(convertingCandidate?.taxCode))
  );
  const taxCodeConflict = useMemo(() => findTaxCodeConflict(
    form.taxCode,
    leads,
    customers,
    editingLeadId,
    editingLead?.convertedCustomerId || ''
  ), [customers, editingLead?.convertedCustomerId, editingLeadId, form.taxCode, leads]);
  const candidateTaxCodeConflict = useMemo(() => {
    const normalizedTaxCode = normalizeTaxCode(form.taxCode);
    if (!normalizedTaxCode) return null;
    const excludedCandidateId = convertingCandidateId || editingLead?.sourceCandidateId || '';
    return candidates.find(candidate => (
      candidate.id !== excludedCandidateId
      && normalizeTaxCode(candidate.taxCode) === normalizedTaxCode
    )) || null;
  }, [candidates, convertingCandidateId, editingLead?.sourceCandidateId, form.taxCode]);

  const describeTaxCodeConflict = (conflict: TaxCodeConflictRecord): string => {
    const saleName = conflict.assignedSaleName
      || users.find(user => user.uid === conflict.assignedSaleId)?.displayName
      || 'Sale khác';
    const profileType = conflict.recordType === 'customer' ? 'khách hàng CRM' : 'khách hàng tiềm năng';
    return `Mã số thuế này đã thuộc ${profileType} “${conflict.companyName}” và đang do ${saleName} phụ trách.`;
  };

  const openCreateForm = () => {
    setIsEditingProfileStructure(false);
    setEditingLeadId('');
    setConvertingCandidateId('');
    setFormFilterValues({});
    setFormProfileValues({});
    setUploadingFiles([]);
    setForm(createEmptyForm(currentUser, saleUsers));
    setTaxCodeSaveError('');
    setProfileSaveError('');
    setShowLeadForm(true);
  };

  const openEditForm = (lead: LeadRecord) => {
    setIsEditingProfileStructure(false);
    setEditingLeadId(lead.id);
    setConvertingCandidateId('');
    setFormFilterValues(getLeadFilterValues(lead, filterDefinitions));
    setFormProfileValues(lead.profileValues || {});
    setUploadingFiles(lead.files || []);
    setTaxCodeSaveError('');
    setProfileSaveError('');
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

  const openCreateFormFromCandidate = (candidate: LeadCandidateRecord) => {
    setIsEditingProfileStructure(false);
    setEditingLeadId('');
    setConvertingCandidateId(candidate.id);
    setUploadingFiles([]);
    setFormProfileValues({});
    setTaxCodeSaveError('');
    setProfileSaveError('');
    const leadSource = mapCandidateSourceToLeadSource(candidate.source);
    const sourceOptionId = findLeadFilterOptionId(filterDefinitions, LEAD_FILTER_IDS.source, leadSource);
    setFormFilterValues({
      [LEAD_FILTER_IDS.source]: sourceOptionId ? [sourceOptionId] : [],
      [LEAD_FILTER_IDS.progress]: ['contacted']
    });
    const sourceReference = candidate.sourceUrl || candidate.website;
    const notes = [
      candidate.note,
      sourceReference ? `Nguồn dữ liệu: ${sourceReference}` : ''
    ].filter(Boolean).join('\n');
    const assignedSaleId = saleUsers.some(user => user.uid === candidate.assignedSaleId)
      ? candidate.assignedSaleId
      : '';
    setForm({
      ...createEmptyForm(currentUser, saleUsers),
      companyName: candidate.companyName,
      contactPerson: candidate.contactPerson,
      phone: candidate.phone,
      email: candidate.email,
      taxCode: candidate.taxCode,
      address: candidate.address,
      province: candidate.province,
      source: leadSource,
      stage: 'contacted',
      assignedSaleId,
      discoveredById: candidate.discoveredById || candidate.createdById,
      nextFollowUpAt: toDateTimeLocal(candidate.queuedNextContactAt || candidate.nextContactAt),
      note: notes
    });
    setShowLeadForm(true);
  };

  const closeLeadForm = () => {
    setShowLeadForm(false);
    setConvertingCandidateId('');
    setIsEditingProfileStructure(false);
  };

  const handleFormFilterValueChange = (
    field: LeadFilterDefinition,
    value: string,
    checked?: boolean
  ) => {
    setFormFilterValues(previous => updateLeadFilterValues(previous, field, value, checked));

    const selectedOption = findLeadFilterOption(filterDefinitions, field.id, value);
    const selectedLabel = selectedOption?.label || '';
    if (field.id === LEAD_FILTER_IDS.companySize) {
      updateForm('companySize', ['', 'large', 'medium', 'small'].includes(value) ? value as LeadCompanySize : '');
    } else if (field.id === LEAD_FILTER_IDS.province) {
      updateForm('province', findLeadFilterParentOption(filterDefinitions, field.id, value)?.label || '');
    } else if (field.id === LEAD_FILTER_IDS.source) {
      updateForm('source', selectedLabel);
    }
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

  const handleProfileValueChange = (fieldId: string, values: string[]) => {
    setProfileSaveError('');
    setFormProfileValues(previous => ({ ...previous, [fieldId]: values }));
  };

  const handleSaveLead = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedTaxCode = normalizeTaxCode(form.taxCode);
    if (!form.companyName.trim() || !normalizedTaxCode) return;
    const missingRequiredField = customProfileDefinitions.find(field => (
      field.active && field.required && (formProfileValues[field.id] || []).length === 0
    ));
    if (missingRequiredField) {
      setProfileSaveError(`Vui lòng nhập trường “${missingRequiredField.name}”.`);
      return;
    }

    const [latestLeadData, latestCustomerData, latestCandidateData] = await Promise.all([
      dbService.getCollection('leads'),
      dbService.getCollection('customers'),
      dbService.getCollection('lead_candidates')
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
    const latestCandidateConflict = findCandidateDuplicate(
      {
        companyName: form.companyName,
        phone: form.phone,
        taxCode: normalizedTaxCode
      },
      latestCandidateData as LeadCandidateRecord[],
      [],
      [],
      convertingCandidateId || editingLead?.sourceCandidateId || ''
    );
    if (latestCandidateConflict?.reason === 'taxCode') {
      setTaxCodeSaveError(`Mã số thuế này đang nằm trong Dữ liệu khách hàng của doanh nghiệp “${latestCandidateConflict.companyName}”.`);
      return;
    }

    const assignedSale = saleUsers.find(user => user.uid === form.assignedSaleId);
    const discoveredById = form.discoveredById
      || (currentUser.role === 'sale' ? currentUser.uid : form.assignedSaleId);
    const discoveredBy = saleUsers.find(user => user.uid === discoveredById);
    const currentFilterValues = editingLead
      ? getLeadFilterValues(editingLead, filterDefinitions)
      : {};
    const provinceOptionId = findLeadFilterOptionId(filterDefinitions, LEAD_FILTER_IDS.province, form.province);
    const selectedProvinceValues = formFilterValues[LEAD_FILTER_IDS.province] || [];
    const selectedProvince = selectedProvinceValues.length > 0
      ? findLeadFilterParentOption(filterDefinitions, LEAD_FILTER_IDS.province, selectedProvinceValues.at(-1) || '')
      : undefined;
    const provinceFilterValues = selectedProvince?.id === provinceOptionId
      ? selectedProvinceValues
      : [provinceOptionId].filter(Boolean);
    const profileFilterValues = {
      ...currentFilterValues,
      ...formFilterValues,
      [LEAD_FILTER_IDS.companySize]: form.companySize ? [form.companySize] : [],
      [LEAD_FILTER_IDS.province]: provinceFilterValues,
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
      profileValues: formProfileValues,
      assignedSaleId: form.assignedSaleId,
      assignedSaleName: assignedSale?.displayName || '',
      discoveredById,
      discoveredByName: discoveredBy?.displayName || currentUser.displayName,
      sourceCandidateId: convertingCandidateId || editingLead?.sourceCandidateId || '',
      reminderTime: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : '',
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : '',
      note: form.note.trim(),
      files: uploadingFiles,
      updatedAt: now,
      updatedBy: currentUser.displayName
    };

    let savedLeadId = editingLeadId;
    if (editingLeadId) {
      await dbService.updateDocument('leads', editingLeadId, payload);
    } else {
      try {
        const createdLead = await dbService.addDocumentIfAbsent(
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
        savedLeadId = createdLead.id;
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

    if (convertingCandidateId && savedLeadId) {
      const candidate = candidates.find(item => item.id === convertingCandidateId);
      await dbService.updateDocument('lead_candidates', convertingCandidateId, {
        status: 'converted',
        convertedLeadId: savedLeadId,
        convertedAt: now,
        lastContactAt: now,
        contactAttempts: (candidate?.contactAttempts || 0) + 1,
        nextContactAt: '',
        queuedNextContactAt: '',
        taskStatus: 'dismissed',
        workStatus: 'completed',
        taskDismissedAt: now,
        updatedBy: currentUser.displayName
      });
    }

    closeLeadForm();
  };

  const handleLeadFilterValueChange = async (
    lead: LeadRecord,
    field: LeadFilterDefinition,
    value: string,
    checked?: boolean
  ) => {
    const currentValues = getLeadFilterValues(lead, filterDefinitions);
    const nextFilterValues = updateLeadFilterValues(currentValues, field, value, checked);
    const optionLabel = findLeadFilterOption(filterDefinitions, field.id, value)?.label || value || 'để trống';
    const actionLabel = field.type === 'multi_select' || field.type === 'checkbox'
      ? (checked ? 'Thêm' : 'Bỏ')
      : 'Cập nhật';
    const now = new Date().toISOString();
    const linkedProfileFields: Partial<Pick<LeadRecord, 'companySize' | 'province' | 'source'>> = {};
    if (field.id === LEAD_FILTER_IDS.companySize && ['', 'large', 'medium', 'small'].includes(value)) {
      linkedProfileFields.companySize = value as LeadCompanySize;
    }
    if (field.id === LEAD_FILTER_IDS.province) {
      linkedProfileFields.province = findLeadFilterParentOption(filterDefinitions, field.id, value)?.label || '';
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

  const handleSaveProfileDefinition = async (definition: LeadProfileFieldDefinition) => {
    await dbService.addDocument('lead_profile_field_definitions', {
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
    if (field.type === 'single_select') setOpenFilterId('');
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
    const optionIds = getLeadFilterValues(lead, filterDefinitions)[fieldId] || [];
    const labels = optionIds
      .map(optionId => findLeadFilterOption(filterDefinitions, fieldId, optionId)?.label)
      .filter(Boolean);
    return (fieldId === LEAD_FILTER_IDS.province ? labels.join(' · ') : labels[0]) || fallback;
  };

  const getProfileDisplayValue = (definition: LeadProfileFieldDefinition, values: string[]) => {
    if (definition.type === 'checkbox') return values[0] === 'true' ? 'Có' : 'Không';
    const labels = values.map(value => definition.options.find(option => option.id === value)?.label || value);
    return labels.join(', ') || '—';
  };

  if (showLeadForm) {
    return renderLeadForm();
  }

  if (selectedLead) {
    const assignedSale = users.find(user => user.uid === selectedLead.assignedSaleId);
    return (
      <div className="lead-detail-page">
        <div className="lead-detail-header">
          <PageBackButton onClick={() => setSelectedLeadId('')} />
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
              {customProfileDefinitions
                .filter(definition => definition.active || (selectedLead.profileValues?.[definition.id] || []).length > 0)
                .map(definition => (
                  <React.Fragment key={definition.id}>
                    <span>{definition.name}</span>
                    <strong>{getProfileDisplayValue(definition, selectedLead.profileValues?.[definition.id] || [])}</strong>
                  </React.Fragment>
                ))}
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
    const renderSystemProfileField = (definition: LeadProfileFieldDefinition) => {
      if (!definition.systemKey) return null;
      const disabled = currentUser.role !== 'admin' && !definition.saleEditable;
      const label = `${t(definition.name)}${definition.required ? ' *' : ''}`;
      const wideField = definition.systemKey === 'companyName'
        || definition.systemKey === 'address'
        || definition.systemKey === 'note';
      const className = `form-group${wideField ? ' lead-form-grid__wide' : ''}`;

      if (definition.systemKey === 'companyName') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input autoFocus value={form.companyName} disabled={disabled} required={definition.required} onChange={event => updateForm('companyName', event.target.value)} />
          </div>
        );
      }

      if (definition.systemKey === 'contactPerson') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input value={form.contactPerson} disabled={disabled} required={definition.required} onChange={event => updateForm('contactPerson', event.target.value)} />
          </div>
        );
      }

      if (definition.systemKey === 'phone') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input type="tel" value={form.phone} disabled={disabled} required={definition.required} onChange={event => updateForm('phone', event.target.value)} />
          </div>
        );
      }

      if (definition.systemKey === 'email') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input type="email" value={form.email} disabled={disabled} required={definition.required} onChange={event => updateForm('email', event.target.value)} />
          </div>
        );
      }

      if (definition.systemKey === 'taxCode') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input
              value={form.taxCode}
              onChange={event => updateForm('taxCode', event.target.value)}
              required={definition.required}
              readOnly={isTaxCodeLocked || disabled}
              aria-invalid={Boolean(taxCodeConflict || candidateTaxCodeConflict || taxCodeSaveError)}
              aria-describedby="lead-tax-code-guidance"
            />
            <span
              id="lead-tax-code-guidance"
              className={taxCodeConflict || candidateTaxCodeConflict || taxCodeSaveError ? 'lead-tax-code-message is-error' : 'lead-tax-code-message'}
            >
              {(taxCodeConflict || candidateTaxCodeConflict || taxCodeSaveError) && <AlertCircle size={13} />}
              {taxCodeConflict
                ? describeTaxCodeConflict(taxCodeConflict)
                : candidateTaxCodeConflict
                  ? `Mã số thuế này đang nằm trong Dữ liệu khách hàng của doanh nghiệp “${candidateTaxCodeConflict.companyName}”.`
                  : taxCodeSaveError || (isTaxCodeLocked
                    ? t('Mã số thuế là định danh duy nhất và không thể thay đổi sau khi tạo Lead.')
                    : t('Mã số thuế được kiểm tra trên toàn bộ Lead và khách hàng CRM.'))}
            </span>
          </div>
        );
      }

      if (definition.systemKey === 'address') {
        return (
          <div className={className} key={definition.id}>
            <label>{label}</label>
            <input value={form.address} disabled={disabled} required={definition.required} onChange={event => updateForm('address', event.target.value)} />
          </div>
        );
      }

      return (
        <div className={className} key={definition.id}>
          <label>{label}</label>
          <textarea rows={4} value={form.note} disabled={disabled} required={definition.required} onChange={event => updateForm('note', event.target.value)} placeholder={t('Thông tin cần lưu ý khi làm việc với khách hàng...')} />
        </div>
      );
    };

    return (
      <div className="lead-form-page">
        <header className="lead-form-page__header">
          <PageBackButton onClick={closeLeadForm} />
          <div>
            <span>{editingLeadId ? t('CHỈNH SỬA HỒ SƠ') : convertingCandidateId ? t('CHUYỂN TỪ DỮ LIỆU KHÁCH HÀNG') : t('HỒ SƠ MỚI')}</span>
            <h1>{editingLeadId ? t('Chỉnh sửa khách hàng tiềm năng') : convertingCandidateId ? t('Tiếp nhận khách hàng thành Lead') : t('Thêm khách hàng tiềm năng')}</h1>
            <p>{t('Ghi nhận đầy đủ hồ sơ, phân loại và lịch phụ trách trong một lần tạo Lead.')}</p>
          </div>
        </header>

        <form className="lead-form-page__form" onSubmit={handleSaveLead}>
          <div className="lead-form-page__content">
            <section className={`lead-form-card ${isEditingProfileStructure ? 'lead-form-card--profile-structure' : ''}`}>
              <div className="lead-form-card__heading">
                <Building2 size={18} />
                <div><h2>{t('Thông tin doanh nghiệp')}</h2><p>{t('Thông tin nhận diện và đầu mối liên hệ chính.')}</p></div>
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    className={`btn btn-sm ${isEditingProfileStructure ? 'btn-primary' : 'btn-outline'} lead-profile-structure-toggle`}
                    onClick={() => setIsEditingProfileStructure(previous => !previous)}
                  >
                    <Settings2 size={14} /> {isEditingProfileStructure ? t('Hoàn tất') : t('Chỉnh cấu trúc')}
                  </button>
                )}
              </div>
              {isEditingProfileStructure ? (
                <LeadProfileStructureEditor
                  definitions={resolvedProfileDefinitions}
                  onSaveDefinition={handleSaveProfileDefinition}
                />
              ) : (
                <div className="lead-form-grid">
                  {resolvedProfileDefinitions.filter(definition => definition.active).map(definition => (
                    isLeadSystemProfileField(definition)
                      ? renderSystemProfileField(definition)
                      : (
                        <LeadProfileFieldControl
                          key={definition.id}
                          field={definition}
                          values={formProfileValues[definition.id] || []}
                          disabled={currentUser.role !== 'admin' && !definition.saleEditable}
                          onChange={values => handleProfileValueChange(definition.id, values)}
                        />
                      )
                  ))}
                  <div className="form-group lead-form-grid__wide">
                    <label>{t('Tệp / tài liệu liên quan')}</label>
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
                  {profileSaveError && <div className="lead-profile-validation lead-form-grid__wide"><AlertCircle size={13} /> {profileSaveError}</div>}
                </div>
              )}
            </section>

            <section className="lead-form-card lead-form-card--classification">
              <div className="lead-form-card__heading">
                <Tags size={18} />
                <div><h2>{t('Phân loại khách hàng')}</h2><p>{t('Chọn thông tin để tìm kiếm, theo dõi và đánh giá Lead.')}</p></div>
              </div>
              <LeadDynamicFields
                values={formFilterValues}
                definitions={filterDefinitions}
                canEditAll={currentUser.role === 'admin'}
                onChange={handleFormFilterValueChange}
              />
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
              </div>
            </section>
          </div>
          <footer className="lead-form-page__footer">
            <span>{t('Các thay đổi chỉ được ghi nhận khi bấm Lưu.')}</span>
            <div>
              <button type="button" className="btn btn-outline" onClick={closeLeadForm}>{t('Hủy')}</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={Boolean(taxCodeConflict || candidateTaxCodeConflict) || !normalizeTaxCode(form.taxCode)}
              >
                {editingLeadId ? t('Cập nhật Lead') : convertingCandidateId ? t('Lưu Lead & hoàn tất tiếp cận') : t('Lưu Lead')}
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
          {workspaceTab === 'list' && currentUser.role === 'admin' && <button type="button" className="btn btn-outline" onClick={() => setShowFilterConfig(true)}><Settings2 size={16} /> {t('Cấu hình bộ lọc')}</button>}
          {workspaceTab === 'list' && <button type="button" className="btn btn-primary" onClick={openCreateForm}><Plus size={16} /> {t('Thêm Lead')}</button>}
        </div>
      </div>

      <div className="lead-workspace-tabs" role="tablist" aria-label="Không gian quản lý Lead">
        <button type="button" role="tab" aria-selected={workspaceTab === 'list'} className={workspaceTab === 'list' ? 'is-active' : ''} onClick={() => setWorkspaceTab('list')}><List size={16} /> Danh sách Lead <span>{accessibleLeads.length}</span></button>
        {currentUser.role === 'admin' && <button type="button" role="tab" aria-selected={workspaceTab === 'performance'} className={workspaceTab === 'performance' ? 'is-active' : ''} onClick={() => setWorkspaceTab('performance')}><Users size={16} /> Khách hàng của Sale</button>}
        <button type="button" role="tab" aria-selected={workspaceTab === 'data'} className={workspaceTab === 'data' ? 'is-active' : ''} onClick={() => setWorkspaceTab('data')}><Database size={16} /> Dữ liệu khách hàng <span>{accessibleCandidates.filter(candidate => candidate.status === 'new' || candidate.status === 'retry').length}</span></button>
      </div>

      {workspaceTab === 'list' && (
        <div className="lead-summary-grid">
          <div className="lead-summary-card"><Users size={18} /><div><strong>{accessibleLeads.length}</strong><span>Tổng Lead</span></div></div>
          <div className="lead-summary-card"><TrendingUp size={18} /><div><strong>{pursuedLeadCount}</strong><span>Đang theo đuổi</span></div></div>
          <div className="lead-summary-card"><CalendarClock size={18} /><div><strong>{accessibleLeads.filter(isOverdue).length}</strong><span>Quá hạn chăm sóc</span></div></div>
          <div className="lead-summary-card"><CheckCircle2 size={18} /><div><strong>{accessibleLeads.filter(lead => lead.stage === 'converted').length}</strong><span>Đã chuyển đổi</span></div></div>
        </div>
      )}

      {workspaceTab === 'performance' && currentUser.role === 'admin' ? (
        <LeadSalesWorkspace
          leads={leads}
          candidates={candidates}
          saleUsers={saleUsers}
          definitions={filterDefinitions}
          onOpenLead={setSelectedLeadId}
        />
      ) : workspaceTab === 'data' ? (
        <LeadCandidateWorkspace
          candidates={candidates}
          leads={leads}
          customers={customers}
          saleUsers={saleUsers}
          currentUser={currentUser}
          onStartConversion={openCreateFormFromCandidate}
        />
      ) : (
        <>
          <section className="lead-toolbar">
            <div className="lead-search">
              <Search size={16} />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={t('Tìm công ty, liên hệ, SĐT, địa chỉ, nhu cầu, nhãn...')} />
            </div>
            {filterDefinitions.filter(field => field.active && field.showInQuickFilter).map(field => (
              <div key={field.id} className="lead-filter-menu lead-filter-menu--toolbar" data-lead-filter-popover>
                <button type="button" className="lead-filter-menu__trigger" aria-expanded={openFilterId === field.id} onClick={() => setOpenFilterId(current => current === field.id ? '' : field.id)}>{field.name}{(dynamicFilters[field.id] || []).length > 0 && <span>{dynamicFilters[field.id].length}</span>}</button>
                {openFilterId === field.id && <div className="lead-filter-menu__content">
                  <button
                    type="button"
                    className={(dynamicFilters[field.id] || []).length === 0 ? 'is-selected' : ''}
                    onClick={() => setDynamicFilters(previous => ({ ...previous, [field.id]: [] }))}
                  >
                    Tất cả {field.name.toLocaleLowerCase('vi-VN')}
                  </button>
                  {(quickFilterOptionsByField[field.id] || []).map(option => {
                    const selected = (dynamicFilters[field.id] || []).includes(option.id);
                    return (
                      <React.Fragment key={option.id}>
                        <button
                          type="button"
                          className={selected ? 'is-selected' : ''}
                          onClick={() => handleDynamicFilterToggle(field, option.id, !selected)}
                        >
                          <i style={{ backgroundColor: option.color }} />
                          <span>{option.label}</span>
                          {selected && <CheckCircle2 size={14} />}
                        </button>
                        {field.id === LEAD_FILTER_IDS.province && (option.children || []).filter(area => area.active).map(area => {
                          const areaSelected = (dynamicFilters[field.id] || []).includes(area.id);
                          return (
                            <button
                              type="button"
                              key={area.id}
                              className={`lead-filter-area-option ${areaSelected ? 'is-selected' : ''}`}
                              onClick={() => handleDynamicFilterToggle(field, area.id, !areaSelected)}
                            >
                              <i style={{ backgroundColor: option.color }} />
                              <span>{area.label}</span>
                              {areaSelected && <CheckCircle2 size={14} />}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>}
              </div>
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
