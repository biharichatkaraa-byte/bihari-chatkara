
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../types';
import { format, formatDistance, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { 
    Search, Download, ChevronLeft, ChevronRight, 
    ArrowUpDown, ArrowUp, ArrowDown, Eye, FileText, 
    CheckCircle, XCircle, Clock, 
    User, Hash, X, ArrowRight, Filter
} from 'lucide-react';

interface OrderHistoryProps {
  orders: Order[];
}

type SortKey = keyof Order | 'totalAmount';
type SortDirection = 'asc' | 'desc';

const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('All');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('All');
  
  // Date & Time Filter State
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterTimeStart, setFilterTimeStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterTimeEnd, setFilterTimeEnd] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ 
      key: 'createdAt', 
      direction: 'desc' 
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // --- HELPERS ---
  const getOrderTotal = (order: Order) => {
      const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
      const discount = order.discount || 0;
      const taxAmount = Math.max(0, subtotal - discount) * ((order.taxRate || 0) / 100);
      return Math.max(0, subtotal - discount) + taxAmount;
  };

  const setQuickDate = (range: 'today' | 'yesterday' | 'month' | 'all') => {
      const now = new Date();
      setFilterTimeStart(''); // Reset time when using presets
      setFilterTimeEnd('');

      if (range === 'today') {
          const str = format(now, 'yyyy-MM-dd');
          setFilterDateStart(str);
          setFilterDateEnd(str);
      } else if (range === 'yesterday') {
          const str = format(subDays(now, 1), 'yyyy-MM-dd');
          setFilterDateStart(str);
          setFilterDateEnd(str);
      } else if (range === 'month') {
          setFilterDateStart(format(startOfMonth(now), 'yyyy-MM-dd'));
          setFilterDateEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
      } else {
          setFilterDateStart('');
          setFilterDateEnd('');
      }
      setCurrentPage(1);
  };

  const clearDateFilters = () => {
      setFilterDateStart('');
      setFilterDateEnd('');
      setFilterTimeStart('');
      setFilterTimeEnd('');
  };

  // --- FILTERING & SORTING ---
  const processedOrders = useMemo(() => {
      let data = [...orders];

      // 1. Search
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          data = data.filter(o => 
              o.id.toLowerCase().includes(lowerTerm) ||
              o.serverName.toLowerCase().includes(lowerTerm) ||
              (o.tableNumber && o.tableNumber.toString().includes(lowerTerm))
          );
      }

      // 2. Filters
      if (filterStatus !== 'All') {
          data = data.filter(o => o.status === filterStatus);
      }
      if (filterPaymentStatus !== 'All') {
          data = data.filter(o => o.paymentStatus === filterPaymentStatus);
      }
      if (filterPaymentMethod !== 'All') {
          data = data.filter(o => o.paymentMethod === filterPaymentMethod);
      }

      // 3. Date & Time Filtering
      if (filterDateStart) {
          const startDate = new Date(filterDateStart);
          if (filterTimeStart) {
              const [h, m] = filterTimeStart.split(':').map(Number);
              startDate.setHours(h, m, 0, 0);
          } else {
              startDate.setHours(0, 0, 0, 0);
          }
          data = data.filter(o => new Date(o.createdAt).getTime() >= startDate.getTime());
      }

      if (filterDateEnd) {
          const endDate = new Date(filterDateEnd);
          if (filterTimeEnd) {
              const [h, m] = filterTimeEnd.split(':').map(Number);
              endDate.setHours(h, m, 59, 999);
          } else {
              endDate.setHours(23, 59, 59, 999);
          }
          data = data.filter(o => new Date(o.createdAt).getTime() <= endDate.getTime());
      }

      // 4. Sorting
      return data.sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof Order];
          let bValue: any = b[sortConfig.key as keyof Order];

          if (sortConfig.key === 'totalAmount') {
              aValue = getOrderTotal(a);
              bValue = getOrderTotal(b);
          }

          if (typeof aValue === 'string') {
              aValue = aValue.toLowerCase();
              bValue = bValue.toLowerCase();
          } else if (aValue instanceof Date) {
              aValue = aValue.getTime();
              bValue = bValue.getTime();
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchTerm, filterStatus, filterPaymentStatus, filterPaymentMethod, filterDateStart, filterDateEnd, filterTimeStart, filterTimeEnd, sortConfig]);

  // --- PAGINATION ---
  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- HANDLERS ---
  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleExportCSV = () => {
      const headers = ["Order ID", "Date", "Time", "Table", "Server", "Items", "Subtotal", "Tax", "Discount", "Total", "Status", "Payment Status", "Payment Method"];
      const csvRows = [headers.join(",")];

      processedOrders.forEach(order => {
          const subtotal = order.items.reduce((acc, item) => acc + (item.priceAtOrder * item.quantity), 0);
          const total = getOrderTotal(order);
          const tax = total - Math.max(0, subtotal - (order.discount || 0));
          const itemsStr = order.items.map(i => `${i.quantity}x ${i.name}`).join("; ").replace(/"/g, '""');
          
          const row = [
              order.id,
              format(new Date(order.createdAt), 'yyyy-MM-dd'),
              format(new Date(order.createdAt), 'HH:mm'),
              order.tableNumber || 'Takeaway',
              `"${order.serverName}"`,
              `"${itemsStr}"`,
              subtotal.toFixed(2),
              tax.toFixed(2),
              (order.discount || 0).toFixed(2),
              total.toFixed(2),
              order.status,
              order.paymentStatus,
              order.paymentMethod || '-'
          ];
          csvRows.push(row.join(","));
      });

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `order_history_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- COMPONENTS ---
  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: SortKey, align?: string }) => (
      <th 
          className={`px-6 py-4 font-semibold text-slate-600 text-sm cursor-pointer hover:bg-slate-50 transition-colors select-none text-${align} whitespace-nowrap`}
          onClick={() => handleSort(sortKey)}
      >
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
              {label}
              {sortConfig.key === sortKey ? (
                  sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
              ) : (
                  <ArrowUpDown size={14} className="text-slate-300" />
              )}
          </div>
      </th>
  );

  const StatusBadge = ({ status }: { status: string }) => {
      let styles = 'bg-slate-100 text-slate-600 border-slate-200';
      let icon = null;

      switch(status) {
          case OrderStatus.NEW: styles = 'bg-blue-50 text-blue-700 border-blue-100'; icon = <Clock size={12}/>; break;
          case OrderStatus.IN_PROGRESS: styles = 'bg-yellow-50 text-yellow-700 border-yellow-100'; icon = <Clock size={12}/>; break;
          case OrderStatus.READY: styles = 'bg-purple-50 text-purple-700 border-purple-100'; icon = <CheckCircle size={12}/>; break;
          case OrderStatus.SERVED: styles = 'bg-green-50 text-green-700 border-green-100'; icon = <CheckCircle size={12}/>; break;
          case OrderStatus.CANCELLED: styles = 'bg-red-50 text-red-700 border-red-100'; icon = <XCircle size={12}/>; break;
          case PaymentStatus.PAID: styles = 'bg-emerald-50 text-emerald-700 border-emerald-100'; icon = <CheckCircle size={12}/>; break;
          case PaymentStatus.PENDING: styles = 'bg-amber-50 text-amber-700 border-amber-100'; icon = <Clock size={12}/>; break;
      }

      return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${styles} uppercase tracking-wide`}>
              {icon} {status}
          </span>
      );
  };

  return (
    <div className="h-full flex flex-col space-y-4 relative">
        {/* Header */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="text-blue-600" /> Order History
                </h2>
                <p className="text-slate-500 text-sm">Comprehensive log of all past orders and transactions.</p>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <Download size={16} /> Export View
                </button>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Filter size={16} className="text-slate-400 mr-1" />
                <span className="text-xs font-bold text-slate-500 uppercase mr-2">Quick Filters:</span>
                <button onClick={() => setQuickDate('today')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full font-medium transition-colors">Today</button>
                <button onClick={() => setQuickDate('yesterday')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full font-medium transition-colors">Yesterday</button>
                <button onClick={() => setQuickDate('month')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full font-medium transition-colors">This Month</button>
                <button onClick={() => setQuickDate('all')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full font-medium transition-colors">All Time</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Search - Spans 2 cols */}
                <div className="md:col-span-2 lg:col-span-2 relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search ID, Table, Server..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                {/* Status Filter */}
                <div>
                    <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">Status: All</option>
                        {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Payment Status Filter */}
                <div>
                    <select 
                        value={filterPaymentStatus}
                        onChange={(e) => setFilterPaymentStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">Payment: All</option>
                        {Object.values(PaymentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                    <select 
                        value={filterPaymentMethod}
                        onChange={(e) => setFilterPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="All">Method: All</option>
                        <option value={PaymentMethod.CASH}>Cash</option>
                        <option value={PaymentMethod.ONLINE}>Online / UPI</option>
                        <option value={PaymentMethod.PAYTM_POS}>Paytm POS</option>
                    </select>
                </div>
            </div>

            {/* Date and Time Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 pt-2 border-t border-slate-100 mt-2">
                <div className="flex flex-1 gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                        <input 
                            type="date" 
                            value={filterDateStart}
                            onChange={(e) => setFilterDateStart(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Time</label>
                        <input 
                            type="time" 
                            value={filterTimeStart}
                            onChange={(e) => setFilterTimeStart(e.target.value)}
                            disabled={!filterDateStart}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-center pt-6 text-slate-400">
                    <ArrowRight size={20} className="hidden md:block" />
                    <ArrowDown size={20} className="md:hidden md:rotate-90" />
                </div>

                <div className="flex flex-1 gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                        <input 
                            type="date" 
                            value={filterDateEnd}
                            onChange={(e) => setFilterDateEnd(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Time</label>
                        <input 
                            type="time" 
                            value={filterTimeEnd}
                            onChange={(e) => setFilterTimeEnd(e.target.value)}
                            disabled={!filterDateEnd}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
                        />
                    </div>
                    
                    {(filterDateStart || filterDateEnd) && (
                        <button 
                            onClick={clearDateFilters}
                            className="h-[38px] px-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg border border-red-100 transition-colors flex items-center justify-center"
                            title="Clear Date & Time Filters"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <SortHeader label="Order ID" sortKey="id" />
                            <SortHeader label="Date & Time" sortKey="createdAt" />
                            <SortHeader label="Table" sortKey="tableNumber" />
                            <SortHeader label="Server" sortKey="serverName" />
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Items Summary</th>
                            <SortHeader label="Total" sortKey="totalAmount" align="right" />
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedOrders.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-12 text-center text-slate-400 flex flex-col items-center justify-center w-full">
                                    <Search size={48} className="mb-4 opacity-20" />
                                    <p className="text-lg font-medium">No orders found.</p>
                                    <p className="text-sm">Try adjusting your filters.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedOrders.map(order => {
                                const total = getOrderTotal(order);
                                // Duration calculation
                                const start = new Date(order.createdAt);
                                const end = order.completedAt ? new Date(order.completedAt) : null;
                                const duration = end ? formatDistance(start, end) : 'In Progress';

                                return (
                                    <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                #{order.id.split('-')[1] || order.id}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{format(new Date(order.createdAt), 'MMM dd, yyyy')}</span>
                                                <span className="text-xs text-slate-500">{format(new Date(order.createdAt), 'hh:mm a')}</span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">Duration: {duration}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.tableNumber ? (
                                                <span className="font-bold text-slate-800 flex items-center gap-1"><Hash size={12}/> {order.tableNumber}</span>
                                            ) : (
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Takeaway</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {order.serverName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-[200px] truncate text-sm text-slate-600">
                                                {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                            </div>
                                            <span className="text-xs text-slate-400">{order.items.length} items</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                                            ₹{total.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <StatusBadge status={order.status} />
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 ml-1">
                                                    {order.paymentStatus === PaymentStatus.PAID ? <CheckCircle size={10} className="text-emerald-500"/> : <Clock size={10} className="text-amber-500"/>}
                                                    {order.paymentStatus}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => setSelectedOrder(order)}
                                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm group-hover:shadow-md"
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                    >
                        <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="text-sm text-slate-500 font-medium">Page {currentPage} of {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                Order #{selectedOrder.id.split('-')[1] || selectedOrder.id}
                            </h3>
                            <div className="flex gap-2 mt-2">
                                <StatusBadge status={selectedOrder.status} />
                                {selectedOrder.paymentStatus === PaymentStatus.PAID && (
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1">
                                        PAID via {selectedOrder.paymentMethod}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase">Date Created</p>
                                <p className="font-medium text-slate-700">{format(new Date(selectedOrder.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase">Table / Type</p>
                                <p className="font-medium text-slate-700">{selectedOrder.tableNumber ? `Table ${selectedOrder.tableNumber}` : 'Takeaway'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase">Server</p>
                                <p className="font-medium text-slate-700 flex items-center gap-1"><User size={12}/> {selectedOrder.serverName}</p>
                            </div>
                            {selectedOrder.completedAt && (
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Completed At</p>
                                    <p className="font-medium text-slate-700">{format(new Date(selectedOrder.completedAt), 'hh:mm a')}</p>
                                </div>
                            )}
                        </div>

                        <div className="border rounded-xl border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Item</th>
                                        <th className="px-4 py-2 text-center text-xs font-bold text-slate-500 uppercase">Qty</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-slate-500 uppercase">Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedOrder.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-700">{item.name}</p>
                                                {item.portion && item.portion !== 'Full' && (
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 rounded">{item.portion}</span>
                                                )}
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <p className="text-xs text-amber-600 italic mt-0.5">Note: {item.modifiers.join(', ')}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-700">₹{(item.priceAtOrder * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Subtotal</span>
                                <span>₹{selectedOrder.items.reduce((a,i) => a + (i.priceAtOrder*i.quantity), 0).toFixed(2)}</span>
                            </div>
                            {selectedOrder.discount && selectedOrder.discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>Discount</span>
                                    <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Tax ({selectedOrder.taxRate || 0}%)</span>
                                <span>₹{(getOrderTotal(selectedOrder) - (selectedOrder.items.reduce((a,i) => a + (i.priceAtOrder*i.quantity), 0) - (selectedOrder.discount||0))).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-300 pt-2 mt-2">
                                <span>Total Amount</span>
                                <span>₹{getOrderTotal(selectedOrder).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                        <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors">Close</button>
                        {selectedOrder.status !== OrderStatus.CANCELLED && (
                            <button className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2 shadow-lg" onClick={() => alert("Printing Receipt...")}>
                                <FileText size={16} /> Reprint Receipt
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default OrderHistory;
