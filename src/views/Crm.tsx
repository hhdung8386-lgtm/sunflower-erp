import React, { useState, useEffect } from 'react';
import { dbService } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { HorizontalBarChart } from '../components/VisualCharts';
import { getPOBadgeClass, getPOQueueLabel } from '../domain/poWorkflow';
import { sortNewestFirst } from '../domain/recordOrdering';
import { formatDate, formatDateTime, parseValidDate } from '../domain/dateFormatting';
import type {
  CustomerContactRecord,
  CustomerContactRole,
  CustomerRank,
  CustomerRecord
} from '../domain/crmModels';
import type { PODiscountType } from '../domain/poFinancials';
import '../components/CustomerHistory.css';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  X, 
  UserCheck, 
  MessageSquare, 
  Paperclip, 
  Folder, 
  FileText, 
  Download, 
  Upload,
  Phone,
  Mail,
  User,
  Eye,
  AlertCircle,
  Copy,
  ArrowLeft,
  Building2,
  Tag,
  Users,
  ShoppingBag
} from 'lucide-react';

const CUSTOMER_FILE_FOLDERS = [
  'Hợp đồng',
  'Biên bản nghiệm thu',
  'QC',
  'QA',
  'Artwork',
  'Báo giá',
  'Khác'
];

const CONTACT_ROLE_LABELS: Record<CustomerContactRole, string> = {
  primary: 'Liên hệ chính',
  procurement: 'Mua hàng',
  warehouse: 'Kho / nhận hàng',
  accounting: 'Kế toán',
  other: 'Khác'
};

interface CrmProps {
  customers: CustomerRecord[];
  pos: any[];
  users: any[];
  currentUser: any;
  onRefresh: () => void;
  onRepeatOrder?: (poId: string) => void;
}

const loadSpecsToFields = (productType: string, specifications: any = {}) => {
  const specs = specifications || {};
  if (specs.fields && Array.isArray(specs.fields)) {
    return specs.fields;
  }
  
  const fields = [];
  if (productType === 'muc_in') {
    fields.push({ id: 'ribbonType', label: 'Loại mực', value: specs.ribbonType || 'WAX PREMIUM', type: 'select', options: ['WAX PREMIUM', 'WAX RESIN', 'RESIN'] });
    fields.push({ id: 'direction', label: 'Chiều quấn', value: specs.direction || 'Out side', type: 'select', options: ['Out side', 'In side'] });
    fields.push({ id: 'size', label: 'Khổ mực', value: specs.size || '110mm x 300m', type: 'text' });
    fields.push({ id: 'color', label: 'Màu mực', value: specs.color || 'Đen', type: 'text' });
  } else if (productType === 'tem_trang_cuon' || productType === 'tem_mau_cuon') {
    fields.push({ id: 'width', label: 'Rộng tem (mm)', value: specs.width || 80, type: 'number' });
    fields.push({ id: 'height', label: 'Cao tem (mm)', value: specs.height || 55, type: 'number' });
    fields.push({ id: 'gap', label: 'Bước răng/Gap', value: specs.gap || 3, type: 'number' });
    fields.push({ id: 'qtyPerRoll', label: 'Số tem/cuộn', value: specs.qtyPerRoll || 1000, type: 'number' });
    fields.push({ id: 'core', label: 'Cỡ lõi cuộn', value: specs.core || specs.windingCore || '76mm', type: 'select', options: ['76mm', '42mm', '29mm', '40mm', '25mm'] });
    fields.push({ id: 'dieCut', label: 'Kiểu bế góc', value: specs.dieCut || 'Bo góc R2', type: 'select', options: ['Bo góc R2', 'Bo góc R3', 'Bo góc R5', 'Vuông góc'] });
    fields.push({ id: 'perforated', label: 'Răng cưa xé', value: specs.perforated || 'Không răng cưa', type: 'select', options: ['Không răng cưa', 'Có răng cưa xé'] });
    fields.push({ id: 'windDirection', label: 'Hướng tem ra', value: specs.windDirection || 'Ra đầu trước', type: 'select', options: ['Ra đầu trước', 'Ra đầu sau', 'Chữ quay trái', 'Chữ quay phải', 'Head First', 'Tail First', 'Left First', 'Right First'] });
    fields.push({ id: 'windDirectionFiles', label: 'Tải Lên Ảnh/File Hướng Tem Ra', value: specs.windDirectionFiles || [], type: 'file' });
    
    if (productType === 'tem_mau_cuon') {
      fields.push({ id: 'colors', label: 'Số màu in / Diễn giải màu', value: specs.colors || '4 màu', type: 'text' });
      fields.push({ id: 'processing', label: 'Quy cách gia công', value: specs.processing || [], type: 'checkboxes', options: ['Cán bóng', 'Cán mờ', 'Phủ UV', 'Ép kim', 'Bế demi', 'Bế đứt'] });
    }
  } else if (productType === 'tem_mau_to') {
    fields.push({ id: 'width', label: 'Chiều Rộng (mm)', value: specs.width || 80, type: 'number' });
    fields.push({ id: 'height', label: 'Chiều Cao/Dài (mm)', value: specs.height || 55, type: 'number' });
    fields.push({ id: 'corner', label: 'Góc tem tờ', value: specs.corner || 'Bo góc R2', type: 'select', options: ['Bo góc R2', 'Bo góc R3', 'Bo góc R5', 'Vuông góc'] });
    fields.push({ id: 'lamination', label: 'Cán màng bảo vệ', value: specs.lamination || 'Không cán', type: 'select', options: ['Không cán', 'Cán bóng', 'Cán mờ'] });
    fields.push({ id: 'finished', label: 'Thành phẩm sau in', value: specs.finished || 'Bế demi', type: 'select', options: ['Bế demi', 'Bế đứt', 'Xén thành phẩm', 'Giao nguyên tờ'] });
    fields.push({ id: 'sheetType', label: 'Quy cách khổ tờ', value: specs.sheetType || 'A4', type: 'select', options: ['A4', 'A3', '310 x 450', '330 x 480'] });
  }
  
  if (specs.custom && Array.isArray(specs.custom)) {
    specs.custom.forEach((c: any, index: number) => {
      fields.push({ id: `custom_${index}_${Date.now()}`, label: c.key, value: c.value, type: 'text' });
    });
  }
  
  return fields;
};

export const Crm: React.FC<CrmProps> = ({ customers, pos, users, currentUser, onRefresh, onRepeatOrder }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'needs_care'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  const [chartMonth, setChartMonth] = useState<string>('all');
  const [chartYear, setChartYear] = useState<string>('2026');
  const [showTop15, setShowTop15] = useState<boolean>(false);
  
  // File Repository states
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState('');
  const [repoUploadFile, setRepoUploadFile] = useState('');
  const [repoUploadFileName, setRepoUploadFileName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Dynamic categories and admin approvals states
  const [productClassifications, setProductClassifications] = useState<any[]>([]);
  const [windDirections, setWindDirections] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<any | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedEditRequest, setSelectedEditRequest] = useState<any | null>(null);
  const [windDirectionFiles, setWindDirectionFiles] = useState<any[]>([]);

  useEffect(() => {
    const unsubClass = dbService.subscribeCollection('product_classifications', setProductClassifications);
    const unsubWind = dbService.subscribeCollection('wind_directions', setWindDirections);
    const unsubReqs = dbService.subscribeCollection('edit_requests', setEditRequests);
    return () => {
      unsubClass();
      unsubWind();
      unsubReqs();
    };
  }, []);

  const handleWindDirectionFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const base64Promises = Array.from(files).map((file) => {
      return new Promise<any>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, url: reader.result as string });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });
    try {
      const base64Files = await Promise.all(base64Promises);
      setWindDirectionFiles(prev => [...prev, ...base64Files]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFieldValue = (fieldId: string, value: any) => {
    setSpecFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
  };

  const handleDeleteField = (fieldId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa thông số này?'))) {
      setSpecFields(prev => prev.filter(f => f.id !== fieldId));
    }
  };

  const handleStartEditLabel = (fieldId: string, currentLabel: string) => {
    setEditingLabelId(fieldId);
    setTempLabelText(currentLabel);
  };

  const handleSaveLabel = (fieldId: string) => {
    if (tempLabelText.trim()) {
      setSpecFields(prev => prev.map(f => f.id === fieldId ? { ...f, label: tempLabelText.trim() } : f));
    }
    setEditingLabelId(null);
  };

  const handleAddField = () => {
    const newFieldId = `custom_${Date.now()}`;
    const newField = {
      id: newFieldId,
      label: t('Thông số mới'),
      value: '',
      type: 'text'
    };
    setSpecFields(prev => [...prev, newField]);
    setEditingLabelId(newFieldId);
    setTempLabelText(t('Thông số mới'));
  };

  const handleAddSelectField = () => {
    const newFieldId = `custom_${Date.now()}`;
    const newField = {
      id: newFieldId,
      label: t('Thông số mới'),
      value: t('Lựa chọn 1'),
      type: 'select',
      options: [t('Lựa chọn 1'), t('Lựa chọn 2')]
    };
    setSpecFields(prev => [...prev, newField]);
    setEditingLabelId(newFieldId);
    setTempLabelText(t('Thông số mới'));
  };

  const handleEditDropdownOptions = (fieldId: string) => {
    const field = specFields.find(f => f.id === fieldId);
    if (!field) return;
    const currentOpts = field.options || [];
    const newOptsStr = prompt(
      t('Nhập danh sách lựa chọn (phân cách bằng dấu phẩy):'),
      currentOpts.join(', ')
    );
    if (newOptsStr !== null) {
      const newOpts = newOptsStr
        .split(',')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
      
      if (newOpts.length === 0) {
        alert(t('Danh sách lựa chọn không được trống.'));
        return;
      }
      
      setSpecFields(prev => prev.map(f => {
        if (f.id === fieldId) {
          const newValue = newOpts.includes(f.value) ? f.value : newOpts[0];
          return { ...f, options: newOpts, value: newValue };
        }
        return f;
      }));
    }
  };

  const handleWindDirectionFilesChangeForField = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const base64Promises = Array.from(files).map((file) => {
      return new Promise<any>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, data: reader.result as string, url: reader.result as string });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });
    try {
      const base64Files = await Promise.all(base64Promises);
      setSpecFields(prev => prev.map(f => {
        if (f.id === fieldId) {
          const currentFiles = Array.isArray(f.value) ? f.value : [];
          return { ...f, value: [...currentFiles, ...base64Files] };
        }
        return f;
      }));
    } catch (err) {
      console.error(err);
    }
  };
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form fields
  const [customerCode, setCustomerCode] = useState('');
  const [customerRank, setCustomerRank] = useState<CustomerRank>('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [assignedSaleId, setAssignedSaleId] = useState('');
  const [discountType, setDiscountType] = useState<PODiscountType>('percent');
  const [discountRate, setDiscountRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [debtLimit, setDebtLimit] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('30 ngày');
  const [note, setNote] = useState('');
  const [additionalContacts, setAdditionalContacts] = useState<CustomerContactRecord[]>([]);
  
  const [procurementPhone, setProcurementPhone] = useState('');
  const [warehousePhone, setWarehousePhone] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const saleUsers = users.filter(u => u.role === 'sale');
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = dbService.subscribeCollection('suppliers', setSuppliers);
    return unsubscribe;
  }, []);

  const generateCustomerCode = () => {
    const usedCodes = new Set(customers.map(customer => customer.customerCode).filter(Boolean));
    let sequence = customers.length + 1;
    let candidate = `KH-${String(sequence).padStart(4, '0')}`;
    while (usedCodes.has(candidate)) {
      sequence += 1;
      candidate = `KH-${String(sequence).padStart(4, '0')}`;
    }
    return candidate;
  };

  const buildCustomerContacts = (): CustomerContactRecord[] => {
    const primaryContact: CustomerContactRecord = {
      id: 'primary',
      name: contactPerson.trim(),
      role: 'primary',
      phone: phone.trim(),
      email: email.trim(),
      note: ''
    };
    return [primaryContact, ...additionalContacts].filter(contact => (
      contact.name.trim() || contact.phone.trim() || contact.email.trim()
    ));
  };

  const addContactRow = () => {
    setAdditionalContacts(previous => [
      ...previous,
      {
        id: `contact-${Date.now()}`,
        name: '',
        role: 'procurement',
        phone: '',
        email: '',
        note: ''
      }
    ]);
  };

  const updateContactRow = (
    contactId: string,
    field: keyof CustomerContactRecord,
    value: string
  ) => {
    setAdditionalContacts(previous => previous.map(contact => (
      contact.id === contactId ? { ...contact, [field]: value } : contact
    )));
  };

  // Product List states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // General product form fields
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState<'muc_in' | 'tem_trang_cuon' | 'tem_mau_cuon' | 'tem_mau_to'>('tem_trang_cuon');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [productLayoutBase64, setProductLayoutBase64] = useState('');
  const [productUnit, setProductUnit] = useState('cái');
  const [productVatRate, setProductVatRate] = useState(8);
  const [productSupplierId, setProductSupplierId] = useState('');
  const [productPurchasePrice, setProductPurchasePrice] = useState(0);
  const [productDiscountType, setProductDiscountType] = useState<PODiscountType>('percent');
  const [productDiscountRate, setProductDiscountRate] = useState(0);
  const [productDiscountAmount, setProductDiscountAmount] = useState(0);
  const [productLeadTimeDays, setProductLeadTimeDays] = useState(0);

  // Specs - Ribbon
  const [specRibbonType, setSpecRibbonType] = useState('WAX PREMIUM');
  const [specRibbonDirection, setSpecRibbonDirection] = useState('Out side');
  const [specRibbonSize, setSpecRibbonSize] = useState('110mm x 300m');
  const [specRibbonColor, setSpecRibbonColor] = useState('Đen');

  // Specs - White roll
  const [specWidth, setSpecWidth] = useState(80);
  const [specHeight, setSpecHeight] = useState(55);
  const [specGap, setSpecGap] = useState(3);
  const [specPitch, setSpecPitch] = useState(58);
  const [specQtyPerRoll, setSpecQtyPerRoll] = useState(1000);
  const [specCore, setSpecCore] = useState('76mm');
  const [specDieCut, setSpecDieCut] = useState('Bo góc R2');
  const [specPerforated, setSpecPerforated] = useState('Không');
  const [specWindDirection, setSpecWindDirection] = useState('Ra đầu trước');

  // Specs - Color roll
  const [specColorColors, setSpecColorColors] = useState('4 màu');
  const [specColorForm, setSpecColorForm] = useState('Cuộn');
  const [specColorWindingCore, setSpecColorWindingCore] = useState('76mm');
  const [specColorProcessing, setSpecColorProcessing] = useState<string[]>([]);

  // Specs - Color sheet
  const [specSheetCorner, setSpecSheetCorner] = useState('Bo góc R2');
  const [specSheetLamination, setSpecSheetLamination] = useState('Cán bóng');
  const [specSheetFinished, setSpecSheetFinished] = useState('Xén thành phẩm');
  const [specSheetType, setSpecSheetType] = useState('A4');
  const [productMaterial, setProductMaterial] = useState('');
  const [specCustomRows, setSpecCustomRows] = useState<{ key: string; value: string }[]>([]);
  const [specFields, setSpecFields] = useState<any[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [tempLabelText, setTempLabelText] = useState('');
  const [requoteNote, setRequoteNote] = useState('');

  // Re-quote price dialog state
  const [showRequoteModal, setShowRequoteModal] = useState(false);
  const [requotePrice, setRequotePrice] = useState(0);

  // Contract list modals & states
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [contractNo, setContractNo] = useState('');
  const [contractSignDate, setContractSignDate] = useState('');
  const [contractExpiryDate, setContractExpiryDate] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [contractFile, setContractFile] = useState('');

  // Handle opening create modal
  const openAddModal = () => {
    setCustomerCode(generateCustomerCode());
    setCustomerRank('');
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTaxCode('');
    setAssignedSaleId(currentUser.role === 'sale' ? currentUser.uid : (saleUsers[0]?.uid || ''));
    setDiscountType('percent');
    setDiscountRate(0);
    setDiscountAmount(0);
    setDebtLimit(50000000);
    setPaymentTerms('30 ngày');
    setNote('');
    setProcurementPhone('');
    setWarehousePhone('');
    setBankAccount('');
    setAdditionalContacts([]);
    setShowAddModal(true);
  };

  // Handle opening edit modal
  const openEditModal = (cust: CustomerRecord) => {
    setCustomerCode(cust.customerCode);
    setCustomerRank(cust.customerRank);
    setCompanyName(cust.companyName);
    setContactPerson(cust.contactPerson);
    setPhone(cust.phone);
    setEmail(cust.email);
    setAddress(cust.address);
    setTaxCode(cust.taxCode);
    setAssignedSaleId(cust.assignedSaleId);
    setDiscountType(cust.discountType);
    setDiscountRate(cust.discountRate);
    setDiscountAmount(cust.discountAmount);
    setDebtLimit(cust.debtLimit);
    setPaymentTerms(cust.paymentTerms);
    setNote(cust.note);
    setProcurementPhone(cust.procurementPhone || '');
    setWarehousePhone(cust.warehousePhone || '');
    setBankAccount(cust.bankAccount || '');
    setAdditionalContacts(
      (cust.contacts || []).filter(contact => contact.role !== 'primary' && contact.id !== 'primary')
    );
    setSelectedCustomer(cust);
    setShowEditModal(true);
  };

  // Create customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    await dbService.addDocument('customers', {
      customerCode: customerCode.trim() || generateCustomerCode(),
      customerRank,
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountType,
      discountRate: Number(discountRate),
      discountAmount: Number(discountAmount),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note,
      procurementPhone,
      warehousePhone,
      bankAccount,
      contacts: buildCustomerContacts(),
      products: [],
      documents: [],
      contracts: [],
      files: [], // Repository for custom folders/files
      lastOrderAt: null,
      createdById: currentUser.uid,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString(),
      updatedBy: '',
      updatedAt: ''
    });

    setShowAddModal(false);
    onRefresh();
  };

  // Edit customer
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    await dbService.updateDocument('customers', selectedCustomer.id, {
      customerCode: customerCode.trim() || selectedCustomer.customerCode,
      customerRank,
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountType,
      discountRate: Number(discountRate),
      discountAmount: Number(discountAmount),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note,
      procurementPhone,
      warehousePhone,
      bankAccount,
      contacts: buildCustomerContacts(),
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditModal(false);
    setSelectedCustomer(null);
    onRefresh();
  };

  // Delete customer
  const handleDeleteCustomer = async (id: string) => {
    if (currentUser.role === 'admin') {
      const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (Giám Đốc/Admin):'));
      if (password === 'admin123' || password === '123456') {
        await dbService.updateDocument('customers', id, {
          deleted: true,
          deleteRequested: false,
          deleteRequestedAt: '',
          updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
          updatedAt: new Date().toISOString()
        });
        setSelectedCustomer(null);
        onRefresh();
        alert(t('Đã chuyển khách hàng vào Kho Rác.'));
      } else if (password !== null) {
        alert(t('Mật khẩu không chính xác. Xóa thất bại.'));
      }
    } else {
      if (window.confirm(t('Bạn có muốn gửi yêu cầu xóa khách hàng này tới Admin phê duyệt?'))) {
        await dbService.updateDocument('customers', id, {
          deleteRequested: true,
          deleteRequestedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
          deleteRequestedAt: new Date().toISOString()
        });
        alert(t('Đã gửi yêu cầu xóa khách hàng tới Admin.'));
        onRefresh();
      }
    }
  };

  const handleOpenEditProduct = (prod: any) => {
    setSelectedProduct(prod);
    setProductCode(prod.productCode);
    setProductName(prod.productName);
    setProductType(prod.productType);
    setCurrentPrice(prod.currentPrice);
    setProductMaterial(prod.material || '');
    setProductUnit(prod.unit || 'cái');
    setProductVatRate(Number(prod.vatRate ?? 8));
    setProductSupplierId(prod.supplierId || '');
    setProductPurchasePrice(Number(prod.purchasePrice || 0));
    setProductDiscountType(prod.discountType === 'amount' ? 'amount' : 'percent');
    setProductDiscountRate(Number(prod.discountRate || 0));
    setProductDiscountAmount(Number(prod.discountAmount || 0));
    setProductLeadTimeDays(Number(prod.leadTimeDays || 0));
    setSpecCustomRows(prod.specifications?.custom || []);
    setProductLayoutBase64(prod.layoutUrl || '');
    setWindDirectionFiles(prod.specifications?.windDirectionFiles || []);
    setSpecFields(loadSpecsToFields(prod.productType, prod.specifications));
    setShowEditProductModal(true);
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedProduct) return;

    const specs: any = { fields: specFields };
    // Flatten fields for backwards compatibility
    specFields.forEach(f => {
      let val = f.value;
      if (f.type === 'number') {
        val = Number(val);
      }
      specs[f.id] = val;
      
      // Keep support for both core/windingCore for color rolls
      if (f.id === 'core') {
        specs.windingCore = val;
      }
      if (f.id === 'windingCore') {
        specs.core = val;
      }
      
      // Map other special fields for legacy compatibility
      if (f.id === 'colors') {
        specs.colors = val;
      }
      if (f.id === 'processing') {
        specs.processing = val;
      }
      if (f.id === 'ribbonType') {
        specs.ribbonType = val;
      }
      if (f.id === 'direction') {
        specs.direction = val;
      }
      if (f.id === 'size') {
        specs.size = val;
      }
      if (f.id === 'color') {
        specs.color = val;
      }
      if (f.id === 'corner') {
        specs.corner = val;
      }
      if (f.id === 'lamination') {
        specs.lamination = val;
      }
      if (f.id === 'finished') {
        specs.finished = val;
      }
      if (f.id === 'sheetType') {
        specs.sheetType = val;
      }
      if (f.id === 'dieCut') {
        specs.dieCut = val;
      }
      if (f.id === 'perforated') {
        specs.perforated = val;
      }
      if (f.id === 'windDirection') {
        specs.windDirection = val;
      }
      if (f.id === 'windDirectionFiles') {
        specs.windDirectionFiles = val;
      }
    });

    specs.custom = specFields.filter(f => f.id.startsWith('custom_')).map(f => ({ key: f.label, value: f.value }));

    const priceChanged = Number(currentPrice) !== selectedProduct.currentPrice;
    const newPriceHistory = [...(selectedProduct.priceHistory || [])];
    if (priceChanged) {
      newPriceHistory.push({
        date: new Date().toISOString().split('T')[0],
        price: Number(currentPrice),
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
      });
    }

    const updatedProduct = {
      ...selectedProduct,
      productCode,
      productName,
      productType,
      currentPrice: Number(currentPrice),
      salePrice: Number(currentPrice),
      material: productMaterial,
      unit: productUnit,
      vatRate: Number(productVatRate),
      supplierId: productSupplierId,
      supplierName: suppliers.find(supplier => supplier.id === productSupplierId)?.supplierName || '',
      purchasePrice: Number(productPurchasePrice),
      discountType: productDiscountType,
      discountRate: Number(productDiscountRate),
      discountAmount: Number(productDiscountAmount),
      leadTimeDays: Number(productLeadTimeDays),
      layoutUrl: productLayoutBase64,
      specifications: specs,
      priceHistory: newPriceHistory,
      updatedAt: new Date().toISOString()
    };

    if (currentUser.role === 'admin') {
      const updatedProducts = (selectedCustomer.products || []).map((p: any) => 
        p.id === selectedProduct.id ? updatedProduct : p
      );

      await dbService.updateDocument('customers', selectedCustomer.id, {
        products: updatedProducts
      });

      setSelectedCustomer((prev: any) => ({
        ...prev,
        products: updatedProducts
      }));
      alert(t('Cập nhật sản phẩm thành công.'));
    } else {
      await dbService.addDocument('edit_requests', {
        type: 'product_details',
        targetId: selectedCustomer.id,
        productId: selectedProduct.id,
        fieldName: `${t('Sửa Sản phẩm')}: ${selectedProduct.productCode} - ${selectedProduct.productName}`,
        originalData: selectedProduct,
        updatedData: updatedProduct,
        requestedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      });
      alert(t('Yêu cầu chỉnh sửa sản phẩm đã được gửi tới Admin duyệt.'));
    }

    setShowEditProductModal(false);
    setSelectedProduct(null);
    onRefresh();
  };

  const triggerAddClassification = async () => {
    const name = prompt(t('Nhập tên phân loại sản phẩm mới:'));
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const id = `class-${Math.random().toString(36).substr(2, 9)}`;
    const newClass = { id, name: cleanName };
    await dbService.addDocument('product_classifications', newClass);
    alert(t('Đã thêm phân loại sản phẩm mới.'));
  };

  const triggerAddWindDirection = async () => {
    const name = prompt(t('Nhập tên hướng tem ra mới:'));
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const id = `wind-${Math.random().toString(36).substr(2, 9)}`;
    const newWind = { id, name: cleanName };
    await dbService.addDocument('wind_directions', newWind);
    alert(t('Đã thêm hướng tem ra mới.'));
  };

  const handleEditClassification = async (id: string, newName: string) => {
    const origClass = productClassifications.find(c => c.id === id);
    if (!origClass) return;
    if (currentUser.role === 'admin') {
      await dbService.updateDocument('product_classifications', id, { name: newName });
      alert(t('Đã cập nhật phân loại sản phẩm.'));
    } else {
      await dbService.addDocument('edit_requests', {
        type: 'product_classification',
        targetId: id,
        fieldName: `${t('Sửa Phân loại sản phẩm')}: ${origClass.name}`,
        originalData: { name: origClass.name },
        updatedData: { name: newName },
        requestedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      });
      alert(t('Yêu cầu sửa phân loại sản phẩm đã gửi tới Admin duyệt.'));
    }
    onRefresh();
  };

  const handleEditWindDirection = async (id: string, newName: string) => {
    const origWind = windDirections.find(w => w.id === id);
    if (!origWind) return;
    if (currentUser.role === 'admin') {
      await dbService.updateDocument('wind_directions', id, { name: newName });
      alert(t('Đã cập nhật hướng tem ra.'));
    } else {
      await dbService.addDocument('edit_requests', {
        type: 'wind_direction',
        targetId: id,
        fieldName: `${t('Sửa Hướng tem ra')}: ${origWind.name}`,
        originalData: { name: origWind.name },
        updatedData: { name: newName },
        requestedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      });
      alert(t('Yêu cầu sửa hướng tem ra đã gửi tới Admin duyệt.'));
    }
    onRefresh();
  };

  const triggerEditClassification = async (id: string) => {
    const origClass = productClassifications.find(c => c.id === id);
    if (!origClass) return;
    const name = prompt(t('Sửa tên phân loại sản phẩm:'), origClass.name);
    if (!name || !name.trim()) return;
    await handleEditClassification(id, name.trim());
  };

  const triggerEditWindDirection = async (id: string) => {
    const origWind = windDirections.find(w => w.id === id);
    if (!origWind) return;
    const name = prompt(t('Sửa tên hướng tem ra:'), origWind.name);
    if (!name || !name.trim()) return;
    await handleEditWindDirection(id, name.trim());
  };

  const handleApproveRequest = async (req: any) => {
    try {
      if (req.type === 'customer_profile') {
        await dbService.updateDocument('customers', req.targetId, {
          ...req.updatedData,
          updatedBy: req.requestedBy,
          updatedAt: new Date().toISOString()
        });
        alert(t('Đã duyệt chỉnh sửa hồ sơ khách hàng.'));
      } else if (req.type === 'product_details') {
        const cust = customers.find(c => c.id === req.targetId);
        if (cust) {
          const updatedProducts = (cust.products || []).map((p: any) => 
            p.id === req.productId ? req.updatedData : p
          );
          await dbService.updateDocument('customers', req.targetId, {
            products: updatedProducts
          });
          alert(t('Đã duyệt chỉnh sửa thông tin sản phẩm.'));
        } else {
          alert(t('Không tìm thấy thông tin khách hàng tương ứng.'));
        }
      } else if (req.type === 'product_classification') {
        await dbService.updateDocument('product_classifications', req.targetId, {
          name: req.updatedData.name
        });
        alert(t('Đã duyệt chỉnh sửa phân loại sản phẩm.'));
      } else if (req.type === 'wind_direction') {
        await dbService.updateDocument('wind_directions', req.targetId, {
          name: req.updatedData.name
        });
        alert(t('Đã duyệt chỉnh sửa hướng tem ra.'));
      }
      
      await dbService.deleteDocument('edit_requests', req.id);
      setShowCompareModal(false);
      setSelectedEditRequest(null);
      onRefresh();
    } catch (error) {
      console.error(error);
      alert(t('Có lỗi xảy ra khi phê duyệt.'));
    }
  };

  const handleRejectRequest = async (req: any) => {
    if (window.confirm(t('Bạn có chắc chắn muốn từ chối yêu cầu này?'))) {
      await dbService.deleteDocument('edit_requests', req.id);
      setShowCompareModal(false);
      setSelectedEditRequest(null);
      alert(t('Đã từ chối và xóa yêu cầu.'));
      onRefresh();
    }
  };

  const handleApproveDeleteCustomer = async (cust: any) => {
    if (window.confirm(t('Bạn có chắc muốn phê duyệt xóa khách hàng này?'))) {
      await dbService.updateDocument('customers', cust.id, {
        deleted: true,
        deleteRequested: false,
        deleteRequestedAt: ''
      });
      alert(t('Đã xóa khách hàng.'));
      onRefresh();
    }
  };

  const handleRejectDeleteCustomer = async (cust: any) => {
    if (window.confirm(t('Từ chối yêu cầu xóa khách hàng này?'))) {
      await dbService.updateDocument('customers', cust.id, {
        deleteRequested: false,
        deleteRequestedBy: '',
        deleteRequestedAt: ''
      });
      alert(t('Đã từ chối yêu cầu xóa.'));
      onRefresh();
    }
  };

  const handleRepoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRepoUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setRepoUploadFile(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Add folder
  const handleAddFolder = async () => {
    if (!selectedCustomer) return;
    const folderNameTrim = newFolderName.trim();
    if (!folderNameTrim) return;
    
    const updatedFiles = selectedCustomer.files || [];
    const folderExists = updatedFiles.some((f: any) => f.folder === folderNameTrim);
    if (folderExists) {
      alert(t('Thư mục này đã tồn tại.'));
      return;
    }
    
    const newPlaceholder = {
      folder: folderNameTrim,
      name: '.placeholder',
      base64: '',
      createdAt: new Date().toISOString()
    };
    
    const newFiles = [...updatedFiles, newPlaceholder];
    await dbService.updateDocument('customers', selectedCustomer.id, {
      files: newFiles
    });
    
    setNewFolderName('');
    setSelectedCustomer((prev: any) => ({ ...prev, files: newFiles }));
    onRefresh();
    alert(t('Đã tạo thư mục thành công.'));
  };

  // Upload file to customer repo
  const handleUploadRepoFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!selectedFolderForUpload || !repoUploadFile || !repoUploadFileName) {
      alert(t('Vui lòng chọn thư mục và chọn file để tải lên!'));
      return;
    }
    
    const updatedFiles = selectedCustomer.files || [];
    const filteredFiles = updatedFiles.filter((f: any) => !(f.folder === selectedFolderForUpload && f.name === '.placeholder'));
    
    const newFileObj = {
      folder: selectedFolderForUpload,
      name: repoUploadFileName,
      base64: repoUploadFile,
      createdAt: new Date().toISOString()
    };
    
    const newFiles = [...filteredFiles, newFileObj];
    await dbService.updateDocument('customers', selectedCustomer.id, {
      files: newFiles
    });
    
    setRepoUploadFile('');
    setRepoUploadFileName('');
    setSelectedCustomer((prev: any) => ({ ...prev, files: newFiles }));
    onRefresh();
    alert(t('Đã tải tệp lên kho lưu trữ thành công.'));
  };

  // Delete file/folder from customer repo
  const handleDeleteRepoFile = async (folder: string, name: string) => {
    if (!selectedCustomer) return;
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa tệp này khỏi kho lưu trữ?'))) {
      return;
    }
    const updatedFiles = selectedCustomer.files || [];
    const newFiles = updatedFiles.filter((f: any) => !(f.folder === folder && f.name === name));
    
    const folderFiles = newFiles.filter((f: any) => f.folder === folder);
    if (folderFiles.length === 0) {
      newFiles.push({
        folder,
        name: '.placeholder',
        base64: '',
        createdAt: new Date().toISOString()
      });
    }

    await dbService.updateDocument('customers', selectedCustomer.id, {
      files: newFiles
    });
    
    setSelectedCustomer((prev: any) => ({ ...prev, files: newFiles }));
    onRefresh();
    alert(t('Đã xóa tệp thành công.'));
  };

  const handleDeleteRepoFolder = async (folder: string) => {
    if (!selectedCustomer) return;
    if (!window.confirm(t('CẢNH BÁO: Xóa thư mục sẽ xóa toàn bộ các tệp tin bên trong thư mục này. Bạn có chắc chắn muốn tiếp tục?'))) {
      return;
    }
    const updatedFiles = selectedCustomer.files || [];
    const newFiles = updatedFiles.filter((f: any) => f.folder !== folder);
    
    await dbService.updateDocument('customers', selectedCustomer.id, {
      files: newFiles
    });
    
    setSelectedCustomer((prev: any) => ({ ...prev, files: newFiles }));
    onRefresh();
    alert(t('Đã xóa thư mục thành công.'));
  };

  // Product Helpers
  const handleOpenAddProduct = () => {
    setProductCode('');
    setProductName('');
    setProductType('tem_trang_cuon');
    setCurrentPrice(0);
    setProductMaterial('');
    setProductUnit('cái');
    setProductVatRate(8);
    setProductSupplierId('');
    setProductPurchasePrice(0);
    setProductDiscountType('percent');
    setProductDiscountRate(0);
    setProductDiscountAmount(0);
    setProductLeadTimeDays(0);
    setSpecCustomRows([]);
    setProductLayoutBase64('');
    setSpecFields(loadSpecsToFields('tem_trang_cuon'));
    setShowAddProductModal(true);
  };

  const handleAddProductTypeChange = (type: any) => {
    setProductType(type);
    setSpecFields(loadSpecsToFields(type));
  };

  const handleEditProductTypeChange = (type: any) => {
    if (window.confirm(t('Thay đổi loại sản phẩm sẽ reset các thông số kỹ thuật về mặc định. Bạn có muốn tiếp tục?'))) {
      setProductType(type);
      setSpecFields(loadSpecsToFields(type));
    }
  };

  const handleProductLayoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setProductLayoutBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !productCode || !productName || !currentPrice) return;

    const specs: any = { fields: specFields };
    // Flatten fields for backwards compatibility
    specFields.forEach(f => {
      let val = f.value;
      if (f.type === 'number') {
        val = Number(val);
      }
      specs[f.id] = val;
      
      // Keep support for both core/windingCore for color rolls
      if (f.id === 'core') {
        specs.windingCore = val;
      }
      if (f.id === 'windingCore') {
        specs.core = val;
      }
      
      // Map other special fields for legacy compatibility
      if (f.id === 'colors') {
        specs.colors = val;
      }
      if (f.id === 'processing') {
        specs.processing = val;
      }
      if (f.id === 'ribbonType') {
        specs.ribbonType = val;
      }
      if (f.id === 'direction') {
        specs.direction = val;
      }
      if (f.id === 'size') {
        specs.size = val;
      }
      if (f.id === 'color') {
        specs.color = val;
      }
      if (f.id === 'corner') {
        specs.corner = val;
      }
      if (f.id === 'lamination') {
        specs.lamination = val;
      }
      if (f.id === 'finished') {
        specs.finished = val;
      }
      if (f.id === 'sheetType') {
        specs.sheetType = val;
      }
      if (f.id === 'dieCut') {
        specs.dieCut = val;
      }
      if (f.id === 'perforated') {
        specs.perforated = val;
      }
      if (f.id === 'windDirection') {
        specs.windDirection = val;
      }
      if (f.id === 'windDirectionFiles') {
        specs.windDirectionFiles = val;
      }
    });

    specs.custom = specFields.filter(f => f.id.startsWith('custom_')).map(f => ({ key: f.label, value: f.value }));

    const newProduct = {
      id: `prod-${Math.random().toString(36).substr(2, 9)}`,
      productCode,
      productName,
      productType,
      currentPrice: Number(currentPrice),
      salePrice: Number(currentPrice),
      material: productMaterial,
      unit: productUnit,
      vatRate: Number(productVatRate),
      supplierId: productSupplierId,
      supplierName: suppliers.find(supplier => supplier.id === productSupplierId)?.supplierName || '',
      purchasePrice: Number(productPurchasePrice),
      discountType: productDiscountType,
      discountRate: Number(productDiscountRate),
      discountAmount: Number(productDiscountAmount),
      leadTimeDays: Number(productLeadTimeDays),
      layoutUrl: productLayoutBase64,
      specifications: specs,
      priceHistory: [
        { date: new Date().toISOString().split('T')[0], price: Number(currentPrice) }
      ],
      createdAt: new Date().toISOString()
    };

    const updatedProducts = [...(selectedCustomer.products || []), newProduct];

    await dbService.updateDocument('customers', selectedCustomer.id, {
      products: updatedProducts
    });

    setSelectedCustomer((prev: any) => ({
      ...prev,
      products: updatedProducts
    }));

    setShowAddProductModal(false);
    onRefresh();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!selectedCustomer) return;
    if (window.confirm(t('Bạn có chắc chắn muốn xóa mã sản phẩm này?'))) {
      const updatedProducts = (selectedCustomer.products || []).map((p: any) => {
        if (p.id === productId) {
          return { ...p, deleted: true, deletedAt: new Date().toISOString() };
        }
        return p;
      });
      
      await dbService.updateDocument('customers', selectedCustomer.id, {
        products: updatedProducts
      });

      setSelectedCustomer((prev: any) => ({
        ...prev,
        products: updatedProducts
      }));

      onRefresh();
    }
  };

  const handleOpenRequote = (prod: any) => {
    setSelectedProduct(prod);
    setRequotePrice(prod.currentPrice);
    setRequoteNote('');
    setShowRequoteModal(true);
  };

  const handleRequoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedProduct) return;

    const updatedProducts = (selectedCustomer.products || []).map((p: any) => {
      if (p.id === selectedProduct.id) {
        return {
          ...p,
          currentPrice: Number(requotePrice),
          priceHistory: [
            ...(p.priceHistory || []),
            { 
              date: new Date().toISOString().split('T')[0], 
              price: Number(requotePrice), 
              note: requoteNote,
              updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`
            }
          ]
        };
      }
      return p;
    });

    await dbService.updateDocument('customers', selectedCustomer.id, {
      products: updatedProducts
    });

    setSelectedCustomer((prev: any) => ({
      ...prev,
      products: updatedProducts
    }));

    setShowRequoteModal(false);
    setSelectedProduct(null);
    onRefresh();
  };

  // Contract Helpers
  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setContractFile(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !contractNo) return;

    const newContract = {
      id: `contr-${Math.random().toString(36).substr(2, 9)}`,
      contractNo,
      signDate: contractSignDate,
      expiryDate: contractExpiryDate,
      value: Number(contractValue),
      fileUrl: contractFile,
      status: new Date(contractExpiryDate).getTime() > Date.now() ? 'active' : 'expired',
      createdAt: new Date().toISOString()
    };

    const updatedContracts = [...(selectedCustomer.contracts || []), newContract];

    await dbService.updateDocument('customers', selectedCustomer.id, {
      contracts: updatedContracts
    });

    setSelectedCustomer((prev: any) => ({
      ...prev,
      contracts: updatedContracts
    }));

    setShowAddContractModal(false);
    setContractNo('');
    setContractFile('');
    onRefresh();
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!selectedCustomer) return;
    if (window.confirm(t('Bạn có chắc chắn muốn xóa hợp đồng này?'))) {
      const updatedContracts = (selectedCustomer.contracts || []).filter((c: any) => c.id !== contractId);

      await dbService.updateDocument('customers', selectedCustomer.id, {
        contracts: updatedContracts
      });

      setSelectedCustomer((prev: any) => ({
        ...prev,
        contracts: updatedContracts
      }));

      onRefresh();
    }
  };

  // Order history helper for selected customer
  const getCustomerOrders = (custId: string) => {
    return pos
      .filter(po => po.customerId === custId && !po.deleted)
      .sort((a, b) => (
        (parseValidDate(b.orderDate || b.createdAt)?.getTime() || 0)
        - (parseValidDate(a.orderDate || a.createdAt)?.getTime() || 0)
      ));
  };

  // Order frequency (orders per month)
  const calculateFrequency = (custId: string) => {
    const orders = getCustomerOrders(custId);
    if (orders.length === 0) return `0 ${t('đơn/tháng')}`;
    
    // Calculate months between first order and now
    const dates = orders
      .map(order => parseValidDate(order.orderDate || order.createdAt)?.getTime())
      .filter((timestamp): timestamp is number => typeof timestamp === 'number');
    if (dates.length === 0) return `0 ${t('đơn/tháng')}`;
    const minDate = new Date(Math.min(...dates));
    const now = new Date();
    const diffMonths = Math.max(1, (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth()));
    
    return `${(orders.length / diffMonths).toFixed(1)} ${t('đơn/tháng')}`;
  };

  // Filter and search
  const today = new Date();
  const filteredCustomers = sortNewestFirst(customers.filter(c => {
    if (c.deleted === true) return false;
    // Filter by sales rep role: only see assigned customers
    if (currentUser.role === 'sale' && c.assignedSaleId && c.assignedSaleId !== currentUser.uid) {
      return false;
    }
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.phone.includes(searchTerm);
    
    if (filterType === 'needs_care') {
      if (!c.lastOrderAt) return matchesSearch;
      const lastOrderDate = parseValidDate(c.lastOrderAt);
      if (!lastOrderDate) return matchesSearch;
      const diffTime = Math.abs(today.getTime() - lastOrderDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return matchesSearch && diffDays > 30; // 30+ days inactive
    }
    return matchesSearch;
  }), customer => [customer.createdAt, customer.updatedAt, customer.customerCode]);

  // Top 5/15 customers by sales volume with time filters
  const topCustomerSales = customers
    .filter(c => !c.deleted)
    .map(c => {
      const customerPOs = pos.filter(po => {
        if (po.deleted === true) return false;
        if (po.customerId !== c.id) return false;
        
        // Month and Year filter
        if (po.orderDate) {
          const poDate = parseValidDate(po.orderDate);
          if (!poDate) return false;
          const y = String(poDate.getFullYear());
          const m = String(poDate.getMonth() + 1);
          
          if (chartYear !== 'all' && y !== chartYear) return false;
          if (chartMonth !== 'all' && m !== chartMonth) return false;
        } else {
          if (chartYear !== 'all' || chartMonth !== 'all') return false;
        }
        return true;
      });

      return {
        label: c.companyName,
        value: customerPOs.length
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const chartData = topCustomerSales.slice(0, showTop15 ? 15 : 5);

  const renderProductCommercialFields = () => (
    <div className="product-commercial-fields">
      <div className="form-group">
        <label>{t('Đơn Vị Tính')}</label>
        <input value={productUnit} onChange={event => setProductUnit(event.target.value)} placeholder={t('cái, cuộn, tờ...')} />
      </div>
      <div className="form-group">
        <label>{t('Thuế VAT (%)')}</label>
        <input type="number" min="0" max="100" value={productVatRate} onChange={event => setProductVatRate(Number(event.target.value))} />
      </div>
      <div className="form-group">
        <label>{t('Nhà Cung Cấp Thường Dùng')}</label>
        <select value={productSupplierId} onChange={event => setProductSupplierId(event.target.value)}>
          <option value="">{t('-- Chọn nhà cung cấp --')}</option>
          {suppliers.filter(supplier => !supplier.deleted).map(supplier => (
            <option key={supplier.id} value={supplier.id}>{supplier.supplierName}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>{t('Giá Mua Tham Khảo (đ)')}</label>
        <input type="number" min="0" value={productPurchasePrice} onChange={event => setProductPurchasePrice(Number(event.target.value))} />
      </div>
      <div className="form-group">
        <label>{t('Chiết Khấu Sản Phẩm')}</label>
        <select value={productDiscountType} onChange={event => setProductDiscountType(event.target.value as PODiscountType)}>
          <option value="percent">{t('Theo phần trăm (%)')}</option>
          <option value="amount">{t('Theo tiền chênh (đ)')}</option>
        </select>
      </div>
      <div className="form-group">
        <label>{productDiscountType === 'amount' ? t('Tiền Chênh (đ)') : t('Tỷ Lệ Chiết Khấu (%)')}</label>
        {productDiscountType === 'amount' ? (
          <input type="number" min="0" value={productDiscountAmount} onChange={event => setProductDiscountAmount(Number(event.target.value))} />
        ) : (
          <input type="number" min="0" max="100" value={productDiscountRate} onChange={event => setProductDiscountRate(Number(event.target.value))} />
        )}
      </div>
      <div className="form-group">
        <label>{t('Thời Gian Chuẩn Bị (ngày)')}</label>
        <input type="number" min="0" value={productLeadTimeDays} onChange={event => setProductLeadTimeDays(Number(event.target.value))} />
      </div>
    </div>
  );

  const renderAdditionalContactsEditor = () => (
    <div className="customer-contact-editor">
      <div className="customer-contact-editor__header">
        <div>
          <strong>{t('Đầu mối liên hệ bổ sung')}</strong>
          <span>{t('Lưu riêng người phụ trách mua hàng, kho, kế toán hoặc đầu mối khác.')}</span>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={addContactRow}>
          <Plus size={14} /> {t('Thêm liên hệ')}
        </button>
      </div>
      {additionalContacts.map(contact => (
        <div key={contact.id} className="customer-contact-editor__row">
          <select value={contact.role} onChange={event => updateContactRow(contact.id, 'role', event.target.value)}>
            {Object.entries(CONTACT_ROLE_LABELS).filter(([role]) => role !== 'primary').map(([role, label]) => (
              <option key={role} value={role}>{t(label)}</option>
            ))}
          </select>
          <input value={contact.name} onChange={event => updateContactRow(contact.id, 'name', event.target.value)} placeholder={t('Họ tên')} />
          <input value={contact.phone} onChange={event => updateContactRow(contact.id, 'phone', event.target.value)} placeholder={t('Số điện thoại')} />
          <input value={contact.email} onChange={event => updateContactRow(contact.id, 'email', event.target.value)} placeholder="Email" />
          <button
            type="button"
            className="btn btn-sm btn-danger btn-symbol-sm"
            onClick={() => setAdditionalContacts(previous => previous.filter(item => item.id !== contact.id))}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`crm-view ${selectedCustomer ? 'crm-view--detail' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('QUẢN LÝ KHÁCH HÀNG (CRM)')}</h1>
          <p className="page-subtitle">{t('Quản lý danh sách, hồ sơ liên hệ, hạn mức công nợ và cảnh báo chăm sóc khách hàng.')}</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary btn-symbol" onClick={openAddModal} title={t('Thêm Khách Hàng Mới')}>
            <Plus size={18} />
          </button>
        )}
      </div>

      {currentUser.role === 'admin' && (editRequests.some(r => r.status === 'pending') || customers.some(c => c.deleteRequested && !c.deleted)) && (
        <div className="card" style={{ border: '2px solid var(--color-primary-light)', backgroundColor: '#f0fdf4', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div className="card-header" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--color-border-light)' }}>
            <span className="card-title" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <AlertCircle size={20} />
              {t('BẢNG ĐIỀU HÀNH PHÊ DUYỆT (ADMIN APPROVALS)')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortNewestFirst(
              customers.filter(c => c.deleteRequested && !c.deleted),
              customer => [customer.deleteRequestedAt, customer.updatedAt, customer.createdAt]
            ).map(cust => (
              <div key={cust.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #fed7d7', borderRadius: '4px', backgroundColor: '#fff5f5' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>[${t('YÊU CẦU XÓA KHÁCH HÀNG')}] </span>
                  <strong>{cust.companyName}</strong> - {t('Yêu cầu bởi:')} {cust.deleteRequestedBy || 'Sale'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => handleApproveDeleteCustomer(cust)}>{t('Duyệt Xóa')}</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => handleRejectDeleteCustomer(cust)}>{t('Hủy Yêu Cầu')}</button>
                </div>
              </div>
            ))}
            
            {sortNewestFirst(
              editRequests.filter(r => r.status === 'pending'),
              request => [request.requestedAt, request.createdAt]
            ).map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: '#ffffff' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>[${t('YÊU CẦU CHỈNH SỬA')}] </span>
                  <strong>{req.fieldName}</strong> - {t('Yêu cầu bởi:')} {req.requestedBy} ({formatDateTime(req.requestedAt, 'vi-VN', '')})
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => {
                    setSelectedEditRequest(req);
                    setShowCompareModal(true);
                  }}>{t('Xem So Sánh (Diff)')}</button>
                  <button type="button" className="btn btn-sm btn-success" onClick={() => handleApproveRequest(req)}>{t('Duyệt')}</button>
                  <button type="button" className="btn btn-sm btn-outline" style={{ color: 'red', borderColor: 'red' }} onClick={() => handleRejectRequest(req)}>{t('Từ Chối')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        <>
          <div className="crm-summary-grid">
            <div className="crm-summary-card">
              <Building2 size={19} />
              <div><strong>{customers.filter(customer => !customer.deleted).length}</strong><span>Khách hàng đang hợp tác</span></div>
            </div>
            <div className="crm-summary-card">
              <Tag size={19} />
              <div><strong>{customers.filter(customer => !customer.deleted && customer.customerRank).length}</strong><span>Hồ sơ đã xếp hạng</span></div>
            </div>
            <div className="crm-summary-card">
              <ShoppingBag size={19} />
              <div><strong>{customers.reduce((total, customer) => total + (customer.products || []).filter(product => !product.deleted).length, 0)}</strong><span>Mã hàng tiêu chuẩn</span></div>
            </div>
            <div className="crm-summary-card">
              <Users size={19} />
              <div><strong>{customers.reduce((total, customer) => total + (customer.contacts || []).length, 0)}</strong><span>Đầu mối liên hệ</span></div>
            </div>
          </div>

          {/* Top customer chart */}
          {topCustomerSales.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <span className="card-title">
                  {t('Sản Lượng Đơn Hàng Theo Khách Hàng')} ({showTop15 ? t('Top 15') : t('Top 5')})
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    value={chartYear} 
                    onChange={(e) => setChartYear(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', width: '90px' }}
                  >
                    <option value="all">{t('Tất cả năm')}</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                  <select 
                    value={chartMonth} 
                    onChange={(e) => setChartMonth(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', width: '110px' }}
                  >
                    <option value="all">{t('Tất cả tháng')}</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
                      <option key={m} value={m}>{t('Tháng')} {m}</option>
                    ))}
                  </select>
                  <button 
                    type="button"
                    className="btn btn-sm btn-outline" 
                    onClick={() => setShowTop15(!showTop15)}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    {showTop15 ? t('Thu gọn (Top 5)') : t('Xem thêm (Top 15)')}
                  </button>
                </div>
              </div>
              <div style={{ width: '100%', padding: '10px 0' }}>
                <div style={{ maxWidth: '700px', width: '100%' }}>
                  <HorizontalBarChart data={chartData} valueSuffix={` ${t('đơn')}`} />
                </div>
              </div>
            </div>
          )}

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder={t('Tìm tên công ty, liên hệ, SĐT...')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
             <button className="btn btn-outline btn-symbol" onClick={() => setSearchTerm('')} title={t('Xóa Tìm Kiếm')}>
                <X size={16} />
             </button>
          </div>
          <div className="tab-container" style={{ borderBottom: 'none' }}>
            <button 
              className={`tab-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              {t('Tất Cả Khách Hàng')} ({customers.length})
            </button>
            <button 
              className={`tab-btn ${filterType === 'needs_care' ? 'active' : ''}`}
              onClick={() => setFilterType('needs_care')}
              style={{ color: 'var(--color-danger)' }}
            >
              {t('Cần Chăm Sóc (>30 ngày chưa đặt)')}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã KH')}</th>
                <th>{t('Tên Công Ty')}</th>
                <th>{t('Hạng')}</th>
                <th>{t('Sale Phụ Trách')}</th>
                <th>{t('Chiết Khấu')}</th>
                <th>{t('Hạn Mức Nợ')}</th>
                <th>{t('Đơn Cuối Cùng')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(cust => {
                const customerOrders = getCustomerOrders(cust.id);
                // Check if inactive
                let isInactive = false;
                if (cust.lastOrderAt) {
                  const lastOrderDate = parseValidDate(cust.lastOrderAt);
                  const diffTime = lastOrderDate ? Math.abs(today.getTime() - lastOrderDate.getTime()) : 0;
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  isInactive = diffDays > 30;
                } else {
                  isInactive = true;
                }

                return (
                  <tr key={cust.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomer(cust)}>
                    <td><span className="customer-code-badge">{cust.customerCode || cust.id}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{cust.companyName}</span>
                        <span className="crm-customer-contact-line">
                          {cust.contactPerson || t('Chưa có người liên hệ')}
                          {cust.phone ? ` · ${cust.phone}` : ''}
                        </span>
                        {isInactive && (
                          <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                            [{t('CẢNH BÁO: CHƯA PHÁT SINH ĐƠN MỚI > 30 NGÀY')}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`customer-rank-badge ${cust.customerRank ? 'has-rank' : ''}`}>
                        {cust.customerRank || '—'}
                      </span>
                    </td>
                    <td>{users.find(user => user.uid === cust.assignedSaleId)?.displayName || t('Chưa phân công')}</td>
                    <td>
                      {cust.discountType === 'amount'
                        ? `${Number(cust.discountAmount || 0).toLocaleString('vi-VN')} đ`
                        : `${Number(cust.discountRate || 0)}%`}
                    </td>
                    <td>{cust.debtLimit.toLocaleString()} đ</td>
                    <td>{formatDate(cust.lastOrderAt, 'vi-VN', t('Chưa có'))}</td>
                    <td>
                      <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(cust)}>{t('Chi Tiết')}</button>
                        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                          <>
                             <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditModal(cust)} title={t('Sửa')}>
                               <Pencil size={14} />
                             </button>
                             <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteCustomer(cust.id)} title={t('Xóa')}>
                               <Trash2 size={14} />
                             </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>{t('Không tìm thấy khách hàng nào.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED CUSTOMER DETAIL */}
       {selectedCustomer && (
        <div className="customer-details-grid">
          <div className="customer-detail-header">
            <button type="button" className="btn btn-outline customer-detail-back" onClick={() => setSelectedCustomer(null)}>
              <ArrowLeft size={16} />
              <span>{t('Quay lại danh sách')}</span>
            </button>
            <div className="customer-detail-heading">
              <div className="customer-detail-heading__title">
                <span className="customer-code-badge">{selectedCustomer.customerCode || selectedCustomer.id}</span>
                <h1>{selectedCustomer.companyName}</h1>
                <span className={`customer-rank-badge ${selectedCustomer.customerRank ? 'has-rank' : ''}`}>
                  {selectedCustomer.customerRank ? `Hạng ${selectedCustomer.customerRank}` : t('Chưa xếp hạng')}
                </span>
              </div>
              <p>{t('Hồ sơ khách hàng, mã hàng tiêu chuẩn, lịch sử giao dịch và tài liệu liên quan.')}</p>
            </div>
            {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
              <button type="button" className="btn btn-primary" onClick={() => openEditModal(selectedCustomer)}>
                <Pencil size={15} />
                <span>{t('Chỉnh sửa hồ sơ')}</span>
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('THÔNG TIN DOANH NGHIỆP')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Mã số thuế:')}</span>
                <span>{selectedCustomer.taxCode || t('Chưa cung cấp')}</span>
                
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Địa chỉ giao hàng:')}</span>
                <span>{selectedCustomer.address}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Email:')}</span>
                <span>{selectedCustomer.email || t('Chưa cung cấp')}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Sale phụ trách:')}</span>
                <span>{users.find(u => u.uid === selectedCustomer.assignedSaleId)?.displayName || t('Chưa phân công')}</span>

                {(selectedCustomer.customFields || [
                  {
                    id: 'discount',
                    name: t('Chiết khấu mặc định'),
                    value: selectedCustomer.discountType === 'amount'
                      ? `${Number(selectedCustomer.discountAmount || 0).toLocaleString('vi-VN')} đ`
                      : `${Number(selectedCustomer.discountRate || 0)}%`
                  },
                  { id: 'debtLimit', name: t('Hạn mức công nợ (đ)'), value: selectedCustomer.debtLimit },
                  { id: 'paymentTerms', name: t('Điều khoản thanh toán'), value: selectedCustomer.paymentTerms },
                  { id: 'note', name: t('Ghi chú yêu cầu riêng'), value: selectedCustomer.note }
                ]).map((field: any) => (
                  <React.Fragment key={field.id}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{field.name}:</span>
                    <span>{field.id === 'debtLimit' ? `${field.value?.toLocaleString()} đ` : (field.value || t('Không có'))}</span>
                  </React.Fragment>
                ))}

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tần suất đặt hàng:')}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{calculateFrequency(selectedCustomer.id)}</span>

                <span style={{ gridColumn: '1 / -1', borderBottom: '1px dashed var(--color-border-light)', margin: '8px 0' }}></span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Tạo bởi:')}</span>
                <span style={{ fontSize: '12px' }}>{selectedCustomer.createdBy || t('Không xác định')} {selectedCustomer.createdAt && `(${formatDateTime(selectedCustomer.createdAt, t('vi-VN'))})`}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Cập nhật bởi:')}</span>
                <span style={{ fontSize: '12px' }}>{selectedCustomer.updatedBy || t('Chưa cập nhật')} {selectedCustomer.updatedAt && `(${formatDateTime(selectedCustomer.updatedAt, t('vi-VN'))})`}</span>
              </div>

              <div className="customer-contact-panel">
                <div className="customer-contact-panel__heading">
                  <Users size={16} />
                  <strong>{t('Đầu mối liên hệ')}</strong>
                </div>
                <div className="customer-contact-list">
                  {(selectedCustomer.contacts || []).map((contact: CustomerContactRecord) => (
                    <div key={contact.id} className="customer-contact-item">
                      <span className="customer-contact-item__role">{CONTACT_ROLE_LABELS[contact.role]}</span>
                      <strong>{contact.name || t('Chưa cập nhật tên')}</strong>
                      <span>{[contact.phone, contact.email].filter(Boolean).join(' · ') || t('Chưa có thông tin liên hệ')}</span>
                    </div>
                  ))}
                  {(selectedCustomer.contacts || []).length === 0 && (
                    <span className="text-muted">{t('Chưa có đầu mối liên hệ.')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('LỊCH SỬ ĐƠN HÀNG (PO)')}</span>
            </div>
            <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã PO')}</th>
                    <th>{t('Ngày Đặt')}</th>
                    <th>{t('Trị Giá (Net)')}</th>
                    <th>{t('Tiến Độ')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getCustomerOrders(selectedCustomer.id).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{formatDate(po.orderDate)}</td>
                      <td>{po.netAmount.toLocaleString()} đ</td>
                      <td>
                        <span className={`badge ${getPOBadgeClass(po)}`}>{t(getPOQueueLabel(po))}</span>
                      </td>
                      <td>
                        {(currentUser.role === 'admin' || currentUser.role === 'sale') && onRepeatOrder ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline repeat-order-button"
                            onClick={() => onRepeatOrder(po.id)}
                            title="Tạo PO mới từ đơn cũ"
                          >
                            <Copy size={13} /> Đặt lại
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {getCustomerOrders(selectedCustomer.id).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>{t('Chưa phát sinh đơn hàng nào.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CUSTOMER PREDEFINED PRODUCTS & CONTRACTS */}
          <div className="card" style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">{t('DANH MỤC MÃ SẢN PHẨM KHÁCH HÀNG')}</span>
               {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                 <button className="btn btn-primary btn-symbol" onClick={handleOpenAddProduct} title={t('Thêm Mã Sản Phẩm Mới')}>
                   <Plus size={18} />
                 </button>
               )}
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã Sản Phẩm')}</th>
                    <th>{t('Tên Sản Phẩm')}</th>
                    <th>{t('Loại')}</th>
                    <th>{t('ĐVT / VAT')}</th>
                    <th>{t('Đơn Giá')}</th>
                    <th>{t('Nhà Cung Cấp')}</th>
                    <th>{t('Mô Tả Kỹ Thuật')}</th>
                    <th>{t('Ảnh Layout')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCustomer.products || []).filter((p: any) => !p.deleted).map((prod: any) => (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: 600 }}>{prod.productCode}</td>
                      <td>{prod.productName}</td>
                      <td>{t(prod.productType)}</td>
                      <td>
                        <strong>{prod.unit || 'cái'}</strong>
                        <div className="crm-table-secondary">VAT {Number(prod.vatRate ?? 8)}%</div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{prod.currentPrice.toLocaleString()} đ</span>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline" 
                            style={{ padding: '2px 4px', fontSize: '10px', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => setPriceHistoryProduct(prod)}
                          >
                            {t('Lịch sử')}
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>{prod.supplierName || t('Chưa chọn')}</strong>
                        <div className="crm-table-secondary">
                          {prod.purchasePrice ? `${Number(prod.purchasePrice).toLocaleString('vi-VN')} đ mua` : t('Chưa có giá mua')}
                        </div>
                        {prod.leadTimeDays > 0 && <div className="crm-table-secondary">{prod.leadTimeDays} ngày chuẩn bị</div>}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {prod.specifications?.fields && Array.isArray(prod.specifications.fields) ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                            {prod.specifications.fields.map((f: any) => {
                              if (f.id === 'windDirectionFiles') return null;
                              let valStr = '';
                              if (f.type === 'checkboxes' && Array.isArray(f.value)) {
                                valStr = f.value.join(', ');
                              } else {
                                valStr = String(f.value !== undefined && f.value !== null ? f.value : '');
                              }
                              if (!valStr) return null;
                              return (
                                <span key={f.id} style={{ display: 'inline-block' }}>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>{f.label}:</span> {valStr}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {prod.productType === 'muc_in' && (
                              <span>{prod.specifications.ribbonType} - {prod.specifications.size} - {prod.specifications.color}</span>
                            )}
                            {prod.productType === 'tem_trang_cuon' && (
                              <span>R{prod.specifications.width} X D{prod.specifications.height} MM - Cuộn {prod.specifications.qtyPerRoll} tem - Lõi {prod.specifications.core} - bế {prod.specifications.dieCut}</span>
                            )}
                            {prod.productType === 'tem_mau_cuon' && (
                              <span>{prod.specifications.colors} - {prod.specifications.form} - Lõi {prod.specifications.windingCore} - {prod.specifications.processing?.join(', ')}</span>
                            )}
                            {prod.productType === 'tem_mau_to' && (
                              <span>
                                {prod.specifications.width && prod.specifications.height ? `R${prod.specifications.width} X D${prod.specifications.height} MM - ` : ''}
                                {prod.specifications.sheetType} - {prod.specifications.corner} - {prod.specifications.lamination} - {prod.specifications.finished}
                              </span>
                            )}
                            {prod.specifications?.custom && prod.specifications.custom.length > 0 && (
                              <div style={{ marginTop: '2px', fontStyle: 'italic', color: 'var(--color-primary)' }}>
                                {prod.specifications.custom.map((c: any, cidx: number) => (
                                  <div key={cidx}>• {c.key}: {c.value}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {prod.material && (
                          <div style={{ fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                            {t('Chất liệu:')} <span style={{ color: 'var(--color-primary-dark)' }}>{prod.material}</span>
                          </div>
                        )}
                        {prod.specifications?.windDirectionFiles?.length > 0 && (
                          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{t('File Hướng tem:')}</span>
                            {prod.specifications.windDirectionFiles.map((file: any, fidx: number) => (
                              <a key={fidx} href={file.data} download={file.name} style={{ textDecoration: 'underline', color: 'var(--color-primary)', fontSize: '11px' }}>
                                {file.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {prod.layoutUrl ? (
                          <img src={prod.layoutUrl} alt="Layout" style={{ maxHeight: '40px', borderRadius: '4px' }} />
                        ) : (
                          <span style={{ fontSize: '11px', fontStyle: 'italic' }}>{t('Chưa có')}</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                            <>
                               <button className="btn btn-sm btn-outline" onClick={() => handleOpenEditProduct(prod)}>{t('Sửa')}</button>
                               <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteProduct(prod.id)} title={t('Xóa')}>
                                 <Trash2 size={14} />
                               </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(selectedCustomer.products || []).filter((p: any) => !p.deleted).length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '16px' }}>{t('Chưa thiết lập mã sản phẩm nào cho khách hàng này.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">{t('HỢP ĐỒNG & VĂN BẢN KÝ KẾT')}</span>
              {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                 <button className="btn btn-primary btn-symbol" onClick={() => setShowAddContractModal(true)} title={t('Thêm Hợp Đồng Mới')}>
                   <Plus size={18} />
                 </button>
              )}
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Số Hợp Đồng')}</th>
                    <th>{t('Ngày Ký')}</th>
                    <th>{t('Hạn Hiệu Lực')}</th>
                    <th>{t('Giá Trị')}</th>
                    <th>{t('Tài Liệu')}</th>
                    <th>{t('Trạng Thái')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCustomer.contracts || []).map((contr: any) => (
                    <tr key={contr.id}>
                      <td style={{ fontWeight: 600 }}>{contr.contractNo}</td>
                      <td>{formatDate(contr.signDate)}</td>
                      <td>{formatDate(contr.expiryDate)}</td>
                      <td>{contr.value?.toLocaleString()} đ</td>
                      <td>
                        {contr.fileUrl ? (
                          <a href={contr.fileUrl} download={`HopDong_${contr.contractNo}`} className="btn btn-sm btn-outline">
                            Tải file bản cứng
                          </a>
                        ) : (
                          <span style={{ fontSize: '11px', fontStyle: 'italic' }}>{t('Không có file')}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          contr.status === 'active' ? 'badge-success' : 'badge-warning'
                        }`}>{t(contr.status)}</span>
                      </td>
                      <td>
                         {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                           <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteContract(contr.id)} title={t('Xóa')}>
                             <Trash2 size={14} />
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                  {(selectedCustomer.contracts || []).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>{t('Chưa có hợp đồng nào được lưu trữ.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CUSTOMER FILE REPOSITORY CARD */}
          <div className="card" style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Folder size={18} />
                <span>{t('KHO LƯU TRỮ TỆP KHÁCH HÀNG')}</span>
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={t('Tên thư mục mới...')} 
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  style={{ width: '180px', padding: '4px 8px', fontSize: '12.5px' }}
                />
                <button type="button" className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={handleAddFolder}>
                  <Plus size={14} />
                  <span>{t('Tạo Thư Mục')}</span>
                </button>
              </div>
            </div>
            
            <div style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--color-border-light)', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
              <div>
                {!selectedCustomer.files || selectedCustomer.files.length === 0 ? (
                  <p className="text-muted text-center" style={{ padding: '30px' }}>{t('Kho lưu trữ hiện tại trống. Vui lòng tạo thư mục và tải lên tệp tin.')}</p>
                ) : (
                  <div>
                    {Object.entries(
                      (selectedCustomer.files || []).reduce((acc: any, file: any) => {
                        const f = file.folder || t('Chưa phân mục');
                        if (!acc[f]) acc[f] = [];
                        acc[f].push(file);
                        return acc;
                      }, {})
                    ).map(([folderName, folderFiles]: any) => (
                      <div key={folderName} style={{ marginBottom: '20px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Folder size={16} />
                            <span>{folderName}</span>
                          </span>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-danger" 
                            style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleDeleteRepoFolder(folderName)}
                          >
                            <Trash2 size={12} />
                            <span>{t('Xóa thư mục')}</span>
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {folderFiles.map((file: any, fIdx: number) => {
                            if (file.name === '.placeholder') return null;
                            const isImage = file.base64?.startsWith('data:image/');
                            return (
                              <div key={fIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }}>
                                {isImage ? (
                                  <img 
                                    src={file.base64} 
                                    alt={file.name} 
                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                                    onClick={() => setPreviewImage(file.base64)}
                                    title={t('Click để xem lớn')}
                                  />
                                ) : (
                                  <FileText size={28} style={{ color: 'var(--color-primary)' }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    {t('Tải lên lúc')}: {formatDateTime(file.createdAt, 'vi-VN', 'N/A')}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {isImage && (
                                    <button type="button" className="btn btn-sm btn-outline" style={{ padding: '2px 6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => setPreviewImage(file.base64)}>
                                      <Eye size={12} />
                                      <span>{t('Xem')}</span>
                                    </button>
                                  )}
                                  <a href={file.base64} download={file.name} className="btn btn-sm btn-primary" style={{ padding: '2px 6px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Download size={12} />
                                    <span>{t('Tải')}</span>
                                  </a>
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-danger btn-symbol-sm" 
                                    onClick={() => handleDeleteRepoFile(folderName, file.name)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {folderFiles.filter((f: any) => f.name !== '.placeholder').length === 0 && (
                            <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '12px', paddingLeft: '8px' }}>{t('Thư mục trống.')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ borderLeft: '1px solid var(--color-border-light)', paddingLeft: '20px' }}>
                <h4 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>{t('Tải Lên Tệp Tin')}</h4>
                <form onSubmit={handleUploadRepoFile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Thư mục lưu trữ *')}</label>
                    <input 
                      type="text"
                      value={selectedFolderForUpload}
                      onChange={e => setSelectedFolderForUpload(e.target.value)}
                      required
                      placeholder={t('Chọn hoặc nhập thư mục mới...')}
                      list="customer-folders-list"
                      style={{ fontSize: '12.5px' }}
                    />
                    <datalist id="customer-folders-list">
                      {CUSTOMER_FILE_FOLDERS.map(folder => (
                        <option key={`default-${folder}`} value={folder} />
                      ))}
                      {Array.from(new Set((selectedCustomer.files || []).map((f: any) => f.folder))).map((folder: any) => (
                        <option key={folder} value={folder} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>{t('Chọn Tệp Tin *')}</label>
                    <input 
                      type="file" 
                      onChange={handleRepoFileChange} 
                      required 
                      style={{ fontSize: '11px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Tên Tệp Trên Hệ Thống *')}</label>
                    <input 
                      type="text" 
                      value={repoUploadFileName}
                      onChange={e => setRepoUploadFileName(e.target.value)}
                      required
                      placeholder={t('Tên file đính kèm...')}
                      style={{ fontSize: '12.5px' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Upload size={14} />
                    <span>{t('Tải Lên Kho Tệp')}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </>
      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '920px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM KHÁCH HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Mã Khách Hàng *')}</label>
                    <input type="text" value={customerCode} onChange={e => setCustomerCode(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Hạng Khách Hàng')}</label>
                    <select value={customerRank} onChange={e => setCustomerRank(e.target.value as CustomerRank)}>
                      <option value="">{t('Chưa xếp hạng')}</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Tên Công Ty *')}</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Người Liên Hệ')}</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Số Điện Thoại')}</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('SĐT Thu Mua')}</label>
                    <input type="text" value={procurementPhone} onChange={e => setProcurementPhone(e.target.value)} placeholder={t('SĐT người làm việc mua hàng...')} />
                  </div>
                  <div className="form-group">
                    <label>{t('SĐT Nhận Hàng / Kho')}</label>
                    <input type="text" value={warehousePhone} onChange={e => setWarehousePhone(e.target.value)} placeholder={t('SĐT liên hệ kho hàng...')} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Tài Khoản Ngân Hàng')}</label>
                  <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder={t('Số tài khoản, tên ngân hàng, chi nhánh...')} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Mã Số Thuế')}</label>
                    <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email:')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Địa Chỉ Giao Hàng')}</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Hình Thức Chiết Khấu')}</label>
                    <select value={discountType} onChange={e => setDiscountType(e.target.value as PODiscountType)}>
                      <option value="percent">{t('Theo phần trăm (%)')}</option>
                      <option value="amount">{t('Theo tiền chênh (đ)')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{discountType === 'amount' ? t('Tiền Chênh Mặc Định (đ)') : t('Chiết Khấu Mặc Định (%)')}</label>
                    {discountType === 'amount' ? (
                      <input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                    ) : (
                      <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                    )}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Hạn Mức Công Nợ (đ)')}</label>
                    <input type="number" min="0" value={debtLimit} onChange={e => setDebtLimit(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Điều Khoản Thanh Toán')}</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                      <option value="Thanh toán trước">{t('Thanh toán trước')}</option>
                      <option value="Thanh toán khi nhận hàng">{t('Thanh toán khi nhận hàng')}</option>
                      <option value="30 ngày">{t('30 ngày kể từ khi giao hàng')}</option>
                      <option value="45 ngày">{t('45 ngày kể từ khi giao hàng')}</option>
                      <option value="60 ngày">{t('60 ngày kể từ khi giao hàng')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Sale Phụ Trách')}</label>
                    <select value={assignedSaleId} onChange={e => setAssignedSaleId(e.target.value)} disabled={currentUser.role === 'sale'}>
                      {saleUsers.map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Ghi Chú Yêu Cầu Riêng')}</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} />
                </div>
                {renderAdditionalContactsEditor()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Khách Hàng')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '920px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA HỒ SƠ KHÁCH HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditCustomer}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Mã Khách Hàng *')}</label>
                    <input type="text" value={customerCode} onChange={e => setCustomerCode(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Hạng Khách Hàng')}</label>
                    <select value={customerRank} onChange={e => setCustomerRank(e.target.value as CustomerRank)}>
                      <option value="">{t('Chưa xếp hạng')}</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Tên Công Ty *')}</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Người Liên Hệ')}</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Số Điện Thoại')}</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('SĐT Thu Mua')}</label>
                    <input type="text" value={procurementPhone} onChange={e => setProcurementPhone(e.target.value)} placeholder={t('SĐT người làm việc mua hàng...')} />
                  </div>
                  <div className="form-group">
                    <label>{t('SĐT Nhận Hàng / Kho')}</label>
                    <input type="text" value={warehousePhone} onChange={e => setWarehousePhone(e.target.value)} placeholder={t('SĐT liên hệ kho hàng...')} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Tài Khoản Ngân Hàng')}</label>
                  <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder={t('Số tài khoản, tên ngân hàng, chi nhánh...')} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Mã Số Thuế')}</label>
                    <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email:')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Địa Chỉ Giao Hàng')}</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Hình Thức Chiết Khấu')}</label>
                    <select value={discountType} onChange={e => setDiscountType(e.target.value as PODiscountType)}>
                      <option value="percent">{t('Theo phần trăm (%)')}</option>
                      <option value="amount">{t('Theo tiền chênh (đ)')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{discountType === 'amount' ? t('Tiền Chênh Mặc Định (đ)') : t('Chiết Khấu Mặc Định (%)')}</label>
                    {discountType === 'amount' ? (
                      <input type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                    ) : (
                      <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                    )}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Hạn Mức Công Nợ (đ)')}</label>
                    <input type="number" min="0" value={debtLimit} onChange={e => setDebtLimit(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('Điều Khoản Thanh Toán')}</label>
                    <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                      <option value="Thanh toán trước">{t('Thanh toán trước')}</option>
                      <option value="Thanh toán khi nhận hàng">{t('Thanh toán khi nhận hàng')}</option>
                      <option value="30 ngày">{t('30 ngày kể từ khi giao hàng')}</option>
                      <option value="45 ngày">{t('45 ngày kể từ khi giao hàng')}</option>
                      <option value="60 ngày">{t('60 ngày kể từ khi giao hàng')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Sale Phụ Trách')}</label>
                    <select value={assignedSaleId} onChange={e => setAssignedSaleId(e.target.value)} disabled={currentUser.role === 'sale'}>
                      {saleUsers.map(s => (
                        <option key={s.uid} value={s.uid}>{s.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Ghi Chú Yêu Cầu Riêng')}</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} />
                </div>
                {renderAdditionalContactsEditor()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM MÃ SẢN PHẨM KHÁCH HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddProductModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddProductSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Mã Sản Phẩm')} *</label>
                    <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} required placeholder="VD: 5.07.016" />
                  </div>
                  <div className="form-group">
                    <label>{t('Tên Hàng Hóa')} *</label>
                    <input type="text" value={productName} onChange={e => setProductName(e.target.value)} required placeholder="VD: Tem dán dạng cuộn" />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Phân Loại Sản Phẩm')} *</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select value={productType} onChange={e => handleAddProductTypeChange(e.target.value as any)} style={{ flex: 1 }}>
                        {productClassifications.map(c => (
                          <option key={c.id} value={c.id}>{t(c.name)}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-sm btn-outline" onClick={triggerAddClassification} title={t('Thêm')}>
                        {t('+')}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => triggerEditClassification(productType)} title={t('Sửa')}>
                        {t('Sửa')}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Giá Bán Hiện Tại (đ)')} *</label>
                    <input type="number" min="0" value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Chất Liệu')}</label>
                    <input 
                      type="text" 
                      value={productMaterial} 
                      onChange={e => setProductMaterial(e.target.value)} 
                      placeholder={t('VD: Decal Giấy Fasson AW0339F')} 
                      list="materials-suggest-crm"
                    />
                    <datalist id="materials-suggest-crm">
                      <option value="Decal Giấy Fasson AW0339F" />
                      <option value="Decal Nhựa PVC Avery Dennison" />
                      <option value="Màng BOPP bóng 12mic" />
                      <option value="Giấy Ford" />
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>{t('Tải Ảnh Layout Thiết Kế Mẫu')}</label>
                    <input type="file" accept="image/*" onChange={handleProductLayoutChange} style={{ fontSize: '12px' }} />
                    {productLayoutBase64 && (
                      <img src={productLayoutBase64} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '4px', display: 'block' }} />
                    )}
                  </div>
                </div>

                {renderProductCommercialFields()}

                <span style={{ display: 'block', borderBottom: '1px solid var(--color-border-light)', margin: '16px 0' }}></span>
                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>{t('MÔ TẢ THÔNG SỐ KỸ THUẬT')}</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
                  {specFields.map((field) => {
                    const isEditingLabel = editingLabelId === field.id;
                    
                    return (
                      <div key={field.id} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label 
                            style={{ 
                              fontWeight: 600, 
                              fontSize: '13px', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%'
                            }}
                            onDoubleClick={() => handleStartEditLabel(field.id, field.label)}
                            title={t('Nhấp đúp chuột để sửa tên')}
                          >
                            {isEditingLabel ? (
                              <input
                                type="text"
                                value={tempLabelText}
                                onChange={e => setTempLabelText(e.target.value)}
                                onBlur={() => handleSaveLabel(field.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveLabel(field.id);
                                  else if (e.key === 'Escape') setEditingLabelId(null);
                                }}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                style={{ 
                                  fontSize: '12.5px', 
                                  padding: '2px 6px', 
                                  border: '1px solid var(--color-primary)', 
                                  borderRadius: '4px',
                                  width: '100%' 
                                }}
                              />
                            ) : (
                              <>
                                <span style={{ textDecoration: 'underline dotted var(--color-primary)' }}>{field.label}</span>
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>({t('nhấn đúp để sửa')})</span>
                              </>
                            )}
                          </label>
                          
                          {/* Delete field button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--color-danger, #ef4444)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '12px'
                            }}
                            title={t('Xóa thông số này')}
                          >
                            ❌
                          </button>
                        </div>

                        {/* Render input based on field type */}
                        {field.type === 'number' && (
                          <input 
                            type="number" 
                            value={field.value} 
                            onChange={e => handleUpdateFieldValue(field.id, Number(e.target.value))} 
                          />
                        )}

                        {field.type === 'text' && (
                          <input 
                            type="text" 
                            value={field.value} 
                            onChange={e => handleUpdateFieldValue(field.id, e.target.value)} 
                          />
                        )}

                        {field.type === 'select' && field.id === 'windDirection' && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select 
                              value={field.value} 
                              onChange={e => handleUpdateFieldValue(field.id, e.target.value)} 
                              style={{ flex: 1 }}
                            >
                              {windDirections.map(w => (
                                <option key={w.id} value={w.name}>{w.name}</option>
                              ))}
                            </select>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline" 
                              onClick={triggerAddWindDirection} 
                              title={t('Thêm')}
                            >
                              {t('+')}
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline" 
                              onClick={() => {
                                const matched = windDirections.find(w => w.name === field.value);
                                if (matched) triggerEditWindDirection(matched.id);
                              }} 
                              title={t('Sửa')}
                            >
                              {t('Sửa')}
                            </button>
                          </div>
                        )}

                        {field.type === 'select' && field.id !== 'windDirection' && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select 
                              value={field.value} 
                              onChange={e => handleUpdateFieldValue(field.id, e.target.value)}
                              style={{ flex: 1 }}
                            >
                              {field.options?.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            {field.id.startsWith('custom_') && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => handleEditDropdownOptions(field.id)}
                                title={t('Sửa danh sách lựa chọn')}
                              >
                                {t('Sửa mục')}
                              </button>
                            )}
                          </div>
                        )}

                        {field.type === 'checkboxes' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12.5px', marginTop: '6px' }}>
                            {field.options?.map((proc: string) => {
                              const checked = Array.isArray(field.value) ? field.value.includes(proc) : false;
                              return (
                                <label key={proc} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={checked} 
                                    onChange={e => {
                                      const currentList = Array.isArray(field.value) ? field.value : [];
                                      if (e.target.checked) {
                                        handleUpdateFieldValue(field.id, [...currentList, proc]);
                                      } else {
                                        handleUpdateFieldValue(field.id, currentList.filter((p: any) => p !== proc));
                                      }
                                    }} 
                                  />
                                  <span>{proc}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {field.type === 'file' && (
                          <div style={{ marginTop: '4px' }}>
                            <input 
                              type="file" 
                              multiple 
                              onChange={e => handleWindDirectionFilesChangeForField(field.id, e)} 
                              style={{ fontSize: '12px' }} 
                            />
                            {Array.isArray(field.value) && field.value.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {field.value.map((f: any, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', border: '1px solid var(--color-border-light)', borderRadius: '4px', backgroundColor: 'var(--color-bg-light)' }}>
                                    <span style={{ fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    <button 
                                      type="button" 
                                      style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer' }} 
                                      onClick={() => {
                                        const updatedFiles = field.value.filter((_: any, i: number) => i !== idx);
                                        handleUpdateFieldValue(field.id, updatedFiles);
                                      }}
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleAddField}
                  >
                    + {t('Thêm Nhập Liệu')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleAddSelectField}
                  >
                    + {t('Thêm Dropdown')}
                  </button>
                </div>

                {/* Custom Specifications / Choices Section */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h5 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '13.5px', fontWeight: 600 }}>
                      {t('LỰA CHỌN & THÔNG SỐ BỔ SUNG')}
                    </h5>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={() => setSpecCustomRows([...specCustomRows, { key: '', value: '' }])}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      + {t('Thêm Dòng')}
                    </button>
                  </div>
                  {specCustomRows.length === 0 ? (
                    <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      {t('Chưa có thông số bổ sung nào.')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {specCustomRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            value={row.key} 
                            onChange={e => {
                              const updated = [...specCustomRows];
                              updated[idx].key = e.target.value;
                              setSpecCustomRows(updated);
                            }}
                            placeholder={t('Tên thông số (VD: Độ bám dính)')}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            required
                          />
                          <input 
                            type="text" 
                            value={row.value} 
                            onChange={e => {
                              const updated = [...specCustomRows];
                              updated[idx].value = e.target.value;
                              setSpecCustomRows(updated);
                            }}
                            placeholder={t('Giá trị (VD: Cao)')}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            required
                          />
                          <button 
                            type="button" 
                            onClick={() => setSpecCustomRows(specCustomRows.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', padding: '0 4px', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddProductModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Sản Phẩm')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUOTE PRODUCT PRICE MODAL */}
      {showRequoteModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>{t('BÁO GIÁ LẠI SẢN PHẨM')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowRequoteModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleRequoteSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', marginBottom: '10px' }}>
                  {t('Cập nhật giá mới cho mã hàng')}: <strong>{selectedProduct.productCode}</strong> ({selectedProduct.productName})
                </p>
                <div className="form-group">
                  <label>{t('Đơn Giá Mới (đ)')} *</label>
                  <input 
                    type="number" 
                    value={requotePrice} 
                    onChange={e => setRequotePrice(Number(e.target.value))} 
                    required 
                    min="0"
                  />
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Ghi Chú Thay Đổi Giá')}</label>
                  <input 
                    type="text" 
                    value={requoteNote} 
                    onChange={e => setRequoteNote(e.target.value)} 
                    placeholder="VD: Số lượng 10K pcs thì giá 522đ"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRequoteModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật Giá')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CONTRACT MODAL */}
      {showAddContractModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM HỢP ĐỒNG KHÁCH HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddContractModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddContractSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Số Hợp Đồng / Ký Hiệu')} *</label>
                  <input type="text" value={contractNo} onChange={e => setContractNo(e.target.value)} required placeholder="VD: HĐ-2026-001/SF" />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Ngày Ký Kết')}</label>
                    <input type="date" value={contractSignDate} onChange={e => setContractSignDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Hạn Hiệu Lực')}</label>
                    <input type="date" value={contractExpiryDate} onChange={e => setContractExpiryDate(e.target.value)} required />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Giá Trị Hợp Đồng (đ)')}</label>
                    <input type="number" min="0" value={contractValue} onChange={e => setContractValue(Number(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Tải File Bản Cứng Hợp Đồng (.pdf, .jpg)')}</label>
                    <input type="file" accept="application/pdf,image/*" onChange={handleContractFileChange} style={{ fontSize: '12px' }} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddContractModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Hợp Đồng')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditProductModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA MÃ SẢN PHẨM KHÁCH HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => { setShowEditProductModal(false); setSelectedProduct(null); }}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditProductSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>{t('Mã Sản Phẩm')} *</label>
                    <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('Tên Hàng Hóa')} *</label>
                    <input type="text" value={productName} onChange={e => setProductName(e.target.value)} required />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Phân Loại Sản Phẩm')} *</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select value={productType} onChange={e => handleEditProductTypeChange(e.target.value as any)} style={{ flex: 1 }}>
                        {productClassifications.map(c => (
                          <option key={c.id} value={c.id}>{t(c.name)}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-sm btn-outline" onClick={triggerAddClassification} title={t('Thêm')}>
                        {t('+')}
                      </button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => triggerEditClassification(productType)} title={t('Sửa')}>
                        {t('Sửa')}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Giá Bán Hiện Tại (đ)')} *</label>
                    <input type="number" min="0" value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Chất Liệu')}</label>
                    <input 
                      type="text" 
                      value={productMaterial} 
                      onChange={e => setProductMaterial(e.target.value)} 
                      placeholder={t('VD: Decal Giấy Fasson AW0339F')} 
                      list="materials-suggest-crm-edit"
                    />
                    <datalist id="materials-suggest-crm-edit">
                      <option value="Decal Giấy Fasson AW0339F" />
                      <option value="Decal Nhựa PVC Avery Dennison" />
                      <option value="Màng BOPP bóng 12mic" />
                      <option value="Giấy Ford" />
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>{t('Tải Ảnh Layout Thiết Kế Mẫu')}</label>
                    <input type="file" accept="image/*" onChange={handleProductLayoutChange} style={{ fontSize: '12px' }} />
                    {productLayoutBase64 && (
                      <img src={productLayoutBase64} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '4px', display: 'block' }} />
                    )}
                  </div>
                </div>

                {renderProductCommercialFields()}

                <span style={{ display: 'block', borderBottom: '1px solid var(--color-border-light)', margin: '16px 0' }}></span>
                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>{t('MÔ TẢ THÔNG SỐ KỸ THUẬT')}</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
                  {specFields.map((field) => {
                    const isEditingLabel = editingLabelId === field.id;
                    
                    return (
                      <div key={field.id} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label 
                            style={{ 
                              fontWeight: 600, 
                              fontSize: '13px', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%'
                            }}
                            onDoubleClick={() => handleStartEditLabel(field.id, field.label)}
                            title={t('Nhấp đúp chuột để sửa tên')}
                          >
                            {isEditingLabel ? (
                              <input
                                type="text"
                                value={tempLabelText}
                                onChange={e => setTempLabelText(e.target.value)}
                                onBlur={() => handleSaveLabel(field.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveLabel(field.id);
                                  else if (e.key === 'Escape') setEditingLabelId(null);
                                }}
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                style={{ 
                                  fontSize: '12.5px', 
                                  padding: '2px 6px', 
                                  border: '1px solid var(--color-primary)', 
                                  borderRadius: '4px',
                                  width: '100%' 
                                }}
                              />
                            ) : (
                              <>
                                <span style={{ textDecoration: 'underline dotted var(--color-primary)' }}>{field.label}</span>
                                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>({t('nhấn đúp để sửa')})</span>
                              </>
                            )}
                          </label>
                          
                          {/* Delete field button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--color-danger, #ef4444)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '12px'
                            }}
                            title={t('Xóa thông số này')}
                          >
                            ❌
                          </button>
                        </div>

                        {/* Render input based on field type */}
                        {field.type === 'number' && (
                          <input 
                            type="number" 
                            value={field.value} 
                            onChange={e => handleUpdateFieldValue(field.id, Number(e.target.value))} 
                          />
                        )}

                        {field.type === 'text' && (
                          <input 
                            type="text" 
                            value={field.value} 
                            onChange={e => handleUpdateFieldValue(field.id, e.target.value)} 
                          />
                        )}

                        {field.type === 'select' && field.id === 'windDirection' && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select 
                              value={field.value} 
                              onChange={e => handleUpdateFieldValue(field.id, e.target.value)} 
                              style={{ flex: 1 }}
                            >
                              {windDirections.map(w => (
                                <option key={w.id} value={w.name}>{w.name}</option>
                              ))}
                            </select>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline" 
                              onClick={triggerAddWindDirection} 
                              title={t('Thêm')}
                            >
                              {t('+')}
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline" 
                              onClick={() => {
                                const matched = windDirections.find(w => w.name === field.value);
                                if (matched) triggerEditWindDirection(matched.id);
                              }} 
                              title={t('Sửa')}
                            >
                              {t('Sửa')}
                            </button>
                          </div>
                        )}

                        {field.type === 'select' && field.id !== 'windDirection' && (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select 
                              value={field.value} 
                              onChange={e => handleUpdateFieldValue(field.id, e.target.value)}
                              style={{ flex: 1 }}
                            >
                              {field.options?.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            {field.id.startsWith('custom_') && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => handleEditDropdownOptions(field.id)}
                                title={t('Sửa danh sách lựa chọn')}
                              >
                                {t('Sửa mục')}
                              </button>
                            )}
                          </div>
                        )}

                        {field.type === 'checkboxes' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12.5px', marginTop: '6px' }}>
                            {field.options?.map((proc: string) => {
                              const checked = Array.isArray(field.value) ? field.value.includes(proc) : false;
                              return (
                                <label key={proc} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={checked} 
                                    onChange={e => {
                                      const currentList = Array.isArray(field.value) ? field.value : [];
                                      if (e.target.checked) {
                                        handleUpdateFieldValue(field.id, [...currentList, proc]);
                                      } else {
                                        handleUpdateFieldValue(field.id, currentList.filter((p: any) => p !== proc));
                                      }
                                    }} 
                                  />
                                  <span>{proc}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {field.type === 'file' && (
                          <div style={{ marginTop: '4px' }}>
                            <input 
                              type="file" 
                              multiple 
                              onChange={e => handleWindDirectionFilesChangeForField(field.id, e)} 
                              style={{ fontSize: '12px' }} 
                            />
                            {Array.isArray(field.value) && field.value.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                {field.value.map((f: any, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', border: '1px solid var(--color-border-light)', borderRadius: '4px', backgroundColor: 'var(--color-bg-light)' }}>
                                    <span style={{ fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    <button 
                                      type="button" 
                                      style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer' }} 
                                      onClick={() => {
                                        const updatedFiles = field.value.filter((_: any, i: number) => i !== idx);
                                        handleUpdateFieldValue(field.id, updatedFiles);
                                      }}
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleAddField}
                  >
                    + {t('Thêm Nhập Liệu')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleAddSelectField}
                  >
                    + {t('Thêm Dropdown')}
                  </button>
                </div>

                {/* Custom Specifications / Choices Section */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h5 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '13.5px', fontWeight: 600 }}>
                      {t('LỰA CHỌN & THÔNG SỐ BỔ SUNG')}
                    </h5>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={() => setSpecCustomRows([...specCustomRows, { key: '', value: '' }])}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      + {t('Thêm Dòng')}
                    </button>
                  </div>
                  {specCustomRows.length === 0 ? (
                    <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      {t('Chưa có thông số bổ sung nào.')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {specCustomRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            value={row.key} 
                            onChange={e => {
                              const updated = [...specCustomRows];
                              updated[idx].key = e.target.value;
                              setSpecCustomRows(updated);
                            }}
                            placeholder={t('Tên thông số (VD: Độ bám dính)')}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            required
                          />
                          <input 
                            type="text" 
                            value={row.value} 
                            onChange={e => {
                              const updated = [...specCustomRows];
                              updated[idx].value = e.target.value;
                              setSpecCustomRows(updated);
                            }}
                            placeholder={t('Giá trị (VD: Cao)')}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                            required
                          />
                          <button 
                            type="button" 
                            onClick={() => setSpecCustomRows(specCustomRows.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', padding: '0 4px', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => { setShowEditProductModal(false); setSelectedProduct(null); }}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thay Đổi')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICE HISTORY MODAL */}
      {priceHistoryProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700 }}>{t('LỊCH SỬ THAY ĐỔI ĐƠN GIÁ BÁN')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setPriceHistoryProduct(null)}>{t('Đóng')}</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', marginBottom: '12px' }}>
                {t('Mã sản phẩm:')} <strong>{priceHistoryProduct.productCode}</strong> ({priceHistoryProduct.productName})
              </p>
              <div className="table-container">
                <table style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>{t('Ngày')}</th>
                      <th>{t('Đơn Giá')}</th>
                      <th>{t('Ghi Chú')}</th>
                      <th>{t('Người Sửa')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(priceHistoryProduct.priceHistory || []).map((history: any, hidx: number) => (
                      <tr key={hidx}>
                        <td>{history.date}</td>
                        <td style={{ fontWeight: 'bold' }}>{history.price?.toLocaleString()} đ</td>
                        <td style={{ color: 'var(--color-primary-dark)', fontStyle: history.note ? 'normal' : 'italic' }}>
                          {history.note || '-'}
                        </td>
                        <td>{history.updatedBy || t('Hệ thống')}</td>
                      </tr>
                    ))}
                    {(!priceHistoryProduct.priceHistory || priceHistoryProduct.priceHistory.length === 0) && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center' }}>{t('Chưa có lịch sử thay đổi giá.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARE EDIT REQUEST MODAL */}
      {showCompareModal && selectedEditRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '100%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('SO SÁNH THAY ĐỔI CHI TIẾT')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => {
                setShowCompareModal(false);
                setSelectedEditRequest(null);
              }}>{t('Đóng')}</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ padding: '12px', border: '1px solid #fed7d7', borderRadius: '4px', backgroundColor: '#fff5f5' }}>
                  <h4 style={{ color: '#c53030', borderBottom: '1px solid #feb2b2', paddingBottom: '6px', marginBottom: '10px' }}>{t('DỮ LIỆU CŨ')}</h4>
                  <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(selectedEditRequest.originalData, null, 2)}
                  </pre>
                </div>
                <div style={{ padding: '12px', border: '1px solid #c6f6d5', borderRadius: '4px', backgroundColor: '#f0fff4' }}>
                  <h4 style={{ color: '#22543d', borderBottom: '1px solid #9ae6b4', paddingBottom: '6px', marginBottom: '10px' }}>{t('ĐỀ XUẤT MỚI')}</h4>
                  <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(selectedEditRequest.updatedData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => {
                setShowCompareModal(false);
                setSelectedEditRequest(null);
              }}>{t('Hủy')}</button>
              <button type="button" className="btn btn-danger" onClick={() => handleRejectRequest(selectedEditRequest)}>{t('Từ Chối')}</button>
              <button type="button" className="btn btn-success" onClick={() => handleApproveRequest(selectedEditRequest)}>{t('Duyệt & Áp Dụng')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Zoom Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '90%', maxHeight: '90%', padding: '10px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-outline btn-symbol-sm" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }} onClick={() => setPreviewImage(null)}>
              <X size={20} />
            </button>
            <img src={previewImage} alt="Preview Zoom" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <a href={previewImage} download={`Preview_${Date.now()}.jpg`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Download size={14} />
                <span>{t('Tải Ảnh Về')}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
