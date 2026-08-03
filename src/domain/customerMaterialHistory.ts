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
