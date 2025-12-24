import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Search, X, Clock, Receipt, ArrowLeft, Check, LayoutGrid, Utensils, PlusCircle, Tag, Percent, QrCode, Coffee, ChevronUp, Wallet, Printer, CheckCircle2, FileText, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

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

const TABLE_ZONES = [
  { name: 'Ground Floor', tables: [1, 2, 3, 4, 5, 6, 7, 8] },
  { name: 'First Floor', tables: [9, 10, 11, 12, 13, 14, 15, 16] },
  { name: 'Outdoor', tables: [17, 18, 19, 20] },
];

const POS: React.FC<POSProps> = ({ orders, menuItems, onPlaceOrder, onUpdateOrder, onUpdatePayment, currentUserName, userRole }) => {
  const [activeView, setActiveView] = useState<'tables' | 'new_order'>('tables');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [occupiedTableId, setOccupiedTableId] = useState<number | null>(null);
  const [currentCart, setCurrentCart] = useState<LineItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isCartVisible, setIsCartVisible] = useState(false);
  
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const [manualTaxRate, setManualTaxRate] = useState<string>('5');
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');

  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(null);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  // Store profile and settings for receipt
  const [appSettings, setAppSettings] = useState({
    name: 'Bihari Chatkara',
    tagline: 'The Authentic Taste',
    address1: '',
    address2: '',
    phone: '',
    email: '',
    gstin: '',
    fssai: '',
    printerWidth: '80mm',
    printerFontSize: 'small',
    showGstinOnReceipt: true,
    showFssaiOnReceipt: true,
    showOrderDateTime: true,
    receiptHeaderMessage: '',
    receiptFooterMessage: 'Thank you! Visit again.',
    currencySymbol: '₹'
  });

  useEffect(() => {
    const savedReceipt = localStorage.getItem('rms_receipt_details');
    const savedPrefs = localStorage.getItem('rms_preferences');
    
    let merged = { ...appSettings };

    if (savedReceipt) {
      merged = { ...merged, ...JSON.parse(savedReceipt) };
    }
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      merged = { ...merged, ...prefs };
      if (prefs.defaultTaxRate) setManualTaxRate(prefs.defaultTaxRate.toString());
    }

    setAppSettings(merged);
  }, [lastCompletedOrder]); // Reload settings when order finishes to ensure latest profile

  const categories = useMemo(() => ['All', ...Array.from(new Set(menuItems.map(i => i.category))).sort()], [menuItems]);

  const calculateSubtotal = (items: LineItem[]) => {
    return items.reduce((acc, i) => acc + (Number(i.priceAtOrder) * Number(i.quantity)), 0);
  };

  const getOrderTotal = (items: LineItem[], discountStr: string, taxRateStr: string) => {
    const subtotal = calculateSubtotal(items);
    const discount = parseFloat(discountStr) || 0;
    const taxRate = parseFloat(taxRateStr) || 0;
    const taxable = Math.max(0, subtotal - discount);
    return taxable + (taxable * (taxRate / 100));
  };

  const addToCart = (id: string, name: string, price: number, portion: string = 'Full', qty: number = 1) => {
    setCurrentCart(prev => {
      const existing = prev.find(l => l.menuItemId === id && l.portion === portion);
      if (existing) {
        return prev.map(l => (l.menuItemId === id && l.portion === portion) ? { ...l, quantity: l.quantity + qty } : l);
      } else {
        return [...prev, { 
          id: `li-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
          menuItemId: id, 
          name, 
          quantity: qty, 
          priceAtOrder: price, 
          portion, 
          modifiers: [] 
        }];
      }
    });
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.available === false && userRole !== UserRole.MANAGER) return;
    const pPrices = item.portionPrices || {};
    const validPortionCount = Object.values(pPrices).filter(v => v !== undefined && v !== null && v !== 0).length;
    if (validPortionCount > 1) {
      setPortionItem(item);
    } else {
      const priceToUse = item.price || pPrices.full || 0;
      addToCart(item.id, item.name, Number(priceToUse));
    }
  };

  const handleAddQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(quickItemPrice);
    if (quickItemName && !isNaN(price)) {
      addToCart(`quick-${Date.now()}`, quickItemName, price);
      setQuickItemName(''); setQuickItemPrice(''); setShowQuickItemModal(false);
    }
  };

  const handleKitchenSend = () => {
    if (currentCart.length === 0) return;
    const order: Order = {
      id: editingOrder ? editingOrder.id : `o-${Date.now()}`,
      tableNumber: selectedTable || 0,
      serverName: currentUserName,
      items: currentCart,
      status: OrderStatus.NEW,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: editingOrder ? editingOrder.createdAt : new Date(),
      taxRate: parseFloat(manualTaxRate),
      discount: parseFloat(manualDiscount)
    };
    editingOrder ? onUpdateOrder(order) : onPlaceOrder(order);
    setOrderSentSuccess(true);
    setTimeout(() => {
        setOrderSentSuccess(false);
        resetOrderState();
        setActiveView('tables');
    }, 800);
  };

  const handleFinalizePayment = (method: PaymentMethod) => {
    const orderId = editingOrder ? editingOrder.id : `o-${Date.now()}`;
    const finalizedOrder: Order = {
        id: orderId,
        tableNumber: selectedTable || 0,
        serverName: currentUserName,
        items: [...currentCart],
        status: OrderStatus.SERVED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: method,
        createdAt: editingOrder ? editingOrder.createdAt : new Date(),
        completedAt: new Date(),
        taxRate: parseFloat(manualTaxRate),
        discount: parseFloat(manualDiscount)
    };

    if (!editingOrder) {
      onPlaceOrder(finalizedOrder);
    } else {
      onUpdateOrder(finalizedOrder);
      onUpdatePayment(orderId, method);
    }

    setLastCompletedOrder(finalizedOrder);
    setShowPaymentOptions(false);
  };

  const resetOrderState = () => {
    setCurrentCart([]); setManualDiscount('0'); setEditingOrder(null); setIsCartVisible(false); setSelectedTable(null); setLastCompletedOrder(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const getTableStatus = (t: number) => orders.find(o => o.tableNumber === t && o.paymentStatus === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED);

  const filteredItems = menuItems.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'All' || i.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const cartSubtotal = calculateSubtotal(currentCart);
  const cartTotal = getOrderTotal(currentCart, manualDiscount, manualTaxRate);

  // Map font size key to pixels
  const fontSizeMap = {
    small: '10px',
    medium: '12px',
    large: '14px'
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-50">
       {/* PRINTABLE RECEIPT TEMPLATE (RE-ALIGNED) */}
       <div 
         id="printable-receipt" 
         className="hidden print:block p-4 font-mono leading-tight bg-white text-black"
         style={{ 
            width: appSettings.printerWidth, 
            fontSize: fontSizeMap[appSettings.printerFontSize as keyof typeof fontSizeMap] 
         }}
       >
          <div className="text-center mb-4">
             {appSettings.receiptHeaderMessage && <p className="mb-1 italic">{appSettings.receiptHeaderMessage}</p>}
             <h1 className="text-lg font-bold uppercase">{appSettings.name}</h1>
             
             <div className="mt-1">
                {appSettings.address1 && <p>{appSettings.address1}</p>}
                {appSettings.address2 && <p>{appSettings.address2}</p>}
             </div>
             
             <div className="mt-2 flex flex-col items-center">
                 {appSettings.showGstinOnReceipt && appSettings.gstin && <p className="font-bold">GSTIN: {appSettings.gstin}</p>}
                 {appSettings.showFssaiOnReceipt && appSettings.fssai && <p className="font-bold">FSSAI: {appSettings.fssai}</p>}
             </div>

             {appSettings.phone && <p className="mt-1">Phone: {appSettings.phone}</p>}
          </div>

          <div className="border-b border-black border-dashed mb-2"></div>
          
          <div className="flex justify-between mb-1 font-bold">
             <span>Bill: #{lastCompletedOrder?.id.split('-').pop()}</span>
             <span>Table: {lastCompletedOrder?.tableNumber}</span>
          </div>
          
          {appSettings.showOrderDateTime && (
              <div className="flex justify-between mb-2">
                 <span>Date: {lastCompletedOrder && format(new Date(lastCompletedOrder.createdAt), 'dd/MM/yy HH:mm')}</span>
                 <span>By: {lastCompletedOrder?.serverName}</span>
              </div>
          )}

          <div className="border-b border-black border-dashed mb-2"></div>

          <table className="w-full text-left mb-2">
             <thead>
                <tr className="border-b border-black border-dotted">
                   <th className="py-1">Description</th>
                   <th className="text-right">Qty</th>
                   <th className="text-right">Amt</th>
                </tr>
             </thead>
             <tbody>
                {lastCompletedOrder?.items.map((item, idx) => (
                   <tr key={idx}>
                      <td className="py-1">
                          {item.name}
                          {item.portion !== 'Full' && <span className="block text-[0.8em]">({item.portion})</span>}
                      </td>
                      <td className="text-right align-top">{item.quantity}</td>
                      <td className="text-right align-top">{(item.priceAtOrder * item.quantity).toFixed(2)}</td>
                   </tr>
                ))}
             </tbody>
          </table>

          <div className="border-b border-black border-dashed mb-2"></div>

          <div className="space-y-1">
             <div className="flex justify-between"><span>Subtotal:</span><span>{appSettings.currencySymbol}{lastCompletedOrder ? calculateSubtotal(lastCompletedOrder.items).toFixed(2) : '0.00'}</span></div>
             {Number(lastCompletedOrder?.discount) > 0 && <div className="flex justify-between font-bold"><span>Discount:</span><span>-{appSettings.currencySymbol}{Number(lastCompletedOrder?.discount).toFixed(2)}</span></div>}
             <div className="flex justify-between"><span>GST ({lastCompletedOrder?.taxRate}%):</span><span>{appSettings.currencySymbol}{lastCompletedOrder ? (getOrderTotal(lastCompletedOrder.items, lastCompletedOrder.discount?.toString() || '0', lastCompletedOrder.taxRate?.toString() || '0') - (calculateSubtotal(lastCompletedOrder.items) - (lastCompletedOrder.discount || 0))).toFixed(2) : '0.00'}</span></div>
             <div className="flex justify-between font-bold text-base pt-1 border-t border-black border-dotted mt-1">
                <span>NET TOTAL:</span>
                <span>{appSettings.currencySymbol}{lastCompletedOrder ? getOrderTotal(lastCompletedOrder.items, lastCompletedOrder.discount?.toString() || '0', lastCompletedOrder.taxRate?.toString() || '0').toFixed(2) : '0.00'}</span>
             </div>
          </div>

          <div className="mt-4 border-b border-black border-dashed mb-2"></div>
          
          <div className="text-center font-bold uppercase mb-2">
             Paid via {lastCompletedOrder?.paymentMethod}
          </div>

          <div className="text-center mt-4">
             <p className="font-bold">{appSettings.receiptFooterMessage}</p>
             <p className="text-[0.7em] mt-3 opacity-50 italic">Powered by Bihari Chatkara Enterprise RMS</p>
          </div>
       </div>

       {activeView === 'tables' && (
           <div className="p-4 md:p-6 h-full overflow-y-auto">
               <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-6"><LayoutGrid className="text-orange-600" size={28} /> Dining Area</h2>
               <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                   {TABLE_ZONES.flatMap(z => z.tables).map(t => {
                       const active = getTableStatus(t);
                       return (
                           <button 
                                key={t} 
                                onClick={() => { if (active) setOccupiedTableId(t); else { setSelectedTable(t); setActiveView('new_order'); } }} 
                                className={`aspect-square rounded-3xl border-4 transition-all flex flex-col items-center justify-center p-4 relative active:scale-95 ${
                                    active ? 'bg-orange-50 border-orange-500 scale-105' : 'bg-white border-white hover:border-orange-100 shadow-sm'
                                }`}
                            >
                               <span className={`text-3xl font-black ${active ? 'text-slate-900' : 'text-slate-400'}`}>{t}</span>
                               {active && (
                                   <div className="mt-1 text-center">
                                       <span className="text-[10px] font-black text-orange-600 uppercase">ORDERED</span>
                                       <p className="text-xs font-black text-slate-800">₹{getOrderTotal(active.items, active.discount?.toString() || '0', active.taxRate?.toString() || '0').toFixed(0)}</p>
                                   </div>
                               )}
                           </button>
                       );
                   })}
               </div>
           </div>
       )}

       {activeView === 'new_order' && (
           <div className="flex flex-col lg:flex-row h-full overflow-hidden relative">
               <div className="flex-1 flex flex-col min-w-0 h-full p-3 md:p-4 lg:p-6 overflow-hidden">
                   <div className="flex gap-2 mb-3">
                       <button onClick={() => { setActiveView('tables'); resetOrderState(); }} className="p-2 bg-white border border-slate-200 rounded-xl flex-shrink-0 active:bg-slate-100"><ArrowLeft size={20}/></button>
                       <div className="relative flex-1">
                           <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                           <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none font-bold text-sm" />
                       </div>
                   </div>
                   <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1 flex-shrink-0">
                       {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full whitespace-nowrap text-[11px] font-black uppercase tracking-tight transition-all ${selectedCategory === c ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white text-slate-500 border border-slate-200'}`}>{c}</button>)}
                   </div>
                   <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 pb-24 lg:pb-0 auto-rows-max items-start">
                       {filteredItems.map(i => (
                            <div key={i.id} onClick={() => handleItemClick(i)} className={`bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-start h-fit min-h-[110px] active:scale-[0.98] active:bg-slate-50 ${i.available === false ? 'opacity-50 grayscale' : 'hover:border-orange-500 shadow-sm border-slate-200'}`}>
                                <div className="mb-2">
                                     <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg mb-1.5 flex items-center justify-center ${i.isVeg ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Utensils size={14} /></div>
                                     <h3 className="font-bold text-slate-800 text-xs md:text-sm leading-tight line-clamp-2">{i.name}</h3>
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                    <span className="font-black text-orange-600 text-sm md:text-base">₹{(Number(i.price || i.portionPrices?.full) || 0).toFixed(0)}</span>
                                    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                                        <Plus size={16}/>
                                    </div>
                                </div>
                                {i.available === false && <div className="absolute inset-0 bg-slate-50/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl md:rounded-2xl"><span className="bg-slate-800 text-white text-[9px] font-black px-2 py-1 rounded">SOLD OUT</span></div>}
                            </div>
                       ))}
                   </div>
               </div>

               <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
                    <button onClick={() => setIsCartVisible(!isCartVisible)} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center active:scale-95">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-600 p-2 rounded-lg relative">
                                <ShoppingCart size={20}/>
                                {currentCart.length > 0 && <span className="absolute -top-1 -right-1 bg-white text-orange-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{currentCart.length}</span>}
                            </div>
                            <span className="font-black text-lg">₹{cartTotal.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-widest text-slate-400">
                            {isCartVisible ? 'Close' : 'View Order'} <ChevronUp size={16} className={isCartVisible ? 'rotate-180' : ''} />
                        </div>
                    </button>
               </div>

               <div className={`${isCartVisible ? 'flex fixed inset-0 z-50 bg-white' : 'hidden lg:flex'} lg:relative lg:w-[400px] bg-white border-l border-slate-200 flex-col shadow-2xl overflow-hidden`}>
                   <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                       <h3 className="font-black text-xl flex items-center gap-2"><ShoppingCart className="text-orange-600"/> Table {selectedTable}</h3>
                       <div className="flex items-center gap-2">
                           <button onClick={() => setShowQuickItemModal(true)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1 text-xs font-black uppercase tracking-tight">
                               <PlusCircle size={18}/> Quick
                           </button>
                           <button onClick={() => setIsCartVisible(false)} className="lg:hidden text-slate-400 p-2 active:bg-slate-100 rounded-full"><X size={24}/></button>
                       </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-5 space-y-3">
                       {currentCart.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50"><Coffee size={48}/><p className="font-black text-sm uppercase tracking-tighter">Order is Empty</p></div>
                       ) : (
                           currentCart.map(i => (
                               <div key={i.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2">
                                   <div className="flex justify-between items-start">
                                       <span className="font-bold text-slate-800 text-sm leading-tight">{i.name}</span>
                                       <span className="font-black text-slate-900">₹{(i.priceAtOrder * i.quantity).toFixed(0)}</span>
                                   </div>
                                   <div className="flex justify-between items-center">
                                       <button onClick={() => setCurrentCart(prev => prev.filter(x => x.id !== i.id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                       <div className="flex items-center gap-4 bg-white px-3 py-1 rounded-lg border shadow-sm">
                                           <button onClick={() => setCurrentCart(prev => prev.map(x => x.id === i.id ? {...x, quantity: Math.max(1, x.quantity-1)} : x))} className="text-orange-600 font-black"><Minus size={16}/></button>
                                           <span className="font-black text-slate-800 min-w-[20px] text-center">{i.quantity}</span>
                                           <button onClick={() => setCurrentCart(prev => prev.map(x => x.id === i.id ? {...x, quantity: x.quantity+1} : x))} className="text-orange-600 font-black"><Plus size={16}/></button>
                                       </div>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>

                   <div className="p-6 border-t border-slate-100 space-y-4 shrink-0 pb-20 lg:pb-8">
                       <div className="flex justify-between font-black text-2xl border-b pb-4"><span>Total</span><span className="text-orange-600">₹{cartTotal.toFixed(0)}</span></div>
                       <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => setShowPaymentOptions(true)} disabled={currentCart.length === 0} className="py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 uppercase text-xs active:scale-95">Checkout</button>
                           <button onClick={handleKitchenSend} disabled={currentCart.length === 0} className="py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 uppercase text-xs active:scale-95">
                               {orderSentSuccess ? <Check size={20}/> : <Send size={18}/>} KDS
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* Payment Options Modal */}
       {showPaymentOptions && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="p-6 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                        <div>
                            <h3 className="text-2xl font-black">Final Payment</h3>
                            <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">Table {selectedTable} • {currentCart.length} Items</p>
                        </div>
                        <button onClick={() => setShowPaymentOptions(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Discount (₹)</label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-2.5 text-slate-300" size={16}/>
                                    <input type="number" value={manualDiscount} onChange={e => setManualDiscount(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" placeholder="0" />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tax Rate (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-2.5 text-slate-300" size={16}/>
                                    <input type="number" value={manualTaxRate} onChange={e => setManualTaxRate(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" placeholder="5" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-3 shadow-xl">
                            <div className="flex justify-between text-slate-400 font-bold uppercase text-xs tracking-tighter"><span>Subtotal</span><span>₹{cartSubtotal.toFixed(0)}</span></div>
                            {parseFloat(manualDiscount) > 0 && <div className="flex justify-between text-red-400 font-bold uppercase text-xs tracking-tighter"><span>Discount</span><span>-₹{parseFloat(manualDiscount).toFixed(0)}</span></div>}
                            <div className="flex justify-between text-slate-400 font-bold uppercase text-xs tracking-tighter"><span>GST ({manualTaxRate}%)</span><span>₹{(cartTotal - (cartSubtotal - parseFloat(manualDiscount))).toFixed(0)}</span></div>
                            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                <span className="text-xl font-black uppercase tracking-tighter">Total Due</span>
                                <span className="text-4xl font-black text-emerald-400">₹{cartTotal.toFixed(0)}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Select Payment Method</h4>
                            <div className="grid grid-cols-2 gap-3 pb-4">
                                <button onClick={() => handleFinalizePayment(PaymentMethod.CASH)} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 group">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-600 transition-colors"><Banknote size={32}/></div>
                                    <span className="font-black text-sm uppercase">Cash</span>
                                </button>
                                <button onClick={() => handleFinalizePayment(PaymentMethod.UPI)} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 group">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-600 transition-colors"><QrCode size={32}/></div>
                                    <span className="font-black text-sm uppercase">UPI / QR</span>
                                </button>
                                <button onClick={() => handleFinalizePayment(PaymentMethod.POS)} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 group">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-600 transition-colors"><CreditCard size={32}/></div>
                                    <span className="font-black text-sm uppercase">Card / POS</span>
                                </button>
                                <button onClick={() => handleFinalizePayment(PaymentMethod.ONLINE)} className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 group">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-600 transition-colors"><Wallet size={32}/></div>
                                    <span className="font-black text-sm uppercase">Wallet</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
       )}

       {/* Post-Payment Success Modal with Bill Check & PRINT */}
       {lastCompletedOrder && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
                <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="p-8 text-center bg-emerald-50 border-b border-emerald-100 shrink-0">
                        <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">Payment Successful</h3>
                        <p className="text-slate-500 text-sm font-medium">Table {lastCompletedOrder.tableNumber} • Bill No: {lastCompletedOrder.id.split('-').pop()}</p>
                    </div>
                    
                    {/* Check Bill Section */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex items-center gap-2 mb-4 text-slate-400">
                            <FileText size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Order Summary</span>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                            {lastCompletedOrder.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start py-1">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{item.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantity} x {item.portion}</p>
                                    </div>
                                    <span className="text-sm font-black text-slate-900">₹{(item.priceAtOrder * item.quantity).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span>Subtotal</span>
                                <span>₹{calculateSubtotal(lastCompletedOrder.items).toFixed(0)}</span>
                            </div>
                            {Number(lastCompletedOrder.discount) > 0 && (
                                <div className="flex justify-between text-xs font-bold text-red-500">
                                    <span>Discount</span>
                                    <span>-₹{Number(lastCompletedOrder.discount).toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span>GST ({lastCompletedOrder.taxRate}%)</span>
                                <span>₹{(getOrderTotal(lastCompletedOrder.items, lastCompletedOrder.discount?.toString() || '0', lastCompletedOrder.taxRate?.toString() || '0') - (calculateSubtotal(lastCompletedOrder.items) - (lastCompletedOrder.discount || 0))).toFixed(0)}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-black text-slate-800 uppercase text-xs">Grand Total</span>
                                <span className="text-xl font-black text-slate-900">₹{getOrderTotal(lastCompletedOrder.items, lastCompletedOrder.discount?.toString() || '0', lastCompletedOrder.taxRate?.toString() || '0').toFixed(0)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 border-t border-slate-100 shrink-0 space-y-3 bg-white">
                        <button 
                            onClick={handlePrint}
                            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 uppercase tracking-widest text-sm"
                        >
                            <Printer size={20} /> Print Bill
                        </button>
                        <button 
                            onClick={() => { setActiveView('tables'); resetOrderState(); }}
                            className="w-full py-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                        >
                            Back to Tables
                        </button>
                    </div>
                </div>
            </div>
       )}

       {showQuickItemModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] p-8 w-full max-sm shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black">Add Quick Item</h3>
                        <button onClick={() => setShowQuickItemModal(false)} className="text-slate-400 p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleAddQuickItem} className="space-y-5">
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 mb-2">Item Name</label>
                            <input autoFocus type="text" value={quickItemName} onChange={e => setQuickItemName(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 font-bold outline-none" placeholder="e.g. Special Sweet" required />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 mb-2">Price (₹)</label>
                            <input type="number" value={quickItemPrice} onChange={e => setQuickItemPrice(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 font-mono font-bold outline-none" placeholder="0" required />
                        </div>
                        <button type="submit" className="w-full py-4 bg-orange-600 text-white font-black rounded-xl shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all uppercase tracking-widest text-sm">Add to Order</button>
                    </form>
                </div>
            </div>
       )}

       {portionItem && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                    <div className="p-6 bg-orange-600 text-white flex justify-between items-center">
                        <h3 className="text-xl font-black">{portionItem.name}</h3>
                        <button onClick={() => setPortionItem(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={24}/></button>
                    </div>
                    <div className="p-4 space-y-2">
                        {(['full', 'half', 'quarter'] as const).map(p => {
                            const price = portionItem.portionPrices?.[p];
                            if (price === undefined || price === null) return null;
                            return (
                                <button 
                                    key={p} 
                                    onClick={() => { addToCart(portionItem.id, portionItem.name, price, p.charAt(0).toUpperCase() + p.slice(1)); setPortionItem(null); }}
                                    className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-orange-50 hover:border-orange-200 transition-all active:scale-95"
                                >
                                    <span className="font-bold text-slate-700 uppercase text-xs">{p} Portion</span>
                                    <span className="font-black text-slate-900">₹{price}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
       )}

       {occupiedTableId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white p-6 rounded-3xl w-full max-sm shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-2xl font-black mb-6 text-center">Table <span className="text-orange-600">{occupiedTableId}</span></h3>
                    <div className="space-y-3">
                        <button onClick={() => {
                            const active = getTableStatus(occupiedTableId!);
                            if (active) {
                                setSelectedTable(occupiedTableId); setEditingOrder(active);
                                setCurrentCart([...active.items]);
                                setManualDiscount(active.discount?.toString() || '0');
                                setManualTaxRate(active.taxRate?.toString() || '5');
                                setActiveView('new_order');
                            }
                            setOccupiedTableId(null);
                        }} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg uppercase text-sm active:scale-95">Add to Order</button>
                        <button onClick={() => setOccupiedTableId(null)} className="w-full py-3 text-slate-400 font-bold uppercase text-xs">Close</button>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};

export default POS;