import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { FloatingChat } from '../components/FloatingChat';
import { MachineManagement } from '../components/MachineManagement';
import {
  DEFAULT_MACHINES,
  getMachineCommands,
  getMachineForAssignment,
  getMachineRuntimeStatus,
  getMachineStatusLabel,
  getRequiredColorCount,
  PurchaseOrderLike,
  ProductionMachine,
  sortMachinesForAssignment,
  subscribeMachines
} from '../services/machineService';
import { AlertTriangle, CalendarDays, FileSpreadsheet, Info, ListChecks, Pencil, Settings2, Trash2, X } from 'lucide-react';
import './Production.css';

interface ProductionProps {
  pos: any[];
  productionCommands: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
  initialSelectedLsxId?: string;
  messages: any[];
  users: any[];
}

const getProductionQuantity = (command: any): number => {
  const quantity = Number(command?.qtyToProduce ?? command?.quantity ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
};

export const Production: React.FC<ProductionProps> = ({ pos, productionCommands, currentUser, onRefresh, initialSelectedLsxId, messages, users }) => {
  const { t } = useLanguage();
  const [showAddLsxModal, setShowAddLsxModal] = useState(false);
  const [showEditLsxModal, setShowEditLsxModal] = useState(false);
  const [selectedLsx, setSelectedLsx] = useState<any | null>(null);

  // LSX Transfer states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [targetOperatorId, setTargetOperatorId] = useState('');

  // Auto-select LSX when initialSelectedLsxId changes
  useEffect(() => {
    if (initialSelectedLsxId) {
      const cmd = productionCommands.find(c => c.id === initialSelectedLsxId || c.lsxCode === initialSelectedLsxId);
      if (cmd) {
        setSelectedLsx(cmd);
      }
    }
  }, [initialSelectedLsxId, productionCommands]);

  // Form states
  const [linkedPoId, setLinkedPoId] = useState('');
  const [machineId, setMachineId] = useState('Máy Flexo 8 màu OMET');
  const [shift, setShift] = useState('Ca Sáng (08:00 - 18:00)');
  const [operatorName, setOperatorName] = useState('Thành Vũ (Sản xuất)');
  const [qtyToProduce, setQtyToProduce] = useState(10000);
  const [notes, setNotes] = useState('');

  // Additional technical fields
  const [productNameToBeCut, setProductNameToBeCut] = useState('');
  const [paperCore, setPaperCore] = useState('76mm');
  const [paperMaterialCode, setPaperMaterialCode] = useState('Decal Giấy thường Fasson AW0339F');
  const [paperQuantity, setPaperQuantity] = useState(10);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');

  // Edit form states
  const [editMachineId, setEditMachineId] = useState('');
  const [editShift, setEditShift] = useState('');
  const [editOperatorName, setEditOperatorName] = useState('');
  const [editQtyToProduce, setEditQtyToProduce] = useState(10000);
  const [editNotes, setEditNotes] = useState('');

  const [editProductNameToBeCut, setEditProductNameToBeCut] = useState('');
  const [editPaperCore, setEditPaperCore] = useState('76mm');
  const [editPaperMaterialCode, setEditPaperMaterialCode] = useState('');
  const [editPaperQuantity, setEditPaperQuantity] = useState(1);
  const [editDeliveryDeadline, setEditDeliveryDeadline] = useState('');

  // Complete LSX states
  const [scrapQty, setScrapQty] = useState(0);
  const [completionNotes, setCompletionNotes] = useState('');

  // Operator view tab filter
  const [operatorTab, setOperatorTab] = useState<'producing' | 'completed'>('producing');
  const [productionTab, setProductionTab] = useState<'commands' | 'schedule' | 'machines'>('commands');
  const [machines, setMachines] = useState<ProductionMachine[]>([]);

  useEffect(() => subscribeMachines(setMachines), []);

  useEffect(() => {
    // Auto select first PO if available
    const activePOs = pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed');
    if (activePOs.length > 0) {
      const firstPo = activePOs[0];
      setLinkedPoId(firstPo.id);
      const item = firstPo.items?.[0] || {};
      setQtyToProduce(item.quantity || 10000);
      setProductNameToBeCut(item.productName || '');
      setDeliveryDeadline(firstPo.expectedDeliveryDate ? new Date(firstPo.expectedDeliveryDate).toISOString().split('T')[0] : '');
      
      if (item.specifications) {
        if (item.specifications.core) setPaperCore(item.specifications.core);
        if (item.specifications.paperMaterial) setPaperMaterialCode(item.specifications.paperMaterial);
      }
    }
  }, [pos]);

  const machineCatalog = machines.length > 0 ? machines : DEFAULT_MACHINES;

  const getPreferredMachine = (po?: PurchaseOrderLike): ProductionMachine | undefined => {
    const requiredColors = getRequiredColorCount(po);
    return sortMachinesForAssignment(machineCatalog, productionCommands, requiredColors)
      .find(machine => machine.status === 'available' && (requiredColors === 0 || machine.colorCount >= requiredColors));
  };

  const validateMachineAssignment = (
    assignment: string,
    po?: PurchaseOrderLike,
    excludeCommandId?: string
  ): boolean => {
    const machine = getMachineForAssignment(machineCatalog, assignment);
    if (!machine) return true;

    if (machine.status === 'maintenance' || machine.status === 'fault' || machine.status === 'inactive') {
      window.alert(`${machine.code} - ${machine.name} hiện ở trạng thái "${getMachineStatusLabel(machine.status)}" nên chưa thể nhận LSX.`);
      return false;
    }

    const requiredColors = getRequiredColorCount(po);
    if (requiredColors > 0 && machine.colorCount > 0 && machine.colorCount < requiredColors) {
      const shouldContinue = window.confirm(
        `Đơn hàng được nhận diện cần ${requiredColors} màu nhưng ${machine.name} chỉ khai báo ${machine.colorCount} màu. Bạn vẫn muốn phân công máy này?`
      );
      if (!shouldContinue) return false;
    }

    const conflictingCommands = getMachineCommands(machine, productionCommands, excludeCommandId);
    if (conflictingCommands.length > 0) {
      return window.confirm(
        `${machine.name} đang có ${conflictingCommands.length} LSX hoạt động (${conflictingCommands.map(command => command.lsxCode).join(', ')}). Bạn vẫn muốn xếp thêm lệnh vào máy này?`
      );
    }
    return true;
  };

  const handleOpenAddLsx = () => {
    const activePOs = pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed');
    if (activePOs.length === 0) {
      alert('Không có đơn hàng nào ở trạng thái "Chờ sản xuất" hoặc "NCC xác nhận vật tư đủ" để lập lệnh!');
      return;
    }
    const firstPo = activePOs[0];
    setLinkedPoId(firstPo.id);
    const item = firstPo.items?.[0] || {};
    setQtyToProduce(item.quantity || 10000);
    setProductNameToBeCut(item.productName || '');
    setDeliveryDeadline(firstPo.expectedDeliveryDate ? new Date(firstPo.expectedDeliveryDate).toISOString().split('T')[0] : '');
    const preferredMachine = getPreferredMachine(firstPo);
    if (preferredMachine) setMachineId(preferredMachine.name);
    setShowAddLsxModal(true);
  };

  const handleCreateLsx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedPoId) return;

    const po = pos.find(p => p.id === linkedPoId);
    if (!po) return;
    if (!validateMachineAssignment(machineId, po)) return;

    const lsxCode = `LSX-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newLsx = {
      lsxCode,
      poId: linkedPoId,
      poCode: po.poCode,
      productName: po.items?.[0]?.productName || 'Tem nhãn',
      qtyToProduce: Number(qtyToProduce),
      machineId,
      shift,
      operatorId: currentUser.uid,
      operatorName: operatorName,
      status: 'producing',
      scrapQty: 0,
      notes,
      productNameToBeCut: productNameToBeCut || po.items?.[0]?.productName || 'Tem nhãn',
      paperCore,
      paperMaterialCode,
      paperQuantity: Number(paperQuantity),
      deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline).toISOString() : po.expectedDeliveryDate,
      startedAt: new Date().toISOString(),
      completedAt: '',
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('production_commands', newLsx);

    // Update customer PO status to "producing"
    const updatedLogs = [
      ...po.historyLogs,
      {
        status: 'producing',
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Phát hành Lệnh sản xuất ${lsxCode} giao phó thợ máy ${operatorName} đứng máy in ${machineId}.`
      }
    ];

    await dbService.updateDocument('pos', po.id, {
      status: 'producing',
      historyLogs: updatedLogs
    });

    setShowAddLsxModal(false);
    setNotes('');
    onRefresh();
  };

  const handleOpenEditLsx = (lsx: any) => {
    setEditMachineId(lsx.machineId);
    setEditShift(lsx.shift);
    setEditOperatorName(lsx.operatorName || '');
    setEditQtyToProduce(getProductionQuantity(lsx));
    setEditNotes(lsx.notes || '');
    setEditProductNameToBeCut(lsx.productNameToBeCut || lsx.productName || '');
    setEditPaperCore(lsx.paperCore || '76mm');
    setEditPaperMaterialCode(lsx.paperMaterialCode || '');
    setEditPaperQuantity(lsx.paperQuantity || 1);
    setEditDeliveryDeadline(lsx.deliveryDeadline ? new Date(lsx.deliveryDeadline).toISOString().split('T')[0] : '');
    setSelectedLsx(lsx);
    setShowEditLsxModal(true);
  };

  const handleEditLsxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLsx) return;
    const linkedPo = pos.find(po => po.id === selectedLsx.poId);
    if (!validateMachineAssignment(editMachineId, linkedPo, selectedLsx.id)) return;

    await dbService.updateDocument('production_commands', selectedLsx.id, {
      machineId: editMachineId,
      shift: editShift,
      operatorName: editOperatorName,
      qtyToProduce: Number(editQtyToProduce),
      notes: editNotes,
      productNameToBeCut: editProductNameToBeCut,
      paperCore: editPaperCore,
      paperMaterialCode: editPaperMaterialCode,
      paperQuantity: Number(editPaperQuantity),
      deliveryDeadline: editDeliveryDeadline ? new Date(editDeliveryDeadline).toISOString() : selectedLsx.deliveryDeadline,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditLsxModal(false);
    setSelectedLsx(null);
    onRefresh();
  };

  const handleDeleteLsx = async (lsxId: string) => {
    const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (admin123 hoặc 123456):'));
    if (password !== 'admin123' && password !== '123456') {
      alert(t('Mật khẩu không chính xác! Không thể xóa.'));
      return;
    }
    if (window.confirm(t('Bạn có chắc chắn muốn xóa lệnh sản xuất này?'))) {
      const lsx = productionCommands.find(l => l.id === lsxId);
      await dbService.updateDocument('production_commands', lsxId, { deleted: true });
      
      if (lsx) {
        const po = pos.find(p => p.id === lsx.poId);
        if (po) {
          const updatedLogs = [
            ...po.historyLogs,
            {
              status: 'supplier_confirmed',
              updatedBy: currentUser.displayName,
              updatedAt: new Date().toISOString(),
              note: `Đã hủy lệnh sản xuất ${lsx.lsxCode}. Trạng thái PO quay lại chờ sản xuất.`
            }
          ];
          await dbService.updateDocument('pos', po.id, {
            status: 'supplier_confirmed',
            historyLogs: updatedLogs
          });
        }
      }

      setSelectedLsx(null);
      onRefresh();
    }
  };

  const activeCommands = (productionCommands || []).filter(cmd => !cmd.deleted);
  const selectedPoForCreate = pos.find(po => po.id === linkedPoId);
  const requiredColorsForCreate = getRequiredColorCount(selectedPoForCreate);
  const createMachineOptions = sortMachinesForAssignment(machineCatalog, activeCommands, requiredColorsForCreate)
    .filter(machine => machine.status !== 'inactive');
  const selectedMachineForCreate = getMachineForAssignment(machineCatalog, machineId);
  const selectedMachineStatusForCreate = selectedMachineForCreate
    ? getMachineRuntimeStatus(selectedMachineForCreate, activeCommands)
    : undefined;
  const recommendedMachineForCreate = createMachineOptions.find(machine => (
    machine.status === 'available' &&
    getMachineRuntimeStatus(machine, activeCommands) === 'available' &&
    (requiredColorsForCreate === 0 || machine.colorCount >= requiredColorsForCreate)
  ));

  const getMachineOptionLabel = (machine: ProductionMachine, excludeCommandId?: string): string => {
    const runtimeStatus = getMachineRuntimeStatus(machine, activeCommands, excludeCommandId);
    const colorLabel = machine.colorCount > 0 ? `${machine.colorCount} màu` : 'chưa khai báo số màu';
    return `${machine.code} - ${machine.name} (${colorLabel} · ${getMachineStatusLabel(runtimeStatus)})`;
  };

  const handleExportCSV = () => {
    const headers = [
      t('Mã LSX'),
      t('Mã PO'),
      t('Tên Tem Cần Bế'),
      t('Máy Sản Xuất'),
      t('Ca Sản Xuất'),
      t('Lõi Giấy'),
      t('Giấy NVL'),
      t('SL Đặt'),
      t('Phế phẩm'),
      t('Trạng Thái'),
      t('Người Vận Hành'),
      t('Ngày Lập Lệnh'),
      t('Ngày Hoàn Thành')
    ];

    const rows = activeCommands.map(cmd => [
      cmd.lsxCode || '',
      cmd.poCode || '',
      cmd.productNameToBeCut || cmd.productName || '',
      cmd.machineId || '',
      cmd.shift || '',
      cmd.paperCore || '76mm',
      `${cmd.paperMaterialCode || ''} (${cmd.paperQuantity || 0} cuộn)`,
      getProductionQuantity(cmd),
      cmd.scrapQty || 0,
      cmd.status === 'completed' ? t('Đã hoàn thành') : cmd.status === 'transfer_pending' ? t('Bàn giao chờ duyệt') : t('Đang in'),
      cmd.operatorName || '',
      cmd.startedAt ? new Date(cmd.startedAt).toLocaleDateString('vi-VN') : '',
      cmd.completedAt ? new Date(cmd.completedAt).toLocaleDateString('vi-VN') : ''
    ]);

    let csvContent = '\uFEFF'; // BOM
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(val => {
        const strVal = String(val ?? '');
        return `"${strVal.replace(/"/g, '""')}"`;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ERP_DanhSach_LSX_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCompleteLsx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLsx) return;

    const now = new Date().toISOString();
    
    // Update LSX
    await dbService.updateDocument('production_commands', selectedLsx.id, {
      status: 'completed',
      scrapQty: Number(scrapQty),
      notes: `${selectedLsx.notes || ''} | Ghi chú hoàn thành: ${completionNotes}`,
      completedAt: now,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: now
    });

    // Update PO status to "production_done"
    const po = pos.find(p => p.id === selectedLsx.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'production_done',
          updatedBy: currentUser.displayName,
          updatedAt: now,
          note: `Lệnh sản xuất ${selectedLsx.lsxCode} hoàn thành. Số lượng in phế phẩm hao hụt: ${scrapQty}. Chuyển QC.`
        },
        {
          status: 'qc_passed',
          updatedBy: 'Hệ thống QC (Tự động)',
          updatedAt: now,
          note: 'QC kiểm tra đạt tiêu chuẩn chất lượng tem nhãn. Chuyển đóng gói.'
        },
        {
          status: 'packed',
          updatedBy: 'Kho đóng gói (Tự động)',
          updatedAt: now,
          note: 'Đơn hàng đóng thùng, dán nhãn giao hàng. Sẵn sàng chờ xe giao.'
        }
      ];

      await dbService.updateDocument('pos', po.id, {
        status: 'packed', // Advance straight to packed ready for delivery dispatching!
        historyLogs: updatedLogs
      });
    }

    // AUTO WAREHOUSE DEDUCTION FOR MATERIALS USED
    const invList = await dbService.getCollection('inventory');
    const completedQuantity = getProductionQuantity(selectedLsx);
    const decalQtyNeeded = Math.round(completedQuantity * 0.015); // e.g. 150sqm for 10k items
    const inkQtyNeeded = Math.round(completedQuantity * 0.0002 * 10) / 10; // e.g. 2kg

    // Deduct Decal
    const decalItem = invList.find((item: any) => item.category === 'paper');
    if (decalItem) {
      await dbService.updateDocument('inventory', decalItem.id, {
        qtyInStock: Math.max(0, Number(decalItem.qtyInStock) - decalQtyNeeded),
        updatedAt: now
      });
    }

    // Deduct Ink
    const inkItem = invList.find((item: any) => item.category === 'ink');
    if (inkItem) {
      await dbService.updateDocument('inventory', inkItem.id, {
        qtyInStock: Math.max(0, Number(inkItem.qtyInStock) - inkQtyNeeded),
        updatedAt: now
      });
    }

    setSelectedLsx(null);
    setScrapQty(0);
    setCompletionNotes('');
    onRefresh();
  };

  const handleOpenTransfer = (lsx: any) => {
    setSelectedLsx(lsx);
    const firstOtherOperator = users.find(u => u.role === 'producer' && u.uid !== currentUser.uid);
    setTargetOperatorId(firstOtherOperator?.uid || '');
    setTransferReason('');
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLsx || !targetOperatorId) return;

    const targetOp = users.find(u => u.uid === targetOperatorId);
    if (!targetOp) return;

    await dbService.updateDocument('production_commands', selectedLsx.id, {
      status: 'transfer_pending',
      proposedOperatorId: targetOperatorId,
      proposedOperatorName: targetOp.displayName,
      transferReason
    });

    // Write a timeline log for the PO
    const po = pos.find(p => p.id === selectedLsx.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'producing',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Thợ máy đề xuất chuyển lệnh sản xuất ${selectedLsx.lsxCode} sang thợ ${targetOp.displayName}. Lý do: ${transferReason}`
        }
      ];
      await dbService.updateDocument('pos', po.id, { historyLogs: updatedLogs });
    }

    setShowTransferModal(false);
    setSelectedLsx(null);
    setTransferReason('');
    setTargetOperatorId('');
    onRefresh();
  };

  const handleApproveTransfer = async (lsx: any) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn duyệt chuyển lệnh này sang thợ mới?'))) return;

    // Log to PO history
    const po = pos.find(p => p.id === lsx.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'producing',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Duyệt chuyển lệnh sản xuất ${lsx.lsxCode} từ thợ ${lsx.operatorName} sang thợ ${lsx.proposedOperatorName}. Lý do: ${lsx.transferReason}`
        }
      ];
      await dbService.updateDocument('pos', po.id, { historyLogs: updatedLogs });
    }

    // Update LSX
    await dbService.updateDocument('production_commands', lsx.id, {
      operatorId: lsx.proposedOperatorId,
      operatorName: lsx.proposedOperatorName,
      status: 'producing',
      proposedOperatorId: '',
      proposedOperatorName: '',
      transferReason: ''
    });

    onRefresh();
  };

  const handleRejectTransfer = async (lsx: any) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn từ chối yêu cầu chuyển lệnh?'))) return;

    // Log to PO history
    const po = pos.find(p => p.id === lsx.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'producing',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Từ chối chuyển lệnh sản xuất ${lsx.lsxCode} của thợ ${lsx.operatorName}. Lệnh tiếp tục chạy.`
        }
      ];
      await dbService.updateDocument('pos', po.id, { historyLogs: updatedLogs });
    }

    await dbService.updateDocument('production_commands', lsx.id, {
      status: 'producing',
      proposedOperatorId: '',
      proposedOperatorName: '',
      transferReason: ''
    });

    onRefresh();
  };

  const getPOItemImage = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    return po?.items?.[0]?.previewImage || '';
  };

  const isOperator = currentUser.role === 'producer';
  const canManageMachines = currentUser.role === 'admin' || currentUser.role === 'producer';

  return (
    <div className="production-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {productionTab === 'schedule'
              ? 'LỊCH VÀ TẢI MÁY SẢN XUẤT'
              : productionTab === 'machines'
                ? 'DANH MỤC MÁY SẢN XUẤT'
                : isOperator ? t('PHÒNG MÁY SẢN XUẤT - THỢ B') : t('LỆNH SẢN XUẤT (LSX)')}
          </h1>
          <p className="page-subtitle">
            {productionTab === 'schedule'
              ? 'Quan sát máy đang chạy, máy sẵn sàng và các LSX đang chiếm tải theo thời gian thực.'
              : productionTab === 'machines'
                ? 'Quản lý máy in, số màu, khổ in, năng suất và tình trạng vận hành.'
                : isOperator
                  ? t('Danh sách lệnh in và bế tem được phân công, thông số kỹ thuật lõi/giấy và bản vẽ layout thiết kế.')
                  : t('Phát hành lệnh sản xuất, phân bổ máy in, ca máy, thợ in và ghi nhận sản lượng hoàn thành, hao hụt.')}
          </p>
        </div>
        {productionTab === 'commands' && !isOperator && (currentUser.role === 'admin' || currentUser.role === 'producer' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={handleOpenAddLsx}>{t('PHÁT HÀNH LỆNH SẢN XUẤT (LSX) MỚI')}</button>
        )}
      </div>

      <div className="production-tabs" role="tablist" aria-label="Quản lý sản xuất">
        <button
          type="button"
          role="tab"
          aria-selected={productionTab === 'commands'}
          className={`production-tab ${productionTab === 'commands' ? 'is-active' : ''}`}
          onClick={() => setProductionTab('commands')}
        >
          <ListChecks size={16} /> Danh sách LSX
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={productionTab === 'schedule'}
          className={`production-tab ${productionTab === 'schedule' ? 'is-active' : ''}`}
          onClick={() => setProductionTab('schedule')}
        >
          <CalendarDays size={16} /> Lịch máy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={productionTab === 'machines'}
          className={`production-tab ${productionTab === 'machines' ? 'is-active' : ''}`}
          onClick={() => setProductionTab('machines')}
        >
          <Settings2 size={16} /> Danh mục máy
        </button>
      </div>

      {productionTab === 'schedule' ? (
        <MachineManagement
          view="schedule"
          machines={machineCatalog}
          productionCommands={activeCommands}
          canManage={canManageMachines}
        />
      ) : productionTab === 'machines' ? (
        <MachineManagement
          view="machines"
          machines={machineCatalog}
          productionCommands={activeCommands}
          canManage={canManageMachines}
        />
      ) : isOperator ? (
        /* THỢ B OPERATION VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid var(--color-border-light)', paddingBottom: '10px' }}>
            <button
              className={`btn ${operatorTab === 'producing' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOperatorTab('producing')}
            >
              {t('Lệnh Chờ & Đang Chạy Máy')}
            </button>
            <button
              className={`btn ${operatorTab === 'completed' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOperatorTab('completed')}
            >
              {t('Lịch Sử Lệnh Đã Hoàn Thành')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '20px' }}>
            {activeCommands
              .filter(cmd => {
                if (currentUser.role === 'producer' && cmd.operatorId !== currentUser.uid) {
                  return false;
                }
                if (operatorTab === 'producing') {
                  return cmd.status === 'producing' || cmd.status === 'transfer_pending';
                } else {
                  return cmd.status === 'completed';
                }
              })
              .map(cmd => (
                <div key={cmd.id} className="card" style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '15px' }}>{cmd.lsxCode}</span>
                    <span className={`badge ${
                      cmd.status === 'completed' ? 'badge-success' : 
                      cmd.status === 'transfer_pending' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {cmd.status === 'completed' ? t('Đã hoàn thành') : 
                       cmd.status === 'transfer_pending' ? t('Chờ duyệt chuyển') : t('Đang sản xuất')}
                    </span>
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                        <div><strong>{t('Tên sản phẩm cần bế:')}</strong> {cmd.productNameToBeCut}</div>
                        <div><strong>{t('Đơn PO liên kết:')}</strong> {cmd.poCode}</div>
                        <div><strong>{t('Số lượng tem yêu cầu:')}</strong> {getProductionQuantity(cmd).toLocaleString()} {t('tem')}</div>
                        <div><strong>{t('Máy vận hành:')}</strong> {cmd.machineId} ({cmd.shift})</div>
                        <div><strong>{t('Loại lõi giấy:')}</strong> {cmd.paperCore || '76mm'}</div>
                        <div><strong>{t('Giấy nguyên liệu:')}</strong> {cmd.paperMaterialCode}</div>
                        <div><strong>{t('Số lượng giấy cấp:')}</strong> {cmd.paperQuantity}</div>
                        <div><strong>{t('Hạn giao hàng:')}</strong> {cmd.deliveryDeadline ? new Date(cmd.deliveryDeadline).toLocaleDateString('vi-VN') : 'N/A'}</div>
                        <div><strong>{t('Yêu cầu kỹ thuật:')}</strong> {cmd.notes || t('Không có')}</div>
                      </div>

                      <div style={{ textAlign: 'center', border: '1px solid var(--color-border-light)', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '150px', backgroundColor: '#f8fafc' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px', display: 'block', fontWeight: 600 }}>{t('ẢNH LAYOUT MẪU')}</span>
                        {getPOItemImage(cmd.poId) ? (
                          <img
                            src={getPOItemImage(cmd.poId)}
                            alt="Layout"
                            style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '4px' }}
                          />
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa có ảnh thiết kế')}</span>
                        )}
                      </div>
                    </div>

                    {cmd.status === 'producing' && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-success"
                          style={{ flex: 1, padding: '10px', fontWeight: 600 }}
                          onClick={() => setSelectedLsx(cmd)}
                        >
                          {t('HOÀN THÀNH')}
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ flex: 1, padding: '10px', fontWeight: 600 }}
                          onClick={() => handleOpenTransfer(cmd)}
                        >
                          {t('CHUYỂN LỆNH')}
                        </button>
                      </div>
                    )}
                    {cmd.status === 'transfer_pending' && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-light)', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-warning)', fontWeight: 600, backgroundColor: 'var(--color-warning-bg)', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-warning-border)' }}>
                        {t('Chờ duyệt chuyển sang:')} {cmd.proposedOperatorName}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {activeCommands.filter(cmd => {
              if (currentUser.role === 'producer' && cmd.operatorId !== currentUser.uid) return false;
              return operatorTab === 'producing' ? (cmd.status === 'producing' || cmd.status === 'transfer_pending') : cmd.status === 'completed';
            }).length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
                {t('Không có lệnh sản xuất nào trong danh sách này.')}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STANDARD ADMIN/COORDINATOR VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {/* LSX Transfer Approvals */}
          {activeCommands.some(cmd => cmd.status === 'transfer_pending') && (
            <div className="card" style={{ border: '1px solid var(--color-warning-border)', backgroundColor: 'var(--color-warning-bg)' }}>
              <span className="card-title" style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t('Yêu Cầu Phê Duyệt Bàn Giao Lệnh')}
              </span>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Mã LSX')}</th>
                      <th>{t('Thợ Yêu Cầu')}</th>
                      <th>{t('Thợ Nhận Thay')}</th>
                      <th>{t('Lý Do Bàn Giao')}</th>
                      <th>{t('Hành Động')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCommands
                      .filter(cmd => cmd.status === 'transfer_pending')
                      .map(cmd => (
                        <tr key={cmd.id}>
                          <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                          <td>{cmd.operatorName}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{cmd.proposedOperatorName}</td>
                          <td>{cmd.transferReason}</td>
                          <td>
                            <div className="btn-group">
                              <button className="btn btn-sm btn-success" onClick={() => handleApproveTransfer(cmd)}>{t('Duyệt')}</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleRejectTransfer(cmd)}>{t('Từ Chối')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="card-title" style={{ margin: 0 }}>{t('Danh Sách Lệnh Sản Xuất Đang Chạy và Đã Xong')}</span>
              <button className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleExportCSV}>
                <FileSpreadsheet size={16} />
                <span>{t('Xuất Excel')}</span>
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã LSX')}</th>
                    <th>{t('Mã PO')}</th>
                    <th>{t('Tên Tem Cần Bế')}</th>
                    <th>{t('Máy Sản Xuất')}</th>
                    <th>{t('Lõi Giấy')}</th>
                    <th>{t('Giấy NVL')}</th>
                    <th>{t('SL Đặt')}</th>
                    <th>{t('Phế phẩm')}</th>
                    <th>{t('Trạng Thái')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCommands.map(cmd => (
                    <tr key={cmd.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLsx(cmd)}>
                      <td style={{ fontWeight: 600 }}>{cmd.lsxCode}</td>
                      <td>{cmd.poCode}</td>
                      <td style={{ fontWeight: 500 }}>{cmd.productNameToBeCut || cmd.productName}</td>
                      <td>{cmd.machineId}</td>
                      <td>{cmd.paperCore || '76mm'}</td>
                      <td style={{ fontSize: '11px' }}>{cmd.paperMaterialCode} ({cmd.paperQuantity} cuộn)</td>
                      <td>{getProductionQuantity(cmd).toLocaleString()}</td>
                      <td>{cmd.scrapQty ? `${cmd.scrapQty.toLocaleString()} tem` : '0'}</td>
                      <td>
                        <span className={`badge ${
                          cmd.status === 'completed' ? 'badge-success' : 
                          cmd.status === 'transfer_pending' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {cmd.status === 'completed' ? t('Đã hoàn thành') : 
                           cmd.status === 'transfer_pending' ? t('Bàn giao chờ duyệt') : t('Đang in')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          {cmd.status !== 'completed' && (currentUser.role === 'admin' || currentUser.role === 'producer') ? (
                            <>
                              <button className="btn btn-sm btn-success" onClick={() => setSelectedLsx(cmd)}>
                                {t('Báo Cáo Hoàn Thành')}
                              </button>
                              <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditLsx(cmd)} title={t('Sửa')}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteLsx(cmd.id)} title={t('Xóa')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(cmd)}>{t('Chi Tiết')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeCommands.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>{t('Không có lệnh sản xuất nào được ghi nhận.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE LSX DIALOG */}
      {showAddLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('PHÁT HÀNH LỆNH SẢN XUẤT (LSX) MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddLsxModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreateLsx}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Chọn Đơn Hàng PO Chờ Sản Xuất *')}</label>
                  <select 
                    value={linkedPoId} 
                    onChange={e => {
                      setLinkedPoId(e.target.value);
                      const po = pos.find(p => p.id === e.target.value);
                      if (po) {
                        const item = po.items?.[0] || {};
                        setQtyToProduce(item.quantity || 10000);
                        setProductNameToBeCut(item.productName || '');
                        setDeliveryDeadline(po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().split('T')[0] : '');
                        const preferredMachine = getPreferredMachine(po);
                        if (preferredMachine) setMachineId(preferredMachine.name);
                        if (item.specifications) {
                          if (item.specifications.core) setPaperCore(item.specifications.core);
                          if (item.specifications.paperMaterial) setPaperMaterialCode(item.specifications.paperMaterial);
                        }
                      }
                    }} 
                    required
                  >
                    {pos.filter(po => po.status === 'production_pending' || po.status === 'supplier_confirmed').map(po => (
                      <option key={po.id} value={po.id}>{po.poCode} - {po.customerName} ({po.items?.[0]?.productName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('Tên sản phẩm cần bế *')}</label>
                  <input 
                    type="text" 
                    value={productNameToBeCut} 
                    onChange={e => setProductNameToBeCut(e.target.value)} 
                    required 
                    placeholder="VD: Nhãn dán chai Aqua"
                  />
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Máy In Phân Công *')}</label>
                    <select value={machineId} onChange={e => setMachineId(e.target.value)} required>
                      {machineId && !getMachineForAssignment(machineCatalog, machineId) && (
                        <option value={machineId}>{machineId} (chưa có trong danh mục)</option>
                      )}
                      {createMachineOptions.map(machine => (
                        <option key={machine.id} value={machine.name}>{getMachineOptionLabel(machine)}</option>
                      ))}
                    </select>
                    {recommendedMachineForCreate && (
                      <div className="machine-recommendation">
                        <Info size={15} />
                        <span>
                          Gợi ý: <strong>{recommendedMachineForCreate.code} - {recommendedMachineForCreate.name}</strong>
                          {requiredColorsForCreate > 0 ? ` đáp ứng đơn ${requiredColorsForCreate} màu` : ' hiện đang sẵn sàng'}.
                        </span>
                      </div>
                    )}
                    {selectedMachineStatusForCreate && selectedMachineStatusForCreate !== 'available' && (
                      <div className="machine-recommendation machine-recommendation--warning">
                        <AlertTriangle size={15} />
                        <span>Máy đã chọn hiện ở trạng thái <strong>{getMachineStatusLabel(selectedMachineStatusForCreate)}</strong>. Hệ thống sẽ kiểm tra lại trước khi phát hành LSX.</span>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>{t('Ca Sản Xuất *')}</label>
                    <select value={shift} onChange={e => setShift(e.target.value)}>
                      <option value="Ca Sáng (08:00 - 18:00)">{t('Ca Sáng (08:00 - 18:00)')}</option>
                      <option value="Ca Đêm (18:00 - 04:00)">{t('Ca Đêm (18:00 - 04:00)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng Tem Cần In *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={qtyToProduce} 
                      onChange={e => setQtyToProduce(Number(e.target.value))} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Loại lõi giấy *')}</label>
                    <select value={paperCore} onChange={e => setPaperCore(e.target.value)}>
                      <option value="25mm">25mm</option>
                      <option value="29mm">29mm</option>
                      <option value="40mm">40mm</option>
                      <option value="42mm">42mm</option>
                      <option value="76mm">76mm</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Mã nguyên liệu giấy cần dùng *')}</label>
                    <input 
                      type="text" 
                      value={paperMaterialCode} 
                      onChange={e => setPaperMaterialCode(e.target.value)} 
                      required 
                      placeholder="VD: Decal giấy Fasson AW0339F"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Số lượng giấy cấp *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={paperQuantity} 
                      onChange={e => setPaperQuantity(Number(e.target.value))} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Ngày cần giao hàng *')}</label>
                    <input 
                      type="date" 
                      value={deliveryDeadline} 
                      onChange={e => setDeliveryDeadline(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Người Đứng Máy Vận Hành')}</label>
                    <input type="text" value={operatorName} onChange={e => setOperatorName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('Ghi Chú Kỹ Thuật Máy / Bế / Cán màng')}</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder={t('Ví dụ: Cán màng OPP mờ, bế cuộn phi 76 hướng tem ra ngoài...')} 
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddLsxModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Phát Hành Lệnh')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LSX DIALOG */}
      {showEditLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('Chỉnh Sửa Lệnh Sản Xuất')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditLsxModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditLsxSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Tên sản phẩm cần bế *')}</label>
                  <input 
                    type="text" 
                    value={editProductNameToBeCut} 
                    onChange={e => setEditProductNameToBeCut(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Máy In Phân Công *')}</label>
                    <select value={editMachineId} onChange={e => setEditMachineId(e.target.value)} required>
                      {editMachineId && !getMachineForAssignment(machineCatalog, editMachineId) && (
                        <option value={editMachineId}>{editMachineId} (dữ liệu máy cũ)</option>
                      )}
                      {sortMachinesForAssignment(machineCatalog, activeCommands, getRequiredColorCount(pos.find(po => po.id === selectedLsx?.poId)))
                        .filter(machine => machine.status !== 'inactive' || machine.name === editMachineId)
                        .map(machine => (
                          <option key={machine.id} value={machine.name}>{getMachineOptionLabel(machine, selectedLsx?.id)}</option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ca Sản Xuất *')}</label>
                    <select value={editShift} onChange={e => setEditShift(e.target.value)}>
                      <option value="Ca Sáng (08:00 - 18:00)">{t('Ca Sáng (08:00 - 18:00)')}</option>
                      <option value="Ca Đêm (18:00 - 04:00)">{t('Ca Đêm (18:00 - 04:00)')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Số Lượng Tem Cần In *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editQtyToProduce} 
                      onChange={e => setEditQtyToProduce(Number(e.target.value))} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Loại lõi giấy *')}</label>
                    <select value={editPaperCore} onChange={e => setEditPaperCore(e.target.value)}>
                      <option value="25mm">25mm</option>
                      <option value="29mm">29mm</option>
                      <option value="40mm">40mm</option>
                      <option value="42mm">42mm</option>
                      <option value="76mm">76mm</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Mã nguyên liệu giấy cần dùng *')}</label>
                    <input 
                      type="text" 
                      value={editPaperMaterialCode} 
                      onChange={e => setEditPaperMaterialCode(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Số lượng giấy cấp *')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editPaperQuantity} 
                      onChange={e => setEditPaperQuantity(Number(e.target.value))} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Ngày cần giao hàng *')}</label>
                    <input 
                      type="date" 
                      value={editDeliveryDeadline} 
                      onChange={e => setEditDeliveryDeadline(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Người Đứng Máy Vận Hành')}</label>
                    <input type="text" value={editOperatorName} onChange={e => setEditOperatorName(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('Ghi Chú Kỹ Thuật Máy / Bế / Cán màng')}</label>
                  <textarea 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)} 
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditLsxModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LSX DETAILS AND COMPLETION MODAL */}
      {selectedLsx && !showEditLsxModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHI TIẾT LỆNH SẢN XUẤT')}: {selectedLsx.lsxCode}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedLsx.status === 'producing' && !isOperator && (currentUser.role === 'admin' || currentUser.role === 'producer') && (
                  <>
                    <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => handleOpenEditLsx(selectedLsx)} title={t('Sửa')}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteLsx(selectedLsx.id)} title={t('Xóa')}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button className="btn btn-sm btn-outline" onClick={() => setSelectedLsx(null)}>{t('Đóng')}</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ fontWeight: 600 }}>{t('Tên sản phẩm bế')}:</span> {selectedLsx.productNameToBeCut || selectedLsx.productName}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Mã PO Gốc')}:</span> {selectedLsx.poCode}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Máy Phân Công')}:</span> {selectedLsx.machineId}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ca Kíp Máy')}:</span> {selectedLsx.shift}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Người Vận Hành')}:</span> {selectedLsx.operatorName}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Số Lượng Cần In')}:</span> {getProductionQuantity(selectedLsx).toLocaleString()} {t('tem')}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Loại lõi giấy')}:</span> {selectedLsx.paperCore || '76mm'}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Mã nguyên liệu giấy')}:</span> {selectedLsx.paperMaterialCode}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Số lượng giấy cấp')}:</span> {selectedLsx.paperQuantity}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Hạn giao hàng')}:</span> {selectedLsx.deliveryDeadline ? new Date(selectedLsx.deliveryDeadline).toLocaleDateString('vi-VN') : 'N/A'}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ghi chú')}:</span> {selectedLsx.notes || t('Không có')}</div>
                  <div><span style={{ fontWeight: 600 }}>{t('Ngày Lập Lệnh')}:</span> {new Date(selectedLsx.startedAt).toLocaleString('vi-VN')}</div>
                  {selectedLsx.completedAt && (
                    <div>
                      <span style={{ fontWeight: 600 }}>{t('Ngày Hoàn Thành')}:</span> {new Date(selectedLsx.completedAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', border: '1px solid var(--color-border-light)', padding: '6px', borderRadius: '4px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <h4 style={{ textAlign: 'left', fontSize: '11px', marginBottom: '6px', fontWeight: 600, width: '100%' }}>{t('Mẫu màu in thiết kế')}:</h4>
                  {getPOItemImage(selectedLsx.poId) ? (
                    <img 
                      src={getPOItemImage(selectedLsx.poId)} 
                      alt="Layout in" 
                      style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', backgroundColor: '#f8fafc', color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Không có ảnh mẫu')}</div>
                  )}
                </div>
              </div>

              {selectedLsx.status === 'producing' && (currentUser.role === 'admin' || currentUser.role === 'producer') && (
                <form onSubmit={handleCompleteLsx} style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px', marginTop: '16px', backgroundColor: '#f8fafc' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-success)', fontWeight: 700 }}>{t('Báo cáo kết quả hoàn thành sản xuất')}:</h3>
                  <div className="form-group">
                    <label>{t('Số Lượng Phế Phẩm / Hao Hụt Phát Sinh (Cái) *')}</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={scrapQty} 
                      onChange={e => setScrapQty(Number(e.target.value))} 
                      required 
                    />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('* Lượng tem in hỏng trong quá trình setup dao bế và in ấn')}</span>
                  </div>

                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label>{t('Ghi Chú Kết Quả Vận Hành (Hao hụt giấy, mực...)')}</label>
                    <textarea 
                      value={completionNotes} 
                      onChange={e => setCompletionNotes(e.target.value)} 
                      placeholder={t('VD: Chạy máy tốt, hao hụt 120 tem trong lúc set-up dao bế.')}
                      rows={2}
                    />
                  </div>

                  <button type="submit" className="btn btn-success" style={{ width: '100%', marginTop: '12px', padding: '10px', fontWeight: 600 }}>
                    {t('Xác Nhận Sản Xuất Xong (Tự Động Trừ Kho & Bàn Giao QC)')}
                  </button>
                </form>
              )}

              {/* Audit trail */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <div>{t('Tạo bởi:')} {selectedLsx.createdBy || t('Không xác định')} {selectedLsx.createdAt && `(${new Date(selectedLsx.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                {selectedLsx.updatedBy && (
                  <div>{t('Cập nhật bởi:')} {selectedLsx.updatedBy} ({new Date(selectedLsx.updatedAt).toLocaleString(t('vi-VN'))})</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedLsx(null)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && selectedLsx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>{t('BÀN GIAO / CHUYỂN LỆNH SẢN XUẤT')}</span>
              <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => setShowTransferModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', marginBottom: '12px' }}>
                  {t('Bàn giao lệnh')} <strong>{selectedLsx.lsxCode}</strong> ({selectedLsx.productNameToBeCut || selectedLsx.productName}) {t('cho thợ khác vận hành.')}
                </p>
                <div className="form-group">
                  <label>{t('Thợ Tiếp Nhận Thay *')}</label>
                  <select 
                    value={targetOperatorId} 
                    onChange={e => setTargetOperatorId(e.target.value)}
                    required
                  >
                    <option value="">{t('Chọn thợ...')}</option>
                    {users
                      .filter(u => u.role === 'producer' && u.uid !== currentUser.uid)
                      .map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Lý Do Bàn Giao (Sự cố, Đổi ca...) *')}</label>
                  <textarea 
                    value={transferReason} 
                    onChange={e => setTransferReason(e.target.value)} 
                    required
                    placeholder={t('Nhập chi tiết sự cố máy móc hoặc lý do bàn giao...')}
                    style={{ minHeight: '80px', width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowTransferModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Đề Xuất Chuyển')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLsx && (
        <FloatingChat 
          currentUser={currentUser}
          type="lsx"
          targetId={selectedLsx.id}
          targetCode={selectedLsx.lsxCode}
          messages={messages}
          users={users}
        />
      )}
    </div>
  );
};
