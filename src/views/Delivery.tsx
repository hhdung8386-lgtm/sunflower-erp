import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { getPODeliveryStage, getPOQueueUpdate, isPOInQueue } from '../domain/poWorkflow';
import './Delivery.css';

interface DeliveryProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

type DeliveryTab = 'control' | 'trips' | 'fleet' | 'proof';

interface DeliveryVehicle {
  id: string;
  plate: string;
  vehicleName: string;
  capacityKg: number;
  driverName: string;
  driverPhone?: string;
  status: 'ready' | 'running' | 'maintenance' | 'inactive';
  suitableRegions?: string[];
  maintenanceNote?: string;
}

interface DeliveryItemLike {
  quantity?: number | string;
  qtyDelivered?: number | string;
}

interface DeliveryPoLike {
  customerName?: string;
  notes?: string;
  deliveryAddress?: string;
  weightKg?: number | string;
  shippingInfo?: {
    weightKg?: number | string;
  };
  items?: DeliveryItemLike[];
}

interface DeliveryTripOrderLike {
  poId: string;
  customerId?: string;
  customerName?: string;
  deliveryAddress?: string;
  deliveredQty?: number;
  estimatedWeightKg?: number;
  stopSequence?: number;
  status?: string;
  signatureImage?: string;
  note?: string;
}

const DELIVERY_REGIONS = ['Hải Dương', 'Bắc Ninh', 'Hà Nội', 'Hưng Yên', 'Phú Thọ', 'Tuyến khác'];

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  ready: 'Sẵn sàng',
  running: 'Đang chạy',
  maintenance: 'Bảo trì',
  inactive: 'Ngừng sử dụng'
};

const TRIP_STATUS_LABELS: Record<string, string> = {
  planning: 'Đang lập kế hoạch',
  approved: 'Đã duyệt chuyến',
  loading: 'Đang bốc hàng',
  delivering: 'Đang giao hàng',
  completed: 'Hoàn thành',
  failed: 'Giao thất bại',
  postponed: 'Hoãn chuyến'
};

const ACTIVE_TRIP_STATUSES = ['planning', 'approved', 'loading', 'delivering'];
const DELIVERY_PAGE_OPENED_AT = Date.now();
const DEFAULT_DELIVERY_DATE = new Date(DELIVERY_PAGE_OPENED_AT + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const normalizeText = (value: unknown) => String(value || '').toLocaleLowerCase('vi-VN');

const getOrderRegion = (po: DeliveryPoLike | null | undefined): string => {
  const haystack = normalizeText(`${po?.customerName || ''} ${po?.notes || ''} ${po?.deliveryAddress || ''}`);
  if (haystack.includes('hà nội')) return 'Hà Nội';
  if (haystack.includes('bắc ninh') || haystack.includes('samsung')) return 'Bắc Ninh';
  if (haystack.includes('hưng yên')) return 'Hưng Yên';
  if (haystack.includes('phú thọ') || haystack.includes('tạo hình cơ khí')) return 'Phú Thọ';
  if (haystack.includes('hải dương') || haystack.includes('aqua') || haystack.includes('brother') || haystack.includes('trancy')) return 'Hải Dương';
  return 'Tuyến khác';
};

const getOrderRemainingQuantity = (po: DeliveryPoLike | null | undefined): number => po?.items?.reduce(
  (sum: number, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.qtyDelivered || 0)),
  0
) || 0;

const estimateOrderWeightKg = (po: DeliveryPoLike | null | undefined): number => {
  const declaredWeight = Number(po?.shippingInfo?.weightKg || po?.weightKg || 0);
  if (declaredWeight > 0) return declaredWeight;
  return Math.max(1, Math.ceil(getOrderRemainingQuantity(po) / 1000));
};

const formatCurrency = (value: unknown) => `${Math.round(Number(value || 0)).toLocaleString('vi-VN')} đ`;

const toDateInputValue = (value: unknown): string => {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
};

export const Delivery: React.FC<DeliveryProps> = ({ pos, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('control');
  const [vehicles, setVehicles] = useState<DeliveryVehicle[]>([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [fleetLoading, setFleetLoading] = useState(true);
  
  // Signature Modal states
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signingOrderPoId, setSigningOrderPoId] = useState('');
  const [signingPo, setSigningPo] = useState<any | null>(null);
  const [deliveredQuantities, setDeliveredQuantities] = useState<{ [itemId: string]: number }>({});
  
  // Signature Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Form states - Delivery Trip
  const [region, setRegion] = useState('Hải Dương');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const assignedSaleId = 'u-sale';
  const [deliveryDate, setDeliveryDate] = useState(DEFAULT_DELIVERY_DATE);
  const [timeWindowStart, setTimeWindowStart] = useState('08:00');
  const [timeWindowEnd, setTimeWindowEnd] = useState('17:00');
  const [tripPriority, setTripPriority] = useState('normal');
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [tripNote, setTripNote] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Edit form states
  const [editRegion, setEditRegion] = useState('Hải Dương');
  const [editDriverName, setEditDriverName] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editTimeWindowStart, setEditTimeWindowStart] = useState('08:00');
  const [editTimeWindowEnd, setEditTimeWindowEnd] = useState('17:00');
  const [editTripPriority, setEditTripPriority] = useState('normal');
  const [editEstimatedDistanceKm, setEditEstimatedDistanceKm] = useState(0);
  const [editEstimatedCost, setEditEstimatedCost] = useState(0);
  const [editTripNote, setEditTripNote] = useState('');
  const [editSelectedOrderIds, setEditSelectedOrderIds] = useState<string[]>([]);

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    vehicleName: '',
    capacityKg: 1000,
    driverName: '',
    driverPhone: '',
    status: 'ready' as DeliveryVehicle['status'],
    suitableRegions: ['Hà Nội'] as string[]
  });

  // Refresh delivery trips list
  const fetchDeliveries = async () => {
    const list = await dbService.getCollection('deliveries');
    setDeliveries(list.filter((trip: any) => !trip.deleted));
  };

  const fetchVehicles = async () => {
    setFleetLoading(true);
    const list = await dbService.getCollection('delivery_vehicles') as Array<DeliveryVehicle & { deleted?: boolean }>;
    setVehicles(list.filter(vehicle => !vehicle.deleted));
    setFleetLoading(false);
  };

  useEffect(() => {
    void fetchDeliveries();
    void fetchVehicles();
  }, [pos]);

  const activeTrips = useMemo(
    () => deliveries.filter(trip => ACTIVE_TRIP_STATUSES.includes(trip.status)),
    [deliveries]
  );

  const scheduledOrderIds = useMemo(
    () => new Set(activeTrips.flatMap(trip => (trip.orders || []).map((order: DeliveryTripOrderLike) => order.poId))),
    [activeTrips]
  );

  const readyOrders = useMemo(
    () => pos.filter(po => (
      isPOInQueue(po, 'waiting_delivery') &&
      getPODeliveryStage(po) === 'customer_outbound' &&
      !po.deleted
    )),
    [pos]
  );

  const unplannedOrders = useMemo(
    () => readyOrders.filter(po => !scheduledOrderIds.has(po.id)),
    [readyOrders, scheduledOrderIds]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find(vehicle => vehicle.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const selectedEstimatedWeight = useMemo(
    () => selectedOrderIds.reduce((sum, poId) => sum + estimateOrderWeightKg(pos.find(po => po.id === poId)), 0),
    [selectedOrderIds, pos]
  );

  const selectedLoadFactor = selectedVehicle?.capacityKg
    ? Math.round((selectedEstimatedWeight / selectedVehicle.capacityKg) * 100)
    : 0;

  const editSelectedVehicle = useMemo(
    () => vehicles.find(vehicle => vehicle.id === editVehicleId) || null,
    [vehicles, editVehicleId]
  );

  const editSelectedEstimatedWeight = useMemo(
    () => editSelectedOrderIds.reduce((sum, poId) => sum + estimateOrderWeightKg(pos.find(po => po.id === poId)), 0),
    [editSelectedOrderIds, pos]
  );

  const editSelectedLoadFactor = editSelectedVehicle?.capacityKg
    ? Math.round((editSelectedEstimatedWeight / editSelectedVehicle.capacityKg) * 100)
    : 0;

  const regionSuggestions = useMemo(() => DELIVERY_REGIONS.map(regionName => {
    const orders = unplannedOrders.filter(po => getOrderRegion(po) === regionName);
    const estimatedWeightKg = orders.reduce((sum, po) => sum + estimateOrderWeightKg(po), 0);
    const closestDueDate = orders
      .map(po => po.expectedDeliveryDate)
      .filter(Boolean)
      .sort()[0] || '';
    return { region: regionName, orders, estimatedWeightKg, closestDueDate };
  }).filter(group => group.orders.length > 0), [unplannedOrders]);

  const deliveryAlerts = useMemo(() => {
    const alerts: Array<{ level: 'danger' | 'warning' | 'info'; title: string; detail: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    unplannedOrders.forEach(po => {
      const dueDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
      if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < today.getTime()) {
        alerts.push({
          level: 'danger',
          title: `${po.poCode} đã quá hạn giao`,
          detail: `${po.customerName} chưa được xếp chuyến.`
        });
      }
    });

    activeTrips.forEach(trip => {
      const vehicle = vehicles.find(item => item.id === trip.vehicleId || item.plate === trip.vehiclePlate);
      const capacity = Number(trip.capacityKg || vehicle?.capacityKg || 0);
      const load = Number(trip.estimatedLoadKg || 0);
      if (capacity > 0 && load > capacity) {
        alerts.push({
          level: 'danger',
          title: `${trip.delCode} vượt tải trọng`,
          detail: `${load.toLocaleString('vi-VN')} / ${capacity.toLocaleString('vi-VN')} kg.`
        });
      }
      if (vehicle && ['maintenance', 'inactive'].includes(vehicle.status)) {
        alerts.push({
          level: 'danger',
          title: `${trip.delCode} đang dùng xe không khả dụng`,
          detail: `${vehicle.plate} hiện ở trạng thái ${VEHICLE_STATUS_LABELS[vehicle.status]}.`
        });
      }
    });

    activeTrips.forEach((trip, index) => {
      activeTrips.slice(index + 1).forEach(other => {
        if (trip.vehiclePlate && trip.vehiclePlate === other.vehiclePlate && toDateInputValue(trip.deliveryDate) === toDateInputValue(other.deliveryDate)) {
          alerts.push({
            level: 'warning',
            title: `Trùng lịch xe ${trip.vehiclePlate}`,
            detail: `${trip.delCode} và ${other.delCode} cùng chạy ngày ${toDateInputValue(trip.deliveryDate)}.`
          });
        }
      });
    });

    regionSuggestions.filter(group => group.orders.length >= 2).forEach(group => {
      alerts.push({
        level: 'info',
        title: `Có thể ghép ${group.orders.length} đơn tuyến ${group.region}`,
        detail: `Tải ước tính ${group.estimatedWeightKg.toLocaleString('vi-VN')} kg.`
      });
    });

    return alerts.slice(0, 8);
  }, [activeTrips, regionSuggestions, unplannedOrders, vehicles]);

  const proofRows = useMemo(() => deliveries.flatMap(trip => (trip.orders || []).map((order: DeliveryTripOrderLike) => ({
    ...order,
    tripId: trip.id,
    delCode: trip.delCode,
    deliveryDate: trip.deliveryDate,
    region: trip.region,
    tripStatus: trip.status
  }))), [deliveries]);

  const averageLoadFactor = deliveries.length
    ? Math.round(deliveries.reduce((sum, trip) => sum + Number(trip.loadFactor || 0), 0) / deliveries.length)
    : 0;
  const totalEstimatedCost = deliveries.reduce((sum, trip) => sum + Number(trip.estimatedCost || 0), 0);

  const handleOpenAddTrip = () => {
    setSelectedOrderIds([]);
    setTripPriority('normal');
    setEstimatedDistanceKm(0);
    setEstimatedCost(0);
    setTripNote('');
    const firstReadyVehicle = vehicles.find(vehicle => vehicle.status === 'ready');
    setSelectedVehicleId(firstReadyVehicle?.id || '');
    setVehiclePlate(firstReadyVehicle?.plate || '');
    setDriverName(firstReadyVehicle?.driverName || '');
    setShowAddTripModal(true);
  };

  const handleVehicleSelection = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find(item => item.id === vehicleId);
    setVehiclePlate(vehicle?.plate || '');
    setDriverName(vehicle?.driverName || '');
  };

  // Grouping logic: Get packed orders that matches selected region
  const getPackedOrdersInRegion = (reg: string, includeOrderIds: string[] = []) => {
    return pos.filter(po => {
      const canSchedule = (
        isPOInQueue(po, 'waiting_delivery') && getPODeliveryStage(po) === 'customer_outbound'
      ) || includeOrderIds.includes(po.id);
      const notScheduledElsewhere = !scheduledOrderIds.has(po.id) || includeOrderIds.includes(po.id);
      return canSchedule && notScheduledElsewhere && getOrderRegion(po) === reg;
    });
  };

  const handleCreateVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedPlate = newVehicle.plate.trim().toUpperCase();
    if (!normalizedPlate || !newVehicle.vehicleName.trim() || !newVehicle.driverName.trim() || newVehicle.capacityKg <= 0) {
      alert('Vui lòng nhập đầy đủ biển số, tên xe, tải trọng và tài xế.');
      return;
    }
    if (vehicles.some(vehicle => vehicle.plate.toUpperCase() === normalizedPlate)) {
      alert('Biển số xe đã tồn tại trong danh mục.');
      return;
    }

    await dbService.addDocument('delivery_vehicles', {
      id: `vehicle-${Date.now()}`,
      ...newVehicle,
      plate: normalizedPlate,
      capacityKg: Number(newVehicle.capacityKg),
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    });
    setNewVehicle({
      plate: '',
      vehicleName: '',
      capacityKg: 1000,
      driverName: '',
      driverPhone: '',
      status: 'ready',
      suitableRegions: ['Hà Nội']
    });
    setShowVehicleModal(false);
    await fetchVehicles();
  };

  const updateVehicleStatus = async (vehicle: DeliveryVehicle, status: DeliveryVehicle['status']) => {
    await dbService.updateDocument('delivery_vehicles', vehicle.id, {
      status,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
    });
    await fetchVehicles();
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để giao!');
      return;
    }
    if (!deliveryDate || !selectedVehicle) {
      alert('Vui lòng chọn ngày giao và xe vận chuyển.');
      return;
    }
    if (selectedVehicle.status !== 'ready') {
      alert(`Xe ${selectedVehicle.plate} hiện không sẵn sàng để xếp chuyến.`);
      return;
    }
    if (selectedEstimatedWeight > selectedVehicle.capacityKg) {
      alert(`Tải ước tính ${selectedEstimatedWeight.toLocaleString('vi-VN')} kg vượt tải trọng ${selectedVehicle.capacityKg.toLocaleString('vi-VN')} kg của xe.`);
      return;
    }
    const conflictingTrip = activeTrips.find(trip => (
      (trip.vehicleId === selectedVehicle.id || trip.vehiclePlate === selectedVehicle.plate) &&
      toDateInputValue(trip.deliveryDate) === deliveryDate
    ));
    if (conflictingTrip) {
      alert(`Xe ${selectedVehicle.plate} đã được phân cho chuyến ${conflictingTrip.delCode} trong ngày này.`);
      return;
    }
    const duplicatedOrder = selectedOrderIds.find(poId => scheduledOrderIds.has(poId));
    if (duplicatedOrder) {
      const duplicatedPo = pos.find(po => po.id === duplicatedOrder);
      alert(`Đơn ${duplicatedPo?.poCode || duplicatedOrder} đã nằm trong một chuyến đang hoạt động.`);
      return;
    }

    const delCode = `DEL-${new Date().toISOString().substring(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const tripOrders = selectedOrderIds.map((poId, index) => {
      const po = pos.find(p => p.id === poId);
      const totalRemaining = getOrderRemainingQuantity(po);
      return {
        poId,
        customerId: po?.customerId || '',
        customerName: po?.customerName || '',
        deliveryAddress: po?.shippingInfo?.deliveryAddress || po?.deliveryAddress || (po?.notes?.includes('địa chỉ') ? po.notes : 'Kho khách hàng theo hồ sơ CRM'),
        deliveredQty: totalRemaining,
        estimatedWeightKg: estimateOrderWeightKg(po),
        stopSequence: index + 1,
        status: 'pending',
        signatureImage: '',
        note: ''
      };
    });

    const newTrip = {
      delCode,
      deliveryDate: new Date(deliveryDate).toISOString(),
      region,
      timeWindowStart,
      timeWindowEnd,
      priority: tripPriority,
      vehicleId: selectedVehicle.id,
      driverName: selectedVehicle.driverName || driverName,
      vehiclePlate: selectedVehicle.plate || vehiclePlate,
      capacityKg: selectedVehicle.capacityKg,
      estimatedLoadKg: selectedEstimatedWeight,
      loadFactor: selectedLoadFactor,
      estimatedDistanceKm: Number(estimatedDistanceKm || 0),
      estimatedCost: Number(estimatedCost || 0),
      note: tripNote,
      assignedSaleId,
      status: 'planning',
      orders: tripOrders,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('deliveries', newTrip);

    // Record the planning hand-off without advancing the PO to "delivering".
    // The PO is advanced only when the dispatcher actually starts the trip.
    for (const poId of selectedOrderIds) {
      const po = pos.find(p => p.id === poId);
      if (po) {
        const updatedLogs = [
          ...(po.historyLogs || []),
          {
            status: 'waiting_delivery',
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: `Đã xếp vào chuyến ${delCode}, tuyến ${region}, xe ${selectedVehicle.plate}, tài xế ${selectedVehicle.driverName}.`
          }
        ];
        await dbService.updateDocument('pos', po.id, {
          historyLogs: updatedLogs
        });
      }
    }

    setShowAddTripModal(false);
    setActiveTab('trips');
    await fetchDeliveries();
    onRefresh();
  };

  const handleOpenEditTrip = (trip: any) => {
    const vehicle = vehicles.find(item => item.id === trip.vehicleId || item.plate === trip.vehiclePlate);
    setSelectedTrip(trip);
    setEditRegion(trip.region);
    setEditDriverName(trip.driverName);
    setEditVehiclePlate(trip.vehiclePlate);
    setEditVehicleId(vehicle?.id || trip.vehicleId || '');
    setEditDeliveryDate(toDateInputValue(trip.deliveryDate));
    setEditTimeWindowStart(trip.timeWindowStart || '08:00');
    setEditTimeWindowEnd(trip.timeWindowEnd || '17:00');
    setEditTripPriority(trip.priority || 'normal');
    setEditEstimatedDistanceKm(Number(trip.estimatedDistanceKm || 0));
    setEditEstimatedCost(Number(trip.estimatedCost || 0));
    setEditTripNote(trip.note || '');
    setEditSelectedOrderIds(trip.orders.map((o: any) => o.poId));
    setShowEditTripModal(true);
  };

  const handleEditTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    if (editSelectedOrderIds.length === 0) {
      alert('Vui lòng chọn ít nhất một đơn hàng để giao!');
      return;
    }

    const editVehicle = vehicles.find(vehicle => vehicle.id === editVehicleId);
    if (!editVehicle) {
      alert('Vui lòng chọn xe vận chuyển trong danh mục.');
      return;
    }
    const editEstimatedLoadKg = editSelectedOrderIds.reduce(
      (sum, poId) => sum + estimateOrderWeightKg(pos.find(po => po.id === poId)),
      0
    );
    if (editEstimatedLoadKg > editVehicle.capacityKg) {
      alert(`Tải ước tính vượt tải trọng ${editVehicle.capacityKg.toLocaleString('vi-VN')} kg của xe.`);
      return;
    }
    const editConflict = activeTrips.find(trip => (
      trip.id !== selectedTrip.id &&
      (trip.vehicleId === editVehicle.id || trip.vehiclePlate === editVehicle.plate) &&
      toDateInputValue(trip.deliveryDate) === editDeliveryDate
    ));
    if (editConflict) {
      alert(`Xe ${editVehicle.plate} đã được phân cho chuyến ${editConflict.delCode} trong ngày này.`);
      return;
    }

    const tripOrders = editSelectedOrderIds.map((poId, index) => {
      const po = pos.find(p => p.id === poId);
      const existingOrder = selectedTrip.orders.find((o: any) => o.poId === poId);
      const totalRemaining = getOrderRemainingQuantity(po);
      return {
        poId,
        customerId: po?.customerId || existingOrder?.customerId || '',
        customerName: po?.customerName || existingOrder?.customerName || '',
        deliveryAddress: po?.shippingInfo?.deliveryAddress || po?.deliveryAddress || existingOrder?.deliveryAddress || 'Kho khách hàng theo hồ sơ CRM',
        deliveredQty: existingOrder ? existingOrder.deliveredQty : totalRemaining,
        estimatedWeightKg: estimateOrderWeightKg(po),
        stopSequence: index + 1,
        status: existingOrder?.status || 'pending',
        signatureImage: existingOrder?.signatureImage || '',
        note: existingOrder?.note || ''
      };
    });

    await dbService.updateDocument('deliveries', selectedTrip.id, {
      region: editRegion,
      vehicleId: editVehicle.id,
      driverName: editVehicle.driverName || editDriverName,
      vehiclePlate: editVehicle.plate || editVehiclePlate,
      capacityKg: editVehicle.capacityKg,
      estimatedLoadKg: editEstimatedLoadKg,
      loadFactor: Math.round((editEstimatedLoadKg / editVehicle.capacityKg) * 100),
      deliveryDate: new Date(editDeliveryDate).toISOString(),
      timeWindowStart: editTimeWindowStart,
      timeWindowEnd: editTimeWindowEnd,
      priority: editTripPriority,
      estimatedDistanceKm: Number(editEstimatedDistanceKm || 0),
      estimatedCost: Number(editEstimatedCost || 0),
      note: editTripNote,
      orders: tripOrders,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditTripModal(false);
    setSelectedTrip(null);
    fetchDeliveries();
    onRefresh();
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa chuyến xe giao hàng này?'))) {
      const trip = deliveries.find(d => d.id === tripId);
      await dbService.deleteDocument('deliveries', tripId);

      if (trip?.vehicleId) {
        await dbService.updateDocument('delivery_vehicles', trip.vehicleId, {
          status: 'ready',
          updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
        });
      }
      
      if (trip) {
        for (const ord of trip.orders) {
          const po = pos.find(p => p.id === ord.poId);
          if (po && isPOInQueue(po, 'waiting_delivery')) {
            const updatedLogs = [
              ...(po.historyLogs || []),
              {
                status: 'waiting_delivery',
                updatedBy: currentUser.displayName,
                updatedAt: new Date().toISOString(),
                note: `Đã hủy chuyến giao hàng ${trip.delCode}. Trạng thái PO quay lại chờ xe giao.`
              }
            ];
            await dbService.updateDocument('pos', po.id, {
              ...getPOQueueUpdate('waiting_delivery', {
                deliveryStage: 'customer_outbound',
                deliveryProgress: 'pending'
              }),
              historyLogs: updatedLogs
            });
          }
        }
      }

      setSelectedTrip(null);
      await Promise.all([fetchDeliveries(), fetchVehicles()]);
      onRefresh();
    }
  };

  const updateTripStatus = async (tripId: string, newStatus: string) => {
    const trip = deliveries.find(item => item.id === tripId) || selectedTrip;
    const now = new Date().toISOString();
    const milestoneFields = newStatus === 'delivering'
      ? { departedAt: now }
      : newStatus === 'completed'
        ? { completedAt: now }
        : {};

    await dbService.updateDocument('deliveries', tripId, {
      status: newStatus,
      ...milestoneFields,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: now
    });

    if (trip?.vehicleId) {
      await dbService.updateDocument('delivery_vehicles', trip.vehicleId, {
        status: ['loading', 'delivering'].includes(newStatus) ? 'running' : 'ready',
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
      });
    }

    if (newStatus === 'delivering' && trip?.orders) {
      for (const order of trip.orders) {
        const po = pos.find(item => item.id === order.poId);
        if (!po || !isPOInQueue(po, 'waiting_delivery')) continue;
        await dbService.updateDocument('pos', po.id, {
          ...getPOQueueUpdate('waiting_delivery', {
            deliveryStage: 'customer_outbound',
            deliveryProgress: 'delivering'
          }),
          historyLogs: [
            ...(po.historyLogs || []),
            {
              status: 'waiting_delivery',
              updatedBy: currentUser.displayName,
              updatedAt: now,
              note: `Chuyến ${trip.delCode} đã xuất phát. Xe ${trip.vehiclePlate}, tuyến ${trip.region}.`
            }
          ]
        });
      }
    }

    setSelectedTrip((prev: any) => prev ? { ...prev, status: newStatus } : null);
    await Promise.all([fetchDeliveries(), fetchVehicles()]);
    onRefresh();
  };

  const handleRevertTripStatus = async (trip: any) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn hoãn chuyến giao hàng này? Trạng thái các đơn hàng liên kết sẽ quay về "Đã đóng gói".'))) return;

    // 1. Mark the trip as postponed and release the vehicle.
    await dbService.updateDocument('deliveries', trip.id, { 
      status: 'postponed',
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    if (trip.vehicleId) {
      await dbService.updateDocument('delivery_vehicles', trip.vehicleId, {
        status: 'ready',
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
      });
    }

    // 2. Revert PO statuses to packed
    if (trip.orders) {
      for (const ord of trip.orders) {
        const po = pos.find(p => p.id === ord.poId);
        if (po) {
          const updatedLogs = [
              ...(po.historyLogs || []),
            {
              status: 'waiting_delivery',
              updatedBy: currentUser.displayName,
              updatedAt: new Date().toISOString(),
              note: `Hoãn chuyến giao hàng ${trip.delCode}. Trạng thái PO quay lại chờ xe giao.`
            }
          ];
          await dbService.updateDocument('pos', po.id, {
            ...getPOQueueUpdate('waiting_delivery', {
              deliveryStage: 'customer_outbound',
              deliveryProgress: 'pending'
            }),
            historyLogs: updatedLogs
          });
        }
      }
    }

    setSelectedTrip((prev: any) => prev ? { ...prev, status: 'postponed' } : null);
    await Promise.all([fetchDeliveries(), fetchVehicles()]);
    onRefresh();
  };

  // Sign canvas drawing helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTrip || !signingPo) return;

    const signatureBase64 = canvas.toDataURL('image/png');
    
    // Accumulate total items quantity delivered
    let currentTripDeliveredQty = 0;

    // Update PO items with newly delivered quantities
    const updatedItems = signingPo.items.map((item: any) => {
      const itemId = item.itemId || item.productCode;
      const currentDel = Number(deliveredQuantities[itemId]) || 0;
      currentTripDeliveredQty += currentDel;
      return {
        ...item,
        qtyDelivered: (Number(item.qtyDelivered) || 0) + currentDel
      };
    });

    // Check if fully delivered
    const isAllFullyDelivered = updatedItems.every((item: any) => (Number(item.qtyDelivered) || 0) >= Number(item.quantity));
    const finalPoStatus = isAllFullyDelivered ? 'waiting_invoice' : 'waiting_delivery';

    // Save updated items and status to PO
    const poLogs = [
      ...(signingPo.historyLogs || []),
      {
        status: finalPoStatus,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
        note: `Báo cáo giao hàng lẻ: ${signingPo.items.map((item: any) => {
          const itemId = item.itemId || item.productCode;
          const qty = deliveredQuantities[itemId] || 0;
          return `${item.productName} (Giao +${qty})`;
        }).join(', ')}. Chữ ký lưu trên hệ thống.`
      }
    ];

    await dbService.updateDocument('pos', signingPo.id, {
      items: updatedItems,
      ...getPOQueueUpdate(finalPoStatus, {
        deliveryStage: 'customer_outbound',
        deliveryProgress: isAllFullyDelivered ? 'delivered' : 'partial'
      }),
      historyLogs: poLogs
    });

    // Update trip details
    const updatedOrders = selectedTrip.orders.map((ord: any) => {
      if (ord.poId === signingOrderPoId) {
        return {
          ...ord,
          status: 'success',
          deliveredQty: currentTripDeliveredQty,
          signatureImage: signatureBase64,
          note: isAllFullyDelivered ? 'Giao hoàn tất đơn' : 'Giao hàng một phần'
        };
      }
      return ord;
    });

    const allStopsCompleted = updatedOrders.every((order: any) => order.status === 'success');
    await dbService.updateDocument('deliveries', selectedTrip.id, {
      orders: updatedOrders,
      ...(allStopsCompleted ? { status: 'completed', completedAt: new Date().toISOString() } : {}),
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
    });

    if (allStopsCompleted && selectedTrip.vehicleId) {
      await dbService.updateDocument('delivery_vehicles', selectedTrip.vehicleId, {
        status: 'ready',
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
      });
    }

    setShowSignatureModal(false);
    setSigningPo(null);
    setSelectedTrip((prev: any) => ({
      ...prev,
      orders: updatedOrders,
      ...(allStopsCompleted ? { status: 'completed', completedAt: new Date().toISOString() } : {})
    }));
    await Promise.all([fetchDeliveries(), fetchVehicles()]);
    onRefresh();
  };

  const handleOpenSignature = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    setSigningOrderPoId(poId);
    setSigningPo(po);

    // Initialize quantities to remaining to deliver
    const initialQuantities: { [itemId: string]: number } = {};
    po.items?.forEach((item: any) => {
      const itemId = item.itemId || item.productCode;
      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
      initialQuantities[itemId] = Math.max(0, remaining);
    });
    setDeliveredQuantities(initialQuantities);

    setShowSignatureModal(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
        }
      }
    }, 100);
  };

  const handleForceClosePO = async (po: any) => {
    const missingItems = po.items?.map((item: any) => {
      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
      return `${item.productName} (Thiếu ${remaining?.toLocaleString()} tem)`;
    }).join(', ') || '';

    if (window.confirm(t(`Bạn có chắc chắn muốn Force Close đóng đơn hàng PO này do dung sai sản xuất?\nChi tiết thiếu: ${missingItems}`))) {
      const now = new Date().toISOString();
      const updatedLogs = [
        ...(po.historyLogs || []),
        {
          status: 'waiting_invoice',
          updatedBy: currentUser.displayName,
          updatedAt: now,
          note: `Force Close đơn hàng theo số lượng thực tế đã giao. Lý do: Dung sai hao hụt sản xuất trong mức khách hàng chấp nhận.`
        }
      ];

      await dbService.updateDocument('pos', po.id, {
        ...getPOQueueUpdate('waiting_invoice', {
          deliveryStage: 'customer_outbound',
          deliveryProgress: 'delivered_with_tolerance'
        }),
        historyLogs: updatedLogs
      });

      onRefresh();
    }
  };

  return (
    <div className="delivery-view delivery-control-center">
      <div className="page-header delivery-page-header">
        <div>
          <h1 className="page-title">TRUNG TÂM ĐIỀU PHỐI GIAO HÀNG</h1>
          <p className="page-subtitle">Gom đơn theo tuyến, kiểm soát tải trọng, tránh trùng xe và theo dõi ký nhận đến khi hoàn tất.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'producer' || currentUser.role === 'sale') && (
          <button className="btn btn-primary" onClick={handleOpenAddTrip}>Lập chuyến giao hàng</button>
        )}
      </div>

      <div className="delivery-tabs" role="tablist" aria-label="Điều phối giao hàng">
        {([
          ['control', 'Bảng điều phối'],
          ['trips', 'Chuyến giao'],
          ['fleet', 'Xe & tài xế'],
          ['proof', 'POD & đối soát']
        ] as Array<[DeliveryTab, string]>).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            className={activeTab === tabKey ? 'active' : ''}
            onClick={() => setActiveTab(tabKey)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="delivery-kpi-grid">
        <div className="delivery-kpi-card">
          <span>Đơn chờ xếp chuyến</span>
          <strong>{unplannedOrders.length}</strong>
          <small>{readyOrders.length} đơn đã sẵn sàng giao</small>
        </div>
        <div className="delivery-kpi-card">
          <span>Chuyến đang hoạt động</span>
          <strong>{activeTrips.length}</strong>
          <small>{activeTrips.filter(trip => trip.status === 'delivering').length} chuyến đang trên đường</small>
        </div>
        <div className="delivery-kpi-card">
          <span>Xe sẵn sàng</span>
          <strong>{vehicles.filter(vehicle => vehicle.status === 'ready').length}</strong>
          <small>{vehicles.length} xe trong danh mục</small>
        </div>
        <div className="delivery-kpi-card">
          <span>Hệ số tải trung bình</span>
          <strong>{averageLoadFactor}%</strong>
          <small>{formatCurrency(totalEstimatedCost)} chi phí dự kiến</small>
        </div>
      </div>

      {activeTab === 'control' && (
        <>
          <div className="delivery-section-card">
            <div className="delivery-section-heading">
              <div>
                <h2>Cảnh báo điều hành</h2>
                <p>Kiểm soát quá hạn, quá tải, trùng lịch và cơ hội ghép chuyến.</p>
              </div>
              <span className="delivery-count-chip">{deliveryAlerts.length} cảnh báo</span>
            </div>
            <div className="delivery-alert-list">
              {deliveryAlerts.map((alert, index) => (
                <div className={`delivery-alert delivery-alert-${alert.level}`} key={`${alert.title}-${index}`}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              ))}
              {deliveryAlerts.length === 0 && (
                <div className="delivery-empty-state">Chưa phát hiện xung đột vận chuyển.</div>
              )}
            </div>
          </div>

          <div className="delivery-control-grid">
            <div className="delivery-section-card">
              <div className="delivery-section-heading">
                <div>
                  <h2>Gợi ý gom đơn theo tuyến</h2>
                  <p>Ưu tiên cùng khu vực, tải trọng và hạn giao gần nhau.</p>
                </div>
              </div>
              <div className="delivery-route-list">
                {regionSuggestions.map(group => (
                  <div className="delivery-route-card" key={group.region}>
                    <div>
                      <strong>Tuyến {group.region}</strong>
                      <span>{group.orders.map(po => po.poCode).join(', ')}</span>
                    </div>
                    <div className="delivery-route-stats">
                      <b>{group.orders.length} đơn</b>
                      <span>{group.estimatedWeightKg.toLocaleString('vi-VN')} kg</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setRegion(group.region);
                          handleOpenAddTrip();
                          setSelectedOrderIds(group.orders.map(po => po.id));
                        }}
                      >
                        Lập chuyến
                      </button>
                    </div>
                  </div>
                ))}
                {regionSuggestions.length === 0 && (
                  <div className="delivery-empty-state">Không có đơn đã đóng gói đang chờ xếp chuyến.</div>
                )}
              </div>
            </div>

            <div className="delivery-section-card">
              <div className="delivery-section-heading">
                <div>
                  <h2>Năng lực đội xe</h2>
                  <p>Tình trạng xe theo thời gian thực.</p>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setActiveTab('fleet')}>Xem đội xe</button>
              </div>
              <div className="delivery-fleet-summary">
                {(['ready', 'running', 'maintenance', 'inactive'] as DeliveryVehicle['status'][]).map(status => (
                  <div key={status}>
                    <span>{VEHICLE_STATUS_LABELS[status]}</span>
                    <strong>{vehicles.filter(vehicle => vehicle.status === status).length}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="delivery-section-card">
            <div className="delivery-section-heading">
              <div>
                <h2>Đơn đã sẵn sàng nhưng chưa xếp chuyến</h2>
                <p>Dữ liệu lấy trực tiếp từ PO đã đóng gói hoặc đang giao một phần.</p>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Khách hàng</th>
                    <th>Khu vực</th>
                    <th>Hạn giao</th>
                    <th>Số lượng còn giao</th>
                    <th>Tải ước tính</th>
                    <th>Ưu tiên</th>
                  </tr>
                </thead>
                <tbody>
                  {unplannedOrders.map(po => {
                    const dueDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
                    const isOverdue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < DELIVERY_PAGE_OPENED_AT;
                    return (
                      <tr key={po.id}>
                        <td><strong>{po.poCode}</strong></td>
                        <td>{po.customerName}</td>
                        <td>{getOrderRegion(po)}</td>
                        <td>{dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toLocaleDateString('vi-VN') : 'Chưa có'}</td>
                        <td>{getOrderRemainingQuantity(po).toLocaleString('vi-VN')}</td>
                        <td>{estimateOrderWeightKg(po).toLocaleString('vi-VN')} kg</td>
                        <td><span className={`delivery-status ${isOverdue ? 'danger' : 'neutral'}`}>{isOverdue ? 'Quá hạn' : 'Bình thường'}</span></td>
                      </tr>
                    );
                  })}
                  {unplannedOrders.length === 0 && (
                    <tr><td colSpan={7}><div className="delivery-empty-state">Không có đơn chờ xếp chuyến.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'trips' && (
        <>
          <div className="delivery-section-card">
            <div className="delivery-section-heading">
              <div>
                <h2>Danh sách chuyến giao hàng</h2>
                <p>Theo dõi từ lập kế hoạch, duyệt chuyến, bốc hàng đến hoàn thành.</p>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã chuyến</th>
                    <th>Tuyến</th>
                    <th>Xe / tài xế</th>
                    <th>Ngày & khung giờ</th>
                    <th>Số điểm</th>
                    <th>Tải xe</th>
                    <th>Chi phí dự kiến</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(trip => (
                    <tr key={trip.id}>
                      <td><strong>{trip.delCode}</strong></td>
                      <td>{trip.region}</td>
                      <td><strong>{trip.vehiclePlate || 'Chưa chọn xe'}</strong><br /><small>{trip.driverName || 'Chưa chọn tài xế'}</small></td>
                      <td>{toDateInputValue(trip.deliveryDate) || 'Chưa có'}<br /><small>{trip.timeWindowStart || '08:00'}–{trip.timeWindowEnd || '17:00'}</small></td>
                      <td>{trip.orders?.length || 0}</td>
                      <td>{Number(trip.estimatedLoadKg || 0).toLocaleString('vi-VN')} kg<br /><small>{Number(trip.loadFactor || 0)}%</small></td>
                      <td>{formatCurrency(trip.estimatedCost)}</td>
                      <td><span className={`delivery-status ${trip.status}`}>{TRIP_STATUS_LABELS[trip.status] || trip.status}</span></td>
                      <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedTrip(trip)}>Chi tiết</button></td>
                    </tr>
                  ))}
                  {deliveries.length === 0 && (
                    <tr><td colSpan={9}><div className="delivery-empty-state">Chưa có chuyến giao hàng nào.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedTrip && (
            <div className="delivery-section-card delivery-trip-detail">
              <div className="delivery-section-heading">
                <div>
                  <h2>Chi tiết {selectedTrip.delCode}</h2>
                  <p>Tuyến {selectedTrip.region} · {selectedTrip.vehiclePlate} · {selectedTrip.driverName}</p>
                </div>
                <div className="delivery-actions">
                  {selectedTrip.status === 'planning' && (
                    <>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => handleOpenEditTrip(selectedTrip)}>Sửa kế hoạch</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteTrip(selectedTrip.id)}>Xóa chuyến</button>
                    </>
                  )}
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedTrip(null)}>Đóng chi tiết</button>
                </div>
              </div>

              <div className="delivery-trip-progress">
                {['planning', 'approved', 'loading', 'delivering', 'completed'].map((status, index) => {
                  const currentIndex = ['planning', 'approved', 'loading', 'delivering', 'completed'].indexOf(selectedTrip.status);
                  return <div className={currentIndex >= index ? 'done' : ''} key={status}><span>{index + 1}</span><b>{TRIP_STATUS_LABELS[status]}</b></div>;
                })}
              </div>

              <div className="delivery-detail-grid">
                <div><span>Ngày giao</span><strong>{toDateInputValue(selectedTrip.deliveryDate) || 'Chưa có'}</strong></div>
                <div><span>Khung giờ</span><strong>{selectedTrip.timeWindowStart || '08:00'}–{selectedTrip.timeWindowEnd || '17:00'}</strong></div>
                <div><span>Tải trọng</span><strong>{Number(selectedTrip.estimatedLoadKg || 0).toLocaleString('vi-VN')} / {Number(selectedTrip.capacityKg || 0).toLocaleString('vi-VN')} kg</strong></div>
                <div><span>Quãng đường</span><strong>{Number(selectedTrip.estimatedDistanceKm || 0).toLocaleString('vi-VN')} km</strong></div>
                <div><span>Chi phí</span><strong>{formatCurrency(selectedTrip.estimatedCost)}</strong></div>
                <div><span>Ưu tiên</span><strong>{selectedTrip.priority === 'urgent' ? 'Khẩn cấp' : selectedTrip.priority === 'high' ? 'Cao' : 'Bình thường'}</strong></div>
              </div>

              <div className="delivery-workflow-actions">
                {selectedTrip.status === 'planning' && <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'approved')}>Duyệt chuyến</button>}
                {selectedTrip.status === 'approved' && <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'loading')}>Bắt đầu bốc hàng</button>}
                {selectedTrip.status === 'loading' && <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'delivering')}>Xác nhận xe xuất phát</button>}
                {selectedTrip.status === 'delivering' && <button className="btn btn-outline" onClick={() => handleRevertTripStatus(selectedTrip)}>Hoãn chuyến</button>}
                {selectedTrip.status === 'postponed' && <button className="btn btn-primary" onClick={() => updateTripStatus(selectedTrip.id, 'planning')}>Khôi phục kế hoạch</button>}
              </div>

              <h3 className="delivery-subheading">Các điểm giao trong chuyến</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Thứ tự</th><th>Khách hàng</th><th>Địa chỉ</th><th>Số lượng</th><th>POD</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {selectedTrip.orders?.map((order: any, index: number) => (
                      <tr key={order.poId}>
                        <td>{order.stopSequence || index + 1}</td>
                        <td><strong>{order.customerName}</strong></td>
                        <td>{order.deliveryAddress}</td>
                        <td>{Number(order.deliveredQty || 0).toLocaleString('vi-VN')}</td>
                        <td>{order.signatureImage ? <img className="delivery-signature" src={order.signatureImage} alt="Chữ ký nhận hàng" /> : 'Chưa ký'}</td>
                        <td><span className={`delivery-status ${order.status === 'success' ? 'completed' : 'planning'}`}>{order.status === 'success' ? 'Đã giao' : 'Chờ giao'}</span></td>
                        <td>{order.status !== 'success' && selectedTrip.status === 'delivering' && <button className="btn btn-sm btn-primary" onClick={() => handleOpenSignature(order.poId)}>Xác nhận giao</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="delivery-audit">
                Tạo bởi {selectedTrip.createdBy || 'Không xác định'} {selectedTrip.createdAt && `· ${new Date(selectedTrip.createdAt).toLocaleString('vi-VN')}`}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'fleet' && (
        <div className="delivery-section-card">
          <div className="delivery-section-heading">
            <div>
              <h2>Danh mục xe và tài xế</h2>
              <p>Quản lý tải trọng, trạng thái sẵn sàng và tuyến phù hợp của từng xe.</p>
            </div>
            {(currentUser.role === 'admin' || currentUser.role === 'producer') && (
              <button type="button" className="btn btn-primary" onClick={() => setShowVehicleModal(true)}>Thêm xe</button>
            )}
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Biển số</th><th>Tên xe</th><th>Tải trọng</th><th>Tài xế</th><th>Điện thoại</th><th>Tuyến phù hợp</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
              <tbody>
                {vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.plate}</strong></td>
                    <td>{vehicle.vehicleName}</td>
                    <td>{Number(vehicle.capacityKg).toLocaleString('vi-VN')} kg</td>
                    <td>{vehicle.driverName}</td>
                    <td>{vehicle.driverPhone || '—'}</td>
                    <td>{vehicle.suitableRegions?.join(', ') || 'Tất cả tuyến'}</td>
                    <td><span className={`delivery-status ${vehicle.status}`}>{VEHICLE_STATUS_LABELS[vehicle.status]}</span></td>
                    <td>
                      <select
                        aria-label={`Trạng thái xe ${vehicle.plate}`}
                        value={vehicle.status}
                        onChange={event => updateVehicleStatus(vehicle, event.target.value as DeliveryVehicle['status'])}
                        disabled={currentUser.role !== 'admin' && currentUser.role !== 'producer'}
                      >
                        <option value="ready">Sẵn sàng</option>
                        <option value="running">Đang chạy</option>
                        <option value="maintenance">Bảo trì</option>
                        <option value="inactive">Ngừng sử dụng</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!fleetLoading && vehicles.length === 0 && (
                  <tr><td colSpan={8}><div className="delivery-empty-state">Chưa có xe trong danh mục.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'proof' && (
        <>
          <div className="delivery-section-card">
            <div className="delivery-section-heading">
              <div>
                <h2>POD và đối soát giao hàng</h2>
                <p>Theo dõi ký nhận, giao từng phần và chứng từ của từng điểm giao.</p>
              </div>
              <span className="delivery-count-chip">{proofRows.filter(row => row.signatureImage).length}/{proofRows.length} đã có POD</span>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Mã chuyến</th><th>Ngày giao</th><th>Khách hàng</th><th>Khu vực</th><th>Số lượng giao</th><th>Chữ ký</th><th>Kết quả</th></tr></thead>
                <tbody>
                  {proofRows.map(row => (
                    <tr key={`${row.tripId}-${row.poId}`}>
                      <td><strong>{row.delCode}</strong></td>
                      <td>{toDateInputValue(row.deliveryDate) || 'Chưa có'}</td>
                      <td>{row.customerName}</td>
                      <td>{row.region}</td>
                      <td>{Number(row.deliveredQty || 0).toLocaleString('vi-VN')}</td>
                      <td>{row.signatureImage ? <img className="delivery-signature" src={row.signatureImage} alt="Chữ ký nhận hàng" /> : 'Chưa có'}</td>
                      <td><span className={`delivery-status ${row.status === 'success' ? 'completed' : row.tripStatus}`}>{row.status === 'success' ? 'Đã giao' : TRIP_STATUS_LABELS[row.tripStatus] || 'Chờ giao'}</span></td>
                    </tr>
                  ))}
                  {proofRows.length === 0 && (
                    <tr><td colSpan={7}><div className="delivery-empty-state">Chưa phát sinh chứng từ giao hàng.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="delivery-section-card">
            <div className="delivery-section-heading"><div><h2>Đơn giao từng phần và đóng dung sai</h2><p>Chỉ đóng đơn khi khách hàng chấp nhận phần thiếu.</p></div></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Mã PO</th><th>Khách hàng</th><th>Yêu cầu</th><th>Đã giao</th><th>Còn thiếu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {pos.filter(po => (
                    isPOInQueue(po, 'waiting_delivery') && (
                      ['partial', 'delivering'].includes(po.deliveryProgress) ||
                      ['partially_delivered', 'delivering'].includes(po.status)
                    )
                  )).map(po => {
                    const totalRequired = po.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) || 0;
                    const totalDelivered = po.items?.reduce((sum: number, item: any) => sum + Number(item.qtyDelivered || 0), 0) || 0;
                    return (
                      <tr key={po.id}>
                        <td><strong>{po.poCode}</strong></td><td>{po.customerName}</td><td>{totalRequired.toLocaleString('vi-VN')}</td><td>{totalDelivered.toLocaleString('vi-VN')}</td><td>{Math.max(0, totalRequired - totalDelivered).toLocaleString('vi-VN')}</td>
                        <td><span className="delivery-status warning">{po.deliveryProgress === 'partial' || po.status === 'partially_delivered' ? 'Giao một phần' : 'Đang giao'}</span></td>
                        <td>{(currentUser.role === 'admin' || currentUser.role === 'sale') && <button className="btn btn-sm btn-danger" onClick={() => handleForceClosePO(po)}>Đóng dung sai</button>}</td>
                      </tr>
                    );
                  })}
                  {pos.filter(po => (
                    isPOInQueue(po, 'waiting_delivery') && (
                      ['partial', 'delivering'].includes(po.deliveryProgress) ||
                      ['partially_delivered', 'delivering'].includes(po.status)
                    )
                  )).length === 0 && (
                    <tr><td colSpan={7}><div className="delivery-empty-state">Không có đơn giao dở dang.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CREATE TRIP MODAL */}
      {showAddTripModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('LẬP CHUYẾN XE GIAO HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddTripModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreateTrip}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Khu Vực Tuyến Đường Giao Hàng *')}</label>
                    <select value={region} onChange={e => setRegion(e.target.value)}>
                      {DELIVERY_REGIONS.map(regionName => <option value={regionName} key={regionName}>{regionName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Mức độ ưu tiên</label>
                    <select value={tripPriority} onChange={e => setTripPriority(e.target.value)}>
                      <option value="normal">Bình thường</option>
                      <option value="high">Cao</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>Xe vận chuyển *</label>
                    <select value={selectedVehicleId} onChange={e => handleVehicleSelection(e.target.value)} required>
                      <option value="">Chọn xe sẵn sàng</option>
                      {vehicles.filter(vehicle => vehicle.status === 'ready').map(vehicle => (
                        <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.vehicleName} · {vehicle.capacityKg.toLocaleString('vi-VN')} kg</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tài xế</label>
                    <input type="text" value={driverName} readOnly placeholder="Chọn xe để lấy tài xế" />
                  </div>
                  <div className="form-group">
                    <label>Biển số</label>
                    <input type="text" value={vehiclePlate} readOnly placeholder="Chưa chọn xe" />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group"><label>Nhận hàng từ</label><input type="time" value={timeWindowStart} onChange={e => setTimeWindowStart(e.target.value)} /></div>
                  <div className="form-group"><label>Nhận hàng đến</label><input type="time" value={timeWindowEnd} onChange={e => setTimeWindowEnd(e.target.value)} /></div>
                  <div className="form-group"><label>Quãng đường dự kiến (km)</label><input type="number" min="0" value={estimatedDistanceKm} onChange={e => setEstimatedDistanceKm(Number(e.target.value))} /></div>
                  <div className="form-group"><label>Chi phí dự kiến (đ)</label><input type="number" min="0" value={estimatedCost} onChange={e => setEstimatedCost(Number(e.target.value))} /></div>
                </div>

                <h3 style={{ fontSize: '13px', marginTop: '16px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                  {t('Chọn Các Đơn Hàng Sẵn Sàng Giao (QC Đã Duyệt)')} "{t(region)}":
                </h3>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px' }}>
                  {getPackedOrdersInRegion(region).map(po => {
                    const isChecked = selectedOrderIds.includes(po.id);
                    return (
                      <div key={po.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <input 
                          type="checkbox" 
                          id={`chk-${po.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds([...selectedOrderIds, po.id]);
                            } else {
                              setSelectedOrderIds(selectedOrderIds.filter(id => id !== po.id));
                            }
                          }}
                          style={{ width: 'auto' }}
                        />
                        <label htmlFor={`chk-${po.id}`} style={{ fontWeight: 'normal', cursor: 'pointer' }}>
                          <strong>{po.poCode}</strong> - {po.customerName} · Còn {getOrderRemainingQuantity(po).toLocaleString('vi-VN')} · Ước tính {estimateOrderWeightKg(po).toLocaleString('vi-VN')} kg
                        </label>
                      </div>
                    );
                  })}
                  {getPackedOrdersInRegion(region).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {t('Không có lịch giao hàng sắp tới cho tuyến này.')}
                    </div>
                  )}
                </div>

                <div className="delivery-load-summary">
                  <div><span>Tải ước tính</span><strong>{selectedEstimatedWeight.toLocaleString('vi-VN')} kg</strong></div>
                  <div><span>Tải trọng xe</span><strong>{Number(selectedVehicle?.capacityKg || 0).toLocaleString('vi-VN')} kg</strong></div>
                  <div><span>Hệ số sử dụng</span><strong style={{ color: selectedLoadFactor > 100 ? '#b91c1c' : '#173b8f' }}>{selectedLoadFactor}%</strong></div>
                </div>

                <div className="form-group">
                  <label>Ghi chú điều phối</label>
                  <textarea value={tripNote} onChange={e => setTripNote(e.target.value)} placeholder="Yêu cầu bốc xếp, liên hệ trước, chứng từ mang theo..." rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddTripModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Chuyến Xe')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRIP MODAL */}
      {showEditTripModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA CHUYẾN XE GIAO HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditTripModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditTripSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>{t('Khu Vực Tuyến Đường Giao Hàng *')}</label>
                    <select value={editRegion} onChange={e => setEditRegion(e.target.value)}>
                      {DELIVERY_REGIONS.map(regionName => <option value={regionName} key={regionName}>{regionName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Ngày Giao Hàng Dự Kiến *')}</label>
                    <input type="date" value={editDeliveryDate} onChange={e => setEditDeliveryDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Mức độ ưu tiên</label>
                    <select value={editTripPriority} onChange={e => setEditTripPriority(e.target.value)}>
                      <option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>Xe vận chuyển *</label>
                    <select
                      value={editVehicleId}
                      onChange={e => {
                        setEditVehicleId(e.target.value);
                        const vehicle = vehicles.find(item => item.id === e.target.value);
                        setEditDriverName(vehicle?.driverName || '');
                        setEditVehiclePlate(vehicle?.plate || '');
                      }}
                      required
                    >
                      <option value="">Chọn xe</option>
                      {vehicles.filter(vehicle => vehicle.status === 'ready' || vehicle.id === editVehicleId).map(vehicle => (
                        <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.vehicleName} · {vehicle.capacityKg.toLocaleString('vi-VN')} kg</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tài xế</label><input type="text" value={editDriverName} readOnly />
                  </div>
                  <div className="form-group"><label>Biển số</label><input type="text" value={editVehiclePlate} readOnly /></div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group"><label>Nhận hàng từ</label><input type="time" value={editTimeWindowStart} onChange={e => setEditTimeWindowStart(e.target.value)} /></div>
                  <div className="form-group"><label>Nhận hàng đến</label><input type="time" value={editTimeWindowEnd} onChange={e => setEditTimeWindowEnd(e.target.value)} /></div>
                  <div className="form-group"><label>Quãng đường dự kiến (km)</label><input type="number" min="0" value={editEstimatedDistanceKm} onChange={e => setEditEstimatedDistanceKm(Number(e.target.value))} /></div>
                  <div className="form-group"><label>Chi phí dự kiến (đ)</label><input type="number" min="0" value={editEstimatedCost} onChange={e => setEditEstimatedCost(Number(e.target.value))} /></div>
                </div>

                <h3 style={{ fontSize: '13px', marginTop: '16px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                  {t('Chọn Các Đơn Hàng Sẵn Sàng Giao (QC Đã Duyệt)')} "{t(editRegion)}":
                </h3>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px' }}>
                  {getPackedOrdersInRegion(editRegion, editSelectedOrderIds).map(po => {
                    const isChecked = editSelectedOrderIds.includes(po.id);
                    return (
                      <div key={po.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <input 
                          type="checkbox" 
                          id={`edit-chk-${po.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSelectedOrderIds([...editSelectedOrderIds, po.id]);
                            } else {
                              setEditSelectedOrderIds(editSelectedOrderIds.filter(id => id !== po.id));
                            }
                          }}
                          style={{ width: 'auto' }}
                        />
                        <label htmlFor={`edit-chk-${po.id}`} style={{ fontWeight: 'normal', cursor: 'pointer' }}>
                          <strong>{po.poCode}</strong> - {po.customerName} · Còn {getOrderRemainingQuantity(po).toLocaleString('vi-VN')} · Ước tính {estimateOrderWeightKg(po).toLocaleString('vi-VN')} kg
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div className="delivery-load-summary">
                  <div><span>Tải ước tính</span><strong>{editSelectedEstimatedWeight.toLocaleString('vi-VN')} kg</strong></div>
                  <div><span>Tải trọng xe</span><strong>{Number(editSelectedVehicle?.capacityKg || 0).toLocaleString('vi-VN')} kg</strong></div>
                  <div><span>Hệ số sử dụng</span><strong style={{ color: editSelectedLoadFactor > 100 ? '#b91c1c' : '#173b8f' }}>{editSelectedLoadFactor}%</strong></div>
                </div>

                <div className="form-group"><label>Ghi chú điều phối</label><textarea value={editTripNote} onChange={e => setEditTripNote(e.target.value)} rows={2} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditTripModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật Chuyến')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVehicleModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>THÊM XE VÀ TÀI XẾ</span>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowVehicleModal(false)}>Đóng</button>
            </div>
            <form onSubmit={handleCreateVehicle}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group"><label>Biển số *</label><input value={newVehicle.plate} onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })} required /></div>
                  <div className="form-group"><label>Tên / loại xe *</label><input value={newVehicle.vehicleName} onChange={e => setNewVehicle({ ...newVehicle, vehicleName: e.target.value })} placeholder="Xe tải 1,25 tấn" required /></div>
                  <div className="form-group"><label>Tải trọng (kg) *</label><input type="number" min="1" value={newVehicle.capacityKg} onChange={e => setNewVehicle({ ...newVehicle, capacityKg: Number(e.target.value) })} required /></div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group"><label>Tài xế phụ trách *</label><input value={newVehicle.driverName} onChange={e => setNewVehicle({ ...newVehicle, driverName: e.target.value })} required /></div>
                  <div className="form-group"><label>Điện thoại</label><input value={newVehicle.driverPhone} onChange={e => setNewVehicle({ ...newVehicle, driverPhone: e.target.value })} /></div>
                  <div className="form-group"><label>Trạng thái</label><select value={newVehicle.status} onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value as DeliveryVehicle['status'] })}><option value="ready">Sẵn sàng</option><option value="maintenance">Bảo trì</option><option value="inactive">Ngừng sử dụng</option></select></div>
                </div>
                <div className="form-group">
                  <label>Tuyến phù hợp</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '10px' }}>
                    {DELIVERY_REGIONS.map(regionName => (
                      <label key={regionName} style={{ alignItems: 'center', display: 'flex', gap: '5px', fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={newVehicle.suitableRegions.includes(regionName)}
                          onChange={e => setNewVehicle({
                            ...newVehicle,
                            suitableRegions: e.target.checked
                              ? [...newVehicle.suitableRegions, regionName]
                              : newVehicle.suitableRegions.filter(item => item !== regionName)
                          })}
                          style={{ width: 'auto' }}
                        />
                        {regionName}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowVehicleModal(false)}>Hủy</button><button type="submit" className="btn btn-primary">Lưu xe</button></div>
            </form>
          </div>
        </div>
      )}

      {/* SIGNATURE & PARTIAL DELIVERY QUANTITY MODAL */}
      {showSignatureModal && signingPo && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('XÁC NHẬN GIAO LẺ & KÝ NHẬN')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowSignatureModal(false)}>{t('Hủy')}</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '4px' }}>
                <div><strong>{t('Khách Hàng:')}</strong> {signingPo.customerName}</div>
                <div><strong>{t('Đơn PO Gốc:')}</strong> {signingPo.poCode}</div>
              </div>

              <h4 style={{ color: 'var(--color-primary)', fontSize: '13px', margin: '4px 0' }}>{t('Chi Tiết Số Lượng Bàn Giao:')}</h4>
              <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                <table style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>{t('Tên Hàng')}</th>
                      <th>{t('SL Đặt')}</th>
                      <th>{t('Đã Giao')}</th>
                      <th style={{ width: '100px' }}>{t('Giao Đợt Này')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signingPo.items?.map((item: any) => {
                      const itemId = item.itemId || item.productCode;
                      const remaining = Number(item.quantity) - (Number(item.qtyDelivered) || 0);
                      return (
                        <tr key={itemId}>
                          <td style={{ fontWeight: 500 }}>{item.productName}</td>
                          <td>{item.quantity?.toLocaleString()}</td>
                          <td>{(item.qtyDelivered || 0)?.toLocaleString()}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={deliveredQuantities[itemId] !== undefined ? deliveredQuantities[itemId] : remaining}
                              onChange={e => setDeliveredQuantities({
                                ...deliveredQuantities,
                                [itemId]: Math.max(0, Math.min(remaining, Number(e.target.value)))
                              })}
                              style={{ width: '80px', padding: '4px', fontSize: '12px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '8px 0 0 0', textAlign: 'center' }}>
                {t('Ký tên nhận hàng trực tuyến vào khung dưới đây để hoàn tất giao lẻ:')}
              </p>
              
              <canvas 
                ref={canvasRef}
                width="460" 
                height="180" 
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{ border: '2px solid var(--color-primary)', borderRadius: '4px', cursor: 'crosshair', backgroundColor: '#ffffff', touchAction: 'none' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={clearCanvas}>{t('Xóa Chữ Ký')}</button>
                <button type="button" className="btn btn-sm btn-success" onClick={saveSignature}>{t('Xác Nhận Giao Hàng')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
