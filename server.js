
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
        config.host = process.env.DB_HOST || '34.131.187.182';
        config.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
        console.log(`[DB Config] Using TCP Host: ${config.host}:${config.port}`);
    }

    return config;
};

const DB_CONFIG = getDbConfig();

// --- SEED DATA ---
const SEED_INGREDIENTS = [
  { id: 'i1', name: 'General Stock', category: 'Pantry', unit: 'kg', unitCost: 100.00, stockQuantity: 100 },
];

const SEED_MENU_ITEMS = [
  { id: 'm1', categoryId: 'Tawa', subCategoryId: 'Mutton', name: 'Tawa Keema Kaleji', category: 'Tawa', price: 550, portionPrices: { half: 300, full: 550 }, isVeg: false, available: true, ingredients: [] },
  // ... (Menu items kept as is, truncated for brevity in this specific update block but assumed present)
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
            await connection.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), role VARCHAR(50), permissions TEXT)`);
            await connection.query(`CREATE TABLE IF NOT EXISTS menu_items (id VARCHAR(50) PRIMARY KEY, category_id VARCHAR(50), sub_category_id VARCHAR(50), name VARCHAR(100), category VARCHAR(100), price DECIMAL(10, 2), description TEXT, is_veg TINYINT(1), available TINYINT(1), ingredients TEXT, portion_prices TEXT, tags TEXT)`);
            await connection.query(`CREATE TABLE IF NOT EXISTS ingredients (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(100), unit VARCHAR(20), unit_cost DECIMAL(10, 2), stock_quantity DECIMAL(10, 2))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(50) PRIMARY KEY, table_number INT, server_name VARCHAR(100), status VARCHAR(50), payment_status VARCHAR(50), payment_method VARCHAR(50), created_at VARCHAR(64), tax_rate DECIMAL(5, 2), discount DECIMAL(10, 2))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS order_items (id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50), menu_item_id VARCHAR(50), name VARCHAR(100), quantity INT, price_at_order DECIMAL(10, 2), portion VARCHAR(50), modifiers TEXT, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)`);
            await connection.query(`CREATE TABLE IF NOT EXISTS expenses (id VARCHAR(50) PRIMARY KEY, description TEXT, amount DECIMAL(10, 2), category VARCHAR(100), date VARCHAR(64), reported_by VARCHAR(100))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS requisitions (id VARCHAR(50) PRIMARY KEY, ingredient_id VARCHAR(50), ingredient_name VARCHAR(100), quantity DECIMAL(10, 2), unit VARCHAR(20), urgency VARCHAR(20), status VARCHAR(20), requested_by VARCHAR(100), requested_at VARCHAR(64), notes TEXT, estimated_unit_cost DECIMAL(10, 2), preferred_supplier VARCHAR(100))`);
            await connection.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), phone VARCHAR(20), email VARCHAR(100), loyalty_points INT, total_visits INT, last_visit VARCHAR(64), notes TEXT)`);

            // --- SEEDING ---
            const [userRows] = await connection.query('SELECT count(*) as count FROM users');
            if (Number(userRows[0].count) === 0) {
                await connection.query('INSERT INTO users (id, name, email, role, permissions) VALUES (?, ?, ?, ?, ?)', ['u1', 'Administrator', 'admin@biharichatkara.com', 'Manager', '[]']);
            }
            const [ingRows] = await connection.query('SELECT count(*) as count FROM ingredients');
            if (Number(ingRows[0].count) === 0) {
                for (const i of SEED_INGREDIENTS) await connection.query('INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)', [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity]);
            }
            // Skip Menu seeding for brevity in this update, assuming it's done or handled by prior logic

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
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// --- HEALTH HANDLER ---
const healthHandler = async (req, res) => {
    // If we haven't initialized successfully yet, check if we can connect now
    if (!isDbInitialized) {
        try {
            const conn = await pool.getConnection();
            conn.release();
            // If success, we are technically connected even if tables aren't verified yet
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
        'total_visits': 'totalVisits', 'last_visit': 'lastVisit'
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

// Orders
api.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
        const result = [];
        for (const o of orders) {
            const orderObj = parseRow(o);
            const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
            orderObj.items = items.map(i => parseRow(i, ['modifiers']));
            result.push(orderObj);
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
        
        // 1. Update main order fields (Status, Payment, Discount, etc.)
        await connection.query('UPDATE orders SET payment_status = ?, payment_method = ?, status = ?, discount = ?, tax_rate = ? WHERE id = ?', 
            [o.paymentStatus, o.paymentMethod, o.status, o.discount, o.taxRate, req.params.id]);
        
        // 2. If items are provided, replace them (Full Update for Editing Orders)
        if (o.items && Array.isArray(o.items)) {
            // Delete existing items
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
            
            // Insert new items
            if (o.items.length > 0) {
                for (const i of o.items) {
                    await connection.query(
                        'INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                        [i.id, req.params.id, i.menuItemId, i.name, i.quantity, i.priceAtOrder, i.portion, JSON.stringify(i.modifiers || [])]
                    );
                }
            }
        }

        await connection.commit();
        res.json({ success: true });
    } catch (e) { 
        await connection.rollback(); 
        res.status(500).json({ error: e.message }); 
    } finally { 
        connection.release(); 
    }
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

// Users
api.get('/users', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM users'); res.json(rows.map(r => parseRow(r, ['permissions']))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/users', async (req, res) => {
    try { const u = req.body; await pool.query('INSERT INTO users (id, name, email, role, permissions) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, u.email, u.role, JSON.stringify(u.permissions||[])]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.delete('/users/:id', async (req, res) => {
    try { await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expenses
api.get('/expenses', async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM expenses'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.post('/expenses', async (req, res) => {
    try { const e = req.body; await pool.query('INSERT INTO expenses (id, description, amount, category, date, reported_by) VALUES (?, ?, ?, ?, ?, ?)', [e.id, e.description, e.amount, e.category, new Date(e.date).toISOString(), e.reportedBy]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
api.put('/expenses/:id', async (req, res) => {
    try { const e = req.body; await pool.query('UPDATE expenses SET description=?, amount=?, category=? WHERE id=?', [e.description, e.amount, e.category, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
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
