import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Power,
  Search,
  Star,
  UserRoundSearch,
  X
} from 'lucide-react';
import type { CustomerRecord, LeadRecord } from '../domain/crmModels';
import {
  createCandidateDocumentIdFromTaxCode,
  findCandidateDuplicate,
  LEAD_CANDIDATE_SCHEMA_VERSION,
  type CandidateDuplicate,
  type LeadCandidateContactOutcome,
  type LeadCandidateRecord,
  type LeadCandidateStatus,
  type LeadCandidateTaskStatus
} from '../domain/leadCandidateModels';
import { normalizeTaxCode } from '../domain/taxCodeUniqueness';
import {
  dbService,
  isDocumentAlreadyExistsError,
  type UserProfile
} from '../services/firebaseService';
import { PageBackButton } from './PageBackButton';

interface LeadCandidateWorkspaceProps {
  candidates: LeadCandidateRecord[];
  leads: LeadRecord[];
  customers: CustomerRecord[];
  saleUsers: UserProfile[];
  currentUser: UserProfile;
  onStartConversion: (candidate: LeadCandidateRecord) => void;
}

interface CandidateFormState {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxCode: string;
  address: string;
  province: string;
  website: string;
  source: string;
  sourceUrl: string;
  assignedSaleId: string;
  nextContactAt: string;
  note: string;
}

interface ContactAttemptState {
  outcome: LeadCandidateContactOutcome;
  nextContactAt: string;
  note: string;
}

const CANDIDATE_SOURCES = ['Google Maps', 'Facebook', 'Website', 'Khách hàng giới thiệu', 'Khác'];
type CandidateWorkspaceView = 'tasks' | 'all';
type CandidateOutcomeFilter = 'all' | 'not_contacted' | LeadCandidateContactOutcome;
type CandidateSort = 'priority' | 'updated_desc' | 'company_asc' | 'next_contact_asc';

const CANDIDATE_STATUS_LABELS: Record<LeadCandidateStatus, string> = {
  new: 'Chưa tiếp cận',
  retry: 'Cần liên hệ lại',
  disqualified: 'Không phù hợp',
  converted: 'Đã thành Lead'
};

const CONTACT_OUTCOMES: Array<{
  value: LeadCandidateContactOutcome;
  label: string;
  hint: string;
}> = [
  { value: 'connected', label: 'Đã kết nối', hint: 'Đã trao đổi được với khách hàng' },
  { value: 'no_answer', label: 'Không nghe máy', hint: 'Chưa kết nối được' },
  { value: 'busy', label: 'Máy bận', hint: 'Cần gọi lại sau' },
  { value: 'call_back', label: 'Khách yêu cầu gọi lại', hint: 'Chọn lịch tiếp cận tiếp theo' },
  { value: 'potential', label: 'Có tiềm năng', hint: 'Có thể chuyển thành Lead' },
  { value: 'wrong_number', label: 'Sai số điện thoại', hint: 'Cần kiểm tra lại dữ liệu' },
  { value: 'not_interested', label: 'Không có nhu cầu', hint: 'Kết thúc tiếp cận' },
  { value: 'task_completed', label: 'Đã xử lý lịch gọi', hint: 'Xác nhận hoàn thành công việc đã hẹn' }
];

const CONTACT_OUTCOME_LABELS = Object.fromEntries(
  CONTACT_OUTCOMES.map(outcome => [outcome.value, outcome.label])
) as Record<LeadCandidateContactOutcome, string>;

const toDateTimeLocal = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const tomorrowAtNine = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
};

const formatDateTime = (value: string, fallback = 'Chưa đặt lịch') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('vi-VN');
};

const formatShortDateTime = (value: string, fallback = 'Chưa có') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const CALL_OUTCOMES = CONTACT_OUTCOMES.filter(outcome => outcome.value !== 'task_completed');

const isDueToday = (candidate: LeadCandidateRecord) => {
  if (!candidate.nextContactAt || candidate.taskStatus === 'dismissed' || candidate.status === 'converted') return false;
  const nextContact = new Date(candidate.nextContactAt);
  if (Number.isNaN(nextContact.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return nextContact.getTime() <= endOfToday.getTime();
};

const createEmptyCandidateForm = (
  currentUser: UserProfile,
  ownerUsers: UserProfile[]
): CandidateFormState => ({
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  taxCode: '',
  address: '',
  province: '',
  website: '',
  source: 'Google Maps',
  sourceUrl: '',
  assignedSaleId: currentUser.role === 'sale' ? currentUser.uid : (ownerUsers[0]?.uid || currentUser.uid),
  nextContactAt: '',
  note: ''
});

const matchesSearch = (candidate: LeadCandidateRecord, searchTerm: string) => {
  const terms = searchTerm
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = [
    candidate.companyName,
    candidate.contactPerson,
    candidate.phone,
    candidate.email,
    candidate.taxCode,
    candidate.address,
    candidate.province,
    candidate.website,
    candidate.source,
    candidate.note,
    candidate.assignedSaleName
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN');

  return terms.every(term => haystack.includes(term));
};

const describeDuplicate = (duplicate: CandidateDuplicate) => {
  const recordLabel = duplicate.recordType === 'candidate'
    ? 'Dữ liệu khách hàng'
    : duplicate.recordType === 'lead' ? 'Lead' : 'Khách hàng CRM';
  const reasonLabel = duplicate.reason === 'taxCode'
    ? 'mã số thuế'
    : duplicate.reason === 'phone' ? 'số điện thoại' : 'tên doanh nghiệp';
  return `${recordLabel} “${duplicate.companyName}” đã có cùng ${reasonLabel}.`;
};

export const LeadCandidateWorkspace: React.FC<LeadCandidateWorkspaceProps> = ({
  candidates,
  leads,
  customers,
  saleUsers,
  currentUser,
  onStartConversion
}) => {
  const candidateOwners = currentUser.role === 'admin'
    ? [currentUser, ...saleUsers.filter(user => user.uid !== currentUser.uid)]
    : saleUsers.some(user => user.uid === currentUser.uid) ? saleUsers : [currentUser, ...saleUsers];
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceView, setWorkspaceView] = useState<CandidateWorkspaceView>('tasks');
  const [saleFilter, setSaleFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<CandidateOutcomeFilter>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [candidateSort, setCandidateSort] = useState<CandidateSort>('priority');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState('');
  const [form, setForm] = useState<CandidateFormState>(() => createEmptyCandidateForm(currentUser, candidateOwners));
  const [saveError, setSaveError] = useState('');
  const [attemptCandidateId, setAttemptCandidateId] = useState('');
  const [attemptForm, setAttemptForm] = useState<ContactAttemptState>({ outcome: 'no_answer', nextContactAt: tomorrowAtNine(), note: '' });
  const [attemptError, setAttemptError] = useState('');
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [actionError, setActionError] = useState('');
  const [taskActionCandidateId, setTaskActionCandidateId] = useState('');
  const [referenceTime] = useState(() => Date.now());

  const accessibleCandidates = useMemo(() => candidates.filter(candidate => (
    currentUser.role === 'admin' || candidate.assignedSaleId === currentUser.uid
  )), [candidates, currentUser.role, currentUser.uid]);

  const workspaceCounts = useMemo(() => ({
    tasks: accessibleCandidates.filter(isDueToday).length,
    all: accessibleCandidates.length
  }), [accessibleCandidates]);

  const provinceOptions = useMemo(() => Array.from(new Set(
    accessibleCandidates.map(candidate => candidate.province.trim()).filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, 'vi-VN')), [accessibleCandidates]);

  const filteredCandidates = useMemo(() => accessibleCandidates.filter(candidate => {
    const matchesWorkspace = workspaceView === 'all' || isDueToday(candidate);
    if (workspaceView === 'tasks') return matchesWorkspace;
    const matchesSale = saleFilter === 'all' || candidate.assignedSaleId === saleFilter;
    const matchesSource = sourceFilter === 'all' || candidate.source === sourceFilter;
    const matchesProvince = provinceFilter === 'all' || candidate.province === provinceFilter;
    const matchesOutcome = outcomeFilter === 'all'
      || (outcomeFilter === 'not_contacted' ? !candidate.lastContactAt : candidate.lastContactOutcome === outcomeFilter);
    return matchesWorkspace && matchesSale && matchesSource && matchesProvince && matchesOutcome && (!pinnedOnly || candidate.pinned) && matchesSearch(candidate, searchTerm);
  }).sort((left, right) => {
    if (workspaceView === 'tasks') {
      if (left.taskStatus !== right.taskStatus) return left.taskStatus === 'pending' ? -1 : 1;
      return new Date(left.nextContactAt).getTime() - new Date(right.nextContactAt).getTime();
    }
    if (candidateSort === 'company_asc') return left.companyName.localeCompare(right.companyName, 'vi-VN');
    if (candidateSort === 'next_contact_asc') {
      const leftSchedule = left.nextContactAt ? new Date(left.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightSchedule = right.nextContactAt ? new Date(right.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftSchedule - rightSchedule;
    }
    if (candidateSort === 'updated_desc') {
      return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    }
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    const leftSchedule = left.nextContactAt ? new Date(left.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightSchedule = right.nextContactAt ? new Date(right.nextContactAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftSchedule !== rightSchedule) return leftSchedule - rightSchedule;
    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
  }), [accessibleCandidates, candidateSort, outcomeFilter, pinnedOnly, provinceFilter, saleFilter, searchTerm, sourceFilter, workspaceView]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const displayedCandidates = workspaceView === 'all'
    ? filteredCandidates.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
    : filteredCandidates;
  const activeFilterCount = [provinceFilter, sourceFilter, outcomeFilter, saleFilter]
    .filter(value => value !== 'all').length + (pinnedOnly ? 1 : 0);

  const editingCandidate = editingCandidateId
    ? accessibleCandidates.find(candidate => candidate.id === editingCandidateId) || null
    : null;
  const attemptCandidate = attemptCandidateId
    ? accessibleCandidates.find(candidate => candidate.id === attemptCandidateId) || null
    : null;
  const selectedCandidate = selectedCandidateId
    ? accessibleCandidates.find(candidate => candidate.id === selectedCandidateId) || null
    : null;
  const selectedContactLogs = selectedCandidate
    ? (selectedCandidate.contactLogs?.length > 0
      ? selectedCandidate.contactLogs
      : selectedCandidate.lastContactAt ? [{
        id: `legacy-${selectedCandidate.id}`,
        occurredAt: selectedCandidate.lastContactAt,
        outcome: (selectedCandidate.lastContactOutcome || 'connected') as LeadCandidateContactOutcome,
        note: selectedCandidate.lastContactNote,
        nextContactAt: selectedCandidate.nextContactAt,
        createdById: '',
        createdByName: selectedCandidate.updatedBy || selectedCandidate.assignedSaleName
      }] : [])
    : [];

  const duplicate = useMemo(() => findCandidateDuplicate(
    {
      companyName: form.companyName,
      phone: form.phone,
      taxCode: form.taxCode
    },
    candidates,
    leads,
    customers,
    editingCandidateId
  ), [candidates, customers, editingCandidateId, form.companyName, form.phone, form.taxCode, leads]);
  const hasBlockingDuplicate = duplicate?.reason === 'taxCode';

  const updateForm = <K extends keyof CandidateFormState>(field: K, value: CandidateFormState[K]) => {
    setSaveError('');
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const openCreateForm = () => {
    setEditingCandidateId('');
    setForm(createEmptyCandidateForm(currentUser, candidateOwners));
    setSaveError('');
    setShowForm(true);
  };

  const openEditForm = (candidate: LeadCandidateRecord) => {
    setEditingCandidateId(candidate.id);
    setForm({
      companyName: candidate.companyName,
      contactPerson: candidate.contactPerson,
      phone: candidate.phone,
      email: candidate.email,
      taxCode: candidate.taxCode,
      address: candidate.address,
      province: candidate.province,
      website: candidate.website,
      source: candidate.source || 'Google Maps',
      sourceUrl: candidate.sourceUrl,
      assignedSaleId: candidate.assignedSaleId,
      nextContactAt: toDateTimeLocal(candidate.nextContactAt),
      note: candidate.note
    });
    setSaveError('');
    setShowForm(true);
  };

  const handleSaveCandidate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.companyName.trim() || !form.assignedSaleId || hasBlockingDuplicate) return;

    try {
      const [latestLeads, latestCustomers, latestCandidates] = await Promise.all([
        dbService.getCollection('leads'),
        dbService.getCollection('customers'),
        currentUser.role === 'admin'
          ? dbService.getCollection('lead_candidates')
          : Promise.resolve(candidates)
      ]);
      const latestDuplicate = findCandidateDuplicate(
        {
          companyName: form.companyName,
          phone: form.phone,
          taxCode: form.taxCode
        },
        latestCandidates as LeadCandidateRecord[],
        latestLeads as LeadRecord[],
        latestCustomers as CustomerRecord[],
        editingCandidateId
      );
      if (latestDuplicate?.reason === 'taxCode') {
        setSaveError(describeDuplicate(latestDuplicate));
        return;
      }

      const assignedSale = candidateOwners.find(user => user.uid === form.assignedSaleId);
      const now = new Date().toISOString();
      const normalizedTaxCode = normalizeTaxCode(form.taxCode);
      const nextContactAt = form.nextContactAt ? new Date(form.nextContactAt).toISOString() : '';
      const scheduleChanged = !editingCandidate || editingCandidate.nextContactAt !== nextContactAt;
      const payload = {
        schemaVersion: LEAD_CANDIDATE_SCHEMA_VERSION,
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        taxCode: normalizedTaxCode,
        address: form.address.trim(),
        province: form.province.trim(),
        website: form.website.trim(),
        source: form.source,
        sourceUrl: form.sourceUrl.trim(),
        note: form.note.trim(),
        assignedSaleId: form.assignedSaleId,
        assignedSaleName: assignedSale?.displayName || '',
        discoveredById: editingCandidate?.discoveredById || currentUser.uid,
        discoveredByName: editingCandidate?.discoveredByName || currentUser.displayName,
        nextContactAt,
        ...(scheduleChanged ? {
          queuedNextContactAt: '',
          taskStatus: (nextContactAt ? 'pending' : 'dismissed') as LeadCandidateTaskStatus,
          taskCompletedAt: '',
          taskCompletedById: '',
          taskCompletedByName: '',
          taskDismissedAt: nextContactAt ? '' : now
        } : {}),
        updatedBy: currentUser.displayName
      };

      if (editingCandidateId) {
        await dbService.updateDocument('lead_candidates', editingCandidateId, payload);
        setShowForm(false);
        return;
      }

      const createPayload = {
        ...payload,
        status: 'new' as const,
        contactAttempts: 0,
        lastContactAt: '',
        lastContactOutcome: '',
        lastContactNote: '',
        contactLogs: [],
        pinned: false,
        convertedLeadId: '',
        convertedAt: '',
        createdAt: now,
        createdById: currentUser.uid,
        createdByName: currentUser.displayName
      };
      if (normalizedTaxCode) {
        await dbService.addDocumentIfAbsent(
          'lead_candidates',
          createCandidateDocumentIdFromTaxCode(normalizedTaxCode),
          createPayload
        );
      } else {
        await dbService.addDocument('lead_candidates', createPayload);
      }
      setShowForm(false);
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
      if (isDocumentAlreadyExistsError(error)) {
        setSaveError('Mã số thuế này vừa được một Sale khác lưu vào Dữ liệu khách hàng.');
      } else if (errorCode === 'permission-denied' || errorCode === 'firestore/permission-denied') {
        setSaveError('Firebase chưa cấp quyền lưu Dữ liệu khách hàng. Admin cần xuất bản Firestore Rules mới nhất.');
      } else if (errorCode === 'auth/session-expired' || errorCode === 'unauthenticated') {
        setSaveError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.');
      } else {
        setSaveError('Không thể lưu dữ liệu khách hàng. Vui lòng kiểm tra kết nối và thử lại.');
      }
    }
  };

  const openAttemptForm = (candidate: LeadCandidateRecord) => {
    setAttemptCandidateId(candidate.id);
    setAttemptForm({ outcome: 'no_answer', nextContactAt: tomorrowAtNine(), note: '' });
    setAttemptError('');
  };

  const handleSaveAttempt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attemptCandidate) return;
    const occurredAt = new Date().toISOString();
    const nextContactAt = attemptForm.nextContactAt
      ? new Date(attemptForm.nextContactAt).toISOString()
      : '';
    const closesCandidate = attemptForm.outcome === 'not_interested';
    const hasVisibleTask = isDueToday(attemptCandidate);
    const taskScheduleUpdate = hasVisibleTask
      ? {
        nextContactAt: attemptCandidate.nextContactAt,
        queuedNextContactAt: closesCandidate ? '' : nextContactAt
      }
      : {
        nextContactAt: closesCandidate ? '' : nextContactAt,
        queuedNextContactAt: '',
        taskStatus: (closesCandidate || !nextContactAt ? 'dismissed' : 'pending') as LeadCandidateTaskStatus,
        taskCompletedAt: '',
        taskCompletedById: '',
        taskCompletedByName: '',
        taskDismissedAt: closesCandidate || !nextContactAt ? occurredAt : ''
      };

    setSavingAttempt(true);
    setAttemptError('');
    try {
      await dbService.updateDocument('lead_candidates', attemptCandidate.id, {
        status: closesCandidate ? 'disqualified' : 'retry',
        contactAttempts: attemptCandidate.contactAttempts + 1,
        lastContactAt: occurredAt,
        lastContactOutcome: attemptForm.outcome,
        lastContactNote: attemptForm.note.trim(),
        contactLogs: [{
          id: `contact-${Date.now().toString(36)}`,
          occurredAt,
          outcome: attemptForm.outcome,
          note: attemptForm.note.trim(),
          nextContactAt: closesCandidate ? '' : nextContactAt,
          createdById: currentUser.uid,
          createdByName: currentUser.displayName
        }, ...(attemptCandidate.contactLogs || [])].slice(0, 50),
        ...taskScheduleUpdate,
        updatedBy: currentUser.displayName
      });
      setAttemptCandidateId('');
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
      setAttemptError(code.includes('permission-denied')
        ? 'Firebase chưa cấp quyền ghi nhận cuộc gọi. Admin cần xuất bản Firestore Rules mới nhất.'
        : 'Không thể lưu kết quả cuộc gọi. Vui lòng thử lại.');
    } finally {
      setSavingAttempt(false);
    }
  };

  const togglePinned = async (candidate: LeadCandidateRecord) => {
    setActionError('');
    try {
      await dbService.updateDocument('lead_candidates', candidate.id, {
        pinned: !candidate.pinned,
        updatedBy: currentUser.displayName
      });
    } catch {
      setActionError('Không thể cập nhật dữ liệu. Vui lòng kiểm tra quyền Firebase và thử lại.');
    }
  };

  const completeScheduledTask = async (candidate: LeadCandidateRecord) => {
    if (candidate.taskStatus === 'completed') return;
    const occurredAt = new Date().toISOString();
    setActionError('');
    setTaskActionCandidateId(candidate.id);
    try {
      await dbService.updateDocument('lead_candidates', candidate.id, {
        taskStatus: 'completed',
        taskCompletedAt: occurredAt,
        taskCompletedById: currentUser.uid,
        taskCompletedByName: currentUser.displayName,
        contactLogs: [{
          id: `task-${occurredAt.replace(/\D/g, '')}`,
          occurredAt,
          outcome: 'task_completed' as LeadCandidateContactOutcome,
          note: `Đã xử lý lịch gọi hẹn lúc ${formatDateTime(candidate.nextContactAt)}.`,
          nextContactAt: candidate.queuedNextContactAt,
          createdById: currentUser.uid,
          createdByName: currentUser.displayName
        }, ...(candidate.contactLogs || [])].slice(0, 50),
        updatedBy: currentUser.displayName
      });
    } catch {
      setActionError('Không thể xác nhận công việc đã xử lý. Vui lòng kiểm tra quyền Firebase và thử lại.');
    } finally {
      setTaskActionCandidateId('');
    }
  };

  const dismissScheduledTask = async (candidate: LeadCandidateRecord) => {
    if (candidate.taskStatus !== 'completed') return;
    const dismissedAt = new Date().toISOString();
    const nextContactAt = candidate.queuedNextContactAt;
    setActionError('');
    setTaskActionCandidateId(candidate.id);
    try {
      await dbService.updateDocument('lead_candidates', candidate.id, {
        nextContactAt,
        queuedNextContactAt: '',
        taskStatus: nextContactAt ? 'pending' : 'dismissed',
        taskCompletedAt: '',
        taskCompletedById: '',
        taskCompletedByName: '',
        taskDismissedAt: dismissedAt,
        updatedBy: currentUser.displayName
      });
    } catch {
      setActionError('Không thể tắt công việc. Vui lòng kiểm tra quyền Firebase và thử lại.');
    } finally {
      setTaskActionCandidateId('');
    }
  };

  const copyPhone = (phone: string) => {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone).catch(() => undefined);
  };

  const markDisqualified = async (candidate: LeadCandidateRecord) => {
    if (!window.confirm(`Ngừng sử dụng dữ liệu “${candidate.companyName}”? Lịch sử liên hệ vẫn được giữ nguyên.`)) return;
    const dismissedAt = new Date().toISOString();
    setActionError('');
    try {
      await dbService.updateDocument('lead_candidates', candidate.id, {
        status: 'disqualified',
        ...(!isDueToday(candidate) ? {
          nextContactAt: '',
          queuedNextContactAt: '',
          taskStatus: 'dismissed' as LeadCandidateTaskStatus,
          taskDismissedAt: dismissedAt
        } : {}),
        updatedBy: currentUser.displayName
      });
      setSelectedCandidateId('');
    } catch {
      setActionError('Không thể cập nhật trạng thái dữ liệu. Vui lòng kiểm tra quyền Firebase và thử lại.');
    }
  };

  const clearDataFilters = () => {
    setSearchTerm('');
    setProvinceFilter('all');
    setSourceFilter('all');
    setOutcomeFilter('all');
    setSaleFilter('all');
    setPinnedOnly(false);
    setCurrentPage(1);
  };

  if (showForm) {
    return (
      <div className="lead-form-page lead-candidate-form-page">
        <header className="lead-form-page__header">
          <PageBackButton onClick={() => setShowForm(false)} />
          <div>
            <span>{editingCandidateId ? 'CHỈNH SỬA DỮ LIỆU' : 'DỮ LIỆU MỚI'}</span>
            <h1>{editingCandidateId ? 'Chỉnh sửa dữ liệu khách hàng' : 'Thêm dữ liệu khách hàng'}</h1>
            <p>Ghi nhận doanh nghiệp tìm được, nguồn thông tin và người phụ trách trước lần tiếp cận đầu tiên.</p>
          </div>
        </header>

        <form className="lead-form-page__form" onSubmit={handleSaveCandidate}>
          <div className="lead-form-page__content lead-candidate-form-page__content">
            <section className="lead-form-card">
              <div className="lead-form-card__heading">
                <Building2 size={18} />
                <div><h2>Thông tin doanh nghiệp</h2><p>Thông tin nhận diện và đầu mối liên hệ ban đầu.</p></div>
              </div>
              <div className="lead-form-grid">
                <div className="form-group lead-form-grid__wide"><label>Tên doanh nghiệp *</label><input autoFocus required value={form.companyName} onChange={event => updateForm('companyName', event.target.value)} /></div>
                <div className="form-group"><label>Mã số thuế</label><input value={form.taxCode} readOnly={Boolean(editingCandidate?.taxCode)} onChange={event => updateForm('taxCode', event.target.value)} /></div>
                <div className="form-group"><label>Người liên hệ</label><input value={form.contactPerson} onChange={event => updateForm('contactPerson', event.target.value)} /></div>
                <div className="form-group"><label>Điện thoại</label><input type="tel" value={form.phone} onChange={event => updateForm('phone', event.target.value)} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} /></div>
                <div className="form-group"><label>Tỉnh / thành</label><input list="candidate-province-options" value={form.province} onChange={event => updateForm('province', event.target.value)} placeholder="Ví dụ: Hải Dương" /></div>
                <div className="form-group lead-form-grid__wide"><label>Địa chỉ</label><input value={form.address} onChange={event => updateForm('address', event.target.value)} /></div>
                <datalist id="candidate-province-options">{provinceOptions.map(province => <option key={province} value={province} />)}</datalist>
              </div>
            </section>

            <section className="lead-form-card">
              <div className="lead-form-card__heading">
                <ExternalLink size={18} />
                <div><h2>Nguồn dữ liệu</h2><p>Lưu lại nơi tìm thấy doanh nghiệp để thuận tiện kiểm tra.</p></div>
              </div>
              <div className="lead-form-grid">
                <div className="form-group lead-form-grid__wide"><label>Nguồn tìm kiếm</label><select value={form.source} onChange={event => updateForm('source', event.target.value)}>{CANDIDATE_SOURCES.map(source => <option key={source}>{source}</option>)}</select></div>
                <div className="form-group lead-form-grid__wide"><label>Website</label><input type="url" value={form.website} onChange={event => updateForm('website', event.target.value)} placeholder="https://..." /></div>
                <div className="form-group lead-form-grid__wide"><label>Đường dẫn nguồn</label><input type="url" value={form.sourceUrl} onChange={event => updateForm('sourceUrl', event.target.value)} placeholder="Link Google Maps, Facebook hoặc trang doanh nghiệp..." /></div>
              </div>
            </section>

            <section className="lead-form-card">
              <div className="lead-form-card__heading">
                <CalendarClock size={18} />
                <div><h2>Phụ trách và lịch tiếp cận</h2><p>Thông tin phục vụ phân công và theo dõi của Sale.</p></div>
              </div>
              <div className="lead-form-grid">
                <div className="form-group"><label>Người phụ trách *</label><select required value={form.assignedSaleId} disabled={currentUser.role === 'sale'} onChange={event => updateForm('assignedSaleId', event.target.value)}><option value="">Chưa phân công</option>{candidateOwners.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></div>
                <div className="form-group"><label>Lịch tiếp cận</label><input type="datetime-local" value={form.nextContactAt} onChange={event => updateForm('nextContactAt', event.target.value)} /></div>
                <div className="form-group lead-form-grid__wide"><label>Ghi chú</label><textarea rows={6} value={form.note} onChange={event => updateForm('note', event.target.value)} placeholder="Thông tin sơ bộ trước khi Sale liên hệ..." /></div>
              </div>
            </section>
          </div>

          {(duplicate || saveError) && (
            <div className={`lead-candidate-warning ${hasBlockingDuplicate || saveError ? 'is-error' : ''}`}>
              <AlertCircle size={15} />
              <span>{saveError || (duplicate && describeDuplicate(duplicate))}</span>
            </div>
          )}

          <footer className="lead-form-page__footer">
            <span>Dữ liệu chỉ được ghi nhận khi bấm Lưu dữ liệu.</span>
            <div>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={Boolean(hasBlockingDuplicate)}>Lưu dữ liệu</button>
            </div>
          </footer>
        </form>
      </div>
    );
  }

  return (
    <div className="lead-candidate-workspace">
      <div className="lead-candidate-heading">
        <div>
          <UserRoundSearch size={20} />
          <div>
            <strong>Bàn làm việc Sale</strong>
            <span>Danh sách doanh nghiệp cần gọi, lịch hẹn và kết quả tiếp cận trong ngày.</span>
          </div>
        </div>
        {workspaceView === 'all' && <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={15} /> Thêm dữ liệu khách hàng
        </button>}
      </div>

      <nav className="lead-candidate-queues" aria-label="Không gian làm việc Sale">
        {([
          ['tasks', 'Công việc cần xử lý'],
          ['all', 'Tất cả dữ liệu']
        ] as Array<[CandidateWorkspaceView, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={workspaceView === value ? 'is-active' : ''}
            onClick={() => {
              setWorkspaceView(value);
              setSelectedCandidateId('');
            }}
          >
            {value === 'tasks' && <CalendarClock size={15} />}
            {value === 'all' && <UserRoundSearch size={15} />}
            <span>{label}</span><strong>{workspaceCounts[value]}</strong>
          </button>
        ))}
      </nav>

      {workspaceView === 'all' && (
        <section className="lead-candidate-toolbar">
          <label className="lead-candidate-search">
            <Search size={15} />
            <input
              value={searchTerm}
              onChange={event => { setSearchTerm(event.target.value); setCurrentPage(1); }}
              placeholder="Tìm doanh nghiệp, MST, điện thoại, người liên hệ..."
            />
          </label>
          <select value={provinceFilter} onChange={event => { setProvinceFilter(event.target.value); setCurrentPage(1); }} aria-label="Lọc tỉnh thành">
            <option value="all">Tất cả tỉnh/thành</option>
            {provinceOptions.map(province => <option key={province} value={province}>{province}</option>)}
          </select>
          <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setCurrentPage(1); }} aria-label="Lọc nguồn dữ liệu">
            <option value="all">Tất cả nguồn</option>
            {CANDIDATE_SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
          </select>
          <select value={outcomeFilter} onChange={event => { setOutcomeFilter(event.target.value as CandidateOutcomeFilter); setCurrentPage(1); }} aria-label="Lọc kết quả liên hệ">
            <option value="all">Tất cả tình trạng gọi</option>
            <option value="not_contacted">Chưa liên hệ</option>
            {CALL_OUTCOMES.map(outcome => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}
          </select>
          {currentUser.role === 'admin' && (
            <select value={saleFilter} onChange={event => { setSaleFilter(event.target.value); setCurrentPage(1); }} aria-label="Lọc theo Sale">
              <option value="all">Tất cả phụ trách</option>
              {candidateOwners.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
            </select>
          )}
          <button type="button" className={`lead-candidate-pinned-filter ${pinnedOnly ? 'is-active' : ''}`} onClick={() => { setPinnedOnly(previous => !previous); setCurrentPage(1); }}>
            <Star size={14} fill={pinnedOnly ? 'currentColor' : 'none'} /> Đã ghim
          </button>
          <select value={candidateSort} onChange={event => { setCandidateSort(event.target.value as CandidateSort); setCurrentPage(1); }} aria-label="Sắp xếp dữ liệu">
            <option value="priority">Ưu tiên làm việc</option>
            <option value="updated_desc">Mới cập nhật</option>
            <option value="company_asc">Tên doanh nghiệp A–Z</option>
            <option value="next_contact_asc">Lịch gọi gần nhất</option>
          </select>
          {(activeFilterCount > 0 || searchTerm) && <button type="button" className="lead-candidate-clear-filter" onClick={clearDataFilters}><X size={13} /> Xóa lọc ({activeFilterCount})</button>}
        </section>
      )}

      {actionError && (
        <div className="lead-candidate-warning is-error">
          <AlertCircle size={14} />
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Đóng thông báo"><X size={13} /></button>
        </div>
      )}

      <section className="lead-table-card">
        <div className="lead-table-result">
          {workspaceView === 'tasks' ? <>
            <span><strong>{filteredCandidates.filter(candidate => candidate.taskStatus === 'pending').length}</strong> chưa xử lý · <strong>{filteredCandidates.filter(candidate => candidate.taskStatus === 'completed').length}</strong> đã xử lý, chờ tắt</span>
            <span>Nút đỏ chuyển sang xanh sau khi xử lý; công việc chỉ biến mất khi bấm Tắt.</span>
          </> : <>
            <span>Hiển thị <strong>{filteredCandidates.length}</strong> / {accessibleCandidates.length} dữ liệu</span>
            <span>{activeFilterCount > 0 ? `${activeFilterCount} bộ lọc đang áp dụng` : 'Bấm vào tên doanh nghiệp để mở hồ sơ và toàn bộ lịch sử.'}</span>
          </>}
        </div>
        <div className="table-container">
          {workspaceView === 'tasks' ? (
            <table className="lead-candidate-table lead-candidate-task-table">
              <thead><tr><th>Trạng thái</th><th>Doanh nghiệp</th><th>Liên hệ</th><th>Tỉnh/thành</th><th>Lịch sử liên hệ</th><th>Lịch hẹn</th><th>Thao tác</th></tr></thead>
              <tbody>
                {displayedCandidates.map(candidate => {
                  const isOverdue = new Date(candidate.nextContactAt).getTime() < referenceTime;
                  const isCompleted = candidate.taskStatus === 'completed';
                  const isBusy = taskActionCandidateId === candidate.id;
                  return (
                    <tr key={candidate.id} className={`${isOverdue && !isCompleted ? 'is-overdue' : ''} ${isCompleted ? 'is-task-completed' : ''}`}>
                      <td>
                        <button
                          type="button"
                          className={`lead-candidate-task-toggle ${isCompleted ? 'is-completed' : 'is-pending'}`}
                          onClick={() => completeScheduledTask(candidate)}
                          disabled={isBusy || isCompleted}
                        >
                          {isCompleted ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                          <span><strong>{isCompleted ? 'Đã xử lý' : 'Chưa xử lý'}</strong><small>{isCompleted ? 'Chờ bấm Tắt' : 'Bấm để hoàn thành'}</small></span>
                        </button>
                      </td>
                      <td><button type="button" className="lead-candidate-company-button" onClick={() => setSelectedCandidateId(candidate.id)}><strong>{candidate.companyName}</strong><span>{candidate.taxCode ? `MST ${candidate.taxCode}` : candidate.source || 'Chưa rõ nguồn'}</span></button></td>
                      <td><strong>{candidate.contactPerson || '—'}</strong>{candidate.phone ? <button type="button" className="lead-candidate-copy" onClick={() => copyPhone(candidate.phone)} title="Sao chép số điện thoại">{candidate.phone}<Copy size={11} /></button> : <span>{candidate.email || 'Chưa có liên hệ'}</span>}</td>
                      <td><strong>{candidate.province || 'Chưa cập nhật'}</strong><span>{candidate.address || candidate.source || '—'}</span></td>
                      <td><strong>{candidate.lastContactOutcome ? CONTACT_OUTCOME_LABELS[candidate.lastContactOutcome] : 'Chưa có cuộc gọi'}</strong><span>{candidate.lastContactNote || candidate.note || `${candidate.contactAttempts} lần liên hệ`}</span></td>
                      <td><strong className={isOverdue && !isCompleted ? 'lead-date-overdue' : ''}>{formatShortDateTime(candidate.nextContactAt)}</strong><span className={`lead-candidate-task-status ${isOverdue && !isCompleted ? 'is-overdue' : ''}`}>{isCompleted ? `Xử lý ${formatShortDateTime(candidate.taskCompletedAt)}` : isOverdue ? 'Quá hạn' : 'Hôm nay'}</span>{candidate.queuedNextContactAt && <small className="lead-candidate-next-queued">Hẹn tiếp: {formatShortDateTime(candidate.queuedNextContactAt)}</small>}</td>
                      <td>
                        <div className="lead-candidate-task-actions">
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => openAttemptForm(candidate)}><Phone size={13} /> Ghi nhận</button>
                          <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => setSelectedCandidateId(candidate.id)} title="Mở hồ sơ"><Eye size={13} /></button>
                          {isCompleted && <button type="button" className="btn btn-sm lead-candidate-task-dismiss" onClick={() => dismissScheduledTask(candidate)} disabled={isBusy}><Power size={13} /> Tắt</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCandidates.length === 0 && <tr><td colSpan={7} className="lead-empty">Chưa có công việc đến hạn. Lịch gọi sẽ tự xuất hiện ở đây khi đến ngày xử lý.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="lead-candidate-table">
              <thead>
                <tr>
                  <th>Doanh nghiệp</th>
                  <th>Liên hệ</th>
                  <th>Tỉnh/thành</th>
                  <th>Lịch sử liên hệ</th>
                  <th>Việc tiếp theo</th>
                  {currentUser.role === 'admin' && <th>Phụ trách</th>}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedCandidates.map(candidate => {
                  const isDue = candidate.nextContactAt
                    && candidate.taskStatus !== 'dismissed'
                    && new Date(candidate.nextContactAt).getTime() < referenceTime;
                  const isActive = candidate.status === 'new' || candidate.status === 'retry';
                  return (
                    <tr key={candidate.id} className={isDue ? 'is-overdue' : ''}>
                      <td>
                        <div className="lead-candidate-company-cell">
                          <button
                            type="button"
                            className={`lead-candidate-pin ${candidate.pinned ? 'is-active' : ''}`}
                            title={candidate.pinned ? 'Bỏ ghim' : 'Ghim ưu tiên'}
                            onClick={() => togglePinned(candidate)}
                          ><Star size={14} fill={candidate.pinned ? 'currentColor' : 'none'} /></button>
                          <button type="button" className="lead-candidate-company-button" onClick={() => setSelectedCandidateId(candidate.id)}>
                            <strong>{candidate.companyName}</strong>
                            <span>{candidate.source || 'Chưa rõ nguồn'}{candidate.taxCode ? ` · MST ${candidate.taxCode}` : ''}</span>
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>{candidate.contactPerson || '—'}</strong>
                        {candidate.phone ? (
                          <button type="button" className="lead-candidate-copy" onClick={() => copyPhone(candidate.phone)} title="Sao chép số điện thoại">
                            {candidate.phone}<Copy size={11} />
                          </button>
                        ) : <span>{candidate.email || 'Chưa có liên hệ'}</span>}
                      </td>
                      <td><strong>{candidate.province || 'Chưa cập nhật'}</strong><span>{candidate.address || '—'}</span></td>
                      <td>
                        {candidate.lastContactAt ? <><strong>{CONTACT_OUTCOME_LABELS[candidate.lastContactOutcome || 'connected']}</strong><span>{formatShortDateTime(candidate.lastContactAt)} · {candidate.contactAttempts} lần</span></> : <span className="lead-candidate-muted">Chưa có cuộc gọi</span>}
                      </td>
                      <td>
                        {candidate.nextContactAt && candidate.taskStatus !== 'dismissed' ? <><strong className={isDue ? 'lead-date-overdue' : ''}>{formatShortDateTime(candidate.nextContactAt)}</strong><span className={`lead-candidate-status ${candidate.taskStatus === 'completed' ? 'lead-candidate-status--converted' : `lead-candidate-status--${candidate.status}`}`}>{candidate.taskStatus === 'completed' ? 'Đã xử lý · chờ tắt' : CANDIDATE_STATUS_LABELS[candidate.status]}</span>{candidate.queuedNextContactAt && <small className="lead-candidate-next-queued">Hẹn tiếp: {formatShortDateTime(candidate.queuedNextContactAt)}</small>}</> : <span className={`lead-candidate-status lead-candidate-status--${candidate.status}`}>{CANDIDATE_STATUS_LABELS[candidate.status]}</span>}
                      </td>
                      {currentUser.role === 'admin' && <td><strong>{candidate.assignedSaleName || candidateOwners.find(user => user.uid === candidate.assignedSaleId)?.displayName || 'Chưa phân công'}</strong><span>{candidate.contactAttempts > 0 ? `${candidate.contactAttempts} lần tiếp cận` : 'Chưa gọi lần nào'}</span></td>}
                      <td>
                        <div className="lead-candidate-actions">
                          {isActive && <button type="button" className="btn btn-sm btn-primary" onClick={() => openAttemptForm(candidate)}><Phone size={13} /> Ghi nhận</button>}
                          <details className="lead-candidate-row-menu">
                            <summary title="Thao tác khác"><MoreHorizontal size={16} /></summary>
                            <div>
                              <button type="button" onClick={() => setSelectedCandidateId(candidate.id)}><Eye size={13} /> Xem hồ sơ</button>
                              <button type="button" onClick={() => openEditForm(candidate)}><Pencil size={13} /> Chỉnh sửa</button>
                              {isActive && <button type="button" onClick={() => onStartConversion(candidate)}><CheckCircle2 size={13} /> Chuyển thành Lead</button>}
                              {isActive && <button type="button" className="is-danger" onClick={() => markDisqualified(candidate)}><Power size={13} /> Ngừng sử dụng</button>}
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCandidates.length === 0 && <tr><td colSpan={currentUser.role === 'admin' ? 7 : 6} className="lead-empty">Không có dữ liệu phù hợp với điều kiện lọc.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {workspaceView === 'all' && filteredCandidates.length > 0 && (
          <footer className="lead-candidate-pagination">
            <label>Hiển thị <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}><option value={25}>25 dòng</option><option value={50}>50 dòng</option><option value={100}>100 dòng</option></select></label>
            <span>{(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filteredCandidates.length)} trong {filteredCandidates.length}</span>
            <div><button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safeCurrentPage === 1} aria-label="Trang trước"><ChevronLeft size={15} /></button><strong>{safeCurrentPage} / {totalPages}</strong><button type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages} aria-label="Trang sau"><ChevronRight size={15} /></button></div>
          </footer>
        )}
      </section>

      {selectedCandidate && (
        <>
          <button type="button" className="lead-candidate-drawer-backdrop" aria-label="Đóng hồ sơ" onClick={() => setSelectedCandidateId('')} />
          <aside className="lead-candidate-drawer" aria-label={`Hồ sơ ${selectedCandidate.companyName}`}>
            <div className="lead-candidate-drawer__header">
              <div><span>HỒ SƠ TIẾP CẬN</span><h2>{selectedCandidate.companyName}</h2><p>{selectedCandidate.source || 'Chưa rõ nguồn'} · {selectedCandidate.assignedSaleName || 'Chưa phân công'}</p></div>
              <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => setSelectedCandidateId('')} aria-label="Đóng"><X size={15} /></button>
            </div>

            <div className="lead-candidate-drawer__actions">
              {(selectedCandidate.status === 'new' || selectedCandidate.status === 'retry') && <button type="button" className="btn btn-primary" onClick={() => openAttemptForm(selectedCandidate)}><Check size={14} /> Ghi nhận đã gọi</button>}
              {(selectedCandidate.status === 'new' || selectedCandidate.status === 'retry') && <button type="button" className="btn btn-outline" onClick={() => onStartConversion(selectedCandidate)}><CheckCircle2 size={14} /> Chuyển Lead</button>}
              <button type="button" className="btn btn-outline btn-symbol-sm" onClick={() => openEditForm(selectedCandidate)} title="Chỉnh sửa"><Pencil size={14} /></button>
            </div>

            <div className="lead-candidate-drawer__body">
              <section>
                <h3>Thông tin liên hệ</h3>
                <div className="lead-candidate-drawer__info">
                  <span><Phone size={13} /> Điện thoại</span><strong>{selectedCandidate.phone || '—'}</strong>
                  <span><Mail size={13} /> Email</span><strong>{selectedCandidate.email || '—'}</strong>
                  <span><MapPin size={13} /> Địa chỉ</span><strong>{selectedCandidate.address || '—'}</strong>
                  <span><Building2 size={13} /> Mã số thuế</span><strong>{selectedCandidate.taxCode || '—'}</strong>
                </div>
                {(selectedCandidate.sourceUrl || selectedCandidate.website) && <a className="lead-candidate-source-link" href={selectedCandidate.sourceUrl || selectedCandidate.website} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Mở nguồn dữ liệu</a>}
              </section>

              <section>
                <h3>Ghi chú làm việc</h3>
                <p className="lead-candidate-drawer__note">{selectedCandidate.note || 'Chưa có ghi chú.'}</p>
              </section>

              <section>
                <div className="lead-candidate-drawer__timeline-title"><h3>Lịch sử tiếp cận</h3><span>{selectedCandidate.contactAttempts} lần</span></div>
                <div className="lead-candidate-timeline">
                  {selectedContactLogs.map(log => (
                    <article key={log.id}>
                      <span className="lead-candidate-timeline__dot" />
                      <div><strong>{CONTACT_OUTCOME_LABELS[log.outcome]}</strong><time>{formatDateTime(log.occurredAt)}</time><p>{log.note || 'Không có ghi chú.'}</p>{log.nextContactAt && <small>Hẹn tiếp: {formatDateTime(log.nextContactAt)}</small>}<small>{log.createdByName}</small></div>
                    </article>
                  ))}
                  {selectedContactLogs.length === 0 && <div className="lead-candidate-timeline__empty">Chưa phát sinh lần tiếp cận nào.</div>}
                </div>
              </section>

              {(selectedCandidate.status === 'new' || selectedCandidate.status === 'retry') && <button type="button" className="lead-candidate-disqualify" onClick={() => markDisqualified(selectedCandidate)}>Đánh dấu dữ liệu không phù hợp</button>}
            </div>
          </aside>
        </>
      )}

      {attemptCandidate && (
        <div className="modal-overlay">
          <form className="modal-content lead-candidate-attempt-modal" onSubmit={handleSaveAttempt}>
            <div className="modal-header">
              <div><strong>GHI NHẬN KẾT QUẢ CUỘC GỌI</strong><span>{attemptCandidate.companyName} · {formatDateTime(new Date().toISOString())}</span></div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setAttemptCandidateId('')}><X size={14} /> Đóng</button>
            </div>
            <div className="modal-body lead-candidate-attempt-form">
              <fieldset className="lead-candidate-outcomes"><legend>Kết quả cuộc gọi</legend>{CONTACT_OUTCOMES.filter(outcome => outcome.value !== 'task_completed').map(outcome => <label key={outcome.value} className={attemptForm.outcome === outcome.value ? 'is-selected' : ''}><input type="radio" name="contactOutcome" value={outcome.value} checked={attemptForm.outcome === outcome.value} onChange={() => setAttemptForm(previous => ({ ...previous, outcome: outcome.value }))} /><span><strong>{outcome.label}</strong><small>{outcome.hint}</small></span></label>)}</fieldset>
              {attemptForm.outcome !== 'not_interested' && <label><span>Lịch liên hệ tiếp theo</span><input type="datetime-local" value={attemptForm.nextContactAt} onChange={event => setAttemptForm(previous => ({ ...previous, nextContactAt: event.target.value }))} /></label>}
              <label><span>Ghi chú cuộc gọi</span><textarea rows={4} value={attemptForm.note} onChange={event => setAttemptForm(previous => ({ ...previous, note: event.target.value }))} placeholder="Nội dung trao đổi hoặc thông tin cần lưu ý..." /></label>
              {attemptError && <div className="lead-candidate-warning is-error"><AlertCircle size={14} /><span>{attemptError}</span></div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setAttemptCandidateId('')}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={savingAttempt}><Check size={14} /> {savingAttempt ? 'Đang lưu...' : 'Lưu kết quả cuộc gọi'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
