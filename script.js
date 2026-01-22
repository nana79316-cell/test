
// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------

const TIME_SLOTS = {
    'G1-2': {
        1: { start: '09:00', end: '09:40' },
        2: { start: '09:50', end: '10:30' },
        3: { start: '10:50', end: '11:30' },
        'lunch': { start: '11:30', end: '12:20' },
        4: { start: '12:20', end: '13:00' },
        5: { start: '13:00', end: '13:40' }
    },
    'G3-4': {
        1: { start: '09:00', end: '09:40' },
        2: { start: '09:50', end: '10:30' },
        3: { start: '10:40', end: '11:20' },
        4: { start: '11:30', end: '12:10' },
        'lunch': { start: '12:10', end: '13:00' },
        5: { start: '13:00', end: '13:40' },
        6: { start: '13:50', end: '14:30' }
    },
    'G5-6': {
        1: { start: '09:00', end: '09:40' },
        2: { start: '09:50', end: '10:30' },
        3: { start: '10:40', end: '11:20' },
        4: { start: '11:30', end: '12:10' },
        5: { start: '12:20', end: '13:00' },
        'lunch': { start: '13:00', end: '13:50' },
        6: { start: '13:50', end: '14:30' }
    }
};

const CLASS_COUNTS = {
    1: { Mon: 4, Tue: 5, Wed: 4, Thu: 5, Fri: 4 },
    2: { Mon: 4, Tue: 5, Wed: 4, Thu: 5, Fri: 4 },
    3: { Mon: 5, Tue: 6, Wed: 5, Thu: 6, Fri: 5 },
    4: { Mon: 5, Tue: 6, Wed: 5, Thu: 6, Fri: 5 },
    5: { Mon: 6, Tue: 6, Wed: 5, Thu: 6, Fri: 5 },
    6: { Mon: 6, Tue: 6, Wed: 5, Thu: 6, Fri: 5 }
};

const DAY_MAP = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thu',
    'Friday': 'Fri'
};

// Global Data
let teachers = [];
let scheduleEntries = [];
let loaded = false;

// DOM Elements
const dom = {
    day: document.getElementById('daySelect'),
    grade: document.getElementById('gradeSelect'),
    class: document.getElementById('classSelect'),
    startPeriod: document.getElementById('startPeriod'),
    endPeriod: document.getElementById('endPeriod'),
    timePreview: document.getElementById('absoluteTimeDisplay'),
    searchBtn: document.getElementById('searchBtn'),
    resultsList: document.getElementById('resultsList'),
    resultCount: document.getElementById('resultCount')
};

// Lifecycle
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
    } catch (e) {
        console.error("Init Error", e);
        mockData();
    }
    setupEventListeners();
    updateClassOptions();
    updateTimePreview();
});

function setupEventListeners() {
    if (dom.grade) dom.grade.addEventListener('change', () => { updateClassOptions(); updateTimePreview(); });
    if (dom.startPeriod) dom.startPeriod.addEventListener('change', updateTimePreview);
    if (dom.endPeriod) dom.endPeriod.addEventListener('change', updateTimePreview);
    if (dom.searchBtn) dom.searchBtn.addEventListener('click', searchTeachers);
}

// ------------------------------------------------------------------
// Data Handlers
// ------------------------------------------------------------------
async function loadData() {
    try {
        const response = await fetch('rescheduling.ttl');
        if (!response.ok) throw new Error('Network error');
        const text = await response.text();
        parseTTL(text);
        loaded = true;
        console.log(`Loaded ${teachers.length} teachers.`);
    } catch (e) {
        console.warn('Using Local Mock Data.');
        mockData();
    }
}

function parseTTL(text) {
    teachers = [];
    scheduleEntries = [];
    const lines = text.split('\n');
    let buffer = "";

    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        buffer += " " + line;

        if (line.endsWith('.')) {
            try { parseStatement(buffer); } catch (e) { console.error("Parse Error", e); }
            buffer = "";
        }
    });

    // Safety check
    if (teachers.length === 0) mockData();
}

function parseStatement(stmt) {
    // Class Linkage
    if (stmt.includes('a ex:Class')) {
        const classMatch = stmt.match(/ex:(Class_\d_\d)/);
        const hrMatch = stmt.match(/ex:hasHomeroom ex:(T_\w+)/);
        if (classMatch && hrMatch) {
            const clsId = classMatch[1].replace('Class_', '').replace('_', '-');
            const tId = hrMatch[1];

            let t = teachers.find(x => x.id === tId);
            if (!t) {
                t = { id: tId, type: 'Homeroom', homeroomClass: clsId, name: tId };
                teachers.push(t);
            } else {
                t.homeroomClass = clsId;
                t.type = 'Homeroom';
            }
        }
    }

    // Teacher Info
    if (stmt.includes('ex:HomeroomTeacher') || stmt.includes('ex:Specialist')) {
        const idMatch = stmt.match(/ex:(T_\w+)/);
        const nameMatch = stmt.match(/ex:name "([^"]+)"/);
        const subMatch = stmt.match(/ex:subject "([^"]+)"/);

        if (idMatch) {
            const id = idMatch[1];
            let t = teachers.find(x => x.id === id);
            const type = stmt.includes('ex:HomeroomTeacher') ? 'Homeroom' : 'Specialist';

            if (!t) {
                t = { id, type, name: nameMatch ? nameMatch[1] : id };
                teachers.push(t);
            } else {
                if (nameMatch) t.name = nameMatch[1];
                if (type === 'Specialist') t.type = 'Specialist';
            }
            if (subMatch) t.subjects = subMatch[1];
        }
    }

    // Schedule
    if (stmt.includes('ex:SpecialistClass')) {
        const d = stmt.match(/ex:day "([^"]+)"/);
        const p = stmt.match(/ex:period (\d+)/);
        const c = stmt.match(/ex:class ex:(Class_\d_\d)/);
        const t = stmt.match(/ex:teacher ex:(T_\w+)/);
        const s = stmt.match(/ex:subject "([^"]+)"/); // Extract Subject

        if (d && p && c && t) {
            scheduleEntries.push({
                day: d[1],
                period: parseInt(p[1]),
                classId: c[1],
                assignedTeacherId: t[1],
                subject: s ? s[1] : null
            });
        }
    }
}

// *** COMPREHENSIVE MOCK DATA GENERATOR ***
function mockData() {
    teachers = [];
    scheduleEntries = [];

    // 1. Generate Homeroom Teachers
    const names = {
        '1-1': '이미림', '1-2': '김명숙', '1-3': '김남인', '1-4': '김미정', '1-5': '전소영',
        '2-1': '유화영', '2-2': '강진영', '2-3': '서현진', '2-4': '정선주',
        '3-1': '박인철', '3-2': '이영화', '3-3': '이영순', '3-4': '이진원', '3-5': '남정숙',
        '4-1': '김은영', '4-2': '조민희', '4-3': '김민정', '4-4': '류장민', '4-5': '최계정', '4-6': '손민호',
        '5-1': '임희선', '5-2': '정은정', '5-3': '최희주', '5-4': '이영진', '5-5': '박영수',
        '6-1': '김남이', '6-2': '여화진', '6-3': '황해나', '6-4': '김다솜', '6-5': '박은진', '6-6': '강성희'
    };
    for (let k in names) {
        teachers.push({ id: `T_${k.replace('-', '_')}`, type: 'Homeroom', homeroomClass: k, name: names[k] });
    }

    // 2. Generate Specialist Teachers
    const specialists = [
        { id: 'T_KimShinHye', name: '김신혜', subjects: '과학', targetGrades: [3, 4] },
        { id: 'T_JeongJiSu', name: '정지수', subjects: '과학/도덕', targetGrades: [4, 5] },
        { id: 'T_ParkHanSeok', name: '박한석', subjects: '과학/도덕', targetGrades: [5, 6] },
        { id: 'T_JeonSeongGon', name: '전성곤', subjects: '과학', targetGrades: [5, 6] },
        { id: 'T_SongJuYeon', name: '송주연', subjects: '영어', targetGrades: [3, 4, 5, 6] },
        { id: 'T_JangWonSeok', name: '장원석', subjects: '체육', targetGrades: [3, 4, 5, 6] }
    ];
    specialists.forEach(s => teachers.push({ ...s, type: 'Specialist' }));

    // 3. Generate Comprehensive Weekly Schedule
    // This creates a deterministic schedule where specialists are busy most periods.
    const classesByGrade = {};
    for (let i = 1; i <= 6; i++) classesByGrade[i] = [];
    Object.keys(names).forEach(k => {
        const g = parseInt(k.split('-')[0]);
        classesByGrade[g].push(`Class_${k.replace('-', '_')}`);
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    let classIndices = { 3: 0, 4: 0, 5: 0, 6: 0 };

    days.forEach((day, dIndex) => {
        const maxP = (day === 'Wed' || day === 'Fri') ? 5 : 6;
        for (let period = 1; period <= maxP; period++) {

            specialists.forEach((spec, sIndex) => {
                // Determine grade for this slot (Rotation)
                const gIndex = (dIndex + sIndex + period) % spec.targetGrades.length;
                const grade = spec.targetGrades[gIndex];

                // Pick Class
                const clsList = classesByGrade[grade];
                if (!clsList) return;

                // Pick cycling class index
                let cIdx = (classIndices[grade] + sIndex) % clsList.length;
                const classId = clsList[cIdx];

                // Pick Subject
                const subj = spec.subjects.includes('/') ? spec.subjects.split('/')[period % 2] : spec.subjects;

                scheduleEntries.push({
                    day: day,
                    period: period,
                    classId: classId,
                    assignedTeacherId: spec.id,
                    subject: subj
                });
            });

            // Advance Indices for variation
            for (let g in classIndices) classIndices[g]++;
        }
    });

    loaded = true;
    console.log(`Generated ${scheduleEntries.length} breakdown entries.`);
}


// ------------------------------------------------------------------
// Logic Support
// ------------------------------------------------------------------
function updateClassOptions() {
    const grade = parseInt(dom.grade.value);
    const max = (grade === 2) ? 4 : (grade === 1 || grade === 3 || grade === 5) ? 5 : 6;
    dom.class.innerHTML = '';
    for (let i = 1; i <= max; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}반`;
        dom.class.appendChild(opt);
    }
}

function updateTimePreview() {
    const r = getAbsoluteTimeRange(parseInt(dom.grade.value), parseInt(dom.startPeriod.value), parseInt(dom.endPeriod.value));
    dom.timePreview.textContent = r ? `${r.start} ~ ${r.end}` : '--:--';
}

function getAbsoluteTimeRange(grade, start, end) {
    let g = 'G5-6';
    if (grade <= 2) g = 'G1-2';
    else if (grade <= 4) g = 'G3-4';

    if (!TIME_SLOTS[g] || !TIME_SLOTS[g][start] || !TIME_SLOTS[g][end]) return null;
    return { start: TIME_SLOTS[g][start].start, end: TIME_SLOTS[g][end].end };
}


// ------------------------------------------------------------------
// Search Execution
// ------------------------------------------------------------------
function searchTeachers() {
    try {
        if (!loaded && teachers.length < 10) mockData();

        const reqDay = DAY_MAP[dom.day.value];
        const reqGrade = parseInt(dom.grade.value);
        const startP = parseInt(dom.startPeriod.value);
        const endP = parseInt(dom.endPeriod.value);

        if (startP > endP) { alert("Invalid Period Range"); return; }

        const resultsByPeriod = {};

        // Loop through each requested period
        for (let p = startP; p <= endP; p++) {
            const reqTime = getAbsoluteTimeRange(reqGrade, p, p);
            if (!reqTime) continue;

            const list = [];
            teachers.forEach(t => {
                const status = checkAvailability(t, reqDay, reqTime);
                if (status.available) list.push({ teacher: t, reason: status.reason });
            });
            resultsByPeriod[p] = list;
        }

        renderResultsTable(resultsByPeriod, startP, endP);

    } catch (e) {
        console.error(e);
        alert("An error occurred during search. See console.");
    }
}

function checkAvailability(teacher, dayCode, reqTime) {
    const reqStart = timeToMinutes(reqTime.start);
    const reqEnd = timeToMinutes(reqTime.end);

    const overlaps = (slot) => {
        if (!slot) return false;
        const s = timeToMinutes(slot.start);
        const e = timeToMinutes(slot.end);
        return (s < reqEnd && e > reqStart);
    };

    if (teacher.type === 'Homeroom') {
        if (!teacher.homeroomClass) return { available: false };
        const [gNum, cNum] = teacher.homeroomClass.split('-').map(Number);

        const gGroup = (gNum <= 2) ? 'G1-2' : (gNum <= 4) ? 'G3-4' : 'G5-6';
        const mySlots = TIME_SLOTS[gGroup];

        let overlappingKeys = [];
        for (let k in mySlots) {
            if (overlaps(mySlots[k])) overlappingKeys.push(k);
        }

        if (overlappingKeys.length === 0) return { available: true, reason: "방과후" };

        let allFree = true;
        let reasons = [];

        const classId = `Class_${gNum}_${cNum}`;
        const dailyMax = CLASS_COUNTS[gNum][dayCode] || 6;

        for (let k of overlappingKeys) {
            if (k === 'lunch') { allFree = false; break; }

            const pVal = parseInt(k);
            if (pVal > dailyMax) {
                reasons.push("방과후");
                continue;
            }

            const entry = scheduleEntries.find(e =>
                e.classId === classId && e.day === dayCode && e.period === pVal
            );
            if (entry) {
                let subj = '전담';
                if (entry.subject) subj = entry.subject;
                else {
                    const specVar = teachers.find(x => x.id === entry.assignedTeacherId);
                    subj = specVar ? specVar.subjects : '전담';
                }
                reasons.push(`전담(${subj})`);
                continue;
            }

            allFree = false; break;
        }

        if (allFree) return { available: true, reason: [...new Set(reasons)].join(', ') };
        return { available: false };

    } else {
        // Specialist Check
        const myClasses = scheduleEntries.filter(e => e.assignedTeacherId === teacher.id && e.day === dayCode);

        for (let cls of myClasses) {
            const gNum = parseInt(cls.classId.split('_')[1]);
            const gGroup = (gNum <= 2) ? 'G1-2' : (gNum <= 4) ? 'G3-4' : 'G5-6';
            const slot = TIME_SLOTS[gGroup][cls.period];
            if (overlaps(slot)) {
                // console.log(`${teacher.name} Busy teaching ${cls.classId} at Period ${cls.period}`);
                return { available: false };
            }
        }
        return { available: true, reason: "공강" };
    }
}

function timeToMinutes(str) {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
}

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function renderResultsTable(map, startP, endP) {
    dom.resultsList.innerHTML = '';
    dom.resultsList.style.display = 'block';

    const table = document.createElement('table');
    table.className = 'results-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th width="15%" style="text-align:center">교시</th><th>보강 가능 교사</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let count = 0;

    for (let p = startP; p <= endP; p++) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.className = 'period-cell';
        td1.textContent = `${p}교시`;

        const td2 = document.createElement('td');
        td2.className = 'teachers-cell';

        const rowList = map[p] || [];
        count += rowList.length;

        if (rowList.length === 0) {
            td2.innerHTML = `<span class="empty-slot">- 없음 -</span>`;
        } else {
            rowList.sort((a, b) => (a.teacher.type === 'Homeroom' ? -1 : 1));
            const wrap = document.createElement('div');
            wrap.className = 'teacher-chips';

            rowList.forEach(item => {
                const t = item.teacher;
                const chip = document.createElement('div');
                chip.className = `teacher-chip ${t.type === 'Homeroom' ? 'homeroom' : 'specialist'}`;
                chip.innerHTML = `<span class="name">${t.name}</span> <span class="reason">${item.reason}</span>`;
                wrap.appendChild(chip);
            });
            td2.appendChild(wrap);
        }

        tr.appendChild(td1);
        tr.appendChild(td2);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    dom.resultsList.appendChild(table);

    dom.resultCount.textContent = `총 ${count}명 (구간 합계)`;
}
