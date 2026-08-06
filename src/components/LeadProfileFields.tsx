import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LockKeyhole, Pencil, Plus, Save, Settings2 } from 'lucide-react';
import type {
  LeadCustomFieldType,
  LeadFilterOption,
  LeadProfileFieldDefinition
} from '../domain/crmModels';
import { slugifyLeadFilterId } from '../domain/leadFilterConfig';
import { isLeadSystemProfileField } from '../domain/leadProfileConfig';

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

interface LeadProfileFieldControlProps {
  field: LeadProfileFieldDefinition;
  values: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}

export const LeadProfileFieldControl: React.FC<LeadProfileFieldControlProps> = ({
  field,
  values: fieldValues,
  disabled,
  onChange
}) => {
  if (field.type === 'single_select') {
    return (
      <div className="form-group">
        <label>{field.name}{field.required ? ' *' : ''}</label>
        <select value={fieldValues[0] || ''} required={field.required} disabled={disabled} onChange={event => onChange(event.target.value ? [event.target.value] : [])}>
          <option value="">Chưa chọn</option>
          {field.options.filter(option => option.active).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'multi_select') {
    return (
      <div className="form-group lead-profile-multi-field">
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
                onClick={() => onChange(selected
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
      <div className="form-group">
        <label>{field.name}{field.required ? ' *' : ''}</label>
        <button type="button" className={`lead-profile-boolean ${selected ? 'is-selected' : ''}`} disabled={disabled} onClick={() => onChange(selected ? [] : ['true'])}>
          {selected ? 'Có' : 'Không'}
        </button>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label>{field.name}{field.required ? ' *' : ''}</label>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={fieldValues[0] || ''}
        required={field.required}
        disabled={disabled}
        onChange={event => onChange(event.target.value ? [event.target.value] : [])}
      />
    </div>
  );
};

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
        return (
          <LeadProfileFieldControl
            key={field.id}
            field={field}
            values={fieldValues}
            disabled={disabled}
            onChange={nextValues => onChange(field.id, nextValues)}
          />
        );
      })}
    </div>
  );
};

interface LeadProfileStructureEditorProps {
  definitions: LeadProfileFieldDefinition[];
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

export const LeadProfileStructureEditor: React.FC<LeadProfileStructureEditorProps> = ({
  definitions,
  onSaveDefinition
}) => {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<LeadProfileFieldDefinition>(() => createEmptyDefinition(definitions));
  const [optionLines, setOptionLines] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    setSaving(true);
    setSaveError('');
    try {
      await onSaveDefinition({ ...draft, name: draft.name.trim() });
      setEditingId('');
    } catch {
      setSaveError('Không thể lưu cấu trúc trường. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (definition: LeadProfileFieldDefinition) => {
    const protectedField = definition.systemKey === 'companyName' || definition.systemKey === 'taxCode';
    if (protectedField) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSaveDefinition({ ...definition, active: !definition.active });
      if (editingId === definition.id) setEditingId('');
    } catch {
      setSaveError('Không thể thay đổi trạng thái trường. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const moveDefinition = async (definition: LeadProfileFieldDefinition, direction: -1 | 1) => {
    const currentIndex = definitions.findIndex(item => item.id === definition.id);
    const adjacentDefinition = definitions[currentIndex + direction];
    if (!adjacentDefinition) return;
    const reorderedDefinitions = [...definitions];
    reorderedDefinitions[currentIndex] = adjacentDefinition;
    reorderedDefinitions[currentIndex + direction] = definition;
    setSaving(true);
    setSaveError('');
    try {
      await Promise.all(reorderedDefinitions.map((item, index) => (
        onSaveDefinition({ ...item, order: (index + 1) * 10 })
      )));
    } catch {
      setSaveError('Không thể thay đổi thứ tự trường. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const usesOptions = draft.type === 'single_select' || draft.type === 'multi_select';
  const isSystemDraft = isLeadSystemProfileField(draft);
  const isProtectedDraft = draft.systemKey === 'companyName' || draft.systemKey === 'taxCode';

  return (
    <div className="lead-profile-structure-editor">
      <div className="lead-config-list">
        <div className="lead-config-list__header">
          <div><strong>{definitions.length} trường thông tin</strong><span>Kéo thứ tự bằng nút lên/xuống; trường ẩn vẫn giữ nguyên dữ liệu cũ.</span></div>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={startCreate}><Plus size={13} /> Thêm trường</button>
        </div>
        <div className="lead-profile-structure-list">
          {definitions.map((definition, index) => {
            const protectedField = definition.systemKey === 'companyName' || definition.systemKey === 'taxCode';
            return (
              <div key={definition.id} className={`lead-config-item ${!definition.active ? 'is-inactive' : ''} ${editingId === definition.id ? 'is-editing' : ''}`}>
                <div>
                  <strong>{definition.name}</strong>
                  <span>{isLeadSystemProfileField(definition) ? 'Trường hệ thống' : PROFILE_FIELD_TYPE_LABELS[definition.type]}{definition.required ? ' · Bắt buộc' : ''}</span>
                </div>
                <div>
                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" disabled={saving || index === 0} title="Đưa lên" onClick={() => moveDefinition(definition, -1)}><ArrowUp size={13} /></button>
                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" disabled={saving || index === definitions.length - 1} title="Đưa xuống" onClick={() => moveDefinition(definition, 1)}><ArrowDown size={13} /></button>
                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" disabled={saving || protectedField} title={protectedField ? 'Trường hệ thống bắt buộc luôn được hiển thị' : definition.active ? 'Ẩn / ngừng sử dụng' : 'Hiển thị / sử dụng lại'} onClick={() => toggleActive(definition)}>{protectedField ? <LockKeyhole size={13} /> : definition.active ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" disabled={saving} title="Chỉnh sửa" onClick={() => startEdit(definition)}><Pencil size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lead-config-editor">
        {editingId ? (
          <>
            <h3>{definitions.some(item => item.id === editingId) ? 'Chỉnh sửa trường thông tin' : 'Tạo trường thông tin mới'}</h3>
            {isSystemDraft && <div className="lead-profile-system-notice"><LockKeyhole size={14} /><span>Đây là trường hệ thống. Có thể đổi nhãn hiển thị nhưng mã kỹ thuật và loại dữ liệu được giữ nguyên.</span></div>}
            <label><span>Tên hiển thị *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
            <label><span>Loại dữ liệu</span><select value={draft.type} disabled={isSystemDraft} onChange={event => setDraft(previous => ({ ...previous, type: event.target.value as LeadCustomFieldType }))}>{Object.entries(PROFILE_FIELD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {usesOptions && !isSystemDraft && <label><span>Các lựa chọn (mỗi dòng một lựa chọn)</span><textarea rows={6} value={optionLines} onChange={event => updateOptionLines(event.target.value)} /></label>}
            <div className="lead-config-checks">
              <label><input type="checkbox" checked={draft.required} disabled={isProtectedDraft} onChange={event => setDraft(previous => ({ ...previous, required: event.target.checked, saleEditable: event.target.checked ? true : previous.saleEditable }))} /> Bắt buộc nhập</label>
              <label><input type="checkbox" checked={draft.saleEditable} disabled={draft.required} onChange={event => setDraft(previous => ({ ...previous, saleEditable: event.target.checked }))} /> Sale được chỉnh sửa</label>
              <label><input type="checkbox" checked={draft.active} disabled={isProtectedDraft} onChange={event => setDraft(previous => ({ ...previous, active: event.target.checked }))} /> Đang hiển thị</label>
            </div>
            {saveError && <div className="lead-config-error">{saveError}</div>}
            <div className="lead-config-editor__actions">
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setEditingId('')}>Hủy</button>
              <button type="button" className="btn btn-primary" disabled={saving || !draft.name.trim()} onClick={saveDraft}><Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu trường'}</button>
            </div>
          </>
        ) : (
          <div className="lead-config-placeholder"><Settings2 size={34} /><strong>Chọn một trường để chỉnh sửa</strong><span>Tên doanh nghiệp và Mã số thuế luôn được bảo vệ. Các trường khác chỉ được ẩn, không xóa dữ liệu lịch sử.</span></div>
        )}
      </div>
    </div>
  );
};
