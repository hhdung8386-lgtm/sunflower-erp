import { initializeApp, getApps, getApp } from 'firebase/app';
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

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    realDb = getFirestore(app);
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
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
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
  { uid: 'u-accountant', email: 'accountant@sunflower.com', displayName: 'Kế Toán Trần Thu', role: 'accountant', active: true, createdAt: '2026-05-01' }
];

const DEFAULT_CUSTOMERS: any[] = [];

const MOCK_BASE64_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="%23eff6ff" stroke="%231e3a8a" stroke-width="2"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%231e3a8a" font-weight="bold">MẪU THIẾT KẾ</svg>';

const DEFAULT_POS: any[] = [];

const DEFAULT_DESIGNS: any[] = [];

const DEFAULT_INVENTORY = [
  { id: 'inv-001', materialName: 'Decal Giấy Fasson AW0339F', category: 'paper', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 200, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-002', materialName: 'Decal Nhựa PVC Avery Dennison', category: 'paper', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 100, unit: 'm²', defaultSupplierId: 'sup-002', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-003', materialName: 'Mực Flexo DIC Process Black', category: 'ink', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-004', materialName: 'Mực Flexo DIC Process Cyan', category: 'ink', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-005', materialName: 'Màng BOPP bóng 12mic', category: 'film', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 300, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'inv-006', materialName: 'Lõi Giấy phi 76mm', category: 'others', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 50, unit: 'cuộn', defaultSupplierId: 'sup-004', updatedAt: '2026-06-01T08:00:00Z' },
];

const DEFAULT_SUPPLIERS: any[] = [];

const DEFAULT_PURCHASE_ORDERS: any[] = [];

const DEFAULT_PRODUCTION_COMMANDS: any[] = [];

const DEFAULT_DELIVERIES: any[] = [];

const DEFAULT_INVOICES: any[] = [];

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

const seedFirestoreIfNeeded = async () => {
  if (!isFirebaseConfigured || !realDb) return;
  try {
    // 1. Seed users
    const usersSnap = await getDocs(collection(realDb, 'users'));
    const existingUsers = usersSnap.docs.map(doc => doc.data());
    for (const defUser of DEFAULT_USERS) {
      if (!existingUsers.some((u: any) => u.email.toLowerCase() === defUser.email.toLowerCase())) {
        await setDoc(doc(realDb, 'users', defUser.uid), defUser);
      }
    }

    // 2. Seed other collections if they are completely empty
    const checkAndSeed = async (colName: string, defaults: any[]) => {
      const snap = await getDocs(collection(realDb, colName));
      if (snap.empty && defaults.length > 0) {
        for (const item of defaults) {
          const docId = item.id || `${colName.substring(0, 3)}-${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(realDb, colName, docId), { ...item, id: docId });
        }
      }
    };

    await checkAndSeed('customers', DEFAULT_CUSTOMERS);
    await checkAndSeed('pos', DEFAULT_POS);
    await checkAndSeed('designs', DEFAULT_DESIGNS);
    await checkAndSeed('inventory', DEFAULT_INVENTORY);
    await checkAndSeed('suppliers', DEFAULT_SUPPLIERS);
    await checkAndSeed('purchase_orders', DEFAULT_PURCHASE_ORDERS);
    await checkAndSeed('production_commands', DEFAULT_PRODUCTION_COMMANDS);
    await checkAndSeed('deliveries', DEFAULT_DELIVERIES);
    await checkAndSeed('invoices', DEFAULT_INVOICES);

    console.log("Firestore successfully seeded with default data.");
  } catch (error) {
    console.error("Error seeding Firestore:", error);
  }
};

seedFirestoreIfNeeded();

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
// AUTH SERVICE WRAPPER (Client-side bypass + Firestore sync)
// ----------------------------------------------------
let authStateListener: ((user: UserProfile | null) => void) | null = null;
let currentUser: UserProfile | null = (() => {
  const stored = localStorage.getItem('erp_current_user');
  return stored ? JSON.parse(stored) : null;
})();

export const authService = {
  async login(identifier: string, password: string): Promise<UserProfile> {
    const searchIdentifier = identifier.toLowerCase().trim();
    // Fetch users from database (Firestore or localStorage)
    const dbUsers = await dbService.getCollection('users');
    let user = dbUsers.find((u: any) => 
      u.email.toLowerCase() === searchIdentifier || 
      u.email.toLowerCase().split('@')[0] === searchIdentifier
    );
    
    // Fallback if user is in DEFAULT_USERS but not yet initialized in Firestore
    if (!user) {
      const defaultUser = DEFAULT_USERS.find((u: any) => 
        u.email.toLowerCase() === searchIdentifier || 
        u.email.toLowerCase().split('@')[0] === searchIdentifier
      );
      if (defaultUser) {
        user = await dbService.addDocument('users', defaultUser);
      }
    }
    
    if (!user) {
      throw new Error('Tài khoản không tồn tại trên hệ thống.');
    }
    
    // Check if account is active
    if (user.active === false) {
      throw new Error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Giám đốc.');
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
    currentUser = null;
    localStorage.removeItem('erp_current_user');
    if (authStateListener) authStateListener(null);
  },

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
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
