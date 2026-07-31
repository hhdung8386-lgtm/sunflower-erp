export const NOTIFICATION_SCHEMA_VERSION = 1;

export type NotificationModule =
  | 'crm'
  | 'sales'
  | 'design'
  | 'purchase'
  | 'inventory'
  | 'production'
  | 'delivery'
  | 'accounting'
  | 'system';

type UnknownRecord = Record<string, unknown>;

export interface UserNotificationRecord extends UnknownRecord {
  id: string;
  schemaVersion: number;
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
  readAt: string | null;
}

const asRecord = (value: unknown): UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const asText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const asArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
);

const normalizeModule = (value: unknown): NotificationModule => {
  const modules: NotificationModule[] = [
    'crm',
    'sales',
    'design',
    'purchase',
    'inventory',
    'production',
    'delivery',
    'accounting',
    'system'
  ];
  return modules.includes(value as NotificationModule)
    ? value as NotificationModule
    : 'system';
};

export const normalizeNotificationRecord = (value: unknown): UserNotificationRecord => {
  const source = asRecord(value);
  const recipientId = asText(source.recipientId ?? source.userId);
  const eventType = asText(source.eventType ?? source.type, 'general');
  const entityId = asText(source.entityId ?? source.targetId);

  return {
    ...source,
    id: asText(source.id),
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    recipientId,
    module: normalizeModule(source.module),
    eventType,
    eventKey: asText(source.eventKey, `${eventType}:${entityId}:${recipientId}`),
    entityId,
    entityCode: asText(source.entityCode),
    title: asText(source.title),
    message: asText(source.message),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById),
    readAt: source.readAt ? asText(source.readAt) : null
  };
};

export const normalizeNotificationRecords = (values: unknown): UserNotificationRecord[] => (
  asArray(values).map(normalizeNotificationRecord)
);

export const isUnreadNotificationForUser = (
  notification: UserNotificationRecord,
  userId: string
): boolean => (
  notification.recipientId === userId && notification.readAt === null
);
