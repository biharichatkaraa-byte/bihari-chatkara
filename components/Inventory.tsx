
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MenuItem, Ingredient } from '../types';
import { generateMenuInsights } from '../services/geminiService';
import { Calculator, Sparkles, ChefHat, Tag, DollarSign, Package, AlertTriangle, Search, Save, RotateCcw, Check, FileUp, Download, ArrowUpDown, ArrowUp, ArrowDown, Filter, Square, CheckSquare, Edit3, X, Plus, Trash2, Pencil, Power, Ban, CheckCircle2 } from 'lucide-react';

interface InventoryProps {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  onSave: (ingredients: Ingredient[]) => void;
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onBulkUpdateMenuItems: (ids: string[], updates: Partial<MenuItem>) => void;
  onBulkDeleteMenuItems: (ids: string[]) => void;
  onBulkAddMenuItems: (items: MenuItem[]) => void;
}

type SortKey = keyof Ingredient | 'totalValue';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'low' | 'in_stock';

const Inventory: React.FC<InventoryProps> = ({ 
    ingredients, 
    menuItems, 
    onSave, 
    onAddMenuItem,
    onUpdateMenuItem,
    onDeleteMenuItem,
    onBulkUpdateMenuItems,
    onBulkDeleteMenuItems,
    onBulkAddMenuItems
}) => {
  const [activeView, setActiveView] = useState<'menu' | 'stock'>('menu');
  
  // Menu View State
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [aiInsights, setAiInsights] = useState<{ description: string; dietaryTags: string[]; suggestedPriceRange: string } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  
  // Menu Bulk & Edit State
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const [showEditMenuModal, setShowEditMenuModal] = useState(false);
  const [editMenuData, setEditMenuData] = useState<Partial<MenuItem>>({});
  const [bulkMenuCategory, setBulkMenuCategory] = useState('');
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  
  // New Menu Item State
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');

  // Stock View State
  const [localIngredients, setLocalIngredients] = useState<Ingredient[]>(ingredients);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Ingredient State
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngCost, setNewIngCost] = useState('');
  const [newIngQty, setNewIngQty] = useState('');

  // Bulk Edit State (Inventory)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState<string>('');
  const [bulkCost, setBulkCost] = useState<string>('');

  // Sorting & Filtering State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');

  // Sync local state when props change, but only if we haven't modified it locally
  useEffect(() => {
    if (!hasUnsavedChanges) {
        setLocalIngredients(ingredients);
    }
  }, [ingredients, hasUnsavedChanges]);

  // Derived Filter Options
  const availableCategories = useMemo(() => {
    const categories = new Set(localIngredients.map(i => i.category).filter(Boolean));
    return Array.from(categories).sort() as string[];
  }, [localIngredients]);

  const availableUnits = useMemo(() => {
      const units = new Set(localIngredients.map(i => i.unit));
      return Array.from(units).sort();
  }, [localIngredients]);

  const calculatePlateCost = (item: MenuItem): number => {
    let totalCost = 0;
    item.ingredients.forEach(ref => {
      const ingredient = ingredients.find(i => i.id === ref.ingredientId);
      if (ingredient) {
        totalCost += ingredient.unitCost * ref.quantity;
      }
    });
    return totalCost;
  };

  const handleAiAnalysis = async (item: MenuItem) => {
    setIsLoadingAi(true);
    setAiInsights(null);
    try {
        const result = await generateMenuInsights(item, ingredients);
        setAiInsights(result);
    } catch (error) {
        console.error("AI Analysis Failed", error);
        setAiInsights({
            description: "Failed to load AI insights.",
            dietaryTags: [],
            suggestedPriceRange: "N/A"
        });
    } finally {
        setIsLoadingAi(false);
    }
  };

  const handleLocalUpdate = (id: string, updates: Partial<Ingredient>) => {
    setLocalIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, ...updates } : ing));
    setHasUnsavedChanges(true);
    setShowSaveSuccess(false);
  };

  const handleSaveChanges = () => {
    // Only send the ingredients that have actually changed to minimize I/O
    // For simplicity in this demo, we send the whole list and let App.tsx handle it,
    // but typically we'd filter for diffs.
    onSave(localIngredients);
    setHasUnsavedChanges(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleResetChanges = () => {
    setLocalIngredients(ingredients);
    setHasUnsavedChanges(false);
    setShowSaveSuccess(false);
    setSelectedIds(new Set());
  };

  const handleAddIngredient = () => {
    if(!newIngName || !newIngCost) {
        alert("Please enter a Name and Cost.");
        return;
    }
    
    const newIngredient: Ingredient = {
        id: `i-${Date.now()}`,
        name: newIngName,
        category: newIngCategory || 'General',
        unit: newIngUnit,
        unitCost: parseFloat(newIngCost),
        stockQuantity: parseFloat(newIngQty) || 0
    };

    // We can directly call the prop, no need to update localIngredients manually 
    // because the prop sync effect will handle it once the DB updates.
    onSave([...ingredients, newIngredient]); 
    
    setShowAddIngredientModal(false);
    setNewIngName('');
    setNewIngCategory('');
    setNewIngCost('');
    setNewIngQty('');
  };

  const handleAddMenuItem = () => {
      if(!newMenuName || !newMenuPrice) {
          alert("Please enter Item Name and Price.");
          return;
      }
      
      const newItem: MenuItem = {
          id: `m-${Date.now()}`,
          name: newMenuName,
          category: newMenuCategory || 'Specials',
          price: parseFloat(newMenuPrice),
          ingredients: [],
          description: 'Manually added item',
          tags: [],
          available: true
      };

      onAddMenuItem(newItem);
      setShowAddMenuModal(false);
      setNewMenuName('');
      setNewMenuPrice('');
      setNewMenuCategory('');
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Bulk Selection Logic (Stock)
  const toggleSelectAll = (visibleItems: Ingredient[]) => {
    if (selectedIds.size === visibleItems.length && visibleItems.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(visibleItems.map(i => i.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkApply = () => {
    if (selectedIds.size === 0) return;

    const updates: Partial<Ingredient> = {};
    if (bulkQty !== '') updates.stockQuantity = parseFloat(bulkQty);
    if (bulkCost !== '') updates.unitCost = parseFloat(bulkCost);

    if (Object.keys(updates).length === 0) return;

    setLocalIngredients(prev => prev.map(item => 
        selectedIds.has(item.id) ? { ...item, ...updates } : item
    ));
    
    setHasUnsavedChanges(true);
    setBulkQty('');
    setBulkCost('');
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      if (confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.size} inventory items? This cannot be undone.`)) {
          const remainingIngredients = localIngredients.filter(i => !selectedIds.has(i.id));
          setLocalIngredients(remainingIngredients);
          onSave(remainingIngredients);
          setSelectedIds(new Set());
          setHasUnsavedChanges(false);
      }
  };

  // --- MENU ITEM BULK & EDIT HANDLERS ---
  
  const toggleSelectMenu = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(selectedMenuIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedMenuIds(newSet);
  };

  const toggleSelectAllMenu = () => {
      if (selectedMenuIds.size === menuItems.length && menuItems.length > 0) {
          setSelectedMenuIds(new Set());
      } else {
          setSelectedMenuIds(new Set(menuItems.map(m => m.id)));
      }
  };

  const handleMenuBulkDelete = () => {
      if (confirm(`Are you sure you want to delete ${selectedMenuIds.size} menu items?`)) {
          onBulkDeleteMenuItems(Array.from(selectedMenuIds));
          setSelectedMenuIds(new Set());
          setSelectedItem(null);
      }
  };

  const handleMenuBulkCategoryUpdate = () => {
      if (!bulkMenuCategory) return;
      onBulkUpdateMenuItems(Array.from(selectedMenuIds), { category: bulkMenuCategory });
      setSelectedMenuIds(new Set());
      setBulkMenuCategory('');
  };

  const handleMenuBulkStockUpdate = (available: boolean) => {
      onBulkUpdateMenuItems(Array.from(selectedMenuIds), { available });
      setSelectedMenuIds(new Set());
  };

  const handleMenuDeleteSingle = (id: string) => {
      if (confirm('Are you sure you want to delete this item?')) {
          onDeleteMenuItem(id);
          if (selectedItem?.id === id) setSelectedItem(null);
      }
  };

  const handleMenuToggleAvailability = (item: MenuItem, e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateMenuItem({ ...item, available: !item.available });
  };

  const handleMenuEditStart = (item: MenuItem) => {
      setEditMenuData({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description || ''
      });
      setShowEditMenuModal(true);
  };

  const handleMenuEditSave = () => {
      if (!editMenuData.id || !editMenuData.name || editMenuData.price === undefined) return;
      
      const updatedItem: MenuItem = {
          ...(menuItems.find(m => m.id === editMenuData.id) as MenuItem),
          name: editMenuData.name,
          category: editMenuData.category || 'General',
          price: editMenuData.price,
          description: editMenuData.description
      };

      onUpdateMenuItem(updatedItem);
      setShowEditMenuModal(false);
      if (selectedItem?.id === updatedItem.id) {
          setSelectedItem(updatedItem);
      }
  };

  // Menu CSV Export & Import Logic (Same as before)
  const handleMenuExportCSV = () => {
      const headers = "category_id,subcategory_id,name,price_quarter,price_half,price_full,is_veg_or_nonveg,description\n";
      const csvContent = menuItems.map(item => {
          const catId = item.categoryId || '';
          const subCatId = item.subCategoryId || '';
          const safeName = item.name.replace(/"/g, '""');
          const priceFull = item.portionPrices?.full || item.price || 0;
          const priceHalf = item.portionPrices?.half || '';
          const priceQuarter = item.portionPrices?.quarter || '';
          const isVeg = item.isVeg ? 'veg' : 'nonveg';
          const safeDesc = (item.description || '').replace(/"/g, '""');
          return `${catId},${subCatId},"${safeName}",${priceQuarter},${priceHalf},${priceFull},${isVeg},"${safeDesc}"`;
      }).join("\n");

      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + headers + csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "bihari_chatkara_menu_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleMenuFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result as string;
          if (!text) return;

          try {
              const lines = text.split('\n');
              const headerLine = lines[0].toLowerCase();
              const headers = headerLine.split(',').map(h => h.trim());

              if (!headerLine.includes('name') || (!headerLine.includes('price_full') && !headerLine.includes('price'))) {
                  alert('Invalid CSV format. Header must contain: name, price_full, etc.');
                  return;
              }

              const newItems: MenuItem[] = [];

              for (let i = 1; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;
                  const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
                  
                  const getVal = (headerName: string) => {
                      const idx = headers.indexOf(headerName);
                      return idx > -1 ? values[idx] : '';
                  };

                  const name = getVal('name');
                  const catId = getVal('category_id');
                  const subCatId = getVal('subcategory_id');
                  const priceFullRaw = getVal('price_full') || getVal('price');
                  const priceHalfRaw = getVal('price_half');
                  const priceQuarterRaw = getVal('price_quarter');
                  const vegStatus = getVal('is_veg_or_nonveg');
                  const description = getVal('description');
                  const categoryName = getVal('category') || 'Imported';

                  const priceFull = parseFloat(priceFullRaw) || 0;
                  const priceHalf = priceHalfRaw ? parseFloat(priceHalfRaw) : undefined;
                  const priceQuarter = priceQuarterRaw ? parseFloat(priceQuarterRaw) : undefined;
                  
                  let isVeg = false;
                  const vs = vegStatus.toLowerCase();
                  if (vs.includes('veg') && !vs.includes('non')) {
                      isVeg = true;
                  } else if (vs === '1' || vs === 'true' || vs === 'yes') {
                      isVeg = true;
                  }

                  if (name && !isNaN(priceFull)) {
                      newItems.push({
                          id: `m-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
                          categoryId: catId,
                          subCategoryId: subCatId,
                          name,
                          category: categoryName,
                          price: priceFull,
                          portionPrices: { full: priceFull, half: priceHalf, quarter: priceQuarter },
                          isVeg: isVeg,
                          ingredients: [], 
                          description,
                          available: true,
                          tags: []
                      });
                  }
              }

              if (newItems.length > 0) {
                  onBulkAddMenuItems(newItems);
                  alert(`Successfully imported ${newItems.length} items.`);
              } else {
                  alert('No valid items found in CSV.');
              }
          } catch (err) {
              console.error(err);
              alert('Failed to parse CSV file.');
          }
          if (menuFileInputRef.current) menuFileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };


  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,ID,Name,Category,Unit,UnitCost,StockQuantity\n";
    localIngredients.forEach(ing => {
      const safeName = ing.name.replace(/"/g, '""');
      const safeCat = (ing.category || '').replace(/"/g, '""');
      const row = `${ing.id},"${safeName}","${safeCat}",${ing.unit},${ing.unitCost},${ing.stockQuantity}`;
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bihari_chatkara_inventory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n');
        const headerLine = lines[0].toLowerCase();
        if (!headerLine.includes('name') || !headerLine.includes('stockquantity')) {
            alert('Invalid CSV format. Please use the Export function to get a template.');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const newIngredients = [...localIngredients];
        let addedCount = 0;
        let updatedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
            const id = headers.indexOf('id') > -1 ? values[headers.indexOf('id')] : null;
            const name = headers.indexOf('name') > -1 ? values[headers.indexOf('name')] : '';
            const category = headers.indexOf('category') > -1 ? values[headers.indexOf('category')] : undefined;
            const unit = headers.indexOf('unit') > -1 ? values[headers.indexOf('unit')] : 'unit';
            const cost = headers.indexOf('unitcost') > -1 ? parseFloat(values[headers.indexOf('unitcost')]) : 0;
            const qty = headers.indexOf('stockquantity') > -1 ? parseFloat(values[headers.indexOf('stockquantity')]) : 0;

            if (!name) continue;

            const existingIndex = newIngredients.findIndex(ing => 
                (id && ing.id === id) || ing.name.toLowerCase() === name.toLowerCase()
            );

            if (existingIndex > -1) {
                newIngredients[existingIndex] = {
                    ...newIngredients[existingIndex],
                    stockQuantity: !isNaN(qty) ? qty : newIngredients[existingIndex].stockQuantity,
                    unitCost: !isNaN(cost) && cost > 0 ? cost : newIngredients[existingIndex].unitCost,
                    category: category || newIngredients[existingIndex].category
                };
                updatedCount++;
            } else {
                newIngredients.push({
                    id: id || `i-${Date.now()}-${Math.floor(Math.random()*10000)}`,
                    name: name,
                    category: category,
                    unit: unit,
                    unitCost: isNaN(cost) ? 0 : cost,
                    stockQuantity: isNaN(qty) ? 0 : qty
                });
                addedCount++;
            }
        }

        setLocalIngredients(newIngredients);
        setHasUnsavedChanges(true);
        alert(`Import Successful! Updated: ${updatedCount}, Added: ${addedCount}. Please click Save.`);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        console.error(err);
        alert('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const totalInventoryValue = localIngredients.reduce((acc, ing) => acc + (ing.unitCost * ing.stockQuantity), 0);
  const lowStockCount = localIngredients.filter(i => i.stockQuantity < 50).length;

  const processedIngredients = useMemo(() => {
    let data = [...localIngredients];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const tokens = lowerTerm.split(/\s+/).filter(Boolean);
      data = data.filter(i => {
          const lowerName = i.name.toLowerCase();
          const lowerId = i.id.toLowerCase();
          const lowerCat = (i.category || '').toLowerCase();
          return tokens.every(token => lowerName.includes(token) || lowerId.includes(token) || lowerCat.includes(token));
      });
    }

    if (filterStatus === 'low') data = data.filter(i => i.stockQuantity < 50);
    else if (filterStatus === 'in_stock') data = data.filter(i => i.stockQuantity >= 50);

    if (filterCategory !== 'all') data = data.filter(i => i.category === filterCategory);
    if (filterUnit !== 'all') data = data.filter(i => i.unit === filterUnit);

    return data.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Ingredient];
      let bValue: any = b[sortConfig.key as keyof Ingredient];
      if (sortConfig.key === 'totalValue') {
        aValue = a.unitCost * a.stockQuantity;
        bValue = b.unitCost * b.stockQuantity;
      }
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      if (!aValue) aValue = '';
      if (!bValue) bValue = '';
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [localIngredients, searchTerm, filterStatus, filterCategory, filterUnit, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600 ml-1" /> 
      : <ArrowDown size={14} className="text-blue-600 ml-1" />;
  };

  const SortableHeader = ({ label, columnKey, align = 'left' }: { label: string, columnKey: SortKey, align?: string }) => (
    <th 
      className={`px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors select-none text-${align}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  return (
    <div className="h-full flex flex-col space-y-4 relative">
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept=".csv" ref={menuFileInputRef} onChange={handleMenuFileUpload} className="hidden" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-2 md:p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div className="flex space-x-2 overflow-x-auto w-full md:w-auto">
          <button 
            onClick={() => setActiveView('menu')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'menu' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Menu Analysis & Costing
          </button>
          <button 
            onClick={() => setActiveView('stock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'stock' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Bulk Inventory System
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 px-2 md:px-4 w-full md:w-auto">
             <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-full md:w-auto">
                <Package size={16} className="text-blue-500" />
                <span>Total Value: <span className="font-bold text-slate-900">₹{totalInventoryValue.toLocaleString('en-IN')}</span></span>
             </div>
             {lowStockCount > 0 && (
               <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 animate-pulse w-full md:w-auto">
                  <AlertTriangle size={16} />
                  <span className="font-bold">{lowStockCount} Items Low Stock</span>
               </div>
             )}
        </div>
      </div>

      {activeView === 'menu' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            {selectedMenuIds.size > 0 && (
                 <div className="absolute top-0 left-0 right-0 z-20 bg-slate-800 text-white p-3 flex flex-wrap gap-2 justify-between items-center animate-in slide-in-from-top-1 shadow-md">
                     <div className="flex flex-wrap items-center gap-4">
                        <span className="font-bold flex items-center gap-2">
                            <CheckSquare size={18} className="text-blue-400" /> {selectedMenuIds.size} Selected
                        </span>
                        
                        <div className="hidden md:block h-6 w-px bg-slate-600"></div>
                        
                        <div className="flex gap-2">
                          <button
                              onClick={() => handleMenuBulkStockUpdate(false)}
                              className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded font-bold flex items-center gap-1"
                          >
                              <Ban size={14} /> Out of Stock
                          </button>
                          
                          <button
                              onClick={() => handleMenuBulkStockUpdate(true)}
                              className="text-xs bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded font-bold flex items-center gap-1"
                          >
                              <CheckCircle2 size={14} /> Available
                          </button>
                        </div>

                        <div className="hidden md:block h-6 w-px bg-slate-600"></div>
                        
                        <div className="flex gap-1">
                          <input 
                              type="text" 
                              placeholder="Set New Category"
                              value={bulkMenuCategory}
                              onChange={(e) => setBulkMenuCategory(e.target.value)}
                              className="bg-slate-700 border-none text-sm rounded px-2 py-1 text-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 w-32"
                          />
                          <button 
                              onClick={handleMenuBulkCategoryUpdate}
                              disabled={!bulkMenuCategory}
                              className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded font-bold"
                          >
                              Update
                          </button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setSelectedMenuIds(new Set())}
                            className="text-slate-400 hover:text-white p-1"
                         >
                             <X size={18} />
                         </button>
                         <button 
                            onClick={handleMenuBulkDelete}
                            className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-bold bg-white/10 px-3 py-1.5 rounded hover:bg-white/20"
                         >
                             <Trash2 size={14} />
                         </button>
                     </div>
                 </div>
            )}

            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleSelectAllMenu} 
                        className="text-slate-500 hover:text-slate-800"
                    >
                        {selectedMenuIds.size === menuItems.length && menuItems.length > 0 ? (
                            <CheckSquare size={20} className="text-blue-600" />
                        ) : (
                            <Square size={20} />
                        )}
                    </button>
                    <h2 className="font-bold text-lg text-slate-800">Menu Items</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleMenuExportCSV} className="text-slate-500 hover:text-blue-600 p-1.5 hover:bg-slate-200 rounded transition-colors"><Download size={18} /></button>
                    <button onClick={() => menuFileInputRef.current?.click()} className="text-slate-500 hover:text-blue-600 p-1.5 hover:bg-slate-200 rounded transition-colors"><FileUp size={18} /></button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <span className="text-xs font-medium text-slate-500 px-2 py-1 bg-slate-200 rounded hidden md:inline">Total: {menuItems.length}</span>
                    <button onClick={() => setShowAddMenuModal(true)} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 transition-colors shadow"><Plus size={16} /></button>
                </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
                {menuItems.map(item => {
                    const cost = calculatePlateCost(item);
                    const margin = item.price > 0 ? ((item.price - cost) / item.price) * 100 : 0;
                    const isSelected = selectedMenuIds.has(item.id);
                    const isOutOfStock = item.available === false;

                    return (
                        <div 
                            key={item.id}
                            onClick={() => { setSelectedItem(item); setAiInsights(null); }}
                            className={`p-4 mb-2 rounded-lg cursor-pointer border transition-all relative group ${
                                selectedItem?.id === item.id 
                                ? 'bg-blue-50 border-blue-500 shadow-md' 
                                : 'bg-white border-slate-100 hover:border-blue-300'
                            } ${isOutOfStock ? 'opacity-70' : ''}`}
                        >
                            <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
                                <button onClick={(e) => toggleSelectMenu(item.id, e)} className="text-slate-400 hover:text-blue-600">
                                    {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                                </button>
                            </div>
                            <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => handleMenuToggleAvailability(item, e)}
                                    className={`p-1.5 rounded-md transition-colors ${isOutOfStock ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                                >
                                    {isOutOfStock ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                                </button>
                            </div>

                            <div className="pl-8 flex justify-between items-start mb-2 pr-8">
                                <div>
                                    <h3 className={`font-bold text-slate-800 flex items-center gap-2 ${isOutOfStock ? 'line-through decoration-slate-400' : ''}`}>
                                        {item.name}
                                        {item.isVeg !== undefined && (
                                            <span className={`w-3 h-3 rounded-full border ${item.isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'}`}></span>
                                        )}
                                        {isOutOfStock && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full no-underline">Sold Out</span>}
                                    </h3>
                                    <p className="text-xs text-slate-500">{item.category}</p>
                                </div>
                                <span className="font-mono font-bold text-slate-900">₹{item.price.toFixed(2)}</span>
                            </div>
                            <div className="pl-8 grid grid-cols-3 gap-2 mt-3 text-sm">
                                <div className="bg-white p-2 rounded border border-slate-200">
                                    <p className="text-xs text-slate-400 uppercase">Plate Cost</p>
                                    <p className="font-bold text-slate-700">₹{cost.toFixed(2)}</p>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                    <p className="text-xs text-slate-400 uppercase">Profit</p>
                                    <p className="font-bold text-green-600">₹{(item.price - cost).toFixed(2)}</p>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                    <p className="text-xs text-slate-400 uppercase">Margin</p>
                                    <p className={`font-bold ${margin < 65 ? 'text-red-500' : 'text-slate-700'}`}>{margin.toFixed(0)}%</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto relative">
            {selectedItem ? (
                <>
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><ChefHat size={24} /></div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{selectedItem.name}</h2>
                                <p className="text-slate-500">Ingredient Breakdown</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleMenuEditStart(selectedItem)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"><Pencil size={20} /></button>
                            <button onClick={() => handleMenuDeleteSingle(selectedItem.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"><Trash2 size={20} /></button>
                        </div>
                    </div>
                    <div className="mb-6">
                        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Calculator size={16} /> Cost Breakdown</h3>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                            {selectedItem.ingredients.length > 0 ? (
                                selectedItem.ingredients.map((ref, idx) => {
                                    const ing = ingredients.find(i => i.id === ref.ingredientId);
                                    if (!ing) return null;
                                    const lineCost = ing.unitCost * ref.quantity;
                                    return (
                                        <div key={idx} className="flex justify-between text-sm border-b border-slate-200 last:border-0 pb-2 last:pb-0">
                                            <span>{ref.quantity} {ing.unit} {ing.name} (@ ₹{ing.unitCost}/{ing.unit})</span>
                                            <span className="font-mono text-slate-600">₹{lineCost.toFixed(2)}</span>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-sm text-slate-400 italic">No specific ingredients linked to this item yet.</p>
                            )}
                            <div className="flex justify-between font-bold pt-2 text-slate-800">
                                <span>Total Plate Cost</span>
                                <span>₹{calculatePlateCost(selectedItem).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Sparkles size={16} className="text-purple-500" /> AI Menu Optimizer</h3>
                            <button onClick={() => handleAiAnalysis(selectedItem)} disabled={isLoadingAi} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                                {isLoadingAi ? 'Analyzing...' : 'Generate Insights'}
                            </button>
                        </div>
                        {!aiInsights && !isLoadingAi && <p className="text-sm text-slate-400 italic">Click "Generate Insights" to ask Gemini for analysis.</p>}
                        {isLoadingAi && <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-4 bg-slate-200 rounded w-full"></div></div>}
                        {aiInsights && (
                            <div className="space-y-4">
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                    <p className="text-xs text-purple-600 font-bold uppercase mb-1">Creative Description</p>
                                    <p className="text-slate-800 italic">"{aiInsights.description}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                        <p className="text-xs text-green-700 font-bold uppercase mb-1 flex items-center gap-1"><Tag size={12}/> Dietary Tags</p>
                                        <div className="flex flex-wrap gap-1">
                                            {aiInsights.dietaryTags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-white border border-green-200 px-2 py-0.5 rounded-full text-green-800">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                        <p className="text-xs text-amber-700 font-bold uppercase mb-1 flex items-center gap-1"><DollarSign size={12}/> Price Suggestion</p>
                                        <p className="text-sm font-semibold text-slate-800">{aiInsights.suggestedPriceRange}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                    <p>Select a menu item to view details</p>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          {selectedIds.size > 0 ? (
             <div className="p-4 border-b border-blue-500 flex justify-between items-center bg-slate-800 text-white flex-wrap gap-4 animate-in slide-in-from-top-2 shadow-md z-20">
                 <div className="flex items-center gap-6">
                     <span className="font-bold flex items-center gap-2 text-lg">
                        <div className="bg-blue-500 p-1 rounded text-white"><CheckSquare size={20} /></div>
                        {selectedIds.size} Selected
                     </span>
                     <div className="flex items-center gap-3 p-1 bg-slate-700/50 rounded-lg px-3">
                        <label className="text-xs text-slate-300 uppercase font-bold tracking-wider">New Stock Qty:</label>
                        <input type="number" placeholder="-" value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} className="w-24 px-3 py-1.5 text-slate-900 rounded-md border-0 text-sm focus:ring-2 focus:ring-blue-500 font-mono" />
                     </div>
                     <div className="flex items-center gap-3 p-1 bg-slate-700/50 rounded-lg px-3">
                        <label className="text-xs text-slate-300 uppercase font-bold tracking-wider">New Unit Cost:</label>
                        <div className="relative">
                            <span className="absolute left-2 top-1.5 text-slate-500 text-xs">₹</span>
                            <input type="number" placeholder="-" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} className="w-24 pl-5 pr-2 py-1.5 text-slate-900 rounded-md border-0 text-sm focus:ring-2 focus:ring-blue-500 font-mono" />
                        </div>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                     <button onClick={() => setSelectedIds(new Set())} className="text-slate-300 hover:text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors hover:bg-slate-700"><X size={18} /> Cancel</button>
                     <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"><Trash2 size={18} /> Delete</button>
                     <button onClick={handleBulkApply} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/50 active:scale-95"><Edit3 size={18} /> Apply Changes</button>
                 </div>
             </div>
          ) : (
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-wrap gap-3">
             <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
                 <div className="relative w-full md:w-auto">
                    <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="Search ingredients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full md:w-48 shadow-sm" />
                 </div>
                 <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 shadow-sm overflow-x-auto max-w-full">
                    <Filter size={16} className="text-slate-400" />
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)} className="py-2 pl-1 pr-3 border-none bg-transparent focus:ring-0 text-sm text-slate-700 cursor-pointer outline-none">
                        <option value="all">Status: All</option>
                        <option value="low">Status: Low Stock</option>
                        <option value="in_stock">Status: In Stock</option>
                    </select>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="py-2 pl-1 pr-3 border-none bg-transparent focus:ring-0 text-sm text-slate-700 cursor-pointer outline-none">
                        <option value="all">Category: All</option>
                        {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="py-2 pl-1 pr-3 border-none bg-transparent focus:ring-0 text-sm text-slate-700 cursor-pointer outline-none">
                        <option value="all">Unit: All</option>
                        {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                 </div>
                 <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>
                 <button onClick={handleExportCSV} className="flex items-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"><Download size={16} /> <span className="hidden lg:inline">Export</span></button>
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"><FileUp size={16} /> <span className="hidden lg:inline">Import</span></button>
             </div>
             
             <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                 {hasUnsavedChanges && <span className="text-sm text-amber-600 font-medium animate-pulse flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Unsaved</span>}
                 {showSaveSuccess && <span className="text-sm text-green-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2"><Check size={16} /> Saved!</span>}
                 <button onClick={handleResetChanges} disabled={!hasUnsavedChanges} className="text-slate-500 hover:text-slate-800 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><RotateCcw size={18} /></button>
                 <button onClick={handleSaveChanges} disabled={!hasUnsavedChanges} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"><Save size={18} /> Save</button>
                 <button onClick={() => setShowAddIngredientModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-all active:scale-95"><Plus size={18} /> Add</button>
             </div>
          </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 w-10">
                      <button onClick={() => toggleSelectAll(processedIngredients)} className="text-slate-500 hover:text-slate-800 transition-colors">
                         {selectedIds.size > 0 && selectedIds.size === processedIngredients.length ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                      </button>
                  </th>
                  <SortableHeader label="Ingredient Name" columnKey="name" />
                  <SortableHeader label="Category" columnKey="category" />
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                  <SortableHeader label="Cost / Unit (₹)" columnKey="unitCost" />
                  <SortableHeader label="Stock Qty" columnKey="stockQuantity" />
                  <SortableHeader label="Total Value" columnKey="totalValue" />
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedIngredients.map(ing => (
                  <tr key={ing.id} className={`transition-colors ${selectedIds.has(ing.id) ? 'bg-blue-50/80' : ing.stockQuantity < 50 ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-slate-50'} ${selectedIds.has(ing.id) ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                    <td className="px-4 py-4">
                        <button onClick={() => toggleSelectRow(ing.id)} className="text-slate-400 hover:text-slate-700 block transition-colors">
                            {selectedIds.has(ing.id) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{ing.name} {ing.stockQuantity < 50 && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{ing.category ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">{ing.category}</span> : <span className="text-slate-300">-</span>}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{ing.unit}</td>
                    <td className="px-6 py-4">
                      <div className="relative rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2"><span className="text-slate-500 sm:text-sm">₹</span></div>
                        <input type="number" className="block w-24 rounded-md border-0 py-1.5 pl-5 pr-2 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-white disabled:bg-slate-100 disabled:text-slate-500" value={ing.unitCost} disabled={selectedIds.has(ing.id)} onChange={(e) => handleLocalUpdate(ing.id, { unitCost: parseFloat(e.target.value) || 0 })} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" className={`block w-24 rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-white disabled:bg-slate-100 disabled:text-slate-500 ${ing.stockQuantity < 50 ? 'ring-red-300 text-red-600 font-bold bg-red-50' : 'ring-slate-300'}`} value={ing.stockQuantity} disabled={selectedIds.has(ing.id)} onChange={(e) => handleLocalUpdate(ing.id, { stockQuantity: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono">₹{(ing.unitCost * ing.stockQuantity).toFixed(2)}</td>
                    <td className="px-6 py-4">
                       {ing.stockQuantity < 50 ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200"><AlertTriangle size={12} /> Low Stock</span> : <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">In Stock</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {processedIngredients.length === 0 && (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                    <Search size={48} className="opacity-20 mb-4" />
                    <p className="text-lg font-medium">No ingredients found</p>
                    <p className="text-sm">Try adjusting your search term for "{searchTerm}" or changing the filters.</p>
                </div>
            )}
          </div>
        </div>
      )}

      {showAddIngredientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md m-4">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">Add New Ingredient</h3>
                      <button onClick={() => setShowAddIngredientModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input type="text" value={newIngName} onChange={e => setNewIngName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Olive Oil" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><input type="text" value={newIngCategory} onChange={e => setNewIngCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Pantry" /></div>
                          <div><label className="block text-sm font-medium text-slate-700 mb-1">Unit</label><input type="text" value={newIngUnit} onChange={e => setNewIngUnit(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="liter" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-sm font-medium text-slate-700 mb-1">Cost / Unit (₹)</label><input type="number" value={newIngCost} onChange={e => setNewIngCost(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" /></div>
                          <div><label className="block text-sm font-medium text-slate-700 mb-1">Initial Qty</label><input type="number" value={newIngQty} onChange={e => setNewIngQty(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0" /></div>
                      </div>
                      <div className="pt-2"><button onClick={handleAddIngredient} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Add Ingredient</button></div>
                  </div>
              </div>
          </div>
      )}

      {showAddMenuModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md m-4">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">Add Menu Item</h3>
                      <button onClick={() => setShowAddMenuModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label><input type="text" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Special Pasta" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><input type="text" value={newMenuCategory} onChange={e => setNewMenuCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Mains" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Price (₹)</label><input type="number" value={newMenuPrice} onChange={e => setNewMenuPrice(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" /></div>
                      <div className="pt-2"><button onClick={handleAddMenuItem} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Add Item to Menu</button></div>
                  </div>
              </div>
          </div>
      )}

      {showEditMenuModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg m-4">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Edit3 size={24} className="text-blue-600" /> Edit Menu Item</h3>
                      <button onClick={() => setShowEditMenuModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  <div className="space-y-4">
                      <div><label className="block text-sm font-bold text-slate-700 mb-1">Item Name</label><input type="text" value={editMenuData.name || ''} onChange={e => setEditMenuData({...editMenuData, name: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Category</label><input type="text" value={editMenuData.category || ''} onChange={e => setEditMenuData({...editMenuData, category: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                          <div><label className="block text-sm font-bold text-slate-700 mb-1">Price (₹)</label><input type="number" value={editMenuData.price || ''} onChange={e => setEditMenuData({...editMenuData, price: parseFloat(e.target.value)})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono" /></div>
                      </div>
                      <div><label className="block text-sm font-bold text-slate-700 mb-1">Description</label><textarea value={editMenuData.description || ''} onChange={e => setEditMenuData({...editMenuData, description: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-24" placeholder="Enter description..." /></div>
                      <div className="pt-4 flex gap-3">
                          <button onClick={() => setShowEditMenuModal(false)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold">Cancel</button>
                          <button onClick={handleMenuEditSave} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">Save Changes</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;
