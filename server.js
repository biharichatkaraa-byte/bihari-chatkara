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

// MySQL Connection Config
const DB_CONFIG = {
    host: process.env.DB_HOST || '34.131.187.182',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'chatkara',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000 
};

// --- SEED DATA ---
const SEED_INGREDIENTS = [
  { id: 'i1', name: 'Beef Patty (4oz)', category: 'Meat', unit: 'piece', unitCost: 60.00, stockQuantity: 200 },
  { id: 'i2', name: 'Brioche Bun', category: 'Bakery', unit: 'piece', unitCost: 15.00, stockQuantity: 150 },
  { id: 'i3', name: 'Cheddar Slice', category: 'Dairy', unit: 'slice', unitCost: 12.00, stockQuantity: 300 },
  { id: 'i4', name: 'Lettuce', category: 'Produce', unit: 'leaf', unitCost: 4.00, stockQuantity: 500 },
  { id: 'i5', name: 'Tomato', category: 'Produce', unit: 'slice', unitCost: 6.00, stockQuantity: 400 },
  { id: 'i6', name: 'French Fries', category: 'Frozen', unit: 'oz', unitCost: 8.00, stockQuantity: 1000 },
  { id: 'i7', name: 'Chicken Breast', category: 'Meat', unit: 'piece', unitCost: 75.00, stockQuantity: 80 },
  { id: 'i8', name: 'Pasta', category: 'Pantry', unit: 'oz', unitCost: 5.00, stockQuantity: 500 },
  { id: 'i9', name: 'Marinara Sauce', category: 'Pantry', unit: 'oz', unitCost: 10.00, stockQuantity: 300 },
];

const SEED_MENU_ITEMS = [
  {
    id: 'm1', categoryId: 'c1', subCategoryId: 'sc1', name: 'Classic Cheeseburger', category: 'Burgers',
    price: 349.00, portionPrices: { full: 349.00, half: 199.00 }, isVeg: false,
    ingredients: [{ ingredientId: 'i1', quantity: 1 }, { ingredientId: 'i2', quantity: 1 }, { ingredientId: 'i3', quantity: 1 }, { ingredientId: 'i4', quantity: 1 }, { ingredientId: 'i5', quantity: 2 }],
    description: 'Juicy beef patty with melted cheddar.', available: true, tags: ['Popular']
  },
  {
    id: 'm2', categoryId: 'c2', subCategoryId: 'sc2', name: 'Chicken Pasta', category: 'Mains',
    price: 429.00, portionPrices: { full: 429.00, half: 249.00, quarter: 149.00 }, isVeg: false,
    ingredients: [{ ingredientId: 'i7', quantity: 1 }, { ingredientId: 'i8', quantity: 6 }, { ingredientId: 'i9', quantity: 4 }],
    description: 'Grilled chicken over pasta with marinara.', available: true, tags: []
  },
  {
    id: 'm3', categoryId: 'c3', subCategoryId: 'sc3', name: 'Fries Basket', category: 'Sides',
    price: 149.00, portionPrices: { full: 149.00 }, isVeg: true,
    ingredients: [{ ingredientId: 'i6', quantity: 10 }],
    description: 'Crispy golden french fries.', available: true, tags: ['Vegan', 'GF']
  },
];

// --- APP INITIALIZATION ---
const app = express();
let pool = null;

// --- DATABASE INITIALIZATION ---
const initDb = async () => {
    try {
        console.log(`[DB] Attempting connection to MySQL at ${DB_CONFIG.host}...`);
        pool = mysql.createPool(DB_CONFIG);
        
        // Test connection
        const connection = await pool.getConnection();
        console.log(`[DB] MySQL Connected Successfully to '${DB_CONFIG.database}'.`);
        
        // Initialize Schema (Simplified for brevity, same tables as before)
        await connection.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), role VARCHAR(50), permissions TEXT)`);
        await connection.query(`CREATE TABLE IF NOT EXISTS menu_items (id VARCHAR(50) PRIMARY KEY, category_id VARCHAR(50), sub_category_id VARCHAR(50), name VARCHAR(100), category VARCHAR(100), price DECIMAL(10, 2), description TEXT, is_veg TINYINT(1), available TINYINT(1), ingredients TEXT, portion_prices TEXT, tags TEXT)`);
        await connection.query(`CREATE TABLE IF NOT EXISTS ingredients (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), category VARCHAR(100), unit VARCHAR(20), unit_cost DECIMAL(10, 2), stock_quantity DECIMAL(10, 2))`);
        await connection.query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(50) PRIMARY KEY, table_number INT, server_name VARCHAR(100), status VARCHAR(50), payment_status VARCHAR(50), payment_method VARCHAR(50), created_at VARCHAR(64), tax_rate DECIMAL(5, 2), discount DECIMAL(10, 2))`);
        await connection.query(`CREATE TABLE IF NOT EXISTS order_items (id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50), menu_item_id VARCHAR(50), name VARCHAR(100), quantity INT, price_at_order DECIMAL(10, 2), portion VARCHAR(50), modifiers TEXT, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)`);
        await connection.query(`CREATE TABLE IF NOT EXISTS expenses (id VARCHAR(50) PRIMARY KEY, description TEXT, amount DECIMAL(10, 2), category VARCHAR(100), date VARCHAR(64), reported_by VARCHAR(100))`);
        await connection.query(`CREATE TABLE IF NOT EXISTS requisitions (id VARCHAR(50) PRIMARY KEY, ingredient_id VARCHAR(50), ingredient_name VARCHAR(100), quantity DECIMAL(10, 2), unit VARCHAR(20), urgency VARCHAR(20), status VARCHAR(20), requested_by VARCHAR(100), requested_at VARCHAR(64), notes TEXT, estimated_unit_cost DECIMAL(10, 2), preferred_supplier VARCHAR(100))`);
        await connection.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), phone VARCHAR(20), email VARCHAR(100), loyalty_points INT, total_visits INT, last_visit VARCHAR(64), notes TEXT)`);

        // --- SEEDING LOGIC ---
        const [userRows] = await connection.query('SELECT count(*) as count FROM users');
        if (Number(userRows[0].count) === 0) {
            await connection.query('INSERT INTO users (id, name, email, role, permissions) VALUES (?, ?, ?, ?, ?)', ['u1', 'Administrator', 'admin@biharichatkara.com', 'Manager', '[]']);
        }
        const [ingRows] = await connection.query('SELECT count(*) as count FROM ingredients');
        if (Number(ingRows[0].count) === 0) {
            for (const i of SEED_INGREDIENTS) await connection.query('INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)', [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity]);
        }
        const [menuRows] = await connection.query('SELECT count(*) as count FROM menu_items');
        if (Number(menuRows[0].count) === 0) {
            for (const m of SEED_MENU_ITEMS) await connection.query(`INSERT INTO menu_items (id, category_id, sub_category_id, name, category, price, description, is_veg, available, ingredients, portion_prices, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [m.id, m.categoryId, m.subCategoryId, m.name, m.category, m.price, m.description, m.isVeg ? 1 : 0, m.available ? 1 : 0, JSON.stringify(m.ingredients), JSON.stringify(m.portionPrices), JSON.stringify(m.tags)]);
        }

        connection.release();
        console.log("[DB] Initialization and Seeding Complete.");
    } catch (e) {
        console.error("[DB] Critical Error initializing MySQL:", e.message);
        pool = null;
    }
};

// --- MIDDLEWARE ---
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// --- HEALTH HANDLER ---
const healthHandler = (req, res) => {
    if (!pool) {
        return res.status(503).json({
            status: 'error',
            message: 'Database not connected.',
            database: 'disconnected'
        });
    }
    res.json({
        status: 'ok',
        database: 'mysql',
        host: DB_CONFIG.host,
        timestamp: new Date().toISOString()
    });
};

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

// --- API ROUTER ---
const api = express.Router();

// 1. Health Check (Accessible without DB)
api.get('/health', healthHandler);

// 2. Database Guard Middleware
const ensureDb = (req, res, next) => {
    if (!pool) return res.status(503).json({ error: 'Database connection failed. Server is running but DB is unreachable.' });
    next();
};
api.use(ensureDb);

// 3. API Routes (Mounted on Router)
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
    try {
        const o = req.body;
        await pool.query('UPDATE orders SET payment_status = ?, payment_method = ?, status = ? WHERE id = ?', [o.paymentStatus, o.paymentMethod, o.status, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

// Mount the Router
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
        console.log(`[Boot] Server running new server  on http://0.0.0.0:${PORT}`);
    });
    initDb().then(() => console.log("[Boot] DB Ready")).catch(e => console.error("[Boot] DB Fail", e));
};

startServer();
