// Supabase Data Layer - All CRUD operations using async/await with offline support
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
const OFFLINE_PAYMENTS_KEY = 'pagos_offline_payments';
const OFFLINE_DAYS_KEY = 'pagos_offline_days';
const OFFLINE_MOVEMENTS_KEY = 'pagos_offline_movements';
const OFFLINE_WEEKS_KEY = 'pagos_offline_weeks';
const OFFLINE_SIBLINGS_KEY = 'pagos_offline_siblings';
const OFFLINE_HISTORY_KEY = 'pagos_offline_history';

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

async function syncOfflineQueue() {
    if (!isOnline()) return { synced: 0, failed: 0 };
    
    const queue = getOfflineQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };
    
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
async function getStudents() {
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('alumnos')
                .select('id, nombre, orden')
                .order('orden', { ascending: true });
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                await initializeDefaultStudents();
                setCache(CACHE_KEYS.students, DEFAULT_STUDENTS);
                return DEFAULT_STUDENTS;
            }
            
            const students = data.map(d => d.nombre);
            setCache(CACHE_KEYS.students, students);
            return students;
        } catch (e) {
            console.warn('Failed to fetch students from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.students);
    if (cached) return cached;
    
    // Last resort: defaults
    return DEFAULT_STUDENTS;
}

async function saveStudents(students) {
    try {
        await supabaseClient.from('alumnos').delete().neq('id', 0);
        const records = students.map((nombre, index) => ({ nombre, orden: index + 1 }));
        const { error } = await supabaseClient.from('alumnos').insert(records);
        if (error) throw error;
        setCache(CACHE_KEYS.students, students);
        return true;
    } catch (e) {
        console.error('Error saving students:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveStudents', data: students });
            setCache(CACHE_KEYS.students, students); // Update local cache immediately
            return true;
        }
        return false;
    }
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
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('semanas')
                .select('id, nombre, orden')
                .order('orden', { ascending: true });
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                await initializeDefaultWeeks();
                setCache(CACHE_KEYS.weeks, DEFAULT_WEEKS);
                return DEFAULT_WEEKS;
            }
            
            const weeks = data.map(d => d.nombre);
            setCache(CACHE_KEYS.weeks, weeks);
            return weeks;
        } catch (e) {
            console.warn('Failed to fetch weeks from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.weeks);
    if (cached) return cached;
    return DEFAULT_WEEKS;
}

async function saveWeeks(weeks) {
    try {
        await supabaseClient.from('semanas').delete().neq('id', 0);
        const records = weeks.map((nombre, index) => ({ nombre, orden: index + 1 }));
        const { error } = await supabaseClient.from('semanas').insert(records);
        if (error) throw error;
        setCache(CACHE_KEYS.weeks, weeks);
        return true;
} catch (e) {
        console.error('Error saving weeks:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveWeeks', data: weeks });
            setCache(CACHE_KEYS.weeks, weeks);
            return true;
        }
        return false;
    }
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
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('configuracion')
                .select('clave, valor')
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            if (!data) {
                setCache(CACHE_KEYS.settings, DEFAULT_SETTINGS);
                return { ...DEFAULT_SETTINGS };
            }
            
            const settings = { weeklyFee: parseInt(data.valor?.cuota_semanal) || DEFAULT_SETTINGS.weeklyFee };
            setCache(CACHE_KEYS.settings, settings);
            return settings;
        } catch (e) {
            console.warn('Failed to fetch settings from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.settings);
    if (cached) return cached;
    return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings) {
    try {
        const { error } = await supabaseClient
            .from('configuracion')
            .upsert({ id: 1, clave: 'settings', valor: { cuota_semanal: settings.weeklyFee } });
        if (error) throw error;
        setCache(CACHE_KEYS.settings, settings);
        return true;
    } catch (e) {
        console.error('Error saving settings:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveSettings', data: settings });
            setCache(CACHE_KEYS.settings, settings);
            return true;
        }
        return false;
    }
}

async function saveSettingsToSupabase(settings) {
    const { error } = await supabaseClient
        .from('configuracion')
        .upsert({ id: 1, clave: 'settings', valor: { cuota_semanal: settings.weeklyFee } });
    if (error) throw error;
}

// ==================== PAYMENTS ====================
async function getPayments() {
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('pagos')
                .select('alumno_idx, semana_idx, estado');
            
            if (error) throw error;
            
            const payments = {};
            data?.forEach(d => { payments[generatePaymentKey(d.alumno_idx, d.semana_idx)] = d.estado; });
            setCache(CACHE_KEYS.payments, payments);
            return payments;
        } catch (e) {
            console.warn('Failed to fetch payments from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.payments);
    if (cached) return cached;
    return {};
}

async function savePayments(payments) {
    try {
        const records = Object.entries(payments).map(([key, estado]) => {
            const [alumno_idx, semana_idx] = key.split('-').map(Number);
            return { alumno_idx, semana_idx, estado };
        });
        
        await supabaseClient.from('pagos').delete().neq('id', 0);
        
        if (records.length > 0) {
            const { error } = await supabaseClient.from('pagos').insert(records);
            if (error) throw error;
        }
        setCache(CACHE_KEYS.payments, payments);
        return true;
    } catch (e) {
        console.error('Error saving payments:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'savePayments', data: payments });
            setCache(CACHE_KEYS.payments, payments);
            return true;
        }
        return false;
    }
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
    try {
        const key = generatePaymentKey(studentIndex, weekIndex);
        const { error } = await supabaseClient
            .from('pagos')
            .upsert({ alumno_idx: studentIndex, semana_idx: weekIndex, estado: status }, { onConflict: 'alumno_idx,semana_idx' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error updating payment:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'updatePayment', data: { studentIndex, weekIndex, status } });
            return true;
        }
        return false;
    }
}

// ==================== DAYS TO PAY ====================
async function getDaysToPay() {
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('dias_aseo')
                .select('semana_idx, dias');
            
            if (error) throw error;
            
            const days = {};
            data?.forEach(d => { days[d.semana_idx] = d.dias; });
            setCache(CACHE_KEYS.daysToPay, days);
            return days;
        } catch (e) {
            console.warn('Failed to fetch days to pay from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.daysToPay);
    if (cached) return cached;
    return {};
}

async function saveDaysToPay(days) {
    try {
        const records = Object.entries(days).map(([semana_idx, dias]) => ({
            semana_idx: Number(semana_idx), dias: Number(dias)
        }));
        await supabaseClient.from('dias_aseo').delete().neq('id', 0);
        if (records.length > 0) {
            const { error } = await supabaseClient.from('dias_aseo').insert(records);
            if (error) throw error;
        }
        setCache(CACHE_KEYS.daysToPay, days);
        return true;
    } catch (e) {
        console.error('Error saving days to pay:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveDaysToPay', data: days });
            setCache(CACHE_KEYS.daysToPay, days);
            return true;
        }
        return false;
    }
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
    // Try to fetch from Supabase
    if (isOnline()) {
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
            return movements;
        } catch (e) {
            console.warn('Failed to fetch movements from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.movements);
    if (cached) return cached;
    return [];
}

async function addMovement(type, weekIndex, amount, description) {
    try {
        const cachedMovements = getCache(CACHE_KEYS.movements) || [];
        const lastBalance = cachedMovements.length > 0 ? cachedMovements[cachedMovements.length - 1].balance : 0;
        const balance = type === 'income' ? lastBalance + amount : lastBalance - amount;
        
        const { data, error } = await supabaseClient
            .from('movimientos')
            .insert({ fecha: new Date().toISOString(), semana_idx: weekIndex, tipo: type, monto: amount, descripcion: description, saldo: balance })
            .select().single();
        
        if (error) throw error;
        
        // Update local cache
        const newMovement = {
            id: data.id, date: data.fecha, weekIndex: data.semana_idx,
            type: data.tipo, amount: Number(data.monto), description: data.descripcion,
            balance: Number(data.saldo)
        };
        const updatedMovements = [...cachedMovements, newMovement];
        setCache(CACHE_KEYS.movements, updatedMovements);
        
        return newMovement;
    } catch (e) {
        console.error('Error adding movement:', e);
        if (!isOnline()) {
            // Create optimistic movement for immediate UI update
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
        return null;
    }
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
    return data;
}

// ==================== SIBLINGS ====================
async function getSiblings() {
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('hermanos')
                .select('id, grupo_idx, alumno_idx, pago_compartido')
                .order('grupo_idx', { ascending: true });
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                setCache(CACHE_KEYS.siblings, []);
                return [];
            }
            
            const groups = {};
            data.forEach(d => {
                if (!groups[d.grupo_idx]) groups[d.grupo_idx] = { members: [], sharedPayment: d.pago_compartido };
                groups[d.grupo_idx].members.push(d.alumno_idx);
            });
            const siblings = Object.values(groups);
            setCache(CACHE_KEYS.siblings, siblings);
            return siblings;
        } catch (e) {
            console.warn('Failed to fetch siblings from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.siblings);
    if (cached) return cached;
    return [];
}

async function saveSiblings(siblings) {
    try {
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
        setCache(CACHE_KEYS.siblings, siblings);
        return true;
    } catch (e) {
        console.error('Error saving siblings:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveSiblings', data: siblings });
            setCache(CACHE_KEYS.siblings, siblings);
            return true;
        }
        return false;
    }
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
    // Try to fetch from Supabase
    if (isOnline()) {
        try {
            const { data, error } = await supabaseClient
                .from('semanas_cerradas')
                .select('semana_idx');
            
            if (error) throw error;
            
            const saved = {};
            data?.forEach(d => { saved[d.semana_idx] = true; });
            setCache(CACHE_KEYS.savedWeeks, saved);
            return saved;
        } catch (e) {
            console.warn('Failed to fetch saved weeks from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.savedWeeks);
    if (cached) return cached;
    return {};
}

async function saveWeek(weekIndex) {
    try {
        const { error } = await supabaseClient
            .from('semanas_cerradas')
            .upsert({ semana_idx: weekIndex }, { onConflict: 'semana_idx' });
        if (error) throw error;
        
        const saved = getCache(CACHE_KEYS.savedWeeks) || {};
        saved[weekIndex] = true;
        setCache(CACHE_KEYS.savedWeeks, saved);
        return true;
    } catch (e) {
        console.error('Error saving week:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'saveWeek', data: weekIndex });
            const saved = getCache(CACHE_KEYS.savedWeeks) || {};
            saved[weekIndex] = true;
            setCache(CACHE_KEYS.savedWeeks, saved);
            return true;
}
            return false;
        }
    }

    async function saveWeekToSupabase(weekIndex) {
    const { error } = await supabaseClient
        .from('semanas_cerradas')
        .upsert({ semana_idx: weekIndex }, { onConflict: 'semana_idx' });
    if (error) throw error;
}

// ==================== PAYMENT HISTORY ====================
async function getPaymentHistory() {
    // Try to fetch from Supabase
    if (isOnline()) {
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
            return history;
        } catch (e) {
            console.warn('Failed to fetch payment history from Supabase:', e);
        }
    }
    
    // Fallback to cache
    const cached = getCache(CACHE_KEYS.paymentHistory);
    if (cached) return cached;
    return [];
}

async function addPaymentToHistory(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices) {
    try {
        const { data, error } = await supabaseClient
            .from('historial_pagos')
            .insert({ fecha: new Date().toISOString(), alumno_idx: studentIndex, semana_idx: weekIndex, monto: amount, es_compartido: isSharedPayment, hermanos_idx: siblingIndices })
            .select().single();
        if (error) throw error;
        
        // Update local cache
        const history = getCache(CACHE_KEYS.paymentHistory) || [];
        history.push({
            id: data.id,
            date: data.fecha,
            studentIndex: data.alumno_idx,
            weekIndex: data.semana_idx,
            amount: Number(data.monto),
            isSharedPayment: data.es_compartido,
            siblingIndices: data.hermanos_idx || []
        });
        setCache(CACHE_KEYS.paymentHistory, history);
        return true;
    } catch (e) {
        console.error('Error adding payment to history:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'addPaymentToHistory', data: { studentIndex, weekIndex, amount, isSharedPayment, siblingIndices } });
            return true;
        }
        return false;
    }
}

async function addPaymentToHistoryToSupabase(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices) {
    const { error } = await supabaseClient
        .from('historial_pagos')
        .insert({ fecha: new Date().toISOString(), alumno_idx: studentIndex, semana_idx: weekIndex, monto: amount, es_compartido: isSharedPayment, hermanos_idx: siblingIndices });
    if (error) throw error;
}

async function getLastPaymentEntry() {
    const history = await getPaymentHistory();
    return history.length > 0 ? history[history.length - 1] : null;
}

async function removeLastPaymentEntry() {
    try {
        const history = await getPaymentHistory();
        if (history.length > 0) {
            const lastId = history[history.length - 1].id;
            const { error } = await supabaseClient
                .from('historial_pagos')
                .delete()
                .eq('id', lastId);
            if (error) throw error;
        }
        return true;
    } catch (e) {
        console.error('Error removing last payment entry:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'removeLastPaymentEntry', data: {} });
            return true;
        }
        return false;
    }
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
    try {
        await supabaseClient.from('pagos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing payments:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearPayments', data: {} });
            return true;
        }
        return false;
    }
}

async function clearPaymentsToSupabase() {
    await supabaseClient.from('pagos').delete().neq('id', 0);
}

async function clearDaysToPay() {
    try {
        await supabaseClient.from('dias_aseo').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing days to pay:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearDaysToPay', data: {} });
            return true;
        }
        return false;
    }
}

async function clearDaysToPayToSupabase() {
    await supabaseClient.from('dias_aseo').delete().neq('id', 0);
}

async function clearMovements() {
    try {
        await supabaseClient.from('movimientos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing movements:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearMovements', data: {} });
            return true;
        }
        return false;
    }
}

async function clearMovementsToSupabase() {
    await supabaseClient.from('movimientos').delete().neq('id', 0);
}

async function clearSiblings() {
    try {
        await supabaseClient.from('hermanos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing siblings:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearSiblings', data: {} });
            return true;
        }
        return false;
    }
}

async function clearSiblingsToSupabase() {
    await supabaseClient.from('hermanos').delete().neq('id', 0);
}

async function clearSavedWeeks() {
    try {
        await supabaseClient.from('semanas_cerradas').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing saved weeks:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearSavedWeeks', data: {} });
            return true;
        }
        return false;
    }
}

async function clearSavedWeeksToSupabase() {
    await supabaseClient.from('semanas_cerradas').delete().neq('id', 0);
}

async function clearPaymentHistory() {
    try {
        await supabaseClient.from('historial_pagos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing payment history:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'clearPaymentHistory', data: {} });
            return true;
        }
        return false;
    }
}

async function clearPaymentHistoryToSupabase() {
    await supabaseClient.from('historial_pagos').delete().neq('id', 0);
}

async function resetAllData() {
    try {
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
        await saveSettings(DEFAULT_SETTINGS);
        return true;
    } catch (e) {
        console.error('Error resetting all data:', e);
        if (!isOnline()) {
            addToOfflineQueue({ type: 'resetAllData', data: {} });
            return true;
        }
        return false;
    }
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

// ==================== SYNC EXPORTS ====================
async function forceSyncNow() {
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
    // Offline functions
    isOnline, syncOfflineQueue, forceSyncNow, getPendingSyncCount
};