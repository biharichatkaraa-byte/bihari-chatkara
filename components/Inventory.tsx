import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MenuItem, Ingredient, MenuItemIngredient } from '../types';
import { Plus, Trash2, Edit3, Save, X, FileSpreadsheet, Package, AlertTriangle, Search, ChevronRight, Check, Ban, ShoppingBag, DollarSign, Download, Trash, CheckSquare, Square, ChevronLeft } from 'lucide-react';

interface InventoryProps {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  onSave: (ingredients: Ingredient[]) => void;
  onDeleteIngredient: (id: string) => void;
  onAddIngredient: (ingredient: Ingredient) => void;
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onBulkUpdateMenuItems: (ids: string[], updates: Partial<MenuItem>) => void;
  onBulkDeleteMenuItems: (ids: string[]) => void;
  onBulkAddMenuItems: (items: MenuItem[]) => void;
}

const Inventory: React.FC<InventoryProps> = ({ 
    ingredients, 
    menuItems, 
    onSave, 
    onDeleteIngredient,
    onAddIngredient,
    onAddMenuItem,
    onUpdateMenuItem,
    onDeleteMenuItem,
    onBulkUpdateMenuItems,
    onBulkDeleteMenuItems,
    onBulkAddMenuItems
}) => {
  const [activeView, setActiveView] = useState<'menu' | 'stock'>('menu');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [showAddIngModal, setShowAddIngModal] = useState(false);

  const [menuName, setMenuName] = useState('');
  const [menuFullPrice, setMenuFullPrice] = useState('');
  const [menuHalfPrice, setMenuHalfPrice] = useState('');
  const [menuQuarterPrice, setMenuQuarterPrice] = useState('');
  const [menuCategory, setMenuCategory] = useState('Main Course');
  const [menuDescription, setMenuDescription] = useState('');
  
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('kg');
  const [ingCost, setIngCost] = useState('');
  const [ingStock, setIngStock] = useState('');

  const [recipeIngId, setRecipeIngId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuFileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += char;
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'ing' | 'menu') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      
      if (type === 'ing') {
        const newItems: Ingredient[] = rows.slice(1).filter(r => r[0]).map(parts => ({
          id: `i-bulk-${Math.random().toString(36).substr(2, 9)}`,
          name: parts[0],
          category: parts[1] || 'General',
          unit: parts[2] || 'kg',
          unitCost: Number(parts[3]) || 0,
          stockQuantity: Number(parts[4]) || 0
        }));
        onSave([...ingredients, ...newItems]);
      } else {
        const newItems: MenuItem[] = rows.slice(1).filter(r => r[0]).map(parts => ({
          id: `m-bulk-${Math.random().toString(36).substr(2, 9)}`,
          name: parts[0],
          category: parts[1] || 'Main',
          price: Number(parts[2]) || 0,
          portionPrices: {
              full: Number(parts[2]) || 0,
              half: parts[3] ? Number(parts[3]) : undefined,
              quarter: parts[4] ? Number(parts[4]) : undefined
          },
          description: parts[5] || '',
          ingredients: [],
          available: true
        }));
        onBulkAddMenuItems(newItems);
      }
      alert(`Imported successfully.`);
    };
    reader.readAsText(file);
  };

  const downloadMenuCSV = () => {
    const headers = "Name,Category,Full Price,Half Price,Quarter Price,Description\n";
    const csvContent = menuItems.map(m => {
        const full = m.price || m.portionPrices?.full || 0;
        const half = m.portionPrices?.half || '';
        const quarter = m.portionPrices?.quarter || '';
        const desc = (m.description || '').replace(/,/g, ';');
        return `"${m.name}","${m.category}",${full},${half},${quarter},"${desc}"`;
    }).join("\n");

    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu_catalog_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedMenuIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMenuIds(next);
  };

  const handleBulkDelete = () => {
    if (selectedMenuIds.size === 0) return;
    if (confirm(`Delete ${selectedMenuIds.size} selected menu items?`)) {
      onBulkDeleteMenuItems(Array.from(selectedMenuIds));
      setSelectedMenuIds(new Set());
      setSelectedItem(null);
    }
  };

  const handleSingleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this menu item?")) {
      onDeleteMenuItem(id);
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const calculatePlateCost = (item: MenuItem): number => {
    return (item.ingredients || []).reduce((total, ref) => {
      const ing = ingredients.find(i => i.id === ref.ingredientId);
      return total + (Number(ing?.unitCost || 0) * Number(ref.quantity || 0));
    }, 0);
  };

  const addIngredientToRecipe = () => {
    if (!selectedItem || !recipeIngId || !recipeQty) return;
    const qty = parseFloat(recipeQty);
    if (isNaN(qty)) return;

    const updatedIngredients = [...(selectedItem.ingredients || [])];
    const existingIdx = updatedIngredients.findIndex(i => i.ingredientId === recipeIngId);
    
    if (existingIdx > -1) {
      updatedIngredients[existingIdx].quantity += qty;
    } else {
      updatedIngredients.push({ ingredientId: recipeIngId, quantity: qty });
    }

    const updatedItem = { ...selectedItem, ingredients: updatedIngredients };
    onUpdateMenuItem(updatedItem);
    setSelectedItem(updatedItem);
    setRecipeQty('');
  };

  const removeIngredientFromRecipe = (ingId: string) => {
    if (!selectedItem) return;
    const updatedIngredients = selectedItem.ingredients.filter(i => i.ingredientId !== ingId);
    const updatedItem = { ...selectedItem, ingredients: updatedIngredients };
    onUpdateMenuItem(updatedItem);
    setSelectedItem(updatedItem);
  };

  const toggleItemAvailability = (item: MenuItem) => {
    onUpdateMenuItem({ ...item, available: !item.available });
    if (selectedItem?.id === item.id) setSelectedItem({ ...item, available: !item.available });
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const newIng: Ingredient = {
      id: `i-20250125-${Date.now()}`,
      name: ingName,
      unit: ingUnit,
      unitCost: parseFloat(ingCost) || 0,
      stockQuantity: parseFloat(ingStock) || 0,
      category: 'General'
    };
    onAddIngredient(newIng);
    setShowAddIngModal(false);
    setIngName(''); setIngCost(''); setIngStock('');
  };

  const handleAddMenu = (e: React.FormEvent) => {
    e.preventDefault();
    const full = parseFloat(menuFullPrice) || 0;
    const half = parseFloat(menuHalfPrice);
    const quarter = parseFloat(menuQuarterPrice);

    const newItem: MenuItem = {
      id: `m-${Date.now()}`,
      name: menuName,
      category: menuCategory,
      price: full,
      portionPrices: {
          full: full,
          half: isNaN(half) ? undefined : half,
          quarter: isNaN(quarter) ? undefined : quarter
      },
      description: menuDescription,
      available: true,
      ingredients: []
    };
    onAddMenuItem(newItem);
    setShowAddMenuModal(false);
    setMenuName(''); setMenuFullPrice(''); setMenuHalfPrice(''); setMenuQuarterPrice(''); setMenuDescription('');
  };

  const filteredIngredients = ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMenuItems = menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* View Switcher & Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveView('menu')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${activeView === 'menu' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Menu Analytics</button>
          <button onClick={() => setActiveView('stock')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all ${activeView === 'stock' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Inventory Stock</button>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="text" placeholder="Search catalog..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          
          <div className="flex gap-2 justify-center md:border-l md:pl-2">
            <button onClick={() => (activeView === 'menu' ? menuFileInputRef : fileInputRef).current?.click()} className="flex-1 md:flex-none p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex justify-center items-center" title="Upload CSV">
                <FileSpreadsheet size={18} />
            </button>
            {activeView === 'menu' && (
                <>
                    <button onClick={downloadMenuCSV} className="flex-1 md:flex-none p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex justify-center items-center" title="Download Menu CSV">
                        <Download size={18} />
                    </button>
                    {selectedMenuIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex-1 md:flex-none p-2 border border-red-100 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex justify-center items-center" title="Delete Selected">
                            <Trash size={18} />
                        </button>
                    )}
                </>
            )}
            <button onClick={() => activeView === 'menu' ? setShowAddMenuModal(true) : setShowAddIngModal(true)} className="flex-[2] md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                <Plus size={18} /> <span className="md:inline">Add</span>
            </button>
          </div>
        </div>
      </div>

      {activeView === 'menu' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden relative">
          {/* Left Panel: Menu List (Hidden on mobile if item is selected) */}
          <div className={`${selectedItem ? 'hidden lg:flex' : 'flex'} bg-white rounded-xl border border-slate-200 flex-col overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
                <span>Menu Catalog ({filteredMenuItems.length})</span>
                {selectedMenuIds.size > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{selectedMenuIds.size} Selected</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredMenuItems.map(item => {
                const cost = calculatePlateCost(item);
                const margin = item.price > 0 ? ((item.price - cost) / item.price) * 100 : 0;
                const isSelected = selectedMenuIds.has(item.id);
                return (
                  <div key={item.id} onClick={() => setSelectedItem(item)} className={`p-4 rounded-lg border cursor-pointer transition-all relative ${selectedItem?.id === item.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div onClick={(e) => handleToggleSelect(item.id, e)} className="mt-1 text-slate-400 hover:text-blue-600">
                            {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm md:text-base">{item.name}</h3>
                            {!item.available && <span className="text-[8px] md:text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">Sold Out</span>}
                          </div>
                          <p className="text-[10px] md:text-xs text-slate-500">{item.category}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-slate-900 text-sm md:text-base">₹{Number(item.price).toFixed(0)}</span>
                        <button onClick={(e) => handleSingleDelete(item.id, e)} className="mt-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 md:gap-2 mt-3 text-center ml-8">
                       <div className="bg-slate-50 p-1 md:p-1.5 rounded border border-slate-100">
                          <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold">Cost</p>
                          <p className="text-[10px] md:text-xs font-bold text-slate-700">₹{cost.toFixed(0)}</p>
                       </div>
                       <div className="bg-slate-50 p-1 md:p-1.5 rounded border border-slate-100">
                          <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold">Profit</p>
                          <p className="text-[10px] md:text-xs font-bold text-green-600">₹{(item.price - cost).toFixed(0)}</p>
                       </div>
                       <div className="bg-slate-50 p-1 md:p-1.5 rounded border border-slate-100">
                          <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold">Margin</p>
                          <p className={`text-[10px] md:text-xs font-bold ${margin < 65 ? 'text-orange-500' : 'text-blue-600'}`}>{margin.toFixed(0)}%</p>
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Panel: Recipe & Controls */}
          <div className={`${!selectedItem ? 'hidden lg:flex' : 'flex'} bg-white rounded-xl border border-slate-200 flex-col overflow-hidden`}>
            {selectedItem ? (
              <div className="flex flex-col h-full">
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedItem(null)} className="lg:hidden p-1 text-slate-400"><ChevronLeft size={24}/></button>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{selectedItem.name}</h2>
                        <p className="text-xs text-slate-500">Recipe & Costing Analysis</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleItemAvailability(selectedItem)}
                    className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-[10px] md:text-sm transition-colors ${selectedItem.available ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    {selectedItem.available ? <Ban size={14}/> : <Check size={14}/>}
                    {selectedItem.available ? 'Out' : 'In'}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                  {/* Portion Overview */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Portion Pricing</h4>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                        <div className="text-center">
                            <p className="text-[8px] md:text-[10px] text-slate-500 uppercase">Full</p>
                            <p className="font-black text-slate-800 text-sm md:text-base">₹{selectedItem.portionPrices?.full || selectedItem.price}</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <p className="text-[8px] md:text-[10px] text-slate-500 uppercase">Half</p>
                            <p className="font-black text-slate-800 text-sm md:text-base">{selectedItem.portionPrices?.half ? `₹${selectedItem.portionPrices.half}` : '-'}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[8px] md:text-[10px] text-slate-500 uppercase">Quarter</p>
                            <p className="font-black text-slate-800 text-sm md:text-base">{selectedItem.portionPrices?.quarter ? `₹${selectedItem.portionPrices.quarter}` : '-'}</p>
                        </div>
                    </div>
                  </div>

                  {/* Current Ingredients */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recipe Components</h4>
                    <div className="space-y-2">
                      {selectedItem.ingredients.length === 0 ? (
                        <div className="bg-slate-50 p-6 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                          No ingredients mapped yet.
                        </div>
                      ) : (
                        selectedItem.ingredients.map(ref => {
                          const ing = ingredients.find(i => i.id === ref.ingredientId);
                          return (
                            <div key={ref.ingredientId} className="flex justify-between items-center bg-white p-3 border border-slate-100 rounded-lg shadow-sm">
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="p-1.5 md:p-2 bg-slate-50 rounded text-slate-500"><Package size={14}/></div>
                                <div>
                                  <p className="font-bold text-slate-800 text-xs md:text-sm">{ing?.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-slate-500">{ref.quantity} {ing?.unit}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 md:gap-4">
                                <span className="font-mono text-xs text-slate-600 font-bold">₹{(Number(ing?.unitCost || 0) * ref.quantity).toFixed(2)}</span>
                                <button onClick={() => removeIngredientFromRecipe(ref.ingredientId)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Add to Recipe */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Map Component</h4>
                    <div className="flex flex-wrap gap-2">
                      <select value={recipeIngId} onChange={e => setRecipeIngId(e.target.value)} className="flex-1 min-w-[150px] bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Ingredient...</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" placeholder="Qty" value={recipeQty} onChange={e => setRecipeQty(e.target.value)} className="w-16 md:w-20 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs md:text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={addIngredientToRecipe} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center justify-center"><Plus size={20}/></button>
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 mt-auto">
                  <div className="flex justify-between items-center text-base md:text-lg">
                    <span className="font-bold text-slate-600 text-sm md:text-base">Production Cost</span>
                    <span className="font-black text-slate-900">₹{calculatePlateCost(selectedItem).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                <ShoppingBag size={64} className="mb-4 opacity-10" />
                <h3 className="text-lg md:text-xl font-bold text-slate-500">No Item Selected</h3>
                <p className="text-xs md:text-sm">Choose a dish to manage ingredients.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden flex-1 shadow-sm">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 md:px-6 py-4 font-bold text-slate-600 text-[10px] md:text-sm uppercase tracking-wider">Ingredient</th>
                  <th className="px-4 md:px-6 py-4 font-bold text-slate-600 text-[10px] md:text-sm uppercase tracking-wider">Unit</th>
                  <th className="px-4 md:px-6 py-4 font-bold text-slate-600 text-[10px] md:text-sm uppercase tracking-wider">Unit Cost</th>
                  <th className="px-4 md:px-6 py-4 font-bold text-slate-600 text-[10px] md:text-sm uppercase tracking-wider">Stock Level</th>
                  <th className="px-4 md:px-6 py-4 font-bold text-slate-600 text-[10px] md:text-sm uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIngredients.map(ing => (
                  <tr key={ing.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 md:p-2 bg-slate-100 rounded text-slate-500"><Package size={16}/></div>
                        <span className="font-bold text-slate-800 text-xs md:text-sm">{ing.name}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-slate-500">{ing.unit}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-mono font-bold text-xs md:text-sm text-slate-900">₹{Number(ing.unitCost).toFixed(2)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${ing.stockQuantity < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                        <span className="font-medium text-xs md:text-sm">{ing.stockQuantity} {ing.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                       <button onClick={() => onDeleteIngredient(ing.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                           <Trash2 size={16}/>
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={e => handleBulkUpload(e, 'ing')} accept=".csv" className="hidden" />
      <input type="file" ref={menuFileInputRef} onChange={e => handleBulkUpload(e, 'menu')} accept=".csv" className="hidden" />

      {/* ADD ITEM MODAL */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Add New Dish</h3>
                <button onClick={() => setShowAddMenuModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleAddMenu} className="space-y-4">
                 <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Dish Name</label>
                    <input autoFocus type="text" value={menuName} onChange={e => setMenuName(e.target.value)} required className="w-full px-4 py-2 border rounded-xl" placeholder="e.g. Chicken Litti" />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Category</label>
                      <select value={menuCategory} onChange={e => setMenuCategory(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white">
                        <option>Main Course</option>
                        <option>Appetizers</option>
                        <option>Beverages</option>
                        <option>Desserts</option>
                        <option>Specials</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Full Price (₹)</label>
                      <input type="number" step="0.01" value={menuFullPrice} onChange={e => setMenuFullPrice(e.target.value)} required className="w-full px-4 py-2 border rounded-xl" placeholder="0.00" />
                    </div>
                 </div>

                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Optional Portion Pricing</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Half Price</label>
                            <input type="number" step="0.01" value={menuHalfPrice} onChange={e => setMenuHalfPrice(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white" placeholder="N/A" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Quarter Price</label>
                            <input type="number" step="0.01" value={menuQuarterPrice} onChange={e => setMenuQuarterPrice(e.target.value)} className="w-full px-4 py-2 border rounded-xl bg-white" placeholder="N/A" />
                        </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Short Description</label>
                    <textarea value={menuDescription} onChange={e => setMenuDescription(e.target.value)} className="w-full px-4 py-2 border rounded-xl h-20 resize-none text-sm" placeholder="Ingredients summary..."></textarea>
                 </div>

                 <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm uppercase">Save Dish to Menu</button>
              </form>
           </div>
        </div>
      )}

      {/* ADD INGREDIENT MODAL */}
      {showAddIngModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Add Raw Material</h3>
                <button onClick={() => setShowAddIngModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleAddIngredient} className="space-y-4">
                 <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Ingredient Name</label>
                    <input autoFocus type="text" value={ingName} onChange={e => setIngName(e.target.value)} required className="w-full px-4 py-2 border rounded-xl font-bold" placeholder="e.g. Basmati Rice" />
                 </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Unit</label>
                      <input type="text" value={ingUnit} onChange={e => setIngUnit(e.target.value)} required className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="kg" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Cost</label>
                      <input type="number" step="0.01" value={ingCost} onChange={e => setIngCost(e.target.value)} required className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Stock</label>
                      <input type="number" step="0.1" value={ingStock} onChange={e => setIngStock(e.target.value)} required className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="0" />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 text-sm uppercase">Register Ingredient</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;