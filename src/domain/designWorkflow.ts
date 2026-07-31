export type DesignWorkStatus =
  | 'unreviewed'
  | 'queued'
  | 'in_progress'
  | 'waiting_info'
  | 'completed';

export type DesignApprovalStatus =
  | 'not_sent'
  | 'waiting_client'
  | 'revision_requested'
  | 'approved';

export interface DesignPOItem {
  itemId?: string;
  productCode?: string;
  productName?: string;
  size?: string;
  material?: string;
  unit?: string;
  specifications?: Record<string, unknown>;
  technicalSpecifications?: Record<string, unknown>;
  designNotes?: string;
  note?: string;
  previewImage?: string;
  previewImages?: string[];
  saleLayouts?: string[];
  designLayouts?: string[];
  designReuseStatus?: string;
  sourceItemId?: string;
  deliveryDate?: string;
  [key: string]: unknown;
}

export interface DesignAssignment {
  department?: string;
  userIds?: string[];
  assignedUserId?: string;
  dueDate?: string;
  priority?: string;
}

export interface DesignPOLike {
  id: string;
  poCode?: string;
  customerPoCode?: string;
  customerId?: string;
  customerName?: string;
  status?: string;
  workflowVersion?: number;
  designProgress?: string;
  productionProgress?: string;
  designNotes?: string;
  expectedDeliveryDate?: string;
  dueDate?: string;
  orderDate?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  assignments?: DesignAssignment[];
  items?: DesignPOItem[];
  historyLogs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface DesignRequestHistory {
  type: string;
  workStatus: DesignWorkStatus;
  approvalStatus: DesignApprovalStatus;
  note: string;
  updatedBy: string;
  updatedAt: string;
}

export interface DesignRequest {
  id: string;
  requestCode: string;
  poId: string;
  poCode: string;
  customerReferenceCode: string;
  itemId: string;
  itemIndex: number;
  productCode: string;
  productName: string;
  size: string;
  material: string;
  unit: string;
  specifications: Record<string, unknown>;
  designBrief: string;
  referenceImages: string[];
  assignedDesignerId: string;
  assignmentUpdatedAt?: string;
  dueDate: string;
  priority: string;
  workStatus: DesignWorkStatus;
  approvalStatus: DesignApprovalStatus;
  statusNote: string;
  approvalNote: string;
  startedAt: string;
  completedAt: string;
  latestVersion?: number;
  archived: boolean;
  archivedReason?: string;
  archivedBy?: string;
  createdById: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  history: DesignRequestHistory[];
}

export interface DesignVersion {
  versionNumber: number;
  previewImage: string;
  aiLink?: string;
  corelLink?: string;
  comment?: string;
  createdAt?: string;
  createdBy?: string;
  feedbackFromClient?: string;
  feedbackAt?: string;
  reusedFromDesignId?: string;
  reusedFromPoId?: string;
  reusedFromVersion?: number;
}

export interface DesignRecord {
  id: string;
  designRequestId?: string;
  poId: string;
  poCode?: string;
  itemId?: string;
  itemIndex?: number;
  customerReferenceCode?: string;
  designerId?: string;
  designerName?: string;
  status?: string;
  currentVersion?: number;
  versions?: DesignVersion[];
  fileUrl?: string;
  aiLink?: string;
  corelLink?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesignStatusDefinition<T extends string> {
  value: T;
  label: string;
  color: string;
  background: string;
}

export const DESIGN_WORK_STATUSES: DesignStatusDefinition<DesignWorkStatus>[] = [
  { value: 'unreviewed', label: 'Chưa kiểm tra', color: '#b45309', background: '#fffbeb' },
  { value: 'queued', label: 'Chưa xử lý', color: '#475569', background: '#f8fafc' },
  { value: 'in_progress', label: 'Đang xử lý', color: '#1d4ed8', background: '#eff6ff' },
  { value: 'waiting_info', label: 'Chờ thêm thông tin', color: '#c2410c', background: '#fff7ed' },
  { value: 'completed', label: 'Đã hoàn thành', color: '#047857', background: '#ecfdf5' }
];

export const DESIGN_APPROVAL_STATUSES: DesignStatusDefinition<DesignApprovalStatus>[] = [
  { value: 'not_sent', label: 'Chưa gửi khách hàng', color: '#475569', background: '#f8fafc' },
  { value: 'waiting_client', label: 'Chờ khách hàng duyệt', color: '#b45309', background: '#fffbeb' },
  { value: 'revision_requested', label: 'Khách yêu cầu sửa', color: '#b91c1c', background: '#fef2f2' },
  { value: 'approved', label: 'Khách đã duyệt mẫu', color: '#047857', background: '#ecfdf5' }
];

export const getDesignWorkStatus = (value: unknown): DesignWorkStatus => (
  DESIGN_WORK_STATUSES.some(status => status.value === value) ? value as DesignWorkStatus : 'unreviewed'
);

export const getDesignApprovalStatus = (value: unknown): DesignApprovalStatus => (
  DESIGN_APPROVAL_STATUSES.some(status => status.value === value) ? value as DesignApprovalStatus : 'not_sent'
);

export const getDesignWorkStatusDefinition = (value: unknown) => (
  DESIGN_WORK_STATUSES.find(status => status.value === getDesignWorkStatus(value)) || DESIGN_WORK_STATUSES[0]
);

export const getDesignApprovalStatusDefinition = (value: unknown) => (
  DESIGN_APPROVAL_STATUSES.find(status => status.value === getDesignApprovalStatus(value)) || DESIGN_APPROVAL_STATUSES[0]
);

export const getDesignRequestId = (poId: string, item: DesignPOItem, itemIndex: number) => {
  const itemKey = String(item?.itemId || `${item?.productCode || 'item'}-${itemIndex + 1}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  const poKey = String(poId).trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `design-request-${poKey}-${itemKey || itemIndex + 1}`;
};

export const getDesignRequestCode = (poCode: string, itemIndex: number) => (
  `TK-${poCode || 'PO'}-${String(itemIndex + 1).padStart(2, '0')}`
);

export const getDesignRequestAgeDays = (request: Partial<DesignRequest>) => {
  const startTime = Date.parse(request?.createdAt || '');
  if (Number.isNaN(startTime)) return null;
  const endTime = request?.workStatus === 'completed' && request?.completedAt
    ? Date.parse(request.completedAt)
    : Date.now();
  if (Number.isNaN(endTime)) return null;
  return Math.max(0, Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000)));
};

export const isDesignRequestOverdue = (request: Partial<DesignRequest>) => {
  if (!request?.dueDate || request?.workStatus === 'completed') return false;
  const dueTime = Date.parse(request.dueDate);
  return !Number.isNaN(dueTime) && dueTime < Date.now();
};

export const resolveDesignForRequest = (designs: DesignRecord[], request: DesignRequest) => (
  designs.find(design => design.designRequestId === request.id)
  || designs.find(design => design.poId === request.poId && design.itemId && design.itemId === request.itemId)
  || (request.itemIndex === 0
    ? designs.find(design => design.poId === request.poId && !design.itemId && !design.designRequestId)
    : null)
  || null
);
