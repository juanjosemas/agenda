let offset = 0; 
let db = JSON.parse(localStorage.getItem('agenda_v9')) || {};

let settings = JSON.parse(localStorage.getItem('agenda_settings')) || {
    paper: 'plain',
    darkMode: false,
    fontSize: 'medium',
    viewMode: 'double'
};

let clickTimer = null; 

const linesL = document.getElementById('lines-l');
const linesR = document.getElementById('lines-r');
const swipeArea = document.getElementById('swipe-area');
const notebook = document.querySelector('.notebook-container');

function init() {
    document.getElementById('setting-paper').value = settings.paper;
    document.getElementById('setting-dark').checked = settings.darkMode;
    document.getElementById('setting-font-size').value = settings.fontSize;
    document.getElementById('setting-view').value = settings.viewMode;

    applySettings(); 
    render();
    setupSwipe();
}

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
}

function render() {
    const leftData = getDayData(offset);
    const rightData = getDayData(offset + 1);

    document.getElementById('month-year').innerText = `${leftData.month}. ${leftData.year}`;
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
    headerLine.innerHTML = `
        <div>
            <span class="day-name">${data.name}</span>
            <span class="day-num">${data.num}</span>
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

        lineDiv.onclick = (e) => {
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

        // Pulsación larga / Click derecho para resaltar
        lineDiv.oncontextmenu = (e) => {
            e.preventDefault();
            if(db[data.key] && db[data.key][i]) {
                db[data.key][i].high = !db[data.key][i].high;
                save(); render();
            }
        };

        container.appendChild(lineDiv);
    }
}

function startEditing(lineDiv, key, index, currentText, currentColor) {
    lineDiv.innerHTML = ''; 
    let tempColor = currentColor || 'black';

    const picker = document.createElement('div');
    picker.className = 'color-picker';
    
    ['black', 'blue', 'red', 'green'].forEach(col => {
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
            const isHigh = (db[key] && db[key][index] && db[key][index].high) ? true : false;
            db[key][index] = { text: txt, done: false, high: isHigh, color: tempColor };
        }
        save(); render(); 
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
    };

    input.oninput = () => {
        let val = input.value;
        if (!val.startsWith("*- ")) val = "*- " + val.replace(/^[\*\-\s]*/, "");
        if (val.length >= 4) val = val.slice(0, 3) + val.charAt(3).toUpperCase() + val.slice(4);
        input.value = val;
        input.style.height = '28px'; 
        input.style.height = input.scrollHeight + 'px';
    };

    input.onblur = saveContent;
}

function toggleDone(key, index) {
    if (db[key] && db[key][index]) {
        db[key][index].done = !db[key][index].done;
        save(); render();
    }
}

function save() { 
    localStorage.setItem('agenda_v9', JSON.stringify(db)); 
}

function exportData() {
    try {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "copia_seguridad_agenda.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) { alert("Error al exportar: " + err); }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedDb = JSON.parse(e.target.result);
            if (confirm("Se sobrescribirán todos los datos. ¿Continuar?")) {
                db = importedDb;
                save(); location.reload();
            }
        } catch(err) { alert("Archivo no válido."); }
    };
    reader.readAsText(file);
}

function toggleSettings() {
    const m = document.getElementById('settings-modal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

function applySettings() {
    settings.paper = document.getElementById('setting-paper').value;
    settings.darkMode = document.getElementById('setting-dark').checked;
    settings.fontSize = document.getElementById('setting-font-size').value;
    settings.viewMode = document.getElementById('setting-view').value;
    localStorage.setItem('agenda_settings', JSON.stringify(settings));

    document.body.className = settings.darkMode ? 'night-mode' : '';
    if (settings.viewMode === 'single') document.body.classList.add('view-single');

    const pages = document.querySelectorAll('.page');
    pages.forEach(p => {
        p.classList.remove('paper-ruled', 'paper-grid');
        if (settings.paper === 'ruled') p.classList.add('paper-ruled');
        if (settings.paper === 'grid') p.classList.add('paper-grid');
    });
    render(); 
}

function getDayData(dOffset) {
    const d = new Date(); d.setDate(d.getDate() + dOffset);
    const key = d.toISOString().split('T')[0];
    return {
        key: key, num: d.getDate(),
        name: d.toLocaleDateString('es-ES', { weekday: 'long' }),
        month: d.toLocaleDateString('es-ES', { month: 'short' }),
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

init();