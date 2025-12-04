
import { Ingredient, MenuItem, Order, OrderStatus, PaymentStatus, PaymentMethod, UserRole, EmployeeShift, User, Expense, RequisitionRequest, RequisitionStatus, RequisitionUrgency, Customer } from './types';

export const APP_DATA_VERSION = "2.3.3"; 

// --- MASTER DATA (The Source of Truth / Fallback) ---

export const INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Beef Patty (4oz)', category: 'Meat', unit: 'piece', unitCost: 60.00, stockQuantity: 200 },
  { id: 'i2', name: 'Brioche Bun', category: 'Bakery', unit: 'piece', unitCost: 15.00, stockQuantity: 150 },
  { id: 'i3', name: 'Cheddar Slice', category: 'Dairy', unit: 'slice', unitCost: 12.00, stockQuantity: 300 },
  { id: 'i4', name: 'Lettuce', category: 'Produce', unit: 'leaf', unitCost: 4.00, stockQuantity: 500 },
  { id: 'i5', name: 'Tomato', category: 'Produce', unit: 'slice', unitCost: 6.00, stockQuantity: 400 },
  { id: 'i6', name: 'French Fries', category: 'Frozen', unit: 'oz', unitCost: 8.00, stockQuantity: 1000 },
  { id: 'i7', name: 'Chicken Breast', category: 'Meat', unit: 'piece', unitCost: 75.00, stockQuantity: 80 },
  { id: 'i8', name: 'Pasta', category: 'Pantry', unit: 'oz', unitCost: 5.00, stockQuantity: 500 },
  { id: 'i9', name: 'Marinara Sauce', category: 'Pantry', unit: 'oz', unitCost: 10.00, stockQuantity: 300 },
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
      { ingredientId: 'i1', quantity: 1 },
      { ingredientId: 'i2', quantity: 1 },
      { ingredientId: 'i3', quantity: 1 },
      { ingredientId: 'i4', quantity: 1 },
      { ingredientId: 'i5', quantity: 2 },
    ],
    tags: ['Popular'],
    description: 'Juicy beef patty with melted cheddar.',
    available: true,
  },
  {
    id: 'm2',
    categoryId: 'c2',
    subCategoryId: 'sc2',
    name: 'Chicken Pasta',
    category: 'Mains',
    price: 429.00,
    portionPrices: { full: 429.00, half: 249.00, quarter: 149.00 },
    isVeg: false,
    ingredients: [
      { ingredientId: 'i7', quantity: 1 },
      { ingredientId: 'i8', quantity: 6 },
      { ingredientId: 'i9', quantity: 4 },
    ],
    tags: [],
    description: 'Grilled chicken over pasta with marinara.',
    available: true,
  },
  {
    id: 'm3',
    categoryId: 'c3',
    subCategoryId: 'sc3',
    name: 'Fries Basket',
    category: 'Sides',
    price: 149.00,
    portionPrices: { full: 149.00 },
    isVeg: true,
    ingredients: [
      { ingredientId: 'i6', quantity: 10 },
    ],
    tags: ['Vegan', 'GF'],
    description: 'Crispy golden french fries.',
    available: true,
  },
];

export const INITIAL_ORDERS: Order[] = [];
export const SHIFTS: EmployeeShift[] = [];
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@biharichatkara.com', role: UserRole.MANAGER },
  { id: 'u2', name: 'Head Chef', email: 'chef@biharichatkara.com', role: UserRole.CHEF },
];
export const MOCK_EXPENSES: Expense[] = [];
export const INITIAL_REQUISITIONS: RequisitionRequest[] = [];
export const MOCK_CUSTOMERS: Customer[] = [];
