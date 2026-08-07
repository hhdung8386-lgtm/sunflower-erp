import type { LeadFilterDefinition, LeadFilterOption, LeadRecord, LeadStage } from './crmModels';

const OPTION_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#4f46e5', '#64748b'];

const option = (id: string, label: string, colorIndex = 0): LeadFilterOption => ({
  id,
  label,
  color: OPTION_COLORS[colorIndex % OPTION_COLORS.length],
  active: true
});

export function slugifyLeadFilterId(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const VIETNAM_PROVINCES_2026 = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng', 'Đắk Lắk',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội', 'Hà Tĩnh', 'Hải Phòng',
  'Huế', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
  'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sơn La', 'Tây Ninh', 'Thái Nguyên', 'Thanh Hóa', 'TP. Hồ Chí Minh', 'Tuyên Quang',
  'Vĩnh Long'
];

export const LEAD_FILTER_IDS = {
  companySize: 'company_size',
  province: 'province',
  productNeed: 'product_need',
  source: 'lead_source',
  progress: 'lead_progress'
} as const;

export const DEFAULT_LEAD_FILTER_DEFINITIONS: LeadFilterDefinition[] = [
  {
    id: LEAD_FILTER_IDS.companySize,
    name: 'Quy mô',
    group: 'Phân loại khách hàng tiềm năng',
    type: 'single_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 10,
    options: [
      option('large', 'Doanh nghiệp lớn'),
      option('medium', 'Doanh nghiệp vừa', 1),
      option('small', 'Doanh nghiệp nhỏ', 2)
    ]
  },
  {
    id: LEAD_FILTER_IDS.province,
    name: 'Tỉnh thành',
    group: 'Phân loại khách hàng tiềm năng',
    type: 'single_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 40,
    options: VIETNAM_PROVINCES_2026.map((label, index) => option(slugifyLeadFilterId(label), label, index))
  },
  {
    id: LEAD_FILTER_IDS.productNeed,
    name: 'Nhu cầu',
    group: 'Phân loại khách hàng tiềm năng',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 30,
    options: [
      option('roll_label', 'Tem cuộn'),
      option('sheet_label', 'Tem tờ', 1),
      option('paper_decal', 'Decal giấy', 2),
      option('plastic_decal', 'Decal nhựa', 3),
      option('barcode_label', 'Tem barcode', 4),
      option('color_label', 'Tem màu', 5),
      option('ribbon', 'Ribbon / mực in', 6),
      option('design_service', 'Dịch vụ thiết kế', 7),
      option('other_product', 'Nhu cầu khác', 3)
    ]
  },
  {
    id: LEAD_FILTER_IDS.source,
    name: 'Nguồn',
    group: 'Phân loại khách hàng tiềm năng',
    type: 'single_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 50,
    options: [
      option('director_referral', 'Giám đốc giới thiệu'),
      option('sale_search', 'Sale tự tìm kiếm', 1),
      option('customer_referral', 'Khách hàng giới thiệu', 2),
      option('website', 'Website', 3),
      option('social_media', 'Mạng xã hội', 4),
      option('event', 'Hội chợ / sự kiện', 5),
      option('other_source', 'Khác', 7)
    ]
  },
  {
    id: LEAD_FILTER_IDS.progress,
    name: 'Tiến độ',
    group: 'Phân loại khách hàng tiềm năng',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 20,
    options: [
      option('contacted', 'Đã liên hệ'),
      option('discussing', 'Đang trao đổi', 2),
      option('sample_in_progress', 'Đang làm mẫu', 3),
      option('preparing_quote', 'Đang báo giá', 1),
      option('quote_sent', 'Đã gửi báo giá', 4),
      option('negotiating', 'Đang đàm phán', 3),
      option('waiting_feedback', 'Chờ khách phản hồi', 7)
    ]
  }
];

export const findLeadFilterOption = (
  definitions: LeadFilterDefinition[],
  fieldId: string,
  optionId: string
) => {
  const field = definitions.find(definition => definition.id === fieldId);
  if (!field) return undefined;
  return field.options.find(item => item.id === optionId)
    || field.options.flatMap(item => item.children || []).find(item => item.id === optionId);
};

export const findLeadFilterParentOption = (
  definitions: LeadFilterDefinition[],
  fieldId: string,
  optionId: string
) => {
  const field = definitions.find(definition => definition.id === fieldId);
  if (!field) return undefined;
  return field.options.find(item => (
    item.id === optionId || (item.children || []).some(child => child.id === optionId)
  ));
};

export const findLeadFilterOptionId = (
  definitions: LeadFilterDefinition[],
  fieldId: string,
  labelOrId: string
) => {
  if (!labelOrId) return '';
  const normalizedValue = slugifyLeadFilterId(labelOrId);
  const field = definitions.find(definition => definition.id === fieldId);
  const options = field?.options.flatMap(item => [item, ...(item.children || [])]) || [];
  return options.find(item => (
    item.id === labelOrId
    || slugifyLeadFilterId(item.id) === normalizedValue
    || slugifyLeadFilterId(item.label) === normalizedValue
  ))?.id || '';
};

const getLegacyProgressValues = (stage: LeadStage, existingValues: Record<string, string[]>) => {
  const values = [
    ...(existingValues[LEAD_FILTER_IDS.progress] || []),
    ...(existingValues.contact_progress || [])
      .filter(value => ['called', 'emailed', 'zalo_connected', 'met_customer'].includes(value))
      .map(() => 'contacted'),
    ...((existingValues.sample_progress || []).length > 0 ? ['sample_in_progress'] : []),
    ...(existingValues.quotation_progress || [])
      .filter(value => value === 'preparing_quote')
      .map(() => 'preparing_quote'),
    ...(existingValues.quotation_progress || [])
      .filter(value => ['quote_sent', 'quote_received'].includes(value))
      .map(() => 'quote_sent'),
    ...(existingValues.negotiation_progress || [])
      .filter(value => ['negotiating', 'price_negotiation', 'quantity_negotiation', 'payment_negotiation', 'delivery_negotiation'].includes(value))
      .map(() => 'negotiating'),
    ...(existingValues.negotiation_progress || [])
      .filter(value => ['waiting_feedback', 'waiting_procurement', 'waiting_accounting', 'waiting_management'].includes(value))
      .map(() => 'waiting_feedback')
  ];

  if (values.length > 0) return Array.from(new Set(values));
  if (stage === 'contacted') return ['contacted'];
  if (stage === 'quoted') return ['contacted', 'quote_sent'];
  if (stage === 'negotiating') return ['contacted', 'quote_sent', 'negotiating'];
  return [];
};

export const getLeadFilterValues = (
  lead: LeadRecord,
  definitions: LeadFilterDefinition[] = DEFAULT_LEAD_FILTER_DEFINITIONS
): Record<string, string[]> => {
  const existingValues = lead.filterValues || {};
  const companySizeValues = existingValues[LEAD_FILTER_IDS.companySize]
    || (lead.companySize ? [lead.companySize] : []);
  const rawProvinceValues = existingValues[LEAD_FILTER_IDS.province]
    || [findLeadFilterOptionId(definitions, LEAD_FILTER_IDS.province, lead.province)].filter(Boolean);
  const provinceDefinition = definitions.find(definition => definition.id === LEAD_FILTER_IDS.province);
  const provinceFromArea = provinceDefinition?.options.find(item => (
    (item.children || []).some(child => rawProvinceValues.includes(child.id))
  ));
  const provinceValues = provinceFromArea && !rawProvinceValues.includes(provinceFromArea.id)
    ? [provinceFromArea.id, ...rawProvinceValues]
    : rawProvinceValues;
  const productNeedValues = existingValues[LEAD_FILTER_IDS.productNeed]
    || existingValues.product_interest
    || [];
  const sourceValues = existingValues[LEAD_FILTER_IDS.source]
    || [findLeadFilterOptionId(definitions, LEAD_FILTER_IDS.source, lead.source)].filter(Boolean);

  return {
    ...existingValues,
    [LEAD_FILTER_IDS.companySize]: companySizeValues,
    [LEAD_FILTER_IDS.province]: provinceValues,
    [LEAD_FILTER_IDS.productNeed]: productNeedValues,
    [LEAD_FILTER_IDS.source]: sourceValues,
    [LEAD_FILTER_IDS.progress]: getLegacyProgressValues(lead.stage, existingValues)
  };
};

export const mergeLeadFilterDefinitions = (stored: LeadFilterDefinition[] = []): LeadFilterDefinition[] => {
  const storedById = new Map(stored.map(field => [field.id, field]));
  const defaultIds = new Set(DEFAULT_LEAD_FILTER_DEFINITIONS.map(field => field.id));
  const defaultDefinitions = DEFAULT_LEAD_FILTER_DEFINITIONS.map(defaultField => {
    const savedField = storedById.get(defaultField.id);
    if (!savedField) return defaultField;
    return {
      ...defaultField,
      ...savedField,
      id: defaultField.id,
      options: Array.isArray(savedField.options) ? savedField.options : defaultField.options
    };
  });
  const customDefinitions = stored.filter(field => !defaultIds.has(field.id)).map(field => ({
    ...field,
    options: Array.isArray(field.options) ? field.options : []
  }));

  return [...defaultDefinitions, ...customDefinitions].sort((a, b) => a.order - b.order);
};
