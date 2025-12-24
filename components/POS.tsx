import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Smartphone, Search, X, Clock, Receipt, AlertCircle, ArrowLeft, Check, LayoutGrid, Utensils, PlusCircle, Tag, Percent, QrCode, Coffee } from 'lucide-react';
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

const POS: React.FC<POSProps> = ({ orders, menuItems, onPlaceOrder, onUpdateOrder, currentUserName, userRole }) => {
  const [activeView, setActiveView] = useState<'tables' | 'new_order' | 'history'>('tables');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [occupiedTableId, setOccupiedTableId] = useState<number | null>(null);
  const [currentCart, setCurrentCart] = useState<LineItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const [manualTaxRate, setManualTaxRate] = useState<string>('5');
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  const [receiptDetails, setReceiptDetails] = useState({
    name: 'Bihari Chatkara', tagline: 'The Authentic Taste',
    address1: 'Part-1, LG Floor, Sapphire Arcade, AT-004', address2: 'Sector-45, Noida, UP 201303',
    phone: '+91 8595709271', gstin: '09IBKPK8468R1Z8', fssai: '22723925000849'
  });

  useEffect(() => {
    const saved = localStorage.getItem('rms_receipt_details');
    if (saved) setReceiptDetails(prev => ({ ...prev, ...JSON.parse(saved) }));
    const savedPrefs = localStorage.getItem('rms_preferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      if (prefs.defaultTaxRate) setManualTaxRate(prefs.defaultTaxRate.toString());
    }
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(menuItems.map(i => i.category))).sort()], [menuItems]);

  const repairItems = (items: LineItem[]): LineItem[] => {
    return items.map(item => ({
      ...item,
      priceAtOrder: Number(item.priceAtOrder) || 0,
      quantity: Number(item.quantity) || 1
    }));
  };

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
    const existing = currentCart.find(l => l.menuItemId === id && l.portion === portion);
    if (existing) {
      setCurrentCart(currentCart.map(l => (l.menuItemId === id && l.portion === portion) ? { ...l, quantity: l.quantity + qty } : l));
    } else {
      setCurrentCart([...currentCart, { id: `l-${Date.now()}-${Math.floor(Math.random() * 1000)}`, menuItemId: id, name, quantity: qty, priceAtOrder: price, portion, modifiers: [] }]);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.available === false && userRole !== UserRole.MANAGER) {
      return;
    }
    const hasPortions = item.portionPrices && (Object.values(item.portionPrices).filter(v => v !== undefined).length > 1);
    if (hasPortions) { setPortionItem(item); } else { addToCart(item.id, item.name, Number(item.price) || 0); }
  };

  const handleAddQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(quickItemPrice);
    if (quickItemName && !isNaN(price)) {
      addToCart(`quick-${Date.now()}`, quickItemName, price);
      setQuickItemName(''); setQuickItemPrice(''); setShowQuickItemModal(false);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCurrentCart(prev => prev.map(item => item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeFromCart = (itemId: string) => {
    setCurrentCart(prev => prev.filter(item => item.id !== itemId));
  };

  const constructOrderObject = (status = OrderStatus.NEW, pStatus = PaymentStatus.PENDING, method?: PaymentMethod): Order => ({
    id: editingOrder ? editingOrder.id : `o-${Math.floor(Math.random() * 9000) + 1000}`,
    tableNumber: selectedTable || 0,
    serverName: currentUserName,
    items: repairItems(currentCart),
    status, paymentStatus: pStatus, paymentMethod: method,
    createdAt: editingOrder ? editingOrder.createdAt : new Date(),
    taxRate: parseFloat(manualTaxRate) || 0,
    discount: parseFloat(manualDiscount) || 0,
  });

  const handleKitchenSend = () => {
    if (currentCart.length === 0) return;
    const order = constructOrderObject(editingOrder?.status || OrderStatus.NEW);
    editingOrder ? onUpdateOrder(order) : onPlaceOrder(order);
    resetOrderState(); setOrderSentSuccess(true);
    setTimeout(() => { setOrderSentSuccess(false); setActiveView('tables'); setSelectedTable(null); }, 1500);
  };

  const handlePayment = (method?: PaymentMethod) => {
    if (currentCart.length === 0) return;
    const pStatus = method ? PaymentStatus.PAID : PaymentStatus.PENDING;
    const targetStatus = method ? OrderStatus.SERVED : (editingOrder?.status || OrderStatus.NEW);
    const order = constructOrderObject(targetStatus, pStatus, method);
    editingOrder ? onUpdateOrder(order) : onPlaceOrder(order);
    resetOrderState(); setPrintOrder(order); setShowPrintModal(true);
    setActiveView('tables'); setSelectedTable(null);
  };

  const resetOrderState = () => {
    setCurrentCart([]); setManualTaxRate('5'); setManualDiscount('0'); setEditingOrder(null);
  };

  const getTableStatus = (t: number) => orders.find(o => o.tableNumber === t && o.paymentStatus === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED);

  const filteredItems = menuItems.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'All' || i.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="h-full w-full bg-slate-50 overflow-hidden flex flex-col">
       {activeView === 'tables' && (
           <div className="p-6 h-full overflow-y-auto">
               <div className="flex justify-between items-center mb-8">
                   <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3"><LayoutGrid className="text-orange-600" size={32} /> Dining Area</h2>
                   <button onClick={() => setActiveView('history')} className="bg-white border-2 border-slate-200 px-6 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm font-bold hover:bg-slate-50 transition-all text-slate-700 active:scale-95"><Clock size={18} /> History</button>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                   {TABLE_ZONES.flatMap(z => z.tables).map(t => {
                       const active = getTableStatus(t);
                       const isReady = active?.status === OrderStatus.READY;
                       return (
                           <button 
                                key={t} 
                                onClick={() => { if (active) setOccupiedTableId(t); else { setSelectedTable(t); setActiveView('new_order'); } }} 
                                className={`aspect-square rounded-[2.5rem] border-4 transition-all flex flex-col items-center justify-center p-4 relative shadow-sm ${
                                    isReady 
                                    ? 'bg-emerald-50 border-emerald-500 scale-105 shadow-emerald-200' 
                                    : active 
                                    ? 'bg-orange-50 border-orange-500 scale-105 shadow-orange-200' 
                                    : 'bg-white border-white hover:border-orange-200 hover:translate-y-[-4px]'
                                }`}
                            >
                               <span className={`text-4xl font-black ${active ? 'text-slate-900' : 'text-slate-400'}`}>{t}</span>
                               {active && (
                                   <div className="mt-2 text-center">
                                       <span className={`text-xs font-black uppercase tracking-widest ${isReady ? 'text-emerald-600' : 'text-orange-600'}`}>
                                           {isReady ? 'READY' : 'ORDERED'}
                                       </span>
                                       <p className="text-sm font-black text-slate-800">₹{getOrderTotal(active.items, active.discount?.toString() || '0', active.taxRate?.toString() || '0').toFixed(0)}</p>
                                   </div>
                               )}
                               {!active && <span className="absolute bottom-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Open</span>}
                           </button>
                       );
                   })}
               </div>
           </div>
       )}

       {occupiedTableId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
                <div className="bg-white p-8 rounded-[3rem] w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-3xl font-black mb-8 text-center text-slate-800">Table <span className="text-orange-600">{occupiedTableId}</span></h3>
                    <div className="space-y-4">
                        <button onClick={() => {
                            const active = getTableStatus(occupiedTableId!);
                            if (active) {
                                setSelectedTable(occupiedTableId); setEditingOrder(active);
                                setCurrentCart(repairItems([...active.items]));
                                setManualTaxRate(active.taxRate?.toString() || '5');
                                setManualDiscount(active.discount?.toString() || '0');
                                setActiveView('new_order');
                            }
                            setOccupiedTableId(null);
                        }} className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-700 shadow-xl transition-all uppercase tracking-tight">Modify Order</button>
                        
                        <button onClick={() => {
                            const active = getTableStatus(occupiedTableId!);
                            if (active) {
                                setSelectedTable(occupiedTableId); setEditingOrder(active);
                                setCurrentCart(repairItems([...active.items]));
                                setManualTaxRate(active.taxRate?.toString() || '5');
                                setManualDiscount(active.discount?.toString() || '0');
                                setShowPaymentOptions(true); setActiveView('new_order');
                            }
                            setOccupiedTableId(null);
                        }} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-xl transition-all uppercase tracking-tight">Checkout Bill</button>
                        
                        <button onClick={() => setOccupiedTableId(null)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]">Close</button>
                    </div>
                </div>
            </div>
       )}

       {activeView === 'new_order' && (
           <div className="flex h-full gap-4 p-4 overflow-hidden">
               <div className="flex-1 flex flex-col min-w-0">
                   <div className="flex gap-3 mb-4">
                       <button onClick={() => { setActiveView('tables'); resetOrderState(); }} className="p-3 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"><ArrowLeft size={24}/></button>
                       <div className="relative flex-1">
                           <Search className="absolute left-4 top-3.5 text-orange-500" size={20}/>
                           <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus:border-orange-500 outline-none transition-all text-lg font-bold" />
                       </div>
                   </div>
                   <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                       {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)} className={`px-6 py-2.5 rounded-xl whitespace-nowrap text-sm font-black tracking-tight transition-all ${selectedCategory === c ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-600 border-2 border-slate-100 hover:bg-slate-50'}`}>{c}</button>)}
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20">
                       {filteredItems.map(i => (
                            <div key={i.id} onClick={() => handleItemClick(i)} className={`bg-white p-5 rounded-3xl border-2 transition-all cursor-pointer group flex flex-col relative overflow-hidden ${i.available === false ? 'opacity-50 grayscale bg-slate-50 border-slate-200' : 'hover:border-orange-500 hover:shadow-xl border-white shadow-sm'}`}>
                                {i.available === false && <div className="absolute top-0 right-0 bg-slate-800 text-white text-[8px] font-black px-2 py-1 rounded-bl-xl z-10">SOLD OUT</div>}
                                <div className="mb-4">
                                     <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${i.isVeg ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                         <Utensils size={20} />
                                     </div>
                                     <h3 className="font-black text-slate-800 text-base leading-tight flex-1">{i.name}</h3>
                                </div>
                                <div className="flex justify-between items-center mt-auto">
                                    <span className="font-black text-orange-600 text-xl">₹{(Number(i.price) || 0).toFixed(0)}</span>
                                    <div className={`p-2 rounded-xl transition-all ${i.available === false ? 'bg-slate-200 text-slate-400' : 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'}`}><Plus size={20}/></div>
                                </div>
                            </div>
                       ))}
                   </div>
               </div>

               <div className="w-[420px] bg-white border-2 border-slate-100 rounded-[3rem] flex flex-col shadow-2xl overflow-hidden">
                   <div className="p-6 border-b-2 border-slate-50 bg-slate-50/50 flex justify-between items-center">
                       <h3 className="font-black text-xl flex items-center gap-2 text-slate-800"><ShoppingCart size={24} className="text-orange-600"/> Table {selectedTable}</h3>
                       <button onClick={() => setShowQuickItemModal(true)} className="text-orange-600 hover:text-orange-700 flex items-center gap-1 font-bold text-xs uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-xl"><PlusCircle size={16}/> Quick</button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-5 space-y-4">
                       {currentCart.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-slate-200">
                               <Coffee size={80} className="mb-4 opacity-20"/><p className="font-black text-lg uppercase tracking-tighter">Cart is Empty</p>
                           </div>
                       ) : (
                           currentCart.map(i => (
                               <div key={i.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl relative animate-in fade-in slide-in-from-right-4 shadow-sm flex flex-col gap-3">
                                   <div className="flex justify-between items-start">
                                       <div>
                                            <span className="font-black text-slate-800 text-sm">{i.name}</span>
                                            {i.portion && <p className="text-[10px] font-black text-orange-600 uppercase mt-0.5">{i.portion}</p>}
                                       </div>
                                       <span className="font-black text-slate-900">₹{(i.priceAtOrder * i.quantity).toFixed(0)}</span>
                                   </div>
                                   <div className="flex justify-between items-center mt-1">
                                       <button onClick={() => removeFromCart(i.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                       <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-inner">
                                           <button onClick={() => updateQuantity(i.id, -1)} className="text-orange-600 font-black hover:scale-125 transition-transform"><Minus size={18}/></button>
                                           <span className="font-black text-slate-800 min-w-[20px] text-center text-lg">{i.quantity}</span>
                                           <button onClick={() => updateQuantity(i.id, 1)} className="text-orange-600 font-black hover:scale-125 transition-transform"><Plus size={18}/></button>
                                       </div>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>

                   <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1"><Tag size={10}/> Discount (₹)</label>
                            <input type="number" value={manualDiscount} onChange={e => setManualDiscount(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0" />
                        </div>
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1"><Percent size={10}/> GST (%)</label>
                            <input type="number" value={manualTaxRate} onChange={e => setManualTaxRate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" placeholder="5" />
                        </div>
                   </div>

                   <div className="p-8 bg-white border-t-2 border-slate-50 space-y-4">
                       <div className="flex justify-between font-black text-3xl text-slate-900 border-b pb-4">
                           <span>Total</span>
                           <span className="text-orange-600">₹{getOrderTotal(currentCart, manualDiscount, manualTaxRate).toFixed(0)}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4 pt-2">
                           <button onClick={() => setShowPaymentOptions(true)} disabled={currentCart.length === 0} className="py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-wider text-sm">Checkout</button>
                           <button onClick={handleKitchenSend} disabled={currentCart.length === 0} className="py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-sm">
                               {orderSentSuccess ? <Check size={24}/> : <Send size={20}/>} Send KDS
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* Quick Item Modal */}
       {showQuickItemModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
                <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black">Add Quick Item</h3>
                        <button onClick={() => setShowQuickItemModal(false)} className="text-slate-400 p-2 hover:bg-slate-50 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleAddQuickItem} className="space-y-5">
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 mb-2">Item Name</label>
                            <input autoFocus type="text" value={quickItemName} onChange={e => setQuickItemName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 font-bold" placeholder="e.g. Special Dessert" required />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-slate-400 mb-2">Price (₹)</label>
                            <input type="number" value={quickItemPrice} onChange={e => setQuickItemPrice(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 font-mono font-bold" placeholder="0" required />
                        </div>
                        <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all uppercase tracking-widest">Add to Cart</button>
                    </form>
                </div>
            </div>
       )}

       {/* Portion Selection Modal */}
       {portionItem && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                    <div className="p-8 bg-brand-gradient text-white relative">
                        <button onClick={() => setPortionItem(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                                <Utensils size={28} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black">{portionItem.name}</h3>
                                <p className="text-orange-100 text-xs font-bold uppercase tracking-widest">Select Portion</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 space-y-4 bg-white">
                        {(['full', 'half', 'quarter'] as const).map(p => {
                            const price = portionItem.portionPrices?.[p] || (p === 'full' ? portionItem.price : undefined);
                            if (price === undefined) return null;
                            return (
                                <button key={p} onClick={() => { addToCart(portionItem.id, portionItem.name, price, p.charAt(0).toUpperCase() + p.slice(1)); setPortionItem(null); }} className="w-full flex items-center justify-between p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-orange-500 hover:bg-orange-50 transition-all group">
                                    <div className="text-left">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-orange-500">{p}</p>
                                        <p className="text-xl font-black text-slate-800">Portion Size</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl font-black text-slate-900">₹{price}</span>
                                        <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-colors"><Plus size={24}/></div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
       )}

       {showPaymentOptions && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
               <div className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in-95">
                   <h3 className="text-2xl font-black mb-8 text-center text-slate-800 uppercase tracking-tight">Settlement Method</h3>
                   <div className="grid grid-cols-1 gap-4">
                       <button onClick={() => { handlePayment(PaymentMethod.CASH); setShowPaymentOptions(false); }} className="flex items-center justify-between px-8 py-5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-lg group transition-all">
                           <div className="flex items-center gap-3"><Banknote size={24} /> <span>CASH</span></div>
                           <Plus size={20} className="opacity-0 group-hover:opacity-100" />
                       </button>
                       <button onClick={() => { handlePayment(PaymentMethod.UPI); setShowPaymentOptions(false); }} className="flex items-center justify-between px-8 py-5 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 shadow-lg group transition-all">
                           <div className="flex items-center gap-3"><QrCode size={24} /> <span>UPI / QR</span></div>
                           <Plus size={20} className="opacity-0 group-hover:opacity-100" />
                       </button>
                       <button onClick={() => { handlePayment(PaymentMethod.POS); setShowPaymentOptions(false); }} className="flex items-center justify-between px-8 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-lg group transition-all">
                           <div className="flex items-center gap-3"><CreditCard size={24} /> <span>CARD / POS</span></div>
                           <Plus size={20} className="opacity-0 group-hover:opacity-100" />
                       </button>
                       <button onClick={() => setShowPaymentOptions(false)} className="mt-4 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600">Cancel Settlement</button>
                   </div>
               </div>
           </div>
       )}

       {showPrintModal && printOrder && (
           <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl animate-in fade-in">
               <div id="printable-receipt" className="bg-white p-8 w-[80mm] shadow-2xl font-mono text-sm rounded-lg relative">
                   <div className="text-center border-b-4 border-double border-slate-200 pb-6 mb-6">
                       <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{receiptDetails.name}</h4>
                       <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{receiptDetails.tagline}</p>
                       <p className="text-[9px] text-slate-400 mt-2">{receiptDetails.address1}, {receiptDetails.address2}</p>
                   </div>
                   <div className="space-y-2 mb-6">
                       {printOrder.items.map((i, idx) => (
                           <div key={idx} className="flex justify-between items-start text-xs">
                               <span className="max-w-[75%] font-bold text-slate-700">{i.quantity} x {i.name} {i.portion ? `(${i.portion})` : ''}</span>
                               <span className="font-black text-slate-900 whitespace-nowrap">₹{(i.priceAtOrder * i.quantity).toFixed(0)}</span>
                           </div>
                       ))}
                   </div>
                   <div className="border-t-2 border-dashed border-slate-200 py-3 space-y-1">
                        <div className="flex justify-between text-[10px]"><span>Subtotal</span><span>₹{calculateSubtotal(printOrder.items).toFixed(0)}</span></div>
                        {printOrder.discount > 0 && <div className="flex justify-between text-[10px]"><span>Discount</span><span>-₹{printOrder.discount.toFixed(0)}</span></div>}
                        <div className="flex justify-between text-[10px]"><span>GST ({printOrder.taxRate}%)</span><span>₹{(Math.max(0, calculateSubtotal(printOrder.items) - (printOrder.discount || 0)) * (printOrder.taxRate / 100)).toFixed(0)}</span></div>
                   </div>
                   <div className="border-t-4 border-double border-slate-200 pt-4 font-black text-xl flex justify-between text-slate-900">
                       <span>TOTAL</span>
                       <span>₹{getOrderTotal(printOrder.items, printOrder.discount?.toString() || '0', printOrder.taxRate?.toString() || '0').toFixed(0)}</span>
                   </div>
                   <div className="mt-4 pt-4 text-center border-t border-dashed border-slate-200">
                       <p className="text-[9px] font-black uppercase tracking-widest">{printOrder.paymentStatus === PaymentStatus.PAID ? `PAID VIA ${printOrder.paymentMethod}` : 'BILLING ONLY - UNPAID'}</p>
                       <p className="text-[8px] text-slate-400 mt-1">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
                   </div>
                   <div className="mt-12 space-y-3 print-hidden">
                       <button onClick={() => window.print()} className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs">Print Receipt</button>
                       <button onClick={() => { setShowPrintModal(false); setActiveView('tables'); }} className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 text-xs">Return to Tables</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default POS;