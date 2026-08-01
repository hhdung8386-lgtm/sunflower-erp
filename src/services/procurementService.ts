import {
  getProcurementRequestCode,
  getProcurementRequestId,
  normalizeProcurementRequests,
  type ProcurementRequestRecord,
  type SourcingType
} from '../domain/purchaseModels';
import { isPOCompleted } from '../domain/poWorkflow';
import { dbService, type UserProfile } from './firebaseService';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
);
const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const asNumber = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

const getSourcingType = (item: UnknownRecord): SourcingType => {
  const value = asText(item.sourcingType ?? item.workType);
  if (value === 'finished_good' || value === 'mua_thanh_pham') return 'finished_good';
  if (value === 'raw_material' || value === 'mua_nvl') return 'raw_material';
  return 'subcontract';
};

export const synchronizeProcurementRequestsForPO = async (
  poValue: unknown,
  actor: Pick<UserProfile, 'uid' | 'displayName'>
): Promise<ProcurementRequestRecord[]> => {
  const po = asRecord(poValue);
  const poId = asText(po.id);
  if (!poId || po.deleted === true || isPOCompleted(po)) return [];

  const poCode = asText(po.poCode) || poId;
  const items = Array.isArray(po.items) ? po.items.map(asRecord) : [];
  const existing = normalizeProcurementRequests(await dbService.getCollection('procurement_requests'));
  const existingForPO = existing.filter(request => request.poId === poId);
  const activeRequestIds = new Set<string>();
  const synchronized: ProcurementRequestRecord[] = [];
  const now = new Date().toISOString();

  for (const [itemIndex, item] of items.entries()) {
    const itemId = asText(item.itemId) || `item-${itemIndex + 1}`;
    const requestId = getProcurementRequestId(poId, itemId, itemIndex);
    activeRequestIds.add(requestId);
    const current = existing.find(request => request.id === requestId);
    const snapshot = {
      requestCode: getProcurementRequestCode(poCode, itemIndex),
      poId,
      poCode,
      poItemId: itemId,
      poItemIndex: itemIndex,
      customerId: asText(po.customerId),
      customerName: asText(po.customerName),
      saleId: asText(po.saleId ?? po.createdById),
      productCode: asText(item.productCode),
      productName: asText(item.productName) || asText(item.name) || `Mặt hàng ${itemIndex + 1}`,
      material: asText(item.material),
      size: asText(item.size),
      specifications: asRecord(item.specifications),
      quantity: asNumber(item.quantity),
      unit: asText(item.unit) || 'cái',
      requiredDate: asText(item.deliveryDate ?? po.expectedDeliveryDate),
      sourcingType: current?.sourcingType || getSourcingType(item),
      updatedBy: actor.displayName
    };

    if (current) {
      await dbService.updateDocument('procurement_requests', requestId, snapshot);
      synchronized.push({ ...current, ...snapshot, updatedAt: now });
    } else {
      const created = await dbService.addDocument('procurement_requests', {
        id: requestId,
        ...snapshot,
        status: 'new',
        assignedPurchaserId: '',
        assignedPurchaserName: '',
        selectedSupplierId: '',
        selectedSupplierName: '',
        selectedUnitPrice: 0,
        purchaseOrderId: '',
        purchaseOrderCode: '',
        createdAt: now,
        createdById: actor.uid,
        createdByName: actor.displayName,
        deleted: false
      });
      synchronized.push(created as ProcurementRequestRecord);
    }
  }

  await Promise.all(existingForPO
    .filter(request => !activeRequestIds.has(request.id) && !['ordered', 'received'].includes(request.status))
    .map(request => dbService.updateDocument('procurement_requests', request.id, {
      status: 'cancelled',
      deleted: true,
      updatedBy: actor.displayName
    })));

  return synchronized;
};

export const backfillProcurementRequests = async (
  pos: unknown[],
  actor: Pick<UserProfile, 'uid' | 'displayName'>
): Promise<void> => {
  for (const po of pos) {
    await synchronizeProcurementRequestsForPO(po, actor);
  }
};
