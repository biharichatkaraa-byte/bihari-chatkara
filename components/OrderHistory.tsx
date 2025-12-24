
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { 
    Search, Download, ChevronLeft, ChevronRight, 
    ArrowUpDown, ArrowUp, ArrowDown, Eye, FileText, 
    CheckCircle, XCircle, Clock, 
    User, Hash, X, ArrowRight, Filter, MessageSquare, Tag, Info, Receipt, 
    Banknote, Smartphone, CreditCard, Printer, TrendingUp, DollarSign, Calendar, FileSpreadsheet, QrCode
} from 'lucide-react';

interface OrderHistoryProps {
  orders: Order[];
}

type SortKey = keyof Order | 'totalAmount';
type SortDirection = 'asc' | 'desc';

const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('All');
  const [filterDateStart, setFilterDateStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterDateEnd, setFilterDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getOrderTotal = (order: Order) => {
      const subtotal = order.items.reduce((acc, item) => acc + (Number(item.priceAtOrder) * Number(item.quantity)), 0);
      const discount = Number(order.discount || 0);
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = taxable * ((Number(order.taxRate) || 0) / 100);
      return taxable + taxAmount;
  };

  const getOrderSubtotal = (order: Order) => {
      return order.items.reduce((acc, item) => acc + (Number(item.priceAtOrder) * Number(item.quantity)), 0);
  };

  const getOrderTax = (order: Order) => {
      const subtotal = getOrderSubtotal(order);
      const discount = Number(order.discount || 0);
      return Math.max(0, subtotal - discount) * ((Number(order.taxRate) || 0) / 100);
  };

  const processedOrders = useMemo(() => {
      let data = [...orders];
      
      // Search
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          data = data.filter(o => 
              o.id.toLowerCase().includes(lowerTerm) || 
              o.serverName.toLowerCase().includes(lowerTerm) || 
              o.tableNumber.toString().includes(lowerTerm) ||
              o.items.some(i => i.name?.toLowerCase().includes(lowerTerm))
          );
      }

      // Status Filter
      if (filterStatus !== 'All') {
          data = data.filter(o => o.status === filterStatus);
      }

      // Payment Method Filter
      if (filterPaymentMethod !== 'All') {
          data = data.filter(o => o.paymentMethod === filterPaymentMethod);
      }

      // Date Range Filter
      if (filterDateStart && filterDateEnd) {
          const start = startOfDay(new Date(filterDateStart));
          const end = endOfDay(new Date(filterDateEnd));
          data = data.filter(o => isWithinInterval(new Date(o.createdAt), { start, end }));
      }
      
      // Sorting
      return data.sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof Order];
          let bValue: any = b[sortConfig.key as keyof Order];
          
          if (sortConfig.key === 'totalAmount') { 
              aValue = getOrderTotal(a); 
              bValue = getOrderTotal(b); 
          }
          
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchTerm, filterStatus, filterPaymentMethod, filterDateStart, filterDateEnd, sortConfig]);

  // Totals for the summary bar
  const summary = useMemo(() => {
      return processedOrders.reduce((acc, order) => {
          if (order.paymentStatus === PaymentStatus.PAID) {
              acc.total += getOrderTotal(order);
              acc.tax += getOrderTax(order);
              acc.discount += Number(order.discount || 0);
              acc.count += 1;
          }
          return acc;
      }, { total: 0, tax: 0, discount: 0, count: 0 });
  }, [processedOrders]);

  const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);

  const getMethodIcon = (method?: PaymentMethod) => {
      switch (method) {
          case PaymentMethod.CASH: return <Banknote size={14} className="text-emerald-600" />;
          case PaymentMethod.UPI: return <QrCode size={14} className="text-blue-600" />;
          // Fix: Changed PAYTM_POS to POS to match the enum definition in types.ts.
          case PaymentMethod.POS: return <Smartphone size={14} className="text-indigo-600" />;
          case PaymentMethod.ONLINE: return <CreditCard size={14} className="text-purple-600" />;
          default: return <Clock size={14} className="text-slate-400" />;
      }
  };

  const handleDownloadReport = () => {
    const headers = "Order ID,Date,Table,Server,Items,Subtotal,Discount,Tax,Total,Method,Status\n";
    const csvContent = processedOrders.map(o => {
        const date = format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm');
        const items = o.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
        const subtotal = getOrderSubtotal(o);
        const discount = o.discount || 0;
        const tax = getOrderTax(o);
        const total = getOrderTotal(o);
        return `"${o.id}","${date}",${o.tableNumber},"${o.serverName}","${items}",${subtotal},${discount},${tax},${total},"${o.paymentMethod || 'PENDING'}","${o.status}"`;
    }).join("\n");

    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order_report_${filterDateStart}_to_${filterDateEnd}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col space-y-4">
        {/* Financial Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Journal Revenue</p>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={18}/></div>
                    <span className="text-2xl font-black text-slate-800">₹{summary.total.toLocaleString('en-IN')}</span>
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tax Collected</p>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Receipt size={18}/></div>
                    <span className="text-2xl font-black text-slate-800">₹{summary.tax.toLocaleString('en-IN')}</span>
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Discount</p>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Tag size={18}/></div>
                    <span className="text-2xl font-black text-slate-800">₹{summary.discount.toLocaleString('en-IN')}</span>
                </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Count</p>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><TrendingUp size={18}/></div>
                    <span className="text-2xl font-black text-slate-800">{summary.count}</span>
                </div>
            </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Search Orders</label>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="ID, Table, Server or Dish..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-medium"
                    />
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">From Date</label>
                <input 
                    type="date" 
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-medium"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">To Date</label>
                <input 
                    type="date" 
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-medium"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Method</label>
                <select 
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-medium appearance-none min-w-[100px]"
                >
                    <option value="All">All</option>
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={handleDownloadReport} 
                  title="Download CSV Report"
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 font-bold text-xs"
                >
                    <FileSpreadsheet size={20}/> <span className="hidden md:inline">DOWNLOAD REPORT</span>
                </button>
                <button onClick={() => window.print()} className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-black transition-colors shadow-lg"><Printer size={20}/></button>
            </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 flex-1 overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b-2 border-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Order Ref</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Date & Time</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Table</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Items</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Payment</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Net Amount</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Status</th>
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedOrders.length === 0 ? (
                            <tr><td colSpan={8} className="p-20 text-center text-slate-400 font-bold">No matching journal entries found.</td></tr>
                        ) : (
                            paginatedOrders.map(order => (
                                <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs font-black text-blue-600">#{order.id.split('-')[1] || order.id}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{order.serverName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">{format(new Date(order.createdAt), 'dd MMM yyyy')}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(order.createdAt), 'hh:mm a')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="w-8 h-8 rounded-full bg-slate-100 inline-flex items-center justify-center font-black text-slate-600 border border-slate-200">{order.tableNumber}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-[180px]">
                                            <p className="text-xs font-bold text-slate-700 truncate" title={order.items.map(i => i.name).join(', ')}>
                                                {order.items.map(i => i.name).join(', ')}
                                            </p>
                                            <p className="text-[9px] text-slate-400 uppercase font-black">{order.items.length} dishes</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getMethodIcon(order.paymentMethod)}
                                            <span className="text-xs font-bold text-slate-600">{order.paymentMethod || 'NOT PAID'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-lg font-black text-slate-900">₹{(Number(getOrderTotal(order)) || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                            order.status === OrderStatus.SERVED ? 'bg-green-100 text-green-700' :
                                            order.status === OrderStatus.CANCELLED ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => setSelectedOrder(order)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-all shadow-sm">
                                            <Eye size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t-2 border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <button 
                        disabled={currentPage === 1} 
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="p-2 rounded-lg border bg-white disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft size={20}/>
                    </button>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                    <button 
                        disabled={currentPage === totalPages} 
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="p-2 rounded-lg border bg-white disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                        <ChevronRight size={20}/>
                    </button>
                </div>
            )}
        </div>

        {/* Enhanced Receipt Modal */}
        {selectedOrder && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black flex items-center gap-2"><Receipt className="text-orange-500"/> Order Snapshot</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Ref: {selectedOrder.id}</p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                    
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                        {/* Meta */}
                        <div className="grid grid-cols-2 gap-4 pb-6 border-b border-dashed border-slate-200">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Server</p>
                                <p className="font-bold text-slate-800">{selectedOrder.serverName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Table</p>
                                <p className="font-bold text-slate-800">#{selectedOrder.tableNumber}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Placed At</p>
                                <p className="font-bold text-slate-800">{format(new Date(selectedOrder.createdAt), 'hh:mm:ss a')}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Method</p>
                                <p className="font-bold text-slate-800">{selectedOrder.paymentMethod || 'NOT PAID'}</p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dish Breakdown</h4>
                            {selectedOrder.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start bg-slate-50 p-3 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center text-xs font-black">{item.quantity}</span>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{item.portion || 'Full'}</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-slate-900">₹{(Number(item.priceAtOrder) * Number(item.quantity)).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Final Calc */}
                        <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-2 relative overflow-hidden">
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>Subtotal</span>
                                <span>₹{getOrderSubtotal(selectedOrder).toFixed(0)}</span>
                            </div>
                            {selectedOrder.discount! > 0 && (
                                <div className="flex justify-between text-red-400 text-sm">
                                    <span>Discount Applied</span>
                                    <span>-₹{Number(selectedOrder.discount).toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-400 text-sm">
                                <span>GST ({selectedOrder.taxRate}%)</span>
                                <span>₹{getOrderTax(selectedOrder).toFixed(0)}</span>
                            </div>
                            <div className="pt-4 mt-2 border-t border-white/10 flex justify-between items-center">
                                <span className="text-xl font-black">NET TOTAL</span>
                                <span className="text-3xl font-black text-orange-500">₹{getOrderTotal(selectedOrder).toFixed(0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default OrderHistory;
