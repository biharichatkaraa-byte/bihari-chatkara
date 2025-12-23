import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { Order, Expense, UserRole, MenuItem, Ingredient, PaymentStatus, OrderStatus, PaymentMethod } from '../types';
import { DollarSign, TrendingDown, Clock, PieChart as PieChartIcon, Calendar, Filter, Download, Upload, Server, Activity, Loader2, Database, PlayCircle, CheckCircle, AlertTriangle, Wifi, WifiOff, Globe, Link, FileText, Banknote, Smartphone, UtensilsCrossed, CreditCard, Search, Archive } from 'lucide-react';
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
  const isManager = userRole === UserRole.MANAGER;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleDbChange = () => {
        setIsSystemLive(isDatabaseLive());
        setManualUrl(getApiUrl() || '');
    };
    window.addEventListener('db-connection-changed', handleDbChange);
    return () => window.removeEventListener('db-connection-changed', handleDbChange);
  }, []);

  const calculateOrderTotal = (order: Order) => {
      const subtotal = order.items.reduce((sum, i) => {
          let price = Number(i.priceAtOrder) || 0;
          if ((!price || price === 0) && allData?.menuItems) {
              const menuItem = allData.menuItems.find(m => m.id === i.menuItemId);
              if (menuItem) price = Number(menuItem.price) || 0;
          }
          return sum + (price * (Number(i.quantity) || 0));
      }, 0);
      const taxable = Math.max(0, subtotal - (Number(order.discount) || 0));
      const taxAmount = taxable * ((Number(order.taxRate) || 0) / 100);
      return taxable + taxAmount;
  };

  const filteredData = useMemo(() => {
      const { start, end } = (() => {
        const now = new Date();
        if (filterType === 'today') return { start: startOfDay(now), end: endOfDay(now) };
        if (filterType === '7days') return { start: subDays(now, 7), end: endOfDay(now) };
        if (filterType === '15days') return { start: subDays(now, 15), end: endOfDay(now) };
        if (filterType === '30days') return { start: subDays(now, 30), end: endOfDay(now) };
        if (filterType === 'custom' && customStart && customEnd) return { start: new Date(customStart), end: new Date(customEnd) };
        return { start: startOfDay(now), end: endOfDay(now) }; 
      })();
      const filteredOrders = orders.filter(o => isWithinInterval(new Date(o.createdAt), { start, end }));
      const filteredExpenses = expenses.filter(e => isWithinInterval(new Date(e.date), { start, end }));
      return { orders: filteredOrders, expenses: filteredExpenses };
  }, [orders, expenses, filterType, customStart, customEnd]);

  const metrics = useMemo(() => {
      let revenue = 0;
      let cashSales = 0;
      let onlineSales = 0;
      const paidOrders = filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID);
      paidOrders.forEach(o => {
          const total = Number(calculateOrderTotal(o)) || 0;
          revenue += total;
          if (o.paymentMethod === PaymentMethod.CASH) cashSales += total;
          else if (o.paymentMethod === PaymentMethod.ONLINE || o.paymentMethod === PaymentMethod.PAYTM_POS) onlineSales += total;
      });
      const totalExpenses = filteredData.expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const profit = revenue - totalExpenses;
      const orderCount = paidOrders.length;
      const aov = orderCount > 0 ? revenue / orderCount : 0;
      return { revenue, totalExpenses, profit, orderCount, aov, cashSales, onlineSales };
  }, [filteredData, allData]);

  const chartData = useMemo(() => {
      const dataMap = new Map<string, { date: string, revenue: number, orders: number }>();
      const paidOrders = filteredData.orders.filter(o => o.paymentStatus === PaymentStatus.PAID);
      paidOrders.forEach(o => {
          const dateKey = format(new Date(o.createdAt), 'MMM dd');
          if (!dataMap.has(dateKey)) dataMap.set(dateKey, { date: dateKey, revenue: 0, orders: 0 });
          const entry = dataMap.get(dateKey)!;
          entry.revenue += Number(calculateOrderTotal(o)) || 0;
          entry.orders += 1;
      });
      return Array.from(dataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredData, allData]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-blue-600" /> Dashboard</h2><p className="text-sm text-slate-500">v{APP_DATA_VERSION}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">₹{(Number(metrics.revenue) || 0).toLocaleString('en-IN')}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Order</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">₹{(Number(metrics.aov) || 0).toFixed(0)}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash %</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">{(metrics.revenue > 0 ? (metrics.cashSales / metrics.revenue * 100) : 0).toFixed(0)}%</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profit/Loss</p>
              <h3 className={`text-3xl font-bold mt-2 ${metrics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{(Number(metrics.profit) || 0).toLocaleString('en-IN')}</h3>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-6">Revenue Trend</h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}><XAxis dataKey="date" /><YAxis /><Tooltip /><Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} /></AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-6">Order Status</h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={[{ name: 'Paid', value: metrics.orderCount }, { name: 'Pending', value: orders.length - metrics.orderCount }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value"><Cell fill="#10b981" /><Cell fill="#e2e8f0" /></Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;