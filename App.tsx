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
import Settings from './components/Settings';
import OrderHistory from './components/OrderHistory';
import Login from './components/Login';
import AiAssistant from './components/AiAssistant';
import { Order, OrderStatus, User, UserRole, Ingredient, Expense, RequisitionRequest, RequisitionStatus, MenuItem, Customer, PaymentMethod, PaymentStatus, LineItem } from './types';
import { Menu, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import * as db from './services/db';
import { APP_DATA_VERSION } from './constants';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLive, setIsLive] = useState(db.isDatabaseLive());
  
  // Track connection triggers to re-run subscriptions
  const [connectionTrigger, setConnectionTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- DATA STATE ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // --- ORIENTATION LOCK ---
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // @ts-ignore
        if (window.screen?.orientation?.lock) {
          // @ts-ignore
          await window.screen.orientation.lock('portrait');
        }
      } catch (e) {
        console.debug("Screen orientation lock skipped or not supported.");
      }
    };
    lockOrientation();
  }, []);

  // --- REAL-TIME SUBSCRIPTIONS ---
  useEffect(() => {
    setIsLive(db.isDatabaseLive());
    console.log(`[System] Booting Bihari Chatkara RMS v${APP_DATA_VERSION}...`);

    const unsubOrders = db.subscribeToCollection('orders', setOrders, []);
    const unsubMenu = db.subscribeToCollection('menuItems', setMenuItems, []);
    const unsubIng = db.subscribeToCollection('ingredients', setIngredients, []);
    const unsubUsers = db.subscribeToCollection('users', setUsers, []);
    const unsubExp = db.subscribeToCollection('expenses', setExpenses, []);
    const unsubReq = db.subscribeToCollection('requisitions', setRequisitions, []);
    const unsubCust = db.subscribeToCollection('customers', setCustomers, []);

    if (isRefreshing) {
        setTimeout(() => setIsRefreshing(false), 500);
    }

    return () => {
        unsubOrders(); unsubMenu(); unsubIng(); unsubUsers(); unsubExp(); unsubReq(); unsubCust();
    };
  }, [connectionTrigger]);

  useEffect(() => {
      const handleDbChange = () => {
          setIsLive(db.isDatabaseLive());
          setConnectionTrigger(prev => prev + 1);
      };
      window.addEventListener('db-connection-changed', handleDbChange);
      return () => window.removeEventListener('db-connection-changed', handleDbChange);
  }, []);

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

  const handleManualRefresh = () => {
      setIsRefreshing(true);
      setConnectionTrigger(prev => prev + 1);
  };

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

  const syncInventory = (itemsToProcess: { menuItemId: string; quantity: number; portion?: string }[], mode: 'deduct' | 'restore' = 'deduct') => {
      if (itemsToProcess.length === 0) return;
      const updates = new Map<string, number>();

      itemsToProcess.forEach(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          if (!menuItem) return;

          let ratio = 1.0;
          if (item.portion === 'Half') ratio = 0.5;
          if (item.portion === 'Quarter') ratio = 0.25;

          if (menuItem.ingredients && menuItem.ingredients.length > 0) {
              menuItem.ingredients.forEach(ingRef => {
                  const amount = ingRef.quantity * item.quantity * ratio;
                  updates.set(ingRef.ingredientId, (updates.get(ingRef.ingredientId) || 0) + amount);
              });
          } else {
              const matchableName = menuItem.name.toLowerCase();
              ingredients.forEach(ing => {
                  const ingName = ing.name.toLowerCase();
                  if (ingName.length > 2 && matchableName.includes(ingName)) {
                      let defaultQty = 1;
                      const unit = ing.unit.toLowerCase();
                      if (['kg', 'l', 'liter', 'litre', 'kgs'].includes(unit)) {
                          defaultQty = 0.25;
                      } else if (['g', 'gm', 'ml', 'gms'].includes(unit)) {
                          defaultQty = 250;
                      }
                      const amount = defaultQty * item.quantity * ratio;
                      updates.set(ing.id, (updates.get(ing.id) || 0) + amount);
                  }
              });
          }
      });

      if (updates.size > 0) {
          const newIngredients = ingredients.map(ing => {
              if (updates.has(ing.id)) {
                  const changeAmount = updates.get(ing.id)!;
                  let newQty = ing.stockQuantity;
                  if (mode === 'deduct') {
                      newQty = Math.max(0, ing.stockQuantity - changeAmount);
                  } else {
                      newQty = ing.stockQuantity + changeAmount;
                  }
                  return { ...ing, stockQuantity: newQty };
              }
              return ing;
          });
          setIngredients(newIngredients);
          newIngredients.forEach(ing => {
              if (updates.has(ing.id)) {
                  db.updateItem('ingredients', ing);
              }
          });
      }
  };

  const handlePlaceOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
    db.addItem('orders', order);
    syncInventory(order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, portion: i.portion })), 'deduct');
  };

  const handleUpdateOrder = (order: Order) => {
    const oldOrder = orders.find(o => o.id === order.id);
    if (oldOrder) {
        const toDeduct: { menuItemId: string; quantity: number; portion?: string }[] = [];
        const toRestore: { menuItemId: string; quantity: number; portion?: string }[] = [];
        const oldMap = new Map<string, LineItem>();
        oldOrder.items.forEach(i => oldMap.set(i.id, i));
        order.items.forEach(newItem => {
            const oldItem = oldMap.get(newItem.id);
            const oldQty = oldItem ? oldItem.quantity : 0;
            const delta = newItem.quantity - oldQty;
            if (delta > 0) toDeduct.push({ menuItemId: newItem.menuItemId, quantity: delta, portion: newItem.portion });
            else if (delta < 0) toRestore.push({ menuItemId: newItem.menuItemId, quantity: Math.abs(delta), portion: newItem.portion });
            oldMap.delete(newItem.id);
        });
        oldMap.forEach((oldItem) => toRestore.push({ menuItemId: oldItem.menuItemId, quantity: oldItem.quantity, portion: oldItem.portion }));
        syncInventory(toDeduct, 'deduct');
        syncInventory(toRestore, 'restore');
    }
    setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    db.updateItem('orders', order);
  };

  const handleUpdatePayment = (orderId: string, method: PaymentMethod) => {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;
    const order = orders[orderIndex];
    const updatedOrder = { ...order, paymentStatus: PaymentStatus.PAID, paymentMethod: method, completedAt: new Date() };
    const newOrders = [...orders];
    newOrders[orderIndex] = updatedOrder;
    setOrders(newOrders);
    db.updateItem('orders', updatedOrder);
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
            syncInventory(order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, portion: i.portion })), 'restore');
        }
        if (order.status === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED) {
             syncInventory(order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, portion: i.portion })), 'deduct');
        }
        let updated = { ...order, status };
        if ((status === OrderStatus.SERVED || status === OrderStatus.CANCELLED) && !updated.completedAt) {
            updated.completedAt = new Date();
        }
        setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
        db.updateItem('orders', updated);
    }
  };

  const handleUpdateInventory = (updatedIngredients: Ingredient[]) => {
    setIngredients(updatedIngredients);
    updatedIngredients.forEach(ing => db.updateItem('ingredients', ing));
  };
  const handleDeleteIngredient = (id: string) => {
      setIngredients(prev => prev.filter(i => i.id !== id));
      db.deleteItem('ingredients', id);
  }
  const handleAddMenuItem = (item: MenuItem) => {
      setMenuItems(prev => [...prev, item]);
      db.addItem('menuItems', item);
  }
  const handleUpdateMenuItem = (item: MenuItem) => {
      setMenuItems(prev => prev.map(m => m.id === item.id ? item : m));
      db.updateItem('menuItems', item);
  }
  const handleDeleteMenuItem = (id: string) => {
      setMenuItems(prev => prev.filter(m => m.id !== id));
      db.deleteItem('menuItems', id);
  }
  const handleBulkUpdateMenuItems = (ids: string[], updates: Partial<MenuItem>) => {
      setMenuItems(prev => prev.map(m => ids.includes(m.id) ? { ...m, ...updates } : m));
      const itemsToUpdate = menuItems.filter(m => ids.includes(m.id)).map(m => ({ ...m, ...updates }));
      db.bulkUpdateItems('menuItems', itemsToUpdate);
  };
  const handleBulkDeleteMenuItems = (ids: string[]) => {
      setMenuItems(prev => prev.filter(m => !ids.includes(m.id)));
      db.bulkDeleteItems('menuItems', ids);
  }
  const handleBulkAddMenuItems = (items: MenuItem[]) => {
      setMenuItems(prev => [...items, ...prev]);
      db.bulkAddItems('menuItems', items);
  }
  const handleAddUser = (user: User) => {
      setUsers(prev => [...prev, user]);
      db.addItem('users', user);
  }
  const handleDeleteUser = (id: string) => {
      setUsers(prev => prev.filter(u => u.id !== id));
      db.deleteItem('users', id);
  }
  const handleAddExpense = (expense: Expense) => {
      setExpenses(prev => [expense, ...prev]);
      db.addItem('expenses', expense);
  }
  const handleUpdateExpense = (updated: Expense) => {
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
      db.updateItem('expenses', updated);
  }
  const handleDeleteExpense = (id: string) => {
      setExpenses(prev => prev.filter(e => e.id !== id));
      db.deleteItem('expenses', id);
  }
  const handleAddRequisition = (req: RequisitionRequest) => {
      setRequisitions(prev => [req, ...prev]);
      db.addItem('requisitions', req);
  }
  const handleUpdateRequisition = (id: string, status: RequisitionStatus) => {
      const req = requisitions.find(r => r.id === id);
      if(req) {
          const updated = { ...req, status };
          setRequisitions(prev => prev.map(r => r.id === id ? updated : r));
          db.updateItem('requisitions', updated);
      }
  };
  const handleReceiveStock = (reqId: string) => {
      const req = requisitions.find(r => r.id === reqId);
      if (req && req.status !== RequisitionStatus.RECEIVED) {
          const updatedReq = { ...req, status: RequisitionStatus.RECEIVED };
          setRequisitions(prev => prev.map(r => r.id === reqId ? updatedReq : r));
          db.updateItem('requisitions', updatedReq);
          const existingIngIndex = ingredients.findIndex(i => i.id === req.ingredientId);
          if (existingIngIndex >= 0) {
              const existingIng = ingredients[existingIngIndex];
              const updatedIng = { ...existingIng, stockQuantity: existingIng.stockQuantity + req.quantity };
              if (req.estimatedUnitCost) updatedIng.unitCost = req.estimatedUnitCost;
              setIngredients(prev => {
                  const copy = [...prev];
                  copy[existingIngIndex] = updatedIng;
                  return copy;
              });
              db.updateItem('ingredients', updatedIng);
          } else {
              const newIng: Ingredient = { id: req.ingredientId, name: req.ingredientName, category: 'Uncategorized', unit: req.unit, unitCost: req.estimatedUnitCost || 0, stockQuantity: req.quantity };
              setIngredients(prev => [...prev, newIng]);
              db.addItem('ingredients', newIng);
          }
          if (req.estimatedUnitCost) {
              const expense: Expense = { id: `e-auto-${Date.now()}`, description: `Procurement: ${req.ingredientName} (${req.quantity} ${req.unit})`, category: 'Inventory', amount: req.estimatedUnitCost * req.quantity, date: new Date(), reportedBy: 'System' };
              setExpenses(prev => [expense, ...prev]);
              db.addItem('expenses', expense);
          }
      }
  };
  const handleAddIngredient = (ing: Ingredient) => {
      setIngredients(prev => [...prev, ing]);
      db.addItem('ingredients', ing);
  }
  const handleBulkAddIngredients = (ings: Ingredient[]) => {
      setIngredients(prev => [...prev, ...ings]);
      db.bulkAddItems('ingredients', ings);
  }
  const handleAddCustomer = (c: Customer) => {
      setCustomers(prev => [...prev, c]);
      db.addItem('customers', c);
  }
  const handleDeleteCustomer = (id: string) => {
      setCustomers(prev => prev.filter(c => c.id !== id));
      db.deleteItem('customers', id);
  }
  const handleExportData = () => {
      const data = { timestamp: new Date().toISOString(), menuItems, ingredients, orders, expenses, users, requisitions, customers };
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
                  alert('Data restored locally. If connected to Cloud, it will sync shortly.');
                  window.location.reload(); 
              }
          } catch (err) { alert('Invalid backup file.'); }
      };
      reader.readAsText(file);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900 relative">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col h-full overflow-hidden md:ml-64 relative transition-all duration-300">
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-30">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button>
                <h1 className="font-bold text-lg text-slate-800">Bihari Chatkara</h1>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={handleManualRefresh} className={`p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={16} /></button>
                 <div className={`p-1 rounded-full ${isLive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>{isLive ? <Wifi size={16} /> : <WifiOff size={16} />}</div>
                 <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">{currentUser.name.charAt(0)}</div>
            </div>
        </div>
        <div className="hidden md:flex absolute top-4 right-6 z-20 items-center gap-2">
            <button onClick={handleManualRefresh} className="bg-white/80 backdrop-blur-sm p-1.5 rounded-full border border-slate-200 shadow-sm text-slate-500 hover:text-blue-600 transition-colors" title="Refresh Data"><RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /></button>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs font-bold text-slate-600 transition-all duration-500">
                {isLive ? (
                    <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>Connected to Cloud</>
                ) : (
                    <><WifiOff size={12} className="text-slate-400" />Local Mode</>
                )}
            </div>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          {activeTab === 'dashboard' && <Dashboard orders={orders} expenses={expenses} allData={{ menuItems, ingredients }} onExportData={handleExportData} onImportData={handleImportData} userRole={currentUser.role} />}
          {activeTab === 'history' && <OrderHistory orders={orders} />}
          {activeTab === 'pos' && <POS orders={orders} menuItems={menuItems} onPlaceOrder={handlePlaceOrder} onUpdateOrder={handleUpdateOrder} onUpdatePayment={handleUpdatePayment} onUpdateMenuItem={handleUpdateMenuItem} currentUserName={currentUser.name} userRole={currentUser.role} />}
          {activeTab === 'kds' && <KDS orders={orders} updateOrderStatus={handleUpdateOrderStatus} userRole={currentUser.role} menuItems={menuItems} />}
          {activeTab === 'inventory' && <Inventory ingredients={ingredients} menuItems={menuItems} onSave={handleUpdateInventory} onDeleteIngredient={handleDeleteIngredient} onAddIngredient={handleAddIngredient} onAddMenuItem={handleAddMenuItem} onUpdateMenuItem={handleUpdateMenuItem} onDeleteMenuItem={handleDeleteMenuItem} onBulkUpdateMenuItems={handleBulkUpdateMenuItems} onBulkDeleteMenuItems={handleBulkDeleteMenuItems} onBulkAddMenuItems={handleBulkAddMenuItems} />}
          {activeTab === 'staff' && <StaffManagement users={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />}
          {activeTab === 'expenses' && <Expenses expenses={expenses} onAddExpense={handleAddExpense} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense} currentUser={currentUser} />}
          {activeTab === 'procurement' && <Procurement ingredients={ingredients} requests={requisitions} currentUser={currentUser} onRequestAdd={handleAddRequisition} onRequestUpdate={handleUpdateRequisition} onReceiveItem={handleReceiveStock} onAddIngredient={handleAddIngredient} onBulkAddIngredients={handleBulkAddIngredients} />}
          {activeTab === 'customers' && <Customers customers={customers} onAddCustomer={handleAddCustomer} onDeleteCustomer={handleDeleteCustomer} />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
      <AiAssistant contextData={{ orders, inventory: ingredients, menuItems }} />
    </div>
  );
};

export default App;