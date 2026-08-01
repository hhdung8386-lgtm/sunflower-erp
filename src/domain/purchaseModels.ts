export type SourcingType = 'finished_good' | 'raw_material' | 'subcontract';

export type ProcurementStatus =
  | 'new'
  | 'reviewing'
  | 'quoting'
  | 'supplier_selected'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

type UnknownRecord = Record<string, unknown>;

export interface SupplierContactRecord extends UnknownRecord {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  primary: boolean;
}

export interface SupplierDocumentRecord extends UnknownRecord {
  id: string;
  name: string;
  category: string;
  data: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SupplierActivityRecord extends UnknownRecord {
  id: string;
  type: string;
  note: string;
  occurredAt: string;
  createdById: string;
  createdByName: string;
}

export interface SupplierRecord extends UnknownRecord {
  id: string;
  supplierCode: string;
  supplierName: string;
  taxCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  province: string;
  categories: string[];
  serviceTypes: SourcingType[];
  paymentTerms: string;
  bankName: string;
  bankAccount: string;
  status: 'active' | 'inactive' | 'blocked';
  rating: number;
  assignedPurchaserId: string;
  assignedPurchaserName: string;
  note: string;
  contacts: SupplierContactRecord[];
  documents: SupplierDocumentRecord[];
  activities: SupplierActivityRecord[];
  contracts: UnknownRecord[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deleted: boolean;
}

export interface ProcurementRequestRecord extends UnknownRecord {
  id: string;
  requestCode: string;
  poId: string;
  poCode: string;
  poItemId: string;
  poItemIndex: number;
  customerId: string;
  customerName: string;
  saleId: string;
  productCode: string;
  productName: string;
  material: string;
  size: string;
  specifications: UnknownRecord;
  quantity: number;
  unit: string;
  requiredDate: string;
  sourcingType: SourcingType;
  status: ProcurementStatus;
  assignedPurchaserId: string;
  assignedPurchaserName: string;
  selectedSupplierId: string;
  selectedSupplierName: string;
  selectedUnitPrice: number;
  purchaseOrderId: string;
  purchaseOrderCode: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  deleted: boolean;
}

export interface SupplierRecommendation {
  supplier: SupplierRecord;
  score: number;
  orderCount: number;
  matchingOrderCount: number;
  lastUnitPrice: number;
  averageUnitPrice: number;
  onTimeRate: number | null;
  lastOrderedAt: string;
  reasons: string[];
}

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
);

const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const asNumber = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asBoolean = (value: unknown): boolean => value === true;

const normalizeSourcingType = (value: unknown): SourcingType => {
  if (value === 'finished_good' || value === 'raw_material' || value === 'subcontract') return value;
  if (value === 'mua_nvl') return 'raw_material';
  if (value === 'mua_thanh_pham') return 'finished_good';
  return 'subcontract';
};

const normalizeProcurementStatus = (value: unknown): ProcurementStatus => {
  const statuses: ProcurementStatus[] = [
    'new', 'reviewing', 'quoting', 'supplier_selected', 'ordered',
    'partially_received', 'received', 'cancelled'
  ];
  return statuses.includes(value as ProcurementStatus) ? value as ProcurementStatus : 'new';
};

export const getSourcingTypeLabel = (value: SourcingType): string => ({
  finished_good: 'Mua thành phẩm',
  raw_material: 'Mua nguyên vật liệu',
  subcontract: 'Thuê NCC gia công'
}[value]);

export const getProcurementStatusLabel = (value: ProcurementStatus): string => ({
  new: 'Mới từ Sale',
  reviewing: 'Đang phân tích',
  quoting: 'Đang lấy báo giá',
  supplier_selected: 'Đã chọn NCC',
  ordered: 'Đã đặt hàng',
  partially_received: 'Nhận một phần',
  received: 'Đã nhận hàng',
  cancelled: 'Đã hủy'
}[value]);

export const getProcurementRequestId = (poId: string, itemId: string, itemIndex: number): string => (
  `procurement-${poId}-${itemId || itemIndex}`
);

export const getProcurementRequestCode = (poCode: string, itemIndex: number): string => (
  `MH-${poCode.replace(/^PO-/, '')}-${String(itemIndex + 1).padStart(2, '0')}`
);

export const normalizeSupplierRecord = (value: unknown): SupplierRecord => {
  const source = asRecord(value);
  const contactPerson = asText(source.contactPerson);
  const phone = asText(source.phone);
  const email = asText(source.email);
  const contacts = asArray(source.contacts).map((contactValue, index) => {
    const contact = asRecord(contactValue);
    return {
      ...contact,
      id: asText(contact.id) || `supplier-contact-${index + 1}`,
      name: asText(contact.name ?? contact.contactPerson),
      role: asText(contact.role),
      phone: asText(contact.phone),
      email: asText(contact.email),
      primary: contact.primary === true
    } as SupplierContactRecord;
  });
  if (contacts.length === 0 && (contactPerson || phone || email)) {
    contacts.push({
      id: 'supplier-contact-primary',
      name: contactPerson,
      role: 'Liên hệ chính',
      phone,
      email,
      primary: true
    });
  }

  return {
    ...source,
    id: asText(source.id),
    supplierCode: asText(source.supplierCode),
    supplierName: asText(source.supplierName ?? source.companyName ?? source.name),
    taxCode: asText(source.taxCode),
    contactPerson,
    phone,
    email,
    address: asText(source.address),
    province: asText(source.province),
    categories: asArray(source.categories).map(asText).filter(Boolean),
    serviceTypes: asArray(source.serviceTypes).map(normalizeSourcingType),
    paymentTerms: asText(source.paymentTerms),
    bankName: asText(source.bankName),
    bankAccount: asText(source.bankAccount),
    status: source.status === 'inactive' || source.status === 'blocked' ? source.status : 'active',
    rating: asNumber(source.rating),
    assignedPurchaserId: asText(source.assignedPurchaserId),
    assignedPurchaserName: asText(source.assignedPurchaserName),
    note: asText(source.note),
    contacts,
    documents: asArray(source.documents).map((documentValue, index) => {
      const document = asRecord(documentValue);
      return {
        ...document,
        id: asText(document.id) || `supplier-document-${index + 1}`,
        name: asText(document.name),
        category: asText(document.category) || 'other',
        data: asText(document.data ?? document.fileUrl),
        uploadedAt: asText(document.uploadedAt ?? document.createdAt),
        uploadedBy: asText(document.uploadedBy)
      } as SupplierDocumentRecord;
    }),
    activities: asArray(source.activities).map((activityValue, index) => {
      const activity = asRecord(activityValue);
      return {
        ...activity,
        id: asText(activity.id) || `supplier-activity-${index + 1}`,
        type: asText(activity.type) || 'note',
        note: asText(activity.note),
        occurredAt: asText(activity.occurredAt ?? activity.createdAt),
        createdById: asText(activity.createdById),
        createdByName: asText(activity.createdByName)
      } as SupplierActivityRecord;
    }),
    contracts: asArray(source.contracts).map(asRecord),
    createdAt: asText(source.createdAt),
    createdBy: asText(source.createdBy),
    updatedAt: asText(source.updatedAt),
    updatedBy: asText(source.updatedBy),
    deleted: asBoolean(source.deleted)
  };
};

export const normalizeSupplierRecords = (values: unknown): SupplierRecord[] => (
  asArray(values).map(normalizeSupplierRecord)
);

export const normalizeProcurementRequest = (value: unknown): ProcurementRequestRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id),
    requestCode: asText(source.requestCode),
    poId: asText(source.poId),
    poCode: asText(source.poCode),
    poItemId: asText(source.poItemId),
    poItemIndex: asNumber(source.poItemIndex),
    customerId: asText(source.customerId),
    customerName: asText(source.customerName),
    saleId: asText(source.saleId),
    productCode: asText(source.productCode),
    productName: asText(source.productName),
    material: asText(source.material),
    size: asText(source.size),
    specifications: asRecord(source.specifications),
    quantity: asNumber(source.quantity),
    unit: asText(source.unit),
    requiredDate: asText(source.requiredDate),
    sourcingType: normalizeSourcingType(source.sourcingType ?? source.workType),
    status: normalizeProcurementStatus(source.status),
    assignedPurchaserId: asText(source.assignedPurchaserId),
    assignedPurchaserName: asText(source.assignedPurchaserName),
    selectedSupplierId: asText(source.selectedSupplierId),
    selectedSupplierName: asText(source.selectedSupplierName),
    selectedUnitPrice: asNumber(source.selectedUnitPrice),
    purchaseOrderId: asText(source.purchaseOrderId),
    purchaseOrderCode: asText(source.purchaseOrderCode),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById),
    createdByName: asText(source.createdByName),
    updatedAt: asText(source.updatedAt),
    updatedBy: asText(source.updatedBy),
    deleted: asBoolean(source.deleted)
  };
};

export const normalizeProcurementRequests = (values: unknown): ProcurementRequestRecord[] => (
  asArray(values).map(normalizeProcurementRequest)
);

const normalizeSearchText = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/đ/g, 'd');

const tokenize = (values: unknown[]): string[] => Array.from(new Set(
  normalizeSearchText(values.filter(Boolean).join(' '))
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 2)
));

export const buildSupplierRecommendations = (
  request: ProcurementRequestRecord,
  suppliers: SupplierRecord[],
  purchaseOrders: UnknownRecord[]
): SupplierRecommendation[] => {
  const requestTokens = tokenize([
    request.productCode,
    request.productName,
    request.material,
    request.size,
    Object.values(request.specifications || {})
  ]);

  const candidates = suppliers
    .filter(supplier => !supplier.deleted)
    .map(supplier => {
      const orders = purchaseOrders.filter(order => (
        asText(order.supplierId) === supplier.id && !asBoolean(order.deleted)
      ));
      const matchingItems = orders.flatMap(order => {
        const createdAt = asText(order.createdAt);
        return asArray(order.items).map(itemValue => {
          const item = asRecord(itemValue);
          const itemTokens = tokenize([
            item.productCode,
            item.productName,
            item.materialName,
            item.material,
            item.size
          ]);
          const overlap = requestTokens.filter(token => itemTokens.includes(token)).length;
          return { item, createdAt, overlap };
        });
      }).filter(entry => entry.overlap > 0);

      const priceEntries = matchingItems
        .map(entry => ({ price: asNumber(entry.item.unitPrice), createdAt: entry.createdAt }))
        .filter(entry => entry.price > 0)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const deliveries = orders.filter(order => asText(order.actualReceiveDate) && asText(order.expectedReceiveDate));
      const onTimeCount = deliveries.filter(order => (
        Date.parse(asText(order.actualReceiveDate)) <= Date.parse(asText(order.expectedReceiveDate))
      )).length;
      const onTimeRate = deliveries.length > 0 ? onTimeCount / deliveries.length : null;
      const lastOrderedAt = orders.map(order => asText(order.createdAt)).filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || '';
      const categoryText = normalizeSearchText([...supplier.categories, supplier.supplierName].join(' '));
      const categoryMatches = requestTokens.filter(token => categoryText.includes(token)).length;

      const matchScore = Math.min(35, matchingItems.length * 8 + categoryMatches * 5);
      const historyScore = Math.min(15, orders.length * 2.5);
      const deliveryScore = onTimeRate === null ? 5 : onTimeRate * 15;
      const recencyDays = lastOrderedAt ? (Date.now() - Date.parse(lastOrderedAt)) / 86_400_000 : Number.POSITIVE_INFINITY;
      const recencyScore = recencyDays <= 90 ? 10 : recencyDays <= 365 ? 6 : orders.length > 0 ? 2 : 0;
      const ratingScore = Math.min(10, Math.max(0, supplier.rating * 2));
      const score = Math.round(matchScore + historyScore + deliveryScore + recencyScore + ratingScore);

      const reasons: string[] = [];
      if (matchingItems.length > 0) reasons.push(`Đã cung cấp ${matchingItems.length} lần mặt hàng tương tự`);
      if (priceEntries[0]) reasons.push(`Giá gần nhất ${priceEntries[0].price.toLocaleString('vi-VN')} đ/${request.unit || 'đơn vị'}`);
      if (onTimeRate !== null) reasons.push(`Giao đúng hạn ${Math.round(onTimeRate * 100)}%`);
      if (orders.length > 0) reasons.push(`Tổng ${orders.length} đơn mua trong lịch sử`);
      if (reasons.length === 0) reasons.push('Chưa đủ dữ liệu lịch sử; cần lấy báo giá để đánh giá');

      return {
        supplier,
        score,
        orderCount: orders.length,
        matchingOrderCount: matchingItems.length,
        lastUnitPrice: priceEntries[0]?.price || 0,
        averageUnitPrice: priceEntries.length > 0
          ? priceEntries.reduce((sum, entry) => sum + entry.price, 0) / priceEntries.length
          : 0,
        onTimeRate,
        lastOrderedAt,
        reasons
      };
    });

  const pricedCandidates = candidates.filter(candidate => candidate.lastUnitPrice > 0);
  const lowestPrice = pricedCandidates.length > 0
    ? Math.min(...pricedCandidates.map(candidate => candidate.lastUnitPrice))
    : 0;

  return candidates
    .map(candidate => ({
      ...candidate,
      score: Math.min(100, candidate.score + (
        lowestPrice > 0 && candidate.lastUnitPrice > 0
          ? Math.round((lowestPrice / candidate.lastUnitPrice) * 15)
          : 0
      ))
    }))
    .sort((a, b) => b.score - a.score || b.matchingOrderCount - a.matchingOrderCount)
    .slice(0, 3);
};
