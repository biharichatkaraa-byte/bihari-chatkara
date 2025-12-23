import React, { useState, useEffect, useMemo } from 'react';
import { MenuItem, Order, OrderStatus, PaymentStatus, LineItem, PaymentMethod, UserRole } from '../types';
import { Plus, Minus, Trash2, Send, CreditCard, ShoppingCart, Banknote, Smartphone, Search, X, Clock, CheckCircle, Receipt, AlertCircle, Zap, Ban, Eye, EyeOff, Power, Printer, Pencil, Save, ChevronUp, ChevronDown, ArrowLeft, Check, LayoutGrid, Utensils, Timer, SkipForward, MessageSquare, TabletSmartphone, Loader2 } from 'lucide-react';
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

const TABLE_ZONES = [
  { name: 'Ground Floor', tables: [1, 2, 3, 4, 5, 6, 7, 8] },
  { name: 'First Floor', tables: [9, 10, 11, 12, 13, 14, 15, 16] },
  { name: 'Outdoor', tables: [17, 18, 19, 20] },
];

const safeDate = (d: any): Date => {
    if (!d) return new Date();
    const date = new Date(d);
    return isNaN(date.getTime()) ? new Date() : date;
};

const POS: React.FC<POSProps> = ({ orders, menuItems, onPlaceOrder, onUpdateOrder, onUpdatePayment, onUpdateMenuItem, currentUserName, userRole }) => {
  const [activeView, setActiveView] = useState<'tables' | 'new_order' | 'history'>('tables');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [occupiedTableId, setOccupiedTableId] = useState<number | null>(null);
  const [currentCart, setCurrentCart] = useState<LineItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'method' | 'cash'>('method');
  const [cashTendered, setCashTendered] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [manualTaxRate, setManualTaxRate] = useState<string>('');
  const [manualDiscount, setManualDiscount] = useState<string>('');
  const [portionItem, setPortionItem] = useState<MenuItem | null>(null);
  const [selectedPortionType, setSelectedPortionType] = useState<PortionType>('Full');
  const [portionQuantity, setPortionQuantity] = useState<number>(1);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [cartCustomName, setCartCustomName] = useState('');
  const [cartCustomPrice, setCartCustomPrice] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);
  const [isPaytmProcessing, setIsPaytmProcessing] = useState(false);
  const [isEditingReceipt, setIsEditingReceipt] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState({
      name: 'Bihari Chatkara', tagline: 'The Authentic Taste',
      address1: 'Part-1, LG Floor, Sapphire Arcade, AT-004', address2: 'Sector-45, Noida, UP 201303',
      phone: '+91 8595709271', gstin: '09IBKPK8468R1Z8', fssai: '22723925000849'
  });

  useEffect(() => {
      const saved = localStorage.getItem('rms_receipt_details');
      if (saved) setReceiptDetails(prev => ({ ...prev, ...JSON.parse(saved) }));
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(menuItems.map(i => i.category))).sort()], [menuItems]);
  const subCategories = useMemo(() => selectedCategory === 'All' ? [] : Array.from(new Set(menuItems.filter(i => i.category === selectedCategory && i.subCategory).map(i => i.subCategory!))).sort(), [menuItems, selectedCategory]);

  const getPortionPrice = (item: MenuItem, portion: PortionType): number => {
      if (item.portionPrices) {
          const p = portion.toLowerCase() as keyof typeof item.portionPrices;
          if (item.portionPrices[p] && Number(item.portionPrices[p])! > 0) return Number(item.portionPrices[p])!;
      }
      if (portion === 'Full') return Number(item.price || 0);
      if (portion === 'Half') return Math.ceil(Number(item.price || 0) * 0.6);
      return 0;
  };

  const repairItems = (items: LineItem[]): LineItem[] => {
      return items.map(item => {
          let price = Number(item.priceAtOrder) || 0;
          if (price === 0 && item.menuItemId && !item.menuItemId.startsWith('custom-')) {
              const menuMatch = menuItems.find(m => m.id === item.menuItemId);
              if (menuMatch) {
                  price = getPortionPrice(menuMatch, (item.portion as PortionType) || 'Full');
              }
          }
          return { ...item, priceAtOrder: price };
      });
  };

  const getOrderTotal = (order: Order) => {
      const subtotal = repairItems(order.items).reduce((acc, i) => acc + (Number(i.priceAtOrder) * Number(i.quantity)), 0);
      const taxable = Math.max(0, subtotal - Number(order.discount || 0));
      return taxable + (taxable * (Number(order.taxRate || 0) / 100));
  };

  const addToCart = (item: MenuItem, portion: string, price: number, qty: number = 1) => {
    const existing = currentCart.find(l => l.menuItemId === item.id && l.portion === portion);
    if (existing) {
      setCurrentCart(currentCart.map(l => (l.menuItemId === item.id && l.portion === portion) ? { ...l, quantity: Number(l.quantity) + qty } : l));
    } else {
      setCurrentCart([...currentCart, { id: `l-${Date.now()}-${Math.random()}`, menuItemId: item.id, name: item.name, quantity: qty, priceAtOrder: price, portion, modifiers: [] }]);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (!item.available && userRole !== UserRole.MANAGER) return;
    const hasPortions = item.portionPrices && (Number(item.portionPrices.half) > 0 || Number(item.portionPrices.quarter) > 0);
    if (hasPortions) { setPortionItem(item); setSelectedPortionType('Full'); setPortionQuantity(1); }
    else { addToCart(item, 'Full', Number(item.price)); }
  };

  const constructOrderObject = (status = OrderStatus.NEW, pStatus = PaymentStatus.PENDING, method?: PaymentMethod): Order => ({
      id: editingOrder ? editingOrder.id : `o-${Math.floor(Math.random() * 10000)}`,
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

  const handlePayment = (method: PaymentMethod) => {
    if (currentCart.length === 0) return;
    const order = constructOrderObject(editingOrder?.status || OrderStatus.NEW, PaymentStatus.PAID, method);
    editingOrder ? onUpdateOrder(order) : onPlaceOrder(order);
    resetOrderState(); setPrintOrder(order); setShowPrintModal(true);
    setActiveView('tables'); setSelectedTable(null);
  };

  const resetOrderState = () => {
    setCurrentCart([]); setShowPaymentOptions(false); setPaymentStep('method');
    setCashTendered(''); setManualTaxRate(''); setManualDiscount(''); setEditingOrder(null);
  };

  const getTableStatus = (t: number) => orders.find(o => o.tableNumber === t && o.paymentStatus === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED);

  const handleTableClick = (t: number) => {
      const active = getTableStatus(t);
      if (active) setOccupiedTableId(t);
      else { setSelectedTable(t); setEditingOrder(null); setActiveView('new_order'); }
  };

  const handleOccupiedAction = (action: 'add' | 'settle') => {
      const active = getTableStatus(occupiedTableId!);
      if (active) {
          setSelectedTable(occupiedTableId);
          setEditingOrder(active);
          setCurrentCart(repairItems([...active.items]));
          setManualTaxRate(active.taxRate?.toString() || '');
          setManualDiscount(active.discount?.toString() || '');
          if (action === 'settle') setShowPaymentOptions(true);
          setActiveView('new_order');
      }
      setOccupiedTableId(null);
  };

  const filteredItems = menuItems.filter(i => {
      if (!showSoldOut && !i.available) return false;
      return (selectedCategory === 'All' || i.category === selectedCategory) && 
             (selectedSubCategory === 'All' || i.subCategory === selectedSubCategory) && 
             i.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderTablesView = () => (
      <div className="h-full bg-slate-50 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2"><LayoutGrid className="text-blue-600" /> Tables</h2>
              <button onClick={() => setActiveView('history')} className="bg-white border p-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Clock size={16} /> History</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {TABLE_ZONES.flatMap(z => z.tables).map(t => {
                  const active = getTableStatus(t);
                  return (
                      <button key={t} onClick={() => handleTableClick(t)} className={`h-32 rounded-2xl border-2 flex flex-col items-center justify-center p-2 shadow-sm ${active ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                          <span className="text-2xl font-black">{t}</span>
                          {active && (
                              <div className="mt-1 text-center">
                                  <span className="text-xs font-bold text-orange-600">₹{(Number(getOrderTotal(active)) || 0).toFixed(0)}</span>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1"><Timer size={10} />{formatDistanceToNow(safeDate(active.createdAt)).replace('about ', '')}</div>
                              </div>
                          )}
                      </button>
                  );
              })}
          </div>
          {occupiedTableId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="bg-white p-6 rounded-2xl w-80">
                      <h3 className="text-xl font-bold mb-4">Table {occupiedTableId}</h3>
                      <div className="space-y-3">
                          <button onClick={() => handleOccupiedAction('add')} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">Add Items</button>
                          <button onClick={() => handleOccupiedAction('settle')} className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2">Settle Bill</button>
                          <button onClick={() => setOccupiedTableId(null)} className="w-full py-2 text-slate-500">Close</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  return (
    <div className="h-full w-full">
       {activeView === 'tables' && renderTablesView()}
       {activeView === 'new_order' && (
           <div className="flex h-full gap-4 p-4 overflow-hidden">
               <div className="flex-1 flex flex-col min-w-0">
                   <div className="flex gap-2 mb-4">
                       <button onClick={() => setActiveView('tables')} className="p-2 bg-white border rounded-lg"><ArrowLeft size={20}/></button>
                       <div className="relative flex-1">
                           <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                           <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm" />
                       </div>
                   </div>
                   <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                       {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-bold ${selectedCategory === c ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600'}`}>{c}</button>)}
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1">
                       {filteredItems.map(i => (
                           <div key={i.id} onClick={() => handleItemClick(i)} className="bg-white p-3 rounded-xl border hover:border-blue-500 cursor-pointer shadow-sm flex flex-col justify-between">
                               <h3 className="font-bold text-sm leading-tight">{i.name}</h3>
                               <div className="flex justify-between items-center mt-2">
                                   <span className="font-black text-slate-900">₹{(Number(i.price) || 0).toFixed(0)}</span>
                                   <Plus size={16} className="text-blue-600"/>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
               <div className="w-96 bg-white border rounded-2xl flex flex-col shadow-xl overflow-hidden">
                   <div className="p-4 border-b bg-slate-50">
                       <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart size={20}/> Table {selectedTable}</h3>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                       {currentCart.map(i => (
                           <div key={i.id} className="p-3 bg-slate-50 border rounded-xl relative group">
                               <div className="flex justify-between">
                                   <span className="font-bold text-sm">{i.name} {i.portion !== 'Full' && `(${i.portion})`}</span>
                                   <span className="font-bold">₹{(Number(i.priceAtOrder) * Number(i.quantity)).toFixed(0)}</span>
                               </div>
                               <div className="flex justify-between items-center mt-2">
                                   <button onClick={() => setCurrentCart(currentCart.filter(x => x.id !== i.id))} className="text-red-500"><Trash2 size={14}/></button>
                                   <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border">
                                       <button onClick={() => setCurrentCart(currentCart.map(x => x.id === i.id ? {...x, quantity: Math.max(1, Number(x.quantity)-1)} : x))}><Minus size={14}/></button>
                                       <span className="font-bold text-xs">{i.quantity}</span>
                                       <button onClick={() => setCurrentCart(currentCart.map(x => x.id === i.id ? {...x, quantity: Number(x.quantity)+1} : x))}><Plus size={14}/></button>
                                   </div>
                               </div>
                           </div>
                       ))}
                   </div>
                   <div className="p-4 bg-white border-t space-y-3">
                       <div className="flex justify-between font-black text-xl"><span>Total</span><span>₹{(Number(repairItems(currentCart).reduce((a,c) => a + (Number(c.priceAtOrder) * Number(c.quantity)), 0)) || 0).toFixed(0)}</span></div>
                       <div className="grid grid-cols-2 gap-2">
                           <button onClick={() => setShowPaymentOptions(true)} className="py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg">Pay Now</button>
                           <button onClick={handleKitchenSend} className="py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">KDS {orderSentSuccess ? '✓' : 'Send'}</button>
                       </div>
                   </div>
               </div>
           </div>
       )}
       {showPaymentOptions && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
               <div className="bg-white p-6 rounded-2xl w-96">
                   <div className="flex justify-between mb-4"><h3 className="font-bold">Payment</h3><button onClick={() => setShowPaymentOptions(false)}><X/></button></div>
                   <div className="grid grid-cols-1 gap-3">
                       <button onClick={() => handlePayment(PaymentMethod.CASH)} className="py-4 bg-green-50 border-2 border-green-200 rounded-xl font-bold flex items-center justify-center gap-2 text-green-700"><Banknote/> Cash Payment</button>
                       <button onClick={() => handlePayment(PaymentMethod.ONLINE)} className="py-4 bg-purple-50 border-2 border-purple-200 rounded-xl font-bold flex items-center justify-center gap-2 text-purple-700"><Smartphone/> Online / UPI</button>
                       <button onClick={() => handlePayment(PaymentMethod.PAYTM_POS)} className="py-4 bg-blue-50 border-2 border-blue-900 rounded-xl font-bold flex items-center justify-center gap-2 text-blue-900"><TabletSmartphone/> Paytm POS</button>
                   </div>
               </div>
           </div>
       )}
       {showPrintModal && printOrder && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
               <div id="printable-receipt" className="bg-white p-4 w-80 font-mono text-sm">
                   <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
                       <h4 className="text-lg font-black">{receiptDetails.name}</h4>
                       <p className="text-xs">{receiptDetails.tagline}</p>
                       <p className="text-[10px]">{receiptDetails.address1}, {receiptDetails.address2}</p>
                   </div>
                   {printOrder.items.map((i, idx) => (
                       <div key={idx} className="flex justify-between mb-1">
                           <span>{i.name} x{i.quantity}</span>
                           <span>₹{(Number(i.priceAtOrder) * Number(i.quantity)).toFixed(0)}</span>
                       </div>
                   ))}
                   <div className="border-t-2 border-dashed border-black pt-2 mt-4 font-black text-lg flex justify-between">
                       <span>TOTAL</span>
                       <span>₹{(Number(getOrderTotal(printOrder)) || 0).toFixed(2)}</span>
                   </div>
                   <button onClick={() => window.print()} className="mt-8 w-full py-2 bg-black text-white font-bold rounded print-hidden">Print Receipt</button>
                   <button onClick={() => setShowPrintModal(false)} className="mt-2 w-full py-1 text-slate-400 print-hidden">Close</button>
               </div>
           </div>
       )}
    </div>
  );
};

export default POS;