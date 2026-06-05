import React, { useState, useEffect } from 'react';
import { dbService } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { HorizontalBarChart } from '../components/VisualCharts';

interface CrmProps {
  customers: any[];
  pos: any[];
  users: any[];
  currentUser: any;
  onRefresh: () => void;
}

export const Crm: React.FC<CrmProps> = ({ customers, pos, users, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'needs_care'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  const [chartMonth, setChartMonth] = useState<string>('all');
  const [chartYear, setChartYear] = useState<string>('2026');
  const [showTop15, setShowTop15] = useState<boolean>(false);
  
  // Tab state
  const [crmActiveTab, setCrmActiveTab] = useState<'cooperative' | 'leads'>('cooperative');

  // Leads state & subscription
  const [leads, setLeads] = useState<any[]>([]);
  useEffect(() => {
    const unsubLeads = dbService.subscribeCollection('leads', setLeads);
    return () => unsubLeads();
  }, []);

  // Lead Conversion state
  const [convertingLead, setConvertingLead] = useState<any | null>(null);

  // Lead modals state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Lead Form fields
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadStage, setLeadStage] = useState<'new' | 'contacted' | 'quoted' | 'negotiating' | 'lost'>('new');
  const [leadNote, setLeadNote] = useState('');
  const [leadReminderTime, setLeadReminderTime] = useState('');
  const [leadFiles, setLeadFiles] = useState<any[]>([]);
  
  // File Repository states
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState('');
  const [repoUploadFile, setRepoUploadFile] = useState('');
  const [repoUploadFileName, setRepoUploadFileName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [assignedSaleId, setAssignedSaleId] = useState('');
  const [discountRate, setDiscountRate] = useState(0);
  const [debtLimit, setDebtLimit] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('30 ngày');
  const [note, setNote] = useState('');
  
  const [procurementPhone, setProcurementPhone] = useState('');
  const [warehousePhone, setWarehousePhone] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const saleUsers = users.filter(u => u.role === 'sale');

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
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTaxCode('');
    setAssignedSaleId(currentUser.role === 'sale' ? currentUser.uid : (saleUsers[0]?.uid || ''));
    setDiscountRate(0);
    setDebtLimit(50000000);
    setPaymentTerms('30 ngày');
    setNote('');
    setProcurementPhone('');
    setWarehousePhone('');
    setBankAccount('');
    setShowAddModal(true);
  };

  // Handle opening edit modal
  const openEditModal = (cust: any) => {
    setCompanyName(cust.companyName);
    setContactPerson(cust.contactPerson);
    setPhone(cust.phone);
    setEmail(cust.email);
    setAddress(cust.address);
    setTaxCode(cust.taxCode);
    setAssignedSaleId(cust.assignedSaleId);
    setDiscountRate(cust.discountRate);
    setDebtLimit(cust.debtLimit);
    setPaymentTerms(cust.paymentTerms);
    setNote(cust.note);
    setProcurementPhone(cust.procurementPhone || '');
    setWarehousePhone(cust.warehousePhone || '');
    setBankAccount(cust.bankAccount || '');
    setSelectedCustomer(cust);
    setShowEditModal(true);
  };

  // Create customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    await dbService.addDocument('customers', {
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountRate: Number(discountRate),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note,
      procurementPhone,
      warehousePhone,
      bankAccount,
      files: [], // Repository for custom folders/files
      lastOrderAt: null,
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString(),
      updatedBy: '',
      updatedAt: ''
    });

    if (convertingLead) {
      await dbService.deleteDocument('leads', convertingLead.id);
      setConvertingLead(null);
    }

    setShowAddModal(false);
    onRefresh();
  };

  // Edit customer
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    await dbService.updateDocument('customers', selectedCustomer.id, {
      companyName,
      contactPerson,
      phone,
      email,
      address,
      taxCode,
      assignedSaleId,
      discountRate: Number(discountRate),
      debtLimit: Number(debtLimit),
      paymentTerms,
      note,
      procurementPhone,
      warehousePhone,
      bankAccount,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditModal(false);
    setSelectedCustomer(null);
    onRefresh();
  };

  // Delete customer
  const handleDeleteCustomer = async (id: string) => {
    const password = window.prompt(t('Nhập mật khẩu xác nhận xóa (Giám Đốc/Admin):'));
    if (password === 'admin123' || password === '123456') {
      await dbService.updateDocument('customers', id, {
        deleted: true,
        updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
        updatedAt: new Date().toISOString()
      });
      setSelectedCustomer(null);
      onRefresh();
      alert(t('Đã chuyển khách hàng vào Kho Rác.'));
    } else if (password !== null) {
      alert(t('Mật khẩu không chính xác. Xóa thất bại.'));
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

  // Lead Helpers & Handlers
  const openAddLeadModal = () => {
    resetLeadForm();
    setShowAddLeadModal(true);
  };

  const openEditLeadModal = (lead: any) => {
    setSelectedLead(lead);
    setLeadName(lead.name);
    setLeadPhone(lead.phone || '');
    setLeadEmail(lead.email || '');
    setLeadStage(lead.stage || 'new');
    setLeadNote(lead.note || '');
    setLeadReminderTime(lead.reminderTime ? new Date(lead.reminderTime).toISOString().split('T')[0] : '');
    setLeadFiles(lead.files || []);
    setShowEditLeadModal(true);
  };

  const resetLeadForm = () => {
    setLeadName('');
    setLeadPhone('');
    setLeadEmail('');
    setLeadStage('new');
    setLeadNote('');
    setLeadReminderTime('');
    setLeadFiles([]);
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName) return;

    const newLead = {
      name: leadName,
      phone: leadPhone,
      email: leadEmail,
      stage: leadStage,
      note: leadNote,
      reminderTime: leadReminderTime ? new Date(leadReminderTime).toISOString() : '',
      files: leadFiles,
      assignedSaleId: currentUser.role === 'sale' ? currentUser.uid : (saleUsers[0]?.uid || ''),
      assignedSaleName: currentUser.role === 'sale' ? currentUser.displayName : (saleUsers[0]?.displayName || 'N/A'),
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('leads', newLead);
    setShowAddLeadModal(false);
    resetLeadForm();
  };

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !leadName) return;

    await dbService.updateDocument('leads', selectedLead.id, {
      name: leadName,
      phone: leadPhone,
      email: leadEmail,
      stage: leadStage,
      note: leadNote,
      reminderTime: leadReminderTime ? new Date(leadReminderTime).toISOString() : '',
      files: leadFiles,
      updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      updatedAt: new Date().toISOString()
    });

    setShowEditLeadModal(false);
    setSelectedLead(null);
    resetLeadForm();
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn xóa khách hàng tiềm năng này?'))) {
      await dbService.deleteDocument('leads', leadId);
    }
  };

  const handleConvertLeadToCustomer = (lead: any) => {
    setConvertingLead(lead);
    setCompanyName(lead.name);
    setContactPerson(lead.name);
    setPhone(lead.phone || '');
    setEmail(lead.email || '');
    setAddress('');
    setTaxCode('');
    setAssignedSaleId(lead.assignedSaleId || currentUser.uid);
    setDiscountRate(0);
    setDebtLimit(50000000);
    setPaymentTerms('30 ngày');
    setNote(`Chuyển đổi từ Lead. Ghi chú cũ: ${lead.note}`);
    setShowAddModal(true);
  };

  const handleLeadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    
    const newFiles: any[] = [];
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newFiles.push({
          name: file.name,
          data: reader.result as string
        });
        if (newFiles.length === fileList.length) {
          setLeadFiles(prev => [...prev, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const renderReminderAlert = (reminderTime: string) => {
    if (!reminderTime) return null;
    const remDate = new Date(reminderTime);
    const now = new Date();
    const diffMs = remDate.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return (
        <span className="lead-reminder-alert danger" style={{ marginTop: '4px' }}>
          ⌛ {t('Quá hạn chăm sóc!')} ({remDate.toLocaleDateString('vi-VN')} {remDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
        </span>
      );
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      return (
        <span className="lead-reminder-alert warning" style={{ marginTop: '4px' }}>
          ⌛ {t('Sắp đến hạn!')} ({remDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
        </span>
      );
    } else {
      return (
        <span className="lead-reminder-alert future" style={{ marginTop: '4px' }}>
          ⌛ {remDate.toLocaleDateString('vi-VN')} {remDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
      );
    }
  };

  // Product Helpers
  const handleOpenAddProduct = () => {
    setProductCode('');
    setProductName('');
    setProductType('tem_trang_cuon');
    setCurrentPrice(0);
    setProductLayoutBase64('');
    setShowAddProductModal(true);
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

    let specs: any = {};
    if (productType === 'muc_in') {
      specs = {
        ribbonType: specRibbonType,
        direction: specRibbonDirection,
        size: specRibbonSize,
        color: specRibbonColor
      };
    } else if (productType === 'tem_trang_cuon') {
      specs = {
        width: Number(specWidth),
        height: Number(specHeight),
        gap: Number(specGap),
        pitch: Number(specPitch),
        qtyPerRoll: Number(specQtyPerRoll),
        core: specCore,
        dieCut: specDieCut,
        perforated: specPerforated,
        windDirection: specWindDirection
      };
    } else if (productType === 'tem_mau_cuon') {
      specs = {
        colors: specColorColors,
        form: specColorForm,
        windingCore: specColorWindingCore,
        processing: specColorProcessing
      };
    } else if (productType === 'tem_mau_to') {
      specs = {
        corner: specSheetCorner,
        lamination: specSheetLamination,
        finished: specSheetFinished,
        sheetType: specSheetType
      };
    }

    const newProduct = {
      id: `prod-${Math.random().toString(36).substr(2, 9)}`,
      productCode,
      productName,
      productType,
      currentPrice: Number(currentPrice),
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
      const updatedProducts = (selectedCustomer.products || []).filter((p: any) => p.id !== productId);
      
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
            { date: new Date().toISOString().split('T')[0], price: Number(requotePrice) }
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
    return pos.filter(po => po.customerId === custId);
  };

  // Order frequency (orders per month)
  const calculateFrequency = (custId: string) => {
    const orders = getCustomerOrders(custId);
    if (orders.length === 0) return `0 ${t('đơn/tháng')}`;
    
    // Calculate months between first order and now
    const dates = orders.map(o => new Date(o.orderDate).getTime());
    const minDate = new Date(Math.min(...dates));
    const now = new Date();
    const diffMonths = Math.max(1, (now.getFullYear() - minDate.getFullYear()) * 12 + (now.getMonth() - minDate.getMonth()));
    
    return `${(orders.length / diffMonths).toFixed(1)} ${t('đơn/tháng')}`;
  };

  // Filter and search
  const today = new Date();
  const filteredCustomers = customers.filter(c => {
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
      const diffTime = Math.abs(today.getTime() - new Date(c.lastOrderAt).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return matchesSearch && diffDays > 30; // 30+ days inactive
    }
    return matchesSearch;
  });

  // Top 5/15 customers by sales volume with time filters
  const topCustomerSales = customers
    .filter(c => !c.deleted)
    .map(c => {
      const customerPOs = pos.filter(po => {
        if (po.deleted === true) return false;
        if (po.customerId !== c.id) return false;
        
        // Month and Year filter
        if (po.orderDate) {
          const poDate = new Date(po.orderDate);
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

  return (
    <div className="crm-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('QUẢN LÝ KHÁCH HÀNG (CRM)')}</h1>
          <p className="page-subtitle">{t('Quản lý danh sách, hồ sơ liên hệ, hạn mức công nợ và cảnh báo chăm sóc khách hàng.')}</p>
        </div>
        {crmActiveTab === 'cooperative' && (currentUser.role === 'admin' || currentUser.role === 'sale') && (
          <button className="btn btn-primary btn-symbol" onClick={openAddModal} title={t('Thêm Khách Hàng Mới')}>+</button>
        )}
      </div>

      {/* Tab controls */}
      <div className="leads-tabs">
        <button 
          className={`leads-tab-btn ${crmActiveTab === 'cooperative' ? 'active' : ''}`}
          onClick={() => setCrmActiveTab('cooperative')}
        >
          {t('Khách Hàng Hợp Tác')}
        </button>
        <button 
          className={`leads-tab-btn ${crmActiveTab === 'leads' ? 'active' : ''}`}
          onClick={() => setCrmActiveTab('leads')}
        >
          {t('Khách Hàng Tiềm Năng (Leads)')}
        </button>
      </div>

      {crmActiveTab === 'cooperative' ? (
        <>
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
             <button className="btn btn-outline btn-symbol" onClick={() => setSearchTerm('')} title={t('Xóa Tìm Kiếm')}>✕</button>
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
                <th>{t('Tên Công Ty')}</th>
                <th>{t('Người Liên Hệ')}</th>
                <th>{t('Điện Thoại')}</th>
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
                  const diffTime = Math.abs(today.getTime() - new Date(cust.lastOrderAt).getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  isInactive = diffDays > 30;
                } else {
                  isInactive = true;
                }

                return (
                  <tr key={cust.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomer(cust)}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{cust.companyName}</span>
                        {isInactive && (
                          <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                            [{t('CẢNH BÁO: CHƯA PHÁT SINH ĐƠN MỚI > 30 NGÀY')}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{cust.contactPerson}</td>
                    <td>{cust.phone}</td>
                    <td>{cust.discountRate}%</td>
                    <td>{cust.debtLimit.toLocaleString()} đ</td>
                    <td>{cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString('vi-VN') : t('Chưa có')}</td>
                    <td>
                      <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(cust)}>{t('Chi Tiết')}</button>
                        {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
                          <>
                             <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditModal(cust)} title={t('Sửa')}>✎</button>
                             <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteCustomer(cust.id)} title={t('Xóa')}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>{t('Không tìm thấy khách hàng nào.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED CUSTOMER DETAIL */}
       {selectedCustomer && (
        <div className="customer-details-grid">
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('HỒ SƠ KHÁCH HÀNG:')} {selectedCustomer.companyName}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedCustomer(null)}>{t('Đóng chi tiết')}</button>
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

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Điều khoản nợ:')}</span>
                <span>{t(selectedCustomer.paymentTerms)} ({t('Hạn mức:')} {selectedCustomer.debtLimit.toLocaleString()} đ)</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tần suất đặt hàng:')}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{calculateFrequency(selectedCustomer.id)}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Ghi chú kinh doanh:')}</span>
                <span>{selectedCustomer.note || t('Không có ghi chú')}</span>

                <span style={{ gridColumn: '1 / -1', borderBottom: '1px dashed var(--color-border-light)', margin: '8px 0' }}></span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Tạo bởi:')}</span>
                <span style={{ fontSize: '12px' }}>{selectedCustomer.createdBy || t('Không xác định')} {selectedCustomer.createdAt && `(${new Date(selectedCustomer.createdAt).toLocaleString(t('vi-VN'))})`}</span>

                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12px' }}>{t('Cập nhật bởi:')}</span>
                <span style={{ fontSize: '12px' }}>{selectedCustomer.updatedBy || t('Chưa cập nhật')} {selectedCustomer.updatedAt && `(${new Date(selectedCustomer.updatedAt).toLocaleString(t('vi-VN'))})`}</span>
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
                  </tr>
                </thead>
                <tbody>
                  {getCustomerOrders(selectedCustomer.id).map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                      <td>{new Date(po.orderDate).toLocaleDateString('vi-VN')}</td>
                      <td>{po.netAmount.toLocaleString()} đ</td>
                      <td>
                        <span className={`badge ${
                          po.status === 'delivered' || po.status === 'debt_collected' ? 'badge-success' : 'badge-warning'
                        }`}>{po.status.replace('_', ' ').toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                  {getCustomerOrders(selectedCustomer.id).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>{t('Chưa phát sinh đơn hàng nào.')}</td>
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
                 <button className="btn btn-primary btn-symbol" onClick={handleOpenAddProduct} title={t('Thêm Mã Sản Phẩm Mới')}>+</button>
               )}
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('Mã Sản Phẩm')}</th>
                    <th>{t('Tên Sản Phẩm')}</th>
                    <th>{t('Loại')}</th>
                    <th>{t('Đơn Giá')}</th>
                    <th>{t('Mô Tả Kỹ Thuật')}</th>
                    <th>{t('Ảnh Layout')}</th>
                    <th>{t('Thao Tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCustomer.products || []).map((prod: any) => (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: 600 }}>{prod.productCode}</td>
                      <td>{prod.productName}</td>
                      <td>{t(prod.productType)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{prod.currentPrice.toLocaleString()} đ</td>
                      <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {prod.productType === 'muc_in' && (
                          <span>{prod.specifications.ribbonType} - {prod.specifications.size} - {prod.specifications.color}</span>
                        )}
                        {prod.productType === 'tem_trang_cuon' && (
                          <span>{prod.specifications.width}x{prod.specifications.height}mm - Cuộn {prod.specifications.qtyPerRoll} tem - Lõi {prod.specifications.core} - bế {prod.specifications.dieCut}</span>
                        )}
                        {prod.productType === 'tem_mau_cuon' && (
                          <span>{prod.specifications.colors} - {prod.specifications.form} - Lõi {prod.specifications.windingCore} - {prod.specifications.processing?.join(', ')}</span>
                        )}
                        {prod.productType === 'tem_mau_to' && (
                          <span>{prod.specifications.sheetType} - {prod.specifications.corner} - {prod.specifications.lamination} - {prod.specifications.finished}</span>
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
                               <button className="btn btn-sm btn-outline" onClick={() => handleOpenRequote(prod)}>{t('Báo Giá Lại')}</button>
                               <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteProduct(prod.id)} title={t('Xóa')}>✕</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(selectedCustomer.products || []).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>{t('Chưa thiết lập mã sản phẩm nào cho khách hàng này.')}</td>
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
                 <button className="btn btn-primary btn-symbol" onClick={() => setShowAddContractModal(true)} title={t('Thêm Hợp Đồng Mới')}>+</button>
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
                      <td>{new Date(contr.signDate).toLocaleDateString('vi-VN')}</td>
                      <td>{new Date(contr.expiryDate).toLocaleDateString('vi-VN')}</td>
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
                           <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteContract(contr.id)} title={t('Xóa')}>✕</button>
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
              <span className="card-title">📁 {t('KHO LƯU TRỮ TỆP KHÁCH HÀNG')}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={t('Tên thư mục mới...')} 
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  style={{ width: '180px', padding: '4px 8px', fontSize: '12.5px' }}
                />
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddFolder}>
                  + {t('Tạo Thư Mục')}
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
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>📁 {folderName}</span>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-danger" 
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => handleDeleteRepoFolder(folderName)}
                          >
                            ✕ {t('Xóa thư mục')}
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
                                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    {t('Tải lên lúc')}: {file.createdAt ? new Date(file.createdAt).toLocaleString('vi-VN') : 'N/A'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {isImage && (
                                    <button type="button" className="btn btn-sm btn-outline" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setPreviewImage(file.base64)}>
                                      👁️ {t('Xem')}
                                    </button>
                                  )}
                                  <a href={file.base64} download={file.name} className="btn btn-sm btn-primary" style={{ padding: '2px 6px', fontSize: '11px', textDecoration: 'none' }}>
                                    📥 {t('Tải')}
                                  </a>
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-danger btn-symbol-sm" 
                                    onClick={() => handleDeleteRepoFile(folderName, file.name)}
                                  >
                                    ✕
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
                    <select 
                      value={selectedFolderForUpload}
                      onChange={e => setSelectedFolderForUpload(e.target.value)}
                      required
                      style={{ fontSize: '12.5px' }}
                    >
                      <option value="">-- {t('Chọn thư mục')} --</option>
                      {Array.from(new Set((selectedCustomer.files || []).map((f: any) => f.folder))).map((folder: any) => (
                        <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
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
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                    📥 {t('Tải Lên Kho Tệp')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </>
      ) : (
        /* Render Leads Kanban Board */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-primary)' }}>
              {t('PHỄU THEO DÕI KHÁCH HÀNG TIỀM NĂNG')}
            </span>
            {(currentUser.role === 'admin' || currentUser.role === 'sale') && (
              <button className="btn btn-primary" onClick={openAddLeadModal} style={{ fontWeight: 600 }}>
                + {t('THÊM KHÁCH HÀNG TIỀM NĂNG MỚI')}
              </button>
            )}
          </div>

          <div className="kanban-board">
            {/* Columns */}
            {[
              { stage: 'new', name: t('MỚI'), color: '#64748b' },
              { stage: 'contacted', name: t('ĐÃ LIÊN HỆ'), color: '#0ea5e9' },
              { stage: 'quoted', name: t('ĐÃ BÁO GIÁ'), color: '#f59e0b' },
              { stage: 'negotiating', name: t('ĐANG ĐÀM PHÁN'), color: '#3b82f6' },
              { stage: 'lost', name: t('THẤT BẠI / HỦY'), color: '#ef4444' }
            ].map(col => {
              const colLeads = leads.filter(l => {
                if (currentUser.role === 'sale' && l.assignedSaleId !== currentUser.uid) {
                  return false;
                }
                return l.stage === col.stage;
              });

              return (
                <div key={col.stage} className="kanban-column">
                  <div className="kanban-column-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }}></span>
                      {col.name}
                    </span>
                    <span className="kanban-column-count">{colLeads.length}</span>
                  </div>

                  <div className="kanban-cards-container">
                    {colLeads.map(lead => (
                      <div key={lead.id} className="kanban-card" onClick={() => openEditLeadModal(lead)}>
                        <div className="kanban-card-title">{lead.name}</div>
                        <div className="kanban-card-details">
                          {lead.phone && <div>📞 {lead.phone}</div>}
                          {lead.email && <div>✉️ {lead.email}</div>}
                          {lead.note && <div style={{ fontStyle: 'italic', fontSize: '11px', marginTop: '4px' }}>💬 {lead.note.substring(0, 50)}{lead.note.length > 50 ? '...' : ''}</div>}
                          
                          {/* Reminder Time alert indicator */}
                          {lead.reminderTime && renderReminderAlert(lead.reminderTime)}
                        </div>

                        {/* Files list */}
                        {lead.files && lead.files.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                            {lead.files.map((file: any, fIdx: number) => (
                              <span key={fIdx} className="lead-file-badge">📎 {file.name}</span>
                            ))}
                          </div>
                        )}

                        <div className="kanban-card-meta">
                          <span style={{ fontSize: '10px' }}>👤 {lead.assignedSaleName}</span>
                          <div className="btn-group" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-sm btn-outline btn-symbol-sm" onClick={() => openEditLeadModal(lead)} title={t('Sửa')}>✎</button>
                            {col.stage !== 'lost' && (currentUser.role === 'admin' || currentUser.role === 'sale') && (
                              <button className="btn btn-sm btn-success btn-symbol-sm" onClick={() => handleConvertLeadToCustomer(lead)} title={t('Chuyển thành khách hàng chính thức')}>🤝</button>
                            )}
                            <button className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => handleDeleteLead(lead.id)} title={t('Xóa')}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {colLeads.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                        {t('Trống')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM KHÁCH HÀNG MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body">
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
                    <label>{t('Chiết Khấu Mặc Định (%)')}</label>
                    <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                  </div>
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
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA HỒ SƠ KHÁCH HÀNG')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditCustomer}>
              <div className="modal-body">
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
                    <label>{t('Chiết Khấu Mặc Định (%)')}</label>
                    <input type="number" min="0" max="100" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                  </div>
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
                    <select value={productType} onChange={e => setProductType(e.target.value as any)}>
                      <option value="tem_trang_cuon">{t('Tem Trắng Dạng Cuộn')}</option>
                      <option value="tem_mau_cuon">{t('Tem Màu Dạng Cuộn')}</option>
                      <option value="tem_mau_to">{t('Tem Màu Dạng Tờ')}</option>
                      <option value="muc_in">{t('Mực In Ribbon')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Đơn Giá Bán Hiện Tại (đ)')} *</label>
                    <input type="number" min="0" value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Tải Ảnh Layout Thiết Kế Mẫu')}</label>
                  <input type="file" accept="image/*" onChange={handleProductLayoutChange} style={{ fontSize: '12px' }} />
                  {productLayoutBase64 && (
                    <img src={productLayoutBase64} alt="Preview" style={{ maxHeight: '80px', marginTop: '8px', borderRadius: '4px' }} />
                  )}
                </div>

                <span style={{ display: 'block', borderBottom: '1px solid var(--color-border-light)', margin: '16px 0' }}></span>
                <h4 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>{t('MÔ TẢ THÔNG SỐ KỸ THUẬT')}</h4>

                {/* Conditional specs: Mực In */}
                {productType === 'muc_in' && (
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>{t('Loại mực')}</label>
                      <select value={specRibbonType} onChange={e => setSpecRibbonType(e.target.value)}>
                        <option value="WAX PREMIUM">WAX PREMIUM</option>
                        <option value="WAX RESIN">WAX RESIN</option>
                        <option value="RESIN">RESIN</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t('Chiều quấn')}</label>
                      <select value={specRibbonDirection} onChange={e => setSpecRibbonDirection(e.target.value)}>
                        <option value="Out side">Out side (Ngoài)</option>
                        <option value="In side">In side (Trong)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Kích thước (Rộng x Dài)')}</label>
                      <input type="text" value={specRibbonSize} onChange={e => setSpecRibbonSize(e.target.value)} placeholder="VD: 110mm x 300m" />
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Màu mực')}</label>
                      <select value={specRibbonColor} onChange={e => setSpecRibbonColor(e.target.value)}>
                        <option value="Đen">{t('Màu đen')}</option>
                        <option value="Đỏ">{t('Màu đỏ')}</option>
                        <option value="Xanh">{t('Màu xanh')}</option>
                        <option value="Khác">{t('Màu khác')}</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Conditional specs: Tem Trắng Dạng Cuộn */}
                {productType === 'tem_trang_cuon' && (
                  <div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div className="form-group">
                        <label>{t('Rộng tem (mm)')}</label>
                        <input type="number" value={specWidth} onChange={e => setSpecWidth(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label>{t('Cao tem (mm)')}</label>
                        <input type="number" value={specHeight} onChange={e => setSpecHeight(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label>{t('Bước răng/Gap')}</label>
                        <input type="number" value={specGap} onChange={e => setSpecGap(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Số tem/cuộn')}</label>
                        <input type="number" value={specQtyPerRoll} onChange={e => setSpecQtyPerRoll(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label>{t('Cỡ lõi cuộn')}</label>
                        <select value={specCore} onChange={e => setSpecCore(e.target.value)}>
                          <option value="76mm">76mm</option>
                          <option value="42mm">42mm</option>
                          <option value="29mm">29mm</option>
                          <option value="40mm">40mm</option>
                          <option value="25mm">25mm</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('Kiểu bế góc')}</label>
                        <select value={specDieCut} onChange={e => setSpecDieCut(e.target.value)}>
                          <option value="Bo góc R2">Bo góc R2</option>
                          <option value="Bo góc R3">Bo góc R3</option>
                          <option value="Bo góc R5">Bo góc R5</option>
                          <option value="Vuông góc">Vuông góc</option>
                          <option value="Tròn">Bế hình tròn</option>
                          <option value="Oval">Bế hình Oval</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div className="form-group">
                        <label>{t('Răng cưa xé')}</label>
                        <select value={specPerforated} onChange={e => setSpecPerforated(e.target.value)}>
                          <option value="Không">Không răng cưa</option>
                          <option value="Có">Có đường răng cưa</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('Hướng tem ra')}</label>
                        <select value={specWindDirection} onChange={e => setSpecWindDirection(e.target.value)}>
                          <option value="Ra đầu trước">Ra đầu trước</option>
                          <option value="Ra đầu sau">Ra đầu sau</option>
                          <option value="Chữ quay trái">Chữ quay trái</option>
                          <option value="Chữ quay phải">Chữ quay phải</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional specs: Tem Màu Cuộn */}
                {productType === 'tem_mau_cuon' && (
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>{t('Số màu in / Diễn giải màu')}</label>
                      <input type="text" value={specColorColors} onChange={e => setSpecColorColors(e.target.value)} placeholder="VD: In 4 màu CMYK" />
                    </div>
                    <div className="form-group">
                      <label>{t('Hướng tem ra')}</label>
                      <select value={specWindDirection} onChange={e => setSpecWindDirection(e.target.value)}>
                        <option value="Head First">Head First</option>
                        <option value="Tail First">Tail First</option>
                        <option value="Left First">Left First</option>
                        <option value="Right First">Right First</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Cỡ lõi cuộn tem màu')}</label>
                      <select value={specColorWindingCore} onChange={e => setSpecColorWindingCore(e.target.value)}>
                        <option value="76mm">76mm</option>
                        <option value="42mm">42mm</option>
                        <option value="29mm">29mm</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Quy cách gia công')}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12.5px', marginTop: '6px' }}>
                        {['Cán bóng', 'Cán mờ', 'Phủ UV', 'Ép kim', 'Bế demi', 'Bế đứt'].map(proc => (
                          <label key={proc} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={specColorProcessing.includes(proc)} 
                              onChange={e => {
                                if (e.target.checked) setSpecColorProcessing([...specColorProcessing, proc]);
                                else setSpecColorProcessing(specColorProcessing.filter(p => p !== proc));
                              }} 
                            />
                            <span>{proc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional specs: Tem Màu Tờ */}
                {productType === 'tem_mau_to' && (
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>{t('Góc tem tờ')}</label>
                      <select value={specSheetCorner} onChange={e => setSpecSheetCorner(e.target.value)}>
                        <option value="Bo góc R2">Bo góc R2</option>
                        <option value="Bo góc R3">Bo góc R3</option>
                        <option value="Bo góc R5">Bo góc R5</option>
                        <option value="Vuông góc">Vuông góc</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t('Cán màng bảo vệ')}</label>
                      <select value={specSheetLamination} onChange={e => setSpecSheetLamination(e.target.value)}>
                        <option value="Không cán">Không cán</option>
                        <option value="Cán bóng">Cán màng bóng</option>
                        <option value="Cán mờ">Cán màng mờ</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Thành phẩm sau in')}</label>
                      <select value={specSheetFinished} onChange={e => setSpecSheetFinished(e.target.value)}>
                        <option value="Bế demi">Bế demi</option>
                        <option value="Bế đứt">Bế đứt rời</option>
                        <option value="Xén thành phẩm">Xén thành phẩm</option>
                        <option value="Giao nguyên tờ">Giao nguyên tờ</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginTop: '8px' }}>
                      <label>{t('Quy cách khổ tờ')}</label>
                      <select value={specSheetType} onChange={e => setSpecSheetType(e.target.value)}>
                        <option value="A4">Tờ A4</option>
                        <option value="A3">Tờ A3</option>
                        <option value="310 x 450">Khổ 310 x 450 mm</option>
                        <option value="330 x 480">Khổ 330 x 480 mm</option>
                      </select>
                    </div>
                  </div>
                )}
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

      {/* ADD LEAD MODAL */}
      {showAddLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('THÊM KHÁCH HÀNG TIỀM NĂNG (LEAD) MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddLeadModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddLead}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Công Ty / Tên Liên Hệ *')}</label>
                  <input type="text" value={leadName} onChange={e => setLeadName(e.target.value)} required placeholder="VD: Công ty TNHH Nhựa ABC" />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Điện Thoại')}</label>
                    <input type="text" value={leadPhone} onChange={e => setLeadPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email')}</label>
                    <input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Giai Đoạn Chăm Sóc')}</label>
                    <select value={leadStage} onChange={e => setLeadStage(e.target.value as any)}>
                      <option value="new">{t('Mới tiếp cận')}</option>
                      <option value="contacted">{t('Đã liên hệ')}</option>
                      <option value="quoted">{t('Đã gửi báo giá')}</option>
                      <option value="negotiating">{t('Đang đàm phán')}</option>
                      <option value="lost">{t('Thất bại / Hủy')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Hẹn Ngày Giờ Chăm Sóc Lại (Reminder)')}</label>
                    <input type="datetime-local" value={leadReminderTime} onChange={e => setLeadReminderTime(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Ghi Chú Yêu Cầu Khách Hàng')}</label>
                  <textarea value={leadNote} onChange={e => setLeadNote(e.target.value)} rows={3} placeholder={t('Nhu cầu nhãn dán, quy cách, chất liệu decal yêu cầu...')} style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }} />
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Đính Kèm Tài Liệu Cục Bộ (PDF, Hình ảnh...)')}</label>
                  <input type="file" multiple onChange={handleLeadFilesChange} style={{ fontSize: '12px' }} />
                  {leadFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {leadFiles.map((f, idx) => (
                        <span key={idx} className="lead-file-badge">📎 {f.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddLeadModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Lead')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {showEditLeadModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CẬP NHẬT THÔNG TIN LEAD')}: {selectedLead.name}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditLeadModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditLead}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Tên Công Ty / Tên Liên Hệ *')}</label>
                  <input type="text" value={leadName} onChange={e => setLeadName(e.target.value)} required />
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Số Điện Thoại')}</label>
                    <input type="text" value={leadPhone} onChange={e => setLeadPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t('Email')}</label>
                    <input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div className="form-group">
                    <label>{t('Giai Đoạn Chăm Sóc')}</label>
                    <select value={leadStage} onChange={e => setLeadStage(e.target.value as any)}>
                      <option value="new">{t('Mới tiếp cận')}</option>
                      <option value="contacted">{t('Đã liên hệ')}</option>
                      <option value="quoted">{t('Đã gửi báo giá')}</option>
                      <option value="negotiating">{t('Đang đàm phán')}</option>
                      <option value="lost">{t('Thất bại / Hủy')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('Hẹn Ngày Giờ Chăm Sóc Lại (Reminder)')}</label>
                    <input type="datetime-local" value={leadReminderTime} onChange={e => setLeadReminderTime(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Ghi Chú Yêu Cầu Khách Hàng')}</label>
                  <textarea value={leadNote} onChange={e => setLeadNote(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }} />
                </div>
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label>{t('Đính Kèm Tài Liệu Cục Bộ')}</label>
                  <input type="file" multiple onChange={handleLeadFilesChange} style={{ fontSize: '12px' }} />
                  {leadFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {leadFiles.map((f, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="lead-file-badge">📎 {f.name}</span>
                          <button type="button" style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }} onClick={() => setLeadFiles(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditLeadModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Cập Nhật')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Image Preview Zoom Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '90%', maxHeight: '90%', padding: '10px', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button type="button" className="btn btn-sm btn-outline" style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '1.2rem', zIndex: 10 }} onClick={() => setPreviewImage(null)}>✕</button>
            <img src={previewImage} alt="Preview Zoom" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <a href={previewImage} download={`Preview_${Date.now()}.jpg`} className="btn btn-primary">📥 {t('Tải Ảnh Về')}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
