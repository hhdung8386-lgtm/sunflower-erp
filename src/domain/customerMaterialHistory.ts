type UnknownRecord = Record<string, unknown>;

export interface CustomerMaterialUsage {
  key: string;
  materialName: string;
  orderCount: number;
  productCodes: string[];
  specifications: string[];
  lastUsedAt: string;
  lastPoCode: string;
}

export interface CustomerOrderedSample {
  key: string;
  productCode: string;
  productName: string;
  material: string;
  specification: string;
  unit: string;
  totalQuantity: number;
  orderCount: number;
  lastOrderedAt: string;
  lastPoId: string;
  lastPoCode: string;
  previewImage: string;
}

interface MutableMaterialUsage {
  key: string;
  materialName: string;
  orderIds: Set<string>;
  productCodes: Set<string>;
  specifications: Set<string>;
  lastUsedAt: string;
  lastUsedTimestamp: number;
  lastPoCode: string;
}

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
);

const asText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeMaterialKey = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/đ/g, 'd')
  .replace(/\s+/g, ' ')
  .trim();

const getOrderTimestamp = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getSampleKey = (item: UnknownRecord): string => {
  const productCode = asText(item.productCode);
  if (productCode) return `code:${normalizeMaterialKey(productCode)}`;
  return `sample:${normalizeMaterialKey([
    asText(item.productName),
    asText(item.size),
    asText(item.material)
  ].filter(Boolean).join('|'))}`;
};

export const buildCustomerMaterialHistory = (
  orders: unknown[]
): Record<string, CustomerMaterialUsage[]> => {
  const historyByCustomer = new Map<string, Map<string, MutableMaterialUsage>>();

  orders.forEach((orderValue, orderIndex) => {
    const order = asRecord(orderValue);
    if (order.deleted === true) return;

    const customerId = asText(order.customerId) || asText(asRecord(order.customerSnapshot).customerId);
    if (!customerId) return;

    const orderId = asText(order.id) || asText(order.poCode) || `order-${orderIndex + 1}`;
    const orderDate = asText(order.orderDate) || asText(order.createdAt);
    const orderTimestamp = getOrderTimestamp(orderDate);
    const poCode = asText(order.poCode) || asText(order.customerPoCode);
    const customerHistory = historyByCustomer.get(customerId) || new Map<string, MutableMaterialUsage>();

    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach(itemValue => {
      const item = asRecord(itemValue);
      const itemSpecifications = asRecord(item.specifications);
      const materialName = asText(item.material)
        || asText(item.materialName)
        || asText(itemSpecifications.material);
      const key = normalizeMaterialKey(materialName);
      if (!key) return;

      const usage = customerHistory.get(key) || {
        key,
        materialName,
        orderIds: new Set<string>(),
        productCodes: new Set<string>(),
        specifications: new Set<string>(),
        lastUsedAt: '',
        lastUsedTimestamp: 0,
        lastPoCode: ''
      };

      usage.orderIds.add(orderId);
      const productCode = asText(item.productCode);
      const specification = asText(item.size);
      if (productCode) usage.productCodes.add(productCode);
      if (specification) usage.specifications.add(specification);
      if (orderTimestamp >= usage.lastUsedTimestamp) {
        usage.lastUsedAt = orderDate;
        usage.lastUsedTimestamp = orderTimestamp;
        usage.lastPoCode = poCode;
      }

      customerHistory.set(key, usage);
    });

    historyByCustomer.set(customerId, customerHistory);
  });

  return Object.fromEntries(
    Array.from(historyByCustomer.entries()).map(([customerId, materials]) => [
      customerId,
      Array.from(materials.values())
        .sort((left, right) => (
          right.lastUsedTimestamp - left.lastUsedTimestamp
          || left.materialName.localeCompare(right.materialName, 'vi-VN')
        ))
        .map(material => ({
          key: material.key,
          materialName: material.materialName,
          orderCount: material.orderIds.size,
          productCodes: Array.from(material.productCodes).sort((left, right) => left.localeCompare(right, 'vi-VN')),
          specifications: Array.from(material.specifications).sort((left, right) => left.localeCompare(right, 'vi-VN')),
          lastUsedAt: material.lastUsedAt,
          lastPoCode: material.lastPoCode
        }))
    ])
  );
};

export const buildCustomerOrderedSampleHistory = (
  orders: unknown[]
): Record<string, CustomerOrderedSample[]> => {
  const samplesByCustomer = new Map<string, Map<string, CustomerOrderedSample & {
    orderIds: Set<string>;
    lastOrderedTimestamp: number;
  }>>();

  orders.forEach((orderValue, orderIndex) => {
    const order = asRecord(orderValue);
    if (order.deleted === true) return;

    const customerId = asText(order.customerId) || asText(asRecord(order.customerSnapshot).customerId);
    if (!customerId) return;

    const orderId = asText(order.id) || asText(order.poCode) || `order-${orderIndex + 1}`;
    const orderDate = asText(order.orderDate) || asText(order.createdAt);
    const orderTimestamp = getOrderTimestamp(orderDate);
    const poCode = asText(order.poCode) || asText(order.customerPoCode);
    const customerSamples = samplesByCustomer.get(customerId) || new Map();

    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach(itemValue => {
      const item = asRecord(itemValue);
      const key = getSampleKey(item);
      if (!key || key === 'sample:') return;

      const previewImages = Array.isArray(item.previewImages) ? item.previewImages : [];
      const previewImage = asText(previewImages[0]) || asText(item.previewImage);
      const existing = customerSamples.get(key);
      const sample = existing || {
        key,
        productCode: asText(item.productCode),
        productName: asText(item.productName) || 'Chưa đặt tên',
        material: asText(item.material) || asText(asRecord(item.specifications).material),
        specification: asText(item.size),
        unit: asText(item.unit) || 'cái',
        totalQuantity: 0,
        orderCount: 0,
        lastOrderedAt: '',
        lastPoId: '',
        lastPoCode: '',
        previewImage: '',
        orderIds: new Set<string>(),
        lastOrderedTimestamp: 0
      };

      sample.totalQuantity += Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
      sample.orderIds.add(orderId);
      sample.orderCount = sample.orderIds.size;
      if (orderTimestamp >= sample.lastOrderedTimestamp) {
        sample.productCode = asText(item.productCode) || sample.productCode;
        sample.productName = asText(item.productName) || sample.productName;
        sample.material = asText(item.material) || asText(asRecord(item.specifications).material) || sample.material;
        sample.specification = asText(item.size) || sample.specification;
        sample.unit = asText(item.unit) || sample.unit;
        sample.lastOrderedAt = orderDate;
        sample.lastPoId = asText(order.id);
        sample.lastPoCode = poCode;
        sample.previewImage = previewImage || sample.previewImage;
        sample.lastOrderedTimestamp = orderTimestamp;
      }

      customerSamples.set(key, sample);
    });

    samplesByCustomer.set(customerId, customerSamples);
  });

  return Object.fromEntries(
    Array.from(samplesByCustomer.entries()).map(([customerId, samples]) => [
      customerId,
      Array.from(samples.values())
        .sort((left, right) => (
          right.lastOrderedTimestamp - left.lastOrderedTimestamp
          || left.productName.localeCompare(right.productName, 'vi-VN')
        ))
        .map(({ orderIds: _orderIds, lastOrderedTimestamp: _lastOrderedTimestamp, ...sample }) => sample)
    ])
  );
};
