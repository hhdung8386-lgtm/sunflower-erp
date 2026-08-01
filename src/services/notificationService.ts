import type { CustomerRecord, LeadRecord } from '../domain/crmModels';
import type { DesignRequest } from '../domain/designWorkflow';
import type { ProcurementRequestRecord } from '../domain/purchaseModels';
import {
  getNotificationDocumentId,
  type NotificationModule,
  type UserNotificationRecord
} from '../domain/notificationModels';
import { dbService, type UserProfile } from './firebaseService';

type UnknownRecord = Record<string, unknown>;

interface NotificationCandidate {
  recipientId: string;
  module: NotificationModule;
  eventType: string;
  eventKey: string;
  entityId: string;
  entityCode: string;
  title: string;
  message: string;
  createdAt: string;
  createdById: string;
}

interface WorkflowNotificationInput {
  users: UserProfile[];
  customers: CustomerRecord[];
  leads: LeadRecord[];
  pos: UnknownRecord[];
  procurementRequests: ProcurementRequestRecord[];
  designRequests: DesignRequest[];
  inventory: UnknownRecord[];
  productionCommands: UnknownRecord[];
  deliveries: UnknownRecord[];
  invoices: UnknownRecord[];
  notifications: UserNotificationRecord[];
  referenceTime?: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const asText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asBoolean = (value: unknown): boolean => value === true;

const getEntityId = (record: UnknownRecord): string => (
  asText(record.id) || asText(record.code)
);

const getRoleUserIds = (users: UserProfile[], role: UserProfile['role']): string[] => (
  users
    .filter(user => user.active !== false && user.role === role)
    .map(user => user.uid)
    .filter(Boolean)
);

const uniqueRecipientIds = (values: string[]): string[] => (
  Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
);

const addForRecipients = (
  candidates: NotificationCandidate[],
  recipientIds: string[],
  notification: Omit<NotificationCandidate, 'recipientId'>
) => {
  uniqueRecipientIds(recipientIds).forEach(recipientId => {
    candidates.push({ ...notification, recipientId });
  });
};

const getRecordCreatedAt = (record: UnknownRecord): string => (
  asText(record.createdAt)
  || asText(record.orderDate)
  || asText(record.updatedAt)
  || '1970-01-01T00:00:00.000Z'
);

const getNotificationIdentity = (
  notification: Pick<UserNotificationRecord, 'recipientId' | 'eventKey'>
): string => `${notification.recipientId}|${notification.eventKey}`;

export const buildWorkflowNotificationCandidates = ({
  users,
  customers,
  leads,
  pos,
  procurementRequests,
  designRequests,
  inventory,
  productionCommands,
  deliveries,
  invoices,
  referenceTime = Date.now()
}: Omit<WorkflowNotificationInput, 'notifications'>): NotificationCandidate[] => {
  const candidates: NotificationCandidate[] = [];
  const adminIds = getRoleUserIds(users, 'admin');
  const designerIds = getRoleUserIds(users, 'designer');
  const purchaserIds = getRoleUserIds(users, 'purchaser');
  const producerIds = getRoleUserIds(users, 'producer');
  const accountantIds = getRoleUserIds(users, 'accountant');

  customers.forEach(customer => {
    const lastOrderAt = customer.lastOrderAt || '';
    const lastOrderTime = Date.parse(lastOrderAt);
    if (!Number.isFinite(lastOrderTime) || lastOrderTime >= referenceTime - 30 * DAY_IN_MS) return;
    addForRecipients(candidates, [...adminIds, customer.assignedSaleId], {
      module: 'crm',
      eventType: 'workflow_customer_follow_up',
      eventKey: `crm:follow-up:${customer.id}:${lastOrderAt}`,
      entityId: customer.id,
      entityCode: customer.customerCode || customer.id,
      title: 'Khách hàng cần chăm sóc',
      message: `${customer.companyName} đã lâu chưa phát sinh đơn hàng.`,
      createdAt: lastOrderAt,
      createdById: ''
    });
  });

  leads.forEach(lead => {
    if (['lost', 'converted'].includes(lead.stage)) return;
    addForRecipients(candidates, [...adminIds, lead.assignedSaleId], {
      module: 'leads',
      eventType: 'workflow_lead_assigned',
      eventKey: `leads:assigned:${lead.id}:${lead.assignedSaleId || 'unassigned'}:${lead.createdAt}`,
      entityId: lead.id,
      entityCode: lead.companyName,
      title: 'Lead mới cần theo dõi',
      message: `${lead.companyName} đã được thêm vào danh sách khách hàng tiềm năng.`,
      createdAt: lead.createdAt,
      createdById: lead.createdById
    });

    if (!lead.nextFollowUpAt || lead.stage === 'won') return;
    const followUpTime = Date.parse(lead.nextFollowUpAt);
    if (!Number.isFinite(followUpTime) || followUpTime >= referenceTime) return;
    addForRecipients(candidates, [...adminIds, lead.assignedSaleId], {
      module: 'leads',
      eventType: 'workflow_lead_follow_up',
      eventKey: `leads:follow-up:${lead.id}:${lead.nextFollowUpAt}`,
      entityId: lead.id,
      entityCode: lead.companyName,
      title: 'Lead đến hạn chăm sóc',
      message: `${lead.companyName} đang quá hạn lịch chăm sóc.`,
      createdAt: lead.nextFollowUpAt,
      createdById: lead.createdById
    });
  });

  pos.forEach(po => {
    if (asBoolean(po.deleted) || asText(po.status) !== 'waiting_design') return;
    const poId = getEntityId(po);
    const poCode = asText(po.poCode) || poId;
    addForRecipients(candidates, [
      ...adminIds,
      asText(po.saleId),
      asText(po.assignedSaleId)
    ], {
      module: 'sales',
      eventType: 'workflow_po_waiting_design',
      eventKey: `sales:waiting-design:${poId}:${getRecordCreatedAt(po)}`,
      entityId: poId,
      entityCode: poCode,
      title: 'PO đang chờ thiết kế',
      message: `${poCode} cần được theo dõi và bàn giao thiết kế.`,
      createdAt: getRecordCreatedAt(po),
      createdById: asText(po.saleId)
    });
  });

  procurementRequests.forEach(request => {
    if (request.deleted || !['new', 'reviewing', 'quoting', 'supplier_selected'].includes(request.status)) return;
    const recipients = request.assignedPurchaserId
      ? [request.assignedPurchaserId]
      : purchaserIds;
    addForRecipients(candidates, [...adminIds, ...recipients], {
      module: 'purchase',
      eventType: 'workflow_procurement_request',
      eventKey: `purchase:request:${request.id}:${request.status}:${request.assignedPurchaserId || 'team'}`,
      entityId: request.id,
      entityCode: request.requestCode,
      title: request.status === 'new' ? 'PO mới cần xử lý mua hàng' : 'Yêu cầu mua hàng đang chờ xử lý',
      message: `${request.poCode} · ${request.productName} · ${request.quantity.toLocaleString('vi-VN')} ${request.unit}`,
      createdAt: request.createdAt,
      createdById: request.createdById
    });
  });

  designRequests.forEach(request => {
    if (request.archived || request.workStatus === 'completed') return;
    const assignmentVersion = request.assignmentUpdatedAt || request.createdAt;
    const recipients = request.assignedDesignerId
      ? [request.assignedDesignerId]
      : designerIds;
    addForRecipients(candidates, [...adminIds, ...recipients], {
      module: 'design',
      eventType: 'workflow_design_assigned',
      eventKey: `design:assigned:${request.id}:${request.assignedDesignerId || 'team'}:${assignmentVersion}`,
      entityId: request.id,
      entityCode: request.requestCode,
      title: 'Công việc thiết kế mới',
      message: `${request.requestCode} · ${request.productName || request.poCode}`,
      createdAt: assignmentVersion,
      createdById: request.createdById
    });
  });

  inventory.forEach(item => {
    const quantity = asNumber(item.qtyInStock);
    const minimum = asNumber(item.minQtyAlert);
    if (quantity > minimum) return;
    const itemId = getEntityId(item);
    const itemCode = asText(item.materialCode) || asText(item.code) || itemId;
    const itemName = asText(item.materialName) || asText(item.name) || itemCode;
    const sharedFields = {
      entityId: itemId,
      entityCode: itemCode,
      title: 'Nguyên vật liệu sắp hết',
      message: `${itemName} còn ${quantity}, dưới mức cảnh báo ${minimum}.`,
      createdAt: getRecordCreatedAt(item),
      createdById: ''
    };
    addForRecipients(candidates, [...adminIds, ...purchaserIds], {
      ...sharedFields,
      module: 'purchase',
      eventType: 'workflow_material_purchase_required',
      eventKey: `purchase:low-stock:${itemId}:${quantity}:${minimum}`
    });
    addForRecipients(candidates, [...adminIds, ...purchaserIds], {
      ...sharedFields,
      module: 'inventory',
      eventType: 'workflow_inventory_low_stock',
      eventKey: `inventory:low-stock:${itemId}:${quantity}:${minimum}`
    });
  });

  productionCommands.forEach(command => {
    if (asBoolean(command.deleted)) return;
    const status = asText(command.status);
    if (!['producing', 'transfer_pending'].includes(status)) return;
    const commandId = getEntityId(command);
    const commandCode = asText(command.commandCode) || asText(command.lsxCode) || commandId;
    const operatorId = asText(command.operatorId);
    addForRecipients(candidates, [
      ...adminIds,
      ...(operatorId ? [operatorId] : producerIds)
    ], {
      module: 'production',
      eventType: 'workflow_production_action',
      eventKey: `production:${status}:${commandId}:${operatorId || 'team'}`,
      entityId: commandId,
      entityCode: commandCode,
      title: status === 'transfer_pending' ? 'LSX chờ bàn giao' : 'LSX đang thực hiện',
      message: `${commandCode} cần bộ phận sản xuất theo dõi.`,
      createdAt: getRecordCreatedAt(command),
      createdById: asText(command.createdById)
    });
    if (status === 'transfer_pending') {
      addForRecipients(candidates, adminIds, {
        module: 'dashboard',
        eventType: 'workflow_production_transfer',
        eventKey: `dashboard:production-transfer:${commandId}`,
        entityId: commandId,
        entityCode: commandCode,
        title: 'Sản xuất chờ bàn giao',
        message: `${commandCode} đang chờ xác nhận bàn giao.`,
        createdAt: getRecordCreatedAt(command),
        createdById: asText(command.createdById)
      });
    }
  });

  const today = new Date(referenceTime);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfWeek = startOfToday + 7 * DAY_IN_MS;
  deliveries.forEach(delivery => {
    if (asText(delivery.status) === 'completed') return;
    const deliveryTime = Date.parse(asText(delivery.deliveryDate));
    if (!Number.isFinite(deliveryTime) || deliveryTime < startOfToday || deliveryTime > endOfWeek) return;
    const deliveryId = getEntityId(delivery);
    const deliveryCode = asText(delivery.deliveryCode) || asText(delivery.tripCode) || deliveryId;
    addForRecipients(candidates, [...adminIds, asText(delivery.assignedSaleId)], {
      module: 'delivery',
      eventType: 'workflow_delivery_upcoming',
      eventKey: `delivery:upcoming:${deliveryId}:${asText(delivery.deliveryDate)}`,
      entityId: deliveryId,
      entityCode: deliveryCode,
      title: 'Lịch giao hàng sắp tới',
      message: `${deliveryCode} cần được điều phối trong 7 ngày tới.`,
      createdAt: getRecordCreatedAt(delivery),
      createdById: asText(delivery.createdById)
    });
  });

  invoices.forEach(invoice => {
    if (asText(invoice.status) !== 'unpaid') return;
    const invoiceId = getEntityId(invoice);
    const invoiceCode = asText(invoice.invoiceCode) || invoiceId;
    const assignedAccountantId = asText(invoice.assignedAccountantId);
    addForRecipients(candidates, [
      ...adminIds,
      ...(assignedAccountantId ? [assignedAccountantId] : accountantIds)
    ], {
      module: 'accounting',
      eventType: 'workflow_invoice_unpaid',
      eventKey: `accounting:unpaid:${invoiceId}:${asText(invoice.dueDate)}`,
      entityId: invoiceId,
      entityCode: invoiceCode,
      title: 'Hóa đơn chưa thanh toán',
      message: `${invoiceCode} đang chờ xử lý thanh toán.`,
      createdAt: getRecordCreatedAt(invoice),
      createdById: asText(invoice.createdById)
    });
  });

  return candidates;
};

export const synchronizeWorkflowNotifications = async (
  input: WorkflowNotificationInput
): Promise<void> => {
  const candidates = buildWorkflowNotificationCandidates(input);
  const activeIdentities = new Set(candidates.map(getNotificationIdentity));
  const existingIdentities = new Set(input.notifications.map(getNotificationIdentity));
  const knownEntityIds: Record<NotificationModule, Set<string>> = {
    dashboard: new Set(input.productionCommands.map(getEntityId).filter(Boolean)),
    crm: new Set(input.customers.map(customer => customer.id)),
    leads: new Set(input.leads.map(lead => lead.id)),
    sales: new Set(input.pos.map(getEntityId).filter(Boolean)),
    design: new Set(input.designRequests.map(request => request.id)),
    purchase: new Set([
      ...input.inventory.map(getEntityId).filter(Boolean),
      ...input.procurementRequests.map(request => request.id).filter(Boolean)
    ]),
    inventory: new Set(input.inventory.map(getEntityId).filter(Boolean)),
    production: new Set(input.productionCommands.map(getEntityId).filter(Boolean)),
    delivery: new Set(input.deliveries.map(getEntityId).filter(Boolean)),
    accounting: new Set(input.invoices.map(getEntityId).filter(Boolean)),
    system: new Set()
  };
  const now = new Date().toISOString();

  const createOperations = candidates
    .filter(candidate => !existingIdentities.has(getNotificationIdentity(candidate)))
    .map(candidate => dbService.addDocument('notifications', {
      ...candidate,
      id: getNotificationDocumentId(candidate.recipientId, candidate.eventKey),
      schemaVersion: 1,
      source: 'workflow',
      readAt: null
    }));

  const closeOperations = input.notifications
    .filter(notification => (
      notification.source === 'workflow'
      && notification.readAt === null
      && knownEntityIds[notification.module].has(notification.entityId)
      && !activeIdentities.has(getNotificationIdentity(notification))
    ))
    .map(notification => dbService.updateDocument('notifications', notification.id, {
      readAt: now,
      readReason: 'workflow_inactive'
    }));

  await Promise.all([...createOperations, ...closeOperations]);
};

export const markModuleNotificationsRead = async (
  notifications: UserNotificationRecord[],
  recipientId: string,
  module: NotificationModule
): Promise<void> => {
  const readAt = new Date().toISOString();
  const unread = notifications.filter(notification => (
    notification.recipientId === recipientId
    && notification.module === module
    && notification.readAt === null
  ));
  await Promise.all(unread.map(notification => (
    dbService.updateDocument('notifications', notification.id, {
      readAt,
      readById: recipientId
    })
  )));
};
