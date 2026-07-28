export const PO_QUEUE_STATES = [
  { value: 'waiting_design', label: 'Chờ thiết kế', color: '#7c3aed', background: '#f5f3ff' },
  { value: 'waiting_production', label: 'Chờ sản xuất', color: '#2563eb', background: '#eff6ff' },
  { value: 'waiting_delivery', label: 'Chờ giao', color: '#d97706', background: '#fffbeb' },
  { value: 'waiting_invoice', label: 'Chờ xuất hóa đơn', color: '#0891b2', background: '#ecfeff' },
  { value: 'waiting_receivable', label: 'Chờ thu công nợ', color: '#dc2626', background: '#fef2f2' },
  { value: 'waiting_discount', label: 'Chờ xử lý chiết khấu', color: '#c026d3', background: '#fdf4ff' },
  { value: 'completed', label: 'Hoàn tất', color: '#059669', background: '#ecfdf5' }
] as const;

export type POQueueStatus = typeof PO_QUEUE_STATES[number]['value'];
export type PODeliveryStage = 'supplier_inbound' | 'customer_outbound';

export interface POStatusLike {
  status?: string;
  deliveryStage?: string;
  workflowVersion?: number;
}

const QUEUE_STATUS_SET = new Set<string>(PO_QUEUE_STATES.map(state => state.value));

const LEGACY_STATUS_LABELS: Record<string, string> = {
  receive_po: 'Đã nhận PO',
  bom_extracted: 'Đã bóc tách NVL',
  design_sent: 'Đã gửi thiết kế',
  layout_pending: 'Chờ khách duyệt',
  supplier_ordered: 'Đã đặt hàng NCC',
  supplier_confirmed: 'NCC đã giao vật tư',
  production_pending: 'Chờ sản xuất',
  producing: 'Đang sản xuất',
  production_done: 'Sản xuất xong',
  qc_passed: 'QC hoàn thành',
  packed: 'Đã đóng gói',
  delivering: 'Đang giao hàng',
  partially_delivered: 'Giao một phần',
  delivered: 'Khách đã nhận',
  invoiced: 'Đã xuất hóa đơn',
  debt_collected: 'Đã thu công nợ',
  discounted: 'Đã xử lý chiết khấu'
};

const LEGACY_TO_QUEUE: Record<string, POQueueStatus> = {
  receive_po: 'waiting_design',
  bom_extracted: 'waiting_design',
  design_sent: 'waiting_design',
  layout_pending: 'waiting_design',
  supplier_ordered: 'waiting_delivery',
  supplier_confirmed: 'waiting_production',
  production_pending: 'waiting_production',
  producing: 'waiting_production',
  production_done: 'waiting_delivery',
  qc_passed: 'waiting_delivery',
  packed: 'waiting_delivery',
  delivering: 'waiting_delivery',
  partially_delivered: 'waiting_delivery',
  delivered: 'waiting_invoice',
  invoiced: 'waiting_receivable',
  debt_collected: 'waiting_discount',
  discounted: 'completed'
};

export const getPOQueueStatus = (poOrStatus: POStatusLike | string | null | undefined): POQueueStatus => {
  const status = typeof poOrStatus === 'string' ? poOrStatus : poOrStatus?.status;
  if (status && QUEUE_STATUS_SET.has(status)) return status as POQueueStatus;
  return LEGACY_TO_QUEUE[status || ''] || 'waiting_design';
};

export const getPOQueueState = (poOrStatus: POStatusLike | string | null | undefined) => {
  const queueStatus = getPOQueueStatus(poOrStatus);
  return PO_QUEUE_STATES.find(state => state.value === queueStatus) || PO_QUEUE_STATES[0];
};

export const getPOQueueLabel = (poOrStatus: POStatusLike | string | null | undefined): string => (
  getPOQueueState(poOrStatus).label
);

export const getPOHistoryStatusLabel = (status?: string): string => {
  if (!status) return 'Không xác định';
  if (QUEUE_STATUS_SET.has(status)) return getPOQueueLabel(status);
  return LEGACY_STATUS_LABELS[status] || status;
};

export const isPOInQueue = (po: POStatusLike | null | undefined, queueStatus: POQueueStatus): boolean => (
  getPOQueueStatus(po) === queueStatus
);

export const isPOCompleted = (po: POStatusLike | null | undefined): boolean => (
  getPOQueueStatus(po) === 'completed'
);

export const getPODeliveryStage = (po: POStatusLike | null | undefined): PODeliveryStage => {
  if (po?.deliveryStage === 'supplier_inbound' || po?.deliveryStage === 'customer_outbound') {
    return po.deliveryStage;
  }
  return po?.status === 'supplier_ordered' ? 'supplier_inbound' : 'customer_outbound';
};

export const getPODeliveryStageLabel = (po: POStatusLike | null | undefined): string => (
  getPODeliveryStage(po) === 'supplier_inbound'
    ? 'Nhà cung cấp giao tới'
    : 'Giao cho khách hàng'
);

export const getPOBadgeClass = (poOrStatus: POStatusLike | string | null | undefined): string => {
  switch (getPOQueueStatus(poOrStatus)) {
    case 'completed': return 'badge-success';
    case 'waiting_receivable': return 'badge-danger';
    case 'waiting_production': return 'badge-info';
    default: return 'badge-warning';
  }
};

export const getPOQueueUpdate = (
  status: POQueueStatus,
  extras: Record<string, unknown> = {}
) => ({
  status,
  workflowVersion: 2,
  ...extras
});
