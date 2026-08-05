import type { PODiscountType } from './poFinancials';

export const CRM_SCHEMA_VERSION = 1;

export type CustomerRank = '' | 'A' | 'B' | 'C' | 'D';
export type CustomerContactRole = 'primary' | 'procurement' | 'warehouse' | 'accounting' | 'other';
export type CustomerDocumentCategory = 'contract' | 'acceptance' | 'qc' | 'qa' | 'artwork' | 'other';
export type LeadStage = 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost' | 'converted';
export type LeadCompanySize = '' | 'large' | 'medium' | 'small';
export type LeadCustomFieldType = 'multi_select' | 'single_select' | 'checkbox' | 'text' | 'number' | 'date';

export interface LeadFilterOption {
  id: string;
  label: string;
  color: string;
  active: boolean;
}

export interface LeadFilterDefinition extends UnknownRecord {
  id: string;
  name: string;
  group: string;
  type: LeadCustomFieldType;
  options: LeadFilterOption[];
  active: boolean;
  showInQuickFilter: boolean;
  reportable: boolean;
  saleEditable: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadProfileFieldDefinition extends UnknownRecord {
  id: string;
  name: string;
  type: LeadCustomFieldType;
  options: LeadFilterOption[];
  active: boolean;
  required: boolean;
  saleEditable: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

type UnknownRecord = Record<string, unknown>;

export interface CustomerContactRecord extends UnknownRecord {
  id: string;
  name: string;
  role: CustomerContactRole;
  phone: string;
  email: string;
  note: string;
}

export interface CustomerDocumentRecord extends UnknownRecord {
  id: string;
  category: CustomerDocumentCategory;
  name: string;
  url: string;
  poId: string;
  createdAt: string;
  createdById: string;
}

export interface CustomerFileRecord extends UnknownRecord {
  id: string;
  name: string;
  folder: string;
  url: string;
  data: string;
  createdAt: string;
  createdById: string;
}

export interface CustomerProductRecord extends UnknownRecord {
  id: string;
  productCode: string;
  productName: string;
  productType: string;
  size: string;
  material: string;
  unit: string;
  currentPrice: number;
  salePrice: number;
  vatRate: number;
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  leadTimeDays: number;
  layoutUrl: string;
  specifications: UnknownRecord;
  files: unknown[];
  designLayouts: unknown[];
}

export interface CustomerPendingOrderItem extends UnknownRecord {
  itemId: string;
  productCode: string;
  productName: string;
  productType: string;
  size: string;
  material: string;
  unit: string;
  quantity: number;
  price: number;
  vatRate: number;
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  deliveryDate: string;
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  leadTimeDays: number;
  workType: string;
  specifications: UnknownRecord;
  files: unknown[];
  previewImages: unknown[];
}

export interface CustomerPendingOrderDraft extends UnknownRecord {
  customerPoCode: string;
  expectedDeliveryDate: string;
  notes: string;
  items: CustomerPendingOrderItem[];
  links: UnknownRecord;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  preparedAt: string;
  preparedById: string;
  preparedBy: string;
}

export interface CustomerRecord extends UnknownRecord {
  id: string;
  schemaVersion: number;
  customerCode: string;
  companyName: string;
  customerRank: CustomerRank;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  procurementPhone: string;
  warehousePhone: string;
  bankAccount: string;
  assignedSaleId: string;
  sourceLeadId: string;
  convertedAt: string;
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  debtLimit: number;
  paymentTerms: string;
  note: string;
  lastOrderAt: string | null;
  contacts: CustomerContactRecord[];
  products: CustomerProductRecord[];
  documents: CustomerDocumentRecord[];
  files: CustomerFileRecord[];
  contracts: unknown[];
  pendingOrderDraft: CustomerPendingOrderDraft | null;
  deleted: boolean;
  deleteRequested: boolean;
  deleteRequestedAt: string;
  deleteRequestedBy: string;
  createdAt: string;
  createdById: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CustomerSnapshot extends UnknownRecord {
  customerId: string;
  customerCode: string;
  companyName: string;
  customerRank: CustomerRank;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  assignedSaleId: string;
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  debtLimit: number;
  paymentTerms: string;
  capturedAt: string;
}

export const createCustomerSnapshot = (
  customer: CustomerRecord,
  customerRank: CustomerRank = customer.customerRank,
  capturedAt = new Date().toISOString()
): CustomerSnapshot => ({
  customerId: customer.id,
  customerCode: customer.customerCode || '',
  companyName: customer.companyName || '',
  customerRank,
  contactPerson: customer.contactPerson || '',
  phone: customer.phone || '',
  email: customer.email || '',
  address: customer.address || '',
  taxCode: customer.taxCode || '',
  assignedSaleId: customer.assignedSaleId || '',
  discountType: customer.discountType === 'amount' ? 'amount' : 'percent',
  discountRate: Number(customer.discountRate) || 0,
  discountAmount: Number(customer.discountAmount) || 0,
  debtLimit: Number(customer.debtLimit) || 0,
  paymentTerms: customer.paymentTerms || '',
  capturedAt
});

export interface LeadActivityRecord extends UnknownRecord {
  id: string;
  type: string;
  note: string;
  occurredAt: string;
  createdById: string;
}

export interface LeadFileRecord extends UnknownRecord {
  id: string;
  name: string;
  url: string;
  data: string;
}

export interface LeadRecord extends UnknownRecord {
  id: string;
  schemaVersion: number;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  stage: LeadStage;
  companySize: LeadCompanySize;
  source: string;
  province: string;
  address: string;
  taxCode: string;
  potentialValue: number;
  expectedProducts: string;
  assignedSaleId: string;
  assignedSaleName: string;
  discoveredById: string;
  discoveredByName: string;
  sourceCandidateId: string;
  filterValues: Record<string, string[]>;
  profileValues: Record<string, string[]>;
  note: string;
  reminderTime: string;
  nextFollowUpAt: string;
  convertedCustomerId: string;
  convertedAt: string;
  activities: LeadActivityRecord[];
  files: LeadFileRecord[];
  createdAt: string;
  createdById: string;
  updatedAt: string;
  updatedBy: string;
}

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const asRecord = (value: unknown): UnknownRecord => (
  isRecord(value) ? value : {}
);

const asText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
);

const clamp = (value: number, min: number, max: number): number => (
  Math.min(Math.max(value, min), max)
);

export const normalizeCustomerRank = (value: unknown): CustomerRank => {
  const rank = asText(value).toUpperCase();
  return rank === 'A' || rank === 'B' || rank === 'C' || rank === 'D' ? rank : '';
};

export const normalizeDiscountType = (value: unknown): PODiscountType => (
  value === 'amount' ? 'amount' : 'percent'
);

const normalizeContactRole = (value: unknown): CustomerContactRole => {
  const roles: CustomerContactRole[] = ['primary', 'procurement', 'warehouse', 'accounting', 'other'];
  return roles.includes(value as CustomerContactRole) ? value as CustomerContactRole : 'other';
};

const normalizeDocumentCategory = (value: unknown): CustomerDocumentCategory => {
  const categories: CustomerDocumentCategory[] = ['contract', 'acceptance', 'qc', 'qa', 'artwork', 'other'];
  return categories.includes(value as CustomerDocumentCategory)
    ? value as CustomerDocumentCategory
    : 'other';
};

const normalizeLeadStage = (value: unknown): LeadStage => {
  const stages: LeadStage[] = ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost', 'converted'];
  return stages.includes(value as LeadStage) ? value as LeadStage : 'new';
};

const normalizeLeadCompanySize = (value: unknown): LeadCompanySize => {
  const sizes: LeadCompanySize[] = ['', 'large', 'medium', 'small'];
  return sizes.includes(value as LeadCompanySize) ? value as LeadCompanySize : '';
};

export const normalizeCustomerContact = (value: unknown, index = 0): CustomerContactRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id, `contact-${index + 1}`),
    name: asText(source.name),
    role: normalizeContactRole(source.role),
    phone: asText(source.phone),
    email: asText(source.email),
    note: asText(source.note)
  };
};

export const normalizeCustomerDocument = (value: unknown, index = 0): CustomerDocumentRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id, `document-${index + 1}`),
    category: normalizeDocumentCategory(source.category),
    name: asText(source.name),
    url: asText(source.url ?? source.fileUrl),
    poId: asText(source.poId),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById)
  };
};

const normalizeCustomerFile = (value: unknown, index = 0): CustomerFileRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id, `file-${index + 1}`),
    name: asText(source.name ?? source.fileName),
    folder: asText(source.folder),
    url: asText(source.url ?? source.fileUrl),
    data: asText(source.data),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById)
  };
};

export const normalizePendingOrderItem = (value: unknown, index = 0): CustomerPendingOrderItem => {
  const source = asRecord(value);
  return {
    ...source,
    itemId: asText(source.itemId, `draft-item-${index + 1}`),
    productCode: asText(source.productCode).trim(),
    productName: asText(source.productName).trim(),
    productType: asText(source.productType),
    size: asText(source.size),
    material: asText(source.material),
    unit: asText(source.unit, 'cái'),
    quantity: Math.max(0, asNumber(source.quantity)),
    price: Math.max(0, asNumber(source.price ?? source.unitPrice)),
    vatRate: clamp(asNumber(source.vatRate, 8), 0, 100),
    discountType: normalizeDiscountType(source.discountType),
    discountRate: clamp(asNumber(source.discountRate), 0, 100),
    discountAmount: Math.max(0, asNumber(source.discountAmount)),
    deliveryDate: asText(source.deliveryDate),
    supplierId: asText(source.supplierId),
    supplierName: asText(source.supplierName),
    purchasePrice: Math.max(0, asNumber(source.purchasePrice)),
    leadTimeDays: Math.max(0, Math.round(asNumber(source.leadTimeDays))),
    workType: asText(source.workType),
    specifications: asRecord(source.specifications),
    files: asArray(source.files),
    previewImages: asArray(source.previewImages ?? (source.previewImage ? [source.previewImage] : []))
  };
};

const normalizePendingOrderDraft = (value: unknown): CustomerPendingOrderDraft | null => {
  if (!value || typeof value !== 'object') return null;
  const source = asRecord(value);
  return {
    ...source,
    customerPoCode: asText(source.customerPoCode),
    expectedDeliveryDate: asText(source.expectedDeliveryDate),
    notes: asText(source.notes),
    items: asArray(source.items).map(normalizePendingOrderItem),
    links: asRecord(source.links),
    totalAmount: Math.max(0, asNumber(source.totalAmount)),
    discountAmount: Math.max(0, asNumber(source.discountAmount)),
    netAmount: Math.max(0, asNumber(source.netAmount)),
    preparedAt: asText(source.preparedAt),
    preparedById: asText(source.preparedById),
    preparedBy: asText(source.preparedBy)
  };
};

export const normalizeCustomerProduct = (value: unknown, index = 0): CustomerProductRecord => {
  const source = asRecord(value);
  const specifications = asRecord(source.specifications);
  const salePrice = Math.max(0, asNumber(source.salePrice ?? source.currentPrice ?? source.price));

  return {
    ...source,
    id: asText(source.id, `product-${index + 1}`),
    productCode: asText(source.productCode),
    productName: asText(source.productName),
    productType: asText(source.productType),
    size: asText(source.size ?? specifications.size),
    material: asText(source.material),
    unit: asText(source.unit, 'cái'),
    currentPrice: salePrice,
    salePrice,
    vatRate: clamp(asNumber(source.vatRate, 8), 0, 100),
    supplierId: asText(source.supplierId),
    supplierName: asText(source.supplierName),
    purchasePrice: Math.max(0, asNumber(source.purchasePrice)),
    discountType: normalizeDiscountType(source.discountType),
    discountRate: clamp(asNumber(source.discountRate), 0, 100),
    discountAmount: Math.max(0, asNumber(source.discountAmount)),
    leadTimeDays: Math.max(0, Math.round(asNumber(source.leadTimeDays))),
    layoutUrl: asText(source.layoutUrl),
    specifications,
    files: asArray(source.files),
    designLayouts: asArray(source.designLayouts)
  };
};

const buildLegacyContacts = (source: UnknownRecord): CustomerContactRecord[] => {
  const contacts: CustomerContactRecord[] = [];
  const primaryName = asText(source.contactPerson);
  const primaryPhone = asText(source.phone);
  const primaryEmail = asText(source.email);
  const procurementPhone = asText(source.procurementPhone);
  const warehousePhone = asText(source.warehousePhone);

  if (primaryName || primaryPhone || primaryEmail) {
    contacts.push(normalizeCustomerContact({
      id: 'primary',
      name: primaryName,
      role: 'primary',
      phone: primaryPhone,
      email: primaryEmail
    }));
  }

  if (procurementPhone && procurementPhone !== primaryPhone) {
    contacts.push(normalizeCustomerContact({
      id: 'procurement',
      role: 'procurement',
      phone: procurementPhone
    }, contacts.length));
  }

  if (warehousePhone && warehousePhone !== primaryPhone && warehousePhone !== procurementPhone) {
    contacts.push(normalizeCustomerContact({
      id: 'warehouse',
      role: 'warehouse',
      phone: warehousePhone
    }, contacts.length));
  }

  return contacts;
};

export const normalizeCustomerRecord = (value: unknown): CustomerRecord => {
  const source = asRecord(value);
  const existingContacts = asArray(source.contacts);
  const products = asArray(source.products).map(normalizeCustomerProduct);
  const documents = asArray(source.documents).map(normalizeCustomerDocument);
  const id = asText(source.id);

  return {
    ...source,
    id,
    schemaVersion: CRM_SCHEMA_VERSION,
    customerCode: asText(source.customerCode ?? source.code, id),
    companyName: asText(source.companyName ?? source.name),
    customerRank: normalizeCustomerRank(source.customerRank),
    contactPerson: asText(source.contactPerson),
    phone: asText(source.phone),
    email: asText(source.email),
    address: asText(source.address),
    taxCode: asText(source.taxCode),
    procurementPhone: asText(source.procurementPhone),
    warehousePhone: asText(source.warehousePhone),
    bankAccount: asText(source.bankAccount),
    assignedSaleId: asText(source.assignedSaleId),
    sourceLeadId: asText(source.sourceLeadId),
    convertedAt: asText(source.convertedAt),
    discountType: normalizeDiscountType(source.discountType),
    discountRate: clamp(asNumber(source.discountRate), 0, 100),
    discountAmount: Math.max(0, asNumber(source.discountAmount)),
    debtLimit: Math.max(0, asNumber(source.debtLimit)),
    paymentTerms: asText(source.paymentTerms),
    note: asText(source.note),
    lastOrderAt: source.lastOrderAt ? asText(source.lastOrderAt) : null,
    contacts: existingContacts.length > 0
      ? existingContacts.map(normalizeCustomerContact)
      : buildLegacyContacts(source),
    products,
    documents,
    files: asArray(source.files).map(normalizeCustomerFile),
    contracts: asArray(source.contracts),
    pendingOrderDraft: normalizePendingOrderDraft(source.pendingOrderDraft),
    deleted: source.deleted === true,
    deleteRequested: source.deleteRequested === true,
    deleteRequestedAt: asText(source.deleteRequestedAt),
    deleteRequestedBy: asText(source.deleteRequestedBy),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById),
    createdBy: asText(source.createdBy),
    updatedAt: asText(source.updatedAt),
    updatedBy: asText(source.updatedBy)
  };
};

export const normalizeCustomerRecords = (values: unknown): CustomerRecord[] => (
  asArray(values).map(normalizeCustomerRecord)
);

const normalizeLeadActivity = (value: unknown, index = 0): LeadActivityRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id, `activity-${index + 1}`),
    type: asText(source.type, 'note'),
    note: asText(source.note),
    occurredAt: asText(source.occurredAt ?? source.createdAt),
    createdById: asText(source.createdById)
  };
};

const normalizeLeadFile = (value: unknown, index = 0): LeadFileRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id, `lead-file-${index + 1}`),
    name: asText(source.name ?? source.fileName),
    url: asText(source.url ?? source.fileUrl),
    data: asText(source.data)
  };
};

export const normalizeLeadRecord = (value: unknown): LeadRecord => {
  const source = asRecord(value);
  const name = asText(source.companyName ?? source.name);
  const reminderTime = asText(source.reminderTime ?? source.nextFollowUpAt);

  return {
    ...source,
    id: asText(source.id),
    schemaVersion: CRM_SCHEMA_VERSION,
    name,
    companyName: name,
    contactPerson: asText(source.contactPerson, asText(source.name)),
    phone: asText(source.phone),
    email: asText(source.email),
    stage: normalizeLeadStage(source.stage),
    companySize: normalizeLeadCompanySize(source.companySize),
    source: asText(source.source),
    province: asText(source.province),
    address: asText(source.address),
    taxCode: asText(source.taxCode),
    potentialValue: Math.max(0, asNumber(source.potentialValue)),
    expectedProducts: asText(source.expectedProducts),
    assignedSaleId: asText(source.assignedSaleId),
    assignedSaleName: asText(source.assignedSaleName),
    discoveredById: asText(source.discoveredById, asText(source.createdById)),
    discoveredByName: asText(source.discoveredByName, asText(source.createdByName)),
    sourceCandidateId: asText(source.sourceCandidateId),
    filterValues: Object.fromEntries(
      Object.entries(asRecord(source.filterValues)).map(([fieldId, fieldValue]) => [
        fieldId,
        asArray(fieldValue).map(item => asText(item)).filter(Boolean)
      ])
    ),
    profileValues: Object.fromEntries(
      Object.entries(asRecord(source.profileValues)).map(([fieldId, fieldValue]) => [
        fieldId,
        asArray(fieldValue).map(item => asText(item)).filter(Boolean)
      ])
    ),
    note: asText(source.note),
    reminderTime,
    nextFollowUpAt: reminderTime,
    convertedCustomerId: asText(source.convertedCustomerId),
    convertedAt: asText(source.convertedAt),
    activities: asArray(source.activities).map(normalizeLeadActivity),
    files: asArray(source.files).map(normalizeLeadFile),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById),
    updatedAt: asText(source.updatedAt),
    updatedBy: asText(source.updatedBy)
  };
};

export const normalizeLeadRecords = (values: unknown): LeadRecord[] => (
  asArray(values).map(normalizeLeadRecord)
);
