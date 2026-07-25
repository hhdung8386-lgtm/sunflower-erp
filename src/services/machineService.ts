import { dbService } from './firebaseService';

export type MachineStatus = 'available' | 'maintenance' | 'fault' | 'inactive';
export type MachineRuntimeStatus = MachineStatus | 'running';

export interface ProductionMachine {
  id: string;
  code: string;
  name: string;
  type: string;
  colorCount: number;
  maxWidthMm: number;
  capacityPerHour: number;
  supportedMaterials: string[];
  status: MachineStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionCommandLike {
  id?: string;
  deleted?: boolean;
  status?: string;
  machineId?: unknown;
  lsxCode?: string;
  poCode?: string;
  productName?: string;
  productNameToBeCut?: string;
  shift?: string;
  operatorName?: string;
  deliveryDeadline?: string;
}

export interface PurchaseOrderLike {
  items?: Array<{
    colorCount?: number | string;
    colors?: string;
    productName?: string;
    description?: string;
    specifications?: {
      colorCount?: number | string;
      colors?: string;
      color?: string;
    };
  }>;
}

export const DEFAULT_MACHINES: ProductionMachine[] = [
  {
    id: 'machine-flexo-omet-8',
    code: 'M-01',
    name: 'Máy Flexo 8 màu OMET',
    type: 'Flexo',
    colorCount: 8,
    maxWidthMm: 430,
    capacityPerHour: 18000,
    supportedMaterials: ['Decal giấy', 'Decal nhựa', 'Màng OPP', 'Màng PET'],
    status: 'available',
    notes: 'Ưu tiên đơn nhiều màu, sản lượng lớn.'
  },
  {
    id: 'machine-flexo-gallus-4',
    code: 'M-02',
    name: 'Máy Flexo 4 màu Gallus',
    type: 'Flexo',
    colorCount: 4,
    maxWidthMm: 340,
    capacityPerHour: 14000,
    supportedMaterials: ['Decal giấy', 'Decal nhựa'],
    status: 'available',
    notes: 'Phù hợp đơn 1–4 màu và khổ trung bình.'
  },
  {
    id: 'machine-offset-heidelberg',
    code: 'M-03',
    name: 'Máy in Offset Heidelberg',
    type: 'Offset',
    colorCount: 4,
    maxWidthMm: 520,
    capacityPerHour: 10000,
    supportedMaterials: ['Giấy couche', 'Giấy mỹ thuật', 'Giấy tờ rời'],
    status: 'available',
    notes: 'Phù hợp sản phẩm tờ rời, yêu cầu màu ổn định.'
  },
  {
    id: 'machine-digital-konica',
    code: 'M-04',
    name: 'Máy in Kỹ thuật số Konica',
    type: 'Kỹ thuật số',
    colorCount: 4,
    maxWidthMm: 330,
    capacityPerHour: 5000,
    supportedMaterials: ['Decal giấy', 'Giấy couche', 'Giấy mỹ thuật'],
    status: 'available',
    notes: 'Ưu tiên đơn gấp, số lượng nhỏ và đơn mẫu.'
  }
];

const normalizeMachine = (machine: Partial<ProductionMachine>): ProductionMachine => ({
  id: String(machine.id || `machine-${Math.random().toString(36).slice(2, 10)}`),
  code: String(machine.code || ''),
  name: String(machine.name || ''),
  type: String(machine.type || 'Khác'),
  colorCount: Math.max(0, Number(machine.colorCount) || 0),
  maxWidthMm: Math.max(0, Number(machine.maxWidthMm) || 0),
  capacityPerHour: Math.max(0, Number(machine.capacityPerHour) || 0),
  supportedMaterials: Array.isArray(machine.supportedMaterials)
    ? machine.supportedMaterials.map(String).filter(Boolean)
    : [],
  status: ['available', 'maintenance', 'fault', 'inactive'].includes(String(machine.status))
    ? machine.status as MachineStatus
    : 'available',
  notes: String(machine.notes || ''),
  createdAt: machine.createdAt,
  updatedAt: machine.updatedAt
});

export const sortMachines = (machines: ProductionMachine[]): ProductionMachine[] => (
  [...machines].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
);

export const ensureDefaultMachines = async (): Promise<void> => {
  const existingMachines = await dbService.getCollection('machines');
  if (existingMachines.length > 0) return;

  await Promise.all(DEFAULT_MACHINES.map(machine => dbService.addDocument('machines', machine)));
};

export const subscribeMachines = (callback: (machines: ProductionMachine[]) => void): (() => void) => {
  const unsubscribe = dbService.subscribeCollection('machines', data => {
    callback(sortMachines(data.map(normalizeMachine).filter(machine => machine.name)));
  });

  void ensureDefaultMachines();
  return unsubscribe;
};

export const machineMatchesAssignment = (machine: ProductionMachine, assignment: unknown): boolean => {
  const value = String(assignment || '').trim().toLocaleLowerCase('vi');
  if (!value) return false;
  return [machine.id, machine.code, machine.name]
    .some(candidate => candidate.trim().toLocaleLowerCase('vi') === value);
};

export const getMachineForAssignment = (
  machines: ProductionMachine[],
  assignment: unknown
): ProductionMachine | undefined => machines.find(machine => machineMatchesAssignment(machine, assignment));

export const isActiveProductionCommand = (command: ProductionCommandLike): boolean => (
  !command?.deleted && (command?.status === 'producing' || command?.status === 'transfer_pending')
);

export const getMachineCommands = (
  machine: ProductionMachine,
  commands: ProductionCommandLike[],
  excludeCommandId?: string
): ProductionCommandLike[] => commands.filter(command => (
  command?.id !== excludeCommandId &&
  isActiveProductionCommand(command) &&
  machineMatchesAssignment(machine, command?.machineId)
));

export const getMachineRuntimeStatus = (
  machine: ProductionMachine,
  commands: ProductionCommandLike[],
  excludeCommandId?: string
): MachineRuntimeStatus => {
  if (machine.status !== 'available') return machine.status;
  return getMachineCommands(machine, commands, excludeCommandId).length > 0 ? 'running' : 'available';
};

export const getRequiredColorCount = (po?: PurchaseOrderLike | null): number => {
  const item = po?.items?.[0] || {};
  const specifications = item.specifications || {};
  const directValue = Number(specifications.colorCount ?? item.colorCount);
  if (Number.isFinite(directValue) && directValue > 0) return directValue;

  const text = [
    specifications.colors,
    specifications.color,
    item.colors,
    item.productName,
    item.description
  ].filter(Boolean).join(' ');
  const match = text.match(/(\d+)\s*(?:màu|color)/i);
  return match ? Number(match[1]) : 0;
};

export const sortMachinesForAssignment = (
  machines: ProductionMachine[],
  commands: ProductionCommandLike[],
  requiredColorCount = 0
): ProductionMachine[] => {
  const statusWeight: Record<MachineRuntimeStatus, number> = {
    available: 0,
    running: 1,
    maintenance: 2,
    fault: 3,
    inactive: 4
  };

  return [...machines].sort((a, b) => {
    const aCompatible = requiredColorCount === 0 || a.colorCount >= requiredColorCount;
    const bCompatible = requiredColorCount === 0 || b.colorCount >= requiredColorCount;
    if (aCompatible !== bCompatible) return aCompatible ? -1 : 1;

    const statusDifference = statusWeight[getMachineRuntimeStatus(a, commands)] - statusWeight[getMachineRuntimeStatus(b, commands)];
    if (statusDifference !== 0) return statusDifference;

    const aExcess = requiredColorCount > 0 ? Math.max(0, a.colorCount - requiredColorCount) : 0;
    const bExcess = requiredColorCount > 0 ? Math.max(0, b.colorCount - requiredColorCount) : 0;
    if (aExcess !== bExcess) return aExcess - bExcess;
    return a.code.localeCompare(b.code, 'vi', { numeric: true });
  });
};

export const getMachineStatusLabel = (status: MachineRuntimeStatus): string => ({
  available: 'Sẵn sàng',
  running: 'Đang chạy',
  maintenance: 'Bảo trì',
  fault: 'Đang lỗi',
  inactive: 'Ngừng sử dụng'
}[status]);
