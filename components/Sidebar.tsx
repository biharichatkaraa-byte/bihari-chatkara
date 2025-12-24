import React from 'react';
import { LayoutDashboard, ShoppingCart, UtensilsCrossed, ClipboardList, Users, LogOut, ShieldCheck, Wallet, Truck, ChefHat, Heart, Settings, History, X } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentUser, onLogout, isOpen = false, onClose }) => {
  
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.MANAGER, UserRole.SERVER, UserRole.CHEF, UserRole.BARTENDER] },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, roles: [UserRole.MANAGER, UserRole.SERVER, UserRole.BARTENDER] },
    { id: 'history', label: 'Order History', icon: History, roles: [UserRole.MANAGER, UserRole.SERVER] },
    { id: 'kds', label: 'Kitchen Display', icon: UtensilsCrossed, roles: [UserRole.MANAGER, UserRole.CHEF] },
    { id: 'inventory', label: 'Inventory & Menu', icon: ClipboardList, roles: [UserRole.MANAGER, UserRole.CHEF] },
    { id: 'procurement', label: 'Procurement', icon: Truck, roles: [UserRole.MANAGER, UserRole.CHEF] },
    { id: 'expenses', label: 'Expenses', icon: Wallet, roles: [UserRole.MANAGER, UserRole.SERVER] },
    { id: 'customers', label: 'Customers', icon: Heart, roles: [UserRole.MANAGER, UserRole.SERVER] },
    { id: 'staff', label: 'User', icon: Users, roles: [UserRole.MANAGER] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: [UserRole.MANAGER] },
  ];

  const filteredNavItems = allNavItems.filter(item => {
      if (currentUser.permissions && currentUser.permissions.length > 0) {
          return currentUser.permissions.includes(item.id);
      }
      return item.roles.includes(currentUser.role);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300" onClick={onClose} />
      )}

      <aside 
          className={`w-64 bg-brand-slate text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-white/10 flex flex-col items-center text-center pt-10 md:pt-6 bg-brand-gradient relative">
          <button onClick={onClose} className="md:hidden absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
              <X size={24} />
          </button>
          <div className="bg-white/20 p-3 rounded-2xl mb-3 shadow-inner backdrop-blur-sm">
             <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white font-serif tracking-wide leading-none">Bihari<br/><span className="text-orange-200">Chatkara</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-2 no-scrollbar">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); if (onClose) onClose(); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'text-slate-400 hover:bg-slate-900 hover:text-orange-400'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900/50">
          <div className="flex items-center justify-between px-2 bg-slate-900 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-white shrink-0">{currentUser.name.charAt(0)}</div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-slate-200">{currentUser.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{currentUser.role}</p>
              </div>
            </div>
            <button onClick={onLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1.5"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;