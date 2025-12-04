
import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Smartphone, Search, X, Clock, CheckCircle, RotateCcw, Receipt, AlertCircle, Zap, Tag, Percent, Ban, Eye, EyeOff, Power, Printer, Pencil, Save, ChevronUp, ChevronDown, ArrowLeft, Check, LayoutGrid, Utensils, Users, Timer, AlertTriangle, FileText, SkipForward } from 'lucide-react';
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
  const [cartCustomQty, setCartCustomQty] = useState('1');

  // -- ACTIVE/HISTORY STATE --
  const [settleOrderId, setSettleOrderId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Feedback States
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

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
          // Merge to ensure new fields like fssai exist if missing in old saved data
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

  // Reset SubCategory when Category Changes
  useEffect(() => {
      setSelectedSubCategory('All');
  }, [selectedCategory]);

  // Logic to calculate price based on portion (Specific vs Multiplier)
  const getPortionPrice = (item: MenuItem, portion: PortionType): number => {
      // 1. Check for specific pricing from bulk upload
      if (item.portionPrices && (item.portionPrices.half || item.portionPrices.quarter || item.portionPrices.full)) {
          if (portion === 'Quarter' && item.portionPrices.quarter && item.portionPrices.quarter > 0) return item.portionPrices.quarter;
          if (portion === 'Half' && item.portionPrices.half && item.portionPrices.half > 0) return item.portionPrices.half;
          if (portion === 'Full' && item.portionPrices.full && item.portionPrices.full > 0) return item.portionPrices.full;
      }
      
      // 2. Fallback for manual items or legacy data without portionPrices
      // This ensures Half/Quarter options appear even if not explicitly set in the bulk sheet
      const basePrice = item.price || 0;
      if (basePrice > 0) {
          if (portion === 'Full') return basePrice;
          if (portion === 'Half') return Math.ceil(basePrice * 0.6); // 60% of full
          if (portion === 'Quarter') return Math.ceil(basePrice * 0.4); // 40% of full
      }
      
      return 0;
  };

  // Opens Modal
  const openPortionModal = (item: MenuItem) => {
    if (item.available === false) return; // Prevent action if out of stock
    setPortionItem(item);
    
    // Determine available portions
    // NOTE: We now allow calculation fallback, so Quarter should appear if Full price exists
    const availablePortions = (['Full', 'Half', 'Quarter'] as PortionType[]).filter(type => getPortionPrice(item, type) > 0);
    
    // Default to first available option
    if (availablePortions.length > 0) {
        setSelectedPortionType(availablePortions[0]); 
    } else {
        // Fallback (e.g. if everything is 0, which shouldn't happen for valid items)
        setSelectedPortionType('Full');
    }
    setPortionQuantity(1);
  };

  // Quick Add Full Portion
  const handleQuickAdd = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (item.available === false) return; // Prevent action if out of stock
    
    const price = getPortionPrice(item, 'Full');
    
    if (price > 0) {
        addToCart(item, 'Full', price, 1);
    } else {
        // If Full portion is unavailable (0 price), open modal to select another portion
        openPortionModal(item);
    }
  };

  // Toggle Item Availability (Manager Only)
  const handleToggleAvailability = (item: MenuItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateMenuItem({ ...item, available: !item.available });
  };

  // Confirm selection from Modal
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

      // Add with specific portion string
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
      const qty = parseInt(cartCustomQty) || 1;
      
      const customItem: MenuItem = {
          id: `custom-${Date.now()}`,
          name: cartCustomName,
          category: 'Custom',
          price: price, 
          ingredients: [],
          description: 'Custom Item',
          available: true
      };
      addToCart(customItem, 'Full', price, qty);
      setCartCustomName('');
      setCartCustomPrice('');
      setCartCustomQty('1');
  };

  const addToCart = (item: MenuItem, portion: string, price: number, qty: number = 1) => {
    // Generate a unique key for cart items combining ID and portion
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
        name: item.name, // Snapshot the name
        quantity: qty,
        priceAtOrder: price,
        portion: portion
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

  const calculateSubtotal = () => {
    return currentCart.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
  };

  const calculateFinalTotal = (items: LineItem[], taxRate: number = 0, discount: number = 0) => {
      const subtotal = items.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = taxable * (taxRate / 100);
      return taxable + taxAmount;
  };

  // Helper for Order Objects
  const getOrderTotal = (order: Order) => {
      return calculateFinalTotal(order.items, order.taxRate || 0, order.discount || 0);
  };

  const constructOrderObject = (status: OrderStatus = OrderStatus.NEW, paymentStatus: PaymentStatus = PaymentStatus.PENDING, method?: PaymentMethod): Order => {
      const tableNum = selectedTable || (Math.floor(Math.random() * 20) + 1);
      
      // If we are editing, preserve ID and created date
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
        // Update existing order
        onUpdateOrder(newOrder);
    } else {
        // Place new order
        onPlaceOrder(newOrder);
    }
    
    resetOrderState();
    
    // Visual Feedback
    setOrderSentSuccess(true);
    setTimeout(() => {
        setOrderSentSuccess(false);
        setActiveView('tables'); 
        setSelectedTable(null); 
    }, 1500);
    
    setShowMobileCart(false);
  };

  const handleSkipBill = () => {
      // Just save the cart to the order and go back, but don't change status to paid
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
      // Just open the print modal without saving/finishing
      const dummyOrder = constructOrderObject();
      setPrintOrder(dummyOrder);
      setShowPrintModal(true);
  };

  const handlePayment = (method: PaymentMethod, existingOrderId?: string) => {
    let orderToPrint: Order | null = null;

    if (existingOrderId) {
        // Settling an active table directly from Active View
        onUpdatePayment(existingOrderId, method);
        orderToPrint = orders.find(o => o.id === existingOrderId) || null;
        if (orderToPrint) {
             orderToPrint = { ...orderToPrint, paymentStatus: PaymentStatus.PAID, paymentMethod: method };
        }
        setSettleOrderId(null);
    } else {
        // Paying for a new/edit order immediately (Takeaway / Quick Serve)
        if (currentCart.length === 0) return;
        
        const newOrder = constructOrderObject(OrderStatus.NEW, PaymentStatus.PAID, method);
        
        if (editingOrder) {
            onUpdateOrder(newOrder); // This updates status to PAID via full object update
        } else {
            onPlaceOrder(newOrder);
        }

        resetOrderState();
        orderToPrint = newOrder;
        setActiveView('tables');
        setSelectedTable(null);
    }

    // Trigger Print Modal
    if (orderToPrint) {
        setPrintOrder(orderToPrint);
        setShowPrintModal(true);
        setShowMobileCart(false);
    }
  };

  const resetOrderState = () => {
    setCurrentCart([]);
    setShowPaymentOptions(false);
    setManualTaxRate('');
    setManualDiscount('');
    setEditingOrder(null);
  };

  // --- HELPER FOR TABLES ---
  const getTableStatus = (tableId: number) => {
      // Find latest active order for this table
      const activeOrder = orders.find(o => o.tableNumber === tableId && o.paymentStatus === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED);
      return activeOrder;
  };

  const handleTableClick = (tableId: number) => {
      const activeOrder = getTableStatus(tableId);
      
      if (activeOrder) {
          setOccupiedTableId(tableId); // Open Options Modal
      } else {
          // Table is free
          setSelectedTable(tableId);
          setEditingOrder(null); // Ensure fresh start
          setActiveView('new_order');
      }
  };

  const handleOccupiedAction = (action: 'add' | 'settle') => {
      if (!occupiedTableId) return;
      const activeOrder = getTableStatus(occupiedTableId);
      
      if (action === 'add' && activeOrder) {
          // EDIT MODE: Load existing order into cart
          setSelectedTable(occupiedTableId);
          setEditingOrder(activeOrder);
          setCurrentCart([...activeOrder.items]);
          setManualTaxRate(activeOrder.taxRate?.toString() || '');
          setManualDiscount(activeOrder.discount?.toString() || '');
          setActiveView('new_order');
      } else if (action === 'settle' && activeOrder) {
          // SETTLE MODE: Use new_order view with payment options open to allow settling
          setSelectedTable(occupiedTableId);
          setEditingOrder(activeOrder);
          setCurrentCart([...activeOrder.items]);
          setManualTaxRate(activeOrder.taxRate?.toString() || '');
          setManualDiscount(activeOrder.discount?.toString() || '');
          setShowPaymentOptions(true);
          setActiveView('new_order');
      }
      setOccupiedTableId(null);
  };

  const handleCancelOrder = () => {
      if (!occupiedTableId) return;
      const activeOrder = getTableStatus(occupiedTableId);
      
      if (activeOrder) {
          if (confirm(`Are you sure you want to CANCEL the order for Table ${occupiedTableId}? This action cannot be undone.`)) {
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
      // 1. Availability Check (Hide sold out unless toggle is on)
      if (!showSoldOut && i.available === false) return false;

      // 2. Category & Search & SubCategory
      const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
      const matchesSubCategory = selectedSubCategory === 'All' || i.subCategory === selectedSubCategory;
      const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesCategory && matchesSubCategory && matchesSearch;
  });

  // --- VIEWS ---

  const renderTablesView = () => {
      return (
          <div className="h-full bg-slate-50 p-4 overflow-y-auto relative">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                       <LayoutGrid className="text-blue-600" /> Table Management
                   </h2>
                   <div className="flex items-center gap-4 text-sm">
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
                                                       {formatDistanceToNow(activeOrder.createdAt).replace('about ', '').replace(' minutes', 'm')}
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

               {/* Occupied Table Action Modal */}
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

  const renderNewOrderView = () => {
    // ... existing renderNewOrderView logic ...
    const subtotal = calculateSubtotal();
    const discount = parseFloat(manualDiscount) || 0;
    const taxRate = parseFloat(manualTaxRate) || 0;
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * (taxRate / 100);
    const total = taxable + taxAmount;

    return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6 overflow-hidden relative">
      {/* Menu Grid - Hidden on mobile if cart is showing */}
      <div className={`flex-1 flex flex-col min-w-0 h-full ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
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
             
             {/* Toggle Sold Out (Visibility) */}
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

        {/* Main Categories */}
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

        {/* Sub Categories (Shown only if available for selected category) */}
        {subCategories.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4 pb-1 animate-in fade-in slide-in-from-top-1">
                <button
                    onClick={() => setSelectedSubCategory('All')}
                    className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-bold transition-colors border ${
                        selectedSubCategory === 'All'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-200'
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
              onClick={() => !isOutOfStock && openPortionModal(item)}
              className={`bg-white p-3 lg:p-4 rounded-xl shadow-sm border transition-all text-left flex flex-col min-h-[140px] h-full justify-between group relative overflow-hidden ${
                  isOutOfStock 
                    ? 'border-slate-200 opacity-70 cursor-not-allowed bg-slate-50' 
                    : 'border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer'
              }`}
            >
              <div>
                <h3 className={`font-bold text-sm lg:text-base text-slate-800 leading-tight flex flex-wrap items-center gap-2 ${!isOutOfStock && 'group-hover:text-blue-600'}`}>
                    {/* Visual Indicators for Veg/Non-Veg */}
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
                    // Only show Quick Add if Full portion is available
                    getPortionPrice(item, 'Full') > 0 && (
                        <button
                        onClick={(e) => handleQuickAdd(item, e)}
                        className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                        title="Quick Add Full Portion"
                        >
                        <Plus size={16} />
                        </button>
                    )
                )}
              </div>
              
              {/* Manager Quick Action: Toggle Availability */}
              {userRole === UserRole.MANAGER && (
                  <button 
                      onClick={(e) => handleToggleAvailability(item, e)}
                      className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors z-20 ${isOutOfStock ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                      title={isOutOfStock ? "Mark as Available" : "Mark as Sold Out"}
                  >
                      <Power size={14} />
                  </button>
              )}

              {/* Overlay for whole card click feedback */}
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

      {/* Floating Action Button for Mobile Cart */}
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

      {/* Current Cart - Responsive Behavior */}
      <div className={`
            lg:w-96 bg-white flex flex-col border border-slate-200 shadow-xl lg:rounded-2xl
            ${showMobileCart ? 'fixed inset-0 z-50 w-full rounded-none animate-in slide-in-from-bottom-10' : 'hidden lg:flex h-full rounded-2xl'}
      `}>
        {/* Mobile Header for Cart */}
        {showMobileCart && (
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between lg:hidden">
                <button onClick={() => setShowMobileCart(false)} className="flex items-center gap-2 text-slate-300 hover:text-white">
                    <ChevronDown size={20} /> Back to Menu
                </button>
                <span className="font-bold">Current Order</span>
            </div>
        )}

        <div className="p-5 border-b border-slate-100 hidden lg:block">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart size={20} /> {editingOrder ? `Updating Order #${editingOrder.id.split('-')[1]}` : 'Current Order'}
          </h2>
          <div className="flex justify-between items-center mt-1">
             <p className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {selectedTable ? `Table #${selectedTable}` : 'Takeaway / Quick Order'}
             </p>
             {selectedTable && (
                 <button onClick={() => { setSelectedTable(null); setEditingOrder(null); setActiveView('tables'); }} className="text-xs text-slate-400 underline hover:text-red-500">Change / Cancel</button>
             )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentCart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ShoppingCart size={48} className="mb-2 text-slate-200" />
              <p className="text-slate-400 text-sm mb-4">Basket is empty</p>
              {selectedTable === null && <p className="text-xs text-blue-500 mb-4 cursor-pointer hover:underline" onClick={() => setActiveView('tables')}>Select a Table first?</p>}
            </div>
          ) : (
            currentCart.map(item => {
              // Prefer snapshotted name, then lookup, then fallback
              const displayName = item.name || menuItems.find(m => m.id === item.menuItemId)?.name || 'Unknown Item';
              
              return (
                <div key={item.id} className="flex justify-between items-start p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                        {displayName} 
                        <span className="text-xs font-bold text-blue-600 ml-1">({item.portion})</span>
                    </p>
                    <p className="text-sm text-slate-500">₹{item.priceAtOrder.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-200 rounded text-slate-600">
                      {item.quantity === 1 ? <Trash2 size={16} className="text-red-500" /> : <Minus size={16} />}
                    </button>
                    <span className="font-semibold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-200 rounded text-slate-600">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-none lg:rounded-b-2xl space-y-3 pb-safe-area">
          
          {/* Custom Item Quick Add */}
          <div className="mb-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Zap size={12} className="text-yellow-500" /> Quick Custom Item
                  </span>
              </div>
              <div className="space-y-2">
                  <input 
                      type="text" 
                      placeholder="Item Name" 
                      value={cartCustomName}
                      onChange={e => setCartCustomName(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <span className="absolute left-2 top-1.5 text-slate-400 text-xs">₹</span>
                          <input 
                              type="number" 
                              placeholder="Price"
                              value={cartCustomPrice}
                              onChange={e => setCartCustomPrice(e.target.value)}
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                      </div>
                      <input 
                          type="number" 
                          placeholder="Qty"
                          value={cartCustomQty}
                          onChange={e => setCartCustomQty(e.target.value)}
                          className="w-12 px-1 py-1.5 text-xs text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <button 
                          onClick={handleCartCustomAdd}
                          disabled={!cartCustomName || !cartCustomPrice}
                          className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 disabled:opacity-50"
                      >
                          Add
                      </button>
                  </div>
              </div>
          </div>

          {/* Discount & Tax Inputs */}
          <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Percent size={12} /> GST (%)
                  </label>
                  <input 
                    type="number"
                    value={manualTaxRate}
                    onChange={e => setManualTaxRate(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                      <Tag size={12} /> Discount (₹)
                  </label>
                  <input 
                    type="number"
                    value={manualDiscount}
                    onChange={e => setManualDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
              </div>
          </div>

          <div className="flex justify-between text-slate-600 text-sm">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
              <div className="flex justify-between text-green-600 text-sm font-medium">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
              </div>
          )}
          <div className="flex justify-between text-slate-600 text-sm">
            <span>GST ({taxRate}%)</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-slate-900 border-t border-slate-200 pt-2">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          
          {/* Action Buttons */}
          {!showPaymentOptions ? (
              <div className="flex flex-col gap-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setShowPaymentOptions(true)}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-green-500 text-green-700 bg-green-50 font-bold hover:bg-green-100 disabled:opacity-50"
                    >
                    <CreditCard size={18} /> Pay / Settle
                    </button>
                    <button 
                    onClick={handleKitchenSend}
                    disabled={currentCart.length === 0}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg text-white font-bold shadow-lg transition-colors ${orderSentSuccess ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-blue-200'}`}
                    >
                    {orderSentSuccess ? <Check size={18} /> : <Send size={18} />}
                    {orderSentSuccess ? 'Sent!' : (editingOrder ? 'Update Order' : 'Send KDS')}
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleSkipBill}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 disabled:opacity-50"
                    >
                        <SkipForward size={14} /> Save & Skip
                    </button>
                    <button
                        onClick={handlePrintOnly}
                        disabled={currentCart.length === 0}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 disabled:opacity-50"
                    >
                        <Printer size={14} /> Print Bill
                    </button>
                </div>
            </div>
          ) : (
             <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                 <p className="text-sm font-semibold text-slate-500 text-center mb-1">Select Payment Method</p>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handlePayment(PaymentMethod.CASH)}
                        className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                    >
                        <Banknote size={24} className="mb-1" />
                        <span className="text-sm font-bold">Cash</span>
                    </button>
                    <button 
                        onClick={() => handlePayment(PaymentMethod.ONLINE)}
                        className="flex flex-col items-center justify-center p-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                        <Smartphone size={24} className="mb-1" />
                        <span className="text-sm font-bold">Online</span>
                    </button>
                 </div>
                 <button 
                    onClick={() => setShowPaymentOptions(false)}
                    className="w-full py-2 text-sm text-slate-500 hover:text-slate-800"
                 >
                    Cancel Payment
                 </button>
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
       
       {/* Modals */}
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
                      {/* Portion Segmented Control */}
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Portion Size</label>
                          <div className="flex p-1 bg-slate-100 rounded-xl">
                            {/* Force display of Full, Half, Quarter if price > 0 OR fallback logic exists */}
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

                      {/* Quantity Selector */}
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
                  {/* Close button - visible only on screen */}
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
                          <span className="uppercase">{printOrder.paymentMethod || 'DRAFT'}</span>
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
