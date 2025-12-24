import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Order, OrderStatus, MenuItem, UserRole } from '../types';
import { Clock, CheckCircle, Flame, AlertCircle, Lock, AlertTriangle, BellRing, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface KDSProps {
  orders: Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  userRole: UserRole;
  menuItems: MenuItem[];
}

const KDS: React.FC<KDSProps> = ({ orders, updateOrderStatus, userRole, menuItems }) => {
  const [now, setNow] = useState(new Date());
  const [confirmationOrder, setConfirmationOrder] = useState<{ order: Order, nextStatus: OrderStatus } | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  
  // Audio State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioAllowed, setAudioAllowed] = useState<boolean>(false);
  
  // Check for new orders strictly
  const hasNewOrders = useMemo(() => orders.some(o => o.status === OrderStatus.NEW), [orders]);

  // Initialize Audio Context on Mount
  useEffect(() => {
    // Ticker updated every 10 seconds for high precision relative time
    const timer = setInterval(() => setNow(new Date()), 10000); 
    
    // @ts-ignore - Safari support
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;
        
        // Check initial state
        if (ctx.state === 'running') {
            setAudioAllowed(true);
        }

        // Listen for state changes (e.g., if system suspends it)
        ctx.onstatechange = () => {
            setAudioAllowed(ctx.state === 'running');
        };
    }

    return () => {
        clearInterval(timer);
        // Clean up audio context
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close();
        }
    };
  }, []);

  // Function to play sound
  const playKitchenBell = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      
      // If browser suspended it, mark as not allowed so UI shows the button
      if (ctx.state === 'suspended') {
          setAudioAllowed(false);
          return;
      }

      try {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          // Clear, crisp "Ding" sound (High C -> Drop)
          oscillator.type = 'triangle'; 
          oscillator.frequency.setValueAtTime(1200, ctx.currentTime); 
          oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1); 

          // Quick attack, longer decay
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 1.5);
      } catch (e) {
          console.error("Audio Play Error:", e);
      }
  };

  const handleEnableAudio = () => {
      const ctx = audioCtxRef.current;
      if (ctx) {
          ctx.resume().then(() => {
              setAudioAllowed(true);
              playKitchenBell(); // Test sound immediately
          });
      }
  };

  // Ringing Logic - Depends ONLY on hasNewOrders boolean, not the orders array itself
  useEffect(() => {
      let ringInterval: ReturnType<typeof setInterval>;

      if (hasNewOrders) {
          setIsRinging(true);
          playKitchenBell(); // Immediate play
          
          // Repeat every 4 seconds
          ringInterval = setInterval(() => {
              playKitchenBell();
          }, 4000);
      } else {
          setIsRinging(false);
      }

      return () => {
          if (ringInterval) clearInterval(ringInterval);
      }
  }, [hasNewOrders]); 

  const canManageOrders = userRole === UserRole.MANAGER || userRole === UserRole.CHEF;

  const getTicketColor = (createdAt: Date | string, status: OrderStatus) => {
    if (status === OrderStatus.READY) return 'border-green-500 bg-green-50';
    
    let created;
    try {
        created = new Date(createdAt);
    } catch(e) { return 'border-blue-200 bg-white'; }

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
          setProcessingOrderId(order.id);
          updateOrderStatus(order.id, nextStatus);
          // Unconditionally clear processing status after delay to ensure UI doesn't hang
          setTimeout(() => {
              setProcessingOrderId(null);
          }, 800);
      }
  };

  const confirmAction = () => {
      if (confirmationOrder) {
          setProcessingOrderId(confirmationOrder.order.id);
          updateOrderStatus(confirmationOrder.order.id, confirmationOrder.nextStatus);
          setConfirmationOrder(null);
          setTimeout(() => setProcessingOrderId(null), 800);
      }
  };

  // Filter active orders: Not SERVED and Not CANCELLED
  const activeOrders = orders
    .filter(o => o.status !== OrderStatus.SERVED && o.status !== OrderStatus.CANCELLED)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="h-full flex flex-col relative">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
                {!canManageOrders ? (
                    <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-lg text-yellow-800 text-sm flex items-center justify-center gap-2">
                        <Lock size={14} /> View Only Mode: Only Chefs and Managers can update order status.
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
                        Kitchen Display System • {activeOrders.length} Active Tickets
                        
                        {/* Audio Status Indicator */}
                        {isRinging && !audioAllowed && (
                            <button 
                                onClick={handleEnableAudio}
                                className="flex items-center gap-2 text-white font-bold animate-pulse px-3 py-1.5 bg-red-600 rounded-lg shadow-lg hover:bg-red-700 transition-colors ml-4"
                                title="Browser blocked audio. Click to enable."
                            >
                                <VolumeX size={18} /> CLICK TO ENABLE SOUND
                            </button>
                        )}
                        
                        {isRinging && audioAllowed && (
                             <div className="flex items-center gap-1 text-green-600 font-bold px-3 py-1.5 bg-green-100 rounded-lg border border-green-200 ml-4">
                                 <Volume2 size={18} className="animate-bounce" /> RINGING
                             </div>
                        )}
                        
                        {!isRinging && audioAllowed && (
                             <button onClick={() => playKitchenBell()} className="text-slate-400 hover:text-blue-500 transition-colors" title="Test Sound">
                                 <BellRing size={16} />
                             </button>
                        )}
                    </div>
                )}
            </div>
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
                                         <AlertCircle size={14} className="text-amber-500" />
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
                                disabled={!canManageOrders || processingOrderId === order.id}
                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform animate-pulse flex items-center justify-center gap-2"
                            >
                                {processingOrderId === order.id ? <Loader2 size={18} className="animate-spin" /> : null}
                                {processingOrderId === order.id ? 'Starting...' : 'Start Cooking (Stop Ringing)'}
                            </button>
                        )}
                        {order.status === OrderStatus.IN_PROGRESS && (
                            <button 
                                onClick={() => handleAction(order, OrderStatus.READY)}
                                disabled={!canManageOrders || processingOrderId === order.id}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                {processingOrderId === order.id ? <Loader2 size={18} className="animate-spin" /> : null}
                                Mark Ready
                            </button>
                        )}
                        {order.status === OrderStatus.READY && (
                            <button 
                                onClick={() => handleAction(order, OrderStatus.SERVED)}
                                disabled={!canManageOrders || processingOrderId === order.id}
                                className="w-full py-3 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded shadow active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                {processingOrderId === order.id ? <Loader2 size={18} className="animate-spin" /> : null}
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
                            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                            Confirm & Update
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default KDS;