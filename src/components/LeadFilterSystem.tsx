import React, { useState } from 'react';
import { BarChart3, Pencil, Save, Settings2, X } from 'lucide-react';
import type {
  LeadCustomFieldType,
  LeadFilterDefinition,
  LeadFilterOption,
  LeadRecord
} from '../domain/crmModels';
import { findLeadFilterOption, getLeadFilterValues, slugifyLeadFilterId } from '../domain/leadFilterConfig';
import type { UserProfile } from '../services/firebaseService';

const FIELD_TYPE_LABELS: Record<LeadCustomFieldType, string> = {
  multi_select: 'Chọn nhiều',
  single_select: 'Chọn một',
  checkbox: 'Có / Không',
  text: 'Văn bản',
  number: 'Số',
  date: 'Ngày'
};

const DEFAULT_OPTION_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

export const LeadTagChips: React.FC<{
  lead: LeadRecord;
  definitions: LeadFilterDefinition[];
  limit?: number;
}> = ({ lead, definitions, limit = 3 }) => {
  const chips = Object.entries(getLeadFilterValues(lead, definitions)).flatMap(([fieldId, values]) => (
    values.map(optionId => {
      const option = findLeadFilterOption(definitions, fieldId, optionId);
      return option ? { fieldId, option } : null;
    }).filter(Boolean) as Array<{ fieldId: string; option: LeadFilterOption }>
  ));

  if (chips.length === 0) return <span className="lead-tag-empty">Chưa gắn nhãn</span>;

  return (
    <div className="lead-tag-list">
      {chips.slice(0, limit).map(({ fieldId, option }) => (
        <span key={`${fieldId}-${option.id}`} className="lead-tag-chip" style={{ '--lead-tag-color': option.color } as React.CSSProperties}>
          {option.label}
        </span>
      ))}
      {chips.length > limit && <span className="lead-tag-more">+{chips.length - limit}</span>}
    </div>
  );
};

export const LeadDynamicFields: React.FC<{
  lead: LeadRecord;
  definitions: LeadFilterDefinition[];
  canEditAll: boolean;
  onChange: (field: LeadFilterDefinition, value: string, checked?: boolean) => void;
}> = ({ lead, definitions, canEditAll, onChange }) => {
  const values = getLeadFilterValues(lead, definitions);

  return (
    <div className="lead-dynamic-groups">
      {definitions.filter(field => field.active).map(field => {
            const fieldValues = values[field.id] || [];
            const disabled = !canEditAll && !field.saleEditable;

            if (field.type === 'multi_select') {
              return (
                <section key={field.id} className="lead-dynamic-group">
                  <div className="lead-dynamic-group__title">{field.name}</div>
                  <div className="lead-check-grid">
                    {field.options.filter(item => item.active).map(item => (
                      <label key={item.id} className={`lead-check-option ${fieldValues.includes(item.id) ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={fieldValues.includes(item.id)}
                          disabled={disabled}
                          onChange={event => onChange(field, item.id, event.target.checked)}
                        />
                        <span className="lead-check-color" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </section>
              );
            }

            if (field.type === 'single_select') {
              return (
                <section key={field.id} className="lead-dynamic-group">
                  <div className="lead-dynamic-group__title">{field.name}</div>
                  <select value={fieldValues[0] || ''} disabled={disabled} onChange={event => onChange(field, event.target.value)}>
                    <option value="">-- Chưa chọn --</option>
                    {field.options.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </section>
              );
            }

            if (field.type === 'checkbox') {
              return (
                <label key={field.id} className={`lead-check-option lead-check-option--boolean ${fieldValues[0] === 'true' ? 'is-checked' : ''}`}>
                  <input type="checkbox" checked={fieldValues[0] === 'true'} disabled={disabled} onChange={event => onChange(field, 'true', event.target.checked)} />
                  {field.name}
                </label>
              );
            }

            return (
              <label key={`${lead.id}-${field.id}-${fieldValues[0] || ''}`} className="lead-dynamic-input">
                <span>{field.name}</span>
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  defaultValue={fieldValues[0] || ''}
                  disabled={disabled}
                  onBlur={event => onChange(field, event.target.value)}
                />
              </label>
            );
          })}
    </div>
  );
};

export const LeadFilterAdminModal: React.FC<{
  definitions: LeadFilterDefinition[];
  onClose: () => void;
  onSaveDefinition: (definition: LeadFilterDefinition) => Promise<void>;
}> = ({ definitions, onClose, onSaveDefinition }) => {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<LeadFilterDefinition>(() => definitions[0]);
  const [optionLines, setOptionLines] = useState('');

  const startEdit = (definition: LeadFilterDefinition) => {
    setEditingId(definition.id);
    setDraft({ ...definition, options: definition.options.map(item => ({ ...item })) });
    setOptionLines(definition.options.filter(item => item.active).map(item => item.label).join('\n'));
  };

  const updateOptionLines = (value: string) => {
    setOptionLines(value);
    const labels = value.split('\n').map(line => line.trim()).filter(Boolean);
    setDraft(previous => {
      const previousByLabel = new Map(previous.options.map(item => [item.label.toLocaleLowerCase('vi-VN'), item]));
      const previousActiveOptions = previous.options.filter(item => item.active);
      const usedIds = new Set<string>();
      const activeOptions = labels.map((label, index) => {
        const sameLabel = previousByLabel.get(label.toLocaleLowerCase('vi-VN'));
        const samePosition = previousActiveOptions[index];
        const existing = sameLabel && !usedIds.has(sameLabel.id)
          ? sameLabel
          : samePosition && !usedIds.has(samePosition.id) ? samePosition : null;
        const nextOption = existing || {
          id: `${slugifyLeadFilterId(label) || 'option'}_${Date.now().toString(36)}_${index + 1}`,
          label,
          color: DEFAULT_OPTION_COLORS[index % DEFAULT_OPTION_COLORS.length],
          active: true
        };
        usedIds.add(nextOption.id);
        return { ...nextOption, label, active: true };
      });
      const activeIds = new Set(activeOptions.map(item => item.id));
      const archived = previous.options.filter(item => !activeIds.has(item.id)).map(item => ({ ...item, active: false }));
      return { ...previous, options: [...activeOptions, ...archived] };
    });
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) return;
    const optionLabels = optionLines.split('\n').map(line => line.trim()).filter(Boolean);
    if (optionLabels.length === 0) return;
    await onSaveDefinition({
      ...draft,
      name: draft.name.trim(),
      active: true,
      showInQuickFilter: true,
      reportable: true
    });
    setEditingId('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content lead-config-modal">
        <div className="modal-header">
          <div><strong>CẤU HÌNH 5 BỘ LỌC LEAD</strong><span>Đổi tên bộ lọc và các lựa chọn dùng chung cho toàn bộ Sale.</span></div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}><X size={15} /> Đóng</button>
        </div>
        <div className="modal-body">
            <div className="lead-config-layout">
              <div className="lead-config-list">
                <div className="lead-config-list__header">
                  <strong>5 nhóm bộ lọc</strong>
                </div>
                {definitions.map(definition => (
                  <div key={definition.id} className={`lead-config-item ${!definition.active ? 'is-inactive' : ''}`}>
                    <div>
                      <strong>{definition.name}</strong>
                      <span>{FIELD_TYPE_LABELS[definition.type]} · {definition.options.filter(item => item.active).length} lựa chọn</span>
                    </div>
                    <div>
                      <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" title="Chỉnh sửa" onClick={() => startEdit(definition)}><Pencil size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lead-config-editor">
                {editingId ? (
                  <>
                    <h3>Chỉnh sửa bộ lọc</h3>
                    <label><span>Tên bộ lọc *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
                    <label><span>Cách lựa chọn</span><select value={draft.type} onChange={event => setDraft(previous => ({ ...previous, type: event.target.value as LeadCustomFieldType }))}><option value="single_select">Chọn một</option><option value="multi_select">Chọn nhiều</option></select></label>
                    <label><span>Thứ tự hiển thị</span><input type="number" value={draft.order} onChange={event => setDraft(previous => ({ ...previous, order: Number(event.target.value) }))} /></label>
                      <>
                        <label><span>Các lựa chọn (mỗi dòng một lựa chọn)</span><textarea rows={8} value={optionLines} onChange={event => updateOptionLines(event.target.value)} /></label>
                        <div className="lead-option-colors">
                          {draft.options.filter(item => item.active).map(item => <label key={item.id}><input type="color" value={item.color} onChange={event => setDraft(previous => ({ ...previous, options: previous.options.map(optionItem => optionItem.id === item.id ? { ...optionItem, color: event.target.value } : optionItem) }))} /><span>{item.label}</span></label>)}
                        </div>
                      </>
                    <div className="lead-config-checks">
                      <label><input type="checkbox" checked={draft.saleEditable} onChange={event => setDraft(previous => ({ ...previous, saleEditable: event.target.checked }))} /> Sale được chỉnh sửa</label>
                    </div>
                    <div className="lead-config-editor__actions">
                      <button type="button" className="btn btn-outline" onClick={() => setEditingId('')}>Hủy</button>
                      <button type="button" className="btn btn-primary" onClick={saveDraft}><Save size={14} /> Lưu trường</button>
                    </div>
                  </>
                ) : (
                  <div className="lead-config-placeholder"><Settings2 size={34} /><strong>Chọn một bộ lọc để chỉnh sửa</strong><span>Có thể đổi tên, lựa chọn, màu sắc và thứ tự hiển thị.</span></div>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const hasAnyMarker = (lead: LeadRecord, markerIds: string[]) => {
  const values = Object.values(getLeadFilterValues(lead)).flat();
  return markerIds.some(markerId => values.includes(markerId));
};

export const LeadPerformancePanel: React.FC<{
  leads: LeadRecord[];
  saleUsers: UserProfile[];
  isOverdue: (lead: LeadRecord) => boolean;
  onOpenSale: (saleId: string) => void;
}> = ({ leads, saleUsers, isOverdue, onOpenSale }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState('all');
  const years = Array.from(new Set([currentYear, ...leads.map(lead => new Date(lead.createdAt).getFullYear()).filter(Number.isFinite)])).sort((a, b) => b - a);
  const periodLeads = leads.filter(lead => {
    const createdAt = new Date(lead.createdAt);
    return createdAt.getFullYear() === year && (month === 'all' || createdAt.getMonth() + 1 === Number(month));
  });
  const rows = saleUsers.map(sale => {
    const discovered = periodLeads.filter(lead => (lead.discoveredById || lead.createdById) === sale.uid);
    const assigned = periodLeads.filter(lead => lead.assignedSaleId === sale.uid);
    const contacted = discovered.filter(lead => lead.stage !== 'new' || hasAnyMarker(lead, ['contacted', 'discussing']));
    const quoted = discovered.filter(lead => ['quoted', 'negotiating', 'won', 'converted'].includes(lead.stage) || hasAnyMarker(lead, ['preparing_quote', 'quote_sent', 'quote_received']));
    const negotiating = discovered.filter(lead => lead.stage === 'negotiating' || hasAnyMarker(lead, ['negotiating', 'price_negotiation', 'quantity_negotiation', 'payment_negotiation']));
    const converted = discovered.filter(lead => lead.stage === 'converted');
    return {
      sale,
      discovered: discovered.length,
      assigned: assigned.length,
      contacted: contacted.length,
      quoted: quoted.length,
      negotiating: negotiating.length,
      converted: converted.length,
      conversionRate: discovered.length > 0 ? converted.length / discovered.length * 100 : 0,
      overdue: assigned.filter(isOverdue).length,
      potentialValue: discovered.reduce((sum, lead) => sum + Number(lead.potentialValue || 0), 0)
    };
  }).sort((a, b) => b.converted - a.converted || b.discovered - a.discovered);

  return (
    <section className="lead-performance-panel">
      <div className="lead-performance-header">
        <div><BarChart3 size={19} /><div><strong>Hiệu quả tìm kiếm và chuyển đổi Lead</strong><span>Tính theo người tìm được Lead trong kỳ.</span></div></div>
        <div><select value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(item => <option key={item} value={item}>{item}</option>)}</select><select value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tất cả tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></div>
      </div>
      <div className="table-container">
        <table className="lead-performance-table">
          <thead><tr><th>Sale</th><th>Lead tìm được</th><th>Được giao</th><th>Đã liên hệ</th><th>Đã báo giá</th><th>Đàm phán</th><th>Chuyển đổi</th><th>Tỷ lệ</th><th>Quá hạn</th><th>Giá trị tiềm năng</th></tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.sale.uid} onClick={() => onOpenSale(row.sale.uid)}><td><button type="button">{row.sale.displayName}</button></td><td>{row.discovered}</td><td>{row.assigned}</td><td>{row.contacted}</td><td>{row.quoted}</td><td>{row.negotiating}</td><td><strong>{row.converted}</strong></td><td><strong>{row.conversionRate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong></td><td className={row.overdue > 0 ? 'is-danger' : ''}>{row.overdue}</td><td>{row.potentialValue.toLocaleString('vi-VN')} đ</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={10} className="lead-empty">Chưa có dữ liệu Sale trong kỳ.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
