import { dbService } from './firebaseService';
import {
  DesignApprovalStatus,
  DesignAssignment,
  DesignPOItem,
  DesignPOLike,
  DesignRequest,
  DesignWorkStatus,
  getDesignRequestCode,
  getDesignRequestId
} from '../domain/designWorkflow';
import { getPOQueueStatus } from '../domain/poWorkflow';

interface DesignRequestActor {
  uid?: string;
  displayName?: string;
  role?: string;
}

const uniqueStrings = (values: unknown[]) => Array.from(new Set(
  values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
));

const getInitialStatuses = (po: DesignPOLike, item: DesignPOItem): {
  workStatus: DesignWorkStatus;
  approvalStatus: DesignApprovalStatus;
} => {
  if (po.designProgress === 'approved' || getPOQueueStatus(po) !== 'waiting_design') {
    return { workStatus: 'completed', approvalStatus: 'approved' };
  }
  if (item.designReuseStatus === 'pending_verification') {
    return { workStatus: 'completed', approvalStatus: 'waiting_client' };
  }
  if (po.designProgress === 'customer_approval_pending') {
    const hasItemLevelReuse = (po.items || []).some(candidate => candidate.designReuseStatus === 'pending_verification');
    if (hasItemLevelReuse) return { workStatus: 'unreviewed', approvalStatus: 'not_sent' };
    return { workStatus: 'completed', approvalStatus: 'waiting_client' };
  }
  if (po.designProgress === 'revision_requested') {
    return { workStatus: 'queued', approvalStatus: 'revision_requested' };
  }
  return { workStatus: 'unreviewed', approvalStatus: 'not_sent' };
};

const getDesignAssignment = (po: DesignPOLike): DesignAssignment | null => (
  (po.assignments || []).find(assignment => assignment.department === 'designer') || null
);

const normalizePriority = (priority: unknown) => {
  if (priority === 'Cực gấp') return 'urgent';
  if (priority === 'Gấp') return 'high';
  if (priority === 'Thong thả') return 'low';
  return 'normal';
};

const getHistoricalDesignCompletionAt = (po: DesignPOLike, fallback: string) => {
  const completionStatuses = new Set([
    'design_sent',
    'layout_pending',
    'waiting_production',
    'production_pending',
    'supplier_ordered'
  ]);
  const matchingLog = [...(po.historyLogs || [])].reverse().find(log => (
    completionStatuses.has(String(log.status || '')) && typeof log.updatedAt === 'string'
  ));
  return typeof matchingLog?.updatedAt === 'string'
    ? matchingLog.updatedAt
    : po.updatedAt || fallback;
};

const buildRequestFields = (po: DesignPOLike, item: DesignPOItem, itemIndex: number): Omit<DesignRequest,
  'workStatus' | 'approvalStatus' | 'statusNote' | 'approvalNote' | 'startedAt' | 'completedAt'
  | 'createdById' | 'createdBy' | 'createdAt' | 'history'> => {
  const assignment = getDesignAssignment(po);
  const requestId = getDesignRequestId(po.id, item, itemIndex);
  return {
    id: requestId,
    requestCode: getDesignRequestCode(po.poCode || '', itemIndex),
    poId: po.id,
    poCode: po.poCode || '',
    customerReferenceCode: po.customerPoCode || po.poCode || '',
    itemId: item.itemId || item.productCode || `item-${itemIndex + 1}`,
    itemIndex,
    productCode: item.productCode || '',
    productName: item.productName || '',
    size: item.size || '',
    material: item.material || '',
    unit: item.unit || '',
    specifications: item.specifications || item.technicalSpecifications || {},
    designBrief: item.designNotes || item.note || po.designNotes || '',
    referenceImages: uniqueStrings([
      item.previewImage,
      ...(Array.isArray(item.previewImages) ? item.previewImages : []),
      ...(Array.isArray(item.saleLayouts) ? item.saleLayouts : [])
    ]),
    assignedDesignerId: assignment?.userIds?.[0] || assignment?.assignedUserId || 'u-designer',
    dueDate: assignment?.dueDate || item.deliveryDate || po.expectedDeliveryDate || po.dueDate || '',
    priority: normalizePriority(assignment?.priority),
    archived: false
  };
};

const hasFieldChanges = (existing: DesignRequest, nextFields: Partial<DesignRequest>) => (
  (Object.keys(nextFields) as Array<keyof DesignRequest>).some(key => (
    JSON.stringify(existing[key] ?? null) !== JSON.stringify(nextFields[key] ?? null)
  ))
);

const synchronizePORequests = async (
  po: DesignPOLike,
  actor: DesignRequestActor,
  existingRequests: DesignRequest[]
): Promise<DesignRequest[]> => {
  if (!po.id || po.deleted === true) return [];
  const items = Array.isArray(po.items) ? po.items : [];
  const activeRequestIds = new Set<string>();
  const syncedRequests: DesignRequest[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const initialStatuses = getInitialStatuses(po, item);
    const requestFields = buildRequestFields(po, item, itemIndex);
    const existing = existingRequests.find(request => request.id === requestFields.id);
    activeRequestIds.add(requestFields.id);

    if (existing) {
      const historicalCompletedAt = existing.workStatus === 'completed'
        && existing.history?.length === 1
        && existing.history[0]?.type === 'created'
        ? getHistoricalDesignCompletionAt(po, existing.completedAt || new Date().toISOString())
        : existing.completedAt;
      const shouldCorrectCompletedAt = historicalCompletedAt !== existing.completedAt;
      const assignmentChanged = existing.assignedDesignerId !== requestFields.assignedDesignerId;
      let assignmentUpdatedAt = existing.assignmentUpdatedAt || existing.createdAt;
      if (hasFieldChanges(existing, requestFields) || shouldCorrectCompletedAt || assignmentChanged) {
        const now = new Date().toISOString();
        if (assignmentChanged) assignmentUpdatedAt = now;
        await dbService.updateDocument('design_requests', existing.id, {
          ...requestFields,
          ...(assignmentChanged ? { assignmentUpdatedAt } : {}),
          ...(shouldCorrectCompletedAt ? { completedAt: historicalCompletedAt } : {}),
          updatedBy: actor.displayName || 'Hệ thống',
          history: [
            ...(existing.history || []),
            {
              type: 'source_sync',
              workStatus: existing.workStatus,
              approvalStatus: existing.approvalStatus,
              note: 'Đồng bộ thông tin bàn giao từ PO.',
              updatedBy: actor.displayName || 'Hệ thống',
              updatedAt: now
            }
          ]
        });
      }
      syncedRequests.push({
        ...existing,
        ...requestFields,
        assignmentUpdatedAt
      });
      continue;
    }

    const now = new Date().toISOString();
    const newRequest = {
      ...requestFields,
      assignmentUpdatedAt: now,
      ...initialStatuses,
      statusNote: '',
      approvalNote: '',
      startedAt: initialStatuses.workStatus === 'in_progress' ? now : '',
      completedAt: initialStatuses.workStatus === 'completed' ? getHistoricalDesignCompletionAt(po, now) : '',
      createdById: actor.uid || '',
      createdBy: actor.displayName || 'Hệ thống',
      createdAt: po.createdAt || po.orderDate || now,
      history: [{
        type: 'created',
        workStatus: initialStatuses.workStatus,
        approvalStatus: initialStatuses.approvalStatus,
        note: 'Tự động tạo yêu cầu thiết kế từ mặt hàng trong PO.',
        updatedBy: actor.displayName || 'Hệ thống',
        updatedAt: now
      }]
    };
    const created = await dbService.addDocument('design_requests', newRequest) as DesignRequest;
    syncedRequests.push(created);
  }

  for (const obsoleteRequest of existingRequests.filter(request => (
    !activeRequestIds.has(request.id) && request.archived !== true
  ))) {
    await dbService.updateDocument('design_requests', obsoleteRequest.id, {
      archived: true,
      archivedReason: 'Mặt hàng không còn tồn tại trong PO.',
      archivedBy: actor.displayName || 'Hệ thống'
    });
  }

  return syncedRequests;
};

export const syncDesignRequestsForPO = async (po: DesignPOLike, actor: DesignRequestActor): Promise<DesignRequest[]> => {
  const existingRequests = ((await dbService.getCollection('design_requests')) as DesignRequest[])
    .filter(request => request.poId === po.id);
  return synchronizePORequests(po, actor, existingRequests);
};

export const syncDesignRequestsForPOs = async (pos: DesignPOLike[], actor: DesignRequestActor): Promise<DesignRequest[]> => {
  const existingRequests = (await dbService.getCollection('design_requests')) as DesignRequest[];
  const results: DesignRequest[] = [];
  for (const po of pos.filter(candidate => candidate && candidate.deleted !== true)) {
    results.push(...await synchronizePORequests(
      po,
      actor,
      existingRequests.filter(request => request.poId === po.id)
    ));
  }
  return results;
};
