/**
 * Axiom — Single Page Application Client
 *
 * Hash-based routing, JWT auth, API client, and page renderers.
 */

// ─── Configuration ─────────────────────────────────────
const API = '';  // same origin

// ─── State ─────────────────────────────────────────────
let currentUser = null;
let currentRoadmap = null;
let currentTasks = [];
let quizState = { questions: [], answers: [], taskId: null, mcqJson: null };

// ─── API Client ────────────────────────────────────────
function getToken() { return localStorage.getItem('axiom_token'); }
function setToken(t) { localStorage.setItem('axiom_token', t); }
function clearToken() { localStorage.removeItem('axiom_token'); }

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...options, headers });
    if (res.status === 401) { clearToken(); currentUser = null; navigate('login'); return null; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Something went wrong');
    return data;
}

// ─── Toast ─────────────────────────────────────────────
function toast(msg, type = 'info') {
    const icons = { success: '✓', error: '✗', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ─── Router ────────────────────────────────────────────
function navigate(page) { window.location.hash = page; }

function getPage() {
    const hash = window.location.hash.slice(1) || '';
    return hash.split('/')[0] || 'login';
}

function getPageParam() {
    const hash = window.location.hash.slice(1) || '';
    const parts = hash.split('/');
    return parts[1] || null;
}

async function router() {
    const page = getPage();
    const app = document.getElementById('app');
    const nav = document.getElementById('main-nav');

    // Auth guard
    if (!currentUser && !['login', 'register'].includes(page)) {
        if (getToken()) {
            try {
                const data = await api('/api/auth/me');
                if (data) currentUser = data;
                else return;
            } catch {
                clearToken(); navigate('login'); return;
            }
        } else {
            navigate('login'); return;
        }
    }

    // Show/hide nav
    if (['login', 'register'].includes(page)) {
        nav.classList.add('hidden');
    } else {
        nav.classList.remove('hidden');
        updateNav(page);
    }

    // Render
    switch (page) {
        case 'login':      app.innerHTML = renderLogin(); attachLoginEvents(); break;
        case 'register':   app.innerHTML = renderRegister(); attachRegisterEvents(); break;
        case 'dashboard':  app.innerHTML = renderLoading(); await loadDashboard(); break;
        case 'roadmap':    app.innerHTML = renderLoading(); await loadRoadmap(); break;
        case 'onboard':    app.innerHTML = renderOnboarding(); attachOnboardingEvents(); break;
        case 'quiz':       app.innerHTML = renderLoading(); await loadQuiz(getPageParam()); break;
        default:           navigate('dashboard');
    }
}

function updateNav(page) {
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === page);
    });
    const nameEl = document.getElementById('nav-username');
    if (currentUser) nameEl.textContent = currentUser.username || currentUser.email || 'User';
}

function renderLoading() { return '<div class="spinner"></div>'; }

// ─── Auth Pages ────────────────────────────────────────
function renderLogin() {
    return `
    <div class="auth-page">
        <div class="auth-container">
            <div class="auth-header">
                <span class="brand-icon">🧠</span>
                <h1>Welcome back</h1>
                <p>Sign in to continue your learning journey</p>
            </div>
            <div class="card auth-card card-static">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="login-email" class="form-input" placeholder="you@example.com" autocomplete="email">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="login-password" class="form-input" placeholder="••••••••" autocomplete="current-password">
                </div>
                <button id="login-btn" class="btn btn-primary btn-full btn-lg">Sign In</button>
            </div>
            <div class="auth-footer">
                Don't have an account? <a href="#register">Create one</a>
            </div>
        </div>
    </div>`;
}

function renderRegister() {
    return `
    <div class="auth-page">
        <div class="auth-container">
            <div class="auth-header">
                <span class="brand-icon">🧠</span>
                <h1>Join Axiom</h1>
                <p>Start your AI-powered learning journey</p>
            </div>
            <div class="card auth-card card-static">
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" id="reg-username" class="form-input" placeholder="Your name" autocomplete="name">
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" autocomplete="email">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="reg-password" class="form-input" placeholder="Min 6 characters" autocomplete="new-password">
                </div>
                <button id="reg-btn" class="btn btn-primary btn-full btn-lg">Create Account</button>
            </div>
            <div class="auth-footer">
                Already have an account? <a href="#login">Sign in</a>
            </div>
        </div>
    </div>`;
}

function attachLoginEvents() {
    document.getElementById('login-btn').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) { toast('Please fill in all fields', 'error'); return; }
        const btn = document.getElementById('login-btn');
        btn.classList.add('btn-loading'); btn.disabled = true;
        try {
            const data = await api('/api/auth/login', {
                method: 'POST', body: JSON.stringify({ email, password })
            });
            setToken(data.access_token);
            currentUser = data.user;
            toast('Welcome back! 🎉', 'success');
            navigate('dashboard');
        } catch (e) { toast(e.message, 'error'); }
        finally { btn.classList.remove('btn-loading'); btn.disabled = false; }
    });
    // Enter key
    document.getElementById('login-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('login-btn').click();
    });
}

function attachRegisterEvents() {
    document.getElementById('reg-btn').addEventListener('click', async () => {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        if (!email || !password) { toast('Email and password are required', 'error'); return; }
        if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
        const btn = document.getElementById('reg-btn');
        btn.classList.add('btn-loading'); btn.disabled = true;
        try {
            const data = await api('/api/auth/register', {
                method: 'POST', body: JSON.stringify({ email, password, username: username || null })
            });
            setToken(data.access_token);
            currentUser = data.user;
            toast('Account created! Let\'s set your first goal 🚀', 'success');
            navigate('onboard');
        } catch (e) { toast(e.message, 'error'); }
        finally { btn.classList.remove('btn-loading'); btn.disabled = false; }
    });
    document.getElementById('reg-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('reg-btn').click();
    });
}

// ─── Dashboard ─────────────────────────────────────────
async function loadDashboard() {
    const app = document.getElementById('app');

    // refresh user data
    try {
        currentUser = await api('/api/auth/me');
    } catch (e) { return; }

    // Find active roadmap
    let todayTask = null;
    let totalTasks = 0;
    let completedTasks = 0;
    let roadmapTitle = null;

    if (currentUser) {
        try {
            const roadmaps = await api(`/api/roadmaps/user/${currentUser.id}`);
            if (roadmaps && roadmaps.length > 0) {
                currentRoadmap = roadmaps[roadmaps.length - 1]; // latest
                roadmapTitle = currentRoadmap.json_plan?.title || 'Your Roadmap';
                const tasks = await api(`/api/tasks/roadmap/${currentRoadmap.id}`);
                currentTasks = tasks || [];
                totalTasks = currentTasks.length;
                completedTasks = currentTasks.filter(t => t.status === 'verified').length;

                // Find today's task (first pending or in_progress)
                const today = new Date().toISOString().split('T')[0];
                todayTask = currentTasks.find(t =>
                    t.status === 'pending' || t.status === 'in_progress'
                ) || null;
            }
        } catch (e) { console.error(e); }
    }

    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <h1>Welcome back, ${currentUser.username || 'Learner'} 👋</h1>
            <p>${currentUser.current_goal ? `Currently working on: <strong>${currentUser.current_goal}</strong>` : 'Set a learning goal to get started!'}</p>
        </div>

        <div class="stats-grid">
            <div class="card stat-card">
                <div class="stat-icon">🔥</div>
                <div class="stat-value">${currentUser.streak_count}</div>
                <div class="stat-label">Day Streak</div>
            </div>
            <div class="card stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${completedTasks}/${totalTasks}</div>
                <div class="stat-label">Tasks Completed</div>
            </div>
            <div class="card stat-card">
                <div class="stat-icon">⏰</div>
                <div class="stat-value">${currentUser.hours_per_day}h</div>
                <div class="stat-label">Daily Commitment</div>
            </div>
            <div class="card stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-value">${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</div>
                <div class="stat-label">Progress</div>
            </div>
        </div>

        ${todayTask ? `
        <div class="section-title">📌 Today's Task</div>
        <div class="card today-task">
            <div class="task-title">${todayTask.title}</div>
            <div class="task-desc">${todayTask.description || 'Complete this chapter to continue your journey.'}</div>
            <div class="task-meta">
                <span class="task-badge">📅 Due: ${todayTask.due_date}</span>
                <span class="task-badge">⏱ ${todayTask.duration_hours}h</span>
                <span class="task-badge status-pill ${todayTask.status}">${formatStatus(todayTask.status)}</span>
            </div>
            <button class="btn btn-primary" onclick="navigate('quiz/${todayTask.id}')">
                🔒 Take Mastery Quiz
            </button>
        </div>` : `
        <div class="card empty-state card-static">
            <div class="empty-icon">📚</div>
            <h3>${totalTasks ? 'All tasks completed!' : 'No active roadmap'}</h3>
            <p>${totalTasks ? 'Amazing work! Start a new goal to keep growing.' : 'Create your first learning goal to get an AI-generated study plan.'}</p>
            <a href="#onboard" class="btn btn-primary">🚀 Start New Goal</a>
        </div>`}

        ${roadmapTitle ? `
        <div style="margin-top: 36px;">
            <div class="section-title">🗺️ ${roadmapTitle}</div>
            <a href="#roadmap" class="btn btn-ghost">View Full Roadmap →</a>
        </div>` : ''}
    </div>`;
}

function formatStatus(s) {
    const map = { pending: 'Pending', in_progress: 'In Progress', verified: 'Verified ✓', rescheduled: 'Rescheduled' };
    return map[s] || s;
}

// ─── Roadmap ───────────────────────────────────────────
async function loadRoadmap() {
    const app = document.getElementById('app');

    if (!currentUser) return;

    try {
        const roadmaps = await api(`/api/roadmaps/user/${currentUser.id}`);
        if (!roadmaps || roadmaps.length === 0) {
            app.innerHTML = `
            <div class="page">
                <div class="card empty-state card-static">
                    <div class="empty-icon">🗺️</div>
                    <h3>No roadmap yet</h3>
                    <p>Create a learning goal and we'll generate a personalized roadmap for you.</p>
                    <a href="#onboard" class="btn btn-primary">🚀 Create Goal</a>
                </div>
            </div>`;
            return;
        }

        currentRoadmap = roadmaps[roadmaps.length - 1];
        const tasks = await api(`/api/tasks/roadmap/${currentRoadmap.id}`);
        currentTasks = tasks || [];

        const title = currentRoadmap.json_plan?.title || 'Your Roadmap';
        const totalDays = currentRoadmap.json_plan?.total_days || currentTasks.length;

        app.innerHTML = `
        <div class="page">
            <div class="page-header">
                <h1>🗺️ ${title}</h1>
                <p>${currentTasks.filter(t => t.status === 'verified').length} of ${totalDays} days completed • Started ${currentRoadmap.start_date}</p>
            </div>
            <div class="timeline">
                ${currentTasks.map((task, i) => `
                <div class="card timeline-item ${task.status}" onclick="navigate('quiz/${task.id}')">
                    <div class="item-day">Day ${i + 1} • ${task.due_date}</div>
                    <div class="item-title">${task.title}</div>
                    <div class="item-desc">${task.description || ''}</div>
                    <div class="item-footer">
                        <span class="status-pill ${task.status}">${formatStatus(task.status)}</span>
                        <span class="task-badge">⏱ ${task.duration_hours}h</span>
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
    } catch (e) {
        toast(e.message, 'error');
        app.innerHTML = `<div class="page"><div class="card empty-state card-static"><h3>Error loading roadmap</h3><p>${e.message}</p></div></div>`;
    }
}

// ─── Onboarding Wizard ─────────────────────────────────
let wizardStep = 1;
let wizardData = { goal: '', hours: 2, syllabus: '' };

function renderOnboarding() {
    wizardStep = 1;
    wizardData = { goal: '', hours: 2, syllabus: '' };
    return renderWizardStep();
}

function renderWizardStep() {
    const steps = [
        {
            num: 'Step 1 of 3',
            title: '🎯 What\'s your learning goal?',
            desc: 'Tell us what you want to master.',
            input: `<div class="form-group"><input type="text" id="wiz-goal" class="form-input" placeholder='e.g. "Master Data Structures in Python"' value="${wizardData.goal}"></div>`
        },
        {
            num: 'Step 2 of 3',
            title: '⏰ Hours per day?',
            desc: 'How much time can you dedicate daily?',
            input: `<div class="form-group"><input type="number" id="wiz-hours" class="form-input" min="1" max="16" placeholder="2" value="${wizardData.hours}"></div>`
        },
        {
            num: 'Step 3 of 3',
            title: '📚 Paste your syllabus',
            desc: 'Provide topics or a curriculum as text.',
            input: `<div class="form-group"><textarea id="wiz-syllabus" class="form-textarea" placeholder="- Introduction to Arrays\n- Linked Lists\n- Stacks & Queues\n- Trees & Graphs\n- Sorting Algorithms\n- Dynamic Programming">${wizardData.syllabus}</textarea></div>`
        }
    ];

    const s = steps[wizardStep - 1];
    return `
    <div class="page">
        <div class="wizard">
            <div class="wizard-progress">
                ${[1, 2, 3].map(i => `<div class="wizard-step-bar ${i < wizardStep ? 'completed' : ''} ${i === wizardStep ? 'active' : ''}"></div>`).join('')}
            </div>
            <div class="card wizard-card card-static">
                <div class="step-num">${s.num}</div>
                <h2>${s.title}</h2>
                <p>${s.desc}</p>
                ${s.input}
                <div style="display:flex;gap:12px;justify-content:center;margin-top:12px;">
                    ${wizardStep > 1 ? `<button class="btn btn-ghost" id="wiz-back">← Back</button>` : ''}
                    <button class="btn btn-primary btn-lg" id="wiz-next">
                        ${wizardStep === 3 ? '🚀 Generate Roadmap' : 'Continue →'}
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

function attachOnboardingEvents() {
    attachWizardEvents();
}

function attachWizardEvents() {
    const nextBtn = document.getElementById('wiz-next');
    const backBtn = document.getElementById('wiz-back');

    if (nextBtn) nextBtn.addEventListener('click', handleWizardNext);
    if (backBtn) backBtn.addEventListener('click', () => {
        wizardStep--;
        document.getElementById('app').innerHTML = renderWizardStep();
        attachWizardEvents();
    });
}

async function handleWizardNext() {
    const app = document.getElementById('app');

    if (wizardStep === 1) {
        const val = document.getElementById('wiz-goal').value.trim();
        if (!val) { toast('Please enter a learning goal', 'error'); return; }
        wizardData.goal = val;
        wizardStep = 2;
        app.innerHTML = renderWizardStep();
        attachWizardEvents();
    } else if (wizardStep === 2) {
        const val = parseInt(document.getElementById('wiz-hours').value);
        if (!val || val < 1 || val > 16) { toast('Enter a number between 1 and 16', 'error'); return; }
        wizardData.hours = val;
        wizardStep = 3;
        app.innerHTML = renderWizardStep();
        attachWizardEvents();
    } else if (wizardStep === 3) {
        const val = document.getElementById('wiz-syllabus').value.trim();
        if (!val) { toast('Please paste your syllabus', 'error'); return; }
        wizardData.syllabus = val;

        // Update user goal & hours
        const btn = document.getElementById('wiz-next');
        btn.classList.add('btn-loading'); btn.disabled = true;
        btn.textContent = 'Generating...';

        try {
            // Update user profile
            await api(`/api/users/${currentUser.telegram_id || 0}`, {
                method: 'PATCH',
                body: JSON.stringify({ current_goal: wizardData.goal, hours_per_day: wizardData.hours })
            }).catch(() => {});  // may fail if no telegram_id, we'll add a web update route later

            // Create roadmap
            const today = new Date().toISOString().split('T')[0];
            const roadmap = await api('/api/roadmaps/', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: currentUser.id,
                    raw_syllabus: wizardData.syllabus,
                    start_date: today
                })
            });

            currentRoadmap = roadmap;
            toast('Roadmap generated! 🎉', 'success');
            // Refresh user
            currentUser = await api('/api/auth/me');
            navigate('roadmap');
        } catch (e) {
            toast(e.message, 'error');
            btn.classList.remove('btn-loading'); btn.disabled = false;
            btn.textContent = '🚀 Generate Roadmap';
        }
    }
}

// ─── Quiz ──────────────────────────────────────────────
async function loadQuiz(taskId) {
    const app = document.getElementById('app');
    if (!taskId) { navigate('dashboard'); return; }

    try {
        // Generate quiz
        const data = await api(`/api/quiz/generate/${taskId}`, { method: 'POST' });
        quizState = {
            questions: data.questions,
            answers: new Array(data.questions.length).fill(-1),
            taskId: data.task_id,
            taskTitle: data.task_title,
            mcqJson: { questions: data.questions },
            currentQ: 0
        };
        renderQuizQuestion();
    } catch (e) {
        toast(e.message, 'error');
        app.innerHTML = `
        <div class="page">
            <div class="card empty-state card-static">
                <div class="empty-icon">⚠️</div>
                <h3>Could not generate quiz</h3>
                <p>${e.message}</p>
                <a href="#dashboard" class="btn btn-ghost">← Back to Dashboard</a>
            </div>
        </div>`;
    }
}

function renderQuizQuestion() {
    const app = document.getElementById('app');
    const q = quizState.questions[quizState.currentQ];
    const total = quizState.questions.length;
    const current = quizState.currentQ;
    const labels = ['A', 'B', 'C', 'D'];

    app.innerHTML = `
    <div class="page">
        <div class="quiz-container">
            <div class="quiz-header">
                <h2>🔒 ${quizState.taskTitle}</h2>
                <p style="color:var(--text-secondary)">Question ${current + 1} of ${total} • Need ≥80% to pass</p>
                <div class="quiz-progress-bar">
                    <div class="quiz-progress-fill" style="width:${((current + 1) / total) * 100}%"></div>
                </div>
            </div>
            <div class="card question-card card-static">
                <div class="q-num">Question ${current + 1}</div>
                <div class="q-text">${q.question}</div>
                <div class="options-list">
                    ${q.options.map((opt, i) => `
                    <button class="option-btn ${quizState.answers[current] === i ? 'selected' : ''}"
                            data-idx="${i}" id="opt-${i}">
                        <span class="option-label">${labels[i]}</span>
                        <span>${opt}</span>
                    </button>`).join('')}
                </div>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;">
                ${current > 0 ? `<button class="btn btn-ghost" id="quiz-prev">← Previous</button>` : ''}
                <button class="btn btn-primary btn-lg" id="quiz-next" ${quizState.answers[current] === -1 ? 'disabled' : ''}>
                    ${current === total - 1 ? '✅ Submit Quiz' : 'Next →'}
                </button>
            </div>
        </div>
    </div>`;

    // Events
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            quizState.answers[quizState.currentQ] = parseInt(btn.dataset.idx);
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('quiz-next').disabled = false;
        });
    });

    document.getElementById('quiz-next').addEventListener('click', () => {
        if (current < total - 1) {
            quizState.currentQ++;
            renderQuizQuestion();
        } else {
            submitQuiz();
        }
    });

    const prevBtn = document.getElementById('quiz-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        quizState.currentQ--;
        renderQuizQuestion();
    });
}

async function submitQuiz() {
    const app = document.getElementById('app');
    app.innerHTML = renderLoading();

    try {
        const result = await api(`/api/quiz/submit/${quizState.taskId}`, {
            method: 'POST',
            body: JSON.stringify({
                answers: quizState.answers,
                mcq_json: quizState.mcqJson
            })
        });

        const scorePercent = Math.round(result.score * 100);
        const passed = result.passed;

        app.innerHTML = `
        <div class="page">
            <div class="quiz-container">
                <div class="card result-card card-static">
                    <div class="result-icon">${passed ? '🎉' : '😤'}</div>
                    <div class="result-title">${passed ? 'You Passed!' : 'Not Quite...'}</div>
                    <div class="result-score">${scorePercent}%</div>
                    <div class="result-msg">
                        ${passed
                            ? 'Outstanding! You\'ve verified mastery of this topic. Your streak has increased!'
                            : 'You need ≥80% to pass. Review the material and try again — you\'re almost there!'}
                    </div>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        ${!passed ? `<button class="btn btn-primary" onclick="loadQuiz(${quizState.taskId})">🔄 Retry Quiz</button>` : ''}
                        <a href="#dashboard" class="btn btn-ghost">← Dashboard</a>
                        <a href="#roadmap" class="btn btn-ghost">🗺️ Roadmap</a>
                    </div>
                </div>
            </div>
        </div>`;
    } catch (e) {
        toast(e.message, 'error');
        app.innerHTML = `
        <div class="page">
            <div class="card empty-state card-static">
                <div class="empty-icon">⚠️</div>
                <h3>Submission failed</h3>
                <p>${e.message}</p>
                <a href="#dashboard" class="btn btn-ghost">← Back</a>
            </div>
        </div>`;
    }
}

// ─── Logout ────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    currentUser = null;
    currentRoadmap = null;
    currentTasks = [];
    toast('Logged out', 'info');
    navigate('login');
});

// ─── Init ──────────────────────────────────────────────
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) window.location.hash = 'login';
    router();
});
