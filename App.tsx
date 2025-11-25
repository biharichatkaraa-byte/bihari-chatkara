import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import KDS from './components/KDS';
import Inventory from './components/Inventory';
import StaffManagement from './components/StaffManagement';
import Expenses from './components/Expenses';
import Procurement from './components/Procurement';
import Customers from './components/Customers';
import AiAssistant from './components/AiAssistant';
import Login from './components/Login';
import { Order, OrderStatus, User, UserRole, Ingredient, Expense, RequisitionRequest, RequisitionStatus, MenuItem, Customer, PaymentMethod, PaymentStatus } from './types';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import * as db from './services/db';

const App: React.FC = () => {
  // --- AUTH STATE ---
  // Production Mode: Start with null user to enforce Login
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLive, setIsLive] = useState(db.isDatabaseLive());
  
  // Track connection triggers to re-run subscriptions
  const [connectionTrigger, setConnectionTrigger] = useState(0);

  // --- DATA STATE ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // --- REAL-TIME SUBSCRIPTIONS ---
  useEffect(() => {
    // Determine connection status
    setIsLive(db.isDatabaseLive());

    // Subscribe to all collections
    // NOTE: Fallbacks set to empty arrays [] to ensure NO static data is used.
    const unsubOrders = db.subscribeToCollection('orders', setOrders, []);
    const unsubMenu = db.subscribeToCollection('menuItems', setMenuItems, []);
    const unsubIng = db.subscribeToCollection('ingredients', setIngredients, []);
    const unsubUsers = db.subscribeToCollection('users', setUsers, []);
    const unsubExp = db.subscribeToCollection('expenses', setExpenses, []);
    const unsubReq = db.subscribeToCollection('requisitions', setRequisitions, []);
    const unsubCust = db.subscribeToCollection('customers', setCustomers, []);

    return () => {
        unsubOrders(); unsubMenu(); unsubIng(); unsubUsers(); unsubExp(); unsubReq(); unsubCust();
    };
  }, [connectionTrigger]); // Re-run when connection changes

  // Listen for DB Connection Changes (Hot Swap)
  useEffect(() => {
      const handleDbChange = () => {
          setIsLive(db.isDatabaseLive());
          setConnectionTrigger(prev => prev + 1); // Trigger re-subscription
      };
      window.addEventListener('db-connection-changed', handleDbChange);
      return () => window.removeEventListener('db-connection-changed', handleDbChange);
  }, []);

  // --- HANDLERS ---

  const handleLogin = (user: User) => {
    localStorage.setItem('rms_user', JSON.stringify(user));
    setCurrentUser(user);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('rms_user');
    setCurrentUser(null); 
    setActiveTab('dashboard');
    setIsSidebarOpen(false);
  };

  // Check for existing session
  useEffect(() => {
      const savedUser = localStorage.getItem('rms_user');
      if (savedUser) {
          try {
              setCurrentUser(JSON.parse(savedUser));
          } catch(e) {
              localStorage.removeItem('rms_user');
          }
      }
  }, []);

  // POS Handlers
  const handlePlaceOrder = (order: Order) => {
    db.addItem('orders', order);
  };

  const handleUpdatePayment = (orderId: string, method: PaymentMethod) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedOrder = { ...order, paymentStatus: PaymentStatus.PAID, paymentMethod: method, completedAt: new Date() };
    db.updateItem('orders', updatedOrder);

    // Inventory Deduction
    order.items.forEach(lineItem => {
        const menuItem = menuItems.find(m => m.id === lineItem.menuItemId);
        if (menuItem) {
            menuItem.ingredients.forEach(ingRef => {
                const ingredient = ingredients.find(i => i.id === ingRef.ingredientId);
                if (ingredient) {
                    const newQty = Math.max(0, ingredient.stockQuantity - (ingRef.quantity * lineItem.quantity));
                    db.updateItem('ingredients', { ...ingredient, stockQuantity: newQty });
                }
            });
        }
    });
  };

  // KDS Handlers
  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        db.updateItem('orders', { ...order, status });
    }
  };

  // Inventory Handlers
  const handleUpdateInventory = (updatedIngredients: Ingredient[]) => {
    updatedIngredients.forEach(ing => db.updateItem('ingredients', ing));
  };

  // Menu Handlers
  const handleAddMenuItem = (item: MenuItem) => db.addItem('menuItems', item);
  const handleUpdateMenuItem = (item: MenuItem) => db.updateItem('menuItems', item);
  const handleDeleteMenuItem = (id: string) => db.deleteItem('menuItems', id);
  const handleBulkUpdateMenuItems = (ids: string[], updates: Partial<MenuItem>) => {
      const itemsToUpdate = menuItems.filter(m => ids.includes(m.id)).map(m => ({ ...m, ...updates }));
      db.bulkUpdateItems('menuItems', itemsToUpdate);
  };
  const handleBulkDeleteMenuItems = (ids: string[]) => db.bulkDeleteItems('menuItems', ids);
  const handleBulkAddMenuItems = (items: MenuItem[]) => db.bulkAddItems('menuItems', items);

  // Staff Handlers
  const handleAddUser = (user: User) => db.addItem('users', user);
  const handleDeleteUser = (id: string) => db.deleteItem('users', id);

  // Expense Handlers
  const handleAddExpense = (expense: Expense) => db.addItem('expenses', expense);
  const handleUpdateExpense = (updated: Expense) => db.updateItem('expenses', updated);
  const handleDeleteExpense = (id: string) => db.deleteItem('expenses', id);

  // Procurement Handlers
  const handleAddRequisition = (req: RequisitionRequest) => db.addItem('requisitions', req);
  const handleUpdateRequisition = (id: string, status: RequisitionStatus) => {
      const req = requisitions.find(r => r.id === id);
      if(req) db.updateItem('requisitions', { ...req, status });
  };
  
  const handleReceiveStock = (reqId: string) => {
      const req = requisitions.find(r => r.id === reqId);
      if (req && req.status !== RequisitionStatus.RECEIVED) {
          // 1. Update Request
          db.updateItem('requisitions', { ...req, status: RequisitionStatus.RECEIVED });
          
          // 2. Add to Inventory
          const existingIng = ingredients.find(i => i.id === req.ingredientId);
          if (existingIng) {
              const updatedIng = { ...existingIng, stockQuantity: existingIng.stockQuantity + req.quantity };
              if (req.estimatedUnitCost) updatedIng.unitCost = req.estimatedUnitCost;
              db.updateItem('ingredients', updatedIng);
          } else {
              const newIng: Ingredient = {
                  id: req.ingredientId,
                  name: req.ingredientName,
                  category: 'Uncategorized',
                  unit: req.unit,
                  unitCost: req.estimatedUnitCost || 0,
                  stockQuantity: req.quantity
              };
              db.addItem('ingredients', newIng);
          }

          // 3. Log Expense
          if (req.estimatedUnitCost) {
              const expense: Expense = {
                  id: `e-auto-${Date.now()}`,
                  description: `Procurement: ${req.ingredientName} (${req.quantity} ${req.unit})`,
                  category: 'Inventory',
                  amount: req.estimatedUnitCost * req.quantity,
                  date: new Date(),
                  reportedBy: 'System'
              };
              db.addItem('expenses', expense);
          }
      }
  };

  const handleAddIngredient = (ing: Ingredient) => db.addItem('ingredients', ing);
  const handleBulkAddIngredients = (ings: Ingredient[]) => db.bulkAddItems('ingredients', ings);

  // Customer Handlers
  const handleAddCustomer = (c: Customer) => db.addItem('customers', c);
  const handleDeleteCustomer = (id: string) => db.deleteItem('customers', id);

  // Import/Export (Local Backup)
  const handleExportData = () => {
      const data = {
          timestamp: new Date().toISOString(),
          menuItems,
          ingredients,
          orders,
          expenses,
          users,
          requisitions,
          customers
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bihari_chatkara_backup.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if (confirm("Restore will overwrite current data. Continue?")) {
                  if (data.menuItems) db.bulkAddItems('menuItems', data.menuItems);
                  if (data.ingredients) db.bulkAddItems('ingredients', data.ingredients);
                  // ... map other fields
                  alert('Data restored locally. If connected to Cloud, it will sync shortly.');
              }
          } catch (err) {
              alert('Invalid backup file.');
          }
      };
      reader.readAsText(file);
  };

  // --- RENDER ---

  // If not logged in, show Login Screen
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900 relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden md:ml-64 relative transition-all duration-300">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-30">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600">
                    <Menu size={24} />
                </button>
                <h1 className="font-bold text-lg text-slate-800">Bihari Chatkara</h1>
            </div>
            <div className="flex items-center gap-2">
                 <div className={`p-1 rounded-full ${isLive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                     {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
                 </div>
                 <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                    {currentUser.name.charAt(0)}
                 </div>
            </div>
        </div>

        {/* Live Status Indicator (Desktop) */}
        <div className="hidden md:flex absolute top-4 right-6 z-20 items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs font-bold text-slate-600 transition-all duration-500">
             {isLive ? (
                 <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Connected to Cloud
                 </>
             ) : (
                 <>
                    <WifiOff size={12} className="text-slate-400" />
                    Local Mode
                 </>
             )}
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          {activeTab === 'dashboard' && (
            <Dashboard 
                orders={orders} 
                expenses={expenses} 
                allData={{ menuItems, ingredients }}
                onExportData={handleExportData}
                onImportData={handleImportData}
                userRole={currentUser.role}
            />
          )}
          
          {activeTab === 'pos' && (
            <POS 
                orders={orders} 
                menuItems={menuItems} 
                onPlaceOrder={handlePlaceOrder}
                onUpdatePayment={handleUpdatePayment}
                onUpdateMenuItem={handleUpdateMenuItem}
                currentUserName={currentUser.name}
                userRole={currentUser.role}
            />
          )}
          
          {activeTab === 'kds' && (
            <KDS 
                orders={orders} 
                updateOrderStatus={handleUpdateOrderStatus} 
                userRole={currentUser.role}
                menuItems={menuItems}
            />
          )}
          
          {activeTab === 'inventory' && (
            <Inventory 
                ingredients={ingredients} 
                menuItems={menuItems}
                onSave={handleUpdateInventory}
                onAddMenuItem={handleAddMenuItem}
                onUpdateMenuItem={handleUpdateMenuItem}
                onDeleteMenuItem={handleDeleteMenuItem}
                onBulkUpdateMenuItems={handleBulkUpdateMenuItems}
                onBulkDeleteMenuItems={handleBulkDeleteMenuItems}
                onBulkAddMenuItems={handleBulkAddMenuItems}
            />
          )}

          {activeTab === 'staff' && (
            <StaffManagement 
                users={users} 
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses 
                expenses={expenses}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
                currentUser={currentUser}
            />
          )}

          {activeTab === 'procurement' && (
              <Procurement 
                ingredients={ingredients}
                requests={requisitions}
                currentUser={currentUser}
                onRequestAdd={handleAddRequisition}
                onRequestUpdate={handleUpdateRequisition}
                onReceiveItem={handleReceiveStock}
                onAddIngredient={handleAddIngredient}
                onBulkAddIngredients={handleBulkAddIngredients}
              />
          )}

          {activeTab === 'customers' && (
              <Customers 
                  customers={customers}
                  onAddCustomer={handleAddCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
              />
          )}
        </div>
        
        <AiAssistant 
            contextData={{
                stats: {
                    revenue: orders.reduce((acc, o) => acc + (o.paymentStatus === 'PAID' ? o.items.reduce((s, i) => s + (i.priceAtOrder * i.quantity), 0) : 0), 0),
                    activeOrders: orders.filter(o => o.status !== 'SERVED').length,
                    lowStockItems: ingredients.filter(i => i.stockQuantity < 50).map(i => i.name)
                },
                menu: menuItems.map(m => m.name),
                inventoryCount: ingredients.length
            }}
        />
      </main>
    </div>
  );
};

export default App;