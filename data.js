// Supabase Data Layer - All CRUD operations using async/await
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

function generatePaymentKey(studentIndex, weekIndex) {
    return `${studentIndex}-${weekIndex}`;
}

// ==================== STUDENTS ====================
async function getStudents() {
    try {
        const { data, error } = await supabaseClient
            .from('alumnos')
            .select('id, nombre, orden')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            // Initialize with defaults if empty
            await initializeDefaultStudents();
            return DEFAULT_STUDENTS;
        }
        
        return data.map(d => d.nombre);
    } catch (e) {
        console.error('Error getting students:', e);
        return DEFAULT_STUDENTS;
    }
}

async function saveStudents(students) {
    try {
        // Delete all existing and insert new
        await supabaseClient.from('alumnos').delete().neq('id', 0);
        
        const records = students.map((nombre, index) => ({
            nombre,
            orden: index + 1
        }));
        
        const { error } = await supabaseClient.from('alumnos').insert(records);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error saving students:', e);
        return false;
    }
}

async function initializeDefaultStudents() {
    const records = DEFAULT_STUDENTS.map((nombre, index) => ({
        nombre,
        orden: index + 1
    }));
    await supabaseClient.from('alumnos').insert(records);
}

// ==================== WEEKS ====================
async function getWeeks() {
    try {
        const { data, error } = await supabaseClient
            .from('semanas')
            .select('id, nombre, orden')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            await initializeDefaultWeeks();
            return DEFAULT_WEEKS;
        }
        
        return data.map(d => d.nombre);
    } catch (e) {
        console.error('Error getting weeks:', e);
        return DEFAULT_WEEKS;
    }
}

async function saveWeeks(weeks) {
    try {
        await supabaseClient.from('semanas').delete().neq('id', 0);
        
        const records = weeks.map((nombre, index) => ({
            nombre,
            orden: index + 1
        }));
        
        const { error } = await supabaseClient.from('semanas').insert(records);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error saving weeks:', e);
        return false;
    }
}

async function initializeDefaultWeeks() {
    const records = DEFAULT_WEEKS.map((nombre, index) => ({
        nombre,
        orden: index + 1
    }));
    await supabaseClient.from('semanas').insert(records);
}

// ==================== SETTINGS ====================
async function getSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('clave, valor')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (!data) {
            return { ...DEFAULT_SETTINGS };
        }
        
        return {
            weeklyFee: parseInt(data.valor?.cuota_semanal) || DEFAULT_SETTINGS.weeklyFee
        };
    } catch (e) {
        console.error('Error getting settings:', e);
        return { ...DEFAULT_SETTINGS };
    }
}

async function saveSettings(settings) {
    try {
        const { error } = await supabaseClient
            .from('configuracion')
            .upsert({ 
                id: 1, 
                clave: 'settings',
                valor: { cuota_semanal: settings.weeklyFee }
            });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error saving settings:', e);
        return false;
    }
}

// ==================== PAYMENTS ====================
async function getPayments() {
    try {
        const { data, error } = await supabaseClient
            .from('pagos')
            .select('alumno_idx, semana_idx, estado');
        
        if (error) throw error;
        
        const payments = {};
        data?.forEach(d => {
            payments[generatePaymentKey(d.alumno_idx, d.semana_idx)] = d.estado;
        });
        return payments;
    } catch (e) {
        console.error('Error getting payments:', e);
        return {};
    }
}

async function savePayments(payments) {
    try {
        // Convert payments object to array of records
        const records = Object.entries(payments).map(([key, estado]) => {
            const [alumno_idx, semana_idx] = key.split('-').map(Number);
            return { alumno_idx, semana_idx, estado };
        });
        
        // Delete all and re-insert (simpler than upsert for this case)
        await supabaseClient.from('pagos').delete().neq('id', 0);
        
        if (records.length > 0) {
            const { error } = await supabaseClient.from('pagos').insert(records);
            if (error) throw error;
        }
        return true;
    } catch (e) {
        console.error('Error saving payments:', e);
        return false;
    }
}

async function updatePayment(studentIndex, weekIndex, status) {
    try {
        const key = generatePaymentKey(studentIndex, weekIndex);
        const { error } = await supabaseClient
            .from('pagos')
            .upsert({ 
                alumno_idx: studentIndex, 
                semana_idx: weekIndex, 
                estado: status 
            }, { onConflict: 'alumno_idx,semana_idx' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error updating payment:', e);
        return false;
    }
}

// ==================== DAYS TO PAY ====================
async function getDaysToPay() {
    try {
        const { data, error } = await supabaseClient
            .from('dias_aseo')
            .select('semana_idx, dias');
        
        if (error) throw error;
        
        const days = {};
        data?.forEach(d => {
            days[d.semana_idx] = d.dias;
        });
        return days;
    } catch (e) {
        console.error('Error getting days to pay:', e);
        return {};
    }
}

async function saveDaysToPay(days) {
    try {
        const records = Object.entries(days).map(([semana_idx, dias]) => ({
            semana_idx: Number(semana_idx),
            dias: Number(dias)
        }));
        
        await supabaseClient.from('dias_aseo').delete().neq('id', 0);
        
        if (records.length > 0) {
            const { error } = await supabaseClient.from('dias_aseo').insert(records);
            if (error) throw error;
        }
        return true;
    } catch (e) {
        console.error('Error saving days to pay:', e);
        return false;
    }
}

// ==================== MOVEMENTS ====================
async function getMovements() {
    try {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('id, fecha, semana_idx, tipo, monto, descripcion, saldo')
            .order('fecha', { ascending: true });
        
        if (error) throw error;
        
        return data?.map(d => ({
            id: d.id,
            date: d.fecha,
            weekIndex: d.semana_idx,
            type: d.tipo,
            amount: Number(d.monto),
            description: d.descripcion,
            balance: Number(d.saldo)
        })) || [];
    } catch (e) {
        console.error('Error getting movements:', e);
        return [];
    }
}

async function addMovement(type, weekIndex, amount, description) {
    try {
        const movements = await getMovements();
        const lastBalance = movements.length > 0 ? movements[movements.length - 1].balance : 0;
        const balance = type === 'income' ? lastBalance + amount : lastBalance - amount;
        
        const { data, error } = await supabaseClient
            .from('movimientos')
            .insert({
                fecha: new Date().toISOString(),
                semana_idx: weekIndex,
                tipo: type,
                monto: amount,
                descripcion: description,
                saldo: balance
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error adding movement:', e);
        return null;
    }
}

// ==================== SIBLINGS ====================
async function getSiblings() {
    try {
        const { data, error } = await supabaseClient
            .from('hermanos')
            .select('id, grupo_idx, alumno_idx, pago_compartido')
            .order('grupo_idx', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) return [];
        
        // Group by grupo_idx
        const groups = {};
        data.forEach(d => {
            if (!groups[d.grupo_idx]) {
                groups[d.grupo_idx] = { members: [], sharedPayment: d.pago_compartido };
            }
            groups[d.grupo_idx].members.push(d.alumno_idx);
        });
        
        return Object.values(groups);
    } catch (e) {
        console.error('Error getting siblings:', e);
        return [];
    }
}

async function saveSiblings(siblings) {
    try {
        await supabaseClient.from('hermanos').delete().neq('id', 0);
        
        const records = [];
        siblings.forEach((group, grupo_idx) => {
            group.members.forEach(alumno_idx => {
                records.push({
                    grupo_idx,
                    alumno_idx,
                    pago_compartido: group.sharedPayment
                });
            });
        });
        
        if (records.length > 0) {
            const { error } = await supabaseClient.from('hermanos').insert(records);
            if (error) throw error;
        }
        return true;
    } catch (e) {
        console.error('Error saving siblings:', e);
        return false;
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
    try {
        const { data, error } = await supabaseClient
            .from('semanas_cerradas')
            .select('semana_idx');
        
        if (error) throw error;
        
        const saved = {};
        data?.forEach(d => {
            saved[d.semana_idx] = true;
        });
        return saved;
    } catch (e) {
        console.error('Error getting saved weeks:', e);
        return {};
    }
}

async function saveWeek(weekIndex) {
    try {
        const { error } = await supabaseClient
            .from('semanas_cerradas')
            .upsert({ semana_idx: weekIndex }, { onConflict: 'semana_idx' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error saving week:', e);
        return false;
    }
}

// ==================== PAYMENT HISTORY ====================
async function getPaymentHistory() {
    try {
        const { data, error } = await supabaseClient
            .from('historial_pagos')
            .select('id, fecha, alumno_idx, semana_idx, monto, es_compartido, hermanos_idx')
            .order('fecha', { ascending: true });
        
        if (error) throw error;
        
        return data?.map(d => ({
            id: d.id,
            date: d.fecha,
            studentIndex: d.alumno_idx,
            weekIndex: d.semana_idx,
            amount: Number(d.monto),
            isSharedPayment: d.es_compartido,
            siblingIndices: d.hermanos_idx || []
        })) || [];
    } catch (e) {
        console.error('Error getting payment history:', e);
        return [];
    }
}

async function addPaymentToHistory(studentIndex, weekIndex, amount, isSharedPayment, siblingIndices) {
    try {
        const { error } = await supabaseClient
            .from('historial_pagos')
            .insert({
                fecha: new Date().toISOString(),
                alumno_idx: studentIndex,
                semana_idx: weekIndex,
                monto: amount,
                es_compartido: isSharedPayment,
                hermanos_idx: siblingIndices
            });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error adding payment to history:', e);
        return false;
    }
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
        return false;
    }
}

// ==================== UTILITIES ====================
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ==================== CLEAR SPECIFIC TABLES ====================
async function clearPayments() {
    try {
        await supabaseClient.from('pagos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing payments:', e);
        return false;
    }
}

async function clearDaysToPay() {
    try {
        await supabaseClient.from('dias_aseo').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing days to pay:', e);
        return false;
    }
}

async function clearMovements() {
    try {
        await supabaseClient.from('movimientos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing movements:', e);
        return false;
    }
}

async function clearSiblings() {
    try {
        await supabaseClient.from('hermanos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing siblings:', e);
        return false;
    }
}

async function clearSavedWeeks() {
    try {
        await supabaseClient.from('semanas_cerradas').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing saved weeks:', e);
        return false;
    }
}

async function clearPaymentHistory() {
    try {
        await supabaseClient.from('historial_pagos').delete().neq('id', 0);
        return true;
    } catch (e) {
        console.error('Error clearing payment history:', e);
        return false;
    }
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
        
        // Re-initialize defaults
        await initializeDefaultStudents();
        await initializeDefaultWeeks();
        await saveSettings(DEFAULT_SETTINGS);
        
        return true;
    } catch (e) {
        console.error('Error resetting all data:', e);
        return false;
    }
}

// Export all functions for use in app.js
window.DataAPI = {
    getStudents,
    saveStudents,
    getWeeks,
    saveWeeks,
    getSettings,
    saveSettings,
    getPayments,
    savePayments,
    updatePayment,
    getDaysToPay,
    saveDaysToPay,
    getMovements,
    addMovement,
    getSiblings,
    saveSiblings,
    getSiblingGroup,
    getAllSiblingIndices,
    isSiblingException,
    getSavedWeeks,
    saveWeek,
    getPaymentHistory,
    addPaymentToHistory,
    getLastPaymentEntry,
    removeLastPaymentEntry,
    clearPayments,
    clearDaysToPay,
    clearMovements,
    clearSiblings,
    clearSavedWeeks,
    clearPaymentHistory,
    resetAllData,
    formatCurrency,
    formatDate,
    PAYMENT_STATUS,
    DEFAULT_SETTINGS,
    DEFAULT_STUDENTS,
    DEFAULT_WEEKS,
    generatePaymentKey
};