
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Order, Expense, UserRole, MenuItem, Ingredient, PaymentStatus, OrderStatus, PaymentMethod } from '../types';
import { DollarSign, TrendingDown, Clock, PieChart as PieChartIcon, Calendar, Filter, Download, Upload, Server, Activity, Loader2, Database, PlayCircle, CheckCircle, AlertTriangle, Wifi, WifiOff, Globe, Link, FileText, Banknote, Smartphone, UtensilsCrossed, ChefHat, CreditCard, Search, X, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfDay, endOfDay, isWithinInterval, format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { isDatabaseLive, setApiUrl, disconnect, getApiUrl } from '../services/db';
import { APP_DATA_VERSION } from '../constants';

interface DashboardProps {
  orders: Order[];
  expenses?: Expense[];
  allData?: {
    menuItems: MenuItem[];
    ingredients: Ingredient[];
  };
  onExportData?: () => void;
  onImportData?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  userRole?: UserRole;
}

type FilterType = 'today' | '7days' | '15days' | '30days' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ orders, expenses = [], allData, onExportData, onImportData, userRole }) => {
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [isSystemLive, setIsSystemLive] = useState(isDatabaseLive());
  const [manualUrl, setManualUrl] = useState(getApiUrl() || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState<{ text: string, url?: string, type: 'error' | 'success' } | null>(null);

  // --- HISTORY & FILTER STATE ---
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [historyPayment, setHistoryPayment] = useState<PaymentStatus | 'ALL'>('ALL');
  const [historyType, setHistoryType] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY'>('ALL');
  const [historyShowAllTime, setHistoryShowAllTime] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const isManager = userRole === UserRole.MANAGER;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleDbChange = () => {
        setIsSystemLive(isDatabaseLive());
        setManualUrl(getApiUrl() || '');
    };
    window.addEventListener('db-connection-changed', handleDbChange);
    setIsSystemLive(isDatabaseLive());
    setManualUrl(getApiUrl() || '');
    return () => window.removeEventListener('db-connection-changed', handleDbChange);
  }, []);

  const handleConnect = async () => {
      if (!manualUrl) return;
      setIsConnecting(true);
      setConnectionMsg(null);
      const result = await setApiUrl(manualUrl);
      setIsConnecting(false);
      
      if (!result.success) {
          const errorText = result.error || "Failed to connect";
          let userMsg = errorText;
          if (errorText.includes('404')) userMsg = "Endpoint not found (404). Check URL.";
          else if (errorText.includes('Failed to fetch')) userMsg = "Network Error. Is the backend running? Check CORS.";
          
          setConnectionMsg({ 
              text: userMsg, 
              url: result.debugUrl,
              type: 'error'
          });
      } else {
          setConnectionMsg({ text: "Connected Successfully!", type: 'success' });
          setTimeout(() => setConnectionMsg(null), 3000);
      }
  };

  const handleDisconnect = () => {
      disconnect();
      setManualUrl('');
  };

  // --- ANALYTICS ---

  const getDateRange = () => {
      const now = new Date();
      if (filterType === 'today') return { start: startOfDay(now), end: endOfDay(now) };
      if (filterType === '7days') return { start: subDays(now, 7), end: endOfDay(now) };
      if (filterType === '15days') return { start: subDays(now, 15), end: endOfDay(now) };
      if (filterType === '30days') return { start: subDays(now, 30), end: endOfDay(now) };
      if (filterType === 'custom' && customStart && customEnd) {
          // Use Exact Time specified by user input
          return { start: new Date(customStart), end: new Date(customEnd) };
      }
      return { start: startOfDay(now), end: endOfDay(now) }; // Default
  };

  const filteredData = useMemo(() => {
      const { start, end } = getDateRange();
      // Filter orders by creation date for general list view, not just PAID status if we want to see active KOTs
      const filteredOrders = orders.filter(o => 
          isWithinInterval(new Date(o.createdAt), { start, end })
      );
      const filteredExpenses = expenses.filter(e => 
          isWithinInterval(new Date(e.date), { start, end })
      );
      return { orders: filteredOrders, expenses: filteredExpenses };
  }, [orders, expenses, filterType, customStart, customEnd]);

  const metrics = useMemo(() => {
      let revenue = 0;
      let cashSales = 0;
      let onlineSales = 0;
      
      // Calculate revenue based only on PAID orders
      const paidOrders = filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID);

      paidOrders.forEach(o => {
          const subtotal = o.items.reduce((sum, i) => sum + (i.priceAtOrder * i.quantity), 0);
          const taxable = Math.max(0, subtotal - (o.discount || 0));
          const taxAmount = taxable * ((o.taxRate || 0) / 100);
          const total = taxable + taxAmount;
          
          revenue += total;

          if (o.paymentMethod === PaymentMethod.CASH) {
              cashSales += total;
          } else if (o.paymentMethod === PaymentMethod.ONLINE || o.paymentMethod === PaymentMethod.PAYTM_POS) {
              onlineSales += total;
          }
      });

      const totalExpenses = filteredData.expenses.reduce((acc, e) => acc + e.amount, 0);
      const profit = revenue - totalExpenses;
      const orderCount = paidOrders.length;
      const aov = orderCount > 0 ? revenue / orderCount : 0;

      return { revenue, totalExpenses, profit, orderCount, aov, cashSales, onlineSales };
  }, [filteredData]);

  const chartData = useMemo(() => {
      const dataMap = new Map<string, { date: string, revenue: number, orders: number }>();
      const paidOrders = filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID);
      
      paidOrders.forEach(o => {
          const dateKey = format(new Date(o.createdAt), 'MMM dd');
          if (!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, revenue: 0, orders: 0 });
          
          const entry = dataMap.get(dateKey)!;
          const subtotal = o.items.reduce((s, i) => s + (i.priceAtOrder * i.quantity), 0);
          const taxable = Math.max(0, subtotal - (o.discount || 0));
          const taxAmount = taxable * ((o.taxRate || 0) / 100);
          const total = taxable + taxAmount;
          
          entry.revenue += total;
          entry.orders += 1;
      });

      return Array.from(dataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredData]);

  // --- HISTORY DATA LOGIC ---
  const historyData = useMemo(() => {
      // 1. Choose Base Data Source
      // If "Show All Time" is checked, use raw `orders` from props.
      // Otherwise, use `filteredData.orders` which respects the top-level date range.
      let data = historyShowAllTime ? orders : filteredData.orders;

      // 2. Apply Local Filters
      if (historySearch) {
          const lower = historySearch.toLowerCase();
          data = data.filter(o => 
              o.id.toLowerCase().includes(lower) ||
              o.serverName.toLowerCase().includes(lower) ||
              (o.tableNumber && o.tableNumber.toString().includes(lower))
          );
      }

      if (historyStatus !== 'ALL') {
          data = data.filter(o => o.status === historyStatus);
      }

      if (historyPayment !== 'ALL') {
          data = data.filter(o => o.paymentStatus === historyPayment);
      }

      if (historyType !== 'ALL') {
          if (historyType === 'DINE_IN') data = data.filter(o => !!o.tableNumber);
          if (historyType === 'TAKEAWAY') data = data.filter(o => !o.tableNumber);
      }

      // 3. Sort (Newest First)
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filteredData.orders, historySearch, historyStatus, historyPayment, historyType, historyShowAllTime]);

  const paginatedHistory = useMemo(() => {
      const start = (historyPage - 1) * ITEMS_PER_PAGE;
      return historyData.slice(start, start + ITEMS_PER_PAGE);
  }, [historyData, historyPage]);

  const totalHistoryPages = Math.ceil(historyData.length / ITEMS_PER_PAGE);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.NEW: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">New</span>;
      case OrderStatus.IN_PROGRESS: return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1"><ChefHat size={10} /> Cooking</span>;
      case OrderStatus.READY: return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Ready</span>;
      case OrderStatus.SERVED: return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold uppercase">Served</span>;
      case OrderStatus.CANCELLED: return <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold uppercase">Cancelled</span>;
      default: return null;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus, method?: PaymentMethod) => {
      switch (status) {
          case PaymentStatus.PAID:
              return (
                  <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit">
                      <CheckCircle size={10} /> Paid ({method === PaymentMethod.PAYTM_POS ? 'POS' : method})
                  </span>
              );
          case PaymentStatus.PENDING:
              return (
                  <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit">
                      <Clock size={10} /> Pending
                  </span>
              );
          case PaymentStatus.CANCELLED:
              return (
                  <span className="bg-red-50 text-red-400 border border-red-100 px-2 py-0.5 rounded text-xs font-bold uppercase w-fit">
                      Void
                  </span>
              );
          default: return null;
      }
  };

  const handleDownloadSalesReport = () => {
      const headers = [
          "Order ID", "Date", "Time", "Table", "Server", "Type", "Order Status",
          "Payment Status", "Payment Method", "Items Summary", "Subtotal", "Discount", "Tax %", "Tax Amount", "Total Amount"
      ];

      const csvRows = [headers.join(",")];

      // Export the currently filtered view
      historyData.forEach(order => {
          const date = new Date(order.createdAt);
          const dateStr = format(date, 'yyyy-MM-dd');
          const timeStr = format(date, 'HH:mm:ss');
          
          const safeString = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

          const itemsSummary = order.items.map(i => {
              const portion = i.portion && i.portion !== 'Full' ? `(${i.portion})` : '';
              return `${i.quantity}x ${i.name}${portion}`;
          }).join('; ');
          
          const subtotal = order.items.reduce((acc, i) => acc + (i.priceAtOrder * i.quantity), 0);
          const discount = order.discount || 0;
          const taxRate = order.taxRate || 0;
          const taxable = Math.max(0, subtotal - discount);
          const taxAmount = taxable * (taxRate / 100);
          const total = taxable + taxAmount;

          const row = [
              safeString(order.id),
              dateStr,
              timeStr,
              order.tableNumber,
              safeString(order.serverName),
              order.tableNumber ? "Dine-in" : "Takeaway",
              order.status,
              order.paymentStatus,
              order.paymentMethod || "N/A",
              safeString(itemsSummary),
              subtotal.toFixed(2),
              discount.toFixed(2),
              taxRate.toFixed(2),
              taxAmount.toFixed(2),
              total.toFixed(2)
          ];
          csvRows.push(row.join(","));
      });

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sales_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Header with Connection & Data Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Activity className="text-blue-600" /> Restaurant Dashboard
           </h2>
           <p className="text-sm text-slate-500">
               System Version: {APP_DATA_VERSION} • {isSystemLive ? 'Cloud Connected' : 'Local Mode'}
           </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
             {/* Connection Widget */}
             <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 flex-1">
                 <div className={`p-2 rounded-md ${isSystemLive ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                     {isSystemLive ? <Database size={18} /> : <WifiOff size={18} />}
                 </div>
                 {isSystemLive ? (
                     <div className="flex items-center gap-2 px-2">
                         <div>
                            <span className="text-xs font-bold text-green-700 block leading-none">MySQL Active</span>
                            <span className="text-[10px] text-slate-500 font-mono block max-w-[120px] truncate">{manualUrl || 'Auto-Detected'}</span>
                         </div>
                         <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline ml-2">Disconnect</button>
                     </div>
                 ) : (
                     <div className="flex items-center gap-1 flex-1">
                         <input 
                            type="text" 
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            placeholder="Base URL (e.g. https://my-app.run.app)"
                            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-full md:w-48"
                         />
                         <button 
                            onClick={handleConnect}
                            disabled={!manualUrl || isConnecting}
                            className="bg-slate-800 text-white px-3 py-1 rounded text-xs font-bold hover:bg-slate-700 disabled:opacity-50"
                         >
                             {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <Link size={12} />}
                         </button>
                     </div>
                 )}
             </div>

             {/* Import/Export */}
             <div className="flex gap-2">
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                 >
                     <Upload size={16} /> Import
                 </button>
                 <input type="file" ref={fileInputRef} onChange={onImportData} className="hidden" accept=".json" />
                 
                 <button 
                    onClick={onExportData}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                 >
                     <Download size={16} /> Backup
                 </button>
             </div>
        </div>
      </div>

      {connectionMsg && (
          <div className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${connectionMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
              {connectionMsg.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              <span>{connectionMsg.text}</span>
              {connectionMsg.url && <span className="text-xs font-mono opacity-70">({connectionMsg.url})</span>}
          </div>
      )}

      {/* Date Filter Bar */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={16} className="text-slate-400 ml-2" />
            <span className="text-xs font-bold text-slate-500 uppercase mr-2">Time Period:</span>
            {(['today', '7days', '15days', '30days'] as FilterType[]).map(type => (
                <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterType === type ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    {type === 'today' ? 'Today' : `Last ${type.replace('days', ' Days')}`}
                </button>
            ))}
            
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            
            <button 
                onClick={() => setFilterType('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${filterType === 'custom' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
                <Calendar size={14} /> Custom
            </button>
            
            {filterType === 'custom' && (
                <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2">
                    <div className="flex items-center border rounded px-2 py-1 bg-slate-50">
                        <span className="text-[10px] text-slate-400 mr-1 uppercase font-bold">From</span>
                        <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs bg-transparent outline-none text-slate-700" />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="flex items-center border rounded px-2 py-1 bg-slate-50">
                        <span className="text-[10px] text-slate-400 mr-1 uppercase font-bold">To</span>
                        <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs bg-transparent outline-none text-slate-700" />
                    </div>
                </div>
            )}
          </div>

          <button 
              onClick={handleDownloadSalesReport}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
          >
              <FileText size={16} /> Download Sales Report
          </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-2">₹{metrics.revenue.toLocaleString('en-IN')}</h3>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-green-600">
                  <TrendingDown className="rotate-180 mr-1" size={14} /> +{metrics.orderCount} Orders
              </div>
          </div>

          {/* Cash Sales Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash Sales</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-2">
                      ₹{metrics.cashSales.toLocaleString('en-IN')}
                  </h3>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-green-600">
                  <Banknote size={14} className="mr-1" /> {(metrics.revenue > 0 ? (metrics.cashSales / metrics.revenue * 100) : 0).toFixed(0)}%
              </div>
          </div>

          {/* Online Sales Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Online Sales</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-2">
                      ₹{metrics.onlineSales.toLocaleString('en-IN')}
                  </h3>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-purple-600">
                  <Smartphone size={14} className="mr-1" /> {(metrics.revenue > 0 ? (metrics.onlineSales / metrics.revenue * 100) : 0).toFixed(0)}%
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-2">₹{metrics.aov.toFixed(0)}</h3>
              </div>
              <div className="mt-4 flex items-center text-xs font-medium text-blue-600">
                  <Clock size={14} className="mr-1" /> Per Transaction
              </div>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          {/* Revenue Trend */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={18} className="text-blue-500" /> Revenue Trend
              </h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `₹${val/1000}k`} />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Revenue']}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Quick Stats / Distribution */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <PieChartIcon size={18} className="text-purple-500" /> Order Status
              </h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={[
                                  { name: 'Served', value: orders.filter(o => o.status === OrderStatus.SERVED).length },
                                  { name: 'Ready', value: orders.filter(o => o.status === OrderStatus.READY).length },
                                  { name: 'Cooking', value: orders.filter(o => o.status === OrderStatus.IN_PROGRESS).length },
                                  { name: 'New', value: orders.filter(o => o.status === OrderStatus.NEW).length },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {metrics.orderCount > 0 ? (
                                  [0, 1, 2, 3].map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))
                              ) : (
                                  <Cell fill="#e2e8f0" />
                              )}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center text-sm text-slate-500">
                  Total Orders: <span className="font-bold text-slate-800">{orders.length}</span>
              </div>
          </div>
      </div>

      {/* Order History / KOT List with FILTERS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Archive size={18} className="text-orange-500" /> Order History & Transactions
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-500">Showing {paginatedHistory.length} of {historyData.length}</span>
                      <div className="flex gap-1">
                          <button 
                              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                              disabled={historyPage === 1}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                          >
                              <ChevronLeft size={16} />
                          </button>
                          <button 
                              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                              disabled={historyPage === totalHistoryPages || totalHistoryPages === 0}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                          >
                              <ChevronRight size={16} />
                          </button>
                      </div>
                  </div>
              </div>

              {/* Advanced History Filters Toolbar */}
              <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative w-full md:w-auto md:flex-1">
                      <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                          type="text" 
                          placeholder="Search ID, Table #, Server..." 
                          value={historySearch}
                          onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                          className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {historySearch && (
                          <button onClick={() => setHistorySearch('')} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"><X size={14}/></button>
                      )}
                  </div>

                  <select 
                      value={historyStatus}
                      onChange={(e) => { setHistoryStatus(e.target.value as any); setHistoryPage(1); }}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="ALL">Status: All</option>
                      <option value={OrderStatus.NEW}>New</option>
                      <option value={OrderStatus.IN_PROGRESS}>Cooking</option>
                      <option value={OrderStatus.READY}>Ready</option>
                      <option value={OrderStatus.SERVED}>Served</option>
                      <option value={OrderStatus.CANCELLED}>Cancelled</option>
                  </select>

                  <select 
                      value={historyPayment}
                      onChange={(e) => { setHistoryPayment(e.target.value as any); setHistoryPage(1); }}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="ALL">Payment: All</option>
                      <option value={PaymentStatus.PAID}>Paid</option>
                      <option value={PaymentStatus.PENDING}>Pending</option>
                      <option value={PaymentStatus.CANCELLED}>Voided</option>
                  </select>

                  <select 
                      value={historyType}
                      onChange={(e) => { setHistoryType(e.target.value as any); setHistoryPage(1); }}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="ALL">Type: All</option>
                      <option value="DINE_IN">Dine-In</option>
                      <option value="TAKEAWAY">Takeaway</option>
                  </select>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 select-none">
                      <input 
                          type="checkbox" 
                          checked={historyShowAllTime} 
                          onChange={(e) => { setHistoryShowAllTime(e.target.checked); setHistoryPage(1); }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      Show All Time
                  </label>
              </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Order ID</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Time</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Table/Type</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase w-1/3">Items Ordered</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Payment</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {paginatedHistory.length === 0 ? (
                          <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">No orders found matching filters.</td>
                          </tr>
                      ) : (
                          paginatedHistory.map((order) => {
                              const subtotal = order.items.reduce((s, i) => s + (i.priceAtOrder * i.quantity), 0);
                              const taxable = Math.max(0, subtotal - (order.discount || 0));
                              const taxAmount = taxable * ((order.taxRate || 0) / 100);
                              const total = taxable + taxAmount;

                              return (
                                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                          #{order.id.split('-')[1] || order.id}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-700">
                                          <div className="flex flex-col">
                                              <span>{format(new Date(order.createdAt), 'MMM dd')}</span>
                                              <span className="text-xs text-slate-400">{format(new Date(order.createdAt), 'HH:mm')}</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          {order.tableNumber ? (
                                              <span className="font-bold text-slate-800 text-sm">Table {order.tableNumber}</span>
                                          ) : (
                                              <span className="text-slate-500 italic text-sm">Takeaway</span>
                                          )}
                                          <div className="text-xs text-slate-400 mt-0.5">{order.serverName}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex flex-wrap gap-1">
                                              {order.items.map((item, idx) => (
                                                  <span key={idx} className="text-xs bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                                                      {item.quantity}x {item.name}
                                                  </span>
                                              ))}
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          {getStatusBadge(order.status)}
                                      </td>
                                      <td className="px-6 py-4">
                                          {getPaymentStatusBadge(order.paymentStatus, order.paymentMethod)}
                                      </td>
                                      <td className="px-6 py-4 text-right font-bold text-slate-800">
                                          ₹{total.toFixed(2)}
                                      </td>
                                  </tr>
                              );
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
