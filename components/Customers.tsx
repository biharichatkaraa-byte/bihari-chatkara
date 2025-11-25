
import React, { useState } from 'react';
import { Customer } from '../types';
import { Search, Plus, User, Phone, Mail, Award, Calendar, Trash2, X, Save } from 'lucide-react';
import { format } from 'date-fns';

interface CustomersProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
}

const Customers: React.FC<CustomersProps> = ({ customers, onAddCustomer, onDeleteCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Customer State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const handleAddSubmit = () => {
      if(!newName || !newPhone) {
          alert("Name and Phone are required");
          return;
      }

      const newCustomer: Customer = {
          id: `c-${Date.now()}`,
          name: newName,
          phone: newPhone,
          email: newEmail,
          notes: newNotes,
          loyaltyPoints: 0,
          totalVisits: 0,
          lastVisit: new Date()
      };

      onAddCustomer(newCustomer);
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
  };

  return (
    <div className="h-full flex flex-col space-y-4 relative">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Customer Management</h2>
                <p className="text-slate-500 text-sm">View profiles and loyalty program.</p>
            </div>
            <button 
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-all"
            >
                <Plus size={18} /> Add Customer
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                 <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by name or phone..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                 </div>
                 <div className="text-sm text-slate-500">
                     Total Customers: <span className="font-bold text-slate-800">{customers.length}</span>
                 </div>
             </div>

             <div className="flex-1 overflow-auto">
                 <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                         <tr>
                             <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Customer Profile</th>
                             <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Contact Info</th>
                             <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Loyalty Status</th>
                             <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Last Visit</th>
                             <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {filteredCustomers.length === 0 ? (
                             <tr><td colSpan={5} className="p-12 text-center text-slate-400">No customers found.</td></tr>
                         ) : (
                             filteredCustomers.map(c => (
                                 <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                     <td className="px-6 py-4">
                                         <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                                 {c.name.charAt(0)}
                                             </div>
                                             <div>
                                                 <p className="font-bold text-slate-800">{c.name}</p>
                                                 {c.notes && <p className="text-xs text-amber-600 bg-amber-50 px-1 rounded border border-amber-100 inline-block mt-1">{c.notes}</p>}
                                             </div>
                                         </div>
                                     </td>
                                     <td className="px-6 py-4 text-sm text-slate-600">
                                         <div className="flex flex-col gap-1">
                                             <span className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {c.phone}</span>
                                             {c.email && <span className="flex items-center gap-2"><Mail size={14} className="text-slate-400"/> {c.email}</span>}
                                         </div>
                                     </td>
                                     <td className="px-6 py-4">
                                         <div className="flex items-center gap-2 mb-1">
                                             <Award size={16} className="text-orange-500" />
                                             <span className="font-bold text-slate-800">{c.loyaltyPoints} pts</span>
                                         </div>
                                         <p className="text-xs text-slate-500">{c.totalVisits} visits total</p>
                                     </td>
                                     <td className="px-6 py-4 text-sm text-slate-500">
                                         <div className="flex items-center gap-2">
                                             <Calendar size={14} />
                                             {format(c.lastVisit, 'MMM dd, yyyy')}
                                         </div>
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <button 
                                            onClick={() => onDeleteCustomer(c.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Customer"
                                         >
                                             <Trash2 size={18} />
                                         </button>
                                     </td>
                                 </tr>
                             ))
                         )}
                     </tbody>
                 </table>
             </div>
        </div>

        {/* Add Customer Modal */}
        {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <User size={20} /> Add New Customer
                        </h3>
                        <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email (Optional)</label>
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Allergies, Prefs)</label>
                            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20"></textarea>
                        </div>
                        <button onClick={handleAddSubmit} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                            <Save size={18} /> Save Customer
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Customers;
