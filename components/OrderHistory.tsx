import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../types';
import { format, formatDistance, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { 
    Search, Download, ChevronLeft, ChevronRight, 
    ArrowUpDown, ArrowUp, ArrowDown, Eye, FileText, 
    CheckCircle, XCircle, Clock, 
    User, Hash, X, ArrowRight, Filter, MessageSquare, Tag, Info, Receipt
} from 'lucide-react';

interface OrderHistoryProps {
  orders: Order[];
}

type SortKey = keyof Order | 'totalAmount';
type SortDirection = 'asc' | 'desc';

const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('All');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('All');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getOrderTotal = (order: Order) => {
      const subtotal = order.items.reduce((acc, item) => acc + (Number(item.priceAtOrder) * Number(item.quantity)), 0);
      const discount = Number(order.discount || 0);
      const taxAmount = Math.max(0, subtotal - discount) * ((Number(order.taxRate) || 0) / 100);
      return Math.max(0, subtotal - discount) + taxAmount;
  };

  const processedOrders = useMemo(() => {
      let data = [...orders];
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          data = data.filter(o => o.id.toLowerCase().includes(lowerTerm) || o.serverName.toLowerCase().includes(lowerTerm) || (o.tableNumber && o.tableNumber.toString().includes(lowerTerm)));
      }
      if (filterStatus !== 'All') data = data.filter(o => o.status === filterStatus);
      if (filterPaymentStatus !== 'All') data = data.filter(o => o.paymentStatus === filterPaymentStatus);
      
      return data.sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof Order];
          let bValue: any = b[sortConfig.key as keyof Order];
          if (sortConfig.key === 'totalAmount') { aValue = getOrderTotal(a); bValue = getOrderTotal(b); }
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [orders, searchTerm, filterStatus, sortConfig]);

  const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="h-full flex flex-col space-y-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Order History</h2>
            <p className="text-slate-500 text-sm">{processedOrders.length} Records Found</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Total</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {paginatedOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-mono text-xs">#{order.id.split('-')[1] || order.id}</td>
                                <td className="px-6 py-4 text-sm">{format(new Date(order.createdAt), 'MMM dd, hh:mm a')}</td>
                                <td className="px-6 py-4 font-bold">₹{(Number(getOrderTotal(order)) || 0).toFixed(2)}</td>
                                <td className="px-6 py-4 text-xs font-bold uppercase">{order.status}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => setSelectedOrder(order)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between mb-6">
                        <h3 className="text-2xl font-black">Order Summary</h3>
                        <button onClick={() => setSelectedOrder(null)}><X size={24}/></button>
                    </div>
                    <div className="space-y-4">
                        {selectedOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between border-b pb-2">
                                <span>{item.quantity}x {item.name}</span>
                                <span>₹{(Number(item.priceAtOrder) * Number(item.quantity)).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="pt-4 space-y-1 text-right">
                            <p>Discount: -₹{(Number(selectedOrder.discount) || 0).toFixed(2)}</p>
                            <p className="text-xl font-black">Total: ₹{(Number(getOrderTotal(selectedOrder)) || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default OrderHistory;