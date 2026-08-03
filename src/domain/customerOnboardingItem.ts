import type { CustomerPendingOrderItem } from './crmModels';
import type { PODiscountType } from './poFinancials';

export const createCustomerOnboardingItem = (
  index: number,
  deliveryDate: string,
  discountType: PODiscountType,
  discountRate: number,
  discountAmount: number
): CustomerPendingOrderItem => ({
  itemId: `draft-item-${Date.now()}-${index}`,
  productCode: '',
  productName: '',
  productType: 'tem_trang_cuon',
  size: '',
  material: '',
  unit: 'cái',
  quantity: 1000,
  price: 0,
  vatRate: 8,
  discountType,
  discountRate,
  discountAmount,
  deliveryDate,
  supplierId: '',
  supplierName: '',
  purchasePrice: 0,
  leadTimeDays: 0,
  workType: 'gia_cong',
  specifications: {},
  files: [],
  previewImages: []
});
