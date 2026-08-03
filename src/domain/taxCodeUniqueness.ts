import type { CustomerRecord, LeadRecord } from './crmModels';

export type TaxCodeConflictRecord = {
  id: string;
  recordType: 'lead' | 'customer';
  companyName: string;
  assignedSaleId: string;
  assignedSaleName: string;
};

export const normalizeTaxCode = (value: unknown): string => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace(/[^0-9A-Z]/g, '');

export const createLeadDocumentIdFromTaxCode = (taxCode: string): string => (
  `lead-mst-${normalizeTaxCode(taxCode)}`
);

export const findTaxCodeConflict = (
  taxCode: string,
  leads: LeadRecord[],
  customers: CustomerRecord[],
  excludedLeadId = '',
  excludedCustomerId = ''
): TaxCodeConflictRecord | null => {
  const normalizedTaxCode = normalizeTaxCode(taxCode);
  if (!normalizedTaxCode) return null;

  const duplicateLead = leads.find(lead => (
    lead.id !== excludedLeadId
    && normalizeTaxCode(lead.taxCode) === normalizedTaxCode
  ));
  if (duplicateLead) {
    return {
      id: duplicateLead.id,
      recordType: 'lead',
      companyName: duplicateLead.companyName,
      assignedSaleId: duplicateLead.assignedSaleId,
      assignedSaleName: duplicateLead.assignedSaleName
    };
  }

  const duplicateCustomer = customers.find(customer => (
    customer.id !== excludedCustomerId
    &&
    normalizeTaxCode(customer.taxCode) === normalizedTaxCode
  ));
  if (!duplicateCustomer) return null;

  return {
    id: duplicateCustomer.id,
    recordType: 'customer',
    companyName: duplicateCustomer.companyName,
    assignedSaleId: duplicateCustomer.assignedSaleId,
    assignedSaleName: ''
  };
};
