import type { CustomerRecord, LeadRecord } from './crmModels';
import { normalizeTaxCode } from './taxCodeUniqueness';

export const LEAD_CANDIDATE_SCHEMA_VERSION = 2;

export type LeadCandidateStatus = 'new' | 'retry' | 'disqualified' | 'converted';
export type LeadCandidateContactOutcome =
  | 'connected'
  | 'no_answer'
  | 'busy'
  | 'wrong_number'
  | 'call_back'
  | 'not_interested'
  | 'potential';

export interface LeadCandidateContactLog {
  id: string;
  occurredAt: string;
  outcome: LeadCandidateContactOutcome;
  note: string;
  nextContactAt: string;
  createdById: string;
  createdByName: string;
}

export interface LeadCandidateRecord extends Record<string, unknown> {
  id: string;
  schemaVersion: number;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxCode: string;
  address: string;
  website: string;
  source: string;
  sourceUrl: string;
  note: string;
  status: LeadCandidateStatus;
  assignedSaleId: string;
  assignedSaleName: string;
  discoveredById: string;
  discoveredByName: string;
  contactAttempts: number;
  lastContactAt: string;
  lastContactOutcome: LeadCandidateContactOutcome | '';
  lastContactNote: string;
  contactLogs: LeadCandidateContactLog[];
  nextContactAt: string;
  pinned: boolean;
  convertedLeadId: string;
  convertedAt: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
}

export type CandidateDuplicate = {
  id: string;
  recordType: 'candidate' | 'lead' | 'customer';
  companyName: string;
  reason: 'taxCode' | 'phone' | 'companyName';
};

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const asText = (value: unknown): string => typeof value === 'string' ? value : '';

const asNonNegativeInteger = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

const normalizeStatus = (value: unknown): LeadCandidateStatus => {
  const statuses: LeadCandidateStatus[] = ['new', 'retry', 'disqualified', 'converted'];
  return statuses.includes(value as LeadCandidateStatus) ? value as LeadCandidateStatus : 'new';
};

const normalizeContactOutcome = (value: unknown): LeadCandidateContactOutcome | '' => {
  const outcomes: LeadCandidateContactOutcome[] = [
    'connected',
    'no_answer',
    'busy',
    'wrong_number',
    'call_back',
    'not_interested',
    'potential'
  ];
  return outcomes.includes(value as LeadCandidateContactOutcome)
    ? value as LeadCandidateContactOutcome
    : '';
};

const normalizeContactLogs = (value: unknown): LeadCandidateContactLog[] => (
  Array.isArray(value)
    ? value.slice(0, 50).map(item => {
      const log = asRecord(item);
      return {
        id: asText(log.id),
        occurredAt: asText(log.occurredAt),
        outcome: normalizeContactOutcome(log.outcome) || 'connected',
        note: asText(log.note),
        nextContactAt: asText(log.nextContactAt),
        createdById: asText(log.createdById),
        createdByName: asText(log.createdByName)
      };
    })
    : []
);

export const normalizeLeadCandidateRecord = (value: unknown): LeadCandidateRecord => {
  const source = asRecord(value);
  return {
    ...source,
    id: asText(source.id),
    schemaVersion: LEAD_CANDIDATE_SCHEMA_VERSION,
    companyName: asText(source.companyName ?? source.name),
    contactPerson: asText(source.contactPerson),
    phone: asText(source.phone),
    email: asText(source.email),
    taxCode: normalizeTaxCode(source.taxCode),
    address: asText(source.address),
    website: asText(source.website),
    source: asText(source.source),
    sourceUrl: asText(source.sourceUrl),
    note: asText(source.note),
    status: normalizeStatus(source.status),
    assignedSaleId: asText(source.assignedSaleId),
    assignedSaleName: asText(source.assignedSaleName),
    discoveredById: asText(source.discoveredById ?? source.createdById),
    discoveredByName: asText(source.discoveredByName ?? source.createdByName),
    contactAttempts: asNonNegativeInteger(source.contactAttempts),
    lastContactAt: asText(source.lastContactAt),
    lastContactOutcome: normalizeContactOutcome(source.lastContactOutcome),
    lastContactNote: asText(source.lastContactNote),
    contactLogs: normalizeContactLogs(source.contactLogs),
    nextContactAt: asText(source.nextContactAt),
    pinned: source.pinned === true,
    convertedLeadId: asText(source.convertedLeadId),
    convertedAt: asText(source.convertedAt),
    createdAt: asText(source.createdAt),
    createdById: asText(source.createdById),
    createdByName: asText(source.createdByName),
    updatedAt: asText(source.updatedAt),
    updatedBy: asText(source.updatedBy)
  };
};

export const normalizeLeadCandidateRecords = (values: unknown): LeadCandidateRecord[] => (
  Array.isArray(values) ? values.map(normalizeLeadCandidateRecord) : []
);

export const createCandidateDocumentIdFromTaxCode = (taxCode: string): string => (
  `candidate-mst-${normalizeTaxCode(taxCode)}`
);

const normalizeCompanyName = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi-VN')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]/g, '');

const normalizePhone = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

export const findCandidateDuplicate = (
  candidate: Pick<LeadCandidateRecord, 'companyName' | 'phone' | 'taxCode'>,
  candidates: LeadCandidateRecord[],
  leads: LeadRecord[],
  customers: CustomerRecord[],
  excludedCandidateId = ''
): CandidateDuplicate | null => {
  const taxCode = normalizeTaxCode(candidate.taxCode);
  const phone = normalizePhone(candidate.phone);
  const companyName = normalizeCompanyName(candidate.companyName);

  const sources = [
    ...candidates
      .filter(item => item.id !== excludedCandidateId)
      .map(item => ({ ...item, recordType: 'candidate' as const })),
    ...leads.map(item => ({ ...item, recordType: 'lead' as const })),
    ...customers.map(item => ({ ...item, recordType: 'customer' as const }))
  ];

  if (taxCode) {
    const duplicate = sources.find(item => normalizeTaxCode(item.taxCode) === taxCode);
    if (duplicate) {
      return { id: duplicate.id, recordType: duplicate.recordType, companyName: duplicate.companyName, reason: 'taxCode' };
    }
  }

  if (phone.length >= 8) {
    const duplicate = sources.find(item => normalizePhone(item.phone) === phone);
    if (duplicate) {
      return { id: duplicate.id, recordType: duplicate.recordType, companyName: duplicate.companyName, reason: 'phone' };
    }
  }

  if (companyName.length >= 5) {
    const duplicate = sources.find(item => normalizeCompanyName(item.companyName) === companyName);
    if (duplicate) {
      return { id: duplicate.id, recordType: duplicate.recordType, companyName: duplicate.companyName, reason: 'companyName' };
    }
  }

  return null;
};

export const mapCandidateSourceToLeadSource = (source: string): string => {
  const normalizedSource = source.trim().toLocaleLowerCase('vi-VN');
  if (normalizedSource === 'facebook' || normalizedSource === 'mạng xã hội') return 'Mạng xã hội';
  if (normalizedSource === 'website') return 'Website';
  if (normalizedSource === 'khách hàng giới thiệu') return 'Khách hàng giới thiệu';
  return 'Sale tự tìm kiếm';
};
