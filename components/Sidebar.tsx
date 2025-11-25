
import React from 'react';
import { LayoutDashboard, ShoppingCart, UtensilsCrossed, ClipboardList, Users, LogOut, ShieldCheck, Wallet, Truck, ChefHat, Heart } from 'lucide-react';
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
  
  // Define menu items with strict role-based access
  const allNavItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: [UserRole.MANAGER, UserRole.SERVER, UserRole.CHEF, UserRole.BARTENDER] 
    },
    { 
      id: 'pos', 
      label: 'Point of Sale', 
      icon: ShoppingCart, 
      roles: [UserRole.MANAGER, UserRole.SERVER, UserRole.BARTENDER] 
    },
    { 
      id: 'kds', 
      label: 'Kitchen Display', 
      icon: UtensilsCrossed, 
      roles: [UserRole.MANAGER, UserRole.CHEF] 
    },
    { 
      id: 'inventory', 
      label: 'Inventory & Menu', 
      icon: ClipboardList, 
      roles: [UserRole.MANAGER, UserRole.CHEF] 
    },
    {
      id: 'procurement',
      label: 'Procurement',
      icon: Truck,
      roles: [UserRole.MANAGER, UserRole.CHEF]
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: Wallet,
      roles: [UserRole.MANAGER, UserRole.SERVER]
    },
    {
        id: 'customers',
        label: 'Customers',
        icon: Heart,
        roles: [UserRole.MANAGER, UserRole.SERVER]
    },
    { 
      id: 'staff', 
      label: 'Staff Management', 
      icon: Users, 
      roles: [UserRole.MANAGER] 
    },
  ];

  // Logic: If user has 'permissions' array defined, use that exclusively.
  // Otherwise, fallback to 'roles' check.
  const filteredNavItems = allNavItems.filter(item => {
      if (currentUser.permissions && currentUser.permissions.length > 0) {
          return currentUser.permissions.includes(item.id);
      }
      return item.roles.includes(currentUser.role);
  });

  // Generate initials
  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleTabClick = (id: string) => {
      setActiveTab(id);
      if (onClose) onClose(); // Close sidebar on mobile when item clicked
  };

  return (
    <aside 
        className={`w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="p-6 border-b border-slate-700 flex flex-col items-center text-center pt-8 md:pt-6">
        <div className="bg-orange-100/10 p-3 rounded-full mb-3 ring-2 ring-orange-600/50">
           <ChefHat size={32} className="text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-orange-500 font-serif tracking-wide leading-none">
          Bihari<br/><span className="text-white">Chatkara</span>
        </h1>
        <p className="text-[10px] text-orange-400/80 mt-2 font-medium uppercase tracking-widest border-t border-slate-700 pt-2 w-full">
          - The Authentic Taste of Bihar -
        </p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</p>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <ShieldCheck size={10} /> Role: {currentUser.role}
            </span>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-red-600 flex items-center justify-center font-bold text-sm text-white shadow-lg">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate w-24">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate w-24">{currentUser.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:bg-slate-700 rounded-md"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
