
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Trash2, UserPlus, Shield, Mail, CheckSquare, Square, Lock, Eye, EyeOff } from 'lucide-react';

interface StaffManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const AVAILABLE_MODULES = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pos', label: 'Point of Sale' },
    { id: 'kds', label: 'Kitchen Display' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'procurement', label: 'Procurement' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'customers', label: 'Customer Mgmt' },
    { id: 'staff', label: 'User Access' },
];

const StaffManagement: React.FC<StaffManagementProps> = ({ users, onAddUser, onDeleteUser }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.SERVER);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [useCustomPerms, setUseCustomPerms] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const togglePermission = (moduleId: string) => {
      setCustomPermissions(prev => 
          prev.includes(moduleId) 
          ? prev.filter(p => p !== moduleId) 
          : [...prev, moduleId]
      );
  };

  const togglePasswordVisibility = (id: string) => {
      setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName && newEmail && newPassword) {
      const newUser: User = {
        id: `u-${Date.now()}`,
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        permissions: useCustomPerms ? customPermissions : undefined // Only attach if custom toggle is on
      };
      onAddUser(newUser);
      
      // Reset
      setIsAdding(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole(UserRole.SERVER);
      setCustomPermissions([]);
      setUseCustomPerms(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Manage user access levels and roles.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
        >
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="font-bold text-lg mb-4 text-slate-800">New User Details</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. John Doe"
                    required
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="email@biharichatkara.com"
                    required
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Set Password"
                    required
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role (Template)</label>
                <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    {Object.values(UserRole).map(role => (
                    <option key={role} value={role}>{role}</option>
                    ))}
                </select>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                    <button 
                        type="button" 
                        onClick={() => setUseCustomPerms(!useCustomPerms)}
                        className={`text-sm font-bold flex items-center gap-2 transition-colors ${useCustomPerms ? 'text-blue-600' : 'text-slate-500'}`}
                    >
                         {useCustomPerms ? <CheckSquare size={18} /> : <Square size={18} />}
                         Customize Access Permissions
                    </button>
                    <span className="text-xs text-slate-400">(Overrides Default Role Access)</span>
                </div>

                {useCustomPerms && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in">
                        {AVAILABLE_MODULES.map(mod => (
                            <button
                                type="button"
                                key={mod.id}
                                onClick={() => togglePermission(mod.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                    customPermissions.includes(mod.id)
                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                {customPermissions.includes(mod.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                {mod.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-200"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">User</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Role / Access</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Credentials</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-400 flex items-center gap-1">
                        <Mail size={12} /> {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border w-fit ${
                        user.role === UserRole.MANAGER 
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : user.role === UserRole.CHEF
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {user.role === UserRole.MANAGER && <Shield size={10} />}
                        {user.role}
                      </span>
                      {user.permissions && user.permissions.length > 0 && (
                          <span className="text-xs text-slate-500">
                              Custom Access: {user.permissions.length} modules
                          </span>
                      )}
                  </div>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Lock size={14} className="text-slate-400" />
                        <span className="font-mono">
                            {showPasswords[user.id] ? (user.password || '******') : '••••••'}
                        </span>
                        <button 
                            onClick={() => togglePasswordVisibility(user.id)} 
                            className="text-slate-400 hover:text-blue-600"
                            title="Show/Hide Password"
                        >
                            {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onDeleteUser(user.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove User"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffManagement;
