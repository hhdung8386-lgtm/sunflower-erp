import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Trash2, X, Download, Folder, FileText,
  ChevronDown, ChevronUp, Upload, Save, Briefcase, CheckSquare,
  History, Layers, Paperclip, SlidersHorizontal
} from 'lucide-react';
import { dbService } from '../services/firebaseService';
import { calculatePOItemFinancials, withCalculatedPOFinancials } from '../domain/poFinancials';
import {
  createCustomerSnapshot,
  type CustomerRank,
  type CustomerRecord,
  type CustomerSnapshot
} from '../domain/crmModels';
import './CustomerHistory.css';
import { formatDate, toDateInputValue } from '../domain/dateFormatting';

const PO_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const getDraftSafeLink = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.startsWith('data:') ? '' : value;
};

const getDraftSafeItems = (items: any[]) => items.map(item => ({
  ...item,
  previewImage: getDraftSafeLink(item.previewImage),
  previewImages: (item.previewImages || []).map(getDraftSafeLink).filter(Boolean)
}));

interface POFormFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
  po: any | null; // null if creating new PO
  templatePo?: any | null; // source PO when creating a repeat order
  initialCustomerId?: string; // preselected CRM customer for a first PO
  onSave: (poData: any) => Promise<void>;
  customers: CustomerRecord[];
  suppliers: any[];
  users: any[];
  currentUser: any;
  t: (key: string) => string;
  workflowMode?: 'standard' | 'customer_onboarding';
}

export default function POFormFullScreen({
  isOpen,
  onClose,
  po,
  templatePo,
  initialCustomerId = '',
  onSave,
  customers,
  suppliers,
  users,
  currentUser,
  t,
  workflowMode = 'standard'
}: POFormFullScreenProps) {
  const [customerId, setCustomerId] = useState('');
  const [customerRank, setCustomerRank] = useState('');
  const [customerPoCode, setCustomerPoCode] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // File attachments (Base64 strings)
  const [pdfFile, setPdfFile] = useState('');
  const [excelFile, setExcelFile] = useState('');
  const [aiFile, setAiFile] = useState('');
  const [corelFile, setCorelFile] = useState('');
  const [contractFile, setContractFile] = useState('');
  const [quoteFile, setQuoteFile] = useState('');

  // PO Items state
  const [poItems, setPoItems] = useState<any[]>([]);

  // Department Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<string[]>([]);

  // Search popup state for history/catalog
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchRowIndex, setSearchRowIndex] = useState<number | null>(null);
  const [pastProducts, setPastProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal customer document repository state
  const [showRepoModal, setShowRepoModal] = useState(false);

  // Lightbox for image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form lifecycle and local draft state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftResetRevision, setDraftResetRevision] = useState(0);
  const initializedFormKeyRef = useRef('');
  const draftKey = !po && workflowMode === 'standard' && currentUser?.uid
    ? `sunflower:po-draft:${currentUser.uid}:${templatePo?.id || initialCustomerId || 'new'}`
    : '';

  // Load initial data
  useEffect(() => {
    if (!isOpen) {
      initializedFormKeyRef.current = '';
      return;
    }

    // Wait until customer data is available before initializing a new form.
    if (!po && customers.length === 0) return;

    const formKey = `${po ? `edit:${po.id}` : templatePo ? `repeat:${templatePo.id}` : initialCustomerId ? `customer:${initialCustomerId}` : 'new'}:${draftResetRevision}`;
    if (initializedFormKeyRef.current === formKey) return;

    initializedFormKeyRef.current = formKey;
    setDraftReady(false);
    setDraftRestored(false);
    setSaveError('');
    setIsSaving(false);

    if (po) {
      setCustomerId(po.customerId || '');
      setCustomerRank(po.customerRank || customers.find(customer => customer.id === po.customerId)?.customerRank || '');
      setCustomerPoCode(po.customerPoCode || '');
      setExpectedDeliveryDate(toDateInputValue(po.expectedDeliveryDate));
      setNotes(po.notes || '');
      
      // Load files
      setPdfFile(po.links?.pdfLink || '');
      setExcelFile(po.links?.excelLink || '');
      setAiFile(po.links?.aiLink || '');
      setCorelFile(po.links?.corelLink || '');
      setContractFile(po.links?.contractLink || '');
      setQuoteFile(po.links?.quoteLink || '');

      // Load items with backward compat for previewImage
      const items = (po.items || []).map((item: any) => ({
        ...item,
        itemId: item.itemId || `item-${Math.random().toString(36).substr(2, 9)}`,
        price: item.price !== undefined ? item.price : (item.unitPrice || 0),
        discountType: item.discountType === 'amount' ? 'amount' : 'percent',
        discountRate: item.discountRate !== undefined ? item.discountRate : 0,
        discountAmount: item.discountAmount !== undefined ? item.discountAmount : 0,
        vatRate: item.vatRate !== undefined ? item.vatRate : 8,
        deliveryDate: toDateInputValue(item.deliveryDate),
        previewImages: item.previewImages || (item.previewImage ? [item.previewImage] : []),
        unit: item.unit || 'cái',
        material: item.material || 'Decal Giấy Fasson AW0339F',
        size: item.size || ''
      }));
      setPoItems(items);

      // Load assignments
      setAssignments(po.assignments || []);
    } else if (templatePo) {
      const sourceCustomer = customers.find(customer => customer.id === templatePo.customerId);
      const catalogProducts = sourceCustomer?.products || [];
      const defaultDeliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      setCustomerId(templatePo.customerId || '');
      setCustomerRank(templatePo.customerRank || sourceCustomer?.customerRank || '');
      setCustomerPoCode('');
      setExpectedDeliveryDate(defaultDeliveryDate);
      setNotes(`Đơn đặt lại từ ${templatePo.poCode || 'PO cũ'}. ${templatePo.notes || ''}`.trim());

      // Reuse approved design sources only. Old quotes, contracts and order
      // documents are intentionally not copied into the new commercial order.
      setPdfFile('');
      setExcelFile('');
      setAiFile(templatePo.links?.aiLink || '');
      setCorelFile(templatePo.links?.corelLink || '');
      setContractFile('');
      setQuoteFile('');

      const repeatItems = (templatePo.items || []).map((item: any) => {
        const catalogProduct = catalogProducts.find((product: any) => (
          product.productCode && product.productCode === item.productCode
        ));
        const previewImages = item.previewImages || (item.previewImage ? [item.previewImage] : []);

        return {
          ...item,
          itemId: `item-${Math.random().toString(36).substr(2, 9)}`,
          price: Number(catalogProduct?.currentPrice || 0),
          purchasePrice: 0,
          discountType: item.discountType === 'amount' ? 'amount' : 'percent',
          discountRate: Number(sourceCustomer?.discountRate ?? item.discountRate ?? 0),
          discountAmount: item.discountType === 'amount' ? Number(item.discountAmount || 0) : 0,
          vatRate: item.vatRate !== undefined ? item.vatRate : 8,
          deliveryDate: defaultDeliveryDate,
          previewImages,
          unit: item.unit || 'cái',
          material: item.material || 'Decal Giấy Fasson AW0339F',
          size: item.size || '',
          sourcePoId: templatePo.id,
          sourcePoCode: templatePo.poCode,
          sourceItemId: item.itemId,
          designReuseRequested: previewImages.length > 0 || !!item.designLayouts?.length || !!templatePo.links?.aiLink || !!templatePo.links?.corelLink,
          pricingNeedsReview: true,
          purchaseNeedsReview: true
        };
      });
      setPoItems(repeatItems);

      // Old personnel assignments and deadlines must not leak into a new PO.
      setAssignments([]);
    } else {
      // Defaults for creation
      const initialCustomer = customers.find(customer => customer.id === initialCustomerId) || customers[0];
      const preparedOrder = initialCustomer?.pendingOrderDraft;
      setCustomerId(initialCustomer?.id || '');
      setCustomerRank(initialCustomer?.customerRank || '');
      setCustomerPoCode(preparedOrder?.customerPoCode || '');
      setExpectedDeliveryDate(
        toDateInputValue(preparedOrder?.expectedDeliveryDate)
        || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );
      setNotes(preparedOrder?.notes || '');
      setPdfFile(getDraftSafeLink(preparedOrder?.links?.pdfLink));
      setExcelFile(getDraftSafeLink(preparedOrder?.links?.excelLink));
      setAiFile(getDraftSafeLink(preparedOrder?.links?.aiLink));
      setCorelFile(getDraftSafeLink(preparedOrder?.links?.corelLink));
      setContractFile(getDraftSafeLink(preparedOrder?.links?.contractLink));
      setQuoteFile(getDraftSafeLink(preparedOrder?.links?.quoteLink));
      setPoItems((preparedOrder?.items || []).map((item: any) => ({
        ...item,
        itemId: item.itemId || `item-${Math.random().toString(36).slice(2, 11)}`,
        discountType: item.discountType === 'amount' ? 'amount' : 'percent',
        discountRate: Number(item.discountRate) || 0,
        discountAmount: Number(item.discountAmount) || 0,
        vatRate: item.vatRate === undefined ? 8 : Number(item.vatRate),
        deliveryDate: toDateInputValue(item.deliveryDate || preparedOrder?.expectedDeliveryDate),
        previewImages: item.previewImages || (item.previewImage ? [item.previewImage] : []),
        unit: item.unit || 'cái',
        material: item.material || '',
        size: item.size || ''
      })));
      setAssignments([]);
      setShowAssignments(Boolean(preparedOrder) && workflowMode === 'standard');
    }

    // Restore an unfinished create/repeat order. File data URLs are not stored
    // because they can exceed the browser storage quota; repository URLs remain.
    if (!po && draftKey) {
      try {
        const rawDraft = window.localStorage.getItem(draftKey);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          const isCurrentDraft = Number(draft.savedAt) > Date.now() - PO_DRAFT_MAX_AGE_MS;

          if (!isCurrentDraft) {
            window.localStorage.removeItem(draftKey);
          } else {
            const restoredCustomerId = templatePo?.customerId || initialCustomerId || draft.customerId;
            if (customers.some(customer => customer.id === restoredCustomerId)) {
              setCustomerId(restoredCustomerId);
            }
            const restoredCustomer = customers.find(customer => customer.id === restoredCustomerId);
            setCustomerRank(
              initialCustomerId
                ? restoredCustomer?.customerRank || ''
                : typeof draft.customerRank === 'string' ? draft.customerRank : ''
            );
            setCustomerPoCode(typeof draft.customerPoCode === 'string' ? draft.customerPoCode : '');
            if (typeof draft.expectedDeliveryDate === 'string' && draft.expectedDeliveryDate) {
              setExpectedDeliveryDate(draft.expectedDeliveryDate);
            }
            setNotes(typeof draft.notes === 'string' ? draft.notes : '');
            setPoItems(Array.isArray(draft.poItems) ? draft.poItems : []);
            setAssignments(Array.isArray(draft.assignments) ? draft.assignments : []);
            setPdfFile(getDraftSafeLink(draft.links?.pdfLink));
            setExcelFile(getDraftSafeLink(draft.links?.excelLink));
            setAiFile(getDraftSafeLink(draft.links?.aiLink));
            setCorelFile(getDraftSafeLink(draft.links?.corelLink));
            setContractFile(getDraftSafeLink(draft.links?.contractLink));
            setQuoteFile(getDraftSafeLink(draft.links?.quoteLink));
            setDraftRestored(true);
          }
        }
      } catch (error) {
        console.warn('Unable to restore PO draft:', error);
        window.localStorage.removeItem(draftKey);
      }
    }

    setDraftReady(true);
  }, [po, templatePo, initialCustomerId, isOpen, customers, draftKey, draftResetRevision, workflowMode]);

  // Keep text, items and assignments safe when the modal is closed or the page
  // is refreshed. Large local file data is intentionally excluded.
  useEffect(() => {
    if (!draftReady || !draftKey || po) return;

    const hasMeaningfulDraft = Boolean(
      templatePo ||
      customerPoCode.trim() ||
      customerRank ||
      notes.trim() ||
      poItems.length > 0 ||
      assignments.length > 0 ||
      pdfFile || excelFile || aiFile || corelFile || contractFile || quoteFile
    );

    const timer = window.setTimeout(() => {
      if (!hasMeaningfulDraft) {
        window.localStorage.removeItem(draftKey);
        return;
      }

      try {
        window.localStorage.setItem(draftKey, JSON.stringify({
          savedAt: Date.now(),
          customerId,
          customerRank,
          customerPoCode,
          expectedDeliveryDate,
          notes,
          poItems: getDraftSafeItems(poItems),
          assignments,
          links: {
            pdfLink: getDraftSafeLink(pdfFile),
            excelLink: getDraftSafeLink(excelFile),
            aiLink: getDraftSafeLink(aiFile),
            corelLink: getDraftSafeLink(corelFile),
            contractLink: getDraftSafeLink(contractFile),
            quoteLink: getDraftSafeLink(quoteFile)
          }
        }));
      } catch (error) {
        console.warn('Unable to save PO draft:', error);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    draftReady,
    draftKey,
    po,
    templatePo,
    customerId,
    customerRank,
    customerPoCode,
    expectedDeliveryDate,
    notes,
    poItems,
    assignments,
    pdfFile,
    excelFile,
    aiFile,
    corelFile,
    contractFile,
    quoteFile
  ]);

  // Load repeat order products history for selected customer
  useEffect(() => {
    if (!customerId) return;
    const fetchPastProducts = async () => {
      try {
        const allPOs = await dbService.getCollection('pos');
        const customerPOs = allPOs.filter((p: any) => p.customerId === customerId && !p.deleted);
        const items: any[] = [];
        customerPOs.forEach((p: any) => {
          if (p.items) {
            p.items.forEach((item: any) => {
              items.push({
                ...item,
                poCode: p.poCode,
                orderDate: p.orderDate
              });
            });
          }
        });
        
        // Deduplicate by productCode
        const uniqueItems: any[] = [];
        const codes = new Set();
        items.forEach(item => {
          if (item.productCode && !codes.has(item.productCode)) {
            codes.add(item.productCode);
            uniqueItems.push(item);
          }
        });
        setPastProducts(uniqueItems);
      } catch (err) {
        console.error("Error fetching past products:", err);
      }
    };
    fetchPastProducts();
  }, [customerId]);

  if (!isOpen) return null;

  // Image compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleLinkFileChange = (e: React.ChangeEvent<HTMLInputElement>, setBase64: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const currentItem = poItems[rowIndex];
    const currentImages = [...(currentItem.previewImages || [])];
    
    if (currentImages.length + files.length > 5) {
      alert(t('Chỉ được tải lên tối đa 5 ảnh layout cho mỗi mặt hàng!'));
      return;
    }

    try {
      const compressedB64s = await Promise.all(
        Array.from(files).map(file => compressImage(file))
      );
      
      const updated = [...poItems];
      updated[rowIndex] = {
        ...currentItem,
        previewImages: [...currentImages, ...compressedB64s]
      };
      setPoItems(updated);
    } catch (error) {
      console.error("Failed to compress uploaded files:", error);
      alert(t('Lỗi khi nén ảnh layout. Vui lòng thử lại.'));
    }
    
    // Clear input
    e.target.value = '';
  };

  const deleteRowImage = (rowIndex: number, imgIndex: number) => {
    const updated = [...poItems];
    const images = [...(updated[rowIndex].previewImages || [])];
    images.splice(imgIndex, 1);
    updated[rowIndex].previewImages = images;
    setPoItems(updated);
  };

  // Add blank row
  const handleAddRow = () => {
    const currentCustomer = customers.find(c => c.id === customerId);
    const discountRate = currentCustomer ? currentCustomer.discountRate : 0;
    
    setPoItems([...poItems, {
      itemId: `item-${Math.random().toString(36).substr(2, 9)}`,
      productCode: '',
      productName: '',
      size: '',
      material: 'Decal Giấy Fasson AW0339F',
      unit: 'cái',
      quantity: 1000,
      price: 0,
      discountType: 'percent',
      discountRate: discountRate,
      discountAmount: 0,
      vatRate: 8,
      deliveryDate: expectedDeliveryDate || '',
      note: '',
      previewImages: [],
      supplierId: '',
      supplierName: '',
      purchasePrice: 0,
      workType: 'gia_cong',
      specifications: {}
    }]);
  };

  const handleRemoveRow = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const toggleItemDetails = (itemId: string) => {
    setExpandedItemIds(current => current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId]);
  };

  const getProductSize = (prod: any) => {
    if (!prod) return '';
    if (prod.size) return prod.size;
    if (!prod.specifications) return '';
    
    const specs = prod.specifications;
    if (prod.productType === 'muc_in') {
      return specs.size || '';
    }
    if (specs.width && specs.height) {
      return `R${specs.width} X D${specs.height} MM`;
    }
    return specs.size || '';
  };

  const handleUpdateRowField = (index: number, field: string, value: any) => {
    const updated = [...poItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'supplierId') {
      const sup = suppliers.find(s => s.id === value);
      updated[index].supplierName = sup ? sup.supplierName : '';
    }
    
    // Auto-populate all other fields when code or name matches CRM catalog product
    if (field === 'productCode' || field === 'productName') {
      const currentCustomer = customers.find(c => c.id === customerId);
      const catalogProducts = currentCustomer?.products || [];
      const matchedProd = catalogProducts.find((p: any) => 
        field === 'productCode' 
          ? p.productCode === value 
          : p.productName === value
      );
      if (matchedProd) {
        updated[index] = {
          ...updated[index],
          productCode: matchedProd.productCode || matchedProd.code || 'MANUAL',
          productName: matchedProd.productName || matchedProd.name || '',
          size: getProductSize(matchedProd),
          material: matchedProd.material || matchedProd.specifications?.material || (matchedProd.productType === 'tem_trang_cuon' ? 'Decal Giấy Fasson AW0339F' : 'Decal nhựa PVC'),
          unit: matchedProd.unit || 'cái',
          price: matchedProd.currentPrice || matchedProd.price || 0,
          supplierId: matchedProd.supplierId || '',
          supplierName: matchedProd.supplierName || '',
          purchasePrice: matchedProd.purchasePrice || 0,
          workType: matchedProd.workType || (matchedProd.productType === 'muc_in' ? 'mua_nvl' : 'gia_cong'),
          previewImages: matchedProd.previewImages || (matchedProd.layoutUrl ? [matchedProd.layoutUrl] : (matchedProd.previewImage ? [matchedProd.previewImage] : [])),
          specifications: matchedProd.specifications || {}
        };
      } else if (field === 'productCode') {
        if (value.includes('5.07.006') || value === 'MUC_IN') {
          updated[index].workType = 'mua_nvl';
        } else {
          updated[index].workType = 'gia_cong';
        }
      }
    }
    
    setPoItems(updated);
  };

  // Select item from Catalog or History search popup
  const handleSelectSearchedProduct = (product: any) => {
    if (searchRowIndex === null) return;
    
    const updated = [...poItems];
    updated[searchRowIndex] = {
      ...updated[searchRowIndex],
      productCode: product.productCode || product.code || 'MANUAL',
      productName: product.productName || product.name || '',
      size: getProductSize(product),
      material: product.material || product.specifications?.material || (product.productType === 'tem_trang_cuon' ? 'Decal Giấy Fasson AW0339F' : 'Decal nhựa PVC'),
      unit: product.unit || 'cái',
      price: product.currentPrice || product.price || 0,
      supplierId: product.supplierId || '',
      supplierName: product.supplierName || '',
      purchasePrice: product.purchasePrice || 0,
      workType: product.workType || (product.productType === 'muc_in' ? 'mua_nvl' : 'gia_cong'),
      previewImages: product.previewImages || (product.layoutUrl ? [product.layoutUrl] : (product.previewImage ? [product.previewImage] : [])),
      specifications: product.specifications || {}
    };

    setPoItems(updated);
    setSearchPopupOpen(false);
    setSearchRowIndex(null);
  };

  // Open product selector popup
  const openSearchPopup = (rowIndex: number) => {
    setSearchRowIndex(rowIndex);
    setSearchQuery('');
    setSearchPopupOpen(true);
  };

  // Assignments helpers
  const handleAddAssignment = () => {
    setAssignments([...assignments, {
      id: `assign-${Math.random().toString(36).substr(2, 9)}`,
      department: 'designer',
      userIds: [],
      description: '',
      dueDate: expectedDeliveryDate || '',
      priority: 'Bình thường'
    }]);
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleUpdateAssignment = (index: number, field: string, value: any) => {
    const updated = [...assignments];
    updated[index] = { ...updated[index], [field]: value };
    
    // Clear userIds if department changes so they select new ones matching the role
    if (field === 'department') {
      updated[index].userIds = [];
    }
    
    setAssignments(updated);
  };

  const handleToggleUserInAssignment = (index: number, userId: string) => {
    const updated = [...assignments];
    const currentUsers = [...(updated[index].userIds || [])];
    
    if (currentUsers.includes(userId)) {
      updated[index].userIds = currentUsers.filter(uid => uid !== userId);
    } else {
      updated[index].userIds = [...currentUsers, userId];
    }
    
    setAssignments(updated);
  };

  const hasUnsavedCreateData = Boolean(
    !po && (
      templatePo ||
      customerPoCode.trim() ||
      notes.trim() ||
      poItems.length > 0 ||
      assignments.length > 0 ||
      pdfFile || excelFile || aiFile || corelFile || contractFile || quoteFile
    )
  );

  const handleClose = () => {
    if (isSaving) return;
    if (hasUnsavedCreateData) {
      const shouldClose = window.confirm(
        'Đơn hàng chưa được lưu chính thức. Hệ thống đã giữ bản nháp để bạn có thể tiếp tục sau. Bạn có muốn đóng form?'
      );
      if (!shouldClose) return;
    }
    onClose();
  };

  const handleDiscardDraft = () => {
    if (!draftKey) return;
    const shouldDiscard = window.confirm('Bạn có chắc muốn xóa bản nháp và bắt đầu lại?');
    if (!shouldDiscard) return;
    window.localStorage.removeItem(draftKey);
    setDraftRestored(false);
    setDraftResetRevision(revision => revision + 1);
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!customerId) {
      alert(t('Vui lòng chọn khách hàng!'));
      return;
    }
    if (!expectedDeliveryDate || Number.isNaN(Date.parse(expectedDeliveryDate))) {
      alert(t('Vui lòng chọn ngày giao hàng dự kiến hợp lệ!'));
      return;
    }
    if (!['A', 'B', 'C', 'D'].includes(customerRank)) {
      alert(t('Vui lòng chọn hạng khách hàng A, B, C hoặc D!'));
      return;
    }
    if (poItems.length === 0) {
      alert(t('Vui lòng thêm ít nhất 1 mặt hàng vào PO!'));
      return;
    }

    // Validate that all items have a name and quantity
    for (let i = 0; i < poItems.length; i++) {
      if (!poItems[i].productName) {
        alert(t(`Dòng ${i + 1}: Vui lòng nhập tên hàng!`));
        return;
      }
      if (!poItems[i].quantity || poItems[i].quantity <= 0) {
        alert(t(`Dòng ${i + 1}: Số lượng phải lớn hơn 0!`));
        return;
      }
      if (templatePo && (!poItems[i].price || Number(poItems[i].price) <= 0)) {
        alert(`Dòng ${i + 1}: Vui lòng kiểm tra và nhập đơn giá hiện hành trước khi lưu đơn đặt lại.`);
        return;
      }
    }

    const normalizedItems = poItems.map(item => withCalculatedPOFinancials(item));

    // Calculate totals
    let totalBeforeVat = 0;
    let totalAfterVat = 0;

    normalizedItems.forEach(item => {
      const financials = calculatePOItemFinancials(item);
      totalBeforeVat += financials.amountBeforeVat;
      totalAfterVat += financials.amountWithVat;
    });

    const customerObj = customers.find(c => c.id === customerId);
    if (!customerObj) {
      alert(t('Không tìm thấy hồ sơ khách hàng. Vui lòng tải lại trang và chọn lại khách hàng.'));
      return;
    }

    const normalizedCustomerRank = customerRank as CustomerRank;
    const existingSnapshot = po?.customerId === customerId
      ? po.customerSnapshot as CustomerSnapshot | undefined
      : undefined;
    const customerSnapshot: CustomerSnapshot = existingSnapshot
      ? { ...existingSnapshot, customerRank: normalizedCustomerRank }
      : createCustomerSnapshot(customerObj, normalizedCustomerRank);

    const poData = {
      id: po?.id || undefined,
      customerId,
      customerName: customerSnapshot.companyName,
      customerRank: normalizedCustomerRank,
      customerSnapshot,
      customerPoCode,
      expectedDeliveryDate: new Date(expectedDeliveryDate).toISOString(),
      notes,
      items: normalizedItems,
      assignments,
      totalAmount: totalBeforeVat, // For consistency, totalAmount is subtotal
      discountAmount: normalizedItems.reduce((acc, item) => (
        acc + Math.round(calculatePOItemFinancials(item).discountAmount)
      ), 0),
      netAmount: totalAfterVat, // Store final VAT-included total here or match DB convention
      links: {
        pdfLink: pdfFile,
        excelLink: excelFile,
        aiLink: aiFile,
        corelLink: corelFile,
        contractLink: contractFile,
        quoteLink: quoteFile
      },
      orderType: templatePo ? 'repeat' : (po?.orderType || 'new'),
      repeatSourcePoId: templatePo?.id || po?.repeatSourcePoId || '',
      repeatSourcePoCode: templatePo?.poCode || po?.repeatSourcePoCode || '',
      designReuseRequested: templatePo
        ? poItems.some(item => item.designReuseRequested)
        : Boolean(po?.designReuseRequested)
    };

    setIsSaving(true);
    setSaveError('');
    try {
      await onSave(poData);
      if (draftKey) window.localStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Error saving PO:', error);
      setSaveError('Không thể lưu đơn hàng. Vui lòng kiểm tra kết nối và thử lại.');
      alert('Không thể lưu đơn hàng. Dữ liệu vẫn được giữ trong bản nháp để bạn thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations for totals footer
  const calculateFooter = () => {
    let totalQty = 0;
    let totalBeforeVat = 0;
    let totalVat = 0;
    let totalAfterVat = 0;

    poItems.forEach(item => {
      const financials = calculatePOItemFinancials(item);
      totalQty += financials.quantity;
      totalBeforeVat += financials.amountBeforeVat;
      totalVat += financials.vatAmount;
      totalAfterVat += financials.amountWithVat;
    });

    return { totalQty, totalBeforeVat, totalVat, totalAfterVat };
  };

  const footerTotals = calculateFooter();
  const attachmentCount = [pdfFile, excelFile, aiFile, corelFile, contractFile, quoteFile].filter(Boolean).length;

  // Catalog products + past history filter
  const currentCustomer = customers.find(c => c.id === customerId);
  const isCustomerOnboarding = workflowMode === 'customer_onboarding';
  const isPreparedAssignment = !po
    && !templatePo
    && !isCustomerOnboarding
    && Boolean(currentCustomer?.pendingOrderDraft);
  const catalogProducts = currentCustomer?.products || [];
  
  const filteredCatalog = catalogProducts.filter((p: any) => 
    (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHistory = pastProducts.filter((p: any) => 
    (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Departments for tasks mapping
  const departments = [
    { value: 'designer', label: t('Thiết Kế (DESIGN)') },
    { value: 'producer', label: t('Sản Xuất (FACTORY)') },
    { value: 'purchaser', label: t('Mua Hàng (PURCHASE)') },
    { value: 'accountant', label: t('Kế Toán (ACCOUNTING)') },
    { value: 'sale', label: t('Kinh Doanh (SALES)') },
    { value: 'admin', label: t('Ban Giám Đốc (ADMIN)') }
  ];

  return (
    <div className="modal-overlay-fullscreen">
      <div className="modal-content-fullscreen">
        {/* HEADER */}
        <div className="po-form-header" style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-primary-dark, var(--color-primary))',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>
                {isCustomerOnboarding
                  ? t('CHUẨN BỊ ĐƠN HÀNG ĐẦU TIÊN')
                  : po
                  ? `${t('CHỈNH SỬA ĐƠN HÀNG PO')}: ${po.poCode}`
                  : templatePo
                    ? `TẠO ĐƠN ĐẶT LẠI TỪ ${templatePo.poCode}`
                    : t('TẠO MỚI ĐƠN HÀNG KHÁCH HÀNG (PO)')}
              </h2>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: '2px 0 0 0' }}>
                {isCustomerOnboarding
                  ? t('Nhập thông tin thương mại và mặt hàng; phân công sẽ thực hiện tại Sale PO.')
                  : po
                  ? `${t('Mã PO nội bộ:')} ${po.poCode}`
                  : templatePo
                    ? 'Kế thừa thông số và mẫu đã duyệt; giá, ngày giao và phân công cần kiểm tra lại.'
                    : t('Khởi tạo tệp thông tin đơn hàng mới và phân công sản xuất')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={handleClose}
              disabled={isSaving}
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' }}
            >
              {t('Đóng / Hủy')}
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={isSaving}
              aria-busy={isSaving}
              style={{ 
                backgroundColor: 'white', 
                color: 'var(--color-primary-dark, var(--color-primary))',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save size={16} />
              <span>{isSaving
                ? t('Đang lưu...')
                : isCustomerOnboarding
                  ? t('Lưu khách hàng & chuẩn bị PO')
                  : t('Lưu Đơn Hàng PO')}</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{
          flex: 1, 
          display: 'grid', 
          gridTemplateColumns: '320px minmax(0, 1fr)',
          overflowY: 'auto'
        }} className="po-form-body-container">
          
          {/* LEFT SIDEBAR PANEL: Info, Files */}
          <div className="po-order-sidebar" style={{
            borderRight: '1px solid var(--color-border)', 
            padding: '20px', 
            overflowY: 'visible',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} />
              <span>{t('Thông Tin Khách Hàng')}</span>
            </h3>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Chọn Khách Hàng *')}</label>
              <select 
                value={customerId} 
                onChange={(e) => {
                  const nextCustomerId = e.target.value;
                  const nextCustomer = customers.find(customer => customer.id === nextCustomerId);
                  setCustomerId(nextCustomerId);
                  setCustomerRank(nextCustomer?.customerRank || '');
                  setPoItems([]); // Reset items on customer change
                }}
                disabled={!!po || !!templatePo || Boolean(initialCustomerId)} // Linked onboarding/repeat orders must stay with the original customer
                required
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({t('CK')}: {c.discountRate}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Hạng Khách Hàng *')}</label>
              <select
                value={customerRank}
                onChange={(e) => setCustomerRank(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              >
                <option value="">{t('-- Chọn hạng khách hàng --')}</option>
                {['A', 'B', 'C', 'D'].map(rank => (
                  <option key={rank} value={rank}>{t('Hạng')} {rank}</option>
                ))}
              </select>
              <span className="po-customer-rank-help">{t('Hạng được lưu vào hồ sơ khách hàng sau khi lưu PO.')}</span>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Mã PO Khách Hàng (Số PO)')}</label>
              <input 
                type="text" 
                value={customerPoCode} 
                onChange={(e) => setCustomerPoCode(e.target.value)} 
                placeholder={t('Ví dụ: VFT26-553...')} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Ngày Giao Hàng Dự Kiến *')}</label>
              <input 
                type="date" 
                value={expectedDeliveryDate} 
                onChange={(e) => setExpectedDeliveryDate(e.target.value)} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '12px' }}>{t('Ghi Chú Đơn Hàng')}</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder={t('Chi tiết giao hàng, yêu cầu riêng...')} 
                rows={3} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
              />
            </div>

            {/* Document upload / repository repo link */}
            <div className="po-attachments-card">
              <button
                type="button"
                className="po-collapse-trigger"
                onClick={() => setShowAttachments(current => !current)}
                aria-expanded={showAttachments}
              >
                <span>
                  <Paperclip size={15} />
                  {t('Tệp đơn hàng & thiết kế')}
                  {attachmentCount > 0 && <small>{attachmentCount}</small>}
                </span>
                {showAttachments ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showAttachments && <div className="po-attachment-content">
                {customerId && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline" 
                  onClick={() => setShowRepoModal(true)}
                  style={{
                    marginBottom: '12px',
                    width: '100%', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px',
                    borderColor: 'var(--color-primary)',
                    color: 'var(--color-primary)'
                  }}
                >
                  <Folder size={14} />
                  <span>{t('Nhúp từ kho tệp khách hàng')}</span>
                </button>
                )}

              <div className="po-attachment-fields">
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File PDF Đơn Hàng')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setPdfFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {pdfFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('Bản Báo Giá Excel')}</label>
                  <input type="file" accept=".xls,.xlsx" onChange={e => handleLinkFileChange(e, setExcelFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {excelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Thiết kế AI')}</label>
                  <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setAiFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {aiFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Thiết kế Corel (.cdr)')}</label>
                  <input type="file" accept="*/*" onChange={e => handleLinkFileChange(e, setCorelFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {corelFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('File Hợp Đồng')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setContractFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {contractFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block' }}>{t('Bản Báo Giá PDF')}</label>
                  <input type="file" accept="application/pdf,image/*" onChange={e => handleLinkFileChange(e, setQuoteFile)} style={{ fontSize: '11px', width: '100%' }} />
                  {quoteFile && <span style={{ fontSize: '10px', color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>✓ {t('Đã tải lên')}</span>}
                </div>
              </div>
              </div>}
            </div>
          </div>

          {/* RIGHT GRID PANEL: Items Grid & Assignments */}
          <div className="po-order-main" style={{
            padding: '20px 24px', 
            overflowY: 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {saveError && (
              <div className="po-save-error" role="alert">
                {saveError}
              </div>
            )}
            {draftRestored && (
              <div className="po-draft-notice" role="status">
                <History size={18} />
                <div>
                  <strong>Đã khôi phục bản nháp chưa lưu</strong>
                  <span>Nội dung, mã hàng và phân công đã được giữ lại. Các tệp vừa chọn từ máy tính cần được chọn lại.</span>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={handleDiscardDraft}>
                  Bỏ bản nháp
                </button>
              </div>
            )}
            {templatePo && (
              <div className="repeat-order-banner">
                <History size={18} />
                <div>
                  <strong>Đang tạo đơn đặt lại từ {templatePo.poCode}</strong>
                  <span>Hệ thống đã lấy lại mã hàng, quy cách và mẫu thiết kế. Đơn giá hiện hành, số lượng, ngày giao và người phụ trách phải được xác nhận lại trước khi lưu.</span>
                </div>
              </div>
            )}
            {isPreparedAssignment && (
              <div className="prepared-order-banner" role="status">
                <CheckSquare size={18} />
                <div>
                  <strong>{t('Thông tin đơn đầu tiên đã được chuẩn bị từ CRM')}</strong>
                  <span>{t('Mặt hàng, giá, ngày giao và tệp liên quan đã được điền sẵn. Hãy bổ sung phân công phòng ban rồi lưu để phát hành PO.')}</span>
                </div>
              </div>
            )}
            {/* INLINE EDITING EXCEL-LIKE GRID */}
            <div className="po-items-card">
              <div className="po-items-card-header">
                <div>
                  <h3>{t('Danh Sách Mã Hàng Cần In & Sản Xuất (PO Items)')}</h3>
                  <span>{t('Bấm 🔍 để nhập nhanh mã hàng từ Danh mục / Lịch sử khách hàng')}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddRow}
                >
                  <Plus size={14} />
                  <span>{t('Thêm mã hàng')}</span>
                </button>
              </div>

              <div className="po-inline-grid-container">
                <table className="po-inline-grid po-items-overview-table">
                  <thead>
                    <tr>
                      <th style={{ width: '64px', textAlign: 'center' }}>STT</th>
                      <th style={{ width: '130px' }}>{t('Mã hàng')}</th>
                      <th style={{ width: '180px' }}>{t('Tên hàng *')}</th>
                      <th style={{ width: '180px' }}>{t('Quy cách / Chất liệu')}</th>
                      <th style={{ width: '70px' }}>{t('ĐVT')}</th>
                      <th style={{ width: '80px' }}>{t('Số lượng')}</th>
                      <th style={{ width: '95px' }}>{t('Đơn giá')}</th>
                      <th style={{ width: '180px' }}>{t('Nhà cung cấp')}</th>
                      <th style={{ width: '65px' }}>{t('Thuế (%)')}</th>
                      <th style={{ width: '190px' }}>{t('Chiết khấu')}</th>
                      <th style={{ width: '125px' }}>{t('Thành tiền (gồm VAT)')}</th>
                      <th style={{ width: '85px' }}>{t('KPI PO')}</th>
                      <th style={{ width: '140px' }}>{t('File liên quan')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map((item, index) => {
                      const financials = calculatePOItemFinancials(item);

                      // Backward compatibility for layouts
                      const imagesList = item.previewImages || (item.previewImage ? [item.previewImage] : []);
                      const itemKey = item.itemId || String(index);
                      const isExpanded = expandedItemIds.includes(itemKey);
                      const supplierLabel = item.supplierName
                        || suppliers.find((supplier: any) => supplier.id === item.supplierId)?.supplierName
                        || '';

                      return (
                        <React.Fragment key={itemKey}>
                        <tr>
                          <td className="po-item-index-cell">
                            <strong>{index + 1}</strong>
                            <div className="po-row-actions">
                              <button
                                type="button"
                                className={`po-detail-toggle ${isExpanded ? 'is-active' : ''}`}
                                onClick={() => toggleItemDetails(itemKey)}
                                title={isExpanded ? t('Ẩn chi tiết') : t('Mở ngày giao và ghi chú')}
                                aria-expanded={isExpanded}
                              >
                                <SlidersHorizontal size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger po-row-delete"
                                onClick={() => handleRemoveRow(index)}
                                title={t('Xóa dòng')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                           <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="text"
                                className="po-grid-input"
                                value={item.productCode}
                                onChange={(e) => handleUpdateRowField(index, 'productCode', e.target.value)}
                                placeholder="Mã..."
                                list={`product-codes-list-${index}`}
                              />
                              <datalist id={`product-codes-list-${index}`}>
                                {catalogProducts.map((p: any) => (
                                  <option key={p.id} value={p.productCode}>{p.productName}</option>
                                ))}
                              </datalist>
                              <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ padding: '4px 6px', height: '28px', border: '1px solid var(--color-border)' }}
                                onClick={() => openSearchPopup(index)}
                                title={t('Tìm kiếm nhanh')}
                              >
                                <Search size={12} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.productName}
                              onChange={(e) => handleUpdateRowField(index, 'productName', e.target.value)}
                              placeholder="Tên nhãn..."
                              list={`product-names-list-${index}`}
                            />
                            {/* Datalist for dropdown suggestion */}
                            <datalist id={`product-names-list-${index}`}>
                              {catalogProducts.map((p: any) => (
                                <option key={p.id} value={p.productName}>{p.productCode}</option>
                              ))}
                            </datalist>
                          </td>
                          <td>
                            <div className="po-item-spec-cell">
                              <input
                                type="text"
                                className="po-grid-input"
                                value={item.size}
                                onChange={(e) => handleUpdateRowField(index, 'size', e.target.value)}
                                placeholder={t('Quy cách')}
                              />
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.material}
                              onChange={(e) => handleUpdateRowField(index, 'material', e.target.value)}
                              placeholder={t('Chất liệu')}
                              list="materials-suggest"
                            />
                            </div>
                            <datalist id="materials-suggest">
                              <option value="Decal Giấy Fasson AW0339F" />
                              <option value="Decal Nhựa PVC Avery Dennison" />
                              <option value="Màng BOPP bóng 12mic" />
                              <option value="Giấy Ford" />
                            </datalist>
                          </td>
                          <td>
                            <input 
                              type="text"
                              className="po-grid-input"
                              value={item.unit}
                              onChange={(e) => handleUpdateRowField(index, 'unit', e.target.value)}
                              placeholder="cái"
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.quantity}
                              onChange={(e) => handleUpdateRowField(index, 'quantity', Number(e.target.value))}
                              min="1"
                            />
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.price}
                              onChange={(e) => handleUpdateRowField(index, 'price', Number(e.target.value))}
                              min="0"
                              step="any"
                            />
                          </td>
                          <td>
                            <select
                              className="po-grid-input po-supplier-select"
                              value={item.supplierId || ''}
                              onChange={(e) => handleUpdateRowField(index, 'supplierId', e.target.value)}
                              title={supplierLabel || t('Chưa chọn nhà cung cấp')}
                            >
                              <option value="">{t('-- Chọn nhà cung cấp --')}</option>
                              {suppliers.map((supplier: any) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.supplierName || supplier.companyName || supplier.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input 
                              type="number"
                              className="po-grid-input"
                              value={item.vatRate}
                              onChange={(e) => handleUpdateRowField(index, 'vatRate', Number(e.target.value))}
                              min="0"
                              max="100"
                            />
                          </td>
                          <td>
                            <div className="po-discount-editor">
                              <select
                                className="po-grid-input po-discount-mode"
                                value={financials.discountType}
                                title={financials.discountType === 'amount' ? t('Tiền chênh (VNĐ)') : t('Theo phần trăm')}
                                aria-label={t('Hình thức chiết khấu')}
                                onChange={(e) => {
                                  const discountType = e.target.value === 'amount' ? 'amount' : 'percent';
                                  handleUpdateRowField(index, 'discountType', discountType);
                                }}
                              >
                                <option value="percent">%</option>
                                <option value="amount">{t('Tiền chênh')}</option>
                              </select>
                              <input
                                type="number"
                                className="po-grid-input po-discount-value"
                                value={financials.discountType === 'amount' ? (item.discountAmount || 0) : (item.discountRate || 0)}
                                onChange={(e) => handleUpdateRowField(
                                  index,
                                  financials.discountType === 'amount' ? 'discountAmount' : 'discountRate',
                                  Number(e.target.value)
                                )}
                                min="0"
                                max={financials.discountType === 'percent' ? 100 : (financials.grossAmount || undefined)}
                                step="any"
                              />
                              <span className="po-discount-hint">
                                -{Math.round(financials.discountAmount).toLocaleString()} đ
                              </span>
                            </div>
                          </td>
                          <td className="po-money-cell">
                            {Math.round(financials.amountWithVat).toLocaleString()} đ
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="po-kpi-badge"
                              title={t('Tỷ lệ giá trị còn lại sau chiết khấu')}
                            >
                              {financials.kpiPo.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Multiple image thumbnails */}
                              {imagesList.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {imagesList.map((img: string, imgIdx: number) => (
                                    <div key={imgIdx} style={{ position: 'relative', width: '32px', height: '32px' }}>
                                      <img 
                                        src={img} 
                                        alt="layout" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--color-border)' }}
                                        onClick={() => setPreviewImage(img)}
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => deleteRowImage(index, imgIdx)}
                                        style={{
                                          position: 'absolute',
                                          top: '-4px',
                                          right: '-4px',
                                          backgroundColor: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '12px',
                                          height: '12px',
                                          fontSize: '8px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Upload triggers */}
                              {imagesList.length < 5 && (
                                <label style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: 'var(--color-primary)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  border: '1px dashed var(--color-primary)',
                                  borderRadius: '4px',
                                  width: 'fit-content'
                                }}>
                                  <Upload size={10} />
                                  <span>+ {t('File')}</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    multiple 
                                    onChange={(e) => handleRowFileChange(e, index)}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="po-item-detail-row">
                            <td colSpan={13}>
                              <div className="po-item-detail-grid">
                                <div className="form-group">
                                  <label>{t('Ngày giao của mã hàng')}</label>
                                  <input
                                    type="date"
                                    value={item.deliveryDate}
                                    onChange={(e) => handleUpdateRowField(index, 'deliveryDate', e.target.value)}
                                  />
                                </div>
                                <div className="form-group po-item-note-field">
                                  <label>{t('Ghi chú dòng hàng')}</label>
                                  <input
                                    type="text"
                                    value={item.note || ''}
                                    onChange={(e) => handleUpdateRowField(index, 'note', e.target.value)}
                                    placeholder={t('Yêu cầu riêng cho mã hàng...')}
                                  />
                                </div>
                                <div className="po-item-calculation">
                                  <span>{t('Trước chiết khấu')}: <strong>{Math.round(financials.grossAmount).toLocaleString()} đ</strong></span>
                                  <span>{t('Chiết khấu')}: <strong>{Math.round(financials.discountAmount).toLocaleString()} đ</strong></span>
                                  <span>{t('Trước VAT')}: <strong>{Math.round(financials.amountBeforeVat).toLocaleString()} đ</strong></span>
                                  <span>{t('Sau VAT')}: <strong>{Math.round(financials.amountWithVat).toLocaleString()} đ</strong></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}

                    {/* EMPTY PO ITEMS ROW */}
                    {poItems.length === 0 && (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          {t('Chưa có mã hàng nào được thêm. Hãy chọn mã cũ từ 🔍 hoặc bấm "+ Thêm Dòng Mới"')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="po-items-footer">
                {/* TOTAL SUMMARY CARD */}
                <div className="po-total-summary-card" style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  minWidth: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('Tổng số lượng tem:')}</span>
                    <strong style={{ fontSize: '14px' }}>{footerTotals.totalQty.toLocaleString()} {t('cái')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
                    <span>{t('Tổng tiền chưa VAT:')}</span>
                    <span style={{ fontWeight: 600 }}>{Math.round(footerTotals.totalBeforeVat).toLocaleString()} đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                    <span>{t('Thuế GTGT (VAT):')}</span>
                    <span>{Math.round(footerTotals.totalVat).toLocaleString()} đ</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-primary-dark)', fontSize: '15px', fontWeight: 'bold', paddingTop: '4px' }}>
                    <span>{t('TỔNG CỘNG (GỒM VAT):')}</span>
                    <span>{Math.round(footerTotals.totalAfterVat).toLocaleString()} đ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DEPARTMENT WORK ASSIGNMENTS SECTION */}
            <div className="po-assignment-card" style={{
              border: '1px solid var(--color-border)', 
              borderRadius: '8px',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              overflow: 'hidden',
              display: isCustomerOnboarding ? 'none' : undefined
            }}>
              <div
                className="po-assignment-header"
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '14px 18px', 
                  backgroundColor: '#f8fafc',
                  borderBottom: showAssignments ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setShowAssignments(!showAssignments)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-primary-dark)', fontSize: '14px' }}>
                  <CheckSquare size={16} />
                  <span>{t('PHÂN CÔNG CÔNG VIỆC PHÒNG BAN')}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 'normal', 
                    backgroundColor: 'var(--color-primary-light)', 
                    color: 'var(--color-primary)', 
                    padding: '2px 6px', 
                    borderRadius: '999px' 
                  }}>
                    {assignments.length} {t('Phân công')}
                  </span>
                </div>
                {showAssignments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {showAssignments && (
                <div style={{ padding: '16px' }}>
                  <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '14px', marginTop: 0 }}>
                    {t('Giao phó công việc chi tiết cho các bộ phận như Thiết kế layout, In ấn, Đặt vật tư, Thanh toán... Kèm theo ngày đến hạn và mức độ khẩn cấp.')}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                    {assignments.map((assign, index) => {
                      // Users that match the role of the department
                      const deptUsers = users.filter(u => u.role === assign.department && u.active);

                      return (
                        <div key={assign.id} className="po-assignment-entry" style={{
                          border: '1px solid var(--color-border-light)', 
                          borderRadius: '6px', 
                          padding: '12px',
                          backgroundColor: '#fafbfc',
                          display: 'grid',
                          gridTemplateColumns: '200px 1.5fr 150px 120px 30px',
                          gap: '12px',
                          alignItems: 'start'
                        }}>
                          {/* Department Selector */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Bộ phận chịu trách nhiệm')}</label>
                            <select
                              value={assign.department}
                              onChange={(e) => handleUpdateAssignment(index, 'department', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            >
                              {departments.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>

                            {/* Personnel check list */}
                            <div style={{ marginTop: '8px' }}>
                              <label style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                {t('Chọn Nhân Sự Phụ Trách')}
                              </label>
                              <div style={{ 
                                maxHeight: '100px', 
                                overflowY: 'auto', 
                                border: '1px solid #e2e8f0', 
                                padding: '4px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                              }}>
                                {deptUsers.map(u => (
                                  <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                                    <input 
                                      type="checkbox"
                                      checked={(assign.userIds || []).includes(u.uid)}
                                      onChange={() => handleToggleUserInAssignment(index, u.uid)}
                                    />
                                    <span>{u.displayName}</span>
                                  </label>
                                ))}
                                {deptUsers.length === 0 && (
                                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                    {t('Không có nhân sự cho bộ phận này')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Task Description */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Nội dung công việc bàn giao')}</label>
                            <textarea
                              value={assign.description}
                              onChange={(e) => handleUpdateAssignment(index, 'description', e.target.value)}
                              placeholder={t('Ví dụ: Bế tem trắng, gửi mẫu layout duyệt, đặt mua mực màu đen...')}
                              rows={3}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                          </div>

                          {/* Due date */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Hạn hoàn thành')}</label>
                            <input 
                              type="date"
                              value={assign.dueDate}
                              onChange={(e) => handleUpdateAssignment(index, 'dueDate', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                          </div>

                          {/* Priority Selector */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600 }}>{t('Độ ưu tiên')}</label>
                            <select
                              value={assign.priority}
                              onChange={(e) => handleUpdateAssignment(index, 'priority', e.target.value)}
                              style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            >
                              <option value="Cực gấp">{t('Cực gấp')}</option>
                              <option value="Gấp">{t('Gấp')}</option>
                              <option value="Bình thường">{t('Bình thường')}</option>
                              <option value="Thong thả">{t('Thong thả')}</option>
                            </select>
                          </div>

                          {/* Delete Assignment Row */}
                          <div style={{ alignSelf: 'center', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              onClick={() => handleRemoveAssignment(index)}
                              title={t('Xóa phân công')}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {assignments.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '20px', 
                        border: '1px dashed #cbd5e1', 
                        borderRadius: '6px', 
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                        fontSize: '12.5px'
                      }}>
                        {t('Chưa phân công công việc phòng ban nào cho PO này.')}
                      </div>
                    )}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline" 
                    onClick={handleAddAssignment}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                  >
                    <Plus size={14} />
                    <span>{t('Thêm phân công phòng ban')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH MÃ HÀNG POPUP (Catalog & Past History) */}
        {searchPopupOpen && searchRowIndex !== null && (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700, fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Search size={18} />
                  <span>{t('TÌM KIẾM MÃ HÀNG NHẬP NHANH')}</span>
                </span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setSearchPopupOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <input 
                    type="text" 
                    placeholder={t('Nhập mã hàng hoặc tên hàng cần tìm...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '320px', overflow: 'hidden' }}>
                  {/* Catalog list */}
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '13px', color: 'var(--color-primary)' }}>
                      {t('Danh Mục Đã Đăng Ký (Catalog)')}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                      {filteredCatalog.map((prod: any) => (
                        <div 
                          key={prod.id}
                          className="chat-suggestion-item"
                          onClick={() => handleSelectSearchedProduct(prod)}
                          style={{ borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{prod.productCode}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{prod.productName}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{prod.currentPrice?.toLocaleString()} đ</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{prod.specifications ? `${prod.specifications.width}x${prod.specifications.height}mm` : ''}</div>
                          </div>
                        </div>
                      ))}
                      {filteredCatalog.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                          {t('Không có sản phẩm nào khớp.')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* History list */}
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc', fontWeight: 600, fontSize: '13px', color: 'var(--color-success-dark)' }}>
                      {t('Lịch Sử Đã Đặt Đơn Hàng Cũ (History)')}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                      {filteredHistory.map((prod: any, pIdx: number) => (
                        <div 
                          key={pIdx}
                          className="chat-suggestion-item"
                          onClick={() => handleSelectSearchedProduct(prod)}
                          style={{ borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{prod.productCode}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{prod.productName}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                              {t('Từ đơn:')} {prod.poCode} ({formatDate(prod.orderDate, t('vi-VN'))})
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{prod.price?.toLocaleString()} đ</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{prod.size}</div>
                          </div>
                        </div>
                      ))}
                      {filteredHistory.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                          {t('Không có lịch sử cũ nào khớp.')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSearchPopupOpen(false)}>{t('Đóng')}</button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER REPOSITORY FILE PICKER MODAL */}
        {showRepoModal && (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700, fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Folder size={18} />
                  <span>
                    {t('KHO LƯU TRỮ TỆP KHÁCH HÀNG')}: {currentCustomer?.companyName || ''}
                  </span>
                </span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowRepoModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {(() => {
                  if (!currentCustomer || !currentCustomer.files || currentCustomer.files.length === 0) {
                    return (
                      <p className="text-center text-muted" style={{ padding: '20px' }}>
                        {t('Kho lưu trữ của khách hàng này hiện tại chưa có tệp tin nào.')}
                      </p>
                    );
                  }

                  // Group files by folder
                  const folderGroups = currentCustomer.files.reduce((acc: any, file: any) => {
                    const folderName = file.folder || t('Chưa phân mục');
                    if (!acc[folderName]) acc[folderName] = [];
                    acc[folderName].push(file);
                    return acc;
                  }, {});

                  return (
                    <div>
                      <p style={{ fontSize: '12.5px', marginBottom: '12px', color: 'var(--color-text-muted)' }}>
                        {t('Chọn một tệp từ kho lưu trữ để đính kèm vào phần tương ứng:')}
                      </p>
                      
                      {Object.entries(folderGroups).map(([folderName, folderFiles]: any) => (
                        <div key={folderName} style={{ marginBottom: '16px' }}>
                          <h5 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginBottom: '8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <Folder size={14} />
                            <span>{folderName}</span>
                          </h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {folderFiles.map((file: any, fIdx: number) => (
                              <div key={fIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }}>
                                <span style={{ fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={file.name}>
                                  <FileText size={14} />
                                  <span>{file.name}</span>
                                </span>
                                <div>
                                  <select 
                                    onChange={(e) => {
                                      const target = e.target.value;
                                      if (!target) return;
                                      
                                      if (target === 'pdf') setPdfFile(file.base64);
                                      if (target === 'excel') setExcelFile(file.base64);
                                      if (target === 'ai') setAiFile(file.base64);
                                      if (target === 'corel') setCorelFile(file.base64);
                                      if (target === 'contract') setContractFile(file.base64);
                                      if (target === 'quote') setQuoteFile(file.base64);
                                      
                                      alert(t(`Đã đính kèm tệp "${file.name}" vào trường ${target.toUpperCase()}`));
                                      e.target.value = ''; // reset
                                    }}
                                    style={{ padding: '2px 6px', fontSize: '11.5px', width: '150px' }}
                                  >
                                    <option value="">-- {t('Đính kèm vào')} --</option>
                                    <option value="pdf">{t('PDF Đơn Hàng')}</option>
                                    <option value="excel">{t('Bản Báo Giá Excel')}</option>
                                    <option value="ai">{t('File Thiết kế AI')}</option>
                                    <option value="corel">{t('File Thiết kế Corel')}</option>
                                    <option value="contract">{t('File Hợp Đồng')}</option>
                                    <option value="quote">{t('Bản Báo Giá PDF')}</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRepoModal(false)}>{t('Hoàn thành')}</button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE ZOOM LIGHTBOX */}
        {previewImage && (
          <div 
            className="modal-overlay" 
            onClick={() => setPreviewImage(null)} 
            style={{ zIndex: 1300, background: 'rgba(0,0,0,0.85)' }}
          >
            <div 
              className="modal-content" 
              style={{ maxWidth: '90%', maxHeight: '90%', padding: '12px', position: 'relative', background: 'transparent', boxShadow: 'none' }} 
              onClick={e => e.stopPropagation()}
            >
              <button 
                type="button" 
                style={{ 
                  position: 'absolute', 
                  top: '-15px', 
                  right: '-15px', 
                  backgroundColor: 'white', 
                  color: 'black', 
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px', 
                  height: '30px', 
                  fontSize: '18px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }} 
                onClick={() => setPreviewImage(null)}
              >
                ×
              </button>
              <img 
                src={previewImage} 
                alt="Layout Zoom" 
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '4px', border: '2px solid white' }} 
              />
              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <a 
                  href={previewImage} 
                  download={`Layout_${Date.now()}.jpg`} 
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>{t('Tải Ảnh Về')}</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
