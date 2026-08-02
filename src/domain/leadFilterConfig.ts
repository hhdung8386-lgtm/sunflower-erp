import type { LeadFilterDefinition, LeadRecord, LeadStage } from './crmModels';

export const SIMPLE_LEAD_PROGRESS_FIELD: LeadFilterDefinition = {
  id: 'lead_progress',
  name: 'Tiến độ hiện tại',
  group: 'Theo dõi bán hàng',
  type: 'multi_select',
  active: true,
  showInQuickFilter: true,
  reportable: true,
  saleEditable: true,
  order: 10,
  options: [
    { id: 'contacted', label: 'Đã liên hệ', color: '#2563eb', active: true },
    { id: 'sample_in_progress', label: 'Đang làm mẫu', color: '#0891b2', active: true },
    { id: 'preparing_quote', label: 'Đang báo giá', color: '#7c3aed', active: true },
    { id: 'quote_sent', label: 'Đã gửi báo giá', color: '#d97706', active: true },
    { id: 'negotiating', label: 'Đang đàm phán', color: '#059669', active: true },
    { id: 'waiting_feedback', label: 'Chờ khách phản hồi', color: '#64748b', active: true }
  ]
};

export const DEFAULT_LEAD_FILTER_DEFINITIONS: LeadFilterDefinition[] = [SIMPLE_LEAD_PROGRESS_FIELD];

export const getLegacyLeadFilterValues = (stage: LeadStage): Record<string, string[]> => {
  if (stage === 'contacted') return { lead_progress: ['contacted'] };
  if (stage === 'quoted') return { lead_progress: ['contacted', 'quote_sent'] };
  if (stage === 'negotiating') return { lead_progress: ['contacted', 'quote_sent', 'negotiating'] };
  return {};
};

export const getLeadFilterValues = (lead: LeadRecord): Record<string, string[]> => {
  const existingValues = lead.filterValues || {};
  const legacyProgressValues = [
    ...(existingValues.lead_progress || []),
    ...(existingValues.contact_progress || []).filter(value => ['called', 'emailed', 'zalo_connected', 'met_customer'].includes(value)).map(() => 'contacted'),
    ...((existingValues.sample_progress || []).length > 0 ? ['sample_in_progress'] : []),
    ...(existingValues.quotation_progress || []).filter(value => value === 'preparing_quote').map(() => 'preparing_quote'),
    ...(existingValues.quotation_progress || []).filter(value => ['quote_sent', 'quote_received'].includes(value)).map(() => 'quote_sent'),
    ...(existingValues.negotiation_progress || []).filter(value => ['negotiating', 'price_negotiation', 'quantity_negotiation', 'payment_negotiation', 'delivery_negotiation'].includes(value)).map(() => 'negotiating'),
    ...(existingValues.negotiation_progress || []).filter(value => ['waiting_feedback', 'waiting_procurement', 'waiting_accounting', 'waiting_management'].includes(value)).map(() => 'waiting_feedback')
  ];

  if (legacyProgressValues.length > 0) {
    return { lead_progress: Array.from(new Set(legacyProgressValues)) };
  }
  return getLegacyLeadFilterValues(lead.stage);
};

export const mergeLeadFilterDefinitions = (stored: LeadFilterDefinition[] = []) => {
  void stored;
  return DEFAULT_LEAD_FILTER_DEFINITIONS;
};

export const findLeadFilterOption = (
  definitions: LeadFilterDefinition[],
  fieldId: string,
  optionId: string
) => definitions.find(field => field.id === fieldId)?.options.find(item => item.id === optionId);

export const slugifyLeadFilterId = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');
