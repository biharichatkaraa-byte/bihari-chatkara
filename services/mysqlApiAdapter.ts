
/**
 * MySQL API ADAPTER
 * 
 * Since the React Frontend cannot connect directly to MySQL for security reasons,
 * you need a simple Backend API (Node.js/Express, Python/Flask, or PHP).
 * 
 * This file demonstrates how to replace the calls in `db.ts` to fetch data 
 * from your MySQL backend instead of Firebase/LocalStorage.
 */

import { Order, MenuItem, Ingredient, User, Expense, RequisitionRequest, Customer } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// --- GENERIC FETCH HELPERS ---

const fetchJson = async (endpoint: string) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
};

const postJson = async (endpoint: string, data: any) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
};

// --- DATA METHODS (To replace db.ts logic) ---

export const mysqlApi = {
    // Orders
    getOrders: async (): Promise<Order[]> => {
        // Backend should do a JOIN on order_items to return the nested structure
        return fetchJson('/orders'); 
    },
    createOrder: async (order: Order) => {
        return postJson('/orders', order);
    },
    updateOrderStatus: async (id: string, status: string) => {
        return postJson(`/orders/${id}/status`, { status });
    },

    // Menu
    getMenu: async (): Promise<MenuItem[]> => {
        return fetchJson('/menu-items');
    },
    
    // Inventory
    getIngredients: async (): Promise<Ingredient[]> => {
        return fetchJson('/ingredients');
    },
    updateStock: async (id: string, quantity: number) => {
        return postJson(`/ingredients/${id}/stock`, { quantity });
    },

    // General
    syncTable: async (table: string) => {
        return fetchJson(`/${table}`);
    }
};

/*
 * INSTRUCTIONS FOR BACKEND DEVELOPER:
 * 
 * 1. Create endpoints corresponding to the calls above.
 * 2. Example Node.js/Express Endpoint for GET /orders:
 * 
 * app.get('/api/orders', async (req, res) => {
 *    const [orders] = await db.query('SELECT * FROM orders');
 *    // You need to fetch order_items and nest them inside the order objects
 *    // before returning JSON.
 *    res.json(orders);
 * });
 */
