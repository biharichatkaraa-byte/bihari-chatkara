import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Order, Expense, MenuItem, Ingredient, PaymentStatus, PaymentMethod } from '../types';
import { Activity, Banknote, Smartphone, ShoppingBag, TrendingUp, Calendar, Clock, ChevronDown, ChevronUp, PieChart as PieChartIcon } from 'lucide-react';
import { endOfDay, isWithinInterval, format } from 'date-fns';
import * as db from '../services/db';
import { APP_DATA_VERSION } from '../constants';

const startOfDay = (date: any) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const subDays = (date: any, amount: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
};

interface DashboardProps {
  orders: Order[];
  expenses?: Expense[];
  allData?: {
    menuItems: MenuItem[];
    ingredients: Ingredient[];
  };
  onExportData?: () => void;
  onImportData?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  userRole?: string;
}

type FilterType = 'today' | '7days' | '30days' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ orders, expenses = [], allData, userRole }) => {
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [isSystemLive, setIsSystemLive] = useState(db.isDatabaseLive());
  
  // Custom Date Range State
  const [customStart, setCustomStart] = useState<string>(format(new Date(), "yyyy-MM-dd'T'00:00"));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), "yyyy-MM-dd'T'23:59"));

  useEffect(() => {
    const handleDbChange = () => setIsSystemLive(db.isDatabaseLive());
    window.addEventListener('db-connection-changed', handleDbChange);
    return () => window.removeEventListener('db-connection-changed', handleDbChange);
  }, []);

  const calculateOrderTotal = (order: Order) => {
    const items = order.items || [];
    const subtotal = items.reduce((sum, i) => sum + (Number(i.priceAtOrder) * Number(i.quantity)), 0);
    const taxable = Math.max(0, subtotal - (Number(order.discount) || 0));
    const taxAmount = taxable * ((Number(order.taxRate) || 0) / 100);
    return taxable + taxAmount;
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    let interval = { start: startOfDay(now), end: endOfDay(now) };

    if (filterType === '7days') interval = { start: subDays(now, 7), end: endOfDay(now) };
    else if (filterType === '30days') interval = { start: subDays(now, 30), end: endOfDay(now) };
    else if (filterType === 'custom') interval = { start: new Date(customStart), end: new Date(customEnd) };

    const filteredOrders = (orders || []).filter(o => isWithinInterval(new Date(o.createdAt), interval));
    const filteredExpenses = (expenses || []).filter(e => isWithinInterval(new Date(e.date), interval));
    return { orders: filteredOrders, expenses: filteredExpenses };
  }, [orders, expenses, filterType, customStart, customEnd]);

  const metrics = useMemo(() => {
    let revenue = 0;
    let cashSales = 0;
    let onlineSales = 0;
    
    const paidOrders = filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID);
    paidOrders.forEach(o => {
      const total = calculateOrderTotal(o);
      revenue += total;
      if (o.paymentMethod === PaymentMethod.CASH) cashSales += total;
      else onlineSales += total;
    });

    const totalExpenses = filteredData.expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const orderCount = paidOrders.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;
    const profit = revenue - totalExpenses;

    return { revenue, cashSales, onlineSales, orderCount, aov, profit };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string, revenue: number }>();
    const isSingleDay = filterType === 'today' || (filterType === 'custom' && format(new Date(customStart), 'yyyy-MM-dd') === format(new Date(customEnd), 'yyyy-MM-dd'));
    
    filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID).forEach(o => {
      const dateKey = isSingleDay ? format(new Date(o.createdAt), 'HH:00') : format(new Date(o.createdAt), 'MMM dd');
      if (!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, revenue: 0 });
      dataMap.get(dateKey)!.revenue += calculateOrderTotal(o);
    });
    
    return Array.from(dataMap.values()).sort((a, b) => {
        if (isSingleDay) return parseInt(a.date) - parseInt(b.date);
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [filteredData, filterType, customStart, customEnd]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Activity className="text-blue-600" /> Executive Dashboard
            </h2>
            <p className="text-sm text-slate-500 font-medium">System Version: v{APP_DATA_VERSION}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['today', '7days', '30days', 'custom'] as const).map(t => (
                    <button 
                    key={t}
                    onClick={() => setFilterType(t)} 
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all uppercase ${filterType === t ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                    {t === '7days' ? '7D' : t === '30days' ? '30D' : t === 'custom' ? 'Custom' : 'Today'}
                    </button>
                ))}
                </div>
            </div>
        </div>

        {filterType === 'custom' && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">From:</span>
                    <input 
                        type="datetime-local" 
                        value={customStart} 
                        onChange={e => setCustomStart(e.target.value)} 
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">To:</span>
                    <input 
                        type="datetime-local" 
                        value={customEnd} 
                        onChange={e => setCustomEnd(e.target.value)} 
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-50 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <ShoppingBag size={12} className="text-indigo-500" /> Orders in Period
          </p>
          <h3 className="text-3xl font-black text-slate-800">{metrics.orderCount}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-50 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Banknote size={12} className="text-emerald-500" /> Cash Journal
          </p>
          <h3 className="text-3xl font-black text-emerald-600">₹{metrics.cashSales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-50 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Smartphone size={12} className="text-blue-500" /> Digital Journal
          </p>
          <h3 className="text-3xl font-black text-blue-600">₹{metrics.onlineSales.toLocaleString('en-IN')}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-50 shadow-sm transition-transform hover:scale-[1.02]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <TrendingUp size={12} className="text-purple-500" /> Average Ticket
          </p>
          <h3 className="text-3xl font-black text-slate-800">₹{metrics.aov.toFixed(0)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[350px]">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center justify-between">
            <div className="flex items-center gap-2"><TrendingUp className="text-blue-600" size={20}/> Hourly Performance</div>
            <span className="text-[10px] text-slate-400 font-bold">{filterType === 'today' ? 'Daily Pulse' : 'Period Summary'}</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `₹${val >= 1000 ? (val/1000)+'k' : val}`} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
            <PieChartIcon className="text-blue-600" size={20}/> Split Analysis
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={[
                    { name: 'Cash', value: metrics.cashSales }, 
                    { name: 'Digital', value: metrics.onlineSales }
                  ]} 
                  cx="50%" cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#3b82f6" />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
