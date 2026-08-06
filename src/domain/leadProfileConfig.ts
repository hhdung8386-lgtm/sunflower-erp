import type {
  LeadProfileFieldDefinition,
  LeadSystemProfileFieldKey
} from './crmModels';

const SYSTEM_PROFILE_FIELD_DEFAULTS: Array<LeadProfileFieldDefinition & { systemKey: LeadSystemProfileFieldKey }> = [
  { id: 'lead_profile_system_company_name', systemKey: 'companyName', name: 'Tên doanh nghiệp', type: 'text', options: [], active: true, required: true, saleEditable: true, order: -70 },
  { id: 'lead_profile_system_contact_person', systemKey: 'contactPerson', name: 'Người liên hệ', type: 'text', options: [], active: true, required: false, saleEditable: true, order: -60 },
  { id: 'lead_profile_system_phone', systemKey: 'phone', name: 'Điện thoại', type: 'text', options: [], active: true, required: false, saleEditable: true, order: -50 },
  { id: 'lead_profile_system_email', systemKey: 'email', name: 'Email', type: 'text', options: [], active: true, required: false, saleEditable: true, order: -40 },
  { id: 'lead_profile_system_tax_code', systemKey: 'taxCode', name: 'Mã số thuế', type: 'text', options: [], active: true, required: true, saleEditable: true, order: -30 },
  { id: 'lead_profile_system_address', systemKey: 'address', name: 'Địa chỉ', type: 'text', options: [], active: true, required: false, saleEditable: true, order: -20 },
  { id: 'lead_profile_system_note', systemKey: 'note', name: 'Ghi chú', type: 'text', options: [], active: true, required: false, saleEditable: true, order: -10 }
];

const SYSTEM_PROFILE_FIELD_IDS = new Set(SYSTEM_PROFILE_FIELD_DEFAULTS.map(field => field.id));

export const isLeadSystemProfileField = (definition: LeadProfileFieldDefinition) => (
  Boolean(definition.systemKey) || SYSTEM_PROFILE_FIELD_IDS.has(definition.id)
);

export const mergeLeadProfileFieldDefinitions = (
  storedDefinitions: LeadProfileFieldDefinition[]
): LeadProfileFieldDefinition[] => {
  const storedById = new Map(storedDefinitions.map(definition => [definition.id, definition]));
  const systemDefinitions = SYSTEM_PROFILE_FIELD_DEFAULTS.map(defaultDefinition => {
    const storedDefinition = storedById.get(defaultDefinition.id);
    const protectedField = defaultDefinition.systemKey === 'companyName' || defaultDefinition.systemKey === 'taxCode';
    return {
      ...defaultDefinition,
      ...storedDefinition,
      id: defaultDefinition.id,
      systemKey: defaultDefinition.systemKey,
      type: defaultDefinition.type,
      options: [],
      active: protectedField ? true : (storedDefinition?.active ?? true),
      required: protectedField ? true : (storedDefinition?.required ?? false),
      saleEditable: protectedField ? true : (storedDefinition?.saleEditable ?? true)
    };
  });
  const customDefinitions = storedDefinitions.filter(definition => !isLeadSystemProfileField(definition));
  return [...systemDefinitions, ...customDefinitions].sort((a, b) => a.order - b.order);
};
