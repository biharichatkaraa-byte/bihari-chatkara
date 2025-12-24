/**
 * DATABASE SERVICE (MySQL / API Adapter)
 * 
 * This service acts as the client-side bridge to your Backend API.
 * It manages the connection state and switches between Cloud (API) and Local (LocalStorage) modes.
 */

// --- CONFIGURATION ---

export const DEFAULT_CLOUD_URL = ""; 

const SEED_LOCAL_ADMIN = { 
  id: 'u1', 
  name: 'Administrator', 
  email: 'admin@biharichatkara.com', 
  role: 'Manager', 
  password: 'admin123',
  permissions: [] 
};

// --- HELPERS ---
const sanitizeUrl = (url: string) => {
    let clean = url.trim().replace(/\/+$/, "");
    const commonSuffixes = ['/api/health', '/health', '/ping', '/_status', '/api'];
    for (const suffix of commonSuffixes) {
        if (clean.endsWith(suffix)) {
            clean = clean.substring(0, clean.length - suffix.length);
        }
    }
    return clean.replace(/\/+$/, "");
}

let storedUrl = "";
try {
    storedUrl = localStorage.getItem('rms_api_url') || "";
} catch (e) {
    console.warn("LocalStorage access denied.");
}

if (storedUrl) {
    const clean = sanitizeUrl(storedUrl);
    if (clean !== storedUrl) {
        try {
            localStorage.setItem('rms_api_url', clean);
        } catch(e) {}
        storedUrl = clean;
    }
}

let API_BASE_URL: string | null = storedUrl || (DEFAULT_CLOUD_URL ? DEFAULT_CLOUD_URL : null);
let isLive = false; 
let activeWriteCount = 0; 

export const isDatabaseLive = () => isLive;

export const getApiUrl = () => {
    return API_BASE_URL ? API_BASE_URL.replace(/\/+$/, "") : null;
};

// --- INITIALIZATION ---

const initializeConnection = async () => {
    if (API_BASE_URL) {
        const health = await checkHealth(API_BASE_URL);
        if (health.ok) {
            isLive = true;
            window.dispatchEvent(new Event('db-connection-changed'));
            return;
        }
    }

    const candidates = ['', 'http://localhost:8080'];
    
    for (const url of candidates) {
        const health = await checkHealth(url);
        if (health.ok) {
            API_BASE_URL = url;
            try { if (url) localStorage.setItem('rms_api_url', url); } catch(e) {}
            isLive = true;
            window.dispatchEvent(new Event('db-connection-changed'));
            return;
        }
    }

    isLive = false;
    window.dispatchEvent(new Event('db-connection-changed'));
};

export const checkHealth = async (baseUrl: string | null = API_BASE_URL): Promise<{ ok: boolean; message: string, lastUrl?: string }> => {
  const targetUrl = baseUrl === null ? '' : baseUrl.replace(/\/+$/, "");
  const endpoints = ['/api/health', '/health', '/ping', '/_status', '/'];

  for (const path of endpoints) {
      const fullUrl = targetUrl ? `${targetUrl}${path}` : path;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(fullUrl, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (response.ok) return { ok: true, message: "Connected" };
      } catch (e) {}
  }
  return { ok: false, message: "API Offline", lastUrl: targetUrl + '/api/health' };
};

export const setApiUrl = async (url: string) => {
    const cleanUrl = sanitizeUrl(url);
    if (!cleanUrl) return { success: false, error: "URL cannot be empty" };
    const health = await checkHealth(cleanUrl);
    if (health.ok) {
        API_BASE_URL = cleanUrl;
        try { localStorage.setItem('rms_api_url', cleanUrl); } catch(e) {}
        isLive = true;
        window.dispatchEvent(new Event('db-connection-changed'));
        return { success: true };
    }
    return { success: false, error: health.message };
};

export const disconnect = () => {
    try { localStorage.removeItem('rms_api_url'); } catch(e) {}
    API_BASE_URL = null;
    isLive = false;
    window.dispatchEvent(new Event('db-connection-changed'));
};

initializeConnection();

// --- DATA SERVICE API ---

type CollectionName = 'orders' | 'menuItems' | 'ingredients' | 'users' | 'expenses' | 'requisitions' | 'customers';

const ENDPOINTS: Record<CollectionName, string> = {
    'orders': '/api/orders',
    'menuItems': '/api/menu-items',
    'ingredients': '/api/ingredients',
    'users': '/api/users',
    'expenses': '/api/expenses',
    'requisitions': '/api/requisitions',
    'customers': '/api/customers'
};

const getUrl = (endpoint: string) => {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, "") : "";
    return `${base}${endpoint}`;
}

export const loginUser = async (email: string, password: string): Promise<{ success: boolean, user?: any, error?: string }> => {
    if (isLive) {
        try {
            const res = await fetch(getUrl('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                mode: 'cors'
            });
            const data = await res.json();
            if (res.ok && data.success) return { success: true, user: data.user };
            return { success: false, error: data.error || 'Login failed' };
        } catch (e) {
            return { success: false, error: 'Network error' };
        }
    } else {
        let users = [];
        try {
            const saved = localStorage.getItem('rms_users');
            users = saved ? JSON.parse(saved) : [];
        } catch(e) {}
        
        if (users.length === 0) {
            users = [SEED_LOCAL_ADMIN];
            try { localStorage.setItem('rms_users', JSON.stringify(users)); } catch(e) {}
        }

        const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (user) return { success: true, user };
        return { success: false, error: 'Invalid credentials' };
    }
};

export const subscribeToCollection = (
  colName: CollectionName, 
  callback: (data: any[]) => void, 
  fallbackData: any[] = []
): () => void => {
  if (isLive) {
    const endpoint = ENDPOINTS[colName];
    let isSubscribed = true;
    const fetchData = async () => {
        if (!isSubscribed || activeWriteCount > 0) return;
        try {
            const res = await fetch(getUrl(endpoint), { mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                callback(data.map((item: any) => hydrateDates(item)));
            }
        } catch (e) {}
    };
    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    const handleFocus = () => { if (isSubscribed) fetchData(); };
    window.addEventListener('focus', handleFocus);
    const handleForceRefresh = (e: any) => { if (e.detail?.colName === colName || e.detail?.colName === 'all') setTimeout(fetchData, 50); };
    window.addEventListener('rms-force-refresh', handleForceRefresh);
    return () => { isSubscribed = false; clearInterval(intervalId); window.removeEventListener('focus', handleFocus); window.removeEventListener('rms-force-refresh', handleForceRefresh); };
  } else {
    loadFromLocal(colName, callback, fallbackData);
    const handleCustomUpdate = (e: any) => { if (e.detail?.collection === colName) loadFromLocal(colName, callback, fallbackData); };
    const handleStorageChange = (e: StorageEvent) => { if (e.key === `rms_${colName}`) loadFromLocal(colName, callback, fallbackData); };
    window.addEventListener('rms-local-update', handleCustomUpdate);
    window.addEventListener('storage', handleStorageChange);
    return () => { window.removeEventListener('rms-local-update', handleCustomUpdate); window.removeEventListener('storage', handleStorageChange); };
  }
};

const hydrateDates = (obj: any): any => {
    if (!obj) return obj;
    const newObj = { ...obj };
    for (const key in newObj) {
        if ((key.endsWith('At') || key === 'date' || key === 'lastVisit' || key === 'startTime' || key === 'endTime') && typeof newObj[key] === 'string') {
            try { newObj[key] = new Date(newObj[key]); } catch(e) {}
        }
    }
    return newObj;
};

const loadFromLocal = (colName: string, callback: (data: any[]) => void, fallbackData: any[]) => {
  try {
    const saved = localStorage.getItem(`rms_${colName}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      callback(parsed.map((i: any) => hydrateDates(i)));
    } else {
      if (colName === 'users') {
          const seededData = [SEED_LOCAL_ADMIN];
          localStorage.setItem(`rms_${colName}`, JSON.stringify(seededData));
          callback(seededData);
          return;
      }
      localStorage.setItem(`rms_${colName}`, JSON.stringify(fallbackData));
      callback(fallbackData);
    }
  } catch (e) {
    callback(fallbackData);
  }
};

const saveToLocal = (colName: string, item: any, action: 'add' | 'update' | 'delete') => {
  const key = `rms_${colName}`;
  let current = [];
  try {
      const currentStr = localStorage.getItem(key);
      current = currentStr ? JSON.parse(currentStr) : [];
  } catch(e) {}

  if (action === 'add') current = [item, ...current];
  else if (action === 'update') current = current.map((i: any) => i.id === item.id ? item : i);
  else if (action === 'delete') current = current.filter((i: any) => i.id !== item.id);

  try {
      localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('rms-local-update', { detail: { collection: colName } }));
  } catch(e) {}
};

export const addItem = async (colName: CollectionName, item: any) => {
    if (isLive) { activeWriteCount++; try { await fetch(getUrl(ENDPOINTS[colName]), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item), mode: 'cors' }); window.dispatchEvent(new CustomEvent('rms-force-refresh', { detail: { colName } })); } finally { activeWriteCount--; } }
    else saveToLocal(colName, item, 'add');
};

export const updateItem = async (colName: CollectionName, item: any) => {
    if (isLive) { activeWriteCount++; try { await fetch(getUrl(`${ENDPOINTS[colName]}/${item.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item), mode: 'cors' }); window.dispatchEvent(new CustomEvent('rms-force-refresh', { detail: { colName } })); } finally { activeWriteCount--; } }
    else saveToLocal(colName, item, 'update');
};

export const deleteItem = async (colName: CollectionName, itemId: string) => {
    if (isLive) { activeWriteCount++; try { await fetch(getUrl(`${ENDPOINTS[colName]}/${itemId}`), { method: 'DELETE', mode: 'cors' }); window.dispatchEvent(new CustomEvent('rms-force-refresh', { detail: { colName } })); } finally { activeWriteCount--; } }
    else saveToLocal(colName, { id: itemId }, 'delete');
};

export const bulkUpdateItems = async (colName: CollectionName, items: any[]) => {
    if (!isLive) { items.forEach(i => saveToLocal(colName, i, 'update')); }
    else { activeWriteCount++; try { await Promise.all(items.map(i => updateItem(colName, i))); } finally { activeWriteCount--; } }
};

export const bulkAddItems = async (colName: CollectionName, items: any[]) => {
    if (!isLive) { items.forEach(i => saveToLocal(colName, i, 'add')); }
    else { activeWriteCount++; try { await Promise.all(items.map(i => addItem(colName, i))); } finally { activeWriteCount--; } }
};

export const bulkDeleteItems = async (colName: CollectionName, ids: string[]) => {
    if (!isLive) { ids.forEach(id => saveToLocal(colName, {id}, 'delete')); }
    else { activeWriteCount++; try { await Promise.all(ids.map(id => deleteItem(colName, id))); } finally { activeWriteCount--; } }
};