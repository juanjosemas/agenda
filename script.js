/* ==========================================
   CONFIGURACIÓN INICIAL Y VARIABLES GLOBALES
   ========================================== */
let offset = 0; 
let db = JSON.parse(localStorage.getItem('agenda_v9')) || {};

// Actualizamos ajustes con nuevas propiedades: nombre, color portada y contenido bolsillo
let settings = JSON.parse(localStorage.getItem('agenda_settings')) || {
    paper: 'plain',
    fontSize: 'medium',
    viewMode: 'double',
    ownerName: '',
    coverColor: 'brown',
    pocketNotes: ''
};

let clickTimer = null; 
let longPressTimer = null; 
let isLongPressActive = false; 

let lastEditedLineInfo = { key: null, index: null }; 
let currentActiveInput = null; 

const linesL = document.getElementById('lines-l');
const linesR = document.getElementById('lines-r');
const swipeArea = document.getElementById('swipe-area');
const notebook = document.querySelector('.notebook-container');

/**
 * Función de inicio
 */
function init() {
    // Cargar valores en el panel de ajustes
    document.getElementById('setting-paper').value = settings.paper;
    document.getElementById('setting-font-size').value = settings.fontSize;
    document.getElementById('setting-view').value = settings.viewMode;
    document.getElementById('setting-name').value = settings.ownerName || '';
    document.getElementById('setting-cover-color').value = settings.coverColor || 'brown';
    document.getElementById('pocket-textarea').value = settings.pocketNotes || '';

    applySettings(); 
    render();
    setupSwipe();

    setTimeout(() => {
        openNotebook();
    }, 2000);
}

/* ==========================================
   FUNCIONES DE LA PORTADA Y NAVEGACIÓN
   ========================================== */
function openNotebook() { notebook.classList.remove('is-closed'); }
function closeNotebook() { notebook.classList.add('is-closed'); }
function goToToday() { offset = 0; render(); }

function jumpToDate(dateString) {
    if (!dateString) return;
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    selectedDate.setHours(0,0,0,0);
    const diffDays = Math.floor((selectedDate - today) / (1000 * 60 * 60 * 24));
    
    if (settings.viewMode === 'double') {
        offset = (diffDays % 2 === 0) ? diffDays : diffDays - 1;
    } else {
        offset = diffDays;
    }
    render();
    openNotebook(); 
}

/* ==========================================
   RENDERIZADO
   ========================================== */
function render() {
    const leftData = getDayData(offset);
    const rightData = getDayData(offset + 1);

    // El encabezado superior mantiene el mes corto para ahorrar espacio
    document.getElementById('month-year').innerText = `${leftData.monthShort}. ${leftData.year}`;
    document.getElementById('week-display').innerText = `Semana ${leftData.week}`;

    if (settings.viewMode === 'single') {
        renderPageLines(linesR, leftData);
    } else {
        renderPageLines(linesL, leftData);
        renderPageLines(linesR, rightData);
    }
}

function renderPageLines(container, data) {
    container.innerHTML = '';
    const dayTasks = db[data.key] || {};
    
    const total = Object.keys(dayTasks).length;
    const completed = Object.values(dayTasks).filter(t => t.done).length;

    const headerLine = document.createElement('div');
    headerLine.className = `date-header-line ${data.isToday ? 'is-today-text' : ''}`;
    // CAMBIO: Se usa la clase 'day-month' para el mes para poder darle el margen en el CSS
    headerLine.innerHTML = `
        <div>
            <span class="day-name">${data.name}</span>
            <span class="day-num">${data.num}</span>
            <span class="day-month">${data.month}</span>
            ${total > 0 ? `<span class="day-progress">(${completed}/${total})</span>` : ''}
        </div>`;
    container.appendChild(headerLine);

    for (let i = 1; i < 24; i++) {
        const lineData = dayTasks[i] || { text: '', done: false, high: false, color: 'black' };
        const lineDiv = document.createElement('div');
        
        const inkClass = `ink-${lineData.color || 'black'}`;
        lineDiv.className = `note-line size-${settings.fontSize} ${inkClass} ${lineData.done ? 'completed' : ''} ${lineData.high ? 'highlighted' : ''}`;
        
        const span = document.createElement('span');
        span.innerText = lineData.text;
        lineDiv.appendChild(span);

        const del = document.createElement('div');
        del.className = 'delete-btn'; del.innerText = '×';
        del.onclick = (e) => { 
            e.stopPropagation(); 
            if(confirm("¿Borrar nota?")){ delete db[data.key][i]; save(); render(); }
        };
        lineDiv.appendChild(del);

        // PULSACIÓN LARGA
        const startPress = () => {
            isLongPressActive = false;
            longPressTimer = setTimeout(() => {
                if(lineData.text !== "") {
                    isLongPressActive = true;
                    if (!db[data.key]) db[data.key] = {};
                    db[data.key][i].high = !db[data.key][i].high;
                    save(); 
                    render();
                }
            }, 600); 
        };

        const endPress = () => clearTimeout(longPressTimer);

        lineDiv.onmousedown = startPress;
        lineDiv.ontouchstart = (e) => startPress();
        lineDiv.onmouseup = endPress;
        lineDiv.onmouseleave = endPress;
        lineDiv.ontouchend = endPress;

        // CLIC
        lineDiv.onclick = (e) => {
            if (isLongPressActive) { isLongPressActive = false; return; }
            lastEditedLineInfo = { key: data.key, index: i };

            if (clickTimer == null) {
                clickTimer = setTimeout(() => {
                    clickTimer = null;
                    if (lineData.text === '') startEditing(lineDiv, data.key, i, "", "black");
                    else toggleDone(data.key, i);
                }, 250);
            } else {
                clearTimeout(clickTimer);
                clickTimer = null;
                startEditing(lineDiv, data.key, i, lineData.text, lineData.color || 'black');
            }
        };

        lineDiv.oncontextmenu = (e) => e.preventDefault();
        container.appendChild(lineDiv);
    }
}

/* ==========================================
   EDICIÓN
   ========================================== */
function startEditing(lineDiv, key, index, currentText, currentColor) {
    const isHigh = (db[key] && db[key][index] && db[key][index].high);
    lineDiv.innerHTML = ''; 
    let tempColor = currentColor || 'black';

    const picker = document.createElement('div');
    picker.className = 'color-picker';
    ['black', 'blue', 'red', 'green', 'orange'].forEach(col => {
        const dot = document.createElement('div');
        dot.className = `color-dot dot-${col}`;
        dot.onmousedown = (e) => {
            e.preventDefault(); 
            tempColor = col;
            input.className = `note-input ink-${col}`;
        };
        picker.appendChild(dot);
    });
    lineDiv.appendChild(picker);

    const input = document.createElement('textarea');
    input.className = `note-input ink-${tempColor}`;
    input.value = currentText === "" ? "*- " : currentText;
    lineDiv.appendChild(input);
    
    currentActiveInput = input;
    input.style.height = '28px';
    input.style.height = input.scrollHeight + 'px';
    
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    
    const saveContent = () => {
        const txt = input.value.trim();
        if (!db[key]) db[key] = {};
        if (txt === "" || txt === "*-") {
            delete db[key][index];
        } else {
            db[key][index] = { text: txt, done: false, high: isHigh, color: tempColor };
        }
        currentActiveInput = null;
        save(); render(); 
    };

    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } };
    input.oninput = () => formatInput(input);
    input.onblur = saveContent;
}

function formatInput(input) {
    let val = input.value;
    if (!val.startsWith("*- ")) val = "*- " + val.replace(/^[\*\-\s]*/, "");
    if (val.length >= 4) val = val.slice(0, 3) + val.charAt(3).toUpperCase() + val.slice(4);
    input.value = val;
    input.style.height = '28px'; 
    input.style.height = input.scrollHeight + 'px';
}

function toggleDone(key, index) {
    if (db[key] && db[key][index]) {
        db[key][index].done = !db[key][index].done;
        save(); render();
    }
}

/* ==========================================
   VOZ
   ========================================== */
function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Tu navegador no soporta el dictado por voz.");
        return;
    }

    if (!lastEditedLineInfo.key) {
        alert("Haz clic en una línea para activarla antes de dictar.");
        return;
    }

    const SpeechRecognition = window.Recognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;

    const micBtn = document.getElementById('mic-btn');
    recognition.onstart = () => micBtn.classList.add('recording');

    recognition.onresult = (event) => {
        let speechResult = event.results[0][0].transcript.trim();
        const key = lastEditedLineInfo.key;
        const idx = lastEditedLineInfo.index;

        if (currentActiveInput) {
            currentActiveInput.value += " " + speechResult;
            formatInput(currentActiveInput);
        } else {
            if (!db[key]) db[key] = {};
            let currentText = db[key][idx] ? db[key][idx].text : "*- ";
            let newText;
            if (currentText === "*- " || currentText === "") {
                let formattedSpeech = speechResult.charAt(0).toUpperCase() + speechResult.slice(1);
                newText = "*- " + formattedSpeech;
            } else {
                newText = currentText + " " + speechResult;
            }
            db[key][idx] = { text: newText, done: false, high: (db[key][idx] ? db[key][idx].high : false), color: (db[key][idx] ? db[key][idx].color : 'black') };
            save(); render();
        }
    };

    recognition.onerror = () => micBtn.classList.remove('recording');
    recognition.onend = () => micBtn.classList.remove('recording');
    recognition.start();
}

/* ==========================================
   ALMACENAMIENTO Y AJUSTES
   ========================================== */
function save() { localStorage.setItem('agenda_v9', JSON.stringify(db)); }

function toggleSettings() {
    const m = document.getElementById('settings-modal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

function applySettings() {
    // Capturar valores
    settings.paper = document.getElementById('setting-paper').value;
    settings.fontSize = document.getElementById('setting-font-size').value;
    settings.viewMode = document.getElementById('setting-view').value;
    settings.ownerName = document.getElementById('setting-name').value;
    settings.coverColor = document.getElementById('setting-cover-color').value;
    
    localStorage.setItem('agenda_settings', JSON.stringify(settings));

    // Aplicar personalización de portada
    const cover = document.getElementById('notebook-cover');
    const title = document.getElementById('cover-title');
    
    // Limpiar clases de color anteriores y poner la nueva
    cover.classList.remove('cover-brown', 'cover-blue', 'cover-green', 'cover-black', 'cover-red');
    cover.classList.add(`cover-${settings.coverColor}`);
    
    // Aplicar nombre
    title.innerText = settings.ownerName.trim() === "" ? "AGENDA" : `AGENDA DE ${settings.ownerName.toUpperCase()}`;

    // Otros ajustes
    if (settings.viewMode === 'single') document.body.classList.add('view-single');
    else document.body.classList.remove('view-single');

    const pages = document.querySelectorAll('.page');
    pages.forEach(p => {
        p.classList.remove('paper-ruled', 'paper-grid');
        if (settings.paper === 'ruled') p.classList.add('paper-ruled');
        if (settings.paper === 'grid') p.classList.add('paper-grid');
    });
    render(); 
}

/* ==========================================
   BOLSILLO (NOTAS RÁPIDAS)
   ========================================== */
function openPocket() {
    document.getElementById('pocket-modal').style.display = 'flex';
}

function closePocket() {
    document.getElementById('pocket-modal').style.display = 'none';
}

function savePocketData() {
    settings.pocketNotes = document.getElementById('pocket-textarea').value;
    localStorage.setItem('agenda_settings', JSON.stringify(settings));
}

/* ==========================================
   EXPORTAR / IMPORTAR
   ========================================== */
function exportData() {
    const dataStr = JSON.stringify(db, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agenda_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedDb = JSON.parse(e.target.result);
            if (confirm("¿Sobrescribir tus notas actuales?")) {
                db = importedDb;
                save(); render(); alert("Importado con éxito.");
            }
        } catch (err) { alert("Archivo no válido."); }
    };
    reader.readAsText(file);
}

/* ==========================================
   FECHAS Y UTILIDADES
   ========================================== */
function getDayData(dOffset) {
    const d = new Date(); d.setDate(d.getDate() + dOffset);
    const key = d.toISOString().split('T')[0];
    return {
        key: key, num: d.getDate(),
        name: d.toLocaleDateString('es-ES', { weekday: 'long' }),
        month: d.toLocaleDateString('es-ES', { month: 'long' }), 
        monthShort: d.toLocaleDateString('es-ES', { month: 'short' }), 
        year: d.getFullYear(), isToday: key === new Date().toISOString().split('T')[0],
        week: getWeekNumber(d)
    };
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
}

function setupSwipe() {
    let startX = 0;
    swipeArea.ontouchstart = e => startX = e.touches[0].clientX;
    swipeArea.ontouchend = e => {
        if (notebook.classList.contains('is-closed')) return;
        let diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) < 60) return;
        notebook.classList.add('notebook-turning');
        const pL = document.querySelector('.left-page');
        const pR = document.querySelector('.right-page');
        if (diff > 0) pR.classList.add('page-turn-forward');
        else (settings.viewMode === 'single' ? pR.classList.add('page-turn-backward') : pL.classList.add('page-turn-backward'));
        
        setTimeout(() => {
            const step = (settings.viewMode === 'single' ? 1 : 2);
            offset += (diff > 0) ? step : -step;
            render();
            pL.classList.remove('page-turn-backward');
            pR.classList.remove('page-turn-forward', 'page-turn-backward');
            setTimeout(() => notebook.classList.remove('notebook-turning'), 300);
        }, 300);
    }
}

function clearAllData() {
    if (confirm("¿Borrar TODAS las notas?")) { db = {}; save(); render(); toggleSettings(); }
}

function openSummary() {
    const container = document.getElementById('summary-list-container');
    container.innerHTML = '';
    const keys = Object.keys(db).sort();
    if (keys.length === 0) {
        container.innerHTML = '<p>No hay notas.</p>';
    } else {
        keys.forEach(key => {
            const dayNotes = db[key];
            const noteIndices = Object.keys(dayNotes);
            if (noteIndices.length > 0) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'summary-day-item';
                const dateString = new Date(key + "T00:00:00").toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                const header = document.createElement('div');
                header.className = 'summary-day-header';
                header.innerText = dateString;
                header.onclick = () => { jumpToDate(key); closeSummary(); };
                itemDiv.appendChild(header);
                noteIndices.forEach(idx => {
                    const note = dayNotes[idx];
                    const p = document.createElement('div');
                    p.className = 'summary-note';
                    p.innerText = note.text;
                    p.style.color = getInkColorCode(note.color);
                    if (note.done) p.style.textDecoration = 'line-through';
                    itemDiv.appendChild(p);
                });
                container.appendChild(itemDiv);
            }
        });
    }
    document.getElementById('summary-modal').style.display = 'flex';
}

function closeSummary() { document.getElementById('summary-modal').style.display = 'none'; }

function getInkColorCode(colorName) {
    const colors = { 'blue': '#1a4a9e', 'red': '#a32a2a', 'green': '#1a632e', 'orange': '#ff8000' };
    return colors[colorName] || 'inherit';
}

init();