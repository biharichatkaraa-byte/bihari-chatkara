
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

// Database Connection Logic
const getDbConfig = () => {
    const config = {
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '', 
        database: process.env.DB_NAME || 'chatkara',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 10000 
    };

    // If INSTANCE_CONNECTION_NAME is provided (Standard GCP Env Variable), use socket
    if (process.env.INSTANCE_CONNECTION_NAME) {
        config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
        console.log(`[DB Config] Using Cloud SQL Socket: ${config.socketPath}`);
    } 
    // Fallback: Check if DB_HOST looks like a socket path or connection name (contains colon but not dot)
    else if (process.env.DB_HOST && process.env.DB_HOST.includes(':') && !process.env.DB_HOST.includes('.')) {
         config.socketPath = `/cloudsql/${process.env.DB_HOST}`;
         console.log(`[DB Config] Inferred Socket from DB_HOST: ${config.socketPath}`);
    }
    // Fallback: Standard TCP
    else {
        config.host = process.env.DB_HOST || '127.0.0.1';
        config.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
        console.log(`[DB Config] Using TCP Host: ${config.host}:${config.port}`);
    }

    return config;
};

const DB_CONFIG = getDbConfig();

// --- SEED DATA (Comprehensive Inventory) ---
const SEED_INGREDIENTS = [
  // PRODUCE
  { id: 'i-onion', name: 'Onion (Red)', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 50 },
  { id: 'i-tomato', name: 'Tomato (Hybrid)', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 40 },
  { id: 'i-potato', name: 'Potato', category: 'Produce', unit: 'kg', unitCost: 25.00, stockQuantity: 100 },
  { id: 'i-garlic', name: 'Garlic', category: 'Produce', unit: 'kg', unitCost: 120.00, stockQuantity: 10 },
  { id: 'i-ginger', name: 'Ginger', category: 'Produce', unit: 'kg', unitCost: 80.00, stockQuantity: 8 },
  { id: 'i-coriander', name: 'Coriander Leaves', category: 'Produce', unit: 'kg', unitCost: 60.00, stockQuantity: 5 },
  { id: 'i-lemon', name: 'Lemon', category: 'Produce', unit: 'pc', unitCost: 5.00, stockQuantity: 100 },
  { id: 'i-grn-chilli', name: 'Green Chilli', category: 'Produce', unit: 'kg', unitCost: 60.00, stockQuantity: 5 },
  { id: 'i-capsicum', name: 'Capsicum (Green)', category: 'Produce', unit: 'kg', unitCost: 50.00, stockQuantity: 15 },
  { id: 'i-cucumber', name: 'Cucumber', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 20 },
  { id: 'i-mint', name: 'Mint Leaves', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 2 },
  { id: 'i-spinach', name: 'Spinach (Palak)', category: 'Produce', unit: 'kg', unitCost: 30.00, stockQuantity: 10 },
  { id: 'i-carrot', name: 'Carrot', category: 'Produce', unit: 'kg', unitCost: 40.00, stockQuantity: 15 },
  { id: 'i-cabbage', name: 'Cabbage', category: 'Produce', unit: 'kg', unitCost: 20.00, stockQuantity: 20 },
  { id: 'i-cauliflower', name: 'Cauliflower', category: 'Produce', unit: 'kg', unitCost: 35.00, stockQuantity: 15 },

  // DAIRY
  { id: 'i-milk', name: 'Milk (Full Cream)', category: 'Dairy', unit: 'l', unitCost: 66.00, stockQuantity: 50 },
  { id: 'i-paneer', name: 'Paneer (Cottage Cheese)', category: 'Dairy', unit: 'kg', unitCost: 380.00, stockQuantity: 20 },
  { id: 'i-butter', name: 'Butter (Salted)', category: 'Dairy', unit: 'kg', unitCost: 520.00, stockQuantity: 10 },
  { id: 'i-cream', name: 'Fresh Cream', category: 'Dairy', unit: 'l', unitCost: 220.00, stockQuantity: 10 },
  { id: 'i-curd', name: 'Curd/Yogurt', category: 'Dairy', unit: 'kg', unitCost: 70.00, stockQuantity: 25 },
  { id: 'i-cheese-moz', name: 'Mozzarella Cheese', category: 'Dairy', unit: 'kg', unitCost: 450.00, stockQuantity: 15 },
  { id: 'i-cheese-sl', name: 'Cheese Slices', category: 'Dairy', unit: 'pkt', unitCost: 140.00, stockQuantity: 20 },
  { id: 'i-ghee', name: 'Desi Ghee', category: 'Dairy', unit: 'l', unitCost: 650.00, stockQuantity: 10 },

  // PROTEINS
  { id: 'i-chk-breast', name: 'Chicken Breast (Boneless)', category: 'Meat', unit: 'kg', unitCost: 280.00, stockQuantity: 30 },
  { id: 'i-chk-bone', name: 'Chicken Curry Cut', category: 'Meat', unit: 'kg', unitCost: 220.00, stockQuantity: 40 },
  { id: 'i-mutton', name: 'Mutton (Goat)', category: 'Meat', unit: 'kg', unitCost: 750.00, stockQuantity: 10 },
  { id: 'i-fish-basa', name: 'Fish Fillet (Basa)', category: 'Meat', unit: 'kg', unitCost: 350.00, stockQuantity: 15 },
  { id: 'i-eggs', name: 'Eggs', category: 'Meat', unit: 'tray', unitCost: 180.00, stockQuantity: 20 },

  // PANTRY
  { id: 'i-rice-bas', name: 'Rice (Basmati)', category: 'Pantry', unit: 'kg', unitCost: 90.00, stockQuantity: 100 },
  { id: 'i-rice-sona', name: 'Rice (Sona Masoori)', category: 'Pantry', unit: 'kg', unitCost: 55.00, stockQuantity: 100 },
  { id: 'i-atta', name: 'Wheat Flour (Atta)', category: 'Pantry', unit: 'kg', unitCost: 40.00, stockQuantity: 100 },
  { id: 'i-maida', name: 'Refined Flour (Maida)', category: 'Pantry', unit: 'kg', unitCost: 35.00, stockQuantity: 50 },
  { id: 'i-besan', name: 'Gram Flour (Besan)', category: 'Pantry', unit: 'kg', unitCost: 80.00, stockQuantity: 20 },
  { id: 'i-cornflour', name: 'Corn Flour', category: 'Pantry', unit: 'kg', unitCost: 60.00, stockQuantity: 10 },
  { id: 'i-sugar', name: 'Sugar', category: 'Pantry', unit: 'kg', unitCost: 42.00, stockQuantity: 50 },
  { id: 'i-salt', name: 'Salt', category: 'Pantry', unit: 'kg', unitCost: 20.00, stockQuantity: 50 },
  { id: 'i-oil-must', name: 'Mustard Oil', category: 'Pantry', unit: 'l', unitCost: 160.00, stockQuantity: 50 },
  { id: 'i-oil-ref', name: 'Refined Oil', category: 'Pantry', unit: 'l', unitCost: 130.00, stockQuantity: 100 },
  { id: 'i-dal-toor', name: 'Toor Dal', category: 'Pantry', unit: 'kg', unitCost: 140.00, stockQuantity: 30 },
  { id: 'i-dal-moong', name: 'Moong Dal (Yellow)', category: 'Pantry', unit: 'kg', unitCost: 110.00, stockQuantity: 20 },
  { id: 'i-dal-urad', name: 'Urad Dal (Whole)', category: 'Pantry', unit: 'kg', unitCost: 130.00, stockQuantity: 20 },
  { id: 'i-chana', name: 'Kabuli Chana', category: 'Pantry', unit: 'kg', unitCost: 100.00, stockQuantity: 20 },
  { id: 'i-rajma', name: 'Rajma (Kidney Beans)', category: 'Pantry', unit: 'kg', unitCost: 120.00, stockQuantity: 20 },

  // SPICES
  { id: 'i-jeera', name: 'Cumin Seeds (Jeera)', category: 'Spices', unit: 'kg', unitCost: 400.00, stockQuantity: 5 },
  { id: 'i-mustard-sd', name: 'Mustard Seeds (Rai)', category: 'Spices', unit: 'kg', unitCost: 150.00, stockQuantity: 5 },
  { id: 'i-haldi', name: 'Turmeric Powder', category: 'Spices', unit: 'kg', unitCost: 200.00, stockQuantity: 10 },
  { id: 'i-red-chilli', name: 'Red Chilli Powder', category: 'Spices', unit: 'kg', unitCost: 300.00, stockQuantity: 10 },
  { id: 'i-dhaniya-pw', name: 'Coriander Powder', category: 'Spices', unit: 'kg', unitCost: 200.00, stockQuantity: 10 },
  { id: 'i-garam-masala', name: 'Garam Masala', category: 'Spices', unit: 'kg', unitCost: 600.00, stockQuantity: 5 },
  { id: 'i-cardamom', name: 'Cardamom (Green)', category: 'Spices', unit: 'kg', unitCost: 2500.00, stockQuantity: 1 },
  { id: 'i-cloves', name: 'Cloves (Laung)', category: 'Spices', unit: 'kg', unitCost: 1200.00, stockQuantity: 1 },
  { id: 'i-cinnamon', name: 'Cinnamon Sticks', category: 'Spices', unit: 'kg', unitCost: 800.00, stockQuantity: 1 },
  { id: 'i-bay-leaf', name: 'Bay Leaf (Tej Patta)', category: 'Spices', unit: 'kg', unitCost: 300.00, stockQuantity: 2 },
  { id: 'i-blk-pepper', name: 'Black Pepper (Whole)', category: 'Spices', unit: 'kg', unitCost: 600.00, stockQuantity: 2 },
  { id: 'i-chaat-masala', name: 'Chaat Masala', category: 'Spices', unit: 'kg', unitCost: 350.00, stockQuantity: 5 },
  { id: 'i-kasuri', name: 'Kasuri Methi', category: 'Spices', unit: 'kg', unitCost: 400.00, stockQuantity: 2 },

  // SAUCES
  { id: 'i-soy', name: 'Dark Soy Sauce', category: 'Condiments', unit: 'l', unitCost: 80.00, stockQuantity: 10 },
  { id: 'i-vinegar', name: 'White Vinegar', category: 'Condiments', unit: 'l', unitCost: 40.00, stockQuantity: 10 },
  { id: 'i-chilli-sauce', name: 'Green Chilli Sauce', category: 'Condiments', unit: 'l', unitCost: 60.00, stockQuantity: 10 },
  { id: 'i-ketchup', name: 'Tomato Ketchup', category: 'Condiments', unit: 'kg', unitCost: 120.00, stockQuantity: 15 },
  { id: 'i-mayo', name: 'Mayonnaise', category: 'Condiments', unit: 'kg', unitCost: 150.00, stockQuantity: 10 },
  
  // BEVERAGES
  { id: 'i-tea', name: 'Tea Leaves', category: 'Beverages', unit: 'kg', unitCost: 450.00, stockQuantity: 10 },
  { id: 'i-coffee', name: 'Coffee Powder', category: 'Beverages', unit: 'kg', unitCost: 800.00, stockQuantity: 5 },
  { id: 'i-water', name: 'Mineral Water (1L)', category: 'Beverages', unit: 'crate', unitCost: 120.00, stockQuantity: 50 },
  { id: 'i-soda', name: 'Soda (600ml)', category: 'Beverages', unit: 'crate', unitCost: 400.00, stockQuantity: 20 },
];

// --- APP INITIALIZATION ---
const app = express();

// Initialize pool immediately. mysql2 creates it lazily/synchronously.
let pool = mysql.createPool(DB_CONFIG);
let dbError = null;
let isDbInitialized = false;

// --- DATABASE INITIALIZATION ---
// Robust initialization with retry logic
const initDb = async (retries = 10, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[DB] Attempting connection (Attempt ${i + 1}/${retries})...`);
            
            // Test connection
            const connection = await pool.getConnection();
            console.log(`[DB] MySQL Connected Successfully to '${DB_CONFIG.database}'.`);
            
            // Initialize Schema
            await connection.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), role VARCHAR(50), permissions TEXT, password VARCHAR(100))`);
            
            // Migration: Check if password column exists in users table (for existing DBs)
            try {
                await connection.query(`SELECT password FROM users LIMIT 1`);
            } catch (err) {
                console.log("[DB] Adding missing 'password' column to users table...");
                await connection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(100)`);
            }

            await connection.query(`CREATE TABLE IF NOT EXISTS menu_items (id VARCHAR(50) PRIMARY KEY, category_id VARCHAR(50), sub_category_id VARCHAR(50), name VARCHAR(100), category VARCHAR(100), price DECIMAL(10, 2), description TEXT, is_veg TINYINT(1), available TINYINT(1), ingredients TEXT, portion_prices TEXT, tags TEXT)`);
            await connection.query(`CREATE TABLE IF NOT EXISTS ingredients (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(100), unit VARCHAR(20), unit_cost DECIMAL(10, 2), stock_quantity DECIMAL(10, 2))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(50) PRIMARY KEY, table_number INT, server_name VARCHAR(100), status VARCHAR(50), payment_status VARCHAR(50), payment_method VARCHAR(50), created_at VARCHAR(64), tax_rate DECIMAL(5, 2), discount DECIMAL(10, 2))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS order_items (id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50), menu_item_id VARCHAR(50), name VARCHAR(100), quantity INT, price_at_order DECIMAL(10, 2), portion VARCHAR(50), modifiers TEXT, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)`);
            
            // Expenses table with receipt_image support (LONGTEXT for Base64)
            await connection.query(`CREATE TABLE IF NOT EXISTS expenses (id VARCHAR(50) PRIMARY KEY, description TEXT, amount DECIMAL(10, 2), category VARCHAR(100), date VARCHAR(64), reported_by VARCHAR(100))`);
             try {
                await connection.query(`SELECT receipt_image FROM expenses LIMIT 1`);
            } catch (err) {
                console.log("[DB] Adding missing 'receipt_image' column to expenses table...");
                await connection.query(`ALTER TABLE expenses ADD COLUMN receipt_image LONGTEXT`);
            }

            await connection.query(`CREATE TABLE IF NOT EXISTS requisitions (id VARCHAR(50) PRIMARY KEY, ingredient_id VARCHAR(50), ingredient_name VARCHAR(100), quantity DECIMAL(10, 2), unit VARCHAR(20), urgency VARCHAR(20), status VARCHAR(20), requested_by VARCHAR(100), requested_at VARCHAR(64), notes TEXT, estimated_unit_cost DECIMAL(10, 2), preferred_supplier VARCHAR(100))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), phone VARCHAR(20), email VARCHAR(100), loyalty_points INT, total_visits INT, last_visit VARCHAR(64), notes TEXT)`);

            // --- SEEDING ---
            const [userRows] = await connection.query('SELECT count(*) as count FROM users');
            if (Number(userRows[0].count) === 0) {
                console.log("[DB] Seeding Default Admin User...");
                await connection.query('INSERT INTO users (id, name, email, role, permissions, password) VALUES (?, ?, ?, ?, ?, ?)', ['u1', 'Administrator', 'admin@biharichatkara.com', 'Manager', '[]', 'admin123']);
            }
            const [ingRows] = await connection.query('SELECT count(*) as count FROM ingredients');
            if (Number(ingRows[0].count) === 0) {
                console.log("[DB] Seeding Comprehensive Inventory...");
                for (const i of SEED_INGREDIENTS) await connection.query('INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)', [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity]);
            }
            
            connection.release();
            dbError = null;
            isDbInitialized = true;
            console.log("[DB] Initialization and Seeding Complete.");
            return; // Success
        } catch (e) {
            const target = DB_CONFIG.socketPath ? `Socket ${DB_CONFIG.socketPath}` : `Host ${DB_CONFIG.host}`;
            console.error(`[DB] Error connecting to ${target}:`, e.message);
            dbError = e.message;
            
            // Wait before retry
            await new Promise(res => setTimeout(res, delay));
        }
    }
    console.error("[DB] All connection attempts failed.");
};

// --- MIDDLEWARE ---
// Increase JSON payload limit to handle Base64 images
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));

// --- HEALTH HANDLER ---
const healthHandler = async (req, res) => {
    // If we haven't initialized successfully yet, check if we can connect now
    if (!isDbInitialized) {
        try {
            const conn = await pool.getConnection();
            conn.release();
             res.json({
                status: 'starting',
                database: 'mysql',
                message: 'Database connecting...',
                details: dbError
            });
            return;
        } catch (e) {
             return res.status(503).json({
                status: 'error',
                message: 'Database not connected.',
                details: dbError || e.message,
                config: {
                    host: DB_CONFIG.host,
                    socketPath: DB_CONFIG.socketPath,
                    user: DB_CONFIG.user
                }
            });
        }
    }

    res.json({
        status: 'ok',
        database: 'mysql',
        config: {
            host: DB_CONFIG.host,
            socketPath: DB_CONFIG.socketPath,
            user: DB_CONFIG.user
        },
        timestamp: new Date().toISOString()
    });
};

// --- API ROUTER ---
const api = express.Router();

// 1. Health Check
api.get('/health', healthHandler);

// 2. Database Guard Middleware
const ensureDb = (req, res, next) => {
    if (!pool) return res.status(503).json({ error: 'Database connection failed. Server is running but DB is unreachable.', details: dbError });
    next();
};

api.use(ensureDb);

// --- API HELPER ---
const parseRow = (row, jsonFields = []) => {
    if (!row) return row;
    const newRow = { ...row };
    const map = {
        'table_number': 'tableNumber', 'server_name': 'serverName', 'payment_status': 'paymentStatus', 'payment_method': 'paymentMethod',
        'created_at': 'createdAt', 'tax_rate': 'taxRate', 'price_at_order': 'priceAtOrder', 'menu_item_id': 'menuItemId',
        'category_id': 'categoryId', 'sub_category_id': 'subCategoryId', 'is_veg': 'isVeg', 'portion_prices': 'portionPrices',
        'unit_cost': 'unitCost', 'stock_quantity': 'stockQuantity', 'reported_by': 'reportedBy', 'ingredient_id': 'ingredientId',
        'ingredient_name': 'ingredientName', 'requested_by': 'requestedBy', 'requested_at': 'requestedAt',
        'estimated_unit_cost': 'estimatedUnitCost', 'preferred_supplier': 'preferredSupplier', 'loyalty_points': 'loyaltyPoints',
        'total_visits': 'totalVisits', 'last_visit': 'lastVisit', 'receipt_image': 'receiptImage'
    };
    const numericFields = ['price', 'unitCost', 'stockQuantity', 'tableNumber', 'taxRate', 'discount', 'quantity', 'priceAtOrder', 'loyaltyPoints', 'totalVisits', 'estimatedUnitCost'];
    const final = {};
    Object.keys(newRow).forEach(key => {
        const newKey = map[key] || key;
        let val = newRow[key];
        if (numericFields.includes(newKey) && val !== null && val !== undefined) val = Number(val);
        final[newKey] = val;
    });
    jsonFields.forEach(field => { if (final[field] && typeof final[field] === 'string') try { final[field] = JSON.parse(final[field]); } catch(e) { final[field] = null; } });
    if (final.isVeg !== undefined) final.isVeg = Boolean(final.isVeg);
    if (final.available !== undefined) final.available = Boolean(final.available);
    return final;
};


// 3. API Routes
api.get('/', (req, res) => res.json({ message: "Bihari Chatkara API Root" }));

// Auth - Login Endpoint
api.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const user = parseRow(rows[0], ['permissions']);
            delete user.password; // IMPORTANT: Do not send password back to client
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Orders (Optimized N+1 fix)
api.get('/orders', async (req, res) => {
    try {
        // 1. Fetch Orders
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
        const result = orders.map(o => parseRow(o));
        
        if (result.length === 0) {
            return res.json([]);
        }

        // 2. Fetch all related Items in one go
        const orderIds = result.map(o => o.id);
        // Create placeholders for IN clause (?,?,?)
        const placeholders = orderIds.map(() => '?').join(',');
        const [allItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
        
        // 3. Map items to orders
        const itemsMap = {};
        allItems.forEach(item => {
            const parsedItem = parseRow(item, ['modifiers']);
            if (!itemsMap[parsedItem.orderId]) {
                itemsMap[parsedItem.orderId] = [];
            }
            itemsMap[parsedItem.orderId].push(parsedItem);
        });

        // 4. Attach items to result
        result.forEach(order => {
            order.items = itemsMap[order.id] || [];
        });

        res.json(result);
    } catch (e) { 
        console.error("Order Fetch Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

api.post('/orders', async (req, res) => {
    const o = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('INSERT INTO orders (id, table_number, server_name, status, payment_status, payment_method, created_at, tax_rate, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [o.id, o.tableNumber, o.serverName, o.status, o.paymentStatus, o.paymentMethod, new Date(o.createdAt).toISOString(), o.taxRate, o.discount]);
        if (o.items?.length > 0) {
            for (const i of o.items) await connection.query('INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [i.id, o.id, i.menuItemId, i.name, i.quantity, i.priceAtOrder, i.portion, JSON.stringify(i.modifiers || [])]);
        }
        await connection.commit();
        res.json({ success: true });
    } catch (e) { await connection.rollback(); res.status(500).json({ error: e.message }); } finally { connection.release(); }
});
api.put('/orders/:id', async (req, res) => {
    const o = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE orders SET payment_status = ?, payment_method = ?, status = ?, discount = ?, tax_rate = ? WHERE id = ?', 
            [o.paymentStatus, o.paymentMethod, o.status, o.discount, o.taxRate, req.params.id]);
        if (o.items && Array.isArray(o.items)) {
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
            if (o.items.length > 0) {
                for (const i of o.items) {
                    await connection.query('INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                        [i.id, req.params.id, i.menuItemId, i.name, i.quantity, i.priceAtOrder, i.portion, JSON.stringify(i.modifiers || [])]
                    );
                }
            }
        }
        await connection.commit();
        res.json({ success: true });
    } catch (e) { await connection.rollback(); res.status(500).json({ error: e.message }); } finally { connection.release(); }
});
api.put('/orders/:id/status', async (req, res) => {
    try { await pool.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Menu
api.get('/menu-items', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM menu_items'); res.json(rows.map(r => parseRow(r, ['ingredients', 'portionPrices', 'tags']))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/menu-items', async (req, res) => {
    try { const i = req.body; await pool.query('INSERT INTO menu_items (id, category_id, sub_category_id, name, category, price, description, is_veg, available, ingredients, portion_prices, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.categoryId, i.subCategoryId, i.name, i.category, i.price, i.description, i.isVeg?1:0, i.available?1:0, JSON.stringify(i.ingredients), JSON.stringify(i.portionPrices), JSON.stringify(i.tags)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.put('/menu-items/:id', async (req, res) => {
    try { const i = req.body; await pool.query('UPDATE menu_items SET name=?, category=?, price=?, description=?, is_veg=?, available=?, ingredients=?, portion_prices=?, tags=? WHERE id=?', [i.name, i.category, i.price, i.description, i.isVeg?1:0, i.available?1:0, JSON.stringify(i.ingredients), JSON.stringify(i.portionPrices), JSON.stringify(i.tags), req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/menu-items/:id', async (req, res) => {
    try { await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ingredients
api.get('/ingredients', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM ingredients'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/ingredients', async (req, res) => {
    try { const i = req.body; await pool.query('INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)', [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.put('/ingredients/:id', async (req, res) => {
    try { const i = req.body; await pool.query('UPDATE ingredients SET name=?, category=?, unit=?, unit_cost=?, stock_quantity=? WHERE id=?', [i.name, i.category, i.unit, i.unitCost, i.stockQuantity, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/ingredients/:id', async (req, res) => {
    try { await pool.query('DELETE FROM ingredients WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Users
api.get('/users', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM users'); res.json(rows.map(r => parseRow(r, ['permissions']))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/users', async (req, res) => {
    try { const u = req.body; await pool.query('INSERT INTO users (id, name, email, role, permissions, password) VALUES (?, ?, ?, ?, ?, ?)', [u.id, u.name, u.email, u.role, JSON.stringify(u.permissions||[]), u.password]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/users/:id', async (req, res) => {
    try { await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expenses
api.get('/expenses', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM expenses'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/expenses', async (req, res) => {
    try { const e = req.body; await pool.query('INSERT INTO expenses (id, description, amount, category, date, reported_by, receipt_image) VALUES (?, ?, ?, ?, ?, ?, ?)', [e.id, e.description, e.amount, e.category, new Date(e.date).toISOString(), e.reportedBy, e.receiptImage || null]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.put('/expenses/:id', async (req, res) => {
    try { const e = req.body; await pool.query('UPDATE expenses SET description=?, amount=?, category=?, receipt_image=? WHERE id=?', [e.description, e.amount, e.category, e.receiptImage || null, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/expenses/:id', async (req, res) => {
    try { await pool.query('DELETE FROM expenses WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Requisitions
api.get('/requisitions', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM requisitions'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/requisitions', async (req, res) => {
    try { const r = req.body; await pool.query('INSERT INTO requisitions (id, ingredient_id, ingredient_name, quantity, unit, urgency, status, requested_by, requested_at, notes, estimated_unit_cost, preferred_supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.id, r.ingredientId, r.ingredientName, r.quantity, r.unit, r.urgency, r.status, r.requestedBy, new Date(r.requestedAt).toISOString(), r.notes, r.estimatedUnitCost, r.preferredSupplier]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.put('/requisitions/:id', async (req, res) => {
    try { await pool.query('UPDATE requisitions SET status=? WHERE id=?', [req.body.status, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customers
api.get('/customers', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM customers'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/customers', async (req, res) => {
    try { const c = req.body; await pool.query('INSERT INTO customers (id, name, phone, email, loyalty_points, total_visits, last_visit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [c.id, c.name, c.phone, c.email, c.loyaltyPoints, c.totalVisits, new Date(c.lastVisit).toISOString(), c.notes]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/customers/:id', async (req, res) => {
    try { await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mount API Router
app.use('/api', api);

// --- STATIC ASSETS ---
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/_')) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// --- START SERVER ---
const startServer = async () => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Boot] Server running on http://0.0.0.0:${PORT}`);
    });
    // Initialize DB in background with retries
    initDb(20, 3000); // 20 attempts, 3 seconds apart
};

startServer();
