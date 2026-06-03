import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  setDoc 
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Parse .env file
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const config = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    config[key] = value.trim();
  }
});

const firebaseConfig = {
  apiKey: config['VITE_FIREBASE_API_KEY'],
  authDomain: config['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: config['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: config['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: config['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: config['VITE_FIREBASE_APP_ID']
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_USERS = [
  { uid: 'u-admin', email: 'admin@sunflower.com', displayName: 'Giám Đốc Lê Minh', role: 'admin', active: true, createdAt: '2026-05-01' },
  { uid: 'u-sale', email: 'sale@sunflower.com', displayName: 'Sale Nguyễn Văn Nam', role: 'sale', active: true, createdAt: '2026-05-01' },
  { uid: 'u-designer', email: 'designer@sunflower.com', displayName: 'Designer Trần Hà', role: 'designer', active: true, createdAt: '2026-05-01' },
  { uid: 'u-purchaser', email: 'purchase@sunflower.com', displayName: 'Mua Hàng Phạm Đức', role: 'purchaser', active: true, createdAt: '2026-05-01' },
  { uid: 'u-producer', email: 'produce@sunflower.com', displayName: 'Quản Đốc Vũ Thành', role: 'producer', active: true, createdAt: '2026-05-01' },
  { uid: 'u-accountant', email: 'accountant@sunflower.com', displayName: 'Kế Toán Trần Thu', role: 'accountant', active: true, createdAt: '2026-05-01' },
];

const DEFAULT_INVENTORY = [
  { id: 'inv-001', materialName: 'Decal Giấy Fasson AW0339F', category: 'paper', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 200, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: new Date().toISOString() },
  { id: 'inv-002', materialName: 'Decal Nhựa PVC Avery Dennison', category: 'paper', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 100, unit: 'm²', defaultSupplierId: 'sup-002', updatedAt: new Date().toISOString() },
  { id: 'inv-003', materialName: 'Mực Flexo DIC Process Black', category: 'ink', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: new Date().toISOString() },
  { id: 'inv-004', materialName: 'Mực Flexo DIC Process Cyan', category: 'ink', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 10, unit: 'kg', defaultSupplierId: 'sup-003', updatedAt: new Date().toISOString() },
  { id: 'inv-005', materialName: 'Màng BOPP bóng 12mic', category: 'film', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 300, unit: 'm²', defaultSupplierId: 'sup-001', updatedAt: new Date().toISOString() },
  { id: 'inv-006', materialName: 'Lõi Giấy phi 76mm', category: 'others', qtyInStock: 0, qtyReserved: 0, minQtyAlert: 50, unit: 'cuộn', defaultSupplierId: 'sup-004', updatedAt: new Date().toISOString() },
];

const clearCollection = async (colName) => {
  console.log(`Clearing collection: ${colName}...`);
  const snap = await getDocs(collection(db, colName));
  for (const document of snap.docs) {
    await deleteDoc(doc(db, colName, document.id));
  }
  console.log(`Collection ${colName} cleared.`);
};

const run = async () => {
  try {
    // Clear collections
    const collectionsToClear = [
      'customers',
      'pos',
      'designs',
      'suppliers',
      'purchase_orders',
      'production_commands',
      'deliveries',
      'invoices'
    ];
    for (const col of collectionsToClear) {
      await clearCollection(col);
    }

    // Reset Inventory to clean 0-stock catalog
    await clearCollection('inventory');
    console.log("Seeding fresh inventory catalog with 0 stock...");
    for (const item of DEFAULT_INVENTORY) {
      await setDoc(doc(db, 'inventory', item.id), item);
    }
    console.log("Inventory catalog seeded.");

    // Reset users
    await clearCollection('users');
    console.log("Seeding default users...");
    for (const defUser of DEFAULT_USERS) {
      await setDoc(doc(db, 'users', defUser.uid), defUser);
    }
    console.log("Default users seeded.");

    console.log("Firestore successfully cleared and initialized for real testing.");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
};

run();
