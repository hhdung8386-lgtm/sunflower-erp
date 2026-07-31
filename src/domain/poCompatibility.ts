type PORecord = Record<string, unknown>;

export interface CompatiblePORecord extends PORecord {
  customerId: string;
  customerName: string;
  customerRank: string;
  items: unknown[];
  assignments: unknown[];
  historyLogs: unknown[];
  internalChecklist: unknown[];
  links: PORecord;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
}

const asRecord = (value: unknown): PORecord => (
  value && typeof value === 'object' ? value as PORecord : {}
);

const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const asNumber = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

export const normalizePORecord = (value: unknown): CompatiblePORecord => {
  const source = asRecord(value);
  const customerSnapshot = asRecord(source.customerSnapshot);

  return {
    ...source,
    customerId: asText(source.customerId) || asText(customerSnapshot.customerId),
    customerName: asText(source.customerName) || asText(customerSnapshot.companyName),
    customerRank: asText(source.customerRank) || asText(customerSnapshot.customerRank),
    items: Array.isArray(source.items) ? source.items : [],
    assignments: Array.isArray(source.assignments) ? source.assignments : [],
    historyLogs: Array.isArray(source.historyLogs) ? source.historyLogs : [],
    internalChecklist: Array.isArray(source.internalChecklist) ? source.internalChecklist : [],
    links: asRecord(source.links),
    totalAmount: asNumber(source.totalAmount),
    discountAmount: asNumber(source.discountAmount),
    netAmount: asNumber(source.netAmount)
  };
};

export const normalizePORecords = (values: unknown): CompatiblePORecord[] => (
  Array.isArray(values) ? values.map(normalizePORecord) : []
);
