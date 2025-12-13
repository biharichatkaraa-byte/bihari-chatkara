
import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Smartphone, Search, X, Clock, CheckCircle, Receipt, AlertCircle, Zap, Tag, Percent, Ban, Eye, EyeOff, Power, Printer, Pencil, Save, ChevronUp, ChevronDown, ArrowLeft, Check, LayoutGrid, Utensils, Timer, FileText, SkipForward, MessageSquare, RotateCcw, TabletSmartphone, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface POSProps {
  orders: Order[];
  menuItems: MenuItem[];
  onPlaceOrder: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
  onUpdatePayment: (orderId: string, method: PaymentMethod) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  currentUserName: string;
  userRole?: UserRole;
}

type PortionType = 'Full' | 'Half' | 'Quarter';

// Mock Table Configuration
const TABLE_ZONES = [
    { name: 'Main Hall', tables: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: 'Family AC', tables: [9, 10, 11, 12] },
    { name: 'Garden Patio', tables: [13, 14, 15, 16] }
];

// Helper to safely parse dates to avoid "Invalid time value" crashes
const safeDate = (d: any): Date => {
    if (!d) return new Date();
    const date = new Date(d);
    return isNaN(date.getTime()) ? new Date() : date;
};

const POS: React.FC<POSProps> = ({ orders, menuItems, onPlaceOrder, onUpdateOrder, onUpdatePayment, onUpdateMenuItem, currentUserName, userRole }) => {
  const [activeView, setActiveView] = useState<'tables' | 'new_order' | 'active_tables' | 'history'>('tables');
  
  // -- TABLE MANAGEMENT STATE --
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [occupiedTableId, setOccupiedTableId] = useState<number | null>(null); // For the table action modal

  // -- NEW ORDER STATE --
  const [currentCart, setCurrentCart] = useState<LineItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editing existing order state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Mobile Cart State
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  // Availability Toggle
  const [showSoldOut, setShowSoldOut] = useState(false);

  // Tax and Discount State
  const [manualTaxRate, setManualTaxRate] = useState<string>(''); // Empty default means 0
  const [manualDiscount, setManualDiscount] = useState<string>(''); // Empty default means 0
  
  // Portion Modal State
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const [selectedPortionType, setSelectedPortionType] = useState<PortionType>('Half');
  const [portionQuantity, setPortionQuantity] = useState<number>(1);

  // Custom Item State (Modal)
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemPortion, setCustomItemPortion] = useState<PortionType>('Full');

  // Custom Item State (Cart Inline)
  const [cartCustomName, setCartCustomName] = useState('');
  const [cartCustomPrice, setCartCustomPrice] = useState('');

  // -- ACTIVE/HISTORY STATE --
  const [settleOrderId, setSettleOrderId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Feedback States
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);
  
  // Paytm POS State
  const [isPaytmProcessing, setIsPaytmProcessing] = useState(false);

  // -- RECEIPT SETTINGS --
  const [receiptDetails, setReceiptDetails] = useState({
      name: 'Bihari Chatkara',
      tagline: 'The Authentic Taste',
      address1: 'Part-1, Lower Ground Floor, Amrapali Sapphire Arcade, AT-004',
      address2: 'Sadarpur, Sector-45, Noida, Uttar Pradesh 201303',
      phone: '+91 8595709271',
      gstin: '09IBKPK8468R1Z8',
      fssai: '22723925000849'
  });
  const [isEditingReceipt, setIsEditingReceipt] = useState(false);

  // Load receipt settings from local storage
  useEffect(() => {
      const savedDetails = localStorage.getItem('rms_receipt_details');
      if (savedDetails) {
          const parsed = JSON.parse(savedDetails);
          setReceiptDetails(prev => ({ ...prev, ...parsed }));
      }
  }, []);

  const saveReceiptDetails = () => {
      localStorage.setItem('rms_receipt_details', JSON.stringify(receiptDetails));
      setIsEditingReceipt(false);
  };

  const categories = useMemo(() => {
      const cats = new Set(menuItems.map(i => i.category));
      return ['All', ...Array.from(cats).sort()];
  }, [menuItems]);

  const subCategories = useMemo(() => {
      if (selectedCategory === 'All') return [];
      const subs = new Set(
          menuItems
            .filter(i => i.category === selectedCategory && i.subCategory)
            .map(i => i.subCategory!)
      );
      return Array.from(subs).sort();
  }, [menuItems, selectedCategory]);

  useEffect(() => {
      setSelectedSubCategory('All');
  }, [selectedCategory]);

  const getPortionPrice = (item: MenuItem, portion: PortionType): number => {
      if (item.portionPrices && (item.portionPrices.half || item.portionPrices.quarter || item.portionPrices.full)) {
          if (portion === 'Quarter' && item.portionPrices.quarter && item.portionPrices.quarter > 0) return item.portionPrices.quarter;
          if (portion === 'Half' && item.portionPrices.half && item.portionPrices.half > 0) return item.portionPrices.half;
          if (portion === 'Full' && item.portionPrices.full && item.portionPrices.full > 0) return item.portionPrices.full;
      }
      
      const basePrice = item.price || 0;
      if (basePrice > 0) {
          if (portion === 'Full') return basePrice;
          if (portion === 'Half') return Math.ceil(basePrice * 0.6);
          if (portion === 'Quarter') return Math.ceil(basePrice * 0.4);
      }
      return 0;
  };

  const openPortionModal = (item: MenuItem) => {
    if (item.available === false) return;
    setPortionItem(item);
    
    const availablePortions = (['Full', 'Half', 'Quarter'] as PortionType[]).filter(type => getPortionPrice(item, type) > 0);
    
    if (availablePortions.length > 0) {
        setSelectedPortionType(availablePortions[0]); 
    } else {
        setSelectedPortionType('Full');
    }
    setPortionQuantity(1);
  };

  const handleItemClick = (item: MenuItem) => {
      if (item.available === false) return;

      let needsModal = false;
      if (item.portionPrices) {
          if ((item.portionPrices.half && item.portionPrices.half > 0) || (item.portionPrices.quarter && item.portionPrices.quarter > 0)) {
              needsModal = true;
          }
      }

      if (needsModal) {
          openPortionModal(item);
      } else {
          const price = getPortionPrice(item, 'Full');
          if (price > 0) {
              addToCart(item, 'Full', price, 1);
          } else {
              openPortionModal(item);
          }
      }
  };

  const handleToggleAvailability = (item: MenuItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateMenuItem({ ...item, available: !item.available });
  };

  const confirmPortionSelection = () => {
    if (!portionItem) return;
    const finalPrice = getPortionPrice(portionItem, selectedPortionType);
    addToCart(portionItem, selectedPortionType, finalPrice, portionQuantity);
    setPortionItem(null);
  };

  const handleAddCustomItem = () => {
      if(!customItemName || !customItemPrice) return;
      const price = parseFloat(customItemPrice);
      const qty = parseInt(customItemQty) || 1;
      
      const customItem: MenuItem = {
          id: `custom-${Date.now()}`,
          name: customItemName,
          category: 'Custom',
          price: price, 
          ingredients: [],
          description: 'Custom Item',
          available: true
      };

      addToCart(customItem, customItemPortion, price, qty);
      setShowCustomItemModal(false);
      setCustomItemName('');
      setCustomItemPrice('');
      setCustomItemQty('1');
      setCustomItemPortion('Full');
  };

  const handleCartCustomAdd = () => {
      if (!cartCustomName || !cartCustomPrice) return;
      const price = parseFloat(cartCustomPrice);
      
      const customItem: MenuItem = {
          id: `custom-${Date.now()}`,
          name: cartCustomName,
          category: 'Custom',
          price: price, 
          ingredients: [],
          description: 'Custom Item',
          available: true
      };
      addToCart(customItem, 'Full', price, 1);
      setCartCustomName('');
      setCartCustomPrice('');
  };

  const addToCart = (item: MenuItem, portion: string, price: number, qty: number = 1) => {
    const existingItem = currentCart.find(l => l.menuItemId === item.id && l.portion === portion);
    
    if (existingItem) {
      setCurrentCart(currentCart.map(l => 
        (l.menuItemId === item.id && l.portion === portion)
          ? { ...l, quantity: l.quantity + qty } 
          : l
      ));
    } else {
      const newItem: LineItem = {
        id: `l-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        menuItemId: item.id,
        name: item.name,
        quantity: qty,
        priceAtOrder: price,
        portion: portion,
        modifiers: []
      };
      setCurrentCart([...currentCart, newItem]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCurrentCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleAddItemNote = (itemId: string) => {
      const item = currentCart.find(i => i.id === itemId);
      if (!item) return;
      const currentNote = item.modifiers ? item.modifiers[0] : '';
      const newNote = prompt("Add note/instruction for " + item.name + ":", currentNote);
      if (newNote !== null) {
          setCurrentCart(prev => prev.map(i => 
              i.id === itemId ? { ...i, modifiers: newNote ? [newNote] : [] } : i
          ));
      }
  };

  const handleClearCart = () => {
      if (currentCart.length > 0 && confirm("Are you sure you want to clear the entire order?")) {
          setCurrentCart([]);
      }
  };

  const calculateSubtotal = () => {
    return currentCart.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
  };

  const calculateFinalTotal = (items: LineItem[], taxRate: number = 0, discount: number = 0) => {
      const subtotal = items.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = taxable * (taxRate / 100);
      return taxable + taxAmount;
  };

  const getOrderTotal = (order: Order) => {
      return calculateFinalTotal(order.items, order.taxRate || 0, order.discount || 0);
  };

  const constructOrderObject = (status: OrderStatus = OrderStatus.NEW, paymentStatus: PaymentStatus = PaymentStatus.PENDING, method?: PaymentMethod): Order => {
      const tableNum = selectedTable || (Math.floor(Math.random() * 20) + 1);
      
      return {
          id: editingOrder ? editingOrder.id : `o-${Math.floor(Math.random() * 10000)}`,
          tableNumber: tableNum,
          serverName: currentUserName,
          items: [...currentCart],
          status: status,
          paymentStatus: paymentStatus,
          paymentMethod: method,
          createdAt: editingOrder ? editingOrder.createdAt : new Date(),
          taxRate: parseFloat(manualTaxRate) || 0,
          discount: parseFloat(manualDiscount) || 0,
      };
  };

  const handleKitchenSend = () => {
    if (currentCart.length === 0) return;
    const newOrder = constructOrderObject();
    
    if (editingOrder) {
        onUpdateOrder(newOrder);
    } else {
        onPlaceOrder(newOrder);
    }
    
    resetOrderState();
    setOrderSentSuccess(true);
    setTimeout(() => {
        setOrderSentSuccess(false);
        setActiveView('tables'); 
        setSelectedTable(null); 
    }, 1500);
    setShowMobileCart(false);
  };

  const handleSkipBill = () => {
      if (currentCart.length === 0) return;
      const orderToSave = constructOrderObject(editingOrder ? editingOrder.status : OrderStatus.NEW);
      if (editingOrder) {
          onUpdateOrder(orderToSave);
      } else {
          onPlaceOrder(orderToSave);
      }
      resetOrderState();
      setActiveView('tables');
      setSelectedTable(null);
  };

  const handlePrintOnly = () => {
      const dummyOrder = constructOrderObject();
      setPrintOrder(dummyOrder);
      setShowPrintModal(true);
  };

  const handlePayment = (method: PaymentMethod, existingOrderId?: string) => {
    let orderToPrint: Order | null = null;

    if (existingOrderId) {
        onUpdatePayment(existingOrderId, method);
        orderToPrint = orders.find(o => o.id === existingOrderId) || null;
        if (orderToPrint) {
             orderToPrint = { ...orderToPrint, paymentStatus: PaymentStatus.PAID, paymentMethod: method };
        }
        setSettleOrderId(null);
    } else {
        if (currentCart.length === 0) return;
        const newOrder = constructOrderObject(OrderStatus.NEW, PaymentStatus.PAID, method);
        
        if (editingOrder) {
            onUpdateOrder(newOrder);
        } else {
            onPlaceOrder(newOrder);
        }

        resetOrderState();
        orderToPrint = newOrder;
        setActiveView('tables');
        setSelectedTable(null);
    }

    if (orderToPrint) {
        setPrintOrder(orderToPrint);
        setShowPrintModal(true);
        setShowMobileCart(false);
    }
  };

  const handlePaytmPayment = () => {
      setIsPaytmProcessing(true);
      // Simulate hardware communication delay (Waiting for customer to pay on machine)
      setTimeout(() => {
          setIsPaytmProcessing(false);
          handlePayment(PaymentMethod.PAYTM_POS);
      }, 3000);
  };

  const resetOrderState = () => {
    setCurrentCart([]);
    setShowPaymentOptions(false);
    setManualTaxRate('');
    setManualDiscount('');
    setEditingOrder(null);
  };

  const getTableStatus = (tableId: number) => {
      return orders.find(o => o.tableNumber === tableId && o.paymentStatus === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED);
  };

  const handleTableClick = (tableId: number) => {
      const activeOrder = getTableStatus(tableId);
      if (activeOrder) {
          setOccupiedTableId(tableId);
      } else {
          setSelectedTable(tableId);
          setEditingOrder(null);
          setActiveView('new_order');
      }
  };

  const handleOccupiedAction = (action: 'add' | 'settle') => {
      if (!occupiedTableId) return;
      const activeOrder = getTableStatus(occupiedTableId);
      
      if (action === 'add' && activeOrder) {
          setSelectedTable(occupiedTableId);
          setEditingOrder(activeOrder);
          setCurrentCart([...activeOrder.items]);
          setManualTaxRate(activeOrder.taxRate?.toString() || '');
          setManualDiscount(activeOrder.discount?.toString() || '');
          setActiveView('new_order');
      } else if (action === 'settle' && activeOrder) {
          setSelectedTable(occupiedTableId);
          setEditingOrder(activeOrder);
          setCurrentCart([...activeOrder.items]);
          setManualTaxRate(activeOrder.taxRate?.toString() || '');
          setManualDiscount(activeOrder.discount?.toString() || '');
          setShowPaymentOptions(false);
          setActiveView('new_order');
      }
      setOccupiedTableId(null);
  };

  const handleCancelOrder = () => {
      if (!occupiedTableId) return;
      const activeOrder = getTableStatus(occupiedTableId);
      
      if (activeOrder) {
          if (confirm(`Are you sure you want to CANCEL the order for Table ${occupiedTableId}?`)) {
             onUpdateOrder({
                 ...activeOrder,
                 status: OrderStatus.CANCELLED,
                 paymentStatus: PaymentStatus.CANCELLED
             });
             setOccupiedTableId(null);
          }
      }
  };

  const filteredItems = menuItems.filter(i => {
      if (!showSoldOut && i.available === false) return false;
      const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
      const matchesSubCategory = selectedSubCategory === 'All' || i.subCategory === selectedSubCategory;
      const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSubCategory && matchesSearch;
  });

  const renderTablesView = () => {
      return (
          <div className="h-full bg-slate-50 p-4 overflow-y-auto relative">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                       <LayoutGrid className="text-blue-600" /> Table Management
                   </h2>
                   <div className="flex items-center gap-4 text-sm">
                       <button 
                           onClick={() => setActiveView('history')}
                           className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 font-bold shadow-sm transition-colors"
                       >
                           <Clock size={16} /> History & Unpaid
                       </button>
                       <div className="flex items-center gap-2">
                           <div className="w-4 h-4 bg-white border border-slate-300 rounded"></div>
                           <span className="text-slate-600">Available</span>
                       </div>
                       <div className="flex items-center gap-2">
                           <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                           <span className="text-slate-600">Occupied</span>
                       </div>
                   </div>
               </div>

               <div className="space-y-8">
                   {TABLE_ZONES.map((zone) => (
                       <div key={zone.name} className="animate-in fade-in slide-in-from-bottom-4">
                           <h3 className="text-lg font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-1">{zone.name}</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                               {zone.tables.map(tableNum => {
                                   const activeOrder = getTableStatus(tableNum);
                                   const isOccupied = !!activeOrder;
                                   
                                   return (
                                       <button
                                           key={tableNum}
                                           onClick={() => handleTableClick(tableNum)}
                                           className={`relative h-32 rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-2 shadow-sm ${
                                               isOccupied 
                                                ? 'bg-orange-50 border-orange-200 hover:border-orange-400 hover:shadow-orange-100' 
                                                : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-blue-100'
                                           }`}
                                       >
                                           <span className={`text-2xl font-black ${isOccupied ? 'text-orange-800' : 'text-slate-700'}`}>
                                               {tableNum}
                                           </span>
                                           
                                           {isOccupied ? (
                                               <div className="flex flex-col items-center mt-2 w-full">
                                                   <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full mb-1">
                                                       ₹{getOrderTotal(activeOrder).toFixed(0)}
                                                   </span>
                                                   <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                                       <Timer size={10} />
                                                       {formatDistanceToNow(safeDate(activeOrder.createdAt)).replace('about ', '').replace(' minutes', 'm')}
                                                   </span>
                                               </div>
                                           ) : (
                                               <div className="mt-2 text-slate-300">
                                                   <Utensils size={20} />
                                               </div>
                                           )}
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   ))}
               </div>

               {occupiedTableId && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                       <div className="bg-white p-6 rounded-2xl shadow-2xl w-96 max-w-sm">
                           <div className="flex justify-between items-center mb-4">
                               <h3 className="text-xl font-bold text-slate-800">Table {occupiedTableId} Options</h3>
                               <button onClick={() => setOccupiedTableId(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                           </div>
                           <div className="space-y-3">
                               <button 
                                   onClick={() => handleOccupiedAction('add')}
                                   className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                               >
                                   <Plus size={20} /> Add Items / Repeat Order
                               </button>
                               <button 
                                   onClick={() => handleOccupiedAction('settle')}
                                   className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
                               >
                                   <Receipt size={20} /> View / Settle Bill
                               </button>
                               <button 
                                   onClick={handleCancelOrder}
                                   className="w-full py-4 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm border border-red-200"
                               >
                                   <Ban size={20} /> Cancel Order & Clear
                               </button>
                           </div>
                       </div>
                   </div>
               )}
          </div>
      );
  };

  const renderHistoryView = () => {
      const servedUnpaid = orders.filter(o => o.status === OrderStatus.SERVED && o.paymentStatus === PaymentStatus.PENDING);
      const recentPaid = orders
          .filter(o => o.paymentStatus === PaymentStatus.PAID)
          .sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime())
          .slice(0, 15);

      const handleSettleHistory = (order: Order) => {
          setSelectedTable(order.tableNumber);
          setEditingOrder(order);
          setCurrentCart([...order.items]);
          setManualTaxRate(order.taxRate?.toString() || '');
          setManualDiscount(order.discount?.toString() || '');
          setShowPaymentOptions(false); 
          setActiveView('new_order');
      };

      return (
          <div className="h-full bg-slate-50 p-4 overflow-y-auto">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveView('tables')} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
                      <ArrowLeft size={24} />
                  </button>
                  <h2 className="text-2xl font-bold text-slate-800">Transactions & Pending Bills</h2>
              </div>

              <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <AlertCircle className="text-amber-500" /> Pending Settlements (Served)
                  </h3>
                  {servedUnpaid.length === 0 ? (
                      <div className="bg-white p-6 rounded-xl border border-slate-200 text-slate-400 text-center text-sm">
                          All served orders have been settled.
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {servedUnpaid.map(order => (
                              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-500 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-2">
                                  <div>
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="font-bold text-lg text-slate-800">Table #{order.tableNumber}</span>
                                          <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide">Unpaid</span>
                                      </div>
                                      <div className="text-sm text-slate-500 mb-1 font-medium">
                                          Server: {order.serverName}
                                      </div>
                                      <div className="text-xs text-slate-400 flex items-center gap-1">
                                          <Clock size={12} /> Served: {order.completedAt ? formatDistanceToNow(safeDate(order.completedAt), { addSuffix: true }) : 'Recently'}
                                      </div>
                                  </div>
                                  <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-3">
                                      <span className="font-bold text-xl text-slate-900">₹{getOrderTotal(order).toFixed(0)}</span>
                                      <button 
                                          onClick={() => handleSettleHistory(order)}
                                          className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 flex items-center gap-2 shadow-md transition-all active:scale-95"
                                      >
                                          <Receipt size={16} /> Settle Bill
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              <div>
                  <h3 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <CheckCircle className="text-green-500" /> Recent Paid Transactions
                  </h3>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-100 border-b border-slate-200">
                              <tr>
                                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Order ID</th>
                                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Table</th>
                                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Time</th>
                                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Total</th>
                                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Method</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {recentPaid.length === 0 ? (
                                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No recent transactions.</td></tr>
                              ) : (
                                  recentPaid.map(order => (
                                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4 text-sm font-mono text-slate-600">#{order.id.split('-')[1] || order.id}</td>
                                          <td className="p-4 text-sm font-bold text-slate-800">{order.tableNumber || 'Takeaway'}</td>
                                          <td className="p-4 text-sm text-slate-500">{format(safeDate(order.createdAt), 'HH:mm')}</td>
                                          <td className="p-4 text-sm font-bold text-green-600">₹{getOrderTotal(order).toFixed(2)}</td>
                                          <td className="p-4 text-sm text-slate-500 uppercase font-medium">{order.paymentMethod === PaymentMethod.PAYTM_POS ? 'Paytm POS' : order.paymentMethod}</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const renderNewOrderView = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(manualDiscount) || 0;
    const taxRate = parseFloat(manualTaxRate) || 0;
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * (taxRate / 100);
    const total = taxable + taxAmount;

    return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6 overflow-hidden relative">
      <div className={`flex-1 flex flex-col min-w-0 h-full ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
             {activeView === 'new_order' && selectedTable && (
                 <button onClick={() => { setActiveView('tables'); setSelectedTable(null); setEditingOrder(null); }} className="lg:hidden p-2 bg-slate-100 rounded-lg text-slate-600 mr-2">
                     <ArrowLeft size={20} />
                 </button>
             )}

             <div className="relative flex-1 min-w-[200px]">
                 <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                 <input 
                    type="text"
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 shadow-sm"
                 />
                 {searchQuery && (
                     <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                         <X size={18} />
                     </button>
                 )}
             </div>
             
             <button 
                onClick={() => setShowSoldOut(!showSoldOut)}
                className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition-colors ${
                    showSoldOut ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                }`}
                title={showSoldOut ? "Hide Sold Out Items" : "Show Sold Out Items"}
             >
                 {showSoldOut ? <Eye size={16} /> : <EyeOff size={16} />} 
                 <span className="hidden xl:inline">Sold Out</span>
             </button>

             <button 
                onClick={() => setShowCustomItemModal(true)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 whitespace-nowrap"
                title="Add a manual item price for urgency"
             >
                 <Zap size={16} className="text-yellow-400" /> Custom
             </button>
        </div>

        <div className="flex gap-2 flex-wrap mb-2 pb-1">
            {categories.map(cat => (
                <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors text-sm ${
                    selectedCategory === cat 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                >
                {cat}
                </button>
            ))}
        </div>

        {subCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4 pb-1 animate-in fade-in slide-in-from-top-1">
                <button
                    onClick={() => setSelectedSubCategory('All')}
                    className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-bold transition-colors border ${
                        selectedSubCategory === 'All'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                >
                    All {selectedCategory}
                </button>
                {subCategories.map(sub => (
                    <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-bold transition-colors border ${
                            selectedSubCategory === sub
                            ? 'bg-slate-700 text-white border-slate-700'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {sub}
                    </button>
                ))}
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-y-auto pr-1 pb-20 lg:pb-4 flex-1 content-start">
          {filteredItems.map(item => {
            const isOutOfStock = item.available === false;
            return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`bg-white p-3 lg:p-4 rounded-xl shadow-sm border transition-all text-left flex flex-col min-h-[140px] h-full justify-between group relative overflow-hidden ${
                  isOutOfStock 
                    ? 'border-slate-200 opacity-70 cursor-not-allowed bg-slate-50' 
                    : 'border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer'
              }`}
            >
              <div>
                <h3 className={`font-bold text-sm lg:text-base text-slate-800 leading-tight flex flex-wrap items-center gap-2 ${!isOutOfStock && 'group-hover:text-blue-600'}`}>
                    {item.isVeg !== undefined && (
                         <span className={`min-w-3 w-3 h-3 rounded-full border ${item.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`}></span>
                    )}
                    <span className="break-words w-full">{item.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    {item.subCategory ? <span className="font-semibold text-slate-400">{item.subCategory} • </span> : ''}
                    {item.description}
                </p>
              </div>
              <div className="flex justify-between items-center mt-2 relative z-10">
                <span className={`font-bold ${isOutOfStock ? 'text-slate-400' : 'text-slate-900'}`}>₹{item.price.toFixed(0)}</span>
                
                {isOutOfStock ? (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-md flex items-center gap-1">
                        <Ban size={10} /> SOLD OUT
                    </span>
                ) : (
                    <button
                    onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                    className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                    title="Add to Order"
                    >
                    <Plus size={16} />
                    </button>
                )}
              </div>
              
              {userRole === UserRole.MANAGER && (
                  <button 
                      onClick={(e) => handleToggleAvailability(item, e)}
                      className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors z-20 ${isOutOfStock ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                      title={isOutOfStock ? "Mark as Available" : "Mark as Sold Out"}
                  >
                      <Power size={14} />
                  </button>
              )}

              <div className="absolute inset-0 bg-transparent group-active:bg-slate-100/50 pointer-events-none" />
            </div>
          )})}
          
          {filteredItems.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                  <p>No items found.</p>
                  {!showSoldOut && (
                      <p className="text-xs mt-1">Sold out items are hidden. Use the eye icon to view them.</p>
                  )}
              </div>
          )}
        </div>
      </div>

      {!showMobileCart && currentCart.length > 0 && (
          <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
              <button 
                  onClick={() => setShowMobileCart(true)}
                  className="w-full bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-5"
              >
                  <div className="flex items-center gap-3">
                      <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                          {currentCart.reduce((acc, i) => acc + i.quantity, 0)}
                      </div>
                      <span className="font-medium text-sm">Items Added</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">₹{calculateSubtotal().toFixed(0)}</span>
                      <ChevronUp size={20} />
                  </div>
              </button>
          </div>
      )}

      <div className={`
            lg:w-96 bg-white flex flex-col border border-slate-200 shadow-xl lg:rounded-2xl
            ${showMobileCart ? 'fixed inset-0 z-50 w-full rounded-none animate-in slide-in-from-bottom-10' : 'hidden lg:flex h-full rounded-2xl'}
      `}>
        {showMobileCart && (
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between lg:hidden">
                <button onClick={() => setShowMobileCart(false)} className="flex items-center gap-2 text-slate-300 hover:text-white">
                    <ChevronDown size={20} /> Back to Menu
                </button>
                <span className="font-bold">Current Order</span>
            </div>
        )}

        <div className="p-5 border-b border-slate-100 hidden lg:block">
          <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart size={20} /> {editingOrder ? `Order #${editingOrder.id.split('-')[1]}` : 'Current Order'}
              </h2>
              {currentCart.length > 0 && (
                  <button onClick={handleClearCart} className="text-slate-400 hover:text-red-500 transition-colors" title="Clear Cart">
                      <Trash2 size={18} />
                  </button>
              )}
          </div>
          <div className="flex justify-between items-center mt-2">
             <p className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {selectedTable ? `Table #${selectedTable}` : 'Takeaway / Quick Order'}
             </p>
             {selectedTable && (
                 <button onClick={() => { setSelectedTable(null); setEditingOrder(null); setActiveView('tables'); }} className="text-xs text-slate-400 underline hover:text-red-500">Change Table</button>
             )}
          </div>
        </div>

        {/* Quick Inline Add */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 animate-in fade-in">
             <div className="flex gap-2">
                 <input 
                    type="text" 
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Custom Item Name"
                    value={cartCustomName}
                    onChange={e => setCartCustomName(e.target.value)}
                 />
                 <div className="relative w-20">
                     <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                     <input 
                        type="number" 
                        className="w-full pl-5 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Price"
                        value={cartCustomPrice}
                        onChange={e => setCartCustomPrice(e.target.value)}
                     />
                 </div>
                 <button 
                    onClick={handleCartCustomAdd}
                    disabled={!cartCustomName || !cartCustomPrice}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                 >
                     <Plus size={12} /> Add
                 </button>
             </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {currentCart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                  <ShoppingCart size={32} />
              </div>
              <p className="text-slate-400 text-sm mb-4 font-medium">Cart is empty</p>
              {selectedTable === null && <p className="text-xs text-blue-500 mb-4 cursor-pointer hover:underline" onClick={() => setActiveView('tables')}>Select a Table first?</p>}
            </div>
          ) : (
            currentCart.map(item => {
              const displayName = item.name || menuItems.find(m => m.id === item.menuItemId)?.name || 'Unknown Item';
              
              return (
                <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm relative group transition-all hover:border-blue-300 hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                        <p className="font-bold text-slate-800 text-sm leading-tight">
                            {displayName} 
                            {item.portion && item.portion !== 'Full' && <span className="text-xs font-bold text-blue-600 ml-1">({item.portion})</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">₹{item.priceAtOrder.toFixed(2)} / unit</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-slate-900">₹{(item.priceAtOrder * item.quantity).toFixed(0)}</p>
                    </div>
                  </div>

                  {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-2 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-start gap-1">
                          <MessageSquare size={12} className="mt-0.5 flex-shrink-0" />
                          <span>{item.modifiers[0]}</span>
                      </div>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                      <button onClick={() => handleAddItemNote(item.id)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 uppercase tracking-wide transition-colors">
                          <MessageSquare size={12} /> {item.modifiers?.length ? 'Edit Note' : 'Add Note'}
                      </button>

                      <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded text-slate-600 shadow-sm hover:text-red-500 transition-colors">
                          {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                        </button>
                        <span className="font-bold text-slate-800 text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded text-slate-600 shadow-sm hover:text-blue-600 transition-colors">
                          <Plus size={14} />
                        </button>
                      </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-200 rounded-b-none lg:rounded-b-2xl space-y-3 pb-safe-area shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GST (%)</label>
                  <input 
                    type="number"
                    value={manualTaxRate}
                    onChange={e => setManualTaxRate(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-xs font-bold border border-slate-200 rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Discount (₹)</label>
                  <input 
                    type="number"
                    value={manualDiscount}
                    onChange={e => setManualDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-xs font-bold border border-slate-200 rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
                  />
              </div>
          </div>

          <div className="flex justify-between text-slate-500 text-xs">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
              <div className="flex justify-between text-green-600 text-xs font-bold">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
              </div>
          )}
          <div className="flex justify-between text-slate-500 text-xs">
            <span>GST ({taxRate}%)</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-end border-t border-dashed border-slate-300 pt-3 mt-1">
            <span className="text-sm font-bold text-slate-600">Total Amount</span>
            <span className="text-2xl font-black text-slate-900 leading-none">₹{total.toFixed(2)}</span>
          </div>
          
          {!showPaymentOptions ? (
              <div className="flex flex-col gap-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setShowPaymentOptions(true)}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-green-500 text-green-700 bg-green-50 font-bold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                    <CreditCard size={18} /> Pay Now
                    </button>
                    <button 
                    onClick={handleKitchenSend}
                    disabled={currentCart.length === 0}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 ${orderSentSuccess ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-blue-200'}`}
                    >
                    {orderSentSuccess ? <Check size={18} /> : <Send size={18} />}
                    {orderSentSuccess ? 'Sent!' : (editingOrder ? 'Update Order' : 'Send to KDS')}
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleSkipBill}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                        <SkipForward size={14} /> Save Draft
                    </button>
                    <button
                        onClick={handlePrintOnly}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                    >
                        <Printer size={14} /> Print Bill
                    </button>
                </div>
            </div>
          ) : (
             <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 bg-slate-50 p-3 rounded-xl border border-slate-200 relative">
                 <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-slate-500 uppercase">Select Payment Method</p>
                    <button onClick={() => setShowPaymentOptions(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handlePayment(PaymentMethod.CASH)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border-2 border-green-100 text-green-700 hover:border-green-500 hover:shadow-md transition-all active:scale-95"
                    >
                        <Banknote size={24} className="mb-2" />
                        <span className="text-xs font-bold">Cash</span>
                    </button>
                    <button 
                        onClick={() => handlePayment(PaymentMethod.ONLINE)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border-2 border-purple-100 text-purple-700 hover:border-purple-500 hover:shadow-md transition-all active:scale-95"
                    >
                        <Smartphone size={24} className="mb-2" />
                        <span className="text-xs font-bold">UPI / Online</span>
                    </button>
                    {/* PAYTM POS BUTTON */}
                    <button 
                        onClick={handlePaytmPayment}
                        className="col-span-2 flex flex-col items-center justify-center p-4 rounded-xl bg-white border-2 border-blue-900 text-blue-900 hover:bg-blue-50 transition-all active:scale-95"
                    >
                        <TabletSmartphone size={24} className="mb-2" />
                        <span className="text-xs font-bold">Paytm Terminal (POS)</span>
                    </button>
                 </div>

                 {/* Paytm Processing Overlay */}
                 {isPaytmProcessing && (
                     <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center rounded-xl p-4 animate-in fade-in">
                         <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mb-4 shadow-xl">
                             <Loader2 size={32} className="text-white animate-spin" />
                         </div>
                         <h4 className="font-bold text-slate-800 text-lg mb-1">Sending to Terminal...</h4>
                         <p className="text-xs text-slate-500">Please complete payment on the machine.</p>
                     </div>
                 )}
             </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="h-full w-full relative">
       {activeView === 'tables' && renderTablesView()}
       {(activeView === 'new_order' || activeView === 'active_tables') && renderNewOrderView()}
       {activeView === 'history' && renderHistoryView()}
       
       {portionItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 transform transition-all scale-100">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                              {portionItem.isVeg !== undefined && (
                                   <span className={`w-3 h-3 rounded-full border ${portionItem.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`}></span>
                              )}
                              {portionItem.name}
                          </h3>
                          <p className="text-slate-500 text-sm">Select size & quantity</p>
                      </div>
                      <button onClick={() => setPortionItem(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Portion Size</label>
                          <div className="flex p-1 bg-slate-100 rounded-xl">
                            {(['Full', 'Half', 'Quarter'] as PortionType[])
                                .filter(type => getPortionPrice(portionItem, type) > 0)
                                .map((type) => {
                                    const price = getPortionPrice(portionItem, type);
                                    const isSelected = selectedPortionType === type;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedPortionType(type)}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                                isSelected
                                                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <div className="flex flex-col items-center">
                                                <span>{type}</span>
                                                <span className="text-[10px] font-normal opacity-80">₹{price.toFixed(0)}</span>
                                            </div>
                                        </button>
                                    )
                            })}
                          </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Quantity</label>
                          <div className="flex items-center justify-center gap-4">
                                <button 
                                    onClick={() => setPortionQuantity(Math.max(1, portionQuantity - 1))}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                    <Minus size={18} />
                                </button>
                                <span className="text-2xl font-bold text-slate-800 w-12 text-center">{portionQuantity}</span>
                                <button 
                                    onClick={() => setPortionQuantity(portionQuantity + 1)}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                                >
                                    <Plus size={18} />
                                </button>
                          </div>
                      </div>

                      <button 
                        onClick={confirmPortionSelection}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                      >
                          Add to Order - ₹{(getPortionPrice(portionItem, selectedPortionType) * portionQuantity).toFixed(0)}
                      </button>
                  </div>
              </div>
          </div>
       )}

       {showCustomItemModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 transform transition-all scale-100">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Zap size={20} className="text-yellow-500" /> Quick Custom Item
                      </h3>
                      <button onClick={() => setShowCustomItemModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                   </div>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Item Name</label>
                           <input type="text" value={customItemName} onChange={e => setCustomItemName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g. Open Food" />
                       </div>

                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-2">Select Portion (Label Only)</label>
                           <div className="flex gap-2">
                               {(['Full', 'Half', 'Quarter'] as PortionType[]).map(p => (
                                   <button
                                     key={p}
                                     onClick={() => setCustomItemPortion(p)}
                                     className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${
                                         customItemPortion === p 
                                         ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                                         : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                     }`}
                                   >
                                       {p}
                                   </button>
                               ))}
                           </div>
                       </div>

                       <div className="grid grid-cols-2 gap-2">
                           <div>
                               <label className="block text-xs font-bold text-slate-500 mb-1">Price (₹)</label>
                               <div className="relative">
                                   <span className="absolute left-2 top-2 text-slate-400 text-xs">₹</span>
                                   <input 
                                        type="number" 
                                        value={customItemPrice} 
                                        onChange={e => setCustomItemPrice(e.target.value)} 
                                        className="w-full border rounded pl-5 pr-2 py-2 font-bold" 
                                        placeholder="0" 
                                   />
                               </div>
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-500 mb-1">Quantity</label>
                               <input 
                                    type="number" 
                                    value={customItemQty} 
                                    onChange={e => setCustomItemQty(e.target.value)} 
                                    className="w-full border rounded px-3 py-2 font-bold text-center" 
                                    placeholder="1" 
                               />
                           </div>
                       </div>
                       
                       <button 
                            onClick={handleAddCustomItem} 
                            disabled={!customItemName || !customItemPrice}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 mt-2 shadow-lg disabled:opacity-50"
                       >
                           Add Item to Cart
                       </button>
                   </div>
              </div>
          </div>
       )}

       {showPrintModal && printOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div 
                  id="printable-receipt"
                  className="bg-white p-4 rounded-none w-[320px] shadow-2xl flex flex-col text-black relative font-mono text-sm print:w-full print:shadow-none print:absolute print:inset-0"
              >
                  <button onClick={() => setShowPrintModal(false)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 print-hidden bg-slate-100 p-1 rounded-full z-10">
                      <X size={16}/>
                  </button>

                  <div className="text-center mb-4 pb-2 border-b-2 border-dashed border-black">
                      <div className="relative group">
                          {isEditingReceipt ? (
                              <div className="mb-2 space-y-1 bg-slate-100 p-2 rounded print-hidden">
                                  <input type="text" value={receiptDetails.name} onChange={e => setReceiptDetails({...receiptDetails, name: e.target.value})} className="w-full text-center font-bold uppercase border border-slate-300 p-1 text-xs" />
                                  <input type="text" value={receiptDetails.tagline} onChange={e => setReceiptDetails({...receiptDetails, tagline: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" />
                                  <input type="text" value={receiptDetails.address1} onChange={e => setReceiptDetails({...receiptDetails, address1: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" />
                                  <input type="text" value={receiptDetails.address2} onChange={e => setReceiptDetails({...receiptDetails, address2: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" />
                                  <input type="text" value={receiptDetails.phone} onChange={e => setReceiptDetails({...receiptDetails, phone: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" />
                                  <input type="text" value={receiptDetails.gstin} onChange={e => setReceiptDetails({...receiptDetails, gstin: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" placeholder="GSTIN" />
                                  <input type="text" value={receiptDetails.fssai} onChange={e => setReceiptDetails({...receiptDetails, fssai: e.target.value})} className="w-full text-center text-[10px] border border-slate-300 p-1" placeholder="FSSAI" />
                                  <button onClick={saveReceiptDetails} className="w-full bg-blue-600 text-white py-1 rounded text-xs font-bold flex items-center justify-center gap-1"><Save size={12}/> Save</button>
                              </div>
                          ) : (
                              <>
                                  <h4 className="text-xl font-bold uppercase tracking-wider mb-1 leading-none">{receiptDetails.name}</h4>
                                  <p className="text-[12px] font-bold">{receiptDetails.tagline}</p>
                                  <p className="text-[10px] mt-1">{receiptDetails.address1}</p>
                                  <p className="text-[10px]">{receiptDetails.address2}</p>
                                  <p className="text-[10px]">Ph: {receiptDetails.phone}</p>
                                  {receiptDetails.gstin && <p className="text-[10px]">GSTIN: {receiptDetails.gstin}</p>}
                                  {receiptDetails.fssai && <p className="text-[10px]">FSSAI: {receiptDetails.fssai}</p>}
                                  
                                  <button onClick={() => setIsEditingReceipt(true)} className="absolute top-0 right-0 p-1 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity print-hidden">
                                      <Pencil size={12} />
                                  </button>
                              </>
                          )}
                      </div>
                      
                      <div className="mt-2 text-[10px] flex justify-between border-t border-dashed border-black pt-1">
                         <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
                         <span>Time: {format(new Date(), 'HH:mm')}</span>
                      </div>
                      <div className="text-[10px] flex justify-between">
                         <span>Bill No: {printOrder.id.split('-')[1] || printOrder.id}</span>
                         <span>T.No: {printOrder.tableNumber}</span>
                      </div>
                      <div className="text-[10px] text-left">
                         Cashier: {currentUserName}
                      </div>
                  </div>

                  <div className="space-y-1 mb-2 text-xs">
                      <div className="flex font-bold border-b border-black pb-1 mb-1">
                          <span className="flex-1">Item</span>
                          <span className="w-8 text-center">Qty</span>
                          <span className="w-12 text-right">Amt</span>
                      </div>
                      {printOrder.items.map((item, idx) => {
                           const displayName = item.name || menuItems.find(m => m.id === item.menuItemId)?.name || 'Custom';
                           const portionLabel = item.portion && item.portion !== 'Full' ? ` (${item.portion[0]})` : '';
                           return (
                               <div key={idx} className="flex justify-between items-start">
                                  <span className="flex-1 leading-tight">{displayName}{portionLabel}</span>
                                  <span className="w-8 text-center">{item.quantity}</span>
                                  <span className="w-12 text-right">{(item.priceAtOrder * item.quantity).toFixed(0)}</span>
                               </div>
                           )
                      })}
                  </div>

                  <div className="border-t-2 border-dashed border-black pt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{printOrder.items.reduce((acc, i) => acc + (i.priceAtOrder * i.quantity), 0).toFixed(2)}</span>
                      </div>
                      {printOrder.discount && printOrder.discount > 0 && (
                          <div className="flex justify-between">
                              <span>Discount</span>
                              <span>-{printOrder.discount.toFixed(2)}</span>
                          </div>
                      )}
                      <div className="flex justify-between">
                          <span>Tax ({printOrder.taxRate}%)</span>
                          <span>{((calculateFinalTotal(printOrder.items, printOrder.taxRate, printOrder.discount) - (printOrder.items.reduce((a,b)=>a+(b.priceAtOrder*b.quantity),0) - (printOrder.discount||0)))).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg mt-2 pt-1 border-t border-black">
                          <span>TOTAL</span>
                          <span>{getOrderTotal(printOrder).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] mt-1">
                          <span>Pay Mode:</span>
                          <span className="uppercase">{printOrder.paymentMethod === PaymentMethod.PAYTM_POS ? 'PAYTM MACHINE' : (printOrder.paymentMethod || 'DRAFT')}</span>
                      </div>
                  </div>

                  <div className="text-center mt-4 mb-2 text-[10px]">
                      <p className="font-bold">*** Thank You Visit Again ***</p>
                      <p>For Feedback: {receiptDetails.phone}</p>
                  </div>

                  <div className="space-y-2 print-hidden mt-2">
                      <button 
                        onClick={() => window.print()}
                        className="w-full py-2 bg-black text-white font-bold rounded hover:bg-slate-800 flex items-center justify-center gap-2"
                      >
                          <Printer size={16} /> Print Receipt
                      </button>
                  </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default POS;
