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

    if (process.env.INSTANCE_CONNECTION_NAME) {
        config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
        console.log(`[DB Config] Using Cloud SQL Socket: ${config.socketPath}`);
    } else if (process.env.DB_HOST && process.env.DB_HOST.includes(':') && !process.env.DB_HOST.includes('.')) {
         config.socketPath = `/cloudsql/${process.env.DB_HOST}`;
         console.log(`[DB Config] Inferred Socket from DB_HOST: ${config.socketPath}`);
    } else {
        config.host = process.env.DB_HOST || '127.0.0.1';
        config.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
        console.log(`[DB Config] Using TCP Host: ${config.host}:${config.port}`);
    }

    return config;
};

const DB_CONFIG = getDbConfig();

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
            console.debug(`[DB] Attempting connection (Attempt ${i + 1}/${retries})...`);
            
            // Test connection
            const connection = await pool.getConnection();
            console.debug(`[DB] MySQL Connected Successfully to '${DB_CONFIG.database}'.`);
            
            // 1. Users Table
            await connection.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), role VARCHAR(50), permissions TEXT, password VARCHAR(100))`);
            const [userCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'password'`);
            if (userCols.length === 0) await connection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(100)`);

            // 2. Menu Items Table
            await connection.query(`CREATE TABLE IF NOT EXISTS menu_items (id VARCHAR(50) PRIMARY KEY, category_id VARCHAR(50), sub_category_id VARCHAR(50), name VARCHAR(100), category VARCHAR(100), sub_category VARCHAR(100), price DECIMAL(10, 2), description TEXT, is_veg TINYINT(1), available TINYINT(1), ingredients TEXT, portion_prices TEXT, tags TEXT)`);
            const [menuCols] = await connection.query(`SHOW COLUMNS FROM menu_items LIKE 'sub_category'`);
            if (menuCols.length === 0) await connection.query(`ALTER TABLE menu_items ADD COLUMN sub_category VARCHAR(100)`);

            // 3. Ingredients Table
            await connection.query(`CREATE TABLE IF NOT EXISTS ingredients (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(100), unit VARCHAR(20), unit_cost DECIMAL(10, 2), stock_quantity DECIMAL(10, 2), barcode VARCHAR(100))`);
            const [ingCols] = await connection.query(`SHOW COLUMNS FROM ingredients LIKE 'barcode'`);
            if (ingCols.length === 0) await connection.query(`ALTER TABLE ingredients ADD COLUMN barcode VARCHAR(100)`);

            // 4. Orders Table
            await connection.query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(50) PRIMARY KEY, table_number INT, server_name VARCHAR(100), status VARCHAR(50), payment_status VARCHAR(50), payment_method VARCHAR(50), created_at VARCHAR(64), completed_at VARCHAR(64), tax_rate DECIMAL(5, 2), discount DECIMAL(10, 2))`);
            const [ordCols] = await connection.query(`SHOW COLUMNS FROM orders LIKE 'completed_at'`);
            if (ordCols.length === 0) await connection.query(`ALTER TABLE orders ADD COLUMN completed_at VARCHAR(64)`);

            // 5. Order Items Table
            await connection.query(`CREATE TABLE IF NOT EXISTS order_items (id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50), menu_item_id VARCHAR(50), name VARCHAR(100), quantity INT, price_at_order DECIMAL(10, 2), portion VARCHAR(50), modifiers TEXT, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)`);
            const [orderItemCols] = await connection.query(`SHOW COLUMNS FROM order_items LIKE 'price_at_order'`);
            if (orderItemCols.length === 0) await connection.query(`ALTER TABLE order_items ADD COLUMN price_at_order DECIMAL(10, 2) DEFAULT 0`);

            // 6. Expenses table
            await connection.query(`CREATE TABLE IF NOT EXISTS expenses (id VARCHAR(50) PRIMARY KEY, description TEXT, amount DECIMAL(10, 2), category VARCHAR(100), date VARCHAR(64), reported_by VARCHAR(100))`);
            const [expenseCols] = await connection.query(`SHOW COLUMNS FROM expenses LIKE 'receipt_image'`);
            if (expenseCols.length === 0) {
                await connection.query(`ALTER TABLE expenses ADD COLUMN receipt_image LONGTEXT`);
            }

            // 7. Requisitions Table
            await connection.query(`CREATE TABLE IF NOT EXISTS requisitions (id VARCHAR(50) PRIMARY KEY, ingredient_id VARCHAR(50), ingredient_name VARCHAR(100), quantity DECIMAL(10, 2), unit VARCHAR(20), urgency VARCHAR(20), status VARCHAR(20), requested_by VARCHAR(100), requested_at VARCHAR(64), notes TEXT, estimated_unit_cost DECIMAL(10, 2), preferred_supplier VARCHAR(100))`);
            
            // 8. Customers Table
            await connection.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), phone VARCHAR(20), email VARCHAR(100), loyalty_points INT, total_visits INT, last_visit VARCHAR(64), notes TEXT)`);

            // --- SEEDING ---
            const [userRows] = await connection.query('SELECT count(*) as count FROM users');
            if (Number(userRows[0].count) === 0) {
                console.log("[DB] Seeding Default Admin User...");
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@biharichatkara.com';
                const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
                await connection.query('INSERT INTO users (id, name, email, role, permissions, password) VALUES (?, ?, ?, ?, ?, ?)', ['u1', 'Administrator', adminEmail, 'Manager', '[]', adminPass]);
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
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));

// --- HEALTH HANDLER ---
const healthHandler = async (req, res) => {
    if (!isDbInitialized) {
        try {
            const conn = await pool.getConnection();
            conn.release();
             res.json({ status: 'starting', database: 'mysql', message: 'Database connecting...', details: dbError });
            return;
        } catch (e) {
             return res.status(503).json({ status: 'error', message: 'Database not connected.', details: dbError || e.message });
        }
    }
    res.json({ status: 'ok', database: 'mysql', timestamp: new Date().toISOString() });
};

// --- API ROUTER ---
const api = express.Router();
api.get('/health', healthHandler);

const ensureDb = (req, res, next) => {
    if (!pool) return res.status(503).json({ error: 'Database connection failed.', details: dbError });
    next();
};
api.use(ensureDb);

const parseRow = (row, jsonFields = []) => {
    if (!row) return row;
    const newRow = { ...row };
    const map = {
        'table_number': 'tableNumber', 'server_name': 'serverName', 'payment_status': 'paymentStatus', 'payment_method': 'paymentMethod',
        'created_at': 'createdAt', 'completed_at': 'completedAt', 'tax_rate': 'taxRate', 'price_at_order': 'priceAtOrder', 
        'menu_item_id': 'menuItemId',
        'category_id': 'categoryId', 'sub_category_id': 'subCategoryId', 'sub_category': 'subCategory', 'is_veg': 'isVeg', 'portion_prices': 'portionPrices',
        'unit_cost': 'unitCost', 'stock_quantity': 'stockQuantity', 'reported_by': 'reportedBy', 'ingredient_id': 'ingredientId',
        'ingredient_name': 'ingredientName', 'requested_by': 'requestedBy', 'requested_at': 'requestedAt',
        'estimated_unit_cost': 'estimatedUnitCost', 'preferred_supplier': 'preferredSupplier', 'loyalty_points': 'loyaltyPoints',
        'total_visits': 'totalVisits', 'last_visit': 'lastVisit', 'receipt_image': 'receiptImage', 'barcode': 'barcode'
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

// Auth
api.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const user = parseRow(rows[0], ['permissions']);
            delete user.password; 
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Orders
api.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
        const result = orders.map(o => parseRow(o));
        if (result.length === 0) return res.json([]);

        const orderIds = result.map(o => o.id);
        const placeholders = orderIds.map(() => '?').join(',');
        const [allItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
        
        const itemsMap = {};
        allItems.forEach(item => {
            const parsedItem = parseRow(item, ['modifiers']);
            if (!itemsMap[parsedItem.orderId]) itemsMap[parsedItem.orderId] = [];
            itemsMap[parsedItem.orderId].push(parsedItem);
        });

        result.forEach(order => {
            order.items = itemsMap[order.id] || [];
        });

        res.json(result);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

api.post('/orders', async (req, res) => {
    const o = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const completedAt = o.completedAt ? new Date(o.completedAt).toISOString() : null;
        await connection.query('INSERT INTO orders (id, table_number, server_name, status, payment_status, payment_method, created_at, completed_at, tax_rate, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [o.id, o.tableNumber, o.serverName, o.status, o.paymentStatus, o.paymentMethod, new Date(o.createdAt).toISOString(), completedAt, o.taxRate, o.discount]);
        if (o.items?.length > 0) {
            for (const i of o.items) await connection.query('INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [i.id, o.id, i.menuItemId, i.name, i.quantity, Number(i.priceAtOrder || 0), i.portion, JSON.stringify(i.modifiers || [])]);
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
        const completedAt = o.completedAt ? new Date(o.completedAt).toISOString() : null;
        await connection.query('UPDATE orders SET payment_status = ?, payment_method = ?, status = ?, discount = ?, tax_rate = ?, completed_at = ? WHERE id = ?', 
            [o.paymentStatus, o.paymentMethod, o.status, o.discount, o.taxRate, completedAt, req.params.id]);
        if (o.items && Array.isArray(o.items)) {
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
            if (o.items.length > 0) {
                for (const i of o.items) {
                    await connection.query('INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                        [i.id, req.params.id, i.menuItemId, i.name, i.quantity, Number(i.priceAtOrder || 0), i.portion, JSON.stringify(i.modifiers || [])]
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
api.get('/menu-items', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM menu_items'); res.json(rows.map(r => parseRow(r, ['ingredients', 'portionPrices', 'tags']))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/menu-items', async (req, res) => { try { const i = req.body; await pool.query('INSERT INTO menu_items (id, category_id, sub_category_id, name, category, sub_category, price, description, is_veg, available, ingredients, portion_prices, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [i.id, i.categoryId, i.subCategoryId, i.name, i.category, i.subCategory, i.price, i.description, i.isVeg?1:0, i.available?1:0, JSON.stringify(i.ingredients), JSON.stringify(i.portionPrices), JSON.stringify(i.tags)]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.put('/menu-items/:id', async (req, res) => { try { const i = req.body; await pool.query('UPDATE menu_items SET name=?, category=?, sub_category=?, price=?, description=?, is_veg=?, available=?, ingredients=?, portion_prices=?, tags=? WHERE id=?', [i.name, i.category, i.subCategory, i.price, i.description, i.isVeg?1:0, i.available?1:0, JSON.stringify(i.ingredients), JSON.stringify(i.portionPrices), JSON.stringify(i.tags), req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.delete('/menu-items/:id', async (req, res) => { try { await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// Ingredients
api.get('/ingredients', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM ingredients'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/ingredients', async (req, res) => { try { const i = req.body; await pool.query('INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)', [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity, i.barcode || '']); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.put('/ingredients/:id', async (req, res) => { try { const i = req.body; await pool.query('UPDATE ingredients SET name=?, category=?, unit=?, unit_cost=?, stock_quantity=?, barcode=? WHERE id=?', [i.name, i.category, i.unit, i.unitCost, i.stockQuantity, i.barcode || '', req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.delete('/ingredients/:id', async (req, res) => { try { await pool.query('DELETE FROM ingredients WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// Users
api.get('/users', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM users'); res.json(rows.map(r => parseRow(r, ['permissions']))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/users', async (req, res) => { try { const u = req.body; await pool.query('INSERT INTO users (id, name, email, role, permissions, password) VALUES (?, ?, ?, ?, ?, ?)', [u.id, u.name, u.email, u.role, JSON.stringify(u.permissions || []), u.password]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.delete('/users/:id', async (req, res) => { try { await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// Expenses
api.get('/expenses', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM expenses ORDER BY date DESC'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/expenses', async (req, res) => { try { const e = req.body; await pool.query('INSERT INTO expenses (id, description, amount, category, date, reported_by, receipt_image) VALUES (?, ?, ?, ?, ?, ?, ?)', [e.id, e.description, e.amount, e.category, new Date(e.date).toISOString(), e.reportedBy, e.receiptImage]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.put('/expenses/:id', async (req, res) => { try { const e = req.body; await pool.query('UPDATE expenses SET description=?, amount=?, category=?, date=?, receipt_image=? WHERE id=?', [e.description, e.amount, e.category, new Date(e.date).toISOString(), e.receiptImage, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.delete('/expenses/:id', async (req, res) => { try { await pool.query('DELETE FROM expenses WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// Requisitions
api.get('/requisitions', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY requested_at DESC'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/requisitions', async (req, res) => { try { const r = req.body; await pool.query('INSERT INTO requisitions (id, ingredient_id, ingredient_name, quantity, unit, urgency, status, requested_by, requested_at, notes, estimated_unit_cost, preferred_supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.id, r.ingredientId, r.ingredientName, r.quantity, r.unit, r.urgency, r.status, r.requestedBy, new Date(r.requestedAt).toISOString(), r.notes, r.estimatedUnitCost, r.preferredSupplier]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.put('/requisitions/:id', async (req, res) => { try { const r = req.body; await pool.query('UPDATE requisitions SET status=? WHERE id=?', [r.status, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// Customers
api.get('/customers', async (req, res) => { try { const [rows] = await pool.query('SELECT * FROM customers'); res.json(rows.map(r => parseRow(r))); } catch (e) { res.status(500).json({ error: e.message }); } });
api.post('/customers', async (req, res) => { try { const c = req.body; await pool.query('INSERT INTO customers (id, name, phone, email, loyalty_points, total_visits, last_visit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [c.id, c.name, c.phone, c.email, c.loyaltyPoints, c.totalVisits, new Date(c.lastVisit).toISOString(), c.notes]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
api.delete('/customers/:id', async (req, res) => { try { await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// --- SERVER START ---
app.use('/api', api);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
}

initDb().then(() => {
    app.listen(PORT, () => console.log(`[Server] Running on http://localhost:${PORT}`));
});