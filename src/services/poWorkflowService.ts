import { dbService } from './firebaseService';

interface ReceivablePOLike {
  id: string;
  poCode: string;
  customerId?: string;
  customerName?: string;
  netAmount?: number;
  totalAmount?: number;
}

interface ExistingInvoiceLike {
  poId?: string;
  type?: string;
  deleted?: boolean;
}

export const ensureReceivableInvoice = async (po: ReceivablePOLike, createdBy: string): Promise<void> => {
  const invoices = await dbService.getCollection('invoices') as ExistingInvoiceLike[];
  const alreadyExists = invoices.some(invoice => (
    invoice.poId === po.id && invoice.type === 'receivable' && !invoice.deleted
  ));
  if (alreadyExists) return;

  await dbService.addDocument('invoices', {
    invoiceCode: `INV-${po.poCode.replace('PO-', '')}`,
    poId: po.id,
    poCode: po.poCode,
    customerId: po.customerId || '',
    companyName: po.customerName || '',
    type: 'receivable',
    amount: po.netAmount || po.totalAmount || 0,
    paidAmount: 0,
    status: 'unpaid',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy,
    createdAt: new Date().toISOString()
  });
};
