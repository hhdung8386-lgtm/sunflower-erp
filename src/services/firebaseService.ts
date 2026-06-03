import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  onSnapshot
} from 'firebase/firestore';

// Firebase Configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if we should use Real Firebase
const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY' && firebaseConfig.apiKey !== '';

let realDb: any = null;
let realAuth: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    realDb = getFirestore(app);
    realAuth = getAuth(app);
  } catch (error) {
    console.error("Failed to initialize Firebase", error);
  }
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'sale' | 'designer' | 'purchaser' | 'producer' | 'accountant';
  active: boolean;
  createdAt: string;
}

// ----------------------------------------------------
// SEED MOCK DATA FOR LOCAL STORAGE FALLBACK
// ----------------------------------------------------
const DEFAULT_USERS: UserProfile[] = [
  { uid: 'u-admin', email: 'admin@sunflower.com', displayName: 'Giám Đốc Lê Minh', role: 'admin', active: true, createdAt: '2026-05-01' },
  { uid: 'u-sale', email: 'sale@sunflower.com', displayName: 'Sale Nguyễn Văn Nam', role: 'sale', active: true, createdAt: '2026-05-01' },
  { uid: 'u-designer', email: 'designer@sunflower.com', displayName: 'Designer Trần Hà', role: 'designer', active: true, createdAt: '2026-05-01' },
  { uid: 'u-purchaser', email: 'purchase@sunflower.com', displayName: 'Mua Hàng Phạm Đức', role: 'purchaser', active: true, createdAt: '2026-05-01' },
  { uid: 'u-producer', email: 'produce@sunflower.com', displayName: 'Quản Đốc Vũ Thành', role: 'producer', active: true, createdAt: '2026-05-01' },
  { uid: 'u-accountant', email: 'accountant@sunflower.com', displayName: 'Kế Toán Trần Thu', role: 'accountant', active: true, createdAt: '2026-05-01' },
];

const DEFAULT_CUSTOMERS = [
  { id: 'c-001', companyName: 'Công ty TNHH AQUA Việt Nam', contactPerson: 'Ông Yoshikawa', phone: '02203-888999', email: 'contact@aqua-hd.com', address: 'KCN Đại An, Hải Dương', taxCode: '2100888999', assignedSaleId: 'u-sale', discountRate: 5, debtLimit: 100000000, paymentTerms: '30 ngày', note: 'Khách VIP decal cuộn giấy, in Flexo', lastOrderAt: '2026-05-28T10:00:00Z', createdAt: '2026-05-01T08:00:00Z' },
  { id: 'c-002', companyName: 'Brother Industries Hải Dương', contactPerson: 'Bà Nguyễn Thị Hoa', phone: '02203-777666', email: 'hoa.nt@brother.com', address: 'KCN Phúc Điền, Hải Dương', taxCode: '2100777666', assignedSaleId: 'u-sale', discountRate: 8, debtLimit: 150000000, paymentTerms: '45 ngày', note: 'In tem bạc, decal nhựa màng bảo vệ', lastOrderAt: '2026-05-15T09:00:00Z', createdAt: '2026-05-02T08:00:00Z' },
  { id: 'c-003', companyName: 'Trancy Logistics Hải Dương', contactPerson: 'Ông Vũ Văn An', phone: '0987-123456', email: 'an.vv@trancy-hd.com', address: 'KCN Lai Cách, Hải Dương', taxCode: '2100555444', assignedSaleId: 'u-sale', discountRate: 0, debtLimit: 50000000, paymentTerms: 'Thanh toán khi nhận hàng', note: 'Chuyên tem barcode dán thùng carton', lastOrderAt: '2026-04-10T14:00:00Z', createdAt: '2026-05-03T08:00:00Z' },
  { id: 'c-004', companyName: 'Samsung Electronics Bắc Ninh', contactPerson: 'Mr. Park Ji-sung', phone: '0222-399999', email: 'jipark@samsung.com', address: 'KCN Yên Phong, Bắc Ninh', taxCode: '2300111222', assignedSaleId: 'u-sale', discountRate: 10, debtLimit: 300000000, paymentTerms: '60 ngày', note: 'Đơn hàng số lượng lớn, kiểm tra QC khắt khe', lastOrderAt: '2026-06-02T16:00:00Z', createdAt: '2026-05-04T08:00:00Z' },
];

const MOCK_BASE64_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="%23eff6ff" stroke="%231e3a8a" stroke-width="2"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%231e3a8a" font-weight="bold">MẪU THIẾT KẾ</svg>';

const DEFAULT_POS = [
  {
    id: 'po-001',
    poCode: 'PO-202605-0001',
    customerId: 'c-001',
    customerName: 'Công ty TNHH AQUA Việt Nam',
    saleId: 'u-sale',
    orderDate: '2026-05-28T10:00:00Z',
    expectedDeliveryDate: '2026-06-10T00:00:00Z',
    status: 'producing',
    items: [
      { itemId: 'item-1-1', productName: 'Tem nhãn nước giặt AQUA 500ml', size: '120x80mm', material: 'Decal nhựa đục', quantity: 20000, price: 1500, totalAmount: 30000000, previewImage: MOCK_BASE64_IMAGE }
    ],
    totalAmount: 30000000,
    discountAmount: 1500000,
    netAmount: 28500000,
    links: { pdfLink: 'https://drive.google.com/file/d/aqua-pdf', excelLink: '', aiLink: 'https://drive.google.com/file/d/aqua-ai', corelLink: '', contractLink: '', quoteLink: '' },
    notes: 'In Flexo cuộn, cán màng bóng, yêu cầu màu sắc chính xác.',
    historyLogs: [
      { status: 'receive_po', updatedBy: 'Nam Nguyễn (Sale)', updatedAt: '2026-05-28T10:00:00Z', note: 'Tiếp nhận đơn hàng' },
      { status: 'design_sent', updatedBy: 'Hà Trần (Thiết kế)', updatedAt: '2026-05-29T14:30:00Z', note: 'Upload file thiết kế v1' },
      { status: 'layout_pending', updatedBy: 'Nam Nguyễn (Sale)', updatedAt: '2026-05-30T09:00:00Z', note: 'Gửi khách hàng duyệt màu' },
      { status: 'production_pending', updatedBy: 'Đức Phạm (Mua hàng)', updatedAt: '2026-05-31T11:00:00Z', note: 'Vật tư đủ, chốt layout sản xuất' },
      { status: 'producing', updatedBy: 'Thành Vũ (Sản xuất)', updatedAt: '2026-06-01T08:00:00Z', note: 'Đang chạy máy Flexo 01' }
    ],
    createdAt: '2026-05-28T10:00:00Z'
  },
  {
    id: 'po-002',
    poCode: 'PO-202606-0001',
    customerId: 'c-002',
    customerName: 'Brother Industries Hải Dương',
    saleId: 'u-sale',
    orderDate: '2026-06-02T09:00:00Z',
    expectedDeliveryDate: '2026-06-15T00:00:00Z',
    status: 'design_sent',
    items: [
      { itemId: 'item-2-1', productName: 'Tem bạc thông số kỹ thuật Máy in', size: '50x30mm', material: 'Decal bạc (PET)', quantity: 50000, price: 800, totalAmount: 40000000, previewImage: MOCK_BASE64_IMAGE }
    ],
    totalAmount: 40000000,
    discountAmount: 3200000,
    netAmount: 36800000,
    links: { pdfLink: '', excelLink: '', aiLink: 'https://drive.google.com/file/d/brother-ai', corelLink: '', contractLink: '', quoteLink: '' },
    notes: 'Tem chịu nhiệt, in barcode nét để quét tia hồng ngoại.',
    historyLogs: [
      { status: 'receive_po', updatedBy: 'Nam Nguyễn (Sale)', updatedAt: '2026-06-02T09:00:00Z', note: 'Tạo PO mới trên hệ thống' },
      { status: 'design_sent', updatedBy: 'Hà Trần (Thiết kế)', updatedAt: '2026-06-03T10:00:00Z', note: 'Thiết kế đã gửi, chờ khách duyệt' }
    ],
    createdAt: '2026-06-02T09:00:00Z'
  },
  {
    id: 'po-003',
    poCode: 'PO-202604-0001',
    customerId: 'c-003',
    customerName: 'Trancy Logistics Hải Dương',
    saleId: 'u-sale',
    orderDate: '2026-04-10T14:00:00Z',
    expectedDeliveryDate: '2026-04-18T00:00:00Z',
    status: 'delivered',
    items: [
      { itemId: 'item-3-1', productName: 'Tem nhãn Barcode dán thùng Trancy', size: '100x100mm', material: 'Decal giấy Fasson', quantity: 10000, price: 400, totalAmount: 4000000, previewImage: MOCK_BASE64_IMAGE }
    ],
    totalAmount: 4000000,
    discountAmount: 0,
    netAmount: 4000000,
    links: { pdfLink: '', excelLink: '', aiLink: '', corelLink: '', contractLink: '', quoteLink: '' },
    notes: 'Đóng dạng xấp xé rãnh răng cưa.',
    historyLogs: [
      { status: 'delivered', updatedBy: 'Hùng Nguyễn (Tài xế)', updatedAt: '2026-04-18T16:00:00Z', note: 'Giao hàng thành công, đã ký nhận' }
    ],
    createdAt: '2026-04-10T14:00:00Z'
  }
];

const DEFAULT_DESIGNS = [
  {
    id: 'po-001',
    poId: 'po-001',
    designerId: 'u-designer',
    status: 'approved',
    versions: [
      { versionNumber: 1, previewImage: MOCK_BASE64_IMAGE, aiLink: 'https://drive.google.com/file/d/aqua-ai-v1', corelLink: '', comment: 'Mẫu thiết kế nước giặt đầu tiên', createdAt: '2026-05-29T14:30:00Z', feedbackFromClient: 'Chỉnh lại tông màu xanh dương đậm hơn tí', feedbackAt: '2026-05-30T08:00:00Z' },
      { versionNumber: 2, previewImage: MOCK_BASE64_IMAGE, aiLink: 'https://drive.google.com/file/d/aqua-ai-v2', corelLink: '', comment: 'Mẫu v2 đã chỉnh màu theo yêu cầu', createdAt: '2026-05-30T15:00:00Z', feedbackFromClient: 'Đồng ý duyệt màu này!', feedbackAt: '2026-05-31T09:30:00Z' }
    ],
    updatedAt: '2026-05-31T09:30:00Z'
  },
  {
    id: 'po-002',
    poId: 'po-002',
    designerId: 'u-designer',
    status: 'client_pending',
    versions: [
      { versionNumber: 1, previewImage: MOCK_BASE64_IMAGE, aiLink: 'https://drive.google.com/file/d/brother-ai-v1', corelLink: '', comment: 'Bố cục chuẩn theo bản CAD khách gửi', createdAt: '2026-06-03T10:00:00Z', feedbackFromClient: '', feedbackAt: '' }
    ],
    updatedAt: '2026-06-03T10:00:00Z'
  }
];

const DEFAULT_INVENTORY = [
  { id: 'inv-001', materialName: 'Decal Giấy Fasson AW0339F', category: 'paper', qtyInStock: 800, qtyReserved: 120, minQtyAlert: 200, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-002', materialName: 'Decal Nhựa PVC Avery Dennison', category: 'paper', qtyInStock: 50, qtyReserved: 40, minQtyAlert: 100, unit: 'm²', defaultSupplierId: 'sup-002', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-003', materialName: 'Mực Flexo DIC Process Black', category: 'ink', qtyInStock: 25, qtyReserved: 5, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-004', materialName: 'Mực Flexo DIC Process Cyan', category: 'ink', qtyInStock: 8, qtyReserved: 6, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-005', materialName: 'Màng BOPP bóng 12mic', category: 'film', qtyInStock: 1500, qtyReserved: 160, minQtyAlert: 300, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-006', materialName: 'Lõi Giấy phi 76mm', category: 'others', qtyInStock: 120, qtyReserved: 20, minQtyAlert: 50, unit: 'cuộn', defaultSupplierId: 'sup-004', updatedAt: '2026-06-01T08:00:00Z' },
];

const DEFAULT_SUPPLIERS = [
  { id: 'sup-001', supplierName: 'Avery Dennison Vietnam (Fasson)', contactPerson: 'Đại diện Kênh Phân phối', phone: '028-3999888', email: 'sales@fasson.com.vn', address: 'KCN VSIP, Bình Dương' },
  { id: 'sup-002', supplierName: 'UPM Raflatac Vietnam', contactPerson: 'Trần Thế Anh', phone: '0909-888777', email: 'theanh.tran@upm.com', address: 'Tòa nhà Bitexco, Q.1, TP.HCM' },
  { id: 'sup-003', supplierName: 'DIC Ink Vietnam', contactPerson: 'Nguyễn Văn Minh', phone: '0274-3888222', email: 'minh.nv@dic.com.vn', address: 'KCN Việt Hương, Bình Dương' },
  { id: 'sup-004', supplierName: 'Công ty Cổ phần Bao bì Lõi giấy Việt', contactPerson: 'Hoàng Văn Thắng', phone: '0912-345678', email: 'thang.hv@loigiayviet.vn', address: 'Yên Mỹ, Hưng Yên' }
];

const DEFAULT_PURCHASE_ORDERS = [
  { id: 'pur-001', purCode: 'PUR-202606-0001', supplierId: 'sup-002', supplierName: 'UPM Raflatac Vietnam', linkedPoId: 'po-001', linkedPoCode: 'PO-202605-0001', items: [{ materialName: 'Decal Nhựa PVC Avery Dennison', quantity: 200, unit: 'm²', unitPrice: 35000, totalPrice: 7000000 }], totalPrice: 7000000, status: 'confirmed', expectedReceiveDate: '2026-06-06T00:00:00Z', actualReceiveDate: '', createdAt: '2026-06-02T10:00:00Z' }
];

const DEFAULT_PRODUCTION_COMMANDS = [
  { id: 'lsx-001', lsxCode: 'LSX-202606-0001', poId: 'po-001', poCode: 'PO-202605-0001', productName: 'Tem nhãn nước giặt AQUA 500ml', qtyToProduce: 20000, machineId: 'Máy Flexo 8 màu', shift: 'Ca Sáng (08:00 - 18:00)', operatorId: 'u-producer', operatorName: 'Quản Đốc Vũ Thành', status: 'producing', scrapQty: 0, notes: 'Chú ý chồng màu Cyan và Yellow để tránh lệch tông xanh lá cây của chai mẫu.', startedAt: '2026-06-01T08:00:00Z', completedAt: '' }
];

const DEFAULT_DELIVERIES = [
  { id: 'del-001', delCode: 'DEL-202606-0001', deliveryDate: '2026-06-08T08:00:00Z', region: 'Hải Dương', driverName: 'Lê Văn Tài', vehiclePlate: '34C-888.99', assignedSaleId: 'u-sale', status: 'planning', orders: [{ poId: 'po-001', customerId: 'c-001', customerName: 'Công ty TNHH AQUA Việt Nam', deliveryAddress: 'KCN Đại An, Hải Dương', deliveredQty: 20000, status: 'pending', signatureImage: '', note: 'Giao trong giờ hành chính, gọi điện trước 30p.' }] }
];

const DEFAULT_INVOICES = [
  { id: 'inv-rec-001', invoiceCode: 'VAT-202605-001', poId: 'po-003', customerId: 'c-003', type: 'receivable', amount: 4000000, paidAmount: 4000000, status: 'paid', dueDate: '2026-04-18T00:00:00Z', createdAt: '2026-04-10T14:00:00Z' },
  { id: 'inv-rec-002', invoiceCode: 'VAT-202606-001', poId: 'po-001', customerId: 'c-001', type: 'receivable', amount: 28500000, paidAmount: 10000000, status: 'partially_paid', dueDate: '2026-07-10T00:00:00Z', createdAt: '2026-06-01T15:00:00Z' }
];

const initLocalStorage = () => {
  if (!localStorage.getItem('erp_users')) localStorage.setItem('erp_users', JSON.stringify(DEFAULT_USERS));
  if (!localStorage.getItem('erp_customers')) localStorage.setItem('erp_customers', JSON.stringify(DEFAULT_CUSTOMERS));
  if (!localStorage.getItem('erp_pos')) localStorage.setItem('erp_pos', JSON.stringify(DEFAULT_POS));
  if (!localStorage.getItem('erp_designs')) localStorage.setItem('erp_designs', JSON.stringify(DEFAULT_DESIGNS));
  if (!localStorage.getItem('erp_inventory')) localStorage.setItem('erp_inventory', JSON.stringify(DEFAULT_INVENTORY));
  if (!localStorage.getItem('erp_suppliers')) localStorage.setItem('erp_suppliers', JSON.stringify(DEFAULT_SUPPLIERS));
  if (!localStorage.getItem('erp_purchase_orders')) localStorage.setItem('erp_purchase_orders', JSON.stringify(DEFAULT_PURCHASE_ORDERS));
  if (!localStorage.getItem('erp_production_commands')) localStorage.setItem('erp_production_commands', JSON.stringify(DEFAULT_PRODUCTION_COMMANDS));
  if (!localStorage.getItem('erp_deliveries')) localStorage.setItem('erp_deliveries', JSON.stringify(DEFAULT_DELIVERIES));
  if (!localStorage.getItem('erp_invoices')) localStorage.setItem('erp_invoices', JSON.stringify(DEFAULT_INVOICES));
};

initLocalStorage();

const subscribers: { [collection: string]: Function[] } = {};

const triggerSubscribers = (colName: string) => {
  const data = JSON.parse(localStorage.getItem(`erp_${colName}`) || '[]');
  if (subscribers[colName]) {
    subscribers[colName].forEach(cb => cb(data));
  }
};

// ----------------------------------------------------
// DB SERVICE WRAPPER (Firestore or Mock DB)
// ----------------------------------------------------
export const dbService = {
  async getCollection(colName: string): Promise<any[]> {
    if (isFirebaseConfigured && realDb) {
      try {
        const snap = await getDocs(collection(realDb, colName));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error(`Error fetching collection ${colName}:`, err);
      }
    }
    const data = localStorage.getItem(`erp_${colName}`);
    return data ? JSON.parse(data) : [];
  },

  async getDocument(colName: string, docId: string): Promise<any | null> {
    if (isFirebaseConfigured && realDb) {
      try {
        const snap = await getDoc(doc(realDb, colName, docId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
      } catch (err) {
        console.error(`Error fetching doc ${docId}:`, err);
      }
    }
    const list = await this.getCollection(colName);
    return list.find((item: any) => item.id === docId) || null;
  },

  async addDocument(colName: string, docData: any): Promise<any> {
    const docId = docData.id || `${colName.substring(0, 3)}-${Math.random().toString(36).substr(2, 9)}`;
    const finalDoc = {
      ...docData,
      id: docId,
      createdAt: docData.createdAt || new Date().toISOString()
    };

    if (isFirebaseConfigured && realDb) {
      try {
        await setDoc(doc(realDb, colName, docId), finalDoc);
        return finalDoc;
      } catch (err) {
        console.error(`Error saving doc to Firestore:`, err);
      }
    }

    const list = await this.getCollection(colName);
    list.unshift(finalDoc);
    localStorage.setItem(`erp_${colName}`, JSON.stringify(list));
    triggerSubscribers(colName);
    return finalDoc;
  },

  async updateDocument(colName: string, docId: string, updatedFields: any): Promise<boolean> {
    if (isFirebaseConfigured && realDb) {
      try {
        await updateDoc(doc(realDb, colName, docId), {
          ...updatedFields,
          updatedAt: new Date().toISOString()
        });
        return true;
      } catch (err) {
        console.error(`Error updating doc in Firestore:`, err);
      }
    }

    const list = await this.getCollection(colName);
    const index = list.findIndex((item: any) => item.id === docId);
    if (index !== -1) {
      list[index] = { ...list[index], ...updatedFields, updatedAt: new Date().toISOString() };
      localStorage.setItem(`erp_${colName}`, JSON.stringify(list));
      triggerSubscribers(colName);
      return true;
    }
    return false;
  },

  async deleteDocument(colName: string, docId: string): Promise<boolean> {
    if (isFirebaseConfigured && realDb) {
      try {
        await deleteDoc(doc(realDb, colName, docId));
        return true;
      } catch (err) {
        console.error(`Error deleting doc in Firestore:`, err);
      }
    }

    const list = await this.getCollection(colName);
    const filtered = list.filter((item: any) => item.id !== docId);
    if (filtered.length !== list.length) {
      localStorage.setItem(`erp_${colName}`, JSON.stringify(filtered));
      triggerSubscribers(colName);
      return true;
    }
    return false;
  },

  subscribeCollection(colName: string, callback: (data: any[]) => void): () => void {
    if (isFirebaseConfigured && realDb) {
      return onSnapshot(collection(realDb, colName), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
      }, (err) => {
        console.error(`Real-time subscription error for ${colName}:`, err);
      });
    }

    if (!subscribers[colName]) {
      subscribers[colName] = [];
    }
    subscribers[colName].push(callback);
    
    // Initial trigger
    const initialData = JSON.parse(localStorage.getItem(`erp_${colName}`) || '[]');
    callback(initialData);

    return () => {
      subscribers[colName] = subscribers[colName].filter(cb => cb !== callback);
    };
  }
};

// ----------------------------------------------------
// AUTH SERVICE WRAPPER (Firebase Auth or Mock Auth)
// ----------------------------------------------------
let authStateListener: ((user: UserProfile | null) => void) | null = null;
let currentUser: UserProfile | null = (() => {
  const stored = localStorage.getItem('erp_current_user');
  return stored ? JSON.parse(stored) : null;
})();

export const authService = {
  async login(email: string, password: string): Promise<UserProfile> {
    if (isFirebaseConfigured && realAuth) {
      const cred = await signInWithEmailAndPassword(realAuth, email, password);
      let userProfile = await dbService.getDocument('users', cred.user.uid);
      if (!userProfile) {
        // If profile doesn't exist in Firestore, create it matching default credentials for testing
        const role = email.split('@')[0];
        const display = email.split('@')[0].toUpperCase();
        userProfile = {
          uid: cred.user.uid,
          email,
          displayName: `User: ${display}`,
          role: ['admin', 'sale', 'designer', 'purchaser', 'producer', 'accountant'].includes(role) ? role : 'sale',
          active: true,
          createdAt: new Date().toISOString()
        };
        await dbService.addDocument('users', userProfile);
      }
      currentUser = userProfile;
      localStorage.setItem('erp_current_user', JSON.stringify(userProfile));
      if (authStateListener) authStateListener(userProfile);
      return userProfile;
    }

    const users = JSON.parse(localStorage.getItem('erp_users') || '[]');
    const user = users.find((u: any) => u.email === email);
    
    if (!user) {
      throw new Error('Email không tồn tại trên hệ thống.');
    }
    const expectedPassword = user.role === 'admin' ? 'admin123' : 
                             user.role === 'sale' ? 'sale123' : 
                             user.role === 'designer' ? 'design123' : 
                             user.role === 'purchaser' ? 'purchase123' : 
                             user.role === 'producer' ? 'produce123' : 'account123';
    
    if (password !== expectedPassword && password !== '123456') {
      throw new Error('Mật khẩu không đúng. Vui lòng thử lại.');
    }

    currentUser = user;
    localStorage.setItem('erp_current_user', JSON.stringify(user));
    if (authStateListener) authStateListener(user);
    return user;
  },

  async logout(): Promise<void> {
    if (isFirebaseConfigured && realAuth) {
      await signOut(realAuth);
    }
    currentUser = null;
    localStorage.removeItem('erp_current_user');
    if (authStateListener) authStateListener(null);
  },

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    if (isFirebaseConfigured && realAuth) {
      return onAuthStateChanged(realAuth, async (firebaseUser) => {
        if (firebaseUser) {
          let profile = await dbService.getDocument('users', firebaseUser.uid);
          if (!profile) {
            const email = firebaseUser.email || 'user@sunflower.com';
            const role = email.split('@')[0];
            profile = {
              uid: firebaseUser.uid,
              email,
              displayName: `User: ${role.toUpperCase()}`,
              role: ['admin', 'sale', 'designer', 'purchaser', 'producer', 'accountant'].includes(role) ? role : 'sale',
              active: true,
              createdAt: new Date().toISOString()
            };
            await dbService.addDocument('users', profile);
          }
          currentUser = profile;
          localStorage.setItem('erp_current_user', JSON.stringify(profile));
          callback(profile);
        } else {
          currentUser = null;
          localStorage.removeItem('erp_current_user');
          callback(null);
        }
      });
    }

    authStateListener = callback;
    callback(currentUser);
    return () => {
      authStateListener = null;
    };
  },

  getCurrentUser(): UserProfile | null {
    return currentUser;
  }
};
export { isFirebaseConfigured };
