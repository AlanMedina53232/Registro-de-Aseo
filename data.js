// Supabase Data Layer - Cloud-First Hybrid Strategy (Real-time sync when online)
const DEFAULT_STUDENTS = [
  "Aboytes Cota Danna Victoria",
  "Arechiga Lopez Susana Espranza",
  "Arechiga Lopez Zahid Ivan",
  "Barajas Morales Dylan Moises",
  "Camacho Gonzalez Agnes Sophia",
  "Campechano Campechano Angel Seba",
  "Castro Velazquez Derian Kaleb",
  "Duarte Morin Kairos Jireh",
  "Holguin Soto Mia Araleydi",
  "Lagunas Odgers Renata Marlen",
  "Martinez Alcaraz Andres",
  "Martines Corcuera Gretel Valeria",
  "Martinez Hernandez Axel Aurelio",
  "Medina Alvarez Elizabeth Adilene",
  "Medina Vera Ricardo Gabriel",
  "Melendez Villanueva Freddy",
  "Morales Enriquez Alaia Vanessa",
  "Morales Martinez Itzayana Victoria",
  "Morales Raya Herany",
  "Peralta Galvan Danna Valeria",
  "Ramirez Cardenas Vania",
  "Ramirez Victorio José Alexis",
  "Salas Camacho Thaily Isabela",
  "Salas Murillo Carlos Enrique",
  "Salazar Gabriel Alexandro Joshua",
  "Sevilla Valdez Ian Mateo",
  "Soto Conde Yareli",
  "Tellez Martinez José Adriel",
  "Valdez Lorenzo Francisco Emmauel",
  "Viramontes Rodriguez Daniel Rodrigo"
];

const DEFAULT_WEEKS = [
    "14-Sep a 18-Sep",
    "21-Sep a 25-Sep",
    "28-Sep a 2-Oct",
    "5-Oct a 9-Oct",
    "12-Oct a 16-Oct",
    "19-Oct a 23-Oct",
    "26-Oct a 30-Oct",
    "2-Nov a 6-Nov",
    "9-Nov a 13-Nov",
    "16-Nov a 20-Nov",
    "23-Nov a 27-Nov",
    "30-Nov a 4-Dic",
    "7-Dic a 11-Dic",
    "14-Dic a 18-Dic"
];

const DEFAULT_SETTINGS = {
    weeklyFee: 15
};

const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    ADVANCED: 'advanced'
};

// Cache keys for localStorage
const CACHE_KEYS = {
    students: 'cache_students',
    weeks: 'cache_weeks',
    settings: 'cache_settings',
    payments: 'cache_payments',
    daysToPay: 'cache_daysToPay',
    movements: 'cache_movements',
    siblings: 'cache_siblings',
    savedWeeks: 'cache_savedWeeks',
    paymentHistory: 'cache_paymentHistory'
};

const OFFLINE_QUEUE_KEY = 'pagos_offline_queue';

function generatePaymentKey(studentIndex, weekIndex) {
    return `${studentIndex}-${weekIndex}`;
}

// ==================== CACHE HELPERS ====================
function getCache(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function setCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Error saving cache:', e);
        return false;
    }
}

// Initialize cache with defaults if empty
function ensureCacheInitialized() {
    if (!getCache(CACHE_KEYS.students)) setCache(CACHE_KEYS.students, DEFAULT_STUDENTS);
    if (!getCache(CACHE_KEYS.weeks)) setCache(CACHE_KEYS.weeks, DEFAULT_WEEKS);
    if (!getCache(CACHE_KEYS.settings)) setCache(CACHE_KEYS.settings, DEFAULT_SETTINGS);
    if (!getCache(CACHE_KEYS.payments)) setCache(CACHE_KEYS.payments, {});
    if (!getCache(CACHE_KEYS.daysToPay)) setCache(CACHE_KEYS.daysToPay, {});
    if (!getCache(CACHE_KEYS.movements)) setCache(CACHE_KEYS.movements, []);
    if (!getCache(CACHE_KEYS.siblings)) setCache(CACHE_KEYS.siblings, []);
    if (!getCache(CACHE_KEYS.savedWeeks)) setCache(CACHE_KEYS.savedWeeks, {});
    if (!getCache(CACHE_KEYS.paymentHistory)) setCache(CACHE_KEYS.paymentHistory, []);
}

// ==================== OFFLINE QUEUE HELPERS ====================
function getOfflineQueue() {
    try {
        const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveOfflineQueue(queue) {
    try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        return true;
    } catch (e) {
        console.error('Error saving offline queue:', e);
        return false;
    }
}

function addToOfflineQueue(operation) {
    const queue = getOfflineQueue();
    queue.push({
        ...operation,
        timestamp: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    saveOfflineQueue(queue);
}

function removeFromOfflineQueue(id) {
    const queue = getOfflineQueue().filter(item => item.id !== id);
    saveOfflineQueue(queue);
}

function clearOfflineQueue() {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

function isOnline() {
    return navigator.onLine;
}

// ==================== CLOUD-FIRST FETCH HELPER ====================
// Fetches from Supabase when online, falls back to localStorage when offline
async function fetchFromCloudOrCache(fetchFromSupabase, cacheKey, defaultValue) {
    if (isOnline()) {
        try {
            const data = await fetchFromSupabase();
            if (data !== null && data !== undefined) {
                setCache(cacheKey, data);
                return data;
            }
        } catch (e) {
            console.warn('Cloud fetch failed, falling back to cache:', e);
        }
    }
    // Offline or cloud fetch failed - use cache
    const cached = getCache(cacheKey);
    return cached !== null ? cached : defaultValue;
}

// ==================== BACKGROUND SYNC ====================
let syncInProgress = false;

async function syncOfflineQueue() {
    if (syncInProgress || !isOnline()) return { synced: 0, failed: 0 };
    
    const queue = getOfflineQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };
    
    syncInProgress = true;
    let synced = 0;
    let failed = 0;
    
    for (const operation of queue) {
        try {
            await executeOfflineOperation(operation);
            removeFromOfflineQueue(operation.id);
            synced++;
        } catch (e) {
            console.error('Failed to sync operation:', operation, e);
            failed++;
        }
    }
    
    syncInProgress = false;
    return { synced, failed };
}

async function executeOfflineOperation(operation) {
    switch (operation.type) {
        case 'savePayments':
            await savePaymentsToSupabase(operation.data);
            break;
        case 'saveDaysToPay':
            await saveDaysToPayToSupabase(operation.data);
            break;
        case 'addMovement':
            await addMovementToSupabase(operation.data.type, operation.data.weekIndex, operation.data.amount, operation.data.description);
            break;
        case 'saveWeek':
            await saveWeekToSupabase(operation.data);
            break;
        case 'saveSiblings':
            await saveSiblingsToSupabase(operation.data);
            break;
        case 'addPaymentToHistory':
            await addPaymentToHistoryToSupabase(operation.data.studentIndex, operation.data.weekIndex, operation.data.amount, operation.data.isSharedPayment, operation.data.siblingIndices);
            break;
        case 'removeLastPaymentEntry':
            await removeLastPaymentEntryToSupabase();
            break;
        case 'saveStudents':
            await saveStudentsToSupabase(operation.data);
            break;
        case 'saveWeeks':
            await saveWeeksToSupabase(operation.data);
            break;
        case 'saveSettings':
            await saveSettingsToSupabase(operation.data);
            break;
        case 'clearPayments':
            await clearPaymentsToSupabase();
            break;
        case 'clearDaysToPay':
            await clearDaysToPayToSupabase();
            break;
        case 'clearMovements':
            await clearMovementsToSupabase();
            break;
        case 'clearSiblings':
            await clearSiblingsToSupabase();
            break;
        case 'clearSavedWeeks':
            await clearSavedWeeksToSupabase();
            break;
        case 'clearPaymentHistory':
            await clearPaymentHistoryToSupabase();
            break;
        case 'resetAllData':
            await resetAllDataToSupabase();
            break;
        default:
            console.warn('Unknown offline operation type:', operation.type);
    }
}

// ==================== STUDENTS ====================
// CLOUD-FIRST: Fetch from Supabase when online, fallback to localStorage when offline
async function getStudents() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('alumnos')
                .select('id, nombre, orden')
                .order('orden', { ascending: true });
            if (error) throw error;
            return data && data.length > 0 ? data.map(d => d.nombre) : DEFAULT_STUDENTS;
        },
        CACHE_KEYS.students,
        DEFAULT_STUDENTS
    );
}

// Background sync to Supabase (kept for manual sync)
async function syncStudentsFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('alumnos')
            .select('id, nombre, orden')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const students = data.map(d => d.nombre);
            setCache(CACHE_KEYS.students, students);
        }
    } catch (e) {
        console.warn('Background sync students failed:', e);
    }
}

async function saveStudents(students) {
    // CLOUD-FIRST: Write to Supabase immediately when online
    if (isOnline()) {
        try {
            await saveStudentsToSupabase(students);
            setCache(CACHE_KEYS.students, students);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    // Offline or cloud save failed - queue for later
    setCache(CACHE_KEYS.students, students);
    addToOfflineQueue({ type: 'saveStudents', data: students });
    return true;
}

async function saveStudentsToSupabase(students) {
    await supabaseClient.from('alumnos').delete().neq('id', 0);
    const records = students.map((nombre, index) => ({ nombre, orden: index + 1 }));
    const { error } = await supabaseClient.from('alumnos').insert(records);
    if (error) throw error;
}

async function initializeDefaultStudents() {
    const records = DEFAULT_STUDENTS.map((nombre, index) => ({ nombre, orden: index + 1 }));
    await supabaseClient.from('alumnos').insert(records);
}

// ==================== WEEKS ====================
async function getWeeks() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('semanas')
                .select('id, nombre, orden')
                .order('orden', { ascending: true });
            if (error) throw error;
            return data && data.length > 0 ? data.map(d => d.nombre) : DEFAULT_WEEKS;
        },
        CACHE_KEYS.weeks,
        DEFAULT_WEEKS
    );
}

async function syncWeeksFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('semanas')
            .select('id, nombre, orden')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const weeks = data.map(d => d.nombre);
            setCache(CACHE_KEYS.weeks, weeks);
        }
    } catch (e) {
        console.warn('Background sync weeks failed:', e);
    }
}

async function saveWeeks(weeks) {
    if (isOnline()) {
        try {
            await saveWeeksToSupabase(weeks);
            setCache(CACHE_KEYS.weeks, weeks);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.weeks, weeks);
    addToOfflineQueue({ type: 'saveWeeks', data: weeks });
    return true;
}

async function saveWeeksToSupabase(weeks) {
    await supabaseClient.from('semanas').delete().neq('id', 0);
    const records = weeks.map((nombre, index) => ({ nombre, orden: index + 1 }));
    const { error } = await supabaseClient.from('semanas').insert(records);
    if (error) throw error;
}

async function initializeDefaultWeeks() {
    const records = DEFAULT_WEEKS.map((nombre, index) => ({ nombre, orden: index + 1 }));
    await supabaseClient.from('semanas').insert(records);
}

// ==================== SETTINGS ====================
async function getSettings() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('configuracion')
                .select('clave, valor')
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                return { weeklyFee: parseInt(data.valor?.cuota_semanal) || DEFAULT_SETTINGS.weeklyFee };
            }
            return { ...DEFAULT_SETTINGS };
        },
        CACHE_KEYS.settings,
        { ...DEFAULT_SETTINGS }
    );
}

async function syncSettingsFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('clave, valor')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
            const settings = { weeklyFee: parseInt(data.valor?.cuota_semanal) || DEFAULT_SETTINGS.weeklyFee };
            setCache(CACHE_KEYS.settings, settings);
        }
    } catch (e) {
        console.warn('Background sync settings failed:', e);
    }
}

async function saveSettings(settings) {
    if (isOnline()) {
        try {
            await saveSettingsToSupabase(settings);
            setCache(CACHE_KEYS.settings, settings);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.settings, settings);
    addToOfflineQueue({ type: 'saveSettings', data: settings });
    return true;
}

async function saveSettingsToSupabase(settings) {
    const { error } = await supabaseClient
        .from('configuracion')
        .upsert({ id: 1, clave: 'settings', valor: { cuota_semanal: settings.weeklyFee } });
    if (error) throw error;
}

// ==================== PAYMENTS ====================
async function getPayments() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('pagos')
                .select('alumno_idx, semana_idx, estado');
            if (error) throw error;
            const payments = {};
            data?.forEach(d => { payments[generatePaymentKey(d.alumno_idx, d.semana_idx)] = d.estado; });
            return payments;
        },
        CACHE_KEYS.payments,
        {}
    );
}

async function syncPaymentsFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('pagos')
            .select('alumno_idx, semana_idx, estado');
        
        if (error) throw error;
        
        const payments = {};
        data?.forEach(d => { payments[generatePaymentKey(d.alumno_idx, d.semana_idx)] = d.estado; });
        setCache(CACHE_KEYS.payments, payments);
    } catch (e) {
        console.warn('Background sync payments failed:', e);
    }
}

async function savePayments(payments) {
    if (isOnline()) {
        try {
            await savePaymentsToSupabase(payments);
            setCache(CACHE_KEYS.payments, payments);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.payments, payments);
    addToOfflineQueue({ type: 'savePayments', data: payments });
    return true;
}

async function savePaymentsToSupabase(payments) {
    const records = Object.entries(payments).map(([key, estado]) => {
        const [alumno_idx, semana_idx] = key.split('-').map(Number);
        return { alumno_idx, semana_idx, estado };
    });
    await supabaseClient.from('pagos').delete().neq('id', 0);
    if (records.length > 0) {
        const { error } = await supabaseClient.from('pagos').insert(records);
        if (error) throw error;
    }
}

async function updatePayment(studentIndex, weekIndex, status) {
    const payments = (await getPayments()) || {};
    const key = generatePaymentKey(studentIndex, weekIndex);
    payments[key] = status;
    await savePayments(payments);
    return true;
}

// ==================== DAYS TO PAY ====================
async function getDaysToPay() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('dias_aseo')
                .select('semana_idx, dias');
            if (error) throw error;
            const days = {};
            data?.forEach(d => { days[d.semana_idx] = d.dias; });
            return days;
        },
        CACHE_KEYS.daysToPay,
        {}
    );
}

async function syncDaysToPayFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('dias_aseo')
            .select('semana_idx, dias');
        
        if (error) throw error;
        
        const days = {};
        data?.forEach(d => { days[d.semana_idx] = d.dias; });
        setCache(CACHE_KEYS.daysToPay, days);
    } catch (e) {
        console.warn('Background sync days to pay failed:', e);
    }
}

async function saveDaysToPay(days) {
    if (isOnline()) {
        try {
            await saveDaysToPayToSupabase(days);
            setCache(CACHE_KEYS.daysToPay, days);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.daysToPay, days);
    addToOfflineQueue({ type: 'saveDaysToPay', data: days });
    return true;
}

async function saveDaysToPayToSupabase(days) {
    const records = Object.entries(days).map(([semana_idx, dias]) => ({
        semana_idx: Number(semana_idx), dias: Number(dias)
    }));
    await supabaseClient.from('dias_aseo').delete().neq('id', 0);
    if (records.length > 0) {
        const { error } = await supabaseClient.from('dias_aseo').insert(records);
        if (error) throw error;
    }
}

// ==================== MOVEMENTS ====================
async function getMovements() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('movimientos')
                .select('id, fecha, semana_idx, tipo, monto, descripcion, saldo')
                .order('fecha', { ascending: true });
            if (error) throw error;
            return data?.map(d => ({
                id: d.id, date: d.fecha, weekIndex: d.semana_idx,
                type: d.tipo, amount: Number(d.monto), description: d.descripcion,
                balance: Number(d.saldo)
            })) || [];
        },
        CACHE_KEYS.movements,
        []
    );
}

async function syncMovementsFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('id, fecha, semana_idx, tipo, monto, descripcion, saldo')
            .order('fecha', { ascending: true });
        
        if (error) throw error;
        
        const movements = data?.map(d => ({
            id: d.id, date: d.fecha, weekIndex: d.semana_idx,
            type: d.tipo, amount: Number(d.monto), description: d.descripcion,
            balance: Number(d.saldo)
        })) || [];
        setCache(CACHE_KEYS.movements, movements);
    } catch (e) {
        console.warn('Background sync movements failed:', e);
    }
}

async function addMovement(type, weekIndex, amount, description) {
    if (isOnline()) {
        try {
            return await addMovementToSupabase(type, weekIndex, amount, description);
        } catch (e) {
            console.warn('Cloud add movement failed, falling back to local queue:', e);
        }
    }
    // Offline or cloud failed - optimistic update + queue
    const cachedMovements = getCache(CACHE_KEYS.movements) || [];
    const lastBalance = cachedMovements.length > 0 ? cachedMovements[cachedMovements.length - 1].balance : 0;
    const balance = type === 'income' ? lastBalance + amount : lastBalance - amount;
    
    const optimisticMovement = {
        id: `offline-${Date.now()}`,
        date: new Date().toISOString(),
        weekIndex,
        type,
        amount,
        description,
        balance,
        offline: true
    };
    
    const updatedMovements = [...cachedMovements, optimisticMovement];
    setCache(CACHE_KEYS.movements, updatedMovements);
    addToOfflineQueue({ type: 'addMovement', data: { type, weekIndex, amount, description } });
    return optimisticMovement;
}

async function addMovementToSupabase(type, weekIndex, amount, description) {
    const movements = await getMovements();
    const lastBalance = movements.length > 0 ? movements[movements.length - 1].balance : 0;
    const balance = type === 'income' ? lastBalance + amount : lastBalance - amount;
    const { data, error } = await supabaseClient
        .from('movimientos')
        .insert({ fecha: new Date().toISOString(), semana_idx: weekIndex, tipo: type, monto: amount, descripcion: description, saldo: balance })
        .select().single();
    if (error) throw error;
    
    // Update local cache with real ID from Supabase
    const cachedMovements = getCache(CACHE_KEYS.movements) || [];
    const index = cachedMovements.findIndex(m => m.id.startsWith('offline-') && m.weekIndex === weekIndex && m.amount === amount && m.type === type);
    if (index !== -1) {
        cachedMovements[index] = {
            id: data.id, date: data.fecha, weekIndex: data.semana_idx,
            type: data.tipo, amount: Number(data.monto), description: data.descripcion,
            balance: Number(data.saldo),
            offline: false
        };
        setCache(CACHE_KEYS.movements, cachedMovements);
    }
    return data;
}

// ==================== SIBLINGS ====================
async function getSiblings() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('hermanos')
                .select('id, grupo_idx, alumno_idx, pago_compartido')
                .order('grupo_idx', { ascending: true });
            if (error) throw error;
            if (data && data.length > 0) {
                const groups = {};
                data.forEach(d => {
                    if (!groups[d.grupo_idx]) groups[d.grupo_idx] = { members: [], sharedPayment: d.pago_compartido };
                    groups[d.grupo_idx].members.push(d.alumno_idx);
                });
                return Object.values(groups);
            }
            return [];
        },
        CACHE_KEYS.siblings,
        []
    );
}

async function syncSiblingsFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('hermanos')
            .select('id, grupo_idx, alumno_idx, pago_compartido')
            .order('grupo_idx', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const groups = {};
            data.forEach(d => {
                if (!groups[d.grupo_idx]) groups[d.grupo_idx] = { members: [], sharedPayment: d.pago_compartido };
                groups[d.grupo_idx].members.push(d.alumno_idx);
            });
            const siblings = Object.values(groups);
            setCache(CACHE_KEYS.siblings, siblings);
        }
    } catch (e) {
        console.warn('Background sync siblings failed:', e);
    }
}

async function saveSiblings(siblings) {
    if (isOnline()) {
        try {
            await saveSiblingsToSupabase(siblings);
            setCache(CACHE_KEYS.siblings, siblings);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.siblings, siblings);
    addToOfflineQueue({ type: 'saveSiblings', data: siblings });
    return true;
}

async function saveSiblingsToSupabase(siblings) {
    await supabaseClient.from('hermanos').delete().neq('id', 0);
    const records = [];
    siblings.forEach((group, grupo_idx) => {
        group.members.forEach(alumno_idx => {
            records.push({ grupo_idx, alumno_idx, pago_compartido: group.sharedPayment });
        });
    });
    if (records.length > 0) {
        const { error } = await supabaseClient.from('hermanos').insert(records);
        if (error) throw error;
    }
}

function getSiblingGroup(studentIndex, siblings) {
    return siblings.find(group => group.members.includes(studentIndex));
}

function getAllSiblingIndices(studentIndex, siblings) {
    const group = getSiblingGroup(studentIndex, siblings);
    if (!group) return [studentIndex];
    return group.members;
}

function isSiblingException(studentIndex, siblings) {
    const group = getSiblingGroup(studentIndex, siblings);
    return group && group.sharedPayment === true;
}

// ==================== SAVED WEEKS ====================
async function getSavedWeeks() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('semanas_cerradas')
                .select('semana_idx');
            if (error) throw error;
            const saved = {};
            data?.forEach(d => { saved[d.semana_idx] = true; });
            return saved;
        },
        CACHE_KEYS.savedWeeks,
        {}
    );
}

async function syncSavedWeeksFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('semanas_cerradas')
            .select('semana_idx');
        
        if (error) throw error;
        
        const saved = {};
        data?.forEach(d => { saved[d.semana_idx] = true; });
        setCache(CACHE_KEYS.savedWeeks, saved);
    } catch (e) {
        console.warn('Background sync saved weeks failed:', e);
    }
}

async function saveWeek(weekIndex) {
    if (isOnline()) {
        try {
            await saveWeekToSupabase(weekIndex);
            const saved = getCache(CACHE_KEYS.savedWeeks) || {};
            saved[weekIndex] = true;
            setCache(CACHE_KEYS.savedWeeks, saved);
            return true;
        } catch (e) {
            console.warn('Cloud save failed, falling back to local queue:', e);
        }
    }
    const saved = getCache(CACHE_KEYS.savedWeeks) || {};
    saved[weekIndex] = true;
    setCache(CACHE_KEYS.savedWeeks, saved);
    addToOfflineQueue({ type: 'saveWeek', data: weekIndex });
    return true;
}

async function saveWeekToSupabase(weekIndex) {
    const { error } = await supabaseClient
        .from('semanas_cerradas')
        .upsert({ semana_idx: weekIndex }, { onConflict: 'semana_idx' });
    if (error) throw error;
}

// ==================== PAYMENT HISTORY ====================
async function getPaymentHistory() {
    return fetchFromCloudOrCache(
        async () => {
            const { data, error } = await supabaseClient
                .from('historial_pagos')
                .select('id, fecha, alumno_idx, semana_idx, monto, es_compartido, hermanos_idx')
                .order('fecha', { ascending: true });
            if (error) throw error;
            return data?.map(d => ({
                id: d.id, date: d.fecha, studentIndex: d.alumno_idx,
                weekIndex: d.semana_idx, amount: Number(d.monto),
                isSharedPayment: d.es_compartido, siblingIndices: d.hermanos_idx || []
            })) || [];
        },
        CACHE_KEYS.paymentHistory,
        []
    );
}

async function syncPaymentHistoryFromSupabase() {
    if (!isOnline()) return;
    try {
        const { data, error } = await supabaseClient
            .from('historial_pagos')
            .select('id, fecha, alumno_idx, semana_idx, monto, es_compartido, hermanos_idx')
            .order('fecha', { ascending: true });
        
        if (error) throw error;
        
        const history = data?.map(d => ({
            id: d.id, date: d.fecha, studentIndex: d.alumno_idx,
            weekIndex: d.semana_idx, amount: Number(d.monto),
            isSharedPayment: d.es_compartido, siblingIndices: d.hermanos_idx || []
        })) || [];
        setCache(CACHE_KEYS.paymentHistory, history);
    } catch (e) {
        console.warn('Background sync payment history failed:', e);
    }
}

async function addPaymentToHistory(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices) {
    if (isOnline()) {
        try {
            return await addPaymentToHistoryToSupabase(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices);
        } catch (e) {
            console.warn('Cloud add payment history failed, falling back to local queue:', e);
        }
    }
    // Offline or cloud failed - optimistic update + queue
    const history = getCache(CACHE_KEYS.paymentHistory) || [];
    const optimisticEntry = {
        id: `offline-${Date.now()}`,
        date: new Date().toISOString(),
        studentIndex,
        weekIndex,
        amount,
        isSharedPayment,
        siblingIndices,
        offline: true
    };
    history.push(optimisticEntry);
    setCache(CACHE_KEYS.paymentHistory, history);
    addToOfflineQueue({ type: 'addPaymentToHistory', data: { studentIndex, weekIndex, amount, isSharedPayment, siblingIndices } });
    return true;
}

async function addPaymentToHistoryToSupabase(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices) {
    const { data, error } = await supabaseClient
        .from('historial_pagos')
        .insert({ fecha: new Date().toISOString(), alumno_idx: studentIndex, semana_idx: weekIndex, monto: amount, es_compartido: isSharedPayment, hermanos_idx: siblingIndices })
        .select().single();
    if (error) throw error;
    
    // Update local cache with real ID from Supabase
    const history = getCache(CACHE_KEYS.paymentHistory) || [];
    const index = history.findIndex(h => h.id.startsWith('offline-') && h.studentIndex === studentIndex && h.weekIndex === weekIndex && h.amount === amount);
    if (index !== -1) {
        history[index] = {
            id: data.id,
            date: data.fecha,
            studentIndex: data.alumno_idx,
            weekIndex: data.semana_idx,
            amount: Number(data.monto),
            isSharedPayment: data.es_compartido,
            siblingIndices: data.hermanos_idx || [],
            offline: false
        };
        setCache(CACHE_KEYS.paymentHistory, history);
    }
}

async function getLastPaymentEntry() {
    const history = await getPaymentHistory();
    return history.length > 0 ? history[history.length - 1] : null;
}

async function removeLastPaymentEntry() {
    if (isOnline()) {
        try {
            await removeLastPaymentEntryToSupabase();
            const history = await getPaymentHistory();
            if (history.length > 0) {
                history.pop();
                setCache(CACHE_KEYS.paymentHistory, history);
            }
            return true;
        } catch (e) {
            console.warn('Cloud remove last payment failed, falling back to local queue:', e);
        }
    }
    // Offline or cloud failed
    const history = getCache(CACHE_KEYS.paymentHistory) || [];
    if (history.length > 0) {
        history.pop();
        setCache(CACHE_KEYS.paymentHistory, history);
    }
    addToOfflineQueue({ type: 'removeLastPaymentEntry', data: {} });
    return true;
}

async function removeLastPaymentEntryToSupabase() {
    const history = await getPaymentHistory();
    if (history.length > 0) {
        const lastId = history[history.length - 1].id;
        const { error } = await supabaseClient
            .from('historial_pagos')
            .delete()
            .eq('id', lastId);
        if (error) throw error;
    }
}

// ==================== UTILITIES ====================
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency', currency: 'MXN', minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==================== CLEAR SPECIFIC TABLES ====================
async function clearPayments() {
    if (isOnline()) {
        try {
            await clearPaymentsToSupabase();
            setCache(CACHE_KEYS.payments, {});
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.payments, {});
    addToOfflineQueue({ type: 'clearPayments', data: {} });
    return true;
}

async function clearPaymentsToSupabase() {
    await supabaseClient.from('pagos').delete().neq('id', 0);
}

async function clearDaysToPay() {
    if (isOnline()) {
        try {
            await clearDaysToPayToSupabase();
            setCache(CACHE_KEYS.daysToPay, {});
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.daysToPay, {});
    addToOfflineQueue({ type: 'clearDaysToPay', data: {} });
    return true;
}

async function clearDaysToPayToSupabase() {
    await supabaseClient.from('dias_aseo').delete().neq('id', 0);
}

async function clearMovements() {
    if (isOnline()) {
        try {
            await clearMovementsToSupabase();
            setCache(CACHE_KEYS.movements, []);
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.movements, []);
    addToOfflineQueue({ type: 'clearMovements', data: {} });
    return true;
}

async function clearMovementsToSupabase() {
    await supabaseClient.from('movimientos').delete().neq('id', 0);
}

async function clearSiblings() {
    if (isOnline()) {
        try {
            await clearSiblingsToSupabase();
            setCache(CACHE_KEYS.siblings, []);
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.siblings, []);
    addToOfflineQueue({ type: 'clearSiblings', data: {} });
    return true;
}

async function clearSiblingsToSupabase() {
    await supabaseClient.from('hermanos').delete().neq('id', 0);
}

async function clearSavedWeeks() {
    if (isOnline()) {
        try {
            await clearSavedWeeksToSupabase();
            setCache(CACHE_KEYS.savedWeeks, {});
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.savedWeeks, {});
    addToOfflineQueue({ type: 'clearSavedWeeks', data: {} });
    return true;
}

async function clearSavedWeeksToSupabase() {
    await supabaseClient.from('semanas_cerradas').delete().neq('id', 0);
}

async function clearPaymentHistory() {
    if (isOnline()) {
        try {
            await clearPaymentHistoryToSupabase();
            setCache(CACHE_KEYS.paymentHistory, []);
            return true;
        } catch (e) {
            console.warn('Cloud clear failed, falling back to local queue:', e);
        }
    }
    setCache(CACHE_KEYS.paymentHistory, []);
    addToOfflineQueue({ type: 'clearPaymentHistory', data: {} });
    return true;
}

async function clearPaymentHistoryToSupabase() {
    await supabaseClient.from('historial_pagos').delete().neq('id', 0);
}

async function resetAllData() {
    if (isOnline()) {
        try {
            await resetAllDataToSupabase();
            // Reset local cache after successful cloud reset
            setCache(CACHE_KEYS.students, DEFAULT_STUDENTS);
            setCache(CACHE_KEYS.weeks, DEFAULT_WEEKS);
            setCache(CACHE_KEYS.settings, DEFAULT_SETTINGS);
            setCache(CACHE_KEYS.payments, {});
            setCache(CACHE_KEYS.daysToPay, {});
            setCache(CACHE_KEYS.movements, []);
            setCache(CACHE_KEYS.siblings, []);
            setCache(CACHE_KEYS.savedWeeks, {});
            setCache(CACHE_KEYS.paymentHistory, []);
            return true;
        } catch (e) {
            console.warn('Cloud reset failed, falling back to local queue:', e);
        }
    }
    // Offline or cloud failed - reset local only, queue for sync
    setCache(CACHE_KEYS.students, DEFAULT_STUDENTS);
    setCache(CACHE_KEYS.weeks, DEFAULT_WEEKS);
    setCache(CACHE_KEYS.settings, DEFAULT_SETTINGS);
    setCache(CACHE_KEYS.payments, {});
    setCache(CACHE_KEYS.daysToPay, {});
    setCache(CACHE_KEYS.movements, []);
    setCache(CACHE_KEYS.siblings, []);
    setCache(CACHE_KEYS.savedWeeks, {});
    setCache(CACHE_KEYS.paymentHistory, {});
    addToOfflineQueue({ type: 'resetAllData', data: {} });
    return true;
}

async function resetAllDataToSupabase() {
    await supabaseClient.from('alumnos').delete().neq('id', 0);
    await supabaseClient.from('semanas').delete().neq('id', 0);
    await supabaseClient.from('pagos').delete().neq('id', 0);
    await supabaseClient.from('dias_aseo').delete().neq('id', 0);
    await supabaseClient.from('movimientos').delete().neq('id', 0);
    await supabaseClient.from('hermanos').delete().neq('id', 0);
    await supabaseClient.from('semanas_cerradas').delete().neq('id', 0);
    await supabaseClient.from('historial_pagos').delete().neq('id', 0);
    await supabaseClient.from('configuracion').delete().neq('id', 0);
    await initializeDefaultStudents();
    await initializeDefaultWeeks();
    await saveSettingsToSupabase(DEFAULT_SETTINGS);
}

// ==================== MASTER SYNC FUNCTION ====================
async function syncAllFromSupabase() {
    if (!isOnline()) return;
    
    await Promise.all([
        syncStudentsFromSupabase(),
        syncWeeksFromSupabase(),
        syncSettingsFromSupabase(),
        syncPaymentsFromSupabase(),
        syncDaysToPayFromSupabase(),
        syncMovementsFromSupabase(),
        syncSiblingsFromSupabase(),
        syncSavedWeeksFromSupabase(),
        syncPaymentHistoryFromSupabase()
    ]);
}

// ==================== REALTIME SUBSCRIPTIONS ====================
let realtimeChannels = [];

function setupRealtimeSubscriptions() {
    if (!isOnline()) return;
    
    // Clean up existing channels
    realtimeChannels.forEach(ch => supabaseClient.removeChannel(ch));
    realtimeChannels = [];
    
    const tables = [
        { table: 'alumnos', syncFn: syncStudentsFromSupabase },
        { table: 'semanas', syncFn: syncWeeksFromSupabase },
        { table: 'configuracion', syncFn: syncSettingsFromSupabase },
        { table: 'pagos', syncFn: syncPaymentsFromSupabase },
        { table: 'dias_aseo', syncFn: syncDaysToPayFromSupabase },
        { table: 'movimientos', syncFn: syncMovementsFromSupabase },
        { table: 'hermanos', syncFn: syncSiblingsFromSupabase },
        { table: 'semanas_cerradas', syncFn: syncSavedWeeksFromSupabase },
        { table: 'historial_pagos', syncFn: syncPaymentHistoryFromSupabase }
    ];
    
    tables.forEach(({ table, syncFn }) => {
        const channel = supabaseClient
            .channel(`realtime-${table}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
                console.log(`[Realtime] Change detected in ${table}:`, payload.eventType);
                await syncFn();
                // Trigger UI refresh in app.js
                window.dispatchEvent(new CustomEvent('data-updated', { detail: { table } }));
            })
            .subscribe();
        realtimeChannels.push(channel);
    });
    
    console.log('[Realtime] Subscriptions active for', tables.length, 'tables');
}

function cleanupRealtimeSubscriptions() {
    realtimeChannels.forEach(ch => supabaseClient.removeChannel(ch));
    realtimeChannels = [];
    console.log('[Realtime] Subscriptions cleaned up');
}

// ==================== ONLINE EVENT LISTENER ====================
window.addEventListener('online', async () => {
    console.log('Connection restored - starting background sync...');
    await syncAllFromSupabase();
    await syncOfflineQueue();
    setupRealtimeSubscriptions();
    console.log('Background sync completed');
});

window.addEventListener('offline', () => {
    console.log('Connection lost - cleaning up realtime subscriptions');
    cleanupRealtimeSubscriptions();
});

// Initialize realtime subscriptions if online
if (isOnline()) {
    setupRealtimeSubscriptions();
}

// Initialize cache on load
ensureCacheInitialized();

// ==================== SYNC EXPORTS ====================
async function forceSyncNow() {
    await syncAllFromSupabase();
    return await syncOfflineQueue();
}

function getPendingSyncCount() {
    return getOfflineQueue().length;
}

// Export all functions for use in app.js
window.DataAPI = {
    getStudents, saveStudents,
    getWeeks, saveWeeks,
    getSettings, saveSettings,
    getPayments, savePayments, updatePayment,
    getDaysToPay, saveDaysToPay,
    getMovements, addMovement,
    getSiblings, saveSiblings,
    getSiblingGroup, getAllSiblingIndices, isSiblingException,
    getSavedWeeks, saveWeek,
    getPaymentHistory, addPaymentToHistory,
    getLastPaymentEntry, removeLastPaymentEntry,
    clearPayments, clearDaysToPay, clearMovements,
    clearSiblings, clearSavedWeeks, clearPaymentHistory,
    resetAllData,
    formatCurrency, formatDate,
    PAYMENT_STATUS,
    DEFAULT_SETTINGS, DEFAULT_STUDENTS, DEFAULT_WEEKS,
    generatePaymentKey,
    // Offline/Realtime functions
    isOnline, syncOfflineQueue, forceSyncNow, getPendingSyncCount,
    setupRealtimeSubscriptions, cleanupRealtimeSubscriptions
};