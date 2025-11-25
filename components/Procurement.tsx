
import React, { useState, useMemo, useRef } from 'react';
import { Ingredient, User, UserRole, RequisitionRequest, RequisitionStatus, RequisitionUrgency } from '../types';
import { 
  Truck, AlertCircle, Clock, CheckCircle, XCircle, Package, 
  Plus, Search, ArrowRight, ShoppingCart, Filter, Trash2, Calendar, FilePlus, Archive, DollarSign, FileUp, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Link
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
  const [isManagerMode, setIsManagerMode] = useState(currentUser.role === UserRole.MANAGER);
  
  // -- CHEF STOREFRONT STATE --
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  // Custom Request State (Chef)
  const [showCustomReqModal, setShowCustomReqModal] = useState(false);
  const [customReqName, setCustomReqName] = useState('');
  const [customReqQty, setCustomReqQty] = useState('');
  const [customReqUnit, setCustomReqUnit] = useState('');
  const [customReqPrice, setCustomReqPrice] = useState('');
  const [customReqNote, setCustomReqNote] = useState('');
  const [customReqSupplier, setCustomReqSupplier] = useState('');

  // Add Catalog Item State (Manager)
  const [showAddCatalogModal, setShowAddCatalogModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCategory, setNewCatCategory] = useState('');
  const [newCatUnit, setNewCatUnit] = useState('kg');
  const [newCatCost, setNewCatCost] = useState('');

  // Bulk Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- ADMIN DASHBOARD STATE --
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterUrgency, setFilterUrgency] = useState<string>('All');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'requestedAt', direction: 'desc' });
  
  // PO Generation State
  const [poRequest, setPoRequest] = useState<RequisitionRequest | null>(null);

  // ------------------------------------------------------------------
  // CHEF LOGIC
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
    setCart([...cart, { 
      ingredient, 
      quantity: 0, // Default 0 to force user input
      urgency: RequisitionUrgency.LOW, 
      notes: '' 
    }]);
    setIsCartOpen(true);
  };

  const removeFromCart = (ingredientId: string) => {
    setCart(cart.filter(item => item.ingredient.id !== ingredientId));
  };

  const updateCartItem = (ingredientId: string, field: keyof CartItem, value: any) => {
    setCart(cart.map(item => 
      item.ingredient.id === ingredientId ? { ...item, [field]: value } : item
    ));
  };

  const submitRequisition = () => {
    // Validation
    const invalidItems = cart.filter(item => item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert(`Please enter a valid quantity for: ${invalidItems.map(i => i.ingredient.name).join(', ')}`);
      return;
    }

    cart.forEach(item => {
      const newRequest: RequisitionRequest = {
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
      };
      onRequestAdd(newRequest);
    });

    setCart([]);
    setIsCartOpen(false);
    alert('Requisition Submitted Successfully!');
    setActiveTab('history');
  };

  const handleCustomRequestSubmit = () => {
      if(!customReqName || !customReqQty || !customReqUnit) {
          alert("Please fill in required fields (Name, Quantity, Unit)");
          return;
      }

      const newRequest: RequisitionRequest = {
        id: `req-custom-${Date.now()}`,
        ingredientId: `custom-${Date.now()}`, // Temporary ID
        ingredientName: customReqName,
        quantity: parseFloat(customReqQty),
        unit: customReqUnit,
        urgency: RequisitionUrgency.MEDIUM, // Default
        status: RequisitionStatus.PENDING,
        requestedBy: currentUser.name,
        requestedAt: new Date(),
        notes: customReqNote,
        estimatedUnitCost: customReqPrice ? parseFloat(customReqPrice) : 0,
        preferredSupplier: customReqSupplier
      };

      onRequestAdd(newRequest);
      setShowCustomReqModal(false);
      setCustomReqName('');
      setCustomReqQty('');
      setCustomReqUnit('');
      setCustomReqPrice('');
      setCustomReqNote('');
      setCustomReqSupplier('');
      alert("Custom Request Submitted! Check 'My Orders' status.");
      setActiveTab('history');
  };

  // ------------------------------------------------------------------
  // ADMIN LOGIC
  // ------------------------------------------------------------------

  const handleAddCatalogItem = () => {
      if(!newCatName || !newCatCost) {
          alert("Please Name and Cost are required.");
          return;
      }

      const newIngredient: Ingredient = {
          id: `i-new-${Date.now()}`,
          name: newCatName,
          category: newCatCategory || 'General',
          unit: newCatUnit,
          unitCost: parseFloat(newCatCost),
          stockQuantity: 0
      };

      onAddIngredient(newIngredient);
      setShowAddCatalogModal(false);
      setNewCatName('');
      setNewCatCategory('');
      setNewCatCost('');
      alert("Item added to Catalog!");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        
        try {
            const lines = text.split('\n');
            const newItems: Ingredient[] = [];
            // Skip header if present (simple check)
            const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

            for(let i=startIndex; i<lines.length; i++) {
                const line = lines[i].trim();
                if(!line) continue;
                // Format: Name, Category, Unit, UnitCost, InitialStock(opt)
                // Use regex to handle CSV better
                const parts = line.split(',');
                if(parts.length < 4) continue;

                const name = parts[0].trim();
                const category = parts[1].trim();
                const unit = parts[2].trim();
                const cost = parseFloat(parts[3].trim());
                const stock = parts[4] ? parseFloat(parts[4].trim()) : 0;

                if(name && !isNaN(cost)) {
                    newItems.push({
                        id: `i-bulk-${Date.now()}-${i}`,
                        name,
                        category: category || 'General',
                        unit: unit || 'unit',
                        unitCost: cost,
                        stockQuantity: stock
                    });
                }
            }

            if(newItems.length > 0) {
                onBulkAddIngredients(newItems);
            } else {
                alert("No valid items found in CSV. Expected Format: Name, Category, Unit, UnitCost, Stock");
            }
        } catch (err) {
            alert("Error parsing CSV");
        }
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSort = (key: string) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      // Filter by Status
      if (filterStatus !== 'All' && req.status !== filterStatus) return false;
      
      // Filter by Urgency
      if (filterUrgency !== 'All' && req.urgency !== filterUrgency) return false;

      // Filter by Date
      if (filterDateStart) {
        const reqDate = new Date(req.requestedAt).setHours(0,0,0,0);
        const filterDate = new Date(filterDateStart).setHours(0,0,0,0);
        if (reqDate < filterDate) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof RequisitionRequest];
        let bVal: any = b[sortConfig.key as keyof RequisitionRequest];

        // Handle Status Specific Sorting Rank
        if (sortConfig.key === 'status') {
            // Priority: Pending > Ordered > Received > Rejected
            const ranks = { [RequisitionStatus.PENDING]: 4, [RequisitionStatus.ORDERED]: 3, [RequisitionStatus.RECEIVED]: 2, [RequisitionStatus.REJECTED]: 1 };
            aVal = ranks[a.status];
            bVal = ranks[b.status];
        } 
        else if (sortConfig.key === 'urgency') {
            const ranks = { [RequisitionUrgency.HIGH]: 3, [RequisitionUrgency.MEDIUM]: 2, [RequisitionUrgency.LOW]: 1 };
            aVal = ranks[a.urgency];
            bVal = ranks[b.urgency];
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [requests, filterStatus, filterUrgency, filterDateStart, sortConfig]);

  // ------------------------------------------------------------------
  // HELPER UI
  // ------------------------------------------------------------------

  const getStatusBadge = (status: RequisitionStatus) => {
    switch (status) {
      case RequisitionStatus.PENDING: 
        return <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit"><Clock size={12}/> Pending</span>;
      case RequisitionStatus.ORDERED: 
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit"><Truck size={12}/> Ordered</span>;
      case RequisitionStatus.RECEIVED: 
        return <span className="bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit"><CheckCircle size={12}/> Stocked</span>;
      case RequisitionStatus.REJECTED: 
        return <span className="bg-red-100 text-red-800 border border-red-200 px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 w-fit"><XCircle size={12}/> Rejected</span>;
    }
  };

  const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
      <th 
        className="px-6 py-4 font-semibold text-slate-600 text-sm cursor-pointer hover:bg-slate-50 transition-colors select-none"
        onClick={() => handleSort(sortKey)}
      >
          <div className="flex items-center gap-1">
              {label}
              {sortConfig.key === sortKey ? (
                  sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>
              ) : (
                  <ArrowUpDown size={14} className="text-slate-300"/>
              )}
          </div>
      </th>
  );

  // ------------------------------------------------------------------
  // VIEWS
  // ------------------------------------------------------------------

  const renderChefStorefront = () => (
    <div className="flex h-full gap-6">
      {/* Product Catalog */}
      <div className={`flex-1 flex flex-col ${isCartOpen ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex justify-between items-center mb-6">
           <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search ingredients catalog..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
           </div>
           
           <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowCustomReqModal(true)}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <FilePlus size={16} /> Request Custom Item
                </button>
                <button 
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    className="relative p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors lg:hidden"
                >
                    <ShoppingCart size={24} />
                    {cart.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full">{cart.length}</span>}
                </button>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-2">
            {filteredStoreIngredients.map(ing => {
                const isLowStock = ing.stockQuantity < 50;
                return (
                  <div key={ing.id} className={`group bg-white rounded-xl shadow-sm border ${isLowStock ? 'border-amber-200' : 'border-slate-200'} p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-blue-300`}>
                      <div className="flex items-start justify-between mb-2">
                          <div className={`p-2 rounded-lg ${isLowStock ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                              <Package size={24} />
                          </div>
                          {isLowStock && (
                              <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 animate-pulse">Low Stock</span>
                          )}
                      </div>
                      
                      <div className="mb-4">
                          <h4 className="font-bold text-slate-800 line-clamp-1" title={ing.name}>{ing.name}</h4>
                          <p className="text-sm text-slate-500">
                             In Stock: <span className={`font-mono font-medium ${isLowStock ? 'text-amber-600' : 'text-slate-700'}`}>{ing.stockQuantity} {ing.unit}</span>
                          </p>
                      </div>

                      <button 
                        onClick={() => addToCart(ing)}
                        className="w-full py-2 bg-slate-50 text-slate-700 font-medium rounded-lg hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white"
                      >
                         <Plus size={16} /> Request
                      </button>
                  </div>
                )
            })}
        </div>
      </div>

      {/* Cart Sidebar */}
      {(isCartOpen || cart.length > 0) && (
          <div className={`w-full lg:w-96 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col ${isCartOpen ? 'flex' : 'hidden lg:flex'}`}>
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <ShoppingCart size={20} /> Requisition List
                  </h3>
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{cart.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <Package size={48} className="mb-2 opacity-20" />
                          <p>Your list is empty.</p>
                          <p className="text-xs">Add items from the catalog.</p>
                      </div>
                  ) : (
                      cart.map((item, idx) => (
                          <div key={item.ingredient.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm relative group">
                              <button 
                                onClick={() => removeFromCart(item.ingredient.id)}
                                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                  <XCircle size={16} />
                              </button>
                              
                              <p className="font-bold text-slate-800 text-sm mb-1">{item.ingredient.name}</p>
                              <p className="text-xs text-slate-500 mb-3">Unit: {item.ingredient.unit}</p>
                              
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                      <label className="text-[10px] uppercase font-bold text-slate-400">Qty Needed</label>
                                      <input 
                                        type="number"
                                        value={item.quantity === 0 ? '' : item.quantity}
                                        onChange={(e) => updateCartItem(item.ingredient.id, 'quantity', parseFloat(e.target.value))}
                                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-[10px] uppercase font-bold text-slate-400">Urgency</label>
                                      <select 
                                        value={item.urgency}
                                        onChange={(e) => updateCartItem(item.ingredient.id, 'urgency', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                      >
                                          <option value={RequisitionUrgency.LOW}>Low</option>
                                          <option value={RequisitionUrgency.MEDIUM}>Medium</option>
                                          <option value={RequisitionUrgency.HIGH}>High</option>
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <input 
                                    type="text"
                                    placeholder="Notes (optional)"
                                    value={item.notes}
                                    onChange={(e) => updateCartItem(item.ingredient.id, 'notes', e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-300 text-slate-600"
                                  />
                              </div>
                          </div>
                      ))
                  )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                  <button 
                    onClick={submitRequisition}
                    disabled={cart.length === 0}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                  >
                      Submit Requisition <ArrowRight size={18} />
                  </button>
              </div>
          </div>
      )}
    </div>
  );

  const renderChefHistory = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">My Request History</h3>
          </div>
          <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-200">
                      <tr>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Item</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Requested</th>
                          <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Note</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {requests.filter(r => r.requestedBy === currentUser.name).length === 0 ? (
                          <tr><td colSpan={4} className="p-8 text-center text-slate-400">No requests found. Go to "Store" to create one.</td></tr>
                      ) : (
                        requests
                        .filter(r => r.requestedBy === currentUser.name)
                        .sort((a,b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                        .map(req => (
                            <tr key={req.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <p className="font-medium text-slate-800">{req.ingredientName}</p>
                                    <p className="text-xs text-slate-500">{req.quantity} {req.unit}</p>
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(req.status)}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {format(new Date(req.requestedAt), 'MMM dd, HH:mm')}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 italic truncate max-w-xs">
                                    {req.notes || '-'}
                                </td>
                            </tr>
                        ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderAdminDashboard = () => (
    <div className="flex flex-col h-full space-y-4">
        {/* Hidden File Input */}
        <input 
            type="file" 
            accept=".csv"
            ref={fileInputRef}
            onChange={handleBulkUpload}
            className="hidden"
        />

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
                <Filter size={18} /> Filters:
            </div>
            
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-bold">Status</span>
                <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"
                >
                    <option value="All">All Statuses</option>
                    <option value={RequisitionStatus.PENDING}>Pending</option>
                    <option value={RequisitionStatus.ORDERED}>Ordered</option>
                    <option value={RequisitionStatus.RECEIVED}>Received</option>
                    <option value={RequisitionStatus.REJECTED}>Rejected</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-bold">Urgency</span>
                <select 
                    value={filterUrgency} 
                    onChange={(e) => setFilterUrgency(e.target.value)}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"
                >
                    <option value="All">All Levels</option>
                    <option value={RequisitionUrgency.HIGH}>High</option>
                    <option value={RequisitionUrgency.MEDIUM}>Medium</option>
                    <option value={RequisitionUrgency.LOW}>Low</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-bold">Since</span>
                <input 
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <button 
                onClick={() => { setFilterStatus('All'); setFilterUrgency('All'); setFilterDateStart(''); }}
                className="text-xs text-blue-600 hover:text-blue-800 ml-auto font-medium"
            >
                Reset Filters
            </button>
            
            <div className="w-px h-6 bg-slate-300 mx-2"></div>
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
                <FileUp size={16} /> Bulk Catalog
            </button>
            <button 
                onClick={() => setShowAddCatalogModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
                <Plus size={16} /> Add Item
            </button>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Procurement Control Tower</h3>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                    <thead className="bg-white border-b border-slate-200 sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Item Details</th>
                            <SortHeader label="Requester" sortKey="requestedBy" />
                            <SortHeader label="Urgency" sortKey="urgency" />
                            <SortHeader label="Status" sortKey="status" />
                            <SortHeader label="Date" sortKey="requestedAt" />
                            <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Workflow Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRequests.length === 0 ? (
                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">No requests match your filters.</td></tr>
                        ) : (
                            filteredRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800 text-sm">{req.ingredientName}</p>
                                        <p className="text-sm text-slate-500">Qty: {req.quantity} {req.unit}</p>
                                        {req.estimatedUnitCost && req.estimatedUnitCost > 0 && (
                                            <p className="text-xs text-slate-400">Est. Cost: ₹{req.estimatedUnitCost}</p>
                                        )}
                                        {req.notes && (
                                            <div className="mt-1 text-xs text-slate-500 bg-slate-100 p-1 rounded inline-block">
                                                Note: {req.notes}
                                            </div>
                                        )}
                                        {req.preferredSupplier && (
                                            <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                                                <Link size={10} /> {req.preferredSupplier}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700">{req.requestedBy}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {req.urgency === RequisitionUrgency.HIGH && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">High</span>}
                                        {req.urgency === RequisitionUrgency.MEDIUM && <span className="text-xs font-semibold text-orange-600">Medium</span>}
                                        {req.urgency === RequisitionUrgency.LOW && <span className="text-xs text-slate-500">Low</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} /> {format(new Date(req.requestedAt), 'MMM dd')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Action: Pending -> Approved/Ordered */}
                                            {req.status === RequisitionStatus.PENDING && (
                                                <>
                                                    <button 
                                                        onClick={() => onRequestUpdate(req.id, RequisitionStatus.REJECTED)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Reject Request"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => onRequestUpdate(req.id, RequisitionStatus.ORDERED)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 shadow-sm transition-colors"
                                                    >
                                                        <Truck size={12} /> Approve & Order
                                                    </button>
                                                </>
                                            )}

                                            {/* Action: Ordered -> Generate PO or Receive */}
                                            {req.status === RequisitionStatus.ORDERED && (
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setPoRequest(req)}
                                                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                                                        title="Generate Purchase Order"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => onReceiveItem(req.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 shadow-sm transition-colors"
                                                    >
                                                        <CheckCircle size={12} /> Receive Stock
                                                    </button>
                                                </div>
                                            )}

                                            {(req.status === RequisitionStatus.RECEIVED || req.status === RequisitionStatus.REJECTED) && (
                                                <span className="text-xs text-slate-300 font-mono">No Actions</span>
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
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4 relative">
      {/* Top Header & Navigation */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Procurement Module</h2>
            <p className="text-slate-500 text-sm">
                {isManagerMode ? 'Manage company purchasing and inventory flow.' : 'Request ingredients and supplies.'}
            </p>
         </div>

         <div className="flex items-center bg-slate-100 p-1 rounded-lg">
             {currentUser.role === UserRole.MANAGER ? (
                 <>
                    <button 
                        onClick={() => setIsManagerMode(true)}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${isManagerMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Manager Dashboard
                    </button>
                    <button 
                        onClick={() => setIsManagerMode(false)}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!isManagerMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Chef Storefront
                    </button>
                 </>
             ) : (
                <>
                    <button 
                        onClick={() => setActiveTab('store')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'store' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Storefront
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        My Orders
                    </button>
                </>
             )}
         </div>
      </div>

      <div className="flex-1 overflow-hidden">
         {isManagerMode ? (
             renderAdminDashboard()
         ) : (
             activeTab === 'store' ? renderChefStorefront() : renderChefHistory()
         )}
      </div>

      {/* MODAL: CUSTOM REQUEST (CHEF) */}
      {showCustomReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FilePlus size={20} /> Request Custom Item</h3>
                      <button onClick={() => setShowCustomReqModal(false)} className="text-slate-400 hover:text-slate-600">
                          <XCircle size={20} />
                      </button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                          <input type="text" value={customReqName} onChange={e => setCustomReqName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Truffle Oil" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                            <input type="number" value={customReqQty} onChange={e => setCustomReqQty(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                            <input type="text" value={customReqUnit} onChange={e => setCustomReqUnit(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="bottle" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Est. Price / Unit (₹) (Optional)</label>
                          <input type="number" value={customReqPrice} onChange={e => setCustomReqPrice(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Supplier / Link</label>
                          <input type="text" value={customReqSupplier} onChange={e => setCustomReqSupplier(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Amazon URL or Supplier Name" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                          <textarea value={customReqNote} onChange={e => setCustomReqNote(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Brand preference, delivery instructions, etc."></textarea>
                      </div>
                      <button onClick={handleCustomRequestSubmit} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Submit Request</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: PURCHASE ORDER VIEW */}
      {poRequest && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white shadow-2xl p-8 w-full max-w-2xl transform transition-all scale-100 min-h-[600px] flex flex-col">
                  {/* PO Print Layout */}
                  <div className="flex-1 border-2 border-slate-800 p-8" id="purchase-order">
                      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
                          <div>
                              <h1 className="text-3xl font-serif font-bold text-slate-900">PURCHASE ORDER</h1>
                              <p className="text-slate-600 text-sm mt-1">Bihari Chatkara Pvt Ltd.</p>
                              <p className="text-slate-500 text-xs">Patna, Bihar - 800001</p>
                          </div>
                          <div className="text-right">
                              <p className="font-bold text-lg">PO #: {`PO-${poRequest.id.split('-')[1]}`}</p>
                              <p className="text-sm">Date: {format(new Date(), 'dd MMM yyyy')}</p>
                          </div>
                      </div>

                      <div className="mb-8">
                          <h3 className="font-bold text-slate-800 border-b border-slate-300 mb-2 uppercase text-xs tracking-wider">Vendor</h3>
                          {poRequest.preferredSupplier ? (
                              <p className="text-lg">{poRequest.preferredSupplier}</p>
                          ) : (
                              <p className="text-lg italic text-slate-400">[ General Market Vendor ]</p>
                          )}
                      </div>

                      <div className="mb-8">
                          <table className="w-full text-left">
                              <thead className="bg-slate-100">
                                  <tr>
                                      <th className="py-2 px-2 border border-slate-300">Item Name</th>
                                      <th className="py-2 px-2 border border-slate-300">Quantity</th>
                                      <th className="py-2 px-2 border border-slate-300">Unit</th>
                                      <th className="py-2 px-2 border border-slate-300 text-right">Est. Unit Cost</th>
                                      <th className="py-2 px-2 border border-slate-300 text-right">Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr>
                                      <td className="py-2 px-2 border border-slate-300">{poRequest.ingredientName}</td>
                                      <td className="py-2 px-2 border border-slate-300">{poRequest.quantity}</td>
                                      <td className="py-2 px-2 border border-slate-300">{poRequest.unit}</td>
                                      <td className="py-2 px-2 border border-slate-300 text-right">₹{poRequest.estimatedUnitCost || 0}</td>
                                      <td className="py-2 px-2 border border-slate-300 text-right font-bold">₹{((poRequest.estimatedUnitCost || 0) * poRequest.quantity).toFixed(2)}</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>

                      <div className="mt-12 flex justify-between items-end">
                          <div className="w-1/2">
                              {poRequest.notes && (
                                  <>
                                      <p className="font-bold text-xs uppercase mb-1">Notes / Instructions:</p>
                                      <p className="text-sm bg-slate-50 p-2 border border-slate-200">{poRequest.notes}</p>
                                  </>
                              )}
                          </div>
                          <div className="text-center">
                              <div className="border-b border-black w-48 mb-2"></div>
                              <p className="text-xs font-bold uppercase">Authorized Signature</p>
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-4 print:hidden">
                       <button onClick={() => setPoRequest(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Close</button>
                       <button onClick={() => window.print()} className="px-6 py-2 bg-slate-900 text-white rounded font-bold flex items-center gap-2 hover:bg-slate-800">
                           <Printer size={18} /> Print PO
                       </button>
                  </div>
              </div>
           </div>
      )}

      {/* MODAL: ADD TO CATALOG (MANAGER) */}
      {showAddCatalogModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Archive size={20} /> Add Item to Catalog</h3>
                      <button onClick={() => setShowAddCatalogModal(false)} className="text-slate-400 hover:text-slate-600">
                          <XCircle size={20} />
                      </button>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 border border-blue-100">
                          Adding an item here makes it available for all chefs to order via the Storefront.
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
                          <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Saffron" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <input type="text" value={newCatCategory} onChange={e => setNewCatCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Spices" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                            <input type="text" value={newCatUnit} onChange={e => setNewCatUnit(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="gram" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (₹) *</label>
                          <input type="number" value={newCatCost} onChange={e => setNewCatCost(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" />
                      </div>
                      <button onClick={handleAddCatalogItem} className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900">Add to System</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Procurement;
