import type { LeadFilterDefinition, LeadFilterOption, LeadRecord, LeadStage } from './crmModels';

const OPTION_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#4f46e5', '#64748b'];

const option = (id: string, label: string, colorIndex = 0): LeadFilterOption => ({
  id,
  label,
  color: OPTION_COLORS[colorIndex % OPTION_COLORS.length],
  active: true
});

export const DEFAULT_LEAD_FILTER_DEFINITIONS: LeadFilterDefinition[] = [
  {
    id: 'contact_progress',
    name: 'Tiến độ tiếp cận',
    group: 'Tiếp cận',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 10,
    options: [
      option('called', 'Đã gọi điện'),
      option('emailed', 'Đã gửi email', 1),
      option('zalo_connected', 'Đã kết nối Zalo', 2),
      option('met_customer', 'Đã gặp trực tiếp', 3),
      option('right_contact', 'Đúng người phụ trách', 4),
      option('need_confirmed', 'Đã xác định nhu cầu', 5),
      option('budget_confirmed', 'Đã xác định ngân sách', 6),
      option('unreachable', 'Không liên lạc được', 7)
    ]
  },
  {
    id: 'product_interest',
    name: 'Nhu cầu sản phẩm',
    group: 'Nhu cầu',
    type: 'multi_select',
    active: true,
    showInQuickFilter: false,
    reportable: true,
    saleEditable: true,
    order: 20,
    options: [
      option('roll_label', 'Tem cuộn'),
      option('sheet_label', 'Tem tờ', 1),
      option('paper_decal', 'Decal giấy', 2),
      option('plastic_decal', 'Decal nhựa', 3),
      option('barcode_label', 'Tem barcode', 4),
      option('color_label', 'Tem màu', 5),
      option('ribbon', 'Ribbon / mực in', 6),
      option('design_service', 'Dịch vụ thiết kế', 7),
      option('undetermined_product', 'Chưa xác định sản phẩm', 4)
    ]
  },
  {
    id: 'sample_progress',
    name: 'Mẫu và thiết kế',
    group: 'Mẫu & thiết kế',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 30,
    options: [
      option('sample_requested', 'Khách yêu cầu mẫu'),
      option('waiting_artwork', 'Chờ khách gửi artwork', 1),
      option('designing_sample', 'Đang thiết kế mẫu', 2),
      option('producing_sample', 'Đang sản xuất mẫu', 3),
      option('sample_sent', 'Đã gửi mẫu', 4),
      option('sample_reviewing', 'Khách đang kiểm tra mẫu', 5),
      option('sample_revision', 'Mẫu cần chỉnh sửa', 6),
      option('sample_approved', 'Mẫu đã được duyệt', 7),
      option('no_sample_needed', 'Không cần làm mẫu', 3)
    ]
  },
  {
    id: 'quotation_progress',
    name: 'Tiến độ báo giá',
    group: 'Báo giá',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 40,
    options: [
      option('missing_quote_info', 'Chưa đủ thông tin báo giá'),
      option('pricing', 'Đang tính giá', 1),
      option('waiting_supplier_price', 'Chờ giá nhà cung cấp', 2),
      option('preparing_quote', 'Đang làm báo giá', 3),
      option('quote_sent', 'Đã gửi báo giá', 4),
      option('quote_received', 'Khách đã nhận báo giá', 5),
      option('quote_revision', 'Khách yêu cầu sửa báo giá', 6),
      option('quote_expiring', 'Báo giá sắp hết hạn', 7),
      option('quote_expired', 'Báo giá đã hết hạn', 5)
    ]
  },
  {
    id: 'negotiation_progress',
    name: 'Đàm phán và phản hồi',
    group: 'Đàm phán',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 50,
    options: [
      option('negotiating', 'Đang đàm phán'),
      option('price_negotiation', 'Đang thương lượng giá', 1),
      option('quantity_negotiation', 'Đang thương lượng số lượng', 2),
      option('payment_negotiation', 'Đang thương lượng công nợ', 3),
      option('delivery_negotiation', 'Đang thương lượng giao hàng', 4),
      option('waiting_feedback', 'Chờ khách phản hồi', 5),
      option('waiting_procurement', 'Chờ phòng mua hàng', 6),
      option('waiting_accounting', 'Chờ kế toán khách hàng', 7),
      option('waiting_management', 'Chờ lãnh đạo khách duyệt', 3),
      option('comparing_suppliers', 'Khách đang so sánh NCC', 5)
    ]
  },
  {
    id: 'lead_quality',
    name: 'Mức độ và cảnh báo',
    group: 'Ưu tiên & rủi ro',
    type: 'multi_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 60,
    options: [
      option('hot', 'Rất tiềm năng', 5),
      option('warm', 'Tiềm năng', 4),
      option('cold', 'Tiềm năng thấp', 7),
      option('urgent', 'Cần hàng gấp', 5),
      option('recurring', 'Có khả năng mua lặp lại', 3),
      option('high_value', 'Lead giá trị cao', 1),
      option('price_sensitive', 'Nhạy cảm về giá', 4),
      option('technically_complex', 'Yêu cầu kỹ thuật phức tạp', 2),
      option('competitor', 'Có đối thủ cạnh tranh', 6),
      option('risk_loss', 'Nguy cơ mất Lead', 5),
      option('paused', 'Tạm hoãn', 7)
    ]
  },
  {
    id: 'purchase_timing',
    name: 'Thời điểm dự kiến đặt hàng',
    group: 'Thời điểm mua',
    type: 'single_select',
    active: true,
    showInQuickFilter: true,
    reportable: true,
    saleEditable: true,
    order: 70,
    options: [
      option('within_7_days', 'Trong 7 ngày', 5),
      option('this_month', 'Trong tháng này', 4),
      option('this_quarter', 'Trong quý này', 2),
      option('over_3_months', 'Trên 3 tháng', 7),
      option('unknown_timing', 'Chưa xác định', 6),
      option('price_reference_only', 'Chỉ tham khảo giá', 1)
    ]
  },
  {
    id: 'industry',
    name: 'Ngành nghề khách hàng',
    group: 'Doanh nghiệp',
    type: 'multi_select',
    active: true,
    showInQuickFilter: false,
    reportable: true,
    saleEditable: true,
    order: 80,
    options: [
      option('food_beverage', 'Thực phẩm & đồ uống'),
      option('electronics', 'Điện tử', 1),
      option('logistics', 'Logistics', 2),
      option('pharmaceutical', 'Dược phẩm', 3),
      option('chemical', 'Hóa chất', 4),
      option('manufacturing', 'Sản xuất công nghiệp', 5),
      option('retail', 'Bán lẻ', 6),
      option('other_industry', 'Ngành khác', 7)
    ]
  },
  {
    id: 'loss_reason',
    name: 'Lý do không thành công',
    group: 'Kết quả',
    type: 'single_select',
    active: true,
    showInQuickFilter: false,
    reportable: true,
    saleEditable: true,
    order: 90,
    options: [
      option('price_not_fit', 'Giá không phù hợp', 5),
      option('quality_not_fit', 'Chất lượng / mẫu không phù hợp', 4),
      option('delivery_not_fit', 'Thời gian giao không phù hợp', 2),
      option('chose_competitor', 'Khách chọn nhà cung cấp khác', 6),
      option('no_more_need', 'Khách không còn nhu cầu', 7),
      option('cannot_contact', 'Không liên lạc được', 5),
      option('invalid_lead', 'Lead không hợp lệ', 1),
      option('other_loss_reason', 'Lý do khác', 3)
    ]
  }
];

export const getLegacyLeadFilterValues = (stage: LeadStage): Record<string, string[]> => {
  if (stage === 'contacted') return { contact_progress: ['called'] };
  if (stage === 'quoted') return { contact_progress: ['called'], quotation_progress: ['quote_sent'] };
  if (stage === 'negotiating') return {
    contact_progress: ['called'],
    quotation_progress: ['quote_sent'],
    negotiation_progress: ['negotiating']
  };
  return {};
};

export const getLeadFilterValues = (lead: LeadRecord): Record<string, string[]> => (
  Object.keys(lead.filterValues || {}).length > 0
    ? lead.filterValues
    : getLegacyLeadFilterValues(lead.stage)
);

export const mergeLeadFilterDefinitions = (stored: LeadFilterDefinition[]): LeadFilterDefinition[] => {
  if (stored.length === 0) return DEFAULT_LEAD_FILTER_DEFINITIONS;
  const storedById = new Map(stored.map(field => [field.id, field]));
  const defaultsWithOverrides = DEFAULT_LEAD_FILTER_DEFINITIONS.map(field => storedById.get(field.id) || field);
  const customFields = stored.filter(field => !DEFAULT_LEAD_FILTER_DEFINITIONS.some(defaultField => defaultField.id === field.id));
  return [...defaultsWithOverrides, ...customFields].sort((a, b) => a.order - b.order);
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
