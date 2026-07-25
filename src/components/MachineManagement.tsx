import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Pencil,
  PlayCircle,
  Plus,
  Power,
  Printer,
  Wrench,
  X
} from 'lucide-react';
import { dbService } from '../services/firebaseService';
import {
  getMachineCommands,
  getMachineForAssignment,
  getMachineRuntimeStatus,
  getMachineStatusLabel,
  isActiveProductionCommand,
  MachineStatus,
  ProductionCommandLike,
  ProductionMachine
} from '../services/machineService';

interface MachineManagementProps {
  view: 'schedule' | 'machines';
  machines: ProductionMachine[];
  productionCommands: ProductionCommandLike[];
  canManage: boolean;
}

interface MachineFormState {
  code: string;
  name: string;
  type: string;
  colorCount: number;
  maxWidthMm: number;
  capacityPerHour: number;
  supportedMaterials: string;
  status: MachineStatus;
  notes: string;
}

const EMPTY_FORM: MachineFormState = {
  code: '',
  name: '',
  type: 'Flexo',
  colorCount: 4,
  maxWidthMm: 330,
  capacityPerHour: 10000,
  supportedMaterials: '',
  status: 'available',
  notes: ''
};

const statusClassName = (status: string): string => `machine-status machine-status--${status}`;

const formatDate = (value: unknown): string => {
  if (!value) return 'Chưa đặt';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Chưa đặt' : date.toLocaleDateString('vi-VN');
};

export const MachineManagement: React.FC<MachineManagementProps> = ({
  view,
  machines,
  productionCommands,
  canManage
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<ProductionMachine | null>(null);
  const [form, setForm] = useState<MachineFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const activeCommands = useMemo(
    () => productionCommands.filter(isActiveProductionCommand),
    [productionCommands]
  );

  const machineRows = useMemo(() => machines.map(machine => {
    const commands = getMachineCommands(machine, activeCommands);
    return {
      machine,
      commands,
      runtimeStatus: getMachineRuntimeStatus(machine, activeCommands)
    };
  }), [machines, activeCommands]);

  const unassignedCommands = useMemo(
    () => activeCommands.filter(command => !getMachineForAssignment(machines, command.machineId)),
    [activeCommands, machines]
  );
  const unassignedMachineNames = useMemo(() => Array.from(new Set(
    unassignedCommands.map(command => String(command.machineId || '').trim() || 'Chưa phân công')
  )), [unassignedCommands]);

  const openCreateModal = () => {
    setEditingMachine(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (machine: ProductionMachine) => {
    setEditingMachine(machine);
    setForm({
      code: machine.code,
      name: machine.name,
      type: machine.type,
      colorCount: machine.colorCount,
      maxWidthMm: machine.maxWidthMm,
      capacityPerHour: machine.capacityPerHour,
      supportedMaterials: machine.supportedMaterials.join(', '),
      status: machine.status,
      notes: machine.notes
    });
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const normalizedCode = form.code.trim().toLocaleLowerCase('vi');
    const normalizedName = form.name.trim().toLocaleLowerCase('vi');
    const duplicate = machines.find(machine => (
      machine.id !== editingMachine?.id &&
      (machine.code.trim().toLocaleLowerCase('vi') === normalizedCode ||
        machine.name.trim().toLocaleLowerCase('vi') === normalizedName)
    ));
    if (duplicate) {
      window.alert(`Mã máy hoặc tên máy đã tồn tại (${duplicate.code} - ${duplicate.name}).`);
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type.trim(),
      colorCount: Math.max(0, Number(form.colorCount) || 0),
      maxWidthMm: Math.max(0, Number(form.maxWidthMm) || 0),
      capacityPerHour: Math.max(0, Number(form.capacityPerHour) || 0),
      supportedMaterials: form.supportedMaterials
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      status: form.status,
      notes: form.notes.trim()
    };

    setSaving(true);
    try {
      if (editingMachine) {
        await dbService.updateDocument('machines', editingMachine.id, payload);
      } else {
        await dbService.addDocument('machines', payload);
      }
      setShowModal(false);
      setEditingMachine(null);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (machine: ProductionMachine) => {
    const runningCommands = getMachineCommands(machine, activeCommands);
    if (runningCommands.length > 0) {
      window.alert(`Không thể ngừng ${machine.name} vì đang có ${runningCommands.length} LSX hoạt động.`);
      return;
    }
    if (!window.confirm(`Ngừng sử dụng ${machine.code} - ${machine.name}? Dữ liệu LSX cũ vẫn được giữ nguyên.`)) return;
    await dbService.updateDocument('machines', machine.id, { status: 'inactive' });
  };

  if (view === 'schedule') {
    const runningCount = machineRows.filter(row => row.runtimeStatus === 'running').length;
    const availableCount = machineRows.filter(row => row.runtimeStatus === 'available').length;
    const unavailableCount = machineRows.filter(row => ['maintenance', 'fault'].includes(row.runtimeStatus)).length;

    return (
      <div className="machine-workspace">
        <div className="machine-summary-grid">
          <div className="machine-summary-card">
            <Printer size={22} />
            <div><strong>{machines.length}</strong><span>Tổng số máy</span></div>
          </div>
          <div className="machine-summary-card machine-summary-card--running">
            <PlayCircle size={22} />
            <div><strong>{runningCount}</strong><span>Máy đang chạy</span></div>
          </div>
          <div className="machine-summary-card machine-summary-card--available">
            <CheckCircle2 size={22} />
            <div><strong>{availableCount}</strong><span>Máy sẵn sàng</span></div>
          </div>
          <div className="machine-summary-card machine-summary-card--warning">
            <Wrench size={22} />
            <div><strong>{unavailableCount}</strong><span>Bảo trì / lỗi</span></div>
          </div>
        </div>

        {unassignedCommands.length > 0 && (
          <div className="machine-alert">
            <AlertTriangle size={18} />
            <div>
              <strong>{unassignedCommands.length} LSX đang dùng tên máy chưa có trong danh mục.</strong>
              <span>Hãy bổ sung hoặc phân công máy tương ứng để theo dõi tải máy đầy đủ: {unassignedMachineNames.join(', ')}.</span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="machine-section-heading">
            <div>
              <span className="card-title">Bảng tải máy sản xuất</span>
              <p>Theo dõi máy đang chạy, người vận hành và hạn giao của từng LSX.</p>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Máy sản xuất</th>
                  <th>Thông số chính</th>
                  <th>Trạng thái</th>
                  <th>LSX đang chạy</th>
                  <th>Ca / người vận hành</th>
                  <th>Hạn giao</th>
                </tr>
              </thead>
              <tbody>
                {machineRows.map(({ machine, commands, runtimeStatus }) => (
                  <tr key={machine.id}>
                    <td>
                      <strong>{machine.code}</strong>
                      <span className="machine-cell-subtitle">{machine.name}</span>
                    </td>
                    <td>{machine.type} · {machine.colorCount || '—'} màu · khổ {machine.maxWidthMm || '—'} mm</td>
                    <td><span className={statusClassName(runtimeStatus)}>{getMachineStatusLabel(runtimeStatus)}</span></td>
                    <td>
                      {commands.length > 0 ? commands.map(command => (
                        <div className="machine-command" key={command.id}>
                          <strong>{command.lsxCode}</strong>
                          <span>{command.poCode} · {command.productNameToBeCut || command.productName}</span>
                        </div>
                      )) : <span className="machine-empty">Chưa có lệnh</span>}
                    </td>
                    <td>
                      {commands.length > 0 ? commands.map(command => (
                        <div className="machine-command" key={command.id}>
                          <strong>{command.shift || 'Chưa đặt ca'}</strong>
                          <span>{command.operatorName || 'Chưa phân công'}</span>
                        </div>
                      )) : '—'}
                    </td>
                    <td>
                      {commands.length > 0 ? commands.map(command => (
                        <div className="machine-command" key={command.id}>{formatDate(command.deliveryDeadline)}</div>
                      )) : '—'}
                    </td>
                  </tr>
                ))}
                {machineRows.length === 0 && (
                  <tr><td colSpan={6} className="machine-table-empty">Chưa có máy nào trong danh mục.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="machine-workspace">
      <div className="card">
        <div className="machine-section-heading">
          <div>
            <span className="card-title">Danh mục máy sản xuất</span>
            <p>Quản lý thông số, tình trạng và năng lực cơ bản của từng máy.</p>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Thêm máy
            </button>
          )}
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã máy</th>
                <th>Tên máy</th>
                <th>Loại máy</th>
                <th>Số màu</th>
                <th>Khổ tối đa</th>
                <th>Năng suất tham khảo</th>
                <th>Vật liệu phù hợp</th>
                <th>Trạng thái</th>
                {canManage && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {machineRows.map(({ machine, runtimeStatus }) => (
                <tr key={machine.id}>
                  <td><strong>{machine.code}</strong></td>
                  <td>
                    <strong>{machine.name}</strong>
                    {machine.notes && <span className="machine-cell-subtitle">{machine.notes}</span>}
                  </td>
                  <td>{machine.type}</td>
                  <td>{machine.colorCount || '—'}</td>
                  <td>{machine.maxWidthMm ? `${machine.maxWidthMm} mm` : '—'}</td>
                  <td>{machine.capacityPerHour ? `${machine.capacityPerHour.toLocaleString('vi-VN')} sp/giờ` : '—'}</td>
                  <td>{machine.supportedMaterials.join(', ') || 'Chưa khai báo'}</td>
                  <td><span className={statusClassName(runtimeStatus)}>{getMachineStatusLabel(runtimeStatus)}</span></td>
                  {canManage && (
                    <td>
                      <div className="machine-actions">
                        <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditModal(machine)} title="Chỉnh sửa máy">
                          <Pencil size={14} />
                        </button>
                        {machine.status !== 'inactive' && (
                          <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleDeactivate(machine)} title="Ngừng sử dụng">
                            <Power size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {machineRows.length === 0 && (
                <tr><td colSpan={canManage ? 9 : 8} className="machine-table-empty">Chưa có máy nào trong danh mục.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content machine-modal">
            <div className="modal-header">
              <div>
                <strong>{editingMachine ? 'Cập nhật máy sản xuất' : 'Thêm máy sản xuất'}</strong>
                <span>Khai báo thông số vừa đủ để điều phối LSX.</span>
              </div>
              <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => setShowModal(false)} title="Đóng">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body machine-form">
                <div className="form-grid machine-form-grid">
                  <div className="form-group">
                    <label>Mã máy *</label>
                    <input value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} placeholder="VD: M-05" required />
                  </div>
                  <div className="form-group">
                    <label>Tên máy *</label>
                    <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="VD: Máy in Flexo 6 màu" required />
                  </div>
                </div>
                <div className="form-grid machine-form-grid machine-form-grid--three">
                  <div className="form-group">
                    <label>Loại máy *</label>
                    <select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))}>
                      <option value="Flexo">Flexo</option>
                      <option value="Offset">Offset</option>
                      <option value="Kỹ thuật số">Kỹ thuật số</option>
                      <option value="Bế">Bế</option>
                      <option value="Gia công">Gia công</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Số màu</label>
                    <input type="number" min="0" value={form.colorCount} onChange={event => setForm(current => ({ ...current, colorCount: Number(event.target.value) }))} />
                  </div>
                  <div className="form-group">
                    <label>Khổ tối đa (mm)</label>
                    <input type="number" min="0" value={form.maxWidthMm} onChange={event => setForm(current => ({ ...current, maxWidthMm: Number(event.target.value) }))} />
                  </div>
                </div>
                <div className="form-grid machine-form-grid">
                  <div className="form-group">
                    <label>Năng suất tham khảo (sp/giờ)</label>
                    <div className="machine-input-with-icon"><Gauge size={16} /><input type="number" min="0" value={form.capacityPerHour} onChange={event => setForm(current => ({ ...current, capacityPerHour: Number(event.target.value) }))} /></div>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái quản lý</label>
                    <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as MachineStatus }))}>
                      <option value="available">Sẵn sàng</option>
                      <option value="maintenance">Bảo trì</option>
                      <option value="fault">Đang lỗi</option>
                      <option value="inactive">Ngừng sử dụng</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Vật liệu phù hợp (phân cách bằng dấu phẩy)</label>
                  <input value={form.supportedMaterials} onChange={event => setForm(current => ({ ...current, supportedMaterials: event.target.value }))} placeholder="Decal giấy, decal nhựa, màng PET" />
                </div>
                <div className="form-group">
                  <label>Ghi chú vận hành</label>
                  <textarea rows={3} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Điểm mạnh, hạn chế hoặc lưu ý khi chọn máy..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu máy'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
