export type PODiscountType = 'percent' | 'amount';

export interface POItemFinancials {
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  amountBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  amountWithVat: number;
  kpiPo: number;
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(Math.max(value, min), max)
);

export const getPODiscountType = (item: Record<string, unknown>): PODiscountType => (
  item.discountType === 'amount' ? 'amount' : 'percent'
);

export const calculatePOItemFinancials = (item: Record<string, unknown>): POItemFinancials => {
  const quantity = Math.max(0, toFiniteNumber(item.quantity));
  const unitPrice = Math.max(0, toFiniteNumber(item.price ?? item.unitPrice));
  const grossAmount = quantity * unitPrice;
  const discountType = getPODiscountType(item);
  const discountRate = clamp(toFiniteNumber(item.discountRate), 0, 100);
  const requestedDiscountAmount = discountType === 'amount'
    ? Math.max(0, toFiniteNumber(item.discountAmount))
    : grossAmount * (discountRate / 100);
  const discountAmount = clamp(requestedDiscountAmount, 0, grossAmount);
  const amountBeforeVat = grossAmount - discountAmount;
  const vatRate = clamp(
    item.vatRate === undefined || item.vatRate === null || item.vatRate === ''
      ? 8
      : toFiniteNumber(item.vatRate),
    0,
    100
  );
  const vatAmount = amountBeforeVat * (vatRate / 100);
  const amountWithVat = amountBeforeVat + vatAmount;

  // KPI PO represents the percentage of the original order value retained
  // after the selected commercial discount (100% means no discount).
  const kpiPo = grossAmount > 0 ? (amountBeforeVat / grossAmount) * 100 : 0;

  return {
    quantity,
    unitPrice,
    grossAmount,
    discountType,
    discountRate,
    discountAmount,
    amountBeforeVat,
    vatRate,
    vatAmount,
    amountWithVat,
    kpiPo
  };
};

export const withCalculatedPOFinancials = <T extends Record<string, unknown>>(item: T): T & {
  discountType: PODiscountType;
  discountRate: number;
  discountAmount: number;
  kpiPo: number;
} => {
  const financials = calculatePOItemFinancials(item);
  return {
    ...item,
    discountType: financials.discountType,
    discountRate: financials.discountRate,
    discountAmount: Math.round(financials.discountAmount),
    kpiPo: Number(financials.kpiPo.toFixed(2))
  };
};
