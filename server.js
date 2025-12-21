import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

const DB_CONFIG = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'chatkara',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

if (process.env.INSTANCE_CONNECTION_NAME) {
    DB_CONFIG.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
    delete DB_CONFIG.host;
    delete DB_CONFIG.port;
}

const app = express();
let pool = mysql.createPool(DB_CONFIG);
let isDbInitialized = false;

const initDb = async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`[DB] Attempting connection to '${DB_CONFIG.database}' at ${DB_CONFIG.host || 'Cloud Socket'}...`);
        
        // --- Tables Definition ---
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY, 
                name VARCHAR(100), 
                email VARCHAR(100), 
                role VARCHAR(50), 
                permissions TEXT, 
                password VARCHAR(100)
            )`,
            `CREATE TABLE IF NOT EXISTS menu_items (
                id VARCHAR(50) PRIMARY KEY, 
                category_id VARCHAR(50), 
                sub_category_id VARCHAR(50), 
                name VARCHAR(100), 
                category VARCHAR(100), 
                sub_category VARCHAR(100),
                price DECIMAL(10, 2), 
                description TEXT, 
                is_veg TINYINT(1), 
                available TINYINT(1) DEFAULT 1, 
                ingredients TEXT, 
                portion_prices TEXT, 
                tags TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS ingredients (
                id VARCHAR(50) PRIMARY KEY, 
                name VARCHAR(100), 
                category VARCHAR(100), 
                unit VARCHAR(20), 
                unit_cost DECIMAL(10, 2), 
                stock_quantity DECIMAL(10, 2),
                barcode VARCHAR(100)
            )`,
            `CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY, 
                table_number INT, 
                server_name VARCHAR(100), 
                status VARCHAR(50), 
                payment_status VARCHAR(50), 
                payment_method VARCHAR(50), 
                created_at VARCHAR(64), 
                completed_at VARCHAR(64),
                tax_rate DECIMAL(5, 2), 
                discount DECIMAL(10, 2)
            )`,
            `CREATE TABLE IF NOT EXISTS order_items (
                id VARCHAR(50) PRIMARY KEY, 
                order_id VARCHAR(50), 
                menu_item_id VARCHAR(50), 
                name VARCHAR(100), 
                quantity INT, 
                price_at_order DECIMAL(10, 2), 
                portion VARCHAR(50), 
                modifiers TEXT, 
                FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS expenses (
                id VARCHAR(50) PRIMARY KEY, 
                description TEXT, 
                amount DECIMAL(10, 2), 
                category VARCHAR(100), 
                date VARCHAR(64), 
                reported_by VARCHAR(100), 
                receipt_image LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS requisitions (
                id VARCHAR(50) PRIMARY KEY, 
                ingredient_id VARCHAR(50), 
                ingredient_name VARCHAR(100), 
                quantity DECIMAL(10, 2), 
                unit VARCHAR(20), 
                urgency VARCHAR(20), 
                status VARCHAR(20), 
                requested_by VARCHAR(100), 
                requested_at VARCHAR(64), 
                notes TEXT, 
                estimated_unit_cost DECIMAL(10, 2), 
                preferred_supplier VARCHAR(100)
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(50) PRIMARY KEY, 
                name VARCHAR(100), 
                phone VARCHAR(20), 
                email VARCHAR(100), 
                loyalty_points INT DEFAULT 0, 
                total_visits INT DEFAULT 0, 
                last_visit VARCHAR(64), 
                notes TEXT
            )`
        ];

        for (const query of tables) {
            await connection.query(query);
        }

        // Seeding default admin
        const [userRows] = await connection.query('SELECT count(*) as count FROM users');
        if (Number(userRows[0].count) === 0) {
            console.log("[DB] Seeding default administrator...");
            await connection.query(
                'INSERT INTO users (id, name, email, role, permissions, password) VALUES (?, ?, ?, ?, ?, ?)', 
                ['u1', 'Administrator', 'admin@biharichatkara.com', 'Manager', '[]', 'admin123']
            );
        }
        
        connection.release();
        isDbInitialized = true;
        console.log("[DB] Database fully initialized.");
    } catch (e) {
        console.error(`[DB] Fatal Error during init: ${e.message}`);
    }
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const parseRow = (row, jsonFields = []) => {
    if (!row) return row;
    const map = {
        'table_number': 'tableNumber', 'server_name': 'serverName', 'payment_status': 'paymentStatus', 'payment_method': 'paymentMethod',
        'created_at': 'createdAt', 'completed_at': 'completedAt', 'tax_rate': 'taxRate', 'price_at_order': 'priceAtOrder', 
        'menu_item_id': 'menuItemId', 'category_id': 'categoryId', 'sub_category_id': 'subCategoryId', 'sub_category': 'subCategory',
        'is_veg': 'isVeg', 'portion_prices': 'portionPrices', 'unit_cost': 'unitCost', 'stock_quantity': 'stockQuantity',
        'reported_by': 'reportedBy', 'ingredient_id': 'ingredientId', 'ingredient_name': 'ingredientName', 'requested_by': 'requestedBy',
        'requested_at': 'requestedAt', 'estimated_unit_cost': 'estimatedUnitCost', 'loyalty_points': 'loyaltyPoints',
        'total_visits': 'totalVisits', 'last_visit': 'lastVisit', 'receipt_image': 'receiptImage'
    };
    const numericFields = ['price', 'unitCost', 'stockQuantity', 'tableNumber', 'taxRate', 'discount', 'quantity', 'priceAtOrder', 'loyaltyPoints', 'totalVisits'];
    const final = {};
    Object.keys(row).forEach(key => {
        const newKey = map[key] || key;
        let val = row[key];
        if (numericFields.includes(newKey) && val !== null) val = Number(val);
        final[newKey] = val;
    });
    jsonFields.forEach(field => { 
        if (final[field]) {
            try { final[field] = JSON.parse(final[field]); } catch(e) { final[field] = []; } 
        }
    });
    if (final.isVeg !== undefined) final.isVeg = Boolean(final.isVeg);
    if (final.available !== undefined) final.available = Boolean(final.available);
    return final;
};

const api = express.Router();
api.get('/health', (req, res) => res.json({ status: isDbInitialized ? 'ok' : 'initializing' }));

api.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const user = parseRow(rows[0], ['permissions']);
            delete user.password; res.json({ success: true, user });
        } else res.status(401).json({ success: false, error: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

api.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
        const result = orders.map(o => parseRow(o));
        if (result.length > 0) {
            const [allItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (?)`, [result.map(o => o.id)]);
            const itemsMap = {};
            allItems.forEach(item => {
                const p = parseRow(item, ['modifiers']);
                if (!itemsMap[p.orderId]) itemsMap[p.orderId] = [];
                itemsMap[p.orderId].push(p);
            });
            result.forEach(order => order.items = itemsMap[order.id] || []);
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.post('/orders', async (req, res) => {
    const o = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            'INSERT INTO orders (id, table_number, server_name, status, payment_status, created_at, tax_rate, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [o.id, o.tableNumber, o.serverName, o.status, o.paymentStatus, new Date(o.createdAt).toISOString(), o.taxRate || 0, o.discount || 0]
        );
        for (const i of (o.items || [])) {
            await connection.query(
                'INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                [i.id, o.id, i.menuItemId, i.name, i.quantity, i.priceAtOrder, i.portion, JSON.stringify(i.modifiers || [])]
            );
        }
        await connection.commit(); res.json({ success: true });
    } catch (e) { await connection.rollback(); res.status(500).json({ error: e.message }); } finally { connection.release(); }
});

api.put('/orders/:id', async (req, res) => {
    const o = req.body;
    try {
        const completedAt = o.completedAt ? new Date(o.completedAt).toISOString() : null;
        await pool.query(
            'UPDATE orders SET status = ?, payment_status = ?, payment_method = ?, completed_at = ?, discount = ?, tax_rate = ? WHERE id = ?', 
            [o.status, o.paymentStatus, o.paymentMethod, completedAt, o.discount || 0, o.taxRate || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.get('/menu-items', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM menu_items'); 
        res.json(rows.map(r => parseRow(r, ['ingredients', 'portionPrices', 'tags']))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.get('/ingredients', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM ingredients'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.get('/users', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM users'); 
        res.json(rows.map(r => parseRow(r, ['permissions']))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.get('/expenses', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM expenses ORDER BY date DESC'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.get('/requisitions', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY requested_at DESC'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.get('/customers', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM customers'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.use('/api', api);

// Production Static Handler
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
}

initDb().then(() => {
    app.listen(PORT, () => console.log(`[RMS Server] Online at http://localhost:${PORT}`));
});