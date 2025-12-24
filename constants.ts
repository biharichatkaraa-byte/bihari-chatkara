
import { Ingredient, MenuItem, Order, OrderStatus, PaymentStatus, PaymentMethod, UserRole, EmployeeShift, User, Expense, RequisitionRequest, RequisitionStatus, RequisitionUrgency, Customer } from './types';

export const APP_DATA_VERSION = "2.3.9"; 

// --- MASTER DATA (The Source of Truth / Fallback) ---

export const INGREDIENTS: Ingredient[] = [
  // --- PRODUCE ---
  { id: 'i-onion', name: 'Onion (Red)', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 50 },
  { id: 'i-tomato', name: 'Tomato (Hybrid)', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 40 },
  { id: 'i-potato', name: 'Potato', category: 'Produce', unit: 'kg', unitCost: 25.00, stockQuantity: 100 },
  { id: 'i-garlic', name: 'Garlic', category: 'Produce', unit: 'kg', unitCost: 120.00, stockQuantity: 10 },
  { id: 'i-ginger', name: 'Ginger', category: 'Produce', unit: 'kg', unitCost: 80.00, stockQuantity: 8 },
  { id: 'i-coriander', name: 'Coriander Leaves', category: 'Produce', unit: 'kg', unitCost: 60.00, stockQuantity: 5 },
  { id: 'i-lemon', name: 'Lemon', category: 'Produce', unit: 'pc', unitCost: 5.00, stockQuantity: 100 },
  { id: 'i-grn-chilli', name: 'Green Chilli', category: 'Produce', unit: 'kg', unitCost: 60.00, stockQuantity: 5 },
  { id: 'i-capsicum', name: 'Capsicum (Green)', category: 'Produce', unit: 'kg', unitCost: 50.00, stockQuantity: 15 },
  { id: 'i-cucumber', name: 'Cucumber', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 20 },
  { id: 'i-mint', name: 'Mint Leaves', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 2 },
  { id: 'i-spinach', name: 'Spinach (Palak)', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 10 },
  { id: 'i-carrot', name: 'Carrot', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 15 },
  { id: 'i-cabbage', name: 'Cabbage', category: 'Produce', unit: 'kg', unitCost: 20.00, stockQuantity: 20 },
  { id: 'i-cauliflower', name: 'Cauliflower', category: 'Produce', unit: 'kg', unitCost: 35.00, stockQuantity: 15 },

  // --- DAIRY ---
  { id: 'i-milk', name: 'Milk (Full Cream)', category: 'Dairy', unit: 'l', unitCost: 66.00, stockQuantity: 50 },
  { id: 'i-paneer', name: 'Paneer (Cottage Cheese)', category: 'Dairy', unit: 'kg', unitCost: 380.00, stockQuantity: 20 },
  { id: 'i-butter', name: 'Butter (Salted)', category: 'Dairy', unit: 'kg', unitCost: 520.00, stockQuantity: 10 },
  { id: 'i-cream', name: 'Fresh Cream', category: 'Dairy', unit: 'l', unitCost: 220.00, stockQuantity: 10 },
  { id: 'i-curd', name: 'Curd/Yogurt', category: 'Dairy', unit: 'kg', unitCost: 70.00, stockQuantity: 25 },
  { id: 'i-cheese-moz', name: 'Mozzarella Cheese', category: 'Dairy', unit: 'kg', unitCost: 450.00, stockQuantity: 15 },
  { id: 'i-cheese-sl', name: 'Cheese Slices', category: 'Dairy', unit: 'pkt', unitCost: 140.00, stockQuantity: 20 },
  { id: 'i-ghee', name: 'Desi Ghee', category: 'Dairy', unit: 'l', unitCost: 650.00, stockQuantity: 10 },

  // --- PROTEINS ---
  { id: 'i-chk-breast', name: 'Chicken Breast (Boneless)', category: 'Meat', unit: 'kg', unitCost: 280.00, stockQuantity: 30 },
  { id: 'i-chk-bone', name: 'Chicken Curry Cut', category: 'Meat', unit: 'kg', unitCost: 220.00, stockQuantity: 40 },
  { id: 'i-mutton', name: 'Mutton (Goat)', category: 'Meat', unit: 'kg', unitCost: 750.00, stockQuantity: 10 },
  { id: 'i-fish-basa', name: 'Fish Fillet (Basa)', category: 'Meat', unit: 'kg', unitCost: 350.00, stockQuantity: 15 },
  { id: 'i-eggs', name: 'Eggs', category: 'Meat', unit: 'tray', unitCost: 180.00, stockQuantity: 20 },

  // --- PANTRY & GRAINS ---
  { id: 'i-rice-bas', name: 'Rice (Basmati)', category: 'Pantry', unit: 'kg', unitCost: 90.00, stockQuantity: 100 },
  { id: 'i-rice-sona', name: 'Rice (Sona Masoori)', category: 'Pantry', unit: 'kg', unitCost: 55.00, stockQuantity: 100 },
  { id: 'i-atta', name: 'Wheat Flour (Atta)', category: 'Pantry', unit: 'kg', unitCost: 40.00, stockQuantity: 100 },
  { id: 'i-maida', name: 'Refined Flour (Maida)', category: 'Pantry', unit: 'kg', unitCost: 35.00, stockQuantity: 50 },
  { id: 'i-besan', name: 'Gram Flour (Besan)', category: 'Pantry', unit: 'kg', unitCost: 80.00, stockQuantity: 20 },
  { id: 'i-cornflour', name: 'Corn Flour', category: 'Pantry', unit: 'kg', unitCost: 60.00, stockQuantity: 10 },
  { id: 'i-sugar', name: 'Sugar', category: 'Pantry', unit: 'kg', unitCost: 42.00, stockQuantity: 50 },
  { id: 'i-salt', name: 'Salt', category: 'Pantry', unit: 'kg', unitCost: 20.00, stockQuantity: 50 },
  { id: 'i-oil-must', name: 'Mustard Oil', category: 'Pantry', unit: 'l', unitCost: 160.00, stockQuantity: 50 },
  { id: 'i-oil-ref', name: 'Refined Oil', category: 'Pantry', unit: 'l', unitCost: 130.00, stockQuantity: 100 },
  { id: 'i-dal-toor', name: 'Toor Dal', category: 'Pantry', unit: 'kg', unitCost: 140.00, stockQuantity: 30 },
  { id: 'i-dal-moong', name: 'Moong Dal (Yellow)', category: 'Pantry', unit: 'kg', unitCost: 110.00, stockQuantity: 20 },
  { id: 'i-dal-urad', name: 'Urad Dal (Whole)', category: 'Pantry', unit: 'kg', unitCost: 130.00, stockQuantity: 20 },
  { id: 'i-chana', name: 'Kabuli Chana', category: 'Pantry', unit: 'kg', unitCost: 100.00, stockQuantity: 20 },
  { id: 'i-rajma', name: 'Rajma (Kidney Beans)', category: 'Pantry', unit: 'kg', unitCost: 120.00, stockQuantity: 20 },

  // --- SPICES ---
  { id: 'i-jeera', name: 'Cumin Seeds (Jeera)', category: 'Spices', unit: 'kg', unitCost: 400.00, stockQuantity: 5 },
  { id: 'i-mustard-sd', name: 'Mustard Seeds (Rai)', category: 'Spices', unit: 'kg', unitCost: 150.00, stockQuantity: 5 },
  { id: 'i-haldi', name: 'Turmeric Powder', category: 'Spices', unit: 'kg', unitCost: 200.00, stockQuantity: 10 },
  { id: 'i-red-chilli', name: 'Red Chilli Powder', category: 'Spices', unit: 'kg', unitCost: 300.00, stockQuantity: 10 },
  { id: 'i-dhaniya-pw', name: 'Coriander Powder', category: 'Spices', unit: 'kg', unitCost: 200.00, stockQuantity: 10 },
  { id: 'i-garam-masala', name: 'Garam Masala', category: 'Spices', unit: 'kg', unitCost: 600.00, stockQuantity: 5 },
  { id: 'i-cardamom', name: 'Cardamom (Green)', category: 'Spices', unit: 'kg', unitCost: 2500.00, stockQuantity: 1 },
  { id: 'i-cloves', name: 'Cloves (Laung)', category: 'Spices', unit: 'kg', unitCost: 1200.00, stockQuantity: 1 },
  { id: 'i-cinnamon', name: 'Cinnamon Sticks', category: 'Spices', unit: 'kg', unitCost: 800.00, stockQuantity: 1 },
  { id: 'i-bay-leaf', name: 'Bay Leaf (Tej Patta)', category: 'Spices', unit: 'kg', unitCost: 300.00, stockQuantity: 2 },
  { id: 'i-blk-pepper', name: 'Black Pepper (Whole)', category: 'Spices', unit: 'kg', unitCost: 600.00, stockQuantity: 2 },
  { id: 'i-chaat-masala', name: 'Chaat Masala', category: 'Spices', unit: 'kg', unitCost: 350.00, stockQuantity: 5 },
  { id: 'i-kasuri', name: 'Kasuri Methi', category: 'Spices', unit: 'kg', unitCost: 400.00, stockQuantity: 2 },

  // --- SAUCES & CONDIMENTS ---
  { id: 'i-soy', name: 'Dark Soy Sauce', category: 'Condiments', unit: 'l', unitCost: 80.00, stockQuantity: 10 },
  { id: 'i-vinegar', name: 'White Vinegar', category: 'Condiments', unit: 'l', unitCost: 40.00, stockQuantity: 10 },
  { id: 'i-chilli-sauce', name: 'Green Chilli Sauce', category: 'Condiments', unit: 'l', unitCost: 60.00, stockQuantity: 10 },
  { id: 'i-ketchup', name: 'Tomato Ketchup', category: 'Condiments', unit: 'kg', unitCost: 120.00, stockQuantity: 15 },
  { id: 'i-mayo', name: 'Mayonnaise', category: 'Condiments', unit: 'kg', unitCost: 150.00, stockQuantity: 10 },
  
  // --- BEVERAGES & OTHERS ---
  { id: 'i-tea', name: 'Tea Leaves', category: 'Beverages', unit: 'kg', unitCost: 450.00, stockQuantity: 10 },
  { id: 'i-coffee', name: 'Coffee Powder', category: 'Beverages', unit: 'kg', unitCost: 800.00, stockQuantity: 5 },
  { id: 'i-water', name: 'Mineral Water (1L)', category: 'Beverages', unit: 'crate', unitCost: 120.00, stockQuantity: 50 },
  { id: 'i-soda', name: 'Soda (600ml)', category: 'Beverages', unit: 'crate', unitCost: 400.00, stockQuantity: 20 },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    categoryId: 'c1',
    subCategoryId: 'sc1',
    name: 'Classic Cheeseburger',
    category: 'Burgers',
    price: 349.00,
    portionPrices: { full: 349.00, half: 199.00 },
    isVeg: false,
    ingredients: [
      { ingredientId: 'i-onion', quantity: 0.1 },
      { ingredientId: 'i-tomato', quantity: 0.1 },
      { ingredientId: 'i-cheese-sl', quantity: 1 },
    ],
    tags: ['Popular'],
    description: 'Juicy beef patty with melted cheddar.',
    available: true,
  },
  {
    id: 'm2',
    categoryId: 'c2',
    subCategoryId: 'sc2',
    name: 'Butter Chicken',
    category: 'Mains',
    price: 429.00,
    portionPrices: { full: 429.00, half: 249.00 },
    isVeg: false,
    ingredients: [
      { ingredientId: 'i-chk-bone', quantity: 0.25 },
      { ingredientId: 'i-butter', quantity: 0.05 },
      { ingredientId: 'i-cream', quantity: 0.02 },
      { ingredientId: 'i-tomato', quantity: 0.2 },
    ],
    tags: ['Bestseller'],
    description: 'Rich and creamy chicken curry.',
    available: true,
  },
  {
    id: 'm3',
    categoryId: 'c3',
    subCategoryId: 'sc3',
    name: 'Paneer Tikka',
    category: 'Starters',
    price: 299.00,
    portionPrices: { full: 299.00 },
    isVeg: true,
    ingredients: [
      { ingredientId: 'i-paneer', quantity: 0.2 },
      { ingredientId: 'i-capsicum', quantity: 0.05 },
      { ingredientId: 'i-onion', quantity: 0.05 },
      { ingredientId: 'i-curd', quantity: 0.05 },
    ],
    tags: ['Tandoor', 'Veg'],
    description: 'Spiced paneer cubes grilled in tandoor.',
    available: true,
  },
];

// Seeded Orders for Testing
export const INITIAL_ORDERS: Order[] = [
  {
    id: 'o-seed-1',
    tableNumber: 5,
    serverName: 'Demo Server',
    items: [
      { id: 'l-1', menuItemId: 'm1', name: 'Classic Cheeseburger', quantity: 2, priceAtOrder: 349, portion: 'Full' },
      { id: 'l-2', menuItemId: 'i-soda', name: 'Soda (600ml)', quantity: 2, priceAtOrder: 60, portion: 'Full' }
    ],
    status: OrderStatus.SERVED,
    paymentStatus: PaymentStatus.PAID,
    // Fix: Changed PAYTM_POS to POS to match the enum definition in types.ts.
    paymentMethod: PaymentMethod.POS,
    createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
    taxRate: 5,
    discount: 0
  },
  {
    id: 'o-seed-2',
    tableNumber: 12,
    serverName: 'Demo Server',
    items: [
      { id: 'l-3', menuItemId: 'm2', name: 'Butter Chicken', quantity: 1, priceAtOrder: 429, portion: 'Full' }
    ],
    status: OrderStatus.IN_PROGRESS,
    paymentStatus: PaymentStatus.PENDING,
    createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
    taxRate: 5,
    discount: 0
  }
];

export const SHIFTS: EmployeeShift[] = [];
// MOCK_USERS cleared to enforce DB usage. Admin is seeded by server.js.
export const MOCK_USERS: User[] = []; 
export const MOCK_EXPENSES: Expense[] = [];
export const INITIAL_REQUISITIONS: RequisitionRequest[] = [];
export const MOCK_CUSTOMERS: Customer[] = [];
