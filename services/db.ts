
/**
 * DATABASE SERVICE (MySQL / API Adapter)
 * 
 * This service acts as the client-side bridge to your Backend API.
 * It manages the connection state and switches between Cloud (API) and Local (LocalStorage) modes.
 */

// --- CONFIGURATION ---

// [OPTIONAL] Paste your Cloud Run / App Engine URL here to force a default connection
export const DEFAULT_CLOUD_URL = ""; 

// Internal Seed Data for Local Mode (matches server.js seeding)
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

// Internal storage for the base URL
// CRITICAL: Sanitize immediately on load to prevent loops with bad URLs
let storedUrl = localStorage.getItem('rms_api_url');
if (storedUrl) {
    const clean = sanitizeUrl(storedUrl);
    if (clean !== storedUrl) {
        console.log(`[DB] Sanitizing stored URL from '${storedUrl}' to '${clean}'`);
        localStorage.setItem('rms_api_url', clean);
        storedUrl = clean;
    }
}

let API_BASE_URL: string | null = storedUrl || (DEFAULT_CLOUD_URL ? DEFAULT_CLOUD_URL : null);
let isLive = false; 
// WRITE LOCK: Prevents polling from overwriting optimistic UI updates while a write is in flight
let activeWriteCount = 0; 

export const isDatabaseLive = () => isLive;

export const getApiUrl = () => {
    // Return cleaned URL
    return API_BASE_URL ? API_BASE_URL.replace(/\/+$/, "") : null;
};

// --- INITIALIZATION ---

const initializeConnection = async () => {
    // 1. If we have a saved URL, try it first
    if (API_BASE_URL) {
        console.log(`[DB] Testing configured URL: ${API_BASE_URL}`);
        
        const health = await checkHealth(API_BASE_URL);
        if (health.ok) {
            console.log("[DB] Connection established via configured URL");
            isLive = true;
            window.dispatchEvent(new Event('db-connection-changed'));
            return;
        } else {
            console.warn(`[DB] Configured URL failed (${health.message}). Trying auto-discovery.`);
        }
    }

    // 2. Auto-discovery candidates
    const candidates = [];
    
    // Always try relative path first (works if app is deployed on same server)
    candidates.push(''); 

    // If we are developing locally, try standard backend port
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        candidates.push('http://localhost:8080');
    }

    for (const url of candidates) {
        const health = await checkHealth(url);
        if (health.ok) {
            console.log(`[DB] Auto-connected to: '${url || 'Relative Path'}'`);
            API_BASE_URL = url;
            if (url) localStorage.setItem('rms_api_url', url);
            isLive = true;
            window.dispatchEvent(new Event('db-connection-changed'));
            return;
        }
    }

    // 3. Fallback to Local Mode
    console.log("[DB] Could not reach backend. Defaulting to Local Mode.");
    isLive = false;
    window.dispatchEvent(new Event('db-connection-changed'));
};

// --- CONNECTION MANAGEMENT ---

export const setApiUrl = async (url: string) => {
    // Normalize URL using robust sanitizer
    const cleanUrl = sanitizeUrl(url);

    if (!cleanUrl) return { success: false, error: "URL cannot be empty" };

    console.log(`[DB] Manual connection attempt to Base URL: ${cleanUrl}`);
    
    const health = await checkHealth(cleanUrl);
    if (health.ok) {
        API_BASE_URL = cleanUrl;
        localStorage.setItem('rms_api_url', cleanUrl);
        isLive = true;
        window.dispatchEvent(new Event('db-connection-changed'));
        return { success: true };
    } else {
        // Return full debug info
        return { 
            success: false, 
            error: health.message, 
            debugUrl: health.lastUrl // Expose the last tried URL for the UI to link to
        };
    }
};

export const checkHealth = async (baseUrl: string | null = API_BASE_URL): Promise<{ ok: boolean; message: string, lastUrl?: string }> => {
  const targetUrl = baseUrl === null ? '' : baseUrl.replace(/\/+$/, "");
  
  // Strategy: Try primary health endpoint, then fallback to others
  // This helps if /api/ prefixing is handled differently by different hosts
  const endpoints = [
      '/api/health',
      '/health',
      '/ping',
      '/_status',
      '/'
  ];

  for (const path of endpoints) {
      const fullUrl = targetUrl ? `${targetUrl}${path}` : path;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout
        
        console.debug(`[DB] Pinging: ${fullUrl}`);
        const response = await fetch(fullUrl, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return { ok: true, message: "Connected" };
        } else if (response.status === 404) {
            // If 404, try next endpoint in loop
            console.debug(`[DB] 404 on ${fullUrl}, trying next...`);
            continue;
        } else {
            return { ok: false, message: `Server Error: ${response.status}`, lastUrl: fullUrl };
        }
      } catch (e: any) {
        // Network error usually means hostname is wrong or CORS blocked
        console.debug(`[DB] Error on ${fullUrl}: ${e.message}`);
        // If we exhausted all endpoints, return this error
        if (path === endpoints[endpoints.length - 1]) {
             return { ok: false, message: `Network Error: ${e.message}`, lastUrl: fullUrl };
        }
      }
  }

  // If we get here, all endpoints 404'd
  const lastAttemptUrl = targetUrl ? `${targetUrl}/api/health` : '/api/health';
  return { ok: false, message: "API endpoints not found (404)", lastUrl: lastAttemptUrl };
};

export const disconnect = () => {
    localStorage.removeItem('rms_api_url');
    API_BASE_URL = null;
    isLive = false;
    window.dispatchEvent(new Event('db-connection-changed'));
};

// Run initialization immediately
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

// --- AUTHENTICATION ---

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
            if (res.ok && data.success) {
                return { success: true, user: data.user };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch (e) {
            return { success: false, error: 'Network error during login' };
        }
    } else {
        // Local Mode Fallback (Offline)
        const saved = localStorage.getItem('rms_users');
        
        // Safety check: ensure admin user exists in local storage
        let users = saved ? JSON.parse(saved) : [];
        if (users.length === 0) {
            console.log("[DB] Seeding Local Admin for Auth");
            users = [SEED_LOCAL_ADMIN];
            localStorage.setItem('rms_users', JSON.stringify(users));
        }

        const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (user) return { success: true, user };
        return { success: false, error: 'Invalid credentials (Local Mode)' };
    }
};

// --- SUBSCRIPTION & CRUD ---

export const subscribeToCollection = (
  colName: CollectionName, 
  callback: (data: any[]) => void, 
  fallbackData: any[] = []
): () => void => {
  
  if (isLive) {
    const endpoint = ENDPOINTS[colName];
    let isSubscribed = true;
    
    const fetchData = async () => {
        if (!isSubscribed) return;
        
        // CRITICAL: Skip polling if a write operation is currently in progress.
        // This prevents the optimistic UI state from being overwritten by stale server data.
        if (activeWriteCount > 0) {
            return; 
        }

        try {
            const url = getUrl(endpoint);
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                const hydrated = data.map((item: any) => hydrateDates(item));
                callback(hydrated);
            } else {
                console.warn(`[API] Fetch failed for ${colName}: ${res.status}`);
            }
        } catch (e) {
            console.warn(`[API] Network error for ${colName}`);
        }
    };

    fetchData(); // Initial Fetch
    
    // 1. Lower Frequency Polling (5s) to reduce database load
    const intervalId = setInterval(fetchData, 5000); 

    // 2. Fetch on Window Focus (Instant update when switching back to tab)
    const handleFocus = () => {
        if (isSubscribed) fetchData();
    };
    window.addEventListener('focus', handleFocus);

    // 3. Force Refresh Event Listener (Triggered by mutations)
    const handleForceRefresh = (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail && (ce.detail.colName === colName || ce.detail.colName === 'all')) {
            // Minimal delay to allow server write propagation
            setTimeout(fetchData, 50);
        }
    };
    window.addEventListener('rms-force-refresh', handleForceRefresh);

    return () => { 
        isSubscribed = false; 
        clearInterval(intervalId); 
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('rms-force-refresh', handleForceRefresh);
    };

  } else {
    // Local Storage Mode
    loadFromLocal(colName, callback, fallbackData);
    
    const handleCustomUpdate = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail && customEvent.detail.collection === colName) {
            loadFromLocal(colName, callback, fallbackData);
        }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `rms_${colName}`) {
        loadFromLocal(colName, callback, fallbackData);
      }
    };

    window.addEventListener('rms-local-update', handleCustomUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('rms-local-update', handleCustomUpdate);
        window.removeEventListener('storage', handleStorageChange);
    };
  }
};

const triggerForceRefresh = (colName: CollectionName) => {
    window.dispatchEvent(new CustomEvent('rms-force-refresh', { detail: { colName } }));
};

export const addItem = async (colName: CollectionName, item: any) => {
  if (isLive) {
    activeWriteCount++;
    try {
        const endpoint = ENDPOINTS[colName];
        await fetch(getUrl(endpoint), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            mode: 'cors'
        });
        triggerForceRefresh(colName);
    } catch (e) { 
        console.error("[API] Add Error", e); 
    } finally {
        activeWriteCount--;
    }
  } else {
    saveToLocal(colName, item, 'add');
  }
};

export const updateItem = async (colName: CollectionName, item: any) => {
  if (isLive) {
    activeWriteCount++;
    try {
        const endpoint = ENDPOINTS[colName];
        await fetch(getUrl(`${endpoint}/${item.id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            mode: 'cors'
        });
        triggerForceRefresh(colName);
    } catch (e) { 
        console.error("[API] Update Error", e); 
    } finally {
        activeWriteCount--;
    }
  } else {
    saveToLocal(colName, item, 'update');
  }
};

export const deleteItem = async (colName: CollectionName, itemId: string) => {
  if (isLive) {
    activeWriteCount++;
    try {
        const endpoint = ENDPOINTS[colName];
        await fetch(getUrl(`${endpoint}/${itemId}`), {
            method: 'DELETE',
            mode: 'cors'
        });
        triggerForceRefresh(colName);
    } catch (e) { 
        console.error("[API] Delete Error", e); 
    } finally {
        activeWriteCount--;
    }
  } else {
    saveToLocal(colName, { id: itemId }, 'delete');
  }
};

// Bulk operations
export const bulkUpdateItems = async (colName: CollectionName, items: any[]) => {
    if (!isLive) {
        const key = `rms_${colName}`;
        const currentStr = localStorage.getItem(key);
        let current = currentStr ? JSON.parse(currentStr) : [];
        items.forEach(item => {
            current = current.map((i: any) => i.id === item.id ? { ...i, ...item } : i);
        });
        localStorage.setItem(key, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('rms-local-update', { detail: { collection: colName } }));
    } else {
        activeWriteCount++;
        try {
            await Promise.all(items.map(item => updateItem(colName, item))); // Note: inner updateItem increments activeWriteCount too, which is fine
            triggerForceRefresh(colName);
        } finally {
            activeWriteCount--;
        }
    }
};

export const bulkAddItems = async (colName: CollectionName, items: any[]) => {
    if (!isLive) {
        const key = `rms_${colName}`;
        const currentStr = localStorage.getItem(key);
        let current = currentStr ? JSON.parse(currentStr) : [];
        current = [...items, ...current];
        localStorage.setItem(key, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('rms-local-update', { detail: { collection: colName } }));
    } else {
        activeWriteCount++;
        try {
            await Promise.all(items.map(item => addItem(colName, item)));
            triggerForceRefresh(colName);
        } finally {
            activeWriteCount--;
        }
    }
};

export const bulkDeleteItems = async (colName: CollectionName, ids: string[]) => {
    if (!isLive) {
        const key = `rms_${colName}`;
        const currentStr = localStorage.getItem(key);
        let current = currentStr ? JSON.parse(currentStr) : [];
        current = current.filter((i: any) => !ids.includes(i.id));
        localStorage.setItem(key, JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('rms-local-update', { detail: { collection: colName } }));
    } else {
        activeWriteCount++;
        try {
            await Promise.all(ids.map(id => deleteItem(colName, id)));
            triggerForceRefresh(colName);
        } finally {
            activeWriteCount--;
        }
    }
};

const hydrateDates = (obj: any): any => {
    if (!obj) return obj;
    const newObj = { ...obj };
    const map = {
        'receipt_image': 'receiptImage'
    };
    for (const key in newObj) {
        // Hydrate Dates
        if (
            (key.endsWith('At') || key === 'date' || key === 'lastVisit' || key === 'startTime' || key === 'endTime') && 
            typeof newObj[key] === 'string'
        ) {
            newObj[key] = new Date(newObj[key]);
        }
        
        // Hydrate snake_case fields if they slipped through
        if (map[key as keyof typeof map]) {
             newObj[map[key as keyof typeof map]] = newObj[key];
             delete newObj[key];
        }
    }
    return newObj;
};

const loadFromLocal = (colName: string, callback: (data: any[]) => void, fallbackData: any[]) => {
  try {
    const saved = localStorage.getItem(`rms_${colName}`);
    if (saved) {
      const parsed = JSON.parse(saved, (key, value) => {
        if (key.endsWith('At') || key === 'date' || key === 'lastVisit' || key === 'startTime' || key === 'endTime') {
          return value ? new Date(value) : value;
        }
        return value;
      });
      callback(parsed);
    } else {
      if (colName === 'users' && (!fallbackData || fallbackData.length === 0)) {
          console.log("[DB] Seeding Local Storage with Default Admin");
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
  const currentStr = localStorage.getItem(key);
  let current = currentStr ? JSON.parse(currentStr) : [];

  if (action === 'add') {
    current = [item, ...current];
  } else if (action === 'update') {
    current = current.map((i: any) => i.id === item.id ? item : i);
  } else if (action === 'delete') {
    current = current.filter((i: any) => i.id !== item.id);
  }

  localStorage.setItem(key, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('rms-local-update', { detail: { collection: colName } }));
};
