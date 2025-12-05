
import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderStatus, MenuItem, UserRole } from '../types';
import { Clock, CheckCircle, Flame, AlertCircle, Lock, AlertTriangle, ChefHat, BookOpen, X, Sparkles, Loader2, Info, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { generateChefRecipe } from '../services/geminiService';

interface KDSProps {
  orders: Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  userRole: UserRole;
  menuItems: MenuItem[];
}

const KDS: React.FC<KDSProps> = ({ orders, updateOrderStatus, userRole, menuItems }) => {
  const [now, setNow] = useState(new Date());
  const [confirmationOrder, setConfirmationOrder] = useState<{ order: Order, nextStatus: OrderStatus } | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  
  // Chef AI State
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeDish, setRecipeDish] = useState('');
  const [recipeLang, setRecipeLang] = useState('English');
  const [recipeResult, setRecipeResult] = useState('');
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);

  // Sound Logic
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60); // Update every minute for relative time
    return () => clearInterval(timer);
  }, []);

  // Check for New Orders and Play Sound loop
  useEffect(() => {
      if (!isSoundEnabled) return;

      const hasNewOrders = orders.some(o => o.status === OrderStatus.NEW);
      let interval: any = null;

      if (hasNewOrders) {
          // Play immediately
          playAlertSound();
          // Loop every 5 seconds until accepted
          interval = setInterval(() => {
              playAlertSound();
          }, 5000);
      }

      return () => {
          if (interval) clearInterval(interval);
      }
  }, [orders, isSoundEnabled]);

  const playAlertSound = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => console.log("Audio play failed (interaction needed)", e));
          }
      }
  };

  const canManageOrders = userRole === UserRole.MANAGER || userRole === UserRole.CHEF;

  const getTicketColor = (createdAt: Date | string, status: OrderStatus) => {
    if (status === OrderStatus.READY) return 'border-green-500 bg-green-50';
    
    const created = new Date(createdAt);
    const mins = (now.getTime() - created.getTime()) / 60000;
    
    // Prioritization Logic: Flash Red if > 15 mins (Urgent/Late)
    if (mins > 15 && status !== OrderStatus.SERVED) return 'border-red-500 bg-red-50 animate-flash-red ring-4 ring-red-200';
    if (mins > 15) return 'border-red-500 bg-red-50'; // Static red if ready but old?
    if (mins > 10) return 'border-yellow-500 bg-yellow-50';
    return 'border-blue-200 bg-white';
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.NEW: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase animate-pulse">New</span>;
      case OrderStatus.IN_PROGRESS: return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1"><Flame size={10} /> Cooking</span>;
      case OrderStatus.READY: return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1"><CheckCircle size={10} /> Ready</span>;
      default: return null;
    }
  };

  const handleAction = (order: Order, nextStatus: OrderStatus) => {
      // Require confirmation for finishing actions (To prevent accidental deletion/loss)
      if (nextStatus === OrderStatus.READY || nextStatus === OrderStatus.SERVED) {
          setConfirmationOrder({ order, nextStatus });
      } else {
          updateOrderStatus(order.id, nextStatus);
      }
  };

  const confirmAction = () => {
      if (confirmationOrder) {
          updateOrderStatus(confirmationOrder.order.id, confirmationOrder.nextStatus);
          setConfirmationOrder(null);
      }
  };

  const handleGenerateRecipe = async () => {
      if (!recipeDish) return;
      setIsGeneratingRecipe(true);
      setRecipeResult('');
      const result = await generateChefRecipe(recipeDish, recipeLang);
      setRecipeResult(result);
      setIsGeneratingRecipe(false);
  };

  // Filter active orders: Not SERVED and Not CANCELLED
  const activeOrders = orders
    .filter(o => o.status !== OrderStatus.SERVED && o.status !== OrderStatus.CANCELLED)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="h-full flex flex-col relative">
        {/* Valid Beep Sound (Short Sine Wave) */}
        <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" />

        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
                {!canManageOrders ? (
                    <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-lg text-yellow-800 text-sm flex items-center justify-center gap-2">
                        <Lock size={14} /> View Only Mode: Only Chefs and Managers can update order status.
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 font-medium">
                        Kitchen Display System • {activeOrders.length} Active Tickets
                    </div>
                )}
                
                {/* Sound Toggle */}
                <button 
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isSoundEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                    title="Enable Kitchen Ring for New Orders"
                >
                    {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {isSoundEnabled ? 'Alerts On' : 'Alerts Off'}
                </button>
            </div>
            
            <button 
                onClick={() => setShowRecipeModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md transition-all active:scale-95"
            >
                <Sparkles size={18} className="text-yellow-300" /> Chef Recipe AI
            </button>
        </div>

        <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 pb-4 min-w-max h-full items-start p-1">
            {activeOrders.length === 0 && (
                <div className="w-full h-96 flex flex-col items-center justify-center text-slate-400">
                    <CheckCircle size={64} className="mb-4 opacity-20" />
                    <h3 className="text-xl font-medium">All caught up!</h3>
                    <p>No active orders in the kitchen.</p>
                </div>
            )}

            {activeOrders.map(order => (
                <div 
                key={order.id} 
                className={`w-80 flex-shrink-0 border-t-4 rounded-lg shadow-sm flex flex-col ${getTicketColor(order.createdAt, order.status)} transition-all duration-500 transform animate-in slide-in-from-right-4 fade-in`}
                style={{ maxHeight: '75vh' }}
                >
                <div className="p-4 border-b border-black/5">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-2xl text-slate-800">#{order.tableNumber}</span>
                        <div className="flex flex-col items-end">
                            {getStatusBadge(order.status)}
                            <span className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-1">
                                <Clock size={10} />
                                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Server: {order.serverName}</div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                    {order.items.map(item => {
                        // Prefer the snapshotted name on the order item, fallback to menu lookup
                        const displayName = item.name || menuItems.find(m => m.id === item.menuItemId)?.name || 'Custom Item';
                        const hasModifiers = item.modifiers && item.modifiers.length > 0;
                        
                        return (
                            <div key={item.id} className="flex flex-col">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <span className="bg-slate-200 w-6 h-6 rounded flex items-center justify-center text-sm">{item.quantity}</span> 
                                        {displayName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                     <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                         Size: {item.portion || 'Full'}
                                     </span>
                                     {hasModifiers && (
                                         <Info size={14} className="text-amber-500" />
                                     )}
                                </div>
                                {hasModifiers && item.modifiers!.map((mod, idx) => (
                                    <span key={idx} className="text-red-600 text-sm font-bold flex items-center gap-1 pl-8 mt-1">
                                        <AlertCircle size={12} /> {mod}
                                    </span>
                                ))}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-black/5 bg-black/5 mt-auto">
                    <div className="grid grid-cols-1 gap-2">
                        {order.status === OrderStatus.NEW && (
                            <button 
                                onClick={() => handleAction(order, OrderStatus.IN_PROGRESS)}
                                disabled={!canManageOrders}
                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform"
                            >
                                Start Cooking
                            </button>
                        )}
                        {order.status === OrderStatus.IN_PROGRESS && (
                            <button 
                                onClick={() => handleAction(order, OrderStatus.READY)}
                                disabled={!canManageOrders}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform"
                            >
                                Mark Ready
                            </button>
                        )}
                        {order.status === OrderStatus.READY && (
                            <button 
                                onClick={() => handleAction(order, OrderStatus.SERVED)}
                                disabled={!canManageOrders}
                                className="w-full py-3 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform"
                            >
                                Order Served (Clear)
                            </button>
                        )}
                    </div>
                </div>
                </div>
            ))}
            </div>
        </div>

        {/* Confirmation Modal (Safety Dialog) */}
        {confirmationOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-lg">
                    <div className="flex items-center gap-3 text-amber-600 mb-4">
                        <div className="p-2 bg-amber-100 rounded-full">
                             <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Confirm Action</h3>
                    </div>
                    
                    <div className="mb-6">
                        <p className="text-slate-600 mb-2">Are you sure you want to mark Table <span className="font-bold">#{confirmationOrder.order.tableNumber}</span> as <span className="font-bold uppercase text-slate-800">{confirmationOrder.nextStatus}</span>?</p>
                        {confirmationOrder.nextStatus === OrderStatus.SERVED && (
                            <p className="text-xs text-slate-400">This will remove the ticket from the KDS view.</p>
                        )}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-500 mt-2">
                             {confirmationOrder.order.items.length} Items: <br/>
                             {confirmationOrder.order.items.map(i => {
                                 const displayName = i.name || menuItems.find(x => x.id === i.menuItemId)?.name || 'Custom Item';
                                 return <span key={i.id} className="block pl-2">• {i.quantity}x {displayName}</span>
                             })}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setConfirmationOrder(null)}
                            className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmAction}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg"
                        >
                            Confirm & Update
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* CHEF RECIPE AI MODAL */}
        {showRecipeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                <ChefHat size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Chef's Recipe Assistant</h3>
                                <p className="text-sm text-slate-500">Instant preparation guides in any language</p>
                            </div>
                        </div>
                        <button onClick={() => setShowRecipeModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dish Name</label>
                                <input 
                                    type="text" 
                                    value={recipeDish}
                                    onChange={(e) => setRecipeDish(e.target.value)}
                                    placeholder="e.g. Chicken Tikka Masala, Risotto"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Language</label>
                                <select 
                                    value={recipeLang}
                                    onChange={(e) => setRecipeLang(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                >
                                    <option value="English">English</option>
                                    <option value="Hindi">Hindi</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="Bengali">Bengali</option>
                                    <option value="Mandarin">Mandarin</option>
                                    <option value="Arabic">Arabic</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            onClick={handleGenerateRecipe}
                            disabled={!recipeDish || isGeneratingRecipe}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-6"
                        >
                            {isGeneratingRecipe ? <Loader2 size={20} className="animate-spin" /> : <BookOpen size={20} />}
                            {isGeneratingRecipe ? 'Consulting Knowledge Base...' : 'Generate Recipe'}
                        </button>

                        {recipeResult && (
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 prose prose-slate max-w-none">
                                <h4 className="text-lg font-bold text-slate-800 mb-2 border-b border-slate-200 pb-2">
                                    Recipe for: <span className="text-indigo-600">{recipeDish}</span>
                                </h4>
                                <div className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-medium">
                                    {recipeResult}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default KDS;
