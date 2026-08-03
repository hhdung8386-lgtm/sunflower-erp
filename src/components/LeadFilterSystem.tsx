import React, { useState } from 'react';
import { Pencil, Save, Settings2, UserRoundSearch, X } from 'lucide-react';
import type {
  LeadCustomFieldType,
  LeadFilterDefinition,
  LeadRecord
} from '../domain/crmModels';
import {
  findLeadFilterOption,
  getLeadFilterValues,
  LEAD_FILTER_IDS,
  slugifyLeadFilterId
} from '../domain/leadFilterConfig';
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

export const LeadDynamicFields: React.FC<{
  lead: LeadRecord;
  definitions: LeadFilterDefinition[];
  canEditAll: boolean;
  onChange: (field: LeadFilterDefinition, value: string, checked?: boolean) => void;
}> = ({ lead, definitions, canEditAll, onChange }) => {
  const values = getLeadFilterValues(lead, definitions);

  return (
    <div className="lead-compact-filters">
      {definitions.filter(field => field.active).map(field => {
        const fieldValues = values[field.id] || [];
        const disabled = !canEditAll && !field.saleEditable;
        const activeOptions = field.options.filter(item => item.active);

        if (field.type === 'multi_select') {
          const selectedLabels = activeOptions
            .filter(item => fieldValues.includes(item.id))
            .map(item => item.label);
          const summary = selectedLabels.length === 0
            ? 'Chưa chọn'
            : selectedLabels.length <= 2 ? selectedLabels.join(', ') : `${selectedLabels.length} lựa chọn`;

          return (
            <div key={field.id} className="lead-compact-filter-row">
              <span>{field.name}</span>
              <details className="lead-compact-filter-menu">
                <summary className={selectedLabels.length > 0 ? 'has-value' : ''}>{summary}</summary>
                <div className="lead-compact-filter-options">
                  {activeOptions.map(item => (
                    <label key={item.id} className={fieldValues.includes(item.id) ? 'is-checked' : ''}>
                      <input
                        type="checkbox"
                        checked={fieldValues.includes(item.id)}
                        disabled={disabled}
                        onChange={event => onChange(field, item.id, event.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          );
        }

        if (field.type === 'single_select') {
          return (
            <label key={field.id} className="lead-compact-filter-row">
              <span>{field.name}</span>
              <select value={fieldValues[0] || ''} disabled={disabled} onChange={event => onChange(field, event.target.value)}>
                <option value="">Chưa chọn</option>
                {activeOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          );
        }

        if (field.type === 'checkbox') {
          return (
            <label key={field.id} className="lead-compact-filter-row lead-compact-filter-row--checkbox">
              <span>{field.name}</span>
              <input type="checkbox" checked={fieldValues[0] === 'true'} disabled={disabled} onChange={event => onChange(field, 'true', event.target.checked)} />
            </label>
          );
        }

        return (
          <label key={`${lead.id}-${field.id}-${fieldValues[0] || ''}`} className="lead-compact-filter-row">
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

const LEAD_STAGE_LABELS: Record<string, string> = {
  new: 'Mới tiếp nhận',
  contacted: 'Đã liên hệ',
  quoted: 'Đã báo giá',
  negotiating: 'Đang đàm phán',
  won: 'Thành công',
  lost: 'Không thành công',
  converted: 'Đã chuyển đổi'
};

export const LeadSalesWorkspace: React.FC<{
  leads: LeadRecord[];
  saleUsers: UserProfile[];
  definitions: LeadFilterDefinition[];
  onOpenLead: (leadId: string) => void;
}> = ({ leads, saleUsers, definitions, onOpenLead }) => {
  const currentYear = new Date().getFullYear();
  const [selectedSaleId, setSelectedSaleId] = useState(saleUsers[0]?.uid || '');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState('all');
  const years = Array.from(new Set([currentYear, ...leads.map(lead => new Date(lead.createdAt).getFullYear()).filter(Number.isFinite)])).sort((a, b) => b - a);
  const periodLeads = leads.filter(lead => {
    const createdAt = new Date(lead.createdAt);
    return createdAt.getFullYear() === year && (month === 'all' || createdAt.getMonth() + 1 === Number(month));
  });
  const selectedSale = saleUsers.find(sale => sale.uid === selectedSaleId) || saleUsers[0];
  const saleLeads = selectedSale
    ? periodLeads.filter(lead => (
      (lead.discoveredById || lead.createdById) === selectedSale.uid
      || lead.assignedSaleId === selectedSale.uid
    ))
    : [];
  const discoveredLeads = selectedSale
    ? saleLeads.filter(lead => (lead.discoveredById || lead.createdById) === selectedSale.uid)
    : [];
  const assignedLeads = selectedSale
    ? saleLeads.filter(lead => lead.assignedSaleId === selectedSale.uid)
    : [];
  const convertedLeads = discoveredLeads.filter(lead => lead.stage === 'converted');
  const conversionRate = discoveredLeads.length > 0
    ? convertedLeads.length / discoveredLeads.length * 100
    : 0;
  const potentialValue = saleLeads.reduce((sum, lead) => sum + Number(lead.potentialValue || 0), 0);

  const getRelationshipLabel = (lead: LeadRecord) => {
    const discovered = (lead.discoveredById || lead.createdById) === selectedSale?.uid;
    const assigned = lead.assignedSaleId === selectedSale?.uid;
    if (discovered && assigned) return 'Sale tìm & phụ trách';
    return discovered ? 'Sale tìm được' : 'Được phân công';
  };

  const getProgressLabel = (lead: LeadRecord) => {
    const optionId = getLeadFilterValues(lead, definitions)[LEAD_FILTER_IDS.progress]?.at(-1);
    return (optionId && findLeadFilterOption(definitions, LEAD_FILTER_IDS.progress, optionId)?.label)
      || LEAD_STAGE_LABELS[lead.stage]
      || 'Chưa cập nhật';
  };

  const getNeedLabel = (lead: LeadRecord) => {
    const optionIds = getLeadFilterValues(lead, definitions)[LEAD_FILTER_IDS.productNeed] || [];
    const labels = optionIds
      .map(optionId => findLeadFilterOption(definitions, LEAD_FILTER_IDS.productNeed, optionId)?.label)
      .filter(Boolean);
    return labels.join(', ') || 'Chưa xác định';
  };

  return (
    <section className="lead-sales-workspace">
      <div className="lead-sales-workspace__header">
        <div>
          <UserRoundSearch size={20} />
          <div><strong>Khách hàng của Sale</strong><span>Chọn nhân viên để xem danh sách Lead và hiệu quả chuyển đổi trong kỳ.</span></div>
        </div>
        <div className="lead-sales-workspace__selectors">
          <label>Nhân viên Sale<select value={selectedSale?.uid || ''} onChange={event => setSelectedSaleId(event.target.value)} disabled={saleUsers.length === 0}>{saleUsers.length === 0 && <option value="">Chưa có tài khoản Sale</option>}{saleUsers.map(sale => <option key={sale.uid} value={sale.uid}>{sale.displayName}</option>)}</select></label>
          <label>Năm<select value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Tháng<select value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tất cả</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></label>
        </div>
      </div>
      <div className="lead-sales-metrics">
        <div><span>Tổng Lead liên quan</span><strong>{saleLeads.length}</strong></div>
        <div><span>Sale tìm được</span><strong>{discoveredLeads.length}</strong></div>
        <div><span>Được phân công</span><strong>{assignedLeads.length}</strong></div>
        <div><span>Đã chuyển đổi</span><strong>{convertedLeads.length}</strong></div>
        <div><span>Tỷ lệ chuyển đổi</span><strong>{conversionRate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong></div>
        <div><span>Giá trị tiềm năng</span><strong>{potentialValue.toLocaleString('vi-VN')} đ</strong></div>
      </div>
      <div className="table-container">
        <table className="lead-sales-table">
          <thead><tr><th>Doanh nghiệp</th><th>Liên hệ</th><th>Quan hệ với Sale</th><th>Tiến độ</th><th>Nhu cầu</th><th>Giá trị tiềm năng</th><th></th></tr></thead>
          <tbody>
            {saleLeads.map(lead => (
              <tr key={lead.id}>
                <td><strong>{lead.companyName}</strong></td>
                <td>{lead.contactPerson || '—'}<span>{lead.phone || lead.email || 'Chưa có liên hệ'}</span></td>
                <td><span className="lead-sale-relation">{getRelationshipLabel(lead)}</span></td>
                <td>{getProgressLabel(lead)}</td>
                <td>{getNeedLabel(lead)}</td>
                <td><strong>{Number(lead.potentialValue || 0).toLocaleString('vi-VN')} đ</strong></td>
                <td><button type="button" className="btn btn-sm btn-outline" onClick={() => onOpenLead(lead.id)}>Chi tiết</button></td>
              </tr>
            ))}
            {saleLeads.length === 0 && <tr><td colSpan={7} className="lead-empty">Sale này chưa có khách hàng tiềm năng trong kỳ đã chọn.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
