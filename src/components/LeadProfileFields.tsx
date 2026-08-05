import React, { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Save, Settings2, X } from 'lucide-react';
import type {
  LeadCustomFieldType,
  LeadFilterOption,
  LeadProfileFieldDefinition
} from '../domain/crmModels';
import { slugifyLeadFilterId } from '../domain/leadFilterConfig';

const PROFILE_FIELD_TYPE_LABELS: Record<LeadCustomFieldType, string> = {
  text: 'Văn bản',
  number: 'Số',
  date: 'Ngày',
  single_select: 'Chọn một',
  multi_select: 'Chọn nhiều',
  checkbox: 'Có / Không'
};

const PROFILE_OPTION_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

interface LeadProfileFieldsProps {
  definitions: LeadProfileFieldDefinition[];
  values: Record<string, string[]>;
  canEditAll: boolean;
  onChange: (fieldId: string, values: string[]) => void;
}

export const LeadProfileFields: React.FC<LeadProfileFieldsProps> = ({
  definitions,
  values,
  canEditAll,
  onChange
}) => {
  const activeDefinitions = definitions.filter(field => field.active).sort((a, b) => a.order - b.order);
  if (activeDefinitions.length === 0) return null;

  return (
    <div className="lead-profile-custom-fields">
      {activeDefinitions.map(field => {
        const fieldValues = values[field.id] || [];
        const disabled = !canEditAll && !field.saleEditable;

        if (field.type === 'single_select') {
          return (
            <div className="form-group" key={field.id}>
              <label>{field.name}{field.required ? ' *' : ''}</label>
              <select value={fieldValues[0] || ''} required={field.required} disabled={disabled} onChange={event => onChange(field.id, event.target.value ? [event.target.value] : [])}>
                <option value="">Chưa chọn</option>
                {field.options.filter(option => option.active).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
          );
        }

        if (field.type === 'multi_select') {
          return (
            <div className="form-group lead-profile-multi-field" key={field.id}>
              <label>{field.name}{field.required ? ' *' : ''}</label>
              <div className="lead-profile-option-grid">
                {field.options.filter(option => option.active).map(option => {
                  const selected = fieldValues.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      disabled={disabled}
                      onClick={() => onChange(field.id, selected
                        ? fieldValues.filter(value => value !== option.id)
                        : [...fieldValues, option.id])}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        if (field.type === 'checkbox') {
          const selected = fieldValues[0] === 'true';
          return (
            <div className="form-group" key={field.id}>
              <label>{field.name}{field.required ? ' *' : ''}</label>
              <button type="button" className={`lead-profile-boolean ${selected ? 'is-selected' : ''}`} disabled={disabled} onClick={() => onChange(field.id, selected ? [] : ['true'])}>
                {selected ? 'Có' : 'Không'}
              </button>
            </div>
          );
        }

        return (
          <div className="form-group" key={field.id}>
            <label>{field.name}{field.required ? ' *' : ''}</label>
            <input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={fieldValues[0] || ''}
              required={field.required}
              disabled={disabled}
              onChange={event => onChange(field.id, event.target.value ? [event.target.value] : [])}
            />
          </div>
        );
      })}
    </div>
  );
};

interface LeadProfileAdminModalProps {
  definitions: LeadProfileFieldDefinition[];
  onClose: () => void;
  onSaveDefinition: (definition: LeadProfileFieldDefinition) => Promise<void>;
}

const createEmptyDefinition = (
  definitions: LeadProfileFieldDefinition[]
): LeadProfileFieldDefinition => ({
  id: `lead_profile_${Date.now().toString(36)}`,
  name: '',
  type: 'text',
  options: [],
  active: true,
  required: false,
  saleEditable: true,
  order: Math.max(0, ...definitions.map(item => item.order || 0)) + 10
});

export const LeadProfileAdminModal: React.FC<LeadProfileAdminModalProps> = ({
  definitions,
  onClose,
  onSaveDefinition
}) => {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<LeadProfileFieldDefinition>(() => createEmptyDefinition(definitions));
  const [optionLines, setOptionLines] = useState('');

  const startCreate = () => {
    const definition = createEmptyDefinition(definitions);
    setEditingId(definition.id);
    setDraft(definition);
    setOptionLines('');
  };

  const startEdit = (definition: LeadProfileFieldDefinition) => {
    setEditingId(definition.id);
    setDraft({ ...definition, options: definition.options.map(option => ({ ...option })) });
    setOptionLines(definition.options.filter(option => option.active).map(option => option.label).join('\n'));
  };

  const updateOptionLines = (value: string) => {
    setOptionLines(value);
    const labels = value.split('\n').map(line => line.trim()).filter(Boolean);
    setDraft(previous => {
      const previousActiveOptions = previous.options.filter(option => option.active);
      const usedIds = new Set<string>();
      const activeOptions: LeadFilterOption[] = labels.map((label, index) => {
        const sameLabel = previous.options.find(option => option.label.toLocaleLowerCase('vi-VN') === label.toLocaleLowerCase('vi-VN'));
        const samePosition = previousActiveOptions[index];
        const existing = sameLabel && !usedIds.has(sameLabel.id)
          ? sameLabel
          : samePosition && !usedIds.has(samePosition.id) ? samePosition : null;
        const nextOption = existing
          ? { ...existing, label, active: true }
          : {
              id: `${slugifyLeadFilterId(label) || 'option'}_${index + 1}`,
              label,
              color: PROFILE_OPTION_COLORS[index % PROFILE_OPTION_COLORS.length],
              active: true
            };
        usedIds.add(nextOption.id);
        return nextOption;
      });
      const activeIds = new Set(activeOptions.map(option => option.id));
      const archivedOptions = previous.options
        .filter(option => !activeIds.has(option.id))
        .map(option => ({ ...option, active: false }));
      return { ...previous, options: [...activeOptions, ...archivedOptions] };
    });
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) return;
    const needsOptions = draft.type === 'single_select' || draft.type === 'multi_select';
    if (needsOptions && draft.options.filter(option => option.active).length === 0) return;
    await onSaveDefinition({ ...draft, name: draft.name.trim() });
    setEditingId('');
  };

  const toggleActive = async (definition: LeadProfileFieldDefinition) => {
    await onSaveDefinition({ ...definition, active: !definition.active });
    if (editingId === definition.id) setEditingId('');
  };

  const usesOptions = draft.type === 'single_select' || draft.type === 'multi_select';

  return (
    <div className="modal-overlay">
      <div className="modal-content lead-config-modal lead-profile-config-modal">
        <div className="modal-header">
          <div><strong>CẤU HÌNH THÔNG TIN DOANH NGHIỆP</strong><span>Các trường cốt lõi như tên doanh nghiệp và mã số thuế được bảo vệ; admin có thể quản lý các trường bổ sung tại đây.</span></div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}><X size={15} /> Đóng</button>
        </div>
        <div className="modal-body">
          <div className="lead-config-layout">
            <div className="lead-config-list">
              <div className="lead-config-list__header">
                <strong>{definitions.length} trường bổ sung</strong>
                <button type="button" className="btn btn-sm btn-primary" onClick={startCreate}><Plus size={13} /> Thêm trường</button>
              </div>
              {definitions.map(definition => (
                <div key={definition.id} className={`lead-config-item ${!definition.active ? 'is-inactive' : ''}`}>
                  <div><strong>{definition.name}</strong><span>{PROFILE_FIELD_TYPE_LABELS[definition.type]} · Thứ tự {definition.order}</span></div>
                  <div>
                    <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" title={definition.active ? 'Ngừng sử dụng' : 'Sử dụng lại'} onClick={() => toggleActive(definition)}>{definition.active ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" title="Chỉnh sửa" onClick={() => startEdit(definition)}><Pencil size={13} /></button>
                  </div>
                </div>
              ))}
              {definitions.length === 0 && <div className="lead-profile-empty">Chưa có trường thông tin bổ sung.</div>}
            </div>

            <div className="lead-config-editor">
              {editingId ? (
                <>
                  <h3>{definitions.some(item => item.id === editingId) ? 'Chỉnh sửa trường thông tin' : 'Tạo trường thông tin mới'}</h3>
                  <label><span>Tên trường *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
                  <label><span>Loại dữ liệu</span><select value={draft.type} onChange={event => setDraft(previous => ({ ...previous, type: event.target.value as LeadCustomFieldType }))}>{Object.entries(PROFILE_FIELD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Thứ tự hiển thị</span><input type="number" value={draft.order} onChange={event => setDraft(previous => ({ ...previous, order: Number(event.target.value) }))} /></label>
                  {usesOptions && <label><span>Các lựa chọn (mỗi dòng một lựa chọn)</span><textarea rows={8} value={optionLines} onChange={event => updateOptionLines(event.target.value)} /></label>}
                  <div className="lead-config-checks">
                    <label><input type="checkbox" checked={draft.required} onChange={event => setDraft(previous => ({ ...previous, required: event.target.checked, saleEditable: event.target.checked ? true : previous.saleEditable }))} /> Bắt buộc nhập</label>
                    <label><input type="checkbox" checked={draft.saleEditable} disabled={draft.required} onChange={event => setDraft(previous => ({ ...previous, saleEditable: event.target.checked }))} /> Sale được chỉnh sửa</label>
                    <label><input type="checkbox" checked={draft.active} onChange={event => setDraft(previous => ({ ...previous, active: event.target.checked }))} /> Đang sử dụng</label>
                  </div>
                  <div className="lead-config-editor__actions">
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId('')}>Hủy</button>
                    <button type="button" className="btn btn-primary" onClick={saveDraft}><Save size={14} /> Lưu trường</button>
                  </div>
                </>
              ) : (
                <div className="lead-config-placeholder"><Settings2 size={34} /><strong>Chọn hoặc tạo trường thông tin</strong><span>Trường đã ngừng sử dụng vẫn được giữ lại để bảo toàn dữ liệu lịch sử.</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
