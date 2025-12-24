import React, { useState, useMemo, useRef } from 'react';
import { Ingredient, User, UserRole, RequisitionRequest, RequisitionStatus, RequisitionUrgency } from '../types';
import { 
  Truck, AlertCircle, Clock, CheckCircle, XCircle, Package, 
  Plus, Search, ArrowRight, ShoppingCart, Filter, Trash2, Calendar, FilePlus, Archive, DollarSign, FileUp, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Link, Download, Edit3, Save, X, List, Database
} from 'lucide-react';
import { format } from 'date-fns';

interface ProcurementProps {
  ingredients: Ingredient[];
  requests: RequisitionRequest[];
  currentUser: User;
  onRequestAdd: (req: RequisitionRequest) => void;
  onRequestUpdate: (id: string, status: RequisitionStatus) => void;
  onReceiveItem: (requestId: string) => void;
  onAddIngredient: (ingredient: Ingredient) => void;
  onBulkAddIngredients: (ingredients: Ingredient[]) => void;
}

interface CartItem {
  ingredient: Ingredient;
  quantity: number;
  urgency: RequisitionUrgency;
  notes: string;
}

const Procurement: React.FC<ProcurementProps> = ({ 
  ingredients, 
  requests, 
  currentUser, 
  onRequestAdd, 
  onRequestUpdate,
  onReceiveItem,
  onAddIngredient,
  onBulkAddIngredients
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'history'>('store');
  const [managerSubTab, setManagerSubTab] = useState<'requests' | 'catalog'>('requests');
  const [isManagerMode, setIsManagerMode] = useState(currentUser.role === UserRole.MANAGER);
  
  // -- STATE: CHEF STOREFRONT --
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  // -- STATE: MODALS & FORMS --
  const [showCustomReqModal, setShowCustomReqModal] = useState(false);
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  
  // Custom Request Form
  const [customReq, setCustomReq] = useState({ name: '', qty: '', unit: '', price: '', note: '', supplier: '' });
  
  // Catalog Item Form
  const [catForm, setCatForm] = useState({ name: '', category: '', unit: 'kg', cost: '' });

  // Bulk Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- STATE: ADMIN FILTERS --
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterUrgency, setFilterUrgency] = useState<string>('All');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'requestedAt', direction: 'desc' });
  
  // PO Preview
  const [poRequest, setPoRequest] = useState<RequisitionRequest | null>(null);

  // ------------------------------------------------------------------
  // LOGIC: CHEF ACTIONS
  // ------------------------------------------------------------------
  
  const filteredStoreIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const addToCart = (ingredient: Ingredient) => {
    if (cart.find(item => item.ingredient.id === ingredient.id)) {
      alert("Item is already in your request list!");
      setIsCartOpen(true);
      return;
    }
    setCart([...cart, { ingredient, quantity: 0, urgency: RequisitionUrgency.LOW, notes: '' }]);
    setIsCartOpen(true);
  };

  const submitRequisition = () => {
    const invalidItems = cart.filter(item => item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert(`Invalid quantity for: ${invalidItems.map(i => i.ingredient.name).join(', ')}`);
      return;
    }

    cart.forEach(item => {
      onRequestAdd({
        id: `req-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        ingredientId: item.ingredient.id,
        ingredientName: item.ingredient.name,
        quantity: item.quantity,
        unit: item.ingredient.unit,
        urgency: item.urgency,
        status: RequisitionStatus.PENDING,
        requestedBy: currentUser.name,
        requestedAt: new Date(),
        notes: item.notes,
        estimatedUnitCost: item.ingredient.unitCost
      });
    });

    setCart([]);
    setIsCartOpen(false);
    alert('Requisitions submitted to Manager.');
    setActiveTab('history');
  };

  // ------------------------------------------------------------------
  // LOGIC: MANAGER ACTIONS
  // ------------------------------------------------------------------

  const handleDownloadCatalog = () => {
    const headers = "Name,Category,Unit,UnitCost,StockQuantity\n";
    const csvContent = ingredients.map(i => `"${i.name}","${i.category || 'General'}","${i.unit}",${i.unitCost},${i.stockQuantity}`).join("\n");
    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RMS_Catalog_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(catForm.cost);
    if(!catForm.name || isNaN(cost)) {
        alert("Name and Unit Cost are required.");
        return;
    }

    if (editingIngredient) {
        // We use onAddIngredient to handle updates if the system doesn't have a separate update handler 
        // OR we just treat it as a new item. To properly update, we'd need onUpdateIngredient.
        // For now, let's assume onAddIngredient handles local/db persistence.
        onAddIngredient({
            ...editingIngredient,
            name: catForm.name,
            category: catForm.category || 'General',
            unit: catForm.unit,
            unitCost: cost
        });
    } else {
        onAddIngredient({
            id: `i-man-${Date.now()}`,
            name: catForm.name,
            category: catForm.category || 'General',
            unit: catForm.unit,
            unitCost: cost,
            stockQuantity: 0
        });
    }
    
    setShowAddCatalogModal(false);
    setEditingIngredient(null);
    setCatForm({ name: '', category: '', unit: 'kg', cost: '' });
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        try {
            const lines = text.split(/\r?\n/);
            const newItems: Ingredient[] = [];
            const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

            for(let i=startIndex; i<lines.length; i++) {
                const line = lines[i].trim();
                if(!line) continue;
                // Simple CSV splitter that handles some quoted fields
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(p => p.replace(/"/g, '')) || line.split(',');
                
                if(parts.length < 4) continue;
                const cost = parseFloat(parts[3]);
                if(parts[0] && !isNaN(cost)) {
                    newItems.push({
                        id: `i-bulk-${Date.now()}-${i}`,
                        name: parts[0], category: parts[1] || 'General', unit: parts[2] || 'unit', 
                        unitCost: cost, stockQuantity: parts[4] ? parseFloat(parts[4]) : 0
                    });
                }
            }
            if(newItems.length > 0) {
                onBulkAddIngredients(newItems);
                alert(`Imported ${newItems.length} items.`);
            }
        } catch (err) { alert("Error parsing CSV. Check format: Name, Category, Unit, Cost, Stock"); }
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // ------------------------------------------------------------------
  // RENDER HELPERS
  // ------------------------------------------------------------------

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filterStatus !== 'All' && req.status !== filterStatus) return false;
      if (filterUrgency !== 'All' && req.urgency !== filterUrgency) return false;
      return true;
    }).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [requests, filterStatus, filterUrgency]);

  const filteredCatalog = useMemo(() => {
    return ingredients.filter(i => 
        i.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
        i.category?.toLowerCase().includes(catalogSearch.toLowerCase())
    );
  }, [ingredients, catalogSearch]);

  const getStatusBadge = (status: RequisitionStatus) => {
    const styles = {
        [RequisitionStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        [RequisitionStatus.ORDERED]: 'bg-blue-100 text-blue-800 border-blue-200',
        [RequisitionStatus.RECEIVED]: 'bg-green-100 text-green-800 border-green-200',
        [RequisitionStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
    };
    return <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${styles[status]}`}>{status}</span>;
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Module Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Truck className="text-blue-600" /> Procurement</h2>
            <p className="text-slate-500 text-sm font-medium">Supply chain and inventory replenishment hub.</p>
         </div>
         <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
             {currentUser.role === UserRole.MANAGER ? (
                 <div className="flex gap-1">
                    <button onClick={() => setIsManagerMode(true)} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${isManagerMode ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>MANAGER CONTROL</button>
                    <button onClick={() => setIsManagerMode(false)} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!isManagerMode ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>CHEF VIEW</button>
                 </div>
             ) : (
                <div className="flex gap-1">
                    <button onClick={() => setActiveTab('store')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'store' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>STOREFRONT</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>MY REQUESTS</button>
                </div>
             )}
         </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {isManagerMode ? (
            <div className="flex flex-col h-full space-y-4">
                {/* Manager Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setManagerSubTab('requests')} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 ${managerSubTab === 'requests' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><List size={14}/> REQUISITIONS</button>
                        <button onClick={() => setManagerSubTab('catalog')} className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 ${managerSubTab === 'catalog' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><Database size={14}/> MASTER CATALOG</button>
                    </div>

                    <div className="flex gap-2">
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm" title="Bulk Upload Items"><FileUp size={20}/></button>
                        <button onClick={handleDownloadCatalog} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm" title="Download Full Catalog"><Download size={20}/></button>
                        <button onClick={() => { setEditingIngredient(null); setCatForm({name:'', category:'', unit:'kg', cost:''}); setShowAddCatalogModal(true); }} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"><Plus size={18}/> ADD TO CATALOG</button>
                    </div>
                </div>

                {managerSubTab === 'requests' ? (
                    <div className="bg-white rounded-2xl border border-slate-200 flex-1 overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-400 uppercase">Status:</span><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none"><option value="All">All</option>{Object.values(RequisitionStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-400 uppercase">Urgency:</span><select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none"><option value="All">All</option>{Object.values(RequisitionUrgency).map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Item Requested</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Staff</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Urgency</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRequests.length === 0 ? (
                                        <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold">No active requisitions found.</td></tr>
                                    ) : (
                                        filteredRequests.map(req => (
                                            <tr key={req.id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-800">{req.ingredientName}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{req.quantity} {req.unit} @ ₹{req.estimatedUnitCost || 0}/unit</p>
                                                    {req.notes && <p className="text-[10px] text-slate-400 italic mt-1 max-w-xs truncate">{req.notes}</p>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-xs font-bold text-slate-700">{req.requestedBy}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(req.requestedAt), 'dd-MM-yyyy hh:mm a')}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${req.urgency === 'HIGH' ? 'bg-red-100 text-red-600' : req.urgency === 'MEDIUM' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>{req.urgency}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">{getStatusBadge(req.status)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {req.status === RequisitionStatus.PENDING && (
                                                            <>
                                                                <button onClick={() => onRequestUpdate(req.id, RequisitionStatus.REJECTED)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><XCircle size={18}/></button>
                                                                <button onClick={() => onRequestUpdate(req.id, RequisitionStatus.ORDERED)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black shadow-lg shadow-blue-100 flex items-center gap-1 hover:bg-blue-700"><Truck size={12}/> ORDER NOW</button>
                                                            </>
                                                        )}
                                                        {req.status === RequisitionStatus.ORDERED && (
                                                            <button onClick={() => onReceiveItem(req.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black shadow-lg shadow-emerald-100 flex items-center gap-1 hover:bg-emerald-700"><CheckCircle size={12}/> RECEIVE STOCK</button>
                                                        )}
                                                        {req.status === RequisitionStatus.ORDERED && (
                                                            <button onClick={() => setPoRequest(req)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"><FileText size={16}/></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Master Catalog View for Manager */
                    <div className="bg-white rounded-2xl border border-slate-200 flex-1 overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search catalog items..." 
                                    value={catalogSearch}
                                    onChange={(e) => setCatalogSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                                />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{filteredCatalog.length} items defined</span>
                        </div>
                        <div className="overflow-auto flex-1">
                             <table className="w-full text-left">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Ingredient Name</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Category</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Unit Cost</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Current Stock</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCatalog.map(ing => (
                                        <tr key={ing.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">{ing.name}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{ing.category || 'General'}</td>
                                            <td className="px-6 py-4 text-xs font-black text-slate-900">₹{(ing.unitCost || 0).toFixed(2)} / {ing.unit}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${ing.stockQuantity < 10 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                    {ing.stockQuantity} {ing.unit}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setEditingIngredient(ing);
                                                        setCatForm({ name: ing.name, category: ing.category || '', unit: ing.unit, cost: ing.unitCost.toString() });
                                                        setShowAddCatalogModal(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <Edit3 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            /* Chef Storefront View */
            <div className="flex h-full gap-6">
                <div className={`flex-1 flex flex-col ${isCartOpen ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="relative w-full max-w-md">
                            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                            <input type="text" placeholder="Search ingredient catalog..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 shadow-sm font-medium" />
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowCustomReqModal(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-700 shadow-lg"><FilePlus size={16} /> CUSTOM ITEM</button>
                             <button onClick={() => setIsCartOpen(!isCartOpen)} className="lg:hidden p-3 bg-blue-600 text-white rounded-xl shadow-lg relative"><ShoppingCart size={20} />{cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">{cart.length}</span>}</button>
                        </div>
                    </div>
                    {activeTab === 'store' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-4">
                            {filteredStoreIngredients.map(ing => (
                                <div key={ing.id} onClick={() => addToCart(ing)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-xl cursor-pointer transition-all flex flex-col justify-between group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors"><Package size={24}/></div>
                                        {ing.stockQuantity < 5 ? <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded">Critical</span> : null}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 truncate leading-tight mb-1">{ing.name}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ing.category || 'General'}</p>
                                    </div>
                                    <div className="mt-4 flex justify-between items-center border-t border-slate-50 pt-3">
                                        <span className="text-xs font-bold text-slate-500">Stock: {ing.stockQuantity} {ing.unit}</span>
                                        <Plus size={16} className="text-blue-600" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col shadow-sm">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="text-sm font-black text-slate-800">REQUEST LOG</h3></div>
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Item</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Quantity</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Status</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Date</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {requests.filter(r => r.requestedBy === currentUser.name).map(req => (
                                            <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">{req.ingredientName}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-500">{req.quantity} {req.unit}</td>
                                                <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                                <td className="px-6 py-4 text-right text-[10px] font-bold text-slate-400">{format(new Date(req.requestedAt), 'dd-MM-yyyy hh:mm a')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {(isCartOpen || cart.length > 0) && (
                    <div className={`w-full lg:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col ${isCartOpen ? 'flex' : 'hidden lg:flex'} animate-in slide-in-from-right-4`}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                            <h3 className="font-black text-lg flex items-center gap-2 text-slate-800"><ShoppingCart size={22} className="text-blue-600"/> Request List</h3>
                            <button onClick={() => setIsCartOpen(false)} className="lg:hidden text-slate-400"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 opacity-50">
                                    <Package size={48}/><p className="font-black text-sm uppercase tracking-tighter">List is empty</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.ingredient.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 relative group">
                                        <button onClick={() => setCart(cart.filter(c => c.ingredient.id !== item.ingredient.id))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><XCircle size={18}/></button>
                                        <div><p className="font-black text-slate-800 text-sm leading-tight">{item.ingredient.name}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.ingredient.unit}</p></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-[9px] font-black text-slate-400 uppercase">Qty Needed</label><input type="number" value={item.quantity === 0 ? '' : item.quantity} onChange={(e) => setCart(cart.map(c => c.ingredient.id === item.ingredient.id ? {...c, quantity: parseFloat(e.target.value)} : c))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold" /></div>
                                            <div><label className="text-[9px] font-black text-slate-400 uppercase">Urgency</label><select value={item.urgency} onChange={(e) => setCart(cart.map(c => c.ingredient.id === item.ingredient.id ? {...c, urgency: e.target.value as any} : c))} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"><option value="LOW">Low</option><option value="MEDIUM">Med</option><option value="HIGH">High</option></select></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                            <button onClick={submitRequisition} disabled={cart.length === 0} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 uppercase tracking-tight">SUBMIT TO MANAGER <ArrowRight size={18}/></button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Modal: Add/Edit Catalog Item */}
      {showAddCatalogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black flex items-center gap-2">{editingIngredient ? <Edit3 className="text-blue-600"/> : <Archive className="text-blue-600"/>} {editingIngredient ? 'Edit Item' : 'New Catalog Item'}</h3>
                      <button onClick={() => setShowAddCatalogModal(false)} className="text-slate-400"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleSaveCatalogItem} className="space-y-4">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Item Name *</label><input autoFocus type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} required className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="e.g. Saffron" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Category</label><input type="text" value={catForm.category} onChange={e => setCatForm({...catForm, category: e.target.value})} className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="Spices" /></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Unit</label><input type="text" value={catForm.unit} onChange={e => setCatForm({...catForm, unit: e.target.value})} required className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="kg" /></div>
                      </div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Market Cost per Unit (₹) *</label><input type="number" step="0.01" value={catForm.cost} onChange={e => setCatForm({...catForm, cost: e.target.value})} required className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="0.00" /></div>
                      <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-tight">{editingIngredient ? 'Update Definition' : 'Save to Master Catalog'}</button>
                  </form>
              </div>
          </div>
      )}

      {/* Modal: Custom Request (Chef) */}
      {showCustomReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-black flex items-center gap-2"><FilePlus className="text-blue-600"/> Request New Item</h3>
                      <button onClick={() => setShowCustomReqModal(false)} className="text-slate-400"><X size={24}/></button>
                  </div>
                  <div className="space-y-4">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Item Name *</label><input type="text" value={customReq.name} onChange={e => setCustomReq({...customReq, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="e.g. Exotic Herbs" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qty *</label><input type="number" value={customReq.qty} onChange={e => setCustomReq({...customReq, qty: e.target.value})} className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="0" /></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Unit *</label><input type="text" value={customReq.unit} onChange={e => setCustomReq({...customReq, unit: e.target.value})} className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="pkt" /></div>
                      </div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Notes</label><textarea value={customReq.note} onChange={e => setCustomReq({...customReq, note: e.target.value})} className="w-full px-4 py-2 border rounded-xl h-20 font-medium resize-none" placeholder="Brand, size, or quality details..."></textarea></div>
                      <button onClick={() => { 
                          if(!customReq.name || !customReq.qty) return alert("Fill required fields");
                          onRequestAdd({
                              id: `req-cust-${Date.now()}`, ingredientId: `custom-${Date.now()}`, ingredientName: customReq.name,
                              quantity: parseFloat(customReq.qty), unit: customReq.unit || 'unit', urgency: RequisitionUrgency.MEDIUM,
                              status: RequisitionStatus.PENDING, requestedBy: currentUser.name, requestedAt: new Date(), notes: customReq.note
                          });
                          setShowCustomReqModal(false); setCustomReq({name:'', qty:'', unit:'', price:'', note:'', supplier:''});
                          alert("Request sent."); setActiveTab('history');
                      }} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-tight">SUBMIT CUSTOM REQUEST</button>
                  </div>
              </div>
          </div>
      )}

      {/* PO Print Preview Modal */}
      {poRequest && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
               <div className="bg-white shadow-2xl p-8 w-full max-w-2xl rounded-lg animate-in zoom-in-95">
                    <div id="purchase-order" className="border-2 border-slate-900 p-8 font-serif">
                        <div className="flex justify-between border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h1 className="text-3xl font-black">PURCHASE ORDER</h1><p className="text-sm">Bihari Chatkara Enterprise</p></div>
                            <div className="text-right text-sm font-bold"><p>PO #: {poRequest.id.slice(-6).toUpperCase()}</p><p>DATE: {format(new Date(), 'dd-MMM-yyyy')}</p></div>
                        </div>
                        <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
                            <div><h4 className="font-black uppercase border-b mb-2">Ship To:</h4><p>Bihari Chatkara Kitchen</p><p>Noida Sector 45 Branch</p></div>
                            <div><h4 className="font-black uppercase border-b mb-2">Supplier:</h4><p className="italic text-slate-400">[ Market Local Vendor ]</p></div>
                        </div>
                        <table className="w-full text-left text-sm mb-12 border-collapse">
                            <thead><tr className="bg-slate-100"><th className="border p-2">ITEM DESCRIPTION</th><th className="border p-2 text-center">QTY</th><th className="border p-2">UNIT</th><th className="border p-2 text-right">EST. COST</th></tr></thead>
                            <tbody><tr><td className="border p-2 font-bold">{poRequest.ingredientName}</td><td className="border p-2 text-center">{poRequest.quantity}</td><td className="border p-2">{poRequest.unit}</td><td className="border p-2 text-right">₹{poRequest.estimatedUnitCost || 0}</td></tr></tbody>
                        </table>
                        <div className="flex justify-between items-end mt-20">
                            <div className="w-1/2 text-xs border-t pt-2">Authorized Signatory</div>
                            <div className="text-right font-black text-xl">TOTAL: ₹{((poRequest.estimatedUnitCost || 0) * poRequest.quantity).toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3 no-print">
                        <button onClick={() => setPoRequest(null)} className="px-6 py-2 font-bold text-slate-500">CANCEL</button>
                        <button onClick={() => window.print()} className="px-8 py-2 bg-black text-white font-black rounded-lg flex items-center gap-2"><Printer size={18}/> PRINT ORDER</button>
                    </div>
               </div>
           </div>
      )}
    </div>
  );
};

export default Procurement;