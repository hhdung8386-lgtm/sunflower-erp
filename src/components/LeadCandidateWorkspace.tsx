import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Pencil,
  PhoneCall,
  Plus,
  Search,
  UserRoundSearch,
  X
} from 'lucide-react';
import type { CustomerRecord, LeadRecord } from '../domain/crmModels';
import {
  createCandidateDocumentIdFromTaxCode,
  findCandidateDuplicate,
  LEAD_CANDIDATE_SCHEMA_VERSION,
  type CandidateDuplicate,
  type LeadCandidateRecord,
  type LeadCandidateStatus
} from '../domain/leadCandidateModels';
import { normalizeTaxCode } from '../domain/taxCodeUniqueness';
import {
  dbService,
  isDocumentAlreadyExistsError,
  type UserProfile
} from '../services/firebaseService';

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
  website: string;
  source: string;
  sourceUrl: string;
  assignedSaleId: string;
  nextContactAt: string;
  note: string;
}

interface ContactAttemptState {
  nextContactAt: string;
  note: string;
}

const CANDIDATE_SOURCES = ['Google Maps', 'Facebook', 'Website', 'Khách hàng giới thiệu', 'Khác'];
const CANDIDATE_WORKSPACE_REFERENCE_TIME = Date.now();

const CANDIDATE_STATUS_LABELS: Record<LeadCandidateStatus, string> = {
  new: 'Chưa tiếp cận',
  retry: 'Cần liên hệ lại',
  disqualified: 'Không phù hợp',
  converted: 'Đã thành Lead'
};

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
  const [statusFilter, setStatusFilter] = useState<'active' | LeadCandidateStatus | 'all'>('active');
  const [saleFilter, setSaleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState('');
  const [form, setForm] = useState<CandidateFormState>(() => createEmptyCandidateForm(currentUser, candidateOwners));
  const [saveError, setSaveError] = useState('');
  const [attemptCandidateId, setAttemptCandidateId] = useState('');
  const [attemptForm, setAttemptForm] = useState<ContactAttemptState>({ nextContactAt: tomorrowAtNine(), note: '' });

  const accessibleCandidates = useMemo(() => candidates.filter(candidate => (
    currentUser.role === 'admin' || candidate.assignedSaleId === currentUser.uid
  )), [candidates, currentUser.role, currentUser.uid]);

  const filteredCandidates = useMemo(() => accessibleCandidates.filter(candidate => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active'
        ? candidate.status === 'new' || candidate.status === 'retry'
        : candidate.status === statusFilter);
    const matchesSale = saleFilter === 'all' || candidate.assignedSaleId === saleFilter;
    return matchesStatus && matchesSale && matchesSearch(candidate, searchTerm);
  }), [accessibleCandidates, saleFilter, searchTerm, statusFilter]);

  const editingCandidate = editingCandidateId
    ? accessibleCandidates.find(candidate => candidate.id === editingCandidateId) || null
    : null;
  const attemptCandidate = attemptCandidateId
    ? accessibleCandidates.find(candidate => candidate.id === attemptCandidateId) || null
    : null;

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
      const payload = {
        schemaVersion: LEAD_CANDIDATE_SCHEMA_VERSION,
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        taxCode: normalizedTaxCode,
        address: form.address.trim(),
        website: form.website.trim(),
        source: form.source,
        sourceUrl: form.sourceUrl.trim(),
        note: form.note.trim(),
        assignedSaleId: form.assignedSaleId,
        assignedSaleName: assignedSale?.displayName || '',
        discoveredById: editingCandidate?.discoveredById || currentUser.uid,
        discoveredByName: editingCandidate?.discoveredByName || currentUser.displayName,
        nextContactAt: form.nextContactAt ? new Date(form.nextContactAt).toISOString() : '',
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
        lastContactNote: '',
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
      setSaveError(isDocumentAlreadyExistsError(error)
        ? 'Mã số thuế này vừa được một Sale khác lưu vào Dữ liệu khách hàng.'
        : 'Không thể lưu dữ liệu khách hàng. Vui lòng kiểm tra kết nối và thử lại.');
    }
  };

  const openAttemptForm = (candidate: LeadCandidateRecord) => {
    setAttemptCandidateId(candidate.id);
    setAttemptForm({ nextContactAt: tomorrowAtNine(), note: '' });
  };

  const handleSaveAttempt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attemptCandidate) return;
    await dbService.updateDocument('lead_candidates', attemptCandidate.id, {
      status: 'retry',
      contactAttempts: attemptCandidate.contactAttempts + 1,
      lastContactAt: new Date().toISOString(),
      lastContactNote: attemptForm.note.trim(),
      nextContactAt: attemptForm.nextContactAt ? new Date(attemptForm.nextContactAt).toISOString() : '',
      updatedBy: currentUser.displayName
    });
    setAttemptCandidateId('');
  };

  const markDisqualified = async (candidate: LeadCandidateRecord) => {
    if (!window.confirm(`Đánh dấu “${candidate.companyName}” là dữ liệu không phù hợp?`)) return;
    await dbService.updateDocument('lead_candidates', candidate.id, {
      status: 'disqualified',
      updatedBy: currentUser.displayName
    });
  };

  return (
    <div className="lead-candidate-workspace">
      <div className="lead-candidate-heading">
        <div>
          <UserRoundSearch size={20} />
          <div>
            <strong>Danh sách khách hàng cần tiếp cận</strong>
            <span>Dữ liệu doanh nghiệp Sale tìm được nhưng chưa phát sinh lần liên hệ đầu tiên.</span>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={15} /> Thêm dữ liệu khách hàng
        </button>
      </div>

      <section className="lead-candidate-toolbar">
        <label className="lead-candidate-search">
          <Search size={15} />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Tìm công ty, MST, điện thoại, nguồn..."
          />
        </label>
        {currentUser.role === 'admin' && (
          <select value={saleFilter} onChange={event => setSaleFilter(event.target.value)} aria-label="Lọc theo Sale">
            <option value="all">Tất cả phụ trách</option>
            {candidateOwners.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Lọc trạng thái dữ liệu">
          <option value="active">Đang cần xử lý</option>
          <option value="new">Chưa tiếp cận</option>
          <option value="retry">Cần liên hệ lại</option>
          <option value="converted">Đã thành Lead</option>
          <option value="disqualified">Không phù hợp</option>
          <option value="all">Tất cả dữ liệu</option>
        </select>
      </section>

      <section className="lead-table-card">
        <div className="lead-table-result">Hiển thị <strong>{filteredCandidates.length}</strong> / {accessibleCandidates.length} dữ liệu</div>
        <div className="table-container">
          <table className="lead-candidate-table">
            <thead>
              <tr>
                <th>Doanh nghiệp</th>
                <th>Thông tin liên hệ</th>
                <th>Nguồn tìm kiếm</th>
                <th>Sale phụ trách</th>
                <th>Lịch tiếp cận</th>
                <th>Tình trạng</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map(candidate => {
                const isDue = candidate.nextContactAt
                  && ['new', 'retry'].includes(candidate.status)
                  && new Date(candidate.nextContactAt).getTime() < CANDIDATE_WORKSPACE_REFERENCE_TIME;
                return (
                  <tr key={candidate.id}>
                    <td>
                      <strong>{candidate.companyName}</strong>
                      <span>{candidate.taxCode ? `MST: ${candidate.taxCode}` : 'Chưa có mã số thuế'}</span>
                    </td>
                    <td>
                      <strong>{candidate.contactPerson || '—'}</strong>
                      <span>{candidate.phone || candidate.email || 'Chưa có thông tin liên hệ'}</span>
                    </td>
                    <td>
                      <strong>{candidate.source || '—'}</strong>
                      {(candidate.sourceUrl || candidate.website) && (
                        <a href={candidate.sourceUrl || candidate.website} target="_blank" rel="noreferrer">
                          <ExternalLink size={11} /> Mở nguồn
                        </a>
                      )}
                    </td>
                    <td>{candidate.assignedSaleName || candidateOwners.find(user => user.uid === candidate.assignedSaleId)?.displayName || 'Chưa phân công'}</td>
                    <td>
                      <strong className={isDue ? 'lead-date-overdue' : ''}>{formatDateTime(candidate.nextContactAt)}</strong>
                      <span>{candidate.contactAttempts > 0 ? `${candidate.contactAttempts} lần tiếp cận` : 'Chưa gọi'}</span>
                    </td>
                    <td><span className={`lead-candidate-status lead-candidate-status--${candidate.status}`}>{CANDIDATE_STATUS_LABELS[candidate.status]}</span></td>
                    <td>
                      <div className="lead-candidate-actions">
                        {(candidate.status === 'new' || candidate.status === 'retry') && (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => onStartConversion(candidate)}>
                              <CheckCircle2 size={13} /> Chuyển Lead
                            </button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => openAttemptForm(candidate)} title="Chưa kết nối được">
                              <PhoneCall size={13} /> Hẹn lại
                            </button>
                          </>
                        )}
                        <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditForm(candidate)} title="Chỉnh sửa">
                          <Pencil size={13} />
                        </button>
                        {(candidate.status === 'new' || candidate.status === 'retry') && (
                          <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => markDisqualified(candidate)} title="Không phù hợp">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCandidates.length === 0 && (
                <tr><td colSpan={7} className="lead-empty">Chưa có dữ liệu khách hàng phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="modal-overlay">
          <form className="modal-content lead-candidate-modal" onSubmit={handleSaveCandidate}>
            <div className="modal-header">
              <div>
                <strong>{editingCandidateId ? 'CHỈNH SỬA DỮ LIỆU KHÁCH HÀNG' : 'THÊM DỮ LIỆU KHÁCH HÀNG'}</strong>
                <span>Doanh nghiệp ở đây chưa được tính là Lead cho đến khi Sale thực hiện lần tiếp cận đầu tiên.</span>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowForm(false)}><X size={14} /> Đóng</button>
            </div>
            <div className="modal-body lead-candidate-form">
              <section>
                <div className="lead-candidate-section-title"><Building2 size={16} /><strong>Thông tin doanh nghiệp</strong></div>
                <div className="lead-form-grid">
                  <div className="form-group lead-form-grid__wide"><label>Tên doanh nghiệp *</label><input autoFocus required value={form.companyName} onChange={event => updateForm('companyName', event.target.value)} /></div>
                  <div className="form-group"><label>Mã số thuế</label><input value={form.taxCode} readOnly={Boolean(editingCandidate?.taxCode)} onChange={event => updateForm('taxCode', event.target.value)} /></div>
                  <div className="form-group"><label>Người liên hệ</label><input value={form.contactPerson} onChange={event => updateForm('contactPerson', event.target.value)} /></div>
                  <div className="form-group"><label>Điện thoại</label><input type="tel" value={form.phone} onChange={event => updateForm('phone', event.target.value)} /></div>
                  <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} /></div>
                  <div className="form-group lead-form-grid__wide"><label>Địa chỉ</label><input value={form.address} onChange={event => updateForm('address', event.target.value)} /></div>
                  <div className="form-group"><label>Website</label><input type="url" value={form.website} onChange={event => updateForm('website', event.target.value)} placeholder="https://..." /></div>
                  <div className="form-group"><label>Nguồn tìm kiếm</label><select value={form.source} onChange={event => updateForm('source', event.target.value)}>{CANDIDATE_SOURCES.map(source => <option key={source}>{source}</option>)}</select></div>
                  <div className="form-group lead-form-grid__wide"><label>Đường dẫn nguồn</label><input type="url" value={form.sourceUrl} onChange={event => updateForm('sourceUrl', event.target.value)} placeholder="Link Google Maps, Facebook hoặc trang doanh nghiệp..." /></div>
                </div>
              </section>
              <section>
                <div className="lead-candidate-section-title"><CalendarClock size={16} /><strong>Phân công tiếp cận</strong></div>
                <div className="lead-form-grid">
                  <div className="form-group"><label>Người phụ trách *</label><select required value={form.assignedSaleId} disabled={currentUser.role === 'sale'} onChange={event => updateForm('assignedSaleId', event.target.value)}><option value="">Chưa phân công</option>{candidateOwners.map(user => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></div>
                  <div className="form-group"><label>Lịch tiếp cận</label><input type="datetime-local" value={form.nextContactAt} onChange={event => updateForm('nextContactAt', event.target.value)} /></div>
                  <div className="form-group lead-form-grid__wide"><label>Ghi chú</label><textarea rows={4} value={form.note} onChange={event => updateForm('note', event.target.value)} placeholder="Thông tin sơ bộ trước khi Sale liên hệ..." /></div>
                </div>
              </section>
              {(duplicate || saveError) && (
                <div className={`lead-candidate-warning ${hasBlockingDuplicate || saveError ? 'is-error' : ''}`}>
                  <AlertCircle size={15} />
                  <span>{saveError || (duplicate && describeDuplicate(duplicate))}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={Boolean(hasBlockingDuplicate)}>Lưu dữ liệu</button>
            </div>
          </form>
        </div>
      )}

      {attemptCandidate && (
        <div className="modal-overlay">
          <form className="modal-content lead-candidate-attempt-modal" onSubmit={handleSaveAttempt}>
            <div className="modal-header">
              <div><strong>GHI NHẬN CHƯA KẾT NỐI ĐƯỢC</strong><span>{attemptCandidate.companyName}</span></div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setAttemptCandidateId('')}><X size={14} /> Đóng</button>
            </div>
            <div className="modal-body lead-candidate-attempt-form">
              <label><span>Lịch liên hệ lại</span><input type="datetime-local" value={attemptForm.nextContactAt} onChange={event => setAttemptForm(previous => ({ ...previous, nextContactAt: event.target.value }))} /></label>
              <label><span>Ghi chú lần gọi</span><textarea rows={4} value={attemptForm.note} onChange={event => setAttemptForm(previous => ({ ...previous, note: event.target.value }))} placeholder="Ví dụ: chưa bắt máy, hẹn gọi lại vào buổi sáng..." /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setAttemptCandidateId('')}>Hủy</button>
              <button type="submit" className="btn btn-primary"><PhoneCall size={14} /> Lưu lần tiếp cận</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
