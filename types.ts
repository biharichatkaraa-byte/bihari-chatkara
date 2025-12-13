
// Enums for Statuses
export enum OrderStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ONLINE = 'ONLINE',
  PAYTM_POS = 'PAYTM_POS',
}

export enum UserRole {
  MANAGER = 'Manager',
  SERVER = 'Server',
  CHEF = 'Chef',
  BARTENDER = 'Bartender',
}

export enum RequisitionStatus {
  PENDING = 'PENDING',
  ORDERED = 'ORDERED', // Admin has placed order with supplier
  RECEIVED = 'RECEIVED', // Item has arrived and added to inventory
  REJECTED = 'REJECTED',
}

export enum RequisitionUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Data Models
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added password field
  role: UserRole;
  permissions?: string[]; // List of module IDs (e.g., 'pos', 'kds')
}

export interface Ingredient {
  id: string;
  name: string;
  category?: string; // e.g., Meat, Dairy, Produce
  unit: string;
  unitCost: number; // Cost per unit
  stockQuantity: number;
  barcode?: string; // New field for scanning
}

export interface MenuItemIngredient {
  ingredientId: string;
  quantity: number; // Amount needed for the recipe
}

export interface MenuItem {
  id: string;
  categoryId?: string; // New field for bulk mapping
  subCategoryId?: string; // New field for bulk mapping
  name: string;
  category: string; // Display category name
  subCategory?: string; // Display sub-category name
  price: number; // Base price (usually Full)
  portionPrices?: {
      quarter?: number;
      half?: number;
      full?: number;
  };
  isVeg?: boolean; // True = Veg, False = Non-Veg
  ingredients: MenuItemIngredient[];
  description?: string;
  tags?: string[]; // e.g., 'Gluten Free', 'Spicy'
  available?: boolean; // New field for Out of Stock management
}

export interface LineItem {
  id: string;
  menuItemId: string;
  name?: string; // Snapshot of item name at time of order (Crucial for Custom Items)
  quantity: number;
  modifiers?: string[]; // e.g., "No onions"
  portion?: string; // e.g., "Full", "Half", "Quarter"
  priceAtOrder: number;
}

export interface Order {
  id: string;
  tableNumber: number;
  serverName: string;
  items: LineItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  createdAt: Date;
  completedAt?: Date;
  taxRate?: number; // Percentage
  discount?: number; // Flat amount
}

export interface EmployeeShift {
  id: string;
  employeeName: string;
  role: UserRole;
  startTime: Date;
  endTime?: Date;
  hourlyWage: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  reportedBy: string;
  receiptImage?: string; // Base64 encoded image string
}

export interface RequisitionRequest {
  id: string;
  ingredientId: string;
  ingredientName: string; // Snapshot in case ingredient is deleted
  quantity: number;
  unit: string;
  urgency: RequisitionUrgency;
  status: RequisitionStatus;
  requestedBy: string;
  requestedAt: Date;
  notes?: string;
  estimatedUnitCost?: number; // For custom items or price overrides
  preferredSupplier?: string; // Chef can suggest a supplier link
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  totalVisits: number;
  lastVisit: Date;
  notes?: string;
}
