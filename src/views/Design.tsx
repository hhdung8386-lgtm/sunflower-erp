import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileArchive,
  Image as ImageIcon,
  ListChecks,
  Plus,
  Search,
  UserRound,
  XCircle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PageBackButton } from '../components/PageBackButton';
import { formatDateTime } from '../domain/dateFormatting';
import {
  DESIGN_WORK_STATUSES,
  DesignPOItem,
  DesignPOLike,
  DesignRecord,
  DesignRequest,
  DesignRequestHistory,
  DesignVersion,
  DesignWorkStatus,
  getDesignRequestAgeDays,
  getDesignWorkStatus,
  getDesignWorkStatusDefinition,
  isDesignRequestOverdue,
  resolveDesignForRequest
} from '../domain/designWorkflow';
import { getPOQueueUpdate } from '../domain/poWorkflow';
import { sortNewestFirst } from '../domain/recordOrdering';
import { syncDesignRequestsForPOs } from '../services/designRequestService';
import { dbService, UserProfile } from '../services/firebaseService';
import './Design.css';

interface DesignProps {
  pos: DesignPOLike[];
  designRequests: DesignRequest[];
  users: UserProfile[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Cực gấp',
  high: 'Gấp',
  normal: 'Bình thường',
  low: 'Thong thả'
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};

const compressPreviewImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Không thể đọc ảnh thiết kế.'));
  reader.onload = event => {
    const image = new Image();
    image.onerror = () => reject(new Error('Tệp được chọn không phải ảnh hợp lệ.'));
    image.onload = () => {
      const maxSize = 1200;
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.src = String(event.target?.result || '');
  };
  reader.readAsDataURL(file);
});

export const Design: React.FC<DesignProps> = ({
  pos,
  designRequests,
  users,
  currentUser,
  onRefresh
}) => {
  const { t } = useLanguage();
  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DesignWorkStatus>('all');
  const [statusNote, setStatusNote] = useState('');
  const [nextWorkStatus, setNextWorkStatus] = useState<DesignWorkStatus>('unreviewed');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [aiLink, setAiLink] = useState('');
  const [corelLink, setCorelLink] = useState('');
  const [versionComment, setVersionComment] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const migrationKeyRef = useRef('');

  useEffect(() => dbService.subscribeCollection('designs', data => setDesigns(data as DesignRecord[])), []);

  useEffect(() => {
    if (pos.length === 0) return;
    const migrationKey = pos.map(po => `${po.id}:${po.updatedAt || po.createdAt || ''}`).join('|');
    if (migrationKeyRef.current === migrationKey) return;
    migrationKeyRef.current = migrationKey;
    void syncDesignRequestsForPOs(pos, currentUser).catch(error => {
      console.error('Unable to synchronize design requests:', error);
      migrationKeyRef.current = '';
    });
  }, [currentUser, pos]);

  const visibleRequests = useMemo(() => designRequests.filter(request => {
    if (request.archived === true) return false;
    if (currentUser.role !== 'designer') return true;
    return !request.assignedDesignerId || request.assignedDesignerId === currentUser.uid;
  }), [currentUser.role, currentUser.uid, designRequests]);

  const filteredRequests = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('vi-VN');
    return sortNewestFirst(visibleRequests
      .filter(request => statusFilter === 'all' || getDesignWorkStatus(request.workStatus) === statusFilter)
      .filter(request => !search || [
        request.requestCode,
        request.poCode,
        request.customerReferenceCode,
        request.productCode,
        request.productName,
        request.size,
        request.material
      ].some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(search))),
      request => [request.createdAt]
    );
  }, [searchTerm, statusFilter, visibleRequests]);

  const selectedRequest = designRequests.find(request => request.id === selectedRequestId) || null;
  const selectedDesign = selectedRequest ? resolveDesignForRequest(designs, selectedRequest) : null;
  const selectedDesignVersions = selectedDesign?.versions?.length
    ? selectedDesign.versions
    : selectedDesign?.fileUrl
      ? [{
          versionNumber: selectedDesign.currentVersion || 1,
          previewImage: selectedDesign.fileUrl,
          aiLink: selectedDesign.aiLink || '',
          corelLink: selectedDesign.corelLink || '',
          comment: selectedDesign.notes || 'Phiên bản được chuyển đổi từ dữ liệu thiết kế cũ.',
          createdAt: selectedDesign.updatedAt || selectedDesign.createdAt || '',
          createdBy: selectedDesign.designerName || 'Hệ thống',
          feedbackFromClient: selectedDesign.status === 'approved' ? 'KHÁCH HÀNG ĐÃ DUYỆT MẪU' : '',
          feedbackAt: selectedDesign.updatedAt || ''
        }]
      : [];
  const selectedVersion = selectedDesignVersions.find((version: DesignVersion) => (
    version.versionNumber === selectedVersionNumber
  )) || selectedDesignVersions[selectedDesignVersions.length - 1] || null;

  const openRequest = (request: DesignRequest) => {
    setSelectedRequestId(request.id);
    setNextWorkStatus(getDesignWorkStatus(request.workStatus));
    setStatusNote('');
    setActionError('');
  };

  const closeRequest = () => {
    setSelectedRequestId('');
    setSelectedVersionNumber(null);
    setStatusNote('');
    setFeedbackText('');
    setActionError('');
  };

  const updatePODesignProgress = async (
    request: DesignRequest,
    updatedWorkStatus: DesignWorkStatus,
    note: string
  ) => {
    const po = pos.find(candidate => candidate.id === request.poId);
    if (!po) return;
    const requestsForPO = designRequests
      .filter(candidate => candidate.poId === request.poId && candidate.archived !== true)
      .map(candidate => candidate.id === request.id ? { ...candidate, workStatus: updatedWorkStatus } : candidate);
    const allCompleted = requestsForPO.length > 0 && requestsForPO.every(candidate => candidate.workStatus === 'completed');
    const hasWaitingInfo = requestsForPO.some(candidate => candidate.workStatus === 'waiting_info');
    const updatedLogs = [
      ...(po.historyLogs || []),
      {
        status: 'waiting_design',
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `${request.requestCode}: ${getDesignWorkStatusDefinition(updatedWorkStatus).label}${note ? ` – ${note}` : ''}`
      }
    ];
    await dbService.updateDocument('pos', po.id, {
      ...getPOQueueUpdate('waiting_design', {
        designProgress: allCompleted ? 'designer_completed' : hasWaitingInfo ? 'waiting_info' : 'in_progress'
      }),
      historyLogs: updatedLogs
    });
  };

  const handleUpdateWorkStatus = async () => {
    if (!selectedRequest || isSaving) return;
    if (nextWorkStatus === 'waiting_info' && !statusNote.trim()) {
      setActionError('Vui lòng ghi rõ thông tin còn thiếu để Sale có thể bổ sung.');
      return;
    }
    if (nextWorkStatus === 'completed' && !selectedVersion) {
      setActionError('Vui lòng tải lên ít nhất một phiên bản thiết kế trước khi đánh dấu đã hoàn thành.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const now = new Date().toISOString();
    const nextHistory = [
      ...(selectedRequest.history || []),
      {
        type: 'work_status',
        workStatus: nextWorkStatus,
        approvalStatus: selectedRequest.approvalStatus || 'not_sent',
        note: statusNote.trim(),
        updatedBy: currentUser.displayName,
        updatedAt: now
      }
    ];
    try {
      await dbService.updateDocument('design_requests', selectedRequest.id, {
        workStatus: nextWorkStatus,
        statusNote: statusNote.trim(),
        startedAt: nextWorkStatus === 'in_progress' && !selectedRequest.startedAt ? now : selectedRequest.startedAt || '',
        completedAt: nextWorkStatus === 'completed' ? now : '',
        updatedBy: currentUser.displayName,
        history: nextHistory
      });
      await updatePODesignProgress(selectedRequest, nextWorkStatus, statusNote.trim());
      setStatusNote('');
      onRefresh();
    } catch (error) {
      console.error('Unable to update design work status:', error);
      setActionError('Không thể cập nhật tiến độ thiết kế. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setActionError('');
    try {
      setPreviewImage(await compressPreviewImage(file));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể xử lý ảnh thiết kế.');
    }
  };

  const resetVersionForm = () => {
    setShowVersionModal(false);
    setPreviewImage('');
    setAiLink('');
    setCorelLink('');
    setVersionComment('');
  };

  const handleAddVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRequest || isSaving) return;
    if (!previewImage) {
      setActionError('Vui lòng chọn ảnh xem trước của bản thiết kế.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const now = new Date().toISOString();
    const existingVersions = selectedDesignVersions;
    const nextVersionNumber = Math.max(0, ...existingVersions.map(version => Number(version.versionNumber) || 0)) + 1;
    const newVersion = {
      versionNumber: nextVersionNumber,
      previewImage,
      aiLink: aiLink.trim(),
      corelLink: corelLink.trim(),
      comment: versionComment.trim(),
      createdAt: now,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      feedbackFromClient: '',
      feedbackAt: ''
    };
    try {
      if (selectedDesign) {
        await dbService.updateDocument('designs', selectedDesign.id, {
          designRequestId: selectedRequest.id,
          itemId: selectedRequest.itemId,
          itemIndex: selectedRequest.itemIndex,
          customerReferenceCode: selectedRequest.customerReferenceCode,
          versions: [...existingVersions, newVersion],
          currentVersion: nextVersionNumber,
          status: 'client_pending',
          designerId: currentUser.uid,
          designerName: currentUser.displayName
        });
      } else {
        await dbService.addDocument('designs', {
          id: `design-${selectedRequest.id}`,
          designRequestId: selectedRequest.id,
          poId: selectedRequest.poId,
          poCode: selectedRequest.poCode,
          itemId: selectedRequest.itemId,
          itemIndex: selectedRequest.itemIndex,
          customerReferenceCode: selectedRequest.customerReferenceCode,
          designerId: currentUser.uid,
          designerName: currentUser.displayName,
          versions: [newVersion],
          currentVersion: 1,
          status: 'client_pending',
          createdAt: now
        });
      }

      const requestHistory = [
        ...(selectedRequest.history || []),
        {
          type: 'version_uploaded',
          workStatus: 'completed',
          approvalStatus: 'waiting_client',
          note: `Hoàn thành và tải lên phiên bản thiết kế v${nextVersionNumber}. ${versionComment.trim()}`.trim(),
          updatedBy: currentUser.displayName,
          updatedAt: now
        }
      ];
      await dbService.updateDocument('design_requests', selectedRequest.id, {
        workStatus: 'completed',
        approvalStatus: 'waiting_client',
        completedAt: now,
        statusNote: versionComment.trim(),
        latestVersion: nextVersionNumber,
        updatedBy: currentUser.displayName,
        history: requestHistory
      });

      const po = pos.find(candidate => candidate.id === selectedRequest.poId);
      if (po) {
        const requestsForPO = designRequests
          .filter(candidate => candidate.poId === selectedRequest.poId && candidate.archived !== true)
          .map(candidate => candidate.id === selectedRequest.id
            ? { ...candidate, workStatus: 'completed' as DesignWorkStatus, approvalStatus: 'waiting_client' as const }
            : candidate);
        const allDesignerWorkCompleted = requestsForPO.length > 0
          && requestsForPO.every(candidate => candidate.workStatus === 'completed');
        const updatedItems = (po.items || []).map((item: DesignPOItem, index: number) => (
          (item.itemId || item.productCode || `item-${index + 1}`) === selectedRequest.itemId
            ? {
                ...item,
                designNotes: versionComment.trim(),
                designLayouts: Array.from(new Set([...(item.designLayouts || []), previewImage]))
              }
            : item
        ));
        await dbService.updateDocument('pos', po.id, {
          ...getPOQueueUpdate('waiting_design', {
            designProgress: allDesignerWorkCompleted ? 'customer_approval_pending' : 'in_progress'
          }),
          items: updatedItems,
          historyLogs: [
            ...(po.historyLogs || []),
            {
              status: 'waiting_design',
              updatedBy: currentUser.displayName,
              updatedAt: now,
              note: `${selectedRequest.requestCode}: Designer đã hoàn thành v${nextVersionNumber}, chờ Sale gửi khách hàng duyệt.`
            }
          ]
        });
      }
      setSelectedVersionNumber(nextVersionNumber);
      resetVersionForm();
      onRefresh();
    } catch (error) {
      console.error('Unable to add design version:', error);
      setActionError('Không thể lưu phiên bản thiết kế. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClientFeedback = async (approved: boolean) => {
    if (!selectedRequest || !selectedDesign || !selectedVersion || isSaving) return;
    if (!approved && !feedbackText.trim()) {
      setActionError('Vui lòng nhập nội dung khách hàng yêu cầu sửa.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    const now = new Date().toISOString();
    const updatedVersions = selectedDesignVersions.map((version: DesignVersion) => (
      version.versionNumber === selectedVersion.versionNumber
        ? {
            ...version,
            feedbackFromClient: approved ? 'KHÁCH HÀNG ĐÃ DUYỆT MẪU' : `KHÁCH YÊU CẦU SỬA: ${feedbackText.trim()}`,
            feedbackAt: now
          }
        : version
    ));
    const nextWorkStatus: DesignWorkStatus = approved ? 'completed' : 'queued';
    const nextApprovalStatus = approved ? 'approved' : 'revision_requested';
    try {
      await dbService.updateDocument('designs', selectedDesign.id, {
        status: approved ? 'approved' : 'rejected',
        versions: updatedVersions
      });
      await dbService.updateDocument('design_requests', selectedRequest.id, {
        workStatus: nextWorkStatus,
        approvalStatus: nextApprovalStatus,
        approvalNote: feedbackText.trim(),
        completedAt: approved ? selectedRequest.completedAt || now : '',
        updatedBy: currentUser.displayName,
        history: [
          ...(selectedRequest.history || []),
          {
            type: 'client_feedback',
            workStatus: nextWorkStatus,
            approvalStatus: nextApprovalStatus,
            note: approved ? 'Khách hàng đã duyệt mẫu.' : feedbackText.trim(),
            updatedBy: currentUser.displayName,
            updatedAt: now
          }
        ]
      });

      const po = pos.find(candidate => candidate.id === selectedRequest.poId);
      if (po) {
        const requestsForPO = designRequests
          .filter(candidate => candidate.poId === selectedRequest.poId && candidate.archived !== true)
          .map(candidate => candidate.id === selectedRequest.id
            ? { ...candidate, approvalStatus: nextApprovalStatus, workStatus: nextWorkStatus }
            : candidate);
        const allApproved = requestsForPO.length > 0 && requestsForPO.every(candidate => candidate.approvalStatus === 'approved');
        const updatedItems = (po.items || []).map((item: DesignPOItem, index: number) => (
          approved && (item.itemId || item.productCode || `item-${index + 1}`) === selectedRequest.itemId
            ? { ...item, previewImage: selectedVersion.previewImage }
            : item
        ));
        await dbService.updateDocument('pos', po.id, {
          ...getPOQueueUpdate(allApproved ? 'waiting_production' : 'waiting_design', {
            designProgress: allApproved ? 'approved' : approved ? 'partially_approved' : 'revision_requested',
            productionProgress: allApproved ? 'pending' : po.productionProgress || ''
          }),
          items: updatedItems,
          historyLogs: [
            ...(po.historyLogs || []),
            {
              status: allApproved ? 'waiting_production' : 'waiting_design',
              updatedBy: currentUser.displayName,
              updatedAt: now,
              note: approved
                ? `${selectedRequest.requestCode}: khách hàng đã duyệt mẫu${allApproved ? '; toàn bộ mặt hàng đã sẵn sàng chuyển sản xuất.' : '.'}`
                : `${selectedRequest.requestCode}: khách hàng yêu cầu Designer sửa – ${feedbackText.trim()}`
            }
          ]
        });
      }
      setFeedbackText('');
      onRefresh();
    } catch (error) {
      console.error('Unable to save client feedback:', error);
      setActionError('Không thể cập nhật phản hồi khách hàng. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const metrics = DESIGN_WORK_STATUSES.map(status => ({
    ...status,
    count: visibleRequests.filter(request => getDesignWorkStatus(request.workStatus) === status.value).length
  }));

  return (
    <div className="design-request-view">
      {!selectedRequest && (
      <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('YÊU CẦU THIẾT KẾ')}</h1>
          <p className="page-subtitle">{t('Mỗi mặt hàng trong PO là một công việc thiết kế độc lập, chỉ hiển thị thông tin cần thiết cho bộ phận Thiết kế.')}</p>
        </div>
      </div>

      <div className="design-request-metrics">
        {metrics.map(status => (
          <button
            type="button"
            key={status.value}
            className={`design-status-metric ${statusFilter === status.value ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(current => current === status.value ? 'all' : status.value)}
          >
            <strong>{status.count}</strong>
            <span>{t(status.label)}</span>
          </button>
        ))}
      </div>

      <div className="card design-request-list-card">
        <div className="design-request-toolbar">
          <div className="design-request-search">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={t('Tìm mã yêu cầu, mã PO, mã hàng hoặc sản phẩm...')}
            />
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | DesignWorkStatus)}>
            <option value="all">{t('Tất cả tiến độ')}</option>
            {DESIGN_WORK_STATUSES.map(status => <option key={status.value} value={status.value}>{t(status.label)}</option>)}
          </select>
          <span className="design-request-result-count">{filteredRequests.length} {t('yêu cầu')}</span>
        </div>

        <div className="table-container design-request-table">
          <table>
            <thead>
              <tr>
                <th>{t('Mã yêu cầu')}</th>
                <th>{t('Mã PO')}</th>
                <th>{t('Mặt hàng cần thiết kế')}</th>
                <th>{t('Quy cách / Chất liệu')}</th>
                <th>{t('Hạn xử lý')}</th>
                <th>{t('Người phụ trách')}</th>
                <th>{t('Tiến độ thiết kế')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => {
                const status = getDesignWorkStatusDefinition(request.workStatus);
                const designer = users.find(user => user.uid === request.assignedDesignerId);
                const ageDays = getDesignRequestAgeDays(request);
                const overdue = isDesignRequestOverdue(request);
                return (
                  <tr key={request.id} className={overdue ? 'is-overdue' : ''} onClick={() => openRequest(request)}>
                    <td>
                      <strong className="design-request-code">{request.requestCode}</strong>
                      <span className={`design-priority design-priority--${request.priority || 'normal'}`}>{t(PRIORITY_LABELS[request.priority] || 'Bình thường')}</span>
                    </td>
                    <td>
                      <strong>{request.customerReferenceCode || request.poCode}</strong>
                      <span className="design-secondary-text">{request.poCode}</span>
                    </td>
                    <td>
                      <strong>{request.productName || t('Chưa đặt tên')}</strong>
                      <span className="design-secondary-text">{request.productCode || t('Chưa có mã hàng')}</span>
                    </td>
                    <td>
                      <span>{request.size || '—'}</span>
                      <span className="design-secondary-text">{request.material || '—'}</span>
                    </td>
                    <td>
                      <span className={overdue ? 'design-overdue-text' : ''}>{formatDate(request.dueDate)}</span>
                      <span className="design-secondary-text">{ageDays === null ? '—' : `${ageDays} ${t(request.workStatus === 'completed' ? 'ngày xử lý' : 'ngày chờ')}`}</span>
                    </td>
                    <td>{designer?.displayName || t('Chưa phân công')}</td>
                    <td>
                      <span className="design-work-badge" style={{ color: status.color, background: status.background, borderColor: status.color }}>
                        {t(status.label)}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={event => { event.stopPropagation(); openRequest(request); }}>
                        {t('Mở công việc')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRequests.length === 0 && (
                <tr><td colSpan={8} className="design-empty-row">{t('Không có yêu cầu thiết kế phù hợp.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {selectedRequest && (
        <div className="design-task-page">
          <header className="design-task-page-header">
            <PageBackButton onClick={closeRequest} />
            <div>
              <span>{t('CHI TIẾT CÔNG VIỆC THIẾT KẾ')}</span>
              <h1>{selectedRequest.requestCode} · {selectedRequest.productName || t('Chưa đặt tên')}</h1>
              <p>{selectedRequest.customerReferenceCode || selectedRequest.poCode} · {selectedRequest.productCode || t('Chưa có mã hàng')}</p>
            </div>
            <span
              className="design-work-badge design-task-status"
              style={{
                color: getDesignWorkStatusDefinition(selectedRequest.workStatus).color,
                background: getDesignWorkStatusDefinition(selectedRequest.workStatus).background,
                borderColor: getDesignWorkStatusDefinition(selectedRequest.workStatus).color
              }}
            >
              {t(getDesignWorkStatusDefinition(selectedRequest.workStatus).label)}
            </span>
          </header>

          {actionError && <div className="design-action-error"><AlertCircle size={16} /> {actionError}</div>}

          <section className="design-task-panel design-task-overview">
            <div className="design-task-brief">
              <div className="design-section-title"><ListChecks size={17} /><span>{t('Thông tin bàn giao từ Sale')}</span></div>
              <dl className="design-brief-grid">
                <div><dt>{t('Mã PO')}</dt><dd>{selectedRequest.customerReferenceCode || selectedRequest.poCode}</dd></div>
                <div><dt>{t('Mã hàng')}</dt><dd>{selectedRequest.productCode || '—'}</dd></div>
                <div><dt>{t('Tên hàng')}</dt><dd>{selectedRequest.productName || '—'}</dd></div>
                <div><dt>{t('Quy cách')}</dt><dd>{selectedRequest.size || '—'}</dd></div>
                <div><dt>{t('Chất liệu')}</dt><dd>{selectedRequest.material || '—'}</dd></div>
                <div><dt>{t('Hạn hoàn thành')}</dt><dd>{formatDate(selectedRequest.dueDate)}</dd></div>
              </dl>
              <div className="design-brief-note">
                <strong>{t('Yêu cầu và ghi chú thiết kế')}</strong>
                <p>{selectedRequest.designBrief || t('Sale chưa cung cấp ghi chú riêng.')}</p>
              </div>
              <div className="design-reference-gallery">
                <strong>{t('Artwork và hình ảnh tham khảo')}</strong>
                <div>
                  {(selectedRequest.referenceImages || []).map((imageUrl: string, index: number) => (
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" key={`${imageUrl.slice(0, 40)}-${index}`}>
                      <img src={imageUrl} alt={`${t('Ảnh tham khảo')} ${index + 1}`} />
                    </a>
                  ))}
                  {(selectedRequest.referenceImages || []).length === 0 && (
                    <span className="design-reference-empty"><ImageIcon size={24} />{t('Chưa có artwork hoặc hình ảnh tham khảo.')}</span>
                  )}
                </div>
              </div>
            </div>

            <aside className="design-progress-card design-task-progress">
              <div className="design-section-title"><Clock3 size={17} /><span>{t('Cập nhật tiến độ nội bộ')}</span></div>
              <label>{t('Trạng thái công việc của Designer')}</label>
              <select value={nextWorkStatus} onChange={event => setNextWorkStatus(event.target.value as DesignWorkStatus)} disabled={currentUser.role === 'sale'}>
                {DESIGN_WORK_STATUSES.map(status => <option key={status.value} value={status.value}>{t(status.label)}</option>)}
              </select>
              <label>{t('Ghi chú cập nhật / thông tin cần bổ sung')}</label>
              <textarea
                rows={4}
                value={statusNote}
                onChange={event => setStatusNote(event.target.value)}
                placeholder={t('Mô tả tiến độ hoặc ghi rõ nội dung đang thiếu...')}
                disabled={currentUser.role === 'sale'}
              />
              {currentUser.role !== 'sale' && (
                <button className="btn btn-primary" onClick={handleUpdateWorkStatus} disabled={isSaving}>
                  {isSaving ? t('Đang lưu...') : t('Lưu tiến độ thiết kế')}
                </button>
              )}

            </aside>
          </section>

          <section className="design-task-panel design-version-workspace">
            <div className="design-version-sidebar">
              <div className="design-version-header">
                <div className="design-section-title"><FileArchive size={17} /><span>{t('Phiên bản thiết kế')}</span></div>
                {(currentUser.role === 'admin' || currentUser.role === 'designer') && (
                  <button className="btn btn-sm btn-primary" onClick={() => setShowVersionModal(true)}><Plus size={14} /> {t('Thêm phiên bản')}</button>
                )}
              </div>
              <div className="design-version-list">
                {selectedDesignVersions.map((version: DesignVersion) => (
                  <button
                    type="button"
                    key={version.versionNumber}
                    className={selectedVersion?.versionNumber === version.versionNumber ? 'is-active' : ''}
                    onClick={() => setSelectedVersionNumber(version.versionNumber)}
                  >
                    <strong>v{version.versionNumber}</strong>
                    <span>{formatDate(version.createdAt)}</span>
                    <small>{version.comment || t('Không có ghi chú')}</small>
                  </button>
                ))}
                {selectedDesignVersions.length === 0 && (
                  <div className="design-version-empty">{t('Chưa có phiên bản thiết kế nào.')}</div>
                )}
              </div>
            </div>

            <div className="design-version-preview">
              {selectedVersion ? (
                <>
                  <div className="design-version-preview__image">
                    {selectedVersion.previewImage
                      ? <img src={selectedVersion.previewImage} alt={`Thiết kế v${selectedVersion.versionNumber}`} />
                      : <span><ImageIcon size={28} />{t('Không có ảnh xem trước')}</span>}
                  </div>
                  <div className="design-version-preview__meta">
                    <div><strong>{t('Phiên bản')} v{selectedVersion.versionNumber}</strong><span>{selectedVersion.comment || t('Không có ghi chú')}</span></div>
                    <div className="design-source-links">
                      {selectedVersion.aiLink && <a href={selectedVersion.aiLink} target="_blank" rel="noopener noreferrer">File AI</a>}
                      {selectedVersion.corelLink && <a href={selectedVersion.corelLink} target="_blank" rel="noopener noreferrer">File Corel</a>}
                      {!selectedVersion.aiLink && !selectedVersion.corelLink && <span>{t('Chưa có file thiết kế gốc')}</span>}
                    </div>
                    {selectedVersion.feedbackFromClient && <p className="design-client-feedback">{selectedVersion.feedbackFromClient}</p>}
                  </div>
                </>
              ) : (
                <div className="design-version-empty design-version-empty--large"><ImageIcon size={30} />{t('Chưa có bản thiết kế để xem trước.')}</div>
              )}

              {(currentUser.role === 'admin' || currentUser.role === 'sale') && selectedDesign?.status === 'client_pending' && selectedVersion && (
                <div className="design-approval-panel">
                  <strong>{t('Cập nhật phản hồi của khách hàng')}</strong>
                  <textarea value={feedbackText} onChange={event => setFeedbackText(event.target.value)} placeholder={t('Nhập nội dung khách hàng yêu cầu sửa...')} />
                  <div>
                    <button className="btn btn-success" onClick={() => handleClientFeedback(true)} disabled={isSaving}><CheckCircle2 size={15} /> {t('Khách đã duyệt')}</button>
                    <button className="btn btn-danger" onClick={() => handleClientFeedback(false)} disabled={isSaving}><XCircle size={15} /> {t('Yêu cầu Designer sửa')}</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="design-task-panel design-history-card">
            <div className="design-section-title"><UserRound size={17} /><span>{t('Lịch sử xử lý công việc')}</span></div>
            <div className="design-history-list">
              {[...(selectedRequest.history || [])].reverse().map((entry: DesignRequestHistory, index: number) => (
                <div key={`${entry.updatedAt || 'history'}-${index}`}>
                  <span className="design-history-dot" />
                  <strong>{entry.updatedBy || t('Hệ thống')}</strong>
                  <time>{formatDateTime(entry.updatedAt)}</time>
                  <p>{entry.note || t(getDesignWorkStatusDefinition(entry.workStatus).label)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {showVersionModal && selectedRequest && (
        <div className="modal-overlay design-version-overlay">
          <div className="modal-content design-version-modal">
            <div className="modal-header">
              <span>{t('THÊM PHIÊN BẢN THIẾT KẾ')} · {selectedRequest.requestCode}</span>
              <button className="btn btn-sm btn-outline" onClick={resetVersionForm}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddVersion}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Ảnh xem trước bản thiết kế')} *</label>
                  <input type="file" accept="image/*" onChange={handlePreviewFile} required />
                  {previewImage && <img className="design-upload-preview" src={previewImage} alt={t('Ảnh xem trước')} />}
                </div>
                <div className="form-grid">
                  <div className="form-group"><label>Link file AI</label><input type="url" value={aiLink} onChange={event => setAiLink(event.target.value)} placeholder="https://drive.google.com/..." /></div>
                  <div className="form-group"><label>Link file Corel</label><input type="url" value={corelLink} onChange={event => setCorelLink(event.target.value)} placeholder="https://drive.google.com/..." /></div>
                </div>
                <div className="form-group"><label>{t('Ghi chú phiên bản')} *</label><textarea value={versionComment} onChange={event => setVersionComment(event.target.value)} required /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={resetVersionForm}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('Đang lưu...') : t('Hoàn thành và gửi Sale')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
