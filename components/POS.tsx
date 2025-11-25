
import React, { useState, useEffect } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Smartphone, Search, X, Clock, CheckCircle, RotateCcw, Receipt, AlertCircle, Zap, Tag, Percent, Ban, Eye, EyeOff, Power, Printer, Pencil, Save, ChevronUp, ChevronDown, ArrowLeft, Check } from 'lucide-react';
import { format } from 'date-fns';

interface POSProps {
  orders: Order[];
  menuItems: MenuItem[];
  onPlaceOrder: (order: Order) => void;
  onUpdatePayment: (orderId: string, method: PaymentMethod) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  currentUserName: string;
  userRole?: UserRole;
}

type PortionType = 'Full' | 'Half' | 'Quarter';

const POS: React.FC<POSProps> = ({ orders, menuItems, onPlaceOrder, onUpdatePayment, onUpdateMenuItem, currentUserName, userRole }) => {
  const [activeView, setActiveView] = useState<'new_order' | 'active_tables' | 'history'>('new_order');
  
  // -- NEW ORDER STATE --
  const [currentCart, setCurrentCart] = useState<LineItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Custom Item State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemPortion, setCustomItemPortion] = useState<PortionType>('Full');

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
      address1: '123, Flavor Street, Foodie Zone',
      address2: 'Patna, Bihar - 800001',
      phone: '+91 98765 43210',
      gstin: '10AAAAA0000A1Z5'
  });
  const [isEditingReceipt, setIsEditingReceipt] = useState(false);

  // Load receipt settings from local storage
  useEffect(() => {
      const savedDetails = localStorage.getItem('rms_receipt_details');
      if (savedDetails) {
          setReceiptDetails(JSON.parse(savedDetails));
      }
  }, []);

  const saveReceiptDetails = () => {
      localStorage.setItem('rms_receipt_details', JSON.stringify(receiptDetails));
      setIsEditingReceipt(false);
  };

  const categories = ['All', ...Array.from(new Set(menuItems.map(i => i.category)))];

  // Logic to calculate price based on portion (Specific vs Multiplier)
  const getPortionPrice = (item: MenuItem, portion: PortionType) => {
      // 1. Check for specific pricing from bulk upload
      if (item.portionPrices) {
          if (portion === 'Quarter' && item.portionPrices.quarter) return item.portionPrices.quarter;
          if (portion === 'Half' && item.portionPrices.half) return item.portionPrices.half;
          if (portion === 'Full' && item.portionPrices.full) return item.portionPrices.full;
      }
      
      // 2. Fallback to Multiplier if no specific price
      let multiplier = 1.0;
      if (portion === 'Quarter') multiplier = 0.4;
      if (portion === 'Half') multiplier = 0.6;
      
      return item.price * multiplier;
  };

  // Opens Modal
  const openPortionModal = (item: MenuItem) => {
    if (item.available === false) return; // Prevent action if out of stock
    setPortionItem(item);
    
    // Default to Full if available, else first available
    setSelectedPortionType('Full');
    setPortionQuantity(1);
  };

  // Quick Add Full Portion
  const handleQuickAdd = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (item.available === false) return; // Prevent action if out of stock
    const price = getPortionPrice(item, 'Full');
    addToCart(item, 'Full', price, 1);
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
      addToCart(customItem, customItemPortion, price, 1);
      setShowCustomItemModal(false);
      setCustomItemName('');
      setCustomItemPrice('');
      setCustomItemPortion('Full');
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

  const handleKitchenSend = () => {
    if (currentCart.length === 0) return;
    
    const newOrder: Order = {
      id: `o-${Math.floor(Math.random() * 10000)}`,
      tableNumber: Math.floor(Math.random() * 20) + 1, // Simulate table selection
      serverName: currentUserName,
      items: [...currentCart],
      status: OrderStatus.NEW,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: new Date(),
      taxRate: parseFloat(manualTaxRate) || 0,
      discount: parseFloat(manualDiscount) || 0,
    };
    
    onPlaceOrder(newOrder);
    resetOrderState();
    
    // Visual Feedback
    setOrderSentSuccess(true);
    setTimeout(() => setOrderSentSuccess(false), 2000);
    
    setShowMobileCart(false);
  };

  const handlePayment = (method: PaymentMethod, existingOrderId?: string) => {
    let orderToPrint: Order | null = null;

    if (existingOrderId) {
        // Settling an active table
        onUpdatePayment(existingOrderId, method);
        orderToPrint = orders.find(o => o.id === existingOrderId) || null;
        if (orderToPrint) {
             orderToPrint = { ...orderToPrint, paymentStatus: PaymentStatus.PAID, paymentMethod: method }; // Create local updated copy for print
        }
        setSettleOrderId(null);
    } else {
        // Paying for a new order immediately
        if (currentCart.length === 0) return;
        const newOrder: Order = {
            id: `o-${Math.floor(Math.random() * 10000)}`,
            tableNumber: Math.floor(Math.random() * 20) + 1,
            serverName: currentUserName,
            items: [...currentCart],
            status: OrderStatus.NEW, // Still goes to kitchen
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: method,
            createdAt: new Date(),
            taxRate: parseFloat(manualTaxRate) || 0,
            discount: parseFloat(manualDiscount) || 0,
        };
        onPlaceOrder(newOrder);
        resetOrderState();
        orderToPrint = newOrder;
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
  };

  const filteredItems = menuItems.filter(i => {
      // 1. Availability Check (Hide sold out unless toggle is on)
      if (!showSoldOut && i.available === false) return false;

      // 2. Category & Search
      const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
      const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesCategory && matchesSearch;
  });

  // --- VIEWS ---

  const renderNewOrderView = () => {
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

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
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

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-y-auto pr-1 pb-20 lg:pb-4 flex-1 content-start">
          {filteredItems.map(item => {
            const isOutOfStock = item.available === false;
            return (
            <div
              key={item.id}
              onClick={() => !isOutOfStock && openPortionModal(item)}
              className={`bg-white p-3 lg:p-4 rounded-xl shadow-sm border transition-all text-left flex flex-col h-32 justify-between group relative overflow-hidden ${
                  isOutOfStock 
                    ? 'border-slate-200 opacity-70 cursor-not-allowed bg-slate-50' 
                    : 'border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer'
              }`}
            >
              <div>
                <h3 className={`font-bold text-sm lg:text-base text-slate-800 leading-tight flex items-center gap-2 ${!isOutOfStock && 'group-hover:text-blue-600'}`}>
                    {/* Visual Indicators for Veg/Non-Veg */}
                    {item.isVeg !== undefined && (
                         <span className={`min-w-3 w-3 h-3 rounded-full border ${item.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`}></span>
                    )}
                    <span className="truncate">{item.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description}</p>
              </div>
              <div className="flex justify-between items-center mt-2 relative z-10">
                <span className={`font-bold ${isOutOfStock ? 'text-slate-400' : 'text-slate-900'}`}>₹{item.price.toFixed(0)}</span>
                
                {isOutOfStock ? (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-md flex items-center gap-1">
                        <Ban size={10} /> SOLD OUT
                    </span>
                ) : (
                    <button
                    onClick={(e) => handleQuickAdd(item, e)}
                    className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                    title="Quick Add Full Portion"
                    >
                    <Plus size={16} />
                    </button>
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
              <ShoppingCart size={20} /> Current Order
          </h2>
          <p className="text-sm text-slate-400">New Table (Guest)</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentCart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart size={48} className="mb-2 opacity-50" />
              <p>Basket is empty</p>
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
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                    onClick={() => setShowPaymentOptions(true)}
                    disabled={currentCart.length === 0}
                    className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                <CreditCard size={18} /> Pay Now
                </button>
                <button 
                onClick={handleKitchenSend}
                disabled={currentCart.length === 0}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg text-white font-medium shadow-lg transition-colors ${orderSentSuccess ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-blue-200'}`}
                >
                {orderSentSuccess ? <Check size={18} /> : <Send size={18} />}
                {orderSentSuccess ? 'Sent!' : 'Send KDS'}
                </button>
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

      {/* PORTION MODAL - REFINED SEGMENTED CONTROL */}
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
                            {(['Full', 'Half', 'Quarter'] as PortionType[]).map((type) => {
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

      {/* CUSTOM ITEM MODAL */}
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

                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Total Price for this Portion (₹)</label>
                           <div className="relative">
                               <span className="absolute left-3 top-2 text-slate-400">₹</span>
                               <input 
                                    type="number" 
                                    value={customItemPrice} 
                                    onChange={e => setCustomItemPrice(e.target.value)} 
                                    className="w-full border rounded pl-6 pr-3 py-2 font-bold" 
                                    placeholder="0.00" 
                               />
                           </div>
                           <p className="text-[10px] text-slate-400 mt-1">Enter the final price you want to charge.</p>
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

      {/* PRINT BILL MODAL - OPTIMIZED FOR THERMAL PRINTING */}
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
                         Server: {printOrder.serverName}
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
                          <span className="uppercase">{printOrder.paymentMethod}</span>
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
  )};

  const renderActiveTablesView = () => {
    // Show orders that are not PAID yet, but likely SERVED or READY
    const activeOrders = orders.filter(o => o.paymentStatus === PaymentStatus.PENDING);
    
    return (
        <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Clock size={20} className="text-orange-500"/> Active / Served Tables
                </h2>
                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">{activeOrders.length} Active</span>
            </div>
            <div className="flex-1 overflow-auto p-4 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeOrders.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-400">
                             <CheckCircle size={48} className="mb-2 opacity-20" />
                             <p>No active unpaid orders.</p>
                        </div>
                    ) : (
                        activeOrders.map(order => (
                            <div key={order.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">Table #{order.tableNumber}</h3>
                                        <p className="text-xs text-slate-500">Server: {order.serverName}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        order.status === OrderStatus.SERVED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {order.status}
                                    </div>
                                </div>
                                <div className="p-4 flex-1 space-y-2">
                                    {order.items.map((item, idx) => {
                                        const displayName = item.name || menuItems.find(m => m.id === item.menuItemId)?.name || 'Unknown Item';
                                        return (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-slate-700">{item.quantity}x {displayName} <span className="text-xs text-blue-600 font-bold">({item.portion || 'Full'})</span></span>
                                                <span className="font-mono text-slate-500">₹{(item.priceAtOrder * item.quantity).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    {order.discount && order.discount > 0 && (
                                        <div className="flex justify-between text-sm text-green-600 pt-1 border-t border-dashed border-slate-200">
                                            <span>Discount</span>
                                            <span>-₹{order.discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Tax ({order.taxRate || 0}%)</span>
                                        <span>₹{((calculateFinalTotal(order.items, order.taxRate, order.discount) - (order.items.reduce((a,b)=>a+(b.priceAtOrder*b.quantity),0) - (order.discount||0)))).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-bold text-slate-500 text-sm">Total Due</span>
                                        <span className="font-bold text-xl text-slate-900">₹{getOrderTotal(order).toFixed(2)}</span>
                                    </div>
                                    
                                    {settleOrderId === order.id ? (
                                        <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-2">
                                            <button onClick={() => handlePayment(PaymentMethod.CASH, order.id)} className="bg-green-500 text-white py-2 rounded font-bold text-sm hover:bg-green-600">Cash</button>
                                            <button onClick={() => handlePayment(PaymentMethod.ONLINE, order.id)} className="bg-purple-500 text-white py-2 rounded font-bold text-sm hover:bg-purple-600">Online</button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => setSettleOrderId(order.id)}
                                            className="w-full py-2 bg-slate-800 text-white font-bold rounded hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={16} /> Settle Bill
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderHistoryView = () => {
    const paidOrders = orders.filter(o => o.paymentStatus === PaymentStatus.PAID).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Served but not paid
    const servedUnpaidOrders = orders.filter(o => o.status === OrderStatus.SERVED && o.paymentStatus === PaymentStatus.PENDING).sort((a,b) => {
        const timeA = a.completedAt ? a.completedAt.getTime() : a.createdAt.getTime();
        const timeB = b.completedAt ? b.completedAt.getTime() : b.createdAt.getTime();
        return timeB - timeA;
    });

    return (
        <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
             
             {/* SERVED & UNPAID SECTION (NEW) */}
             {servedUnpaidOrders.length > 0 && (
                <div className="border-b-4 border-slate-100 flex-shrink-0">
                    <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                            <AlertCircle size={20}/> Served & Unpaid Orders
                        </h2>
                        <span className="text-xs font-medium text-orange-600">Action Required</span>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                         <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-orange-50/50">
                                <tr>
                                    <th className="px-6 py-2 text-xs font-bold text-orange-800/60 uppercase">Order ID</th>
                                    <th className="px-6 py-2 text-xs font-bold text-orange-800/60 uppercase">Served Time</th>
                                    <th className="px-6 py-2 text-xs font-bold text-orange-800/60 uppercase">Table</th>
                                    <th className="px-6 py-2 text-xs font-bold text-orange-800/60 uppercase">Amount Due</th>
                                    <th className="px-6 py-2 text-xs font-bold text-orange-800/60 uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-100">
                                {servedUnpaidOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-orange-50/30">
                                        <td className="px-6 py-3 text-xs font-mono text-slate-500">#{order.id}</td>
                                        <td className="px-6 py-3 text-sm font-medium text-slate-800">
                                            {order.completedAt ? format(order.completedAt, 'HH:mm') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-3 text-sm text-slate-800">Table {order.tableNumber}</td>
                                        <td className="px-6 py-3 font-bold text-slate-900">₹{getOrderTotal(order).toFixed(2)}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button 
                                                onClick={() => { setActiveView('active_tables'); setSettleOrderId(order.id); }}
                                                className="text-xs bg-white border border-slate-200 px-3 py-1 rounded font-bold text-slate-600 hover:text-blue-600 hover:border-blue-300"
                                            >
                                                Go to Pay
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>
             )}

             {/* PAID HISTORY SECTION */}
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Receipt size={20} className="text-green-600"/> Transaction History
                </h2>
                <div className="flex gap-2">
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">{paidOrders.length} Paid</span>
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-white border-b border-slate-200 sticky top-0 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Order ID</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Date/Time</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Table</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Items</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Total</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Method</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Print</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paidOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-xs font-mono text-slate-500">#{order.id}</td>
                                <td className="px-6 py-4 text-sm text-slate-800">{format(order.createdAt, 'MMM dd, HH:mm')}</td>
                                <td className="px-6 py-4 text-sm text-slate-800">Table {order.tableNumber}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                    {order.items.map(i => {
                                         const displayName = i.name || menuItems.find(x => x.id === i.menuItemId)?.name || 'Custom Item';
                                         return `${i.quantity}x ${displayName} (${i.portion || 'Full'})`; 
                                    }).join(', ')}
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">₹{getOrderTotal(order).toFixed(2)}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        order.paymentMethod === PaymentMethod.ONLINE ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {order.paymentMethod}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => {
                                            setPrintOrder(order);
                                            setShowPrintModal(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-800"
                                        title="Print Bill"
                                    >
                                        <Printer size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-fit overflow-x-auto no-scrollbar">
            <button 
                onClick={() => setActiveView('new_order')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeView === 'new_order' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
                <Plus size={16} /> New Order
            </button>
            <div className="w-px bg-slate-200 mx-2 my-1 hidden md:block"></div>
            <button 
                onClick={() => setActiveView('active_tables')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeView === 'active_tables' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-orange-600 hover:bg-orange-50'}`}
            >
                <Clock size={16} /> Active / Served
            </button>
            <button 
                onClick={() => setActiveView('history')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeView === 'history' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-green-700 hover:bg-green-50'}`}
            >
                <RotateCcw size={16} /> History
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
            {activeView === 'new_order' && renderNewOrderView()}
            {activeView === 'active_tables' && renderActiveTablesView()}
            {activeView === 'history' && renderHistoryView()}
        </div>
    </div>
  );
};

export default POS;
