let currentView = 'home';
let students = [];
let weeks = [];
let settings = {};
let payments = {};
let daysToPay = {};
let movements = [];
let siblings = [];
let savedWeeks = {};

const tbody = document.getElementById('payments-tbody');
const thead = document.querySelector('.payments-table thead');
const tfoot = document.getElementById('payments-tfoot');
const headerRow = document.querySelector('.header-row');
const weekHeaderRow = document.querySelector('.week-header-row');
const fundBalance = document.getElementById('fund-balance');
const movementsTbody = document.getElementById('movements-tbody');
const emptyMovements = document.getElementById('empty-movements');
const weeklyFeeInput = document.getElementById('weekly-fee');
const studentsList = document.getElementById('students-list');
const weeksList = document.getElementById('weeks-list');
const btnSaveStudents = document.getElementById('btn-save-students');
const btnSaveWeeks = document.getElementById('btn-save-weeks');
const btnResetAll = document.getElementById('btn-reset-all');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportJson = document.getElementById('btn-export-json');
const btnPrint = document.getElementById('btn-print');

const paymentStudentSelect = document.getElementById('payment-student');
const paymentModeSelect = document.getElementById('payment-mode');
const advanceWeeksGroup = document.getElementById('advance-weeks-group');
const advanceWeeksInput = document.getElementById('advance-weeks');
const advanceTotalHint = document.getElementById('advance-total-hint');
const btnRegisterPayment = document.getElementById('btn-register-payment');
const btnPaymentText = document.getElementById('btn-payment-text');
const btnUndoPayment = document.getElementById('btn-undo-payment');

const revertStudentSelect = document.getElementById('revert-student');
const revertWeekSelect = document.getElementById('revert-week');
const btnRevertPayment = document.getElementById('btn-revert-payment');

const siblingsContainer = document.getElementById('siblings-container');
const btnAddSiblingGroup = document.getElementById('btn-add-sibling-group');

async function init() {
    await loadData();
    renderHeader();
    renderTable();
    renderPaymentPanel();
    renderRevertPanel();
    renderFundView();
    renderSettings();
    renderSiblings();
    setupEventListeners();
    setupNav();
}

async function loadData() {
    const isOnline = navigator.onLine;
    console.log('[loadData] Iniciando carga de datos. Online:', isOnline);
    
    try {
        // Cargar datos en paralelo - Cloud-first: consulta Supabase cuando hay internet
        const [studentsData, weeksData, settingsData, paymentsData, daysToPayData, movementsData, siblingsData, savedWeeksData] = await Promise.all([
            DataAPI.getStudents(),
            DataAPI.getWeeks(),
            DataAPI.getSettings(),
            DataAPI.getPayments(),
            DataAPI.getDaysToPay(),
            DataAPI.getMovements(),
            DataAPI.getSiblings(),
            DataAPI.getSavedWeeks()
        ]);
        
        students = studentsData;
        weeks = weeksData;
        settings = settingsData;
        payments = paymentsData;
        daysToPay = daysToPayData;
        movements = movementsData;
        siblings = siblingsData;
        savedWeeks = savedWeeksData;
        
        console.log('[loadData] Datos cargados exitosamente:', {
            students: students.length,
            weeks: weeks.length,
            settings,
            paymentsCount: Object.keys(payments).length,
            movements: movements.length,
            siblings: siblings.length,
            savedWeeksCount: Object.keys(savedWeeks).length,
            source: navigator.onLine ? 'Supabase (Cloud-First)' : 'localStorage (Offline)'
        });
        
        // Mostrar indicador visual de estado de conexión
        updateConnectionIndicator(navigator.onLine);
        
    } catch (e) {
        console.error('Error loading data:', e);
        // Fallback to defaults
        students = DataAPI.DEFAULT_STUDENTS;
        weeks = DataAPI.DEFAULT_WEEKS;
        settings = DataAPI.DEFAULT_SETTINGS;
        payments = {};
        daysToPay = {};
        movements = [];
        siblings = [];
        savedWeeks = {};
        
        // Aún así mostrar indicador
        updateConnectionIndicator(false);
    }
}

function renderHeader() {
    headerRow.innerHTML = '<th class="student-header" scope="col">Alumno</th>';
    weekHeaderRow.innerHTML = '<th class="student-header"></th>';

    weeks.forEach((week, index) => {
        const th1 = document.createElement('th');
        th1.scope = 'col';
        th1.textContent = `Sem ${index + 1}`;
        th1.className = 'week-col';
        headerRow.appendChild(th1);

        const th2 = document.createElement('th');
        th2.scope = 'col';
        th2.textContent = week;
        th2.className = 'week-date';
        weekHeaderRow.appendChild(th2);
    });
}

function renderTable() {
    tbody.innerHTML = '';

    students.forEach((student, studentIndex) => {
        const tr = document.createElement('tr');
        tr.dataset.studentIndex = studentIndex;

        const nameTd = document.createElement('td');
        nameTd.textContent = `${studentIndex + 1}. ${student}`;
        nameTd.scope = 'row';
        tr.appendChild(nameTd);

        weeks.forEach((week, weekIndex) => {
            const td = document.createElement('td');
            const key = generatePaymentKey(studentIndex, weekIndex);
            const status = payments[key] || PAYMENT_STATUS.PENDING;
            const statusBadge = createPaymentStatusBadge(status);
            td.appendChild(statusBadge);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    renderSummaryRows();
}

function createPaymentStatusBadge(status) {
    const span = document.createElement('span');
    span.className = `payment-status ${status}`;
    
    const labels = {
        [DataAPI.PAYMENT_STATUS.PENDING]: 'Pendiente',
        [DataAPI.PAYMENT_STATUS.PAID]: 'Pagado'
    };
    
    span.textContent = labels[status] || 'Pendiente';
    span.setAttribute('aria-label', `Estado: ${labels[status] || 'Pendiente'}`);
    return span;
}

async function renderPaymentPanel() {
    paymentStudentSelect.innerHTML = '<option value="">-- Seleccionar alumno --</option>';
    
    students.forEach((student, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${student}`;
        paymentStudentSelect.appendChild(option);
    });

    updatePaymentModeUI();
    updateRegisterButtonState();
    updateAdvanceTotalHint();
    await updateUndoButtonState();
    await updateLastPaymentInfo();
}

async function renderRevertPanel() {
    // Populate student selector
    revertStudentSelect.innerHTML = '<option value="">-- Seleccionar alumno --</option>';
    students.forEach((student, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${student}`;
        revertStudentSelect.appendChild(option);
    });

    // Initialize week selector with default message
    revertWeekSelect.innerHTML = '<option value="">-- Selecciona alumno primero --</option>';
    revertWeekSelect.disabled = true;

    // Add event listener to update weeks when student changes
    revertStudentSelect.removeEventListener('change', onRevertStudentChange);
    revertStudentSelect.addEventListener('change', onRevertStudentChange);

    updateRevertButtonState();
}

function onRevertStudentChange() {
    const studentIndex = parseInt(revertStudentSelect.value);
    
    if (isNaN(studentIndex)) {
        // No student selected - show default message
        revertWeekSelect.innerHTML = '<option value="">-- Selecciona alumno primero --</option>';
        revertWeekSelect.disabled = true;
        updateRevertButtonState();
        return;
    }

    // Get all sibling indices for this student (handles shared payment groups)
    const siblingIndices = DataAPI.getAllSiblingIndices(studentIndex, siblings);
    
    // Find weeks that are "Pagado" for ANY of the siblings in the group
    const paidWeeks = [];
    weeks.forEach((week, weekIndex) => {
        const isPaidForGroup = siblingIndices.some(sibIndex => {
            const key = DataAPI.generatePaymentKey(sibIndex, weekIndex);
            const status = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
            return status === DataAPI.PAYMENT_STATUS.PAID;
        });
        
        if (isPaidForGroup) {
            paidWeeks.push({ index: weekIndex, name: week });
        }
    });

    // Populate week selector with only paid weeks
    if (paidWeeks.length === 0) {
        revertWeekSelect.innerHTML = '<option value="">-- No hay semanas pagadas para este alumno --</option>';
        revertWeekSelect.disabled = true;
    } else {
        revertWeekSelect.innerHTML = '<option value="">-- Seleccionar semana --</option>';
        paidWeeks.forEach(({ index, name }) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Sem ${index + 1}: ${name}`;
            revertWeekSelect.appendChild(option);
        });
        revertWeekSelect.disabled = false;
    }

    updateRevertButtonState();
}

function updateRevertButtonState() {
    const studentSelected = revertStudentSelect.value !== '';
    const weekSelected = revertWeekSelect.value !== '';
    const bothSelected = studentSelected && weekSelected;
    
    btnRevertPayment.disabled = !bothSelected;
    
    if (bothSelected) {
        const studentIndex = parseInt(revertStudentSelect.value);
        const weekIndex = parseInt(revertWeekSelect.value);
        const key = DataAPI.generatePaymentKey(studentIndex, weekIndex);
        const status = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
        
        if (status === DataAPI.PAYMENT_STATUS.PAID) {
            btnRevertPayment.disabled = false;
            btnRevertPayment.title = `Marcar como Pendiente para ${students[studentIndex]} en Sem ${weekIndex + 1}`;
        } else {
            btnRevertPayment.disabled = true;
            btnRevertPayment.title = 'Esta semana ya está en Pendiente para este alumno';
        }
    }
}

function updatePaymentModeUI() {
    const mode = paymentModeSelect.value;
    const isAdvance = mode === 'advance';
    
    advanceWeeksGroup.style.display = isAdvance ? 'flex' : 'none';
    btnPaymentText.textContent = isAdvance ? 'Registrar Adelanto' : 'Registrar Pago';
    
    updateAdvanceTotalHint();
}

function updateAdvanceTotalHint() {
    const amount = settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee;
    const weeks = parseInt(advanceWeeksInput.value) || 0;
    const total = amount * weeks;
    advanceTotalHint.textContent = `Total: ${DataAPI.formatCurrency(total)}`;
}

function updateRegisterButtonState() {
    const studentSelected = paymentStudentSelect.value !== '';
    const mode = paymentModeSelect.value;
    const weeksValid = mode !== 'advance' || (parseInt(advanceWeeksInput.value) || 0) >= 2;
    btnRegisterPayment.disabled = !studentSelected || !weeksValid;
}

async function updateUndoButtonState() {
    const lastEntry = await DataAPI.getLastPaymentEntry();
    const hasHistory = lastEntry !== null;
    btnUndoPayment.disabled = !hasHistory;
    btnUndoPayment.title = hasHistory 
        ? `Deshacer: ${students[lastEntry.studentIndex] || 'Alumno'} - Sem ${lastEntry.weekIndex + 1} (${DataAPI.formatCurrency(lastEntry.amount)})`
        : 'No hay pagos para deshacer';
}

async function updateLastPaymentInfo() {
    const lastEntry = await DataAPI.getLastPaymentEntry();
    let infoEl = document.getElementById('last-payment-info');
    if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.id = 'last-payment-info';
        infoEl.className = 'last-payment-info';
        const controls = document.querySelector('.payment-panel-controls');
        controls.parentNode.insertBefore(infoEl, controls.nextSibling);
    }
    
    if (lastEntry) {
        const studentName = students[lastEntry.studentIndex] || 'Alumno eliminado';
        const siblingText = lastEntry.isSharedPayment && lastEntry.siblingIndices.length > 1
            ? ` (compartido con ${lastEntry.siblingIndices.length - 1} hermano${lastEntry.siblingIndices.length > 2 ? 's' : ''})`
            : '';
        infoEl.innerHTML = `
            <span class="info-label">Último pago:</span>
            <span class="info-value">${studentName} - Sem ${lastEntry.weekIndex + 1}${siblingText} - ${DataAPI.formatCurrency(lastEntry.amount)}</span>
        `;
        infoEl.style.display = 'flex';
    } else {
        infoEl.style.display = 'none';
    }
}

function calculateWeekTotal(weekIndex) {
    const amount = settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee;
    let total = 0;
    const processedGroups = new Set();
    
    students.forEach((_, studentIndex) => {
        const key = DataAPI.generatePaymentKey(studentIndex, weekIndex);
        const status = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
        
        if (status !== DataAPI.PAYMENT_STATUS.PAID) return;
        
        const group = DataAPI.getSiblingGroup(studentIndex, siblings);
        
        if (group && group.sharedPayment === true) {
            const groupKey = siblings.indexOf(group);
            if (processedGroups.has(groupKey)) return;
            processedGroups.add(groupKey);
            total += amount;
        } else {
            total += amount;
        }
    });
    
    return total;
}

function renderSummaryRows() {
    const totalRow = document.querySelector('.total-row');
    const daysRow = document.querySelector('.days-row');
    const paymentRow = document.querySelector('.payment-row');
    const fundRow = document.querySelector('.fund-row');
    const saveRow = document.querySelector('.save-row');

    const summaryRows = [totalRow, daysRow, paymentRow, fundRow, saveRow];
    summaryRows.forEach(row => {
        while (row.children.length > 1) {
            row.removeChild(row.lastChild);
        }
    });

    const CLEANING_RATE_PER_DAY = 80;

    weeks.forEach((week, weekIndex) => {
        const total = calculateWeekTotal(weekIndex);
        const days = daysToPay[weekIndex] ?? 0;
        const cleaningPayment = days * CLEANING_RATE_PER_DAY;
        const fund = total - cleaningPayment;
        const isSaved = savedWeeks[weekIndex] === true;

        const totalTd = document.createElement('td');
        totalTd.textContent = DataAPI.formatCurrency(total);
        totalRow.appendChild(totalTd);

        const daysTd = document.createElement('td');
        const daysSelect = document.createElement('select');
        daysSelect.dataset.weekIndex = weekIndex;
        daysSelect.disabled = isSaved;
        for (let i = 0; i <= 5; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            const dayLabel = i === 1 ? 'día' : 'días';
            opt.textContent = `${i} ${dayLabel} ($${i * CLEANING_RATE_PER_DAY})`;
            opt.selected = i === days;
            daysSelect.appendChild(opt);
        }
        daysSelect.addEventListener('change', handleDaysChange);
        daysTd.appendChild(daysSelect);
        daysRow.appendChild(daysTd);

        const paymentTd = document.createElement('td');
        paymentTd.textContent = DataAPI.formatCurrency(cleaningPayment);
        paymentRow.appendChild(paymentTd);

        const fundTd = document.createElement('td');
        fundTd.textContent = DataAPI.formatCurrency(fund);
        fundTd.className = fund >= 0 ? '' : 'negative';
        fundRow.appendChild(fundTd);

        const saveTd = document.createElement('td');
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = `btn ${isSaved ? 'btn-secondary' : 'btn-primary'} btn-sm save-week-btn`;
        saveBtn.dataset.weekIndex = weekIndex;
        saveBtn.disabled = isSaved;
        saveBtn.textContent = isSaved ? 'Guardado' : 'Cerrar Semana';
        saveBtn.addEventListener('click', handleSaveWeek);
        saveTd.appendChild(saveBtn);
        saveRow.appendChild(saveTd);
    });
}

async function handleDaysChange(event) {
    const select = event.target;
    const weekIndex = parseInt(select.dataset.weekIndex);
    
    if (savedWeeks[weekIndex]) {
        select.value = daysToPay[weekIndex] ?? 0;
        return;
    }
    
    daysToPay[weekIndex] = parseInt(select.value);
    await DataAPI.saveDaysToPay(daysToPay);
    renderSummaryRows();
}

async function handleSaveWeek(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.target;
    const weekIndex = parseInt(button.dataset.weekIndex);
    
    if (savedWeeks[weekIndex]) {
        return;
    }
    
    const total = calculateWeekTotal(weekIndex);
    const days = daysToPay[weekIndex] ?? 0;
    const cleaningPayment = days * 80;
    const fund = total - cleaningPayment;

    if (fund === 0) {
        alert(`Semana ${weekIndex + 1}: El fondo es $0. No hay nada que cerrar.`);
        return;
    }

    const confirmMessage = 
        `¿Cerrar la semana ${weekIndex + 1}?\n\n` +
        `Total recaudado: ${DataAPI.formatCurrency(total)}\n` +
        `Pago aseo (${days} día${days === 1 ? '' : 's'}): ${DataAPI.formatCurrency(cleaningPayment)}\n` +
        `Fondo a guardar: ${DataAPI.formatCurrency(fund)}\n\n` +
        `Esta acción registrará el fondo en la caja y bloqueará la semana permanentemente.`;

    if (!confirm(confirmMessage)) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Guardando...';

    // Add movement and get the new movement data from Supabase
    const newMovement = await DataAPI.addMovement('income', weekIndex, fund, `Cierre de fondo - Semana ${weekIndex + 1}`);
    await DataAPI.saveWeek(weekIndex);
    
    // Update local movements array with the new movement from Supabase
    if (newMovement) {
        movements.push(newMovement);
    }
    
    savedWeeks[weekIndex] = true;
    renderSummaryRows();
    renderFundView();
    
    alert(`✅ Semana ${weekIndex + 1} cerrada correctamente.\nFondo guardado: ${DataAPI.formatCurrency(fund)}`);
}

function renderFundView() {
    const balance = movements.length > 0 ? movements[movements.length - 1].balance : 0;
    fundBalance.textContent = DataAPI.formatCurrency(balance);
    fundBalance.className = 'fund-balance' + (balance < 0 ? ' negative' : '');

    movementsTbody.innerHTML = '';
    if (movements.length === 0) {
        emptyMovements.style.display = 'block';
    } else {
        emptyMovements.style.display = 'none';
        [...movements].reverse().forEach(movement => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${DataAPI.formatDate(movement.date)}</td>
                <td>Sem ${movement.weekIndex + 1}</td>
                <td>${movement.description}</td>
                <td class="${movement.type === 'income' ? 'income' : ''}">${movement.type === 'income' ? '+' : ''}${DataAPI.formatCurrency(movement.amount)}</td>
                <td class="${movement.type === 'expense' ? 'expense' : ''}">${movement.type === 'expense' ? '+' : ''}${DataAPI.formatCurrency(movement.amount)}</td>
                <td>${DataAPI.formatCurrency(movement.balance)}</td>
            `;
            movementsTbody.appendChild(tr);
        });
    }
}

function renderSettings() {
    weeklyFeeInput.value = settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee;
    studentsList.value = students.join('\n');
    weeksList.value = weeks.join('\n');
}

function renderSiblings() {
    siblingsContainer.innerHTML = '';
    
    if (siblings.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'siblings-empty';
        emptyDiv.textContent = 'No hay grupos de hermanos configurados. Agrega uno para comenzar.';
        siblingsContainer.appendChild(emptyDiv);
        return;
    }
    
    siblings.forEach((group, groupIndex) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'sibling-group';
        groupDiv.dataset.groupIndex = groupIndex;
        
        const membersHtml = group.members.map((memberIndex, memberPos) => {
            const studentName = students[memberIndex] || 'Alumno eliminado';
            const options = students.map((s, i) => 
                `<option value="${i}" ${i === memberIndex ? 'selected' : ''}>${i + 1}. ${s}</option>`
            ).join('');
            
            return `
                <div class="sibling-member-row" data-member-pos="${memberPos}">
                    <select class="sibling-member-select" aria-label="Miembro ${memberPos + 1} del grupo">
                        ${options}
                    </select>
                    <button class="btn-icon danger" aria-label="Eliminar miembro" title="Eliminar miembro">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
        
        groupDiv.innerHTML = `
            <div class="sibling-group-header">
                <h3>Grupo de Hermanos ${groupIndex + 1}</h3>
                <div class="sibling-group-actions">
                    <button class="btn-icon" aria-label="Agregar miembro" title="Agregar hermano">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"></path>
                        </svg>
                    </button>
                    <button class="btn-icon danger" aria-label="Eliminar grupo" title="Eliminar grupo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="sibling-members">
                ${membersHtml}
            </div>
            <div class="sibling-rule">
                <label>
                    <input type="checkbox" class="sibling-shared-payment" ${group.sharedPayment ? 'checked' : ''}>
                    Pago compartido (un solo pago cubre a todos los hermanos del grupo)
                </label>
            </div>
        `;
        
        siblingsContainer.appendChild(groupDiv);
    });
    
    setupSiblingGroupEvents();
}

function setupSiblingGroupEvents() {
    // Add member buttons
    siblingsContainer.querySelectorAll('.sibling-group-header .btn-icon:not(.danger)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupDiv = e.target.closest('.sibling-group');
            const groupIndex = parseInt(groupDiv.dataset.groupIndex);
            addSiblingMember(groupIndex);
        });
    });
    
    // Delete group buttons
    siblingsContainer.querySelectorAll('.sibling-group-header .btn-icon.danger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupDiv = e.target.closest('.sibling-group');
            const groupIndex = parseInt(groupDiv.dataset.groupIndex);
            deleteSiblingGroup(groupIndex);
        });
    });
    
    // Delete member buttons
    siblingsContainer.querySelectorAll('.sibling-member-row .btn-icon.danger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('.sibling-member-row');
            const groupDiv = e.target.closest('.sibling-group');
            const groupIndex = parseInt(groupDiv.dataset.groupIndex);
            const memberPos = parseInt(row.dataset.memberPos);
            deleteSiblingMember(groupIndex, memberPos);
        });
    });
    
    // Member select changes
    siblingsContainer.querySelectorAll('.sibling-member-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const row = e.target.closest('.sibling-member-row');
            const groupDiv = e.target.closest('.sibling-group');
            const groupIndex = parseInt(groupDiv.dataset.groupIndex);
            const memberPos = parseInt(row.dataset.memberPos);
            const newStudentIndex = parseInt(e.target.value);
            updateSiblingMember(groupIndex, memberPos, newStudentIndex);
        });
    });
    
    // Shared payment checkbox
    siblingsContainer.querySelectorAll('.sibling-shared-payment').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const groupDiv = e.target.closest('.sibling-group');
            const groupIndex = parseInt(groupDiv.dataset.groupIndex);
            siblings[groupIndex].sharedPayment = e.target.checked;
            await DataAPI.saveSiblings(siblings);
        });
    });
}

async function addSiblingMember(groupIndex) {
    const availableStudents = students.filter((_, i) => 
        !siblings[groupIndex].members.includes(i)
    );
    
    if (availableStudents.length === 0) {
        alert('No hay más alumnos disponibles para agregar');
        return;
    }
    
    siblings[groupIndex].members.push(availableStudents[0]);
    await DataAPI.saveSiblings(siblings);
    renderSiblings();
}

async function deleteSiblingMember(groupIndex, memberPos) {
    if (siblings[groupIndex].members.length <= 2) {
        alert('Un grupo debe tener al menos 2 miembros');
        return;
    }
    siblings[groupIndex].members.splice(memberPos, 1);
    await DataAPI.saveSiblings(siblings);
    renderSiblings();
}

async function deleteSiblingGroup(groupIndex) {
    if (confirm('¿Eliminar este grupo de hermanos?')) {
        siblings.splice(groupIndex, 1);
        await DataAPI.saveSiblings(siblings);
        renderSiblings();
    }
}

async function updateSiblingMember(groupIndex, memberPos, newStudentIndex) {
    if (siblings[groupIndex].members.includes(newStudentIndex)) {
        alert('Este alumno ya está en el grupo');
        renderSiblings();
        return;
    }
    siblings[groupIndex].members[memberPos] = newStudentIndex;
    await DataAPI.saveSiblings(siblings);
    renderSiblings();
}

async function setupEventListeners() {
    // Listen for realtime data updates from DataAPI
    window.addEventListener('data-updated', async (e) => {
        console.log('[App] Realtime update received for:', e.detail?.table);
        await loadData();
        renderTable();
        renderFundView();
        renderPaymentPanel();
        await renderRevertPanel();
        renderSiblings();
        showToast(`Datos actualizados desde otro dispositivo`, 'info');
    });
    
    // Connection status indicator
    window.addEventListener('online', () => {
        updateConnectionIndicator(true);
    });
    
    window.addEventListener('offline', () => {
        updateConnectionIndicator(false);
        showToast('Modo offline: los cambios se guardarán localmente', 'warning');
    });
    
    weeklyFeeInput.addEventListener('change', async () => {
        settings.weeklyFee = parseInt(weeklyFeeInput.value) || DataAPI.DEFAULT_SETTINGS.weeklyFee;
        await DataAPI.saveSettings(settings);
        updateAdvanceTotalHint();
        renderSummaryRows();
        renderFundView();
        renderTable();
    });

    paymentStudentSelect.addEventListener('change', updateRegisterButtonState);
    paymentModeSelect.addEventListener('change', updatePaymentModeUI);
    advanceWeeksInput.addEventListener('input', () => {
        updateRegisterButtonState();
        updateAdvanceTotalHint();
    });

    btnRegisterPayment.addEventListener('click', handleRegisterPayment);
    btnUndoPayment.addEventListener('click', handleUndoPayment);
    btnRevertPayment.addEventListener('click', handleRevertPayment);

    revertStudentSelect.addEventListener('change', updateRevertButtonState);
    revertWeekSelect.addEventListener('change', updateRevertButtonState);

    btnAddSiblingGroup.addEventListener('click', async () => {
        if (students.length < 2) {
            alert('Se necesitan al menos 2 alumnos para crear un grupo de hermanos');
            return;
        }
        siblings.push({
            members: [0, 1],
            sharedPayment: true
        });
        await DataAPI.saveSiblings(siblings);
        renderSiblings();
    });

    btnSaveStudents.addEventListener('click', async () => {
        const newStudents = studentsList.value.split('\n').map(s => s.trim()).filter(s => s);
        if (newStudents.length === 0) {
            alert('Debe haber al menos un alumno');
            return;
        }
        students = newStudents;
        await DataAPI.saveStudents(students);
        payments = {};
        await DataAPI.clearPayments();
        daysToPay = {};
        await DataAPI.clearDaysToPay();
        movements = [];
        await DataAPI.clearMovements();
        siblings = [];
        await DataAPI.clearSiblings();
        savedWeeks = {};
        await DataAPI.clearSavedWeeks();
        await DataAPI.clearPaymentHistory();
        renderHeader();
        renderTable();
        await renderPaymentPanel();
        await renderRevertPanel();
        renderFundView();
        renderSiblings();
        alert('Alumnos guardados correctamente');
    });

    btnSaveWeeks.addEventListener('click', async () => {
        const newWeeks = weeksList.value.split('\n').map(s => s.trim()).filter(s => s);
        if (newWeeks.length === 0) {
            alert('Debe haber al menos una semana');
            return;
        }
        weeks = newWeeks;
        await DataAPI.saveWeeks(weeks);
        payments = {};
        await DataAPI.clearPayments();
        daysToPay = {};
        await DataAPI.clearDaysToPay();
        movements = [];
        await DataAPI.clearMovements();
        savedWeeks = {};
        await DataAPI.clearSavedWeeks();
        await DataAPI.clearPaymentHistory();
        renderHeader();
        renderTable();
        await renderPaymentPanel();
        await renderRevertPanel();
        renderFundView();
        alert('Semanas guardadas correctamente');
    });

    btnResetAll.addEventListener('click', async () => {
        if (confirm('¿Está seguro? Se perderán TODOS los datos (alumnos, semanas, pagos, movimientos, excepciones, semanas cerradas). Esta acción no se puede deshacer.')) {
            await DataAPI.resetAllData();
            location.reload();
        }
    });

    btnExportCsv.addEventListener('click', exportCSV);
    btnExportJson.addEventListener('click', exportJSON);
    btnPrint.addEventListener('click', () => window.print());
}

async function handleRegisterPayment() {
    const studentIndex = parseInt(paymentStudentSelect.value);
    const mode = paymentModeSelect.value;
    
    if (isNaN(studentIndex)) {
        alert('Seleccione un alumno');
        return;
    }

    const amount = settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee;
    let weeksToPay = 1;
    
    if (mode === 'advance') {
        weeksToPay = parseInt(advanceWeeksInput.value) || 2;
        if (weeksToPay < 2) {
            alert('Para adelantar, seleccione al menos 2 semanas');
            return;
        }
    }

    const siblingIndices = DataAPI.getAllSiblingIndices(studentIndex, siblings);
    const isSharedPayment = siblingIndices.length > 1 && DataAPI.isSiblingException(studentIndex, siblings);
    
    let totalPaymentsRegistered = 0;
    let totalAmount = 0;
    const paidWeeks = []; // Track each week paid for history

    if (isSharedPayment) {
        // Shared payment: only ONE payment for the whole family
        // Find the first unpaid week for the FIRST sibling (representative)
        const representativeIndex = siblingIndices[0];
        
        for (let i = 0; i < weeksToPay; i++) {
            const weekIndex = findNextUnpaidWeek(representativeIndex);
            if (weekIndex === -1) break;

            // Mark this week as paid for ALL siblings in the group
            siblingIndices.forEach(sibIndex => {
                const key = DataAPI.generatePaymentKey(sibIndex, weekIndex);
                const currentStatus = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
                if (currentStatus === DataAPI.PAYMENT_STATUS.PENDING) {
                    payments[key] = DataAPI.PAYMENT_STATUS.PAID;
                }
            });
            
            totalPaymentsRegistered++;
            totalAmount += amount;
            paidWeeks.push({ studentIndex: representativeIndex, weekIndex, amount, siblingIndices: [...siblingIndices] });
        }
    } else {
        // Individual payment: process each sibling separately
        siblingIndices.forEach(sibIndex => {
            let studentPayments = 0;
            for (let i = 0; i < weeksToPay; i++) {
                const weekIndex = findNextUnpaidWeek(sibIndex);
                if (weekIndex === -1) break;

                const key = DataAPI.generatePaymentKey(sibIndex, weekIndex);
                const currentStatus = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;

                if (currentStatus === DataAPI.PAYMENT_STATUS.PENDING) {
                    payments[key] = DataAPI.PAYMENT_STATUS.PAID;
                    studentPayments++;
                    totalAmount += amount;
                    paidWeeks.push({ studentIndex: sibIndex, weekIndex, amount });
                }
            }
            totalPaymentsRegistered += studentPayments;
        });
    }

    if (totalPaymentsRegistered > 0) {
        await DataAPI.savePayments(payments);
        
        // Save each payment to history for undo functionality
        paidWeeks.forEach(pw => {
            DataAPI.addPaymentToHistory(pw.studentIndex, pw.weekIndex, pw.amount, isSharedPayment, siblingIndices);
        });
        
        renderTable();
        renderPaymentPanel();
        await renderRevertPanel();
        
        const studentName = students[studentIndex];
        const message = isSharedPayment && siblingIndices.length > 1
            ? `Se registraron ${totalPaymentsRegistered} pago(s) compartido(s) para ${students[studentIndex]} y sus hermanos (Total: ${DataAPI.formatCurrency(totalAmount)})`
            : `Se registraron ${totalPaymentsRegistered} semana(s) de pago para ${students[studentIndex]} (Total: ${DataAPI.formatCurrency(totalAmount)})`;
        
        alert(message);
    } else {
        alert('No hay semanas pendientes disponibles para este alumno');
    }

    paymentStudentSelect.value = '';
    updateRegisterButtonState();
}

async function handleUndoPayment() {
    const lastEntry = await DataAPI.getLastPaymentEntry();
    
    if (!lastEntry) {
        alert('No hay pagos para deshacer');
        return;
    }
    
    const studentName = students[lastEntry.studentIndex] || 'Alumno eliminado';
    const weekNum = lastEntry.weekIndex + 1;
    const amount = DataAPI.formatCurrency(lastEntry.amount);
    const weekIndex = lastEntry.weekIndex;
    
    // Get ALL sibling indices for this student (handles shared payment groups)
    const allSiblingIndices = DataAPI.getAllSiblingIndices(lastEntry.studentIndex, siblings);
    const isSharedPayment = allSiblingIndices.length > 1 && DataAPI.isSiblingException(lastEntry.studentIndex, siblings);
    
    // Check if the week was already closed
    if (savedWeeks[weekIndex]) {
        const confirmMsg = 
            `⚠️ ADVERTENCIA: La semana ${weekNum} ya está CERRADA.\n\n` +
            `Al deshacer este pago:\n` +
            `- Se cambiará el estatus a "Pendiente" para ${studentName}${isSharedPayment ? ` y sus ${allSiblingIndices.length - 1} hermano(s)` : ''}\n` +
            `- El total de la semana disminuirá en ${amount}\n` +
            `- El fondo calculado de esa semana cambiará\n` +
            `- El movimiento de "Cierre de fondo" en la caja NO se elimina automáticamente\n\n` +
            `¿Desea continuar?`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
    }
    
    const confirmMsg = 
        `¿Deshacer el último pago?\n\n` +
        `Alumno: ${studentName}\n` +
        `Semana: ${weekNum}\n` +
        `Monto: ${amount}\n` +
        `${isSharedPayment 
            ? `\n⚠️ Este era un pago compartido. Se revertirá para ${allSiblingIndices.length} hermano(s) del grupo.`
            : ''}`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // Revert the payment for ALL siblings in the group
    let revertedCount = 0;
    allSiblingIndices.forEach(sibIndex => {
        const key = DataAPI.generatePaymentKey(sibIndex, weekIndex);
        if (payments[key] === DataAPI.PAYMENT_STATUS.PAID) {
            payments[key] = DataAPI.PAYMENT_STATUS.PENDING;
            revertedCount++;
        }
    });
    
    if (revertedCount > 0) {
        await DataAPI.savePayments(payments);
        await DataAPI.removeLastPaymentEntry();
        renderTable();
        await renderPaymentPanel();
        await renderRevertPanel();
        renderSummaryRows();
        
        const msg = isSharedPayment 
            ? `✅ Pago compartido deshecho correctamente.\n${revertedCount} registro(s) de ${allSiblingIndices.length} hermano(s) cambiado(s) a "Pendiente" para la semana ${weekNum}.`
            : `✅ Pago deshecho correctamente.\n${revertedCount} registro(s) cambiado(s) a "Pendiente" para la semana ${weekNum}.`;
        alert(msg);
    } else {
        alert('No se pudo deshacer: el pago ya no está en estado "Pagado"');
    }
}

async function handleRevertPayment() {
    const studentIndex = parseInt(revertStudentSelect.value);
    const weekIndex = parseInt(revertWeekSelect.value);
    
    if (isNaN(studentIndex) || isNaN(weekIndex)) {
        alert('Seleccione un alumno y una semana');
        return;
    }
    
    const key = DataAPI.generatePaymentKey(studentIndex, weekIndex);
    const currentStatus = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
    
    if (currentStatus !== DataAPI.PAYMENT_STATUS.PAID) {
        alert('Esta semana ya está en estado Pendiente para este alumno');
        return;
    }
    
    // Get ALL sibling indices for this student (handles shared payment groups)
    const allSiblingIndices = DataAPI.getAllSiblingIndices(studentIndex, siblings);
    const isSharedPayment = allSiblingIndices.length > 1 && DataAPI.isSiblingException(studentIndex, siblings);
    
    const studentName = students[studentIndex];
    const weekNum = weekIndex + 1;
    const amount = DataAPI.formatCurrency(settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee);
    
    // Check if the week was already closed
    if (savedWeeks[weekIndex]) {
        const confirmMsg = 
            `⚠️ ADVERTENCIA: La semana ${weekNum} ya está CERRADA.\n\n` +
            `Al revertir este pago:\n` +
            `- Se cambiará el estatus a "Pendiente" para ${studentName}${isSharedPayment ? ` y sus ${allSiblingIndices.length - 1} hermano(s)` : ''}\n` +
            `- El total de la semana disminuirá en ${amount}\n` +
            `- El fondo calculado de esa semana cambiará\n` +
            `- El movimiento de "Cierre de fondo" en la caja NO se elimina automáticamente\n\n` +
            `¿Desea continuar?`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
    }
    
    const confirmMsg = 
        `¿Marcar como Pendiente el pago?\n\n` +
        `Alumno: ${studentName}\n` +
        `Semana: ${weekNum}\n` +
        `Monto a revertir: ${amount}\n` +
        `${isSharedPayment 
            ? `\n⚠️ Este es un pago compartido. Se revertirá para ${allSiblingIndices.length} hermano(s) del grupo.`
            : ''}\n\n` +
        `Esta acción cambiará el estatus a "Pendiente".`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // Revert the payment for ALL siblings in the group
    let revertedCount = 0;
    allSiblingIndices.forEach(sibIndex => {
        const siblingKey = DataAPI.generatePaymentKey(sibIndex, weekIndex);
        if (payments[siblingKey] === DataAPI.PAYMENT_STATUS.PAID) {
            payments[siblingKey] = DataAPI.PAYMENT_STATUS.PENDING;
            revertedCount++;
        }
    });
    
    await DataAPI.savePayments(payments);
    
    renderTable();
    await renderRevertPanel();
    renderSummaryRows();
    
    const msg = isSharedPayment 
        ? `✅ Pago compartido revertido correctamente.\n${revertedCount} registro(s) de ${allSiblingIndices.length} hermano(s) cambiado(s) a "Pendiente" para la semana ${weekNum}.`
        : `✅ Pago revertido correctamente.\n${studentName} - Semana ${weekNum} marcado como Pendiente.`;
    alert(msg);
}

function findNextUnpaidWeek(studentIndex) {
    for (let i = 0; i < weeks.length; i++) {
        const key = DataAPI.generatePaymentKey(studentIndex, i);
        const status = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
        if (status === DataAPI.PAYMENT_STATUS.PENDING) {
            return i;
        }
    }
    return -1;
}

function setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`view-${view}`).classList.add('active');
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    currentView = view;
}

function exportCSV() {
    const headers = ['Alumno', ...weeks.map((w, i) => `Sem ${i + 1} (${w})`)];
    const rows = [headers.join(',')];

    students.forEach((student, studentIndex) => {
        const row = [student];
        weeks.forEach((_, weekIndex) => {
            const key = DataAPI.generatePaymentKey(studentIndex, weekIndex);
            const status = payments[key] || DataAPI.PAYMENT_STATUS.PENDING;
            const amount = settings.weeklyFee || DataAPI.DEFAULT_SETTINGS.weeklyFee;
            let value = '';
            if (status === DataAPI.PAYMENT_STATUS.PAID) value = `Pagado ($${amount})`;
            else value = 'Pendiente';
            row.push(value);
        });
        rows.push(row.join(','));
    });

    rows.push('');
    rows.push(['RESUMEN SEMANAL'].join(','));
    const summaryHeaders = ['Concepto', ...weeks.map((w, i) => `Sem ${i + 1}`)];
    rows.push(summaryHeaders.join(','));

    const summaryRowsData = [
        ['Total recaudado'],
        ['Días por pagar'],
        ['Pago aseo'],
        ['Fondo'],
        ['Semana cerrada']
    ];

    weeks.forEach((_, weekIndex) => {
        const total = calculateWeekTotal(weekIndex);
        const days = daysToPay[weekIndex] ?? 0;
        const cleaningPayment = days * 80;
        summaryRowsData[0].push(DataAPI.formatCurrency(total));
        summaryRowsData[1].push(`${days} día${days === 1 ? '' : 's'}`);
        summaryRowsData[2].push(DataAPI.formatCurrency(cleaningPayment));
        const fund = total - cleaningPayment;
        summaryRowsData[3].push(DataAPI.formatCurrency(fund));
        summaryRowsData[4].push(savedWeeks[weekIndex] ? 'Sí' : 'No');
    });

    summaryRowsData.forEach(row => rows.push(row.join(',')));

    const csv = rows.join('\n');
    downloadFile(csv, 'pagos_escolares.csv', 'text/csv;charset=utf-8;');
}

function exportJSON() {
    const data = {
        students,
        weeks,
        settings,
        payments,
        daysToPay,
        movements,
        siblings,
        savedWeeks,
        exportDate: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, 'pagos_escolares.json', 'application/json;charset=utf-8;');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function updateConnectionIndicator(isOnline) {
    let indicator = document.getElementById('connection-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            z-index: 1000;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(indicator);
    }
    
    indicator.textContent = isOnline ? '🟢 En línea' : '🔴 Sin conexión';
    indicator.style.backgroundColor = isOnline ? '#4CAF50' : '#f44336';
    indicator.style.color = 'white';
}

function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideUp 0.3s ease;
    `;
    
    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#f44336'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add toast animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideDown {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);