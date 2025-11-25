
import React, { useState, useMemo } from 'react';
import { Expense, User } from '../types';
import { Plus, Trash2, Calendar, Tag, Filter, TrendingDown, X, Search, ChevronDown, ChevronUp, PieChart as PieIcon, Download, Target, TrendingUp, DollarSign, Pencil, Package, Zap, Wrench, Users, Megaphone, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Save, User as UserIcon } from 'lucide-react';
import { format, subDays, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  currentUser: User;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, onAddExpense, onUpdateExpense, onDeleteExpense, currentUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // View State
  const [isExpandedView, setIsExpandedView] = useState(false);

  // Modal Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Inventory');

  // Quick Add Form State
  const [qaDescription, setQaDescription] = useState('');
  const [qaAmount, setQaAmount] = useState('');
  const [qaCategory, setQaCategory] = useState('Inventory');

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterReportedBy, setFilterReportedBy] = useState('All');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  // Sorting & Pagination State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = isExpandedView ? 50 : 15; // Dynamic items per page

  // Budget State (Mock persisted state)
  const [monthlyBudget, setMonthlyBudget] = useState(50000);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const categories = ['Inventory', 'Utilities', 'Maintenance', 'Staff', 'Marketing', 'Other'];
  const EXPENSE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#64748b'];

  const getCategoryIcon = (cat: string) => {
      switch (cat) {
        case 'Inventory': return <Package size={16} className="text-blue-500" />;
        case 'Utilities': return <Zap size={16} className="text-yellow-500" />;
        case 'Maintenance': return <Wrench size={16} className="text-orange-500" />;
        case 'Staff': return <Users size={16} className="text-purple-500" />;
        case 'Marketing': return <Megaphone size={16} className="text-pink-500" />;
        default: return <Tag size={16} className="text-slate-500" />;
      }
  };

  // Get unique reporters for filter
  const uniqueReporters = useMemo(() => {
      const reporters = new Set(expenses.map(e => e.reportedBy));
      return Array.from(reporters).sort();
  }, [expenses]);

  const handleEditClick = (expense: Expense) => {
      setEditingId(expense.id);
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description && amount) {
      if (editingId) {
          // Update Mode
          const updatedExpense: Expense = {
              ...expenses.find(e => e.id === editingId)!,
              description,
              amount: parseFloat(amount),
              category,
          };
          onUpdateExpense(updatedExpense);
      } else {
          // Add Mode
          const newExpense: Expense = {
            id: `e-${Date.now()}`,
            description,
            amount: parseFloat(amount),
            category,
            date: new Date(),
            reportedBy: currentUser.name,
          };
          onAddExpense(newExpense);
      }
      
      handleCloseModal();
    }
  };

  const handleQuickAdd = () => {
      if (!qaDescription || !qaAmount) {
          alert("Please enter a description and amount.");
          return;
      }
      
      const newExpense: Expense = {
        id: `e-qa-${Date.now()}`,
        description: qaDescription,
        amount: parseFloat(qaAmount),
        category: qaCategory,
        date: new Date(),
        reportedBy: currentUser.name,
      };
      onAddExpense(newExpense);

      // Reset Quick Add
      setQaDescription('');
      setQaAmount('');
      setQaCategory('Inventory');
  };

  const handleCloseModal = () => {
      setIsAdding(false);
      setEditingId(null);
      setDescription('');
      setAmount('');
      setCategory('Inventory');
  };

  const handleClearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterCategory('All');
    setFilterReportedBy('All');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setCurrentPage(1);
  };

  const handleSort = (key: keyof Expense) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleExportCSV = () => {
    const headers = "ID,Date,Description,Category,Amount,ReportedBy\n";
    const csvContent = filteredExpenses.map(e => {
        const dateStr = format(new Date(e.date), 'yyyy-MM-dd');
        const desc = e.description.replace(/,/g, ' '); // simple escape
        return `${e.id},${dateStr},${desc},${e.category},${e.amount},${e.reportedBy}`;
    }).join("\n");

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + headers + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- ANALYTICS CALCULATIONS ---

  // 1. Filter & Sort Logic
  const filteredExpenses = useMemo(() => {
    let result = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);

        if (filterDateStart) {
            const start = new Date(filterDateStart);
            start.setHours(0, 0, 0, 0);
            if (expenseDate < start) return false;
        }
        if (filterDateEnd) {
            const end = new Date(filterDateEnd);
            end.setHours(23, 59, 59, 999);
            if (expenseDate > end) return false;
        }
        if (filterCategory !== 'All' && expense.category !== filterCategory) return false;
        if (filterReportedBy !== 'All' && expense.reportedBy !== filterReportedBy) return false;
        if (filterMinAmount && expense.amount < parseFloat(filterMinAmount)) return false;
        if (filterMaxAmount && expense.amount > parseFloat(filterMaxAmount)) return false;

        return true;
    });

    return result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Handle string comparison case-insensitive
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (sortConfig.key === 'date') {
            return sortConfig.direction === 'asc' 
                ? new Date(a.date).getTime() - new Date(b.date).getTime()
                : new Date(b.date).getTime() - new Date(a.date).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [expenses, filterDateStart, filterDateEnd, filterCategory, filterReportedBy, filterMinAmount, filterMaxAmount, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 2. KPI Calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfMonthDate = startOfMonth(now);
    const endOfMonthDate = endOfMonth(now);

    const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Expenses strictly within current calendar month
    const thisMonthExpenses = expenses.filter(e => 
        isWithinInterval(new Date(e.date), { start: startOfMonthDate, end: endOfMonthDate })
    );
    const monthSpent = thisMonthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    
    return {
        totalSpent,
        monthSpent,
        remainingBudget: monthlyBudget - monthSpent,
        budgetPercent: Math.min((monthSpent / monthlyBudget) * 100, 100)
    };
  }, [filteredExpenses, expenses, monthlyBudget]);

  // 3. Chart Data: Breakdown by Category
  const categoryData = useMemo(() => {
      const data: Record<string, number> = {};
      filteredExpenses.forEach(e => {
          data[e.category] = (data[e.category] || 0) + e.amount;
      });
      return Object.keys(data).map(key => ({ name: key, value: data[key] }));
  }, [filteredExpenses]);

  // 4. Chart Data: Last 7 Days Trend
  const trendData = useMemo(() => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          const dayTotal = expenses
              .filter(e => isSameDay(new Date(e.date), d))
              .reduce((sum, e) => sum + e.amount, 0);
          days.push({
              name: format(d, 'EEE'), // Mon, Tue
              date: format(d, 'MMM dd'),
              amount: dayTotal
          });
      }
      return days;
  }, [expenses]);

  const activeFilterCount = [
    filterDateStart, filterDateEnd, filterCategory !== 'All', filterReportedBy !== 'All', filterMinAmount, filterMaxAmount
  ].filter(Boolean).length;

  const SortHeader = ({ label, columnKey, align='left' }: { label: string, columnKey: keyof Expense, align?: string }) => (
    <th 
      className={`px-6 py-4 font-semibold text-slate-600 text-sm cursor-pointer hover:bg-slate-50 transition-colors select-none text-${align}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortConfig.key === columnKey ? (
            sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
        ) : (
            <ArrowUpDown size={14} className="text-slate-300" />
        )}
      </div>
    </th>
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Expense Management</h2>
          <p className="text-slate-500 text-sm">Track operational costs, set budgets, and analyze spending.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <button
                onClick={() => setIsExpandedView(!isExpandedView)}
                className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm font-bold ${isExpandedView ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                title={isExpandedView ? "Show Dashboard" : "Focus Transaction Log"}
            >
                {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />} 
                {isExpandedView ? 'Show Charts' : 'Expand Log'}
            </button>

            <button
                onClick={handleExportCSV}
                className="px-3 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold"
            >
                <Download size={16} /> Export CSV
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all border text-sm font-bold ${
                showFilters || activeFilterCount > 0
                  ? 'bg-slate-800 text-white border-slate-800' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
               <Filter size={16} /> 
               <span>Filter</span>
               {activeFilterCount > 0 && (
                   <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                       {activeFilterCount}
                   </span>
               )}
            </button>
            <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-red-200 transition-all text-sm font-bold"
            >
            <Plus size={16} /> New Record
            </button>
        </div>
      </div>

      {/* Analytics Dashboard (Collapsible) */}
      {!isExpandedView && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Spent (Filtered)</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{metrics.totalSpent.toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-400">
                        {filteredExpenses.length} transaction records found
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">This Month's Spend</p>
                            <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{metrics.monthSpent.toLocaleString('en-IN')}</h3>
                        </div>
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                            <TrendingDown size={20} />
                        </div>
                    </div>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5">
                        <div 
                                className={`h-1.5 rounded-full ${metrics.budgetPercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                style={{ width: `${metrics.budgetPercent}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 text-right">{metrics.budgetPercent.toFixed(0)}% of budget</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Budget</p>
                            {isEditingBudget ? (
                                <input 
                                    type="number" 
                                    value={monthlyBudget} 
                                    onChange={(e) => setMonthlyBudget(parseFloat(e.target.value))}
                                    onBlur={() => setIsEditingBudget(false)}
                                    autoFocus
                                    className="text-xl font-bold text-slate-800 mt-1 w-full border-b border-blue-500 outline-none"
                                />
                            ) : (
                                <h3 
                                    className="text-2xl font-bold text-slate-800 mt-1 cursor-pointer hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => setIsEditingBudget(true)}
                                    title="Click to edit budget"
                                >
                                    ₹{monthlyBudget.toLocaleString('en-IN')} <span className="text-xs text-slate-300 font-normal">(Edit)</span>
                                </h3>
                            )}
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Target size={20} />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-400">
                        Click the amount to update target
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Budget</p>
                            <h3 className={`text-2xl font-bold mt-1 ${metrics.remainingBudget < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {metrics.remainingBudget < 0 ? '-' : ''}₹{Math.abs(metrics.remainingBudget).toLocaleString('en-IN')}
                            </h3>
                        </div>
                        <div className={`p-2 rounded-lg ${metrics.remainingBudget < 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            {metrics.remainingBudget < 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-400">
                        {metrics.remainingBudget < 0 ? 'Budget exceeded' : 'Available to spend'}
                    </div>
                </div>
            </div>

            {/* Analytics Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-72">
                {/* Category Pie Chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><PieIcon size={16}/> Expense Distribution</h3>
                    <div className="flex-1 min-h-0">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-300 text-sm">No data available</div>
                        )}
                    </div>
                </div>

                {/* Daily Trend Bar Chart */}
                <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><TrendingUp size={16}/> Spending Trend (Last 7 Days)</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `₹${value/1000}k`} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Spent']}
                                    labelFormatter={(label) => `Day: ${label}`}
                                />
                                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 text-white">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2">
                    <Search size={18} className="text-slate-400" /> Filter Expenses
                </h3>
                <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-white">
                    <ChevronUp size={20} />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Date Range */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">From Date</label>
                    <input 
                        type="date" 
                        value={filterDateStart}
                        onChange={(e) => setFilterDateStart(e.target.value)}
                        className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">To Date</label>
                    <input 
                        type="date" 
                        value={filterDateEnd}
                        onChange={(e) => setFilterDateEnd(e.target.value)}
                        className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border"
                    />
                </div>

                {/* Category */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Category</label>
                    <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border appearance-none"
                    >
                        <option value="All">All Categories</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* Reported By */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Reported By</label>
                    <select 
                        value={filterReportedBy}
                        onChange={(e) => setFilterReportedBy(e.target.value)}
                        className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border appearance-none"
                    >
                        <option value="All">All Staff</option>
                        {uniqueReporters.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </div>

                {/* Amount Range */}
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Amount Range (₹)</label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            placeholder="Min"
                            value={filterMinAmount}
                            onChange={(e) => setFilterMinAmount(e.target.value)}
                            className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border"
                        />
                        <input 
                            type="number" 
                            placeholder="Max"
                            value={filterMaxAmount}
                            onChange={(e) => setFilterMaxAmount(e.target.value)}
                            className="w-full bg-slate-700 border-slate-600 text-white rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 border"
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-700">
                <button 
                    onClick={handleClearFilters}
                    className="text-slate-400 hover:text-white text-sm flex items-center gap-1 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
                >
                    <X size={14} /> Clear All Filters
                </button>
            </div>
        </div>
      )}

      {/* Add/Edit Expense Form Modal */}
      {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <div className="bg-red-100 p-2 rounded-lg text-red-600">
                            {editingId ? <Pencil size={24} /> : <TrendingDown size={24} />}
                        </div>
                        {editingId ? 'Edit Expense Record' : 'Log New Expense'}
                    </h3>
                    <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-slate-50"
                            placeholder="e.g. Weekly vegetable delivery"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Amount (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-mono font-medium"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                            >
                                {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 font-bold transition-all"
                        >
                            {editingId ? 'Update Expense' : 'Save Expense'}
                        </button>
                    </div>
                </form>
             </div>
          </div>
      )}

      {/* Expense Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Detailed Transaction Log</h3>
            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                Showing {paginatedExpenses.length} of {filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}
            </span>
        </div>

        {/* Quick Add Bar */}
        <div className="bg-blue-50/50 p-3 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-center">
             <div className="flex-1 w-full md:w-auto">
                 <input 
                    type="text" 
                    placeholder="Quick Add: Description" 
                    value={qaDescription}
                    onChange={(e) => setQaDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                 />
             </div>
             <div className="w-full md:w-32">
                 <div className="relative">
                    <span className="absolute left-2 top-2 text-slate-400 text-xs font-bold">₹</span>
                    <input 
                        type="number" 
                        placeholder="Amount" 
                        value={qaAmount}
                        onChange={(e) => setQaAmount(e.target.value)}
                        className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                 </div>
             </div>
             <div className="w-full md:w-40">
                 <select 
                    value={qaCategory}
                    onChange={(e) => setQaCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                 >
                     {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
             </div>
             <button 
                onClick={handleQuickAdd}
                className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-1"
             >
                 <Plus size={16} /> Add
             </button>
        </div>

        <div className="overflow-auto flex-1">
            <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-200 sticky top-0 shadow-sm z-10">
                <tr>
                    <SortHeader label="Date" columnKey="date" />
                    <SortHeader label="Description" columnKey="description" />
                    <SortHeader label="Category" columnKey="category" />
                    <SortHeader label="Reported By" columnKey="reportedBy" />
                    <SortHeader label="Amount" columnKey="amount" align="right" />
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {paginatedExpenses.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center">
                                <Search size={32} className="mb-2 opacity-20" />
                                <p>No expenses found matching your criteria.</p>
                                {activeFilterCount > 0 && (
                                    <button 
                                        onClick={handleClearFilters}
                                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                ) : (
                    paginatedExpenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 text-sm text-slate-500">
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                                <Calendar size={14} className="text-slate-400" />
                                {format(new Date(expense.date), 'MMM dd, yyyy')}
                            </div>
                            <span className="text-xs text-slate-400 ml-6">{format(new Date(expense.date), 'HH:mm')}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">{expense.description}</td>
                        <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-sm">
                            {getCategoryIcon(expense.category)} {expense.category}
                        </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                    <UserIcon size={12} />
                                </div>
                                <span className="text-sm text-slate-600">{expense.reportedBy}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                            -₹{expense.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleEditClick(expense)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit Expense"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button 
                                    onClick={() => onDeleteExpense(expense.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove Expense"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        {filteredExpenses.length > ITEMS_PER_PAGE && (
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center">
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                    <ChevronLeft size={16} /> Prev
                </button>
                <span className="text-sm text-slate-500">
                    Page <span className="font-bold text-slate-800">{currentPage}</span> of {totalPages}
                </span>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                    Next <ChevronRight size={16} />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Expenses;
