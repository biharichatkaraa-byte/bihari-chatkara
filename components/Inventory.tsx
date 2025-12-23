import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MenuItem, Ingredient } from '../types';
import { generateMenuInsights } from '../services/geminiService';
import { Calculator, Sparkles, ChefHat, Tag, DollarSign, Package, AlertTriangle, Search, Save, RotateCcw, Check, FileUp, Download, ArrowUpDown, ArrowUp, ArrowDown, Filter, Square, CheckSquare, Edit3, X, Plus, Trash2, Pencil, Power, Ban, CheckCircle2, Link, Unlink, ScanLine, Camera, Loader2, Image as ImageIcon } from 'lucide-react';

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

type SortKey = keyof Ingredient | 'totalValue';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'low' | 'in_stock';

const mockDetectBillItems = (existingIngredients: Ingredient[]) => {
    return new Promise<{ detected: Partial<Ingredient>[] }>((resolve) => {
        setTimeout(() => {
            const randomExisting = existingIngredients.length > 0 ? existingIngredients[Math.floor(Math.random() * existingIngredients.length)] : null;
            const items: Partial<Ingredient>[] = [
                { name: 'Tomatoes', stockQuantity: 5, unit: 'kg', unitCost: 40, category: 'Produce' },
                { name: 'Refined Oil', stockQuantity: 10, unit: 'l', unitCost: 120, category: 'Pantry' },
                { name: 'Premium Rice', stockQuantity: 25, unit: 'kg', unitCost: 80, category: 'Pantry' }
            ];
            if (randomExisting) {
                items.push({ 
                    id: randomExisting.id,
                    name: randomExisting.name, 
                    stockQuantity: 10, 
                    unit: randomExisting.unit, 
                    unitCost: randomExisting.unitCost, 
                    category: randomExisting.category 
                });
            }
            resolve({ detected: items });
        }, 2000);
    });
};

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
  const [aiInsights, setAiInsights] = useState<{ description: string; dietaryTags: string[]; suggestedPriceRange: string } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [recipeIngId, setRecipeIngId] = useState<string>('');
  const [recipeQty, setRecipeQty] = useState<string>('');
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const [showEditMenuModal, setShowEditMenuModal] = useState(false);
  const [editMenuData, setEditMenuData] = useState<Partial<MenuItem>>({});
  const [bulkMenuCategory, setBulkMenuCategory] = useState('');
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');
  const [newMenuSubCategory, setNewMenuSubCategory] = useState('');
  const [newMenuPortionQuarter, setNewMenuPortionQuarter] = useState('');
  const [newMenuPortionHalf, setNewMenuPortionHalf] = useState('');
  const [newMenuPortionFull, setNewMenuPortionFull] = useState('');
  const [localIngredients, setLocalIngredients] = useState<Ingredient[]>(ingredients);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editIngId, setEditIngId] = useState<string | null>(null);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngCost, setNewIngCost] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngBarcode, setNewIngBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billFile, setBillFile] = useState<string | null>(null);
  const [isProcessingBill, setIsProcessingBill] = useState(false);
  const [detectedBillItems, setDetectedBillItems] = useState<Partial<Ingredient>[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState<string>('');
  const [bulkCost, setBulkCost] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');

  useEffect(() => {
    if (!hasUnsavedChanges) {
        setLocalIngredients(ingredients);
    }
  }, [ingredients, hasUnsavedChanges]);

  useEffect(() => {
      if (isScanning && showAddIngredientModal) {
          const timer = setTimeout(() => {
              // @ts-ignore
              if (window.Html5QrcodeScanner) {
                  // @ts-ignore
                  const scanner = new window.Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
                  const onScanSuccess = (decodedText: string, decodedResult: any) => {
                      handleScanMatch(decodedText);
                      scanner.clear();
                      setIsScanning(false);
                  };
                  const onScanFailure = (error: any) => {};
                  scanner.render(onScanSuccess, onScanFailure);
              }
          }, 100);
          return () => clearTimeout(timer);
      }
  }, [isScanning, showAddIngredientModal]);

  const handleScanMatch = (barcode: string) => {
      const existing = ingredients.find(i => i.barcode === barcode);
      if (existing) {
          setEditIngId(existing.id);
          setNewIngName(existing.name);
          setNewIngCategory(existing.category || '');
          setNewIngUnit(existing.unit);
          setNewIngCost(existing.unitCost.toString());
          setNewIngQty(existing.stockQuantity.toString());
          setNewIngBarcode(existing.barcode || '');
      } else {
          setNewIngBarcode(barcode);
      }
  };

  const handleStartAddIngredient = () => {
      setEditIngId(null); setNewIngName(''); setNewIngCategory(''); setNewIngUnit('kg'); setNewIngCost(''); setNewIngQty(''); setNewIngBarcode('');
      setIsScanning(false); setShowAddIngredientModal(true);
  };

  const handleEditSingleIngredient = (ing: Ingredient) => {
      setEditIngId(ing.id); setNewIngName(ing.name); setNewIngCategory(ing.category || ''); setNewIngUnit(ing.unit);
      setNewIngCost(ing.unitCost.toString()); setNewIngQty(ing.stockQuantity.toString()); setNewIngBarcode(ing.barcode || '');
      setShowAddIngredientModal(true);
  };

  const handleAddOrUpdateIngredient = () => {
    if(!newIngName || !newIngCost) return;
    if (editIngId) {
        const updates = { name: newIngName, category: newIngCategory, unit: newIngUnit, unitCost: parseFloat(newIngCost), stockQuantity: parseFloat(newIngQty) || 0, barcode: newIngBarcode };
        handleLocalUpdate(editIngId, updates);
        onSave(ingredients.map(i => i.id === editIngId ? { ...i, ...updates } : i));
    } else {
        const newIngredient: Ingredient = { id: `i-${Date.now()}`, name: newIngName, category: newIngCategory || 'General', unit: newIngUnit, unitCost: parseFloat(newIngCost), stockQuantity: parseFloat(newIngQty) || 0, barcode: newIngBarcode };
        onAddIngredient(newIngredient);
        setLocalIngredients(prev => [...prev, newIngredient]);
    }
    setShowAddIngredientModal(false);
  };

  const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => { setBillFile(ev.target?.result as string); setShowBillModal(true); processBillImage(); };
          reader.readAsDataURL(file);
      }
  };

  const processBillImage = async () => {
      setIsProcessingBill(true);
      try { const result = await mockDetectBillItems(ingredients); setDetectedBillItems(result.detected); } catch (e) {} finally { setIsProcessingBill(false); }
  };

  const availableCategories = useMemo(() => Array.from(new Set(localIngredients.map(i => i.category).filter(Boolean))).sort() as string[], [localIngredients]);
  const availableUnits = useMemo(() => Array.from(new Set(localIngredients.map(i => i.unit))).sort(), [localIngredients]);

  const calculatePlateCost = (item: MenuItem): number => {
    let totalCost = 0;
    item.ingredients.forEach(ref => {
      const ingredient = ingredients.find(i => i.id === ref.ingredientId);
      if (ingredient) { totalCost += Number(ingredient.unitCost) * Number(ref.quantity); }
    });
    return totalCost;
  };

  const handleAddIngredientToRecipe = () => {
      if (!selectedItem || !recipeIngId || !recipeQty) return;
      const qty = parseFloat(recipeQty);
      if (isNaN(qty) || qty <= 0) return;
      const updatedItem = { ...selectedItem };
      updatedItem.ingredients = updatedItem.ingredients.filter(i => i.ingredientId !== recipeIngId);
      updatedItem.ingredients.push({ ingredientId: recipeIngId, quantity: qty });
      onUpdateMenuItem(updatedItem);
      setSelectedItem(updatedItem);
      setRecipeIngId(''); setRecipeQty('');
  };

  const handleLocalUpdate = (id: string, updates: Partial<Ingredient>) => {
    setLocalIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, ...updates } : ing));
    setHasUnsavedChanges(true); setShowSaveSuccess(false);
  };

  const handleSaveChanges = () => { onSave(localIngredients); setHasUnsavedChanges(false); setShowSaveSuccess(true); setTimeout(() => setShowSaveSuccess(false), 3000); };
  const handleResetChanges = () => { setLocalIngredients(ingredients); setHasUnsavedChanges(false); setShowSaveSuccess(false); setSelectedIds(new Set()); };

  const handleAddMenuItem = () => {
      if(!newMenuName) return;
      const full = parseFloat(newMenuPortionFull);
      const half = parseFloat(newMenuPortionHalf);
      const quarter = parseFloat(newMenuPortionQuarter);
      const manualPrice = parseFloat(newMenuPrice);
      const newItem: MenuItem = {
          id: `m-${Date.now()}`, name: newMenuName, category: newMenuCategory || 'Specials', subCategory: newMenuSubCategory,
          price: !isNaN(full) && full > 0 ? full : (!isNaN(manualPrice) ? manualPrice : 0),
          portionPrices: { full: !isNaN(full) ? full : undefined, half: !isNaN(half) ? half : undefined, quarter: !isNaN(quarter) ? quarter : undefined },
          ingredients: [], description: 'Manually added item', tags: [], available: true
      };
      onAddMenuItem(newItem); setShowAddMenuModal(false);
  };

  const processedIngredients = useMemo(() => {
    let data = [...localIngredients];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(i => i.name.toLowerCase().includes(lowerTerm) || i.id.toLowerCase().includes(lowerTerm));
    }
    if (filterStatus === 'low') data = data.filter(i => Number(i.stockQuantity) < 50);
    else if (filterStatus === 'in_stock') data = data.filter(i => Number(i.stockQuantity) >= 50);
    if (filterCategory !== 'all') data = data.filter(i => i.category === filterCategory);
    if (filterUnit !== 'all') data = data.filter(i => i.unit === filterUnit);

    return data.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Ingredient];
      let bValue: any = b[sortConfig.key as keyof Ingredient];
      if (sortConfig.key === 'totalValue') { aValue = Number(a.unitCost) * Number(a.stockQuantity); bValue = Number(b.unitCost) * Number(b.stockQuantity); }
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [localIngredients, searchTerm, filterStatus, filterCategory, filterUnit, sortConfig]);

  const totalInventoryValue = localIngredients.reduce((acc, ing) => acc + (Number(ing.unitCost) * Number(ing.stockQuantity)), 0);
  const lowStockCount = localIngredients.filter(i => Number(i.stockQuantity) < 50).length;

  const handleMenuEditSave = () => {
      if (!editMenuData.id || !editMenuData.name || editMenuData.price === undefined) return;
      const original = menuItems.find(m => m.id === editMenuData.id);
      if (!original) return;
      const updatedItem: MenuItem = { ...original, name: editMenuData.name, category: editMenuData.category || 'General', price: Number(editMenuData.price), description: editMenuData.description };
      onUpdateMenuItem(updatedItem); setShowEditMenuModal(false); if (selectedItem?.id === updatedItem.id) setSelectedItem(updatedItem);
  };

  return (
    <div className="h-full flex flex-col space-y-4 relative">
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleBillUpload} className="hidden" />
      <input type="file" accept=".csv" ref={menuFileInputRef} onChange={handleBillUpload} className="hidden" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-2 md:p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div className="flex space-x-2 overflow-x-auto w-full md:w-auto">
          <button onClick={() => setActiveView('menu')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeView === 'menu' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>Menu Analysis & Costing</button>
          <button onClick={() => setActiveView('stock')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeView === 'stock' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>Bulk Inventory System</button>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-2 md:px-4 w-full md:w-auto">
             <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-full md:w-auto">
                <Package size={16} className="text-blue-500" />
                <span>Total Value: <span className="font-bold text-slate-900">₹{(Number(totalInventoryValue) || 0).toLocaleString('en-IN')}</span></span>
             </div>
             {lowStockCount > 0 && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 animate-pulse w-full md:w-auto"><AlertTriangle size={16} /><span className="font-bold">{lowStockCount} Items Low Stock</span></div>}
        </div>
      </div>

      {activeView === 'menu' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
                <h2 className="font-bold text-lg text-slate-800">Menu Items</h2>
                <button onClick={() => setShowAddMenuModal(true)} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 transition-colors shadow"><Plus size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
                {menuItems.map(item => {
                    const cost = Number(calculatePlateCost(item) || 0);
                    const itemPrice = Number(item.price || 0);
                    const margin = itemPrice > 0 ? ((itemPrice - cost) / itemPrice) * 100 : 0;
                    return (
                        <div key={item.id} onClick={() => { setSelectedItem(item); setAiInsights(null); }} className={`p-4 mb-2 rounded-lg cursor-pointer border transition-all relative ${selectedItem?.id === item.id ? 'bg-blue-50 border-blue-500 shadow-md' : 'bg-white border-slate-100 hover:border-blue-300'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-slate-800">{item.name}</h3>
                                    <p className="text-xs text-slate-500">{item.category}</p>
                                </div>
                                <span className="font-mono font-bold text-slate-900">₹{(Number(item.price) || 0).toFixed(2)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                                <div className="bg-white p-2 rounded border border-slate-200"><p className="text-xs text-slate-400 uppercase">Plate Cost</p><p className="font-bold text-slate-700">₹{cost.toFixed(2)}</p></div>
                                <div className="bg-white p-2 rounded border border-slate-200"><p className="text-xs text-slate-400 uppercase">Profit</p><p className="font-bold text-green-600">₹{(itemPrice - cost).toFixed(2)}</p></div>
                                <div className="bg-white p-2 rounded border border-slate-200"><p className="text-xs text-slate-400 uppercase">Margin</p><p className={`font-bold ${margin < 65 ? 'text-red-500' : 'text-slate-700'}`}>{margin.toFixed(0)}%</p></div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto relative">
            {selectedItem ? (
                <>
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">{selectedItem.name}</h2>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2 mb-6">
                        {selectedItem.ingredients.map((ref, idx) => {
                            const ing = ingredients.find(i => i.id === ref.ingredientId);
                            if (!ing) return null;
                            const lineCost = Number(ing.unitCost) * Number(ref.quantity);
                            return (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                                    <span>{ref.quantity} {ing.unit} {ing.name} (@ ₹{(Number(ing.unitCost) || 0).toFixed(2)})</span>
                                    <span className="font-mono text-slate-600">₹{lineCost.toFixed(2)}</span>
                                </div>
                            )
                        })}
                        <div className="flex justify-between font-bold pt-2 text-slate-800 border-t border-slate-300 mt-2">
                            <span>Total Plate Cost</span>
                            <span>₹{(Number(calculatePlateCost(selectedItem)) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400"><p>Select a menu item to view details</p></div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ingredient Name</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Cost / Unit (₹)</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Qty</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedIngredients.map(ing => (
                  <tr key={ing.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{ing.name}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{ing.unit}</td>
                    <td className="px-6 py-4">₹{(Number(ing.unitCost) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{(Number(ing.stockQuantity) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono">₹{(Number(ing.unitCost) * Number(ing.stockQuantity)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;