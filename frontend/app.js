/**
 * Axiom — Premium SPA Engine
 */

const API_BASE_URL = 'http://localhost:8000/api';

// ─── State Machine ───────────────────────────────────────
const AppState = {
    token: localStorage.getItem('axiom_token') || null,
    user: null,
    currentGoal: null,
    tasks: [],
    parts: [],
    quizSession: null
};

// ─── Entry Point ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    window.addEventListener('hashchange', handleRoute);
});

async function initApp() {
    if (AppState.token) {
        try {
            const userData = await apiFetch('/users/me');
            AppState.user = userData;
            updateNavUI();
            
            // Check if user has an active goal
            try {
                const goals = await apiFetch('/goals/');
                if (goals && goals.length > 0) {
                    AppState.currentGoal = goals.find(g => g.status === 'Active') || goals[0];
                    await loadGoalHierarchy(AppState.currentGoal.id);
                }
            } catch (e) { console.log('No active goals yet.'); }
            
            if (!location.hash || location.hash === '#login') {
                location.hash = AppState.currentGoal ? '#dashboard' : '#onboard';
            } else {
                handleRoute();
            }
        } catch (error) {
            console.error("Session invalid", error);
            logout();
        }
    } else {
        location.hash = '#login';
        handleRoute();
    }

    // Bind strict UI elements
    document.getElementById('logout-btn')?.addEventListener('click', logout);
}

// ─── Router ───────────────────────────────────────────────
function handleRoute() {
    const hash = window.location.hash || '#login';
    const appEl = document.getElementById('app');
    
    // Auth Guard
    if (!AppState.token && hash !== '#login' && hash !== '#register') {
        window.location.hash = '#login';
        return;
    }

    // Hide/Show Nav
    const nav = document.getElementById('main-nav');
    if (hash === '#login' || hash === '#register' || hash.startsWith('#quiz')) {
        nav.classList.add('hidden');
    } else {
        nav.classList.remove('hidden');
        updateNavLinks(hash);
    }

    // Render Views
    appEl.innerHTML = ''; // Clear container
    appEl.classList.remove('fade-in');
    
    setTimeout(() => {
        appEl.classList.add('fade-in');
        if (hash === '#login') renderLogin();
        else if (hash === '#register') renderRegister();
        else if (hash === '#dashboard') renderDashboard();
        else if (hash === '#goals') renderRoadmap();
        else if (hash === '#onboard') renderOnboard();
        else if (hash.startsWith('#quiz/')) {
            const partId = hash.split('/')[1];
            renderQuizArena(partId);
        } else {
            renderDashboard(); // Fallback
        }
    }, 50);
}

function updateNavLinks(activeHash) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (`#${link.dataset.page}` === activeHash) {
            link.classList.add('active');
        }
    });
}

function updateNavUI() {
    if (AppState.user) {
        document.getElementById('nav-username').textContent = AppState.user.username;
    }
}

// ─── API Wrapper ──────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(AppState.token ? { 'Authorization': `Bearer ${AppState.token}` } : {})
    };

    const config = { ...options, headers: { ...headers, ...options.headers } };

    const response = await fetch(url, config);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API Error: ${response.status}`);
    }
    
    // Some endpoints (like completion) might not return JSON
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// ─── Data Loaders ─────────────────────────────────────────
async function loadGoalHierarchy(goalId) {
    try {
        AppState.tasks = await apiFetch(`/tasks/goal/${goalId}`);
        // For simplicity, we fetch all parts for all tasks here to build the unified timeline
        const partsPromises = AppState.tasks.map(t => apiFetch(`/parts/task/${t.id}`));
        const partsArrays = await Promise.all(partsPromises);
        AppState.parts = partsArrays.flat();
    } catch (e) {
        console.error("Failed to load hierarchy", e);
        showToast("Error loading roadmap details", "error");
    }
}

// ─── Views: Authentication ────────────────────────────────
function renderLogin() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-card glass-card">
                <div class="auth-header">
                    <span class="brand-icon">🧠</span>
                    <h1>Axiom</h1>
                    <p>Enter your learning matrix.</p>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="email" class="form-input" required placeholder="neo@matrix.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="password" class="form-input" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Access Terminal</button>
                    <p class="auth-footer" style="margin-top:20px; text-align:center;">
                        New here? <a href="#register">Initialize profile</a>
                    </p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.classList.add('btn-loading');
        
        try {
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;

            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Login failed (${res.status})`);
            }
            const data = await res.json();
            
            AppState.token = data.access_token;
            localStorage.setItem('axiom_token', AppState.token);
            showToast('Authentication successful', 'success');
            setTimeout(() => initApp(), 500);
        } catch (error) {
            btn.classList.remove('btn-loading');
            showToast(error.message, 'error');
        }
    });
}

function renderRegister() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-card glass-card">
                <div class="auth-header">
                    <span class="brand-icon">🧠</span>
                    <h2>Initialize Profile</h2>
                    <p>Begin your guided evolution.</p>
                </div>
                <form id="register-form">
                    <div class="form-group">
                        <label class="form-label">Alias</label>
                        <input type="text" id="reg-user" class="form-input" required placeholder="Neo">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="reg-email" class="form-input" required placeholder="neo@matrix.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mobile Number <span style="color:var(--text-muted); font-weight:400; text-transform:none;">(for Telegram link)</span></label>
                        <div style="display:flex; gap:8px;">
                            <select id="reg-country-code" class="form-input" style="width:140px; flex-shrink:0; cursor:pointer;">
                                <option value="+91">🇮🇳 +91</option>
                                <option value="+1">🇺🇸 +1</option>
                                <option value="+44">🇬🇧 +44</option>
                                <option value="+61">🇦🇺 +61</option>
                                <option value="+971">🇦🇪 +971</option>
                                <option value="+966">🇸🇦 +966</option>
                                <option value="+86">🇨🇳 +86</option>
                                <option value="+81">🇯🇵 +81</option>
                                <option value="+49">🇩🇪 +49</option>
                                <option value="+33">🇫🇷 +33</option>
                                <option value="+7">🇷🇺 +7</option>
                                <option value="+55">🇧🇷 +55</option>
                                <option value="+82">🇰🇷 +82</option>
                                <option value="+39">🇮🇹 +39</option>
                                <option value="+34">🇪🇸 +34</option>
                                <option value="+60">🇲🇾 +60</option>
                                <option value="+65">🇸🇬 +65</option>
                                <option value="+62">🇮🇩 +62</option>
                                <option value="+92">🇵🇰 +92</option>
                                <option value="+880">🇧🇩 +880</option>
                                <option value="+234">🇳🇬 +234</option>
                                <option value="+27">🇿🇦 +27</option>
                                <option value="+52">🇲🇽 +52</option>
                                <option value="+90">🇹🇷 +90</option>
                            </select>
                            <input type="tel" id="reg-phone" class="form-input" placeholder="9876543210" style="flex:1;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="reg-pass" class="form-input" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Create Identity</button>
                    <p class="auth-footer" style="margin-top:20px; text-align:center;">
                        Already inside? <a href="#login">Return</a>
                    </p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.classList.add('btn-loading');
        
        // Combine country code + phone
        const countryCode = document.getElementById('reg-country-code').value;
        const phoneRaw = document.getElementById('reg-phone').value.trim();
        const fullPhone = phoneRaw ? `${countryCode}${phoneRaw}` : null;
        
        try {
            await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('reg-user').value.trim(),
                    email: document.getElementById('reg-email').value.trim().toLowerCase(),
                    password: document.getElementById('reg-pass').value,
                    phone_number: fullPhone
                })
            });

            // Show success + Telegram connect prompt
            const appEl = document.getElementById('app');
            appEl.innerHTML = `
                <div class="auth-wrapper">
                    <div class="auth-card glass-card" style="text-align:center;">
                        <div style="font-size:64px; margin-bottom:16px;">✅</div>
                        <h2 style="margin-bottom:8px;">Identity Created!</h2>
                        <p style="color:var(--text-muted); margin-bottom:32px;">Your account is ready. Now connect your Telegram coach.</p>
                        
                        <a href="https://t.me/AxiomSmashbot?start=link" target="_blank" 
                           class="btn btn-primary btn-full" 
                           style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px; text-decoration:none;">
                            <span style="font-size:20px;">📱</span> Connect Telegram Coach
                        </a>
                        <p style="color:var(--text-muted); font-size:13px; margin-bottom:24px;">
                            Click above → Tap <b>"Share My Number"</b> in the bot → Done!
                        </p>
                        
                        <a href="#login" class="btn btn-full" 
                           style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); text-decoration:none;">
                            Proceed to Login →
                        </a>
                    </div>
                </div>
            `;

        } catch (error) {
            btn.classList.remove('btn-loading');
            showToast(error.message, 'error');
        }
    });
}

// ─── Views: Dashboard ─────────────────────────────────────
function renderDashboard() {
    if (!AppState.currentGoal) {
        document.getElementById('app').innerHTML = `
            <div class="container" style="text-align:center; padding-top: 20vh;">
                <div class="brand-icon" style="font-size: 4rem; margin-bottom: 24px;">🎯</div>
                <h1 style="font-size: 2.5rem; margin-bottom: 16px;">No Active Directives</h1>
                <p style="color: var(--text-secondary); margin-bottom: 32px; font-size: 1.1rem;">
                    Your learning matrix is empty. Let's create your first goal.
                </p>
                <a href="#onboard" class="btn btn-primary btn-lg">Initialize Goal</a>
            </div>
        `;
        return;
    }

    // Find the next active part
    const activePart = AppState.parts.find(p => p.status === 'Active');
    let upNextHTML = '';
    
    if (activePart) {
        const parentTask = AppState.tasks.find(t => t.id === activePart.task_id);
        upNextHTML = `
            <div class="up-next-label">Next Objective</div>
            <div class="up-next-title">${activePart.title}</div>
            <div class="up-next-task"><i class="fas fa-book-open"></i> ${parentTask ? parentTask.title : ''}</div>
            <div>
                <a href="#quiz/${activePart.id}" class="btn btn-primary">
                    <i class="fas fa-bolt"></i> Prove Mastery
                </a>
            </div>
        `;
    } else {
        upNextHTML = `
            <div class="up-next-label" style="color: var(--status-passed)">Goal Complete</div>
            <div class="up-next-title">You conquered ${AppState.currentGoal.title}!</div>
            <div class="up-next-task">All chapters mastered.</div>
            <div>
                <a href="#onboard" class="btn btn-primary">Start New Goal</a>
            </div>
        `;
    }

    document.getElementById('app').innerHTML = `
        <div class="container slide-up">
            <h1 style="font-size: 2.2rem; margin-bottom: 32px; font-family: var(--font-heading);">
                Welcome back, <span class="text-gradient">${AppState.user.username}</span>
            </h1>
            
            <div class="dashboard-grid">
                <!-- Streak Card -->
                <div class="glass-card streak-card">
                    <div class="streak-number">${AppState.user.current_streak_days}</div>
                    <div class="streak-label">Day Streak</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:12px;">
                        Keep proving yourself every day to grow your streak.
                    </div>
                </div>
                
                <!-- Up Next Card -->
                <div class="glass-card up-next-card">
                    ${upNextHTML}
                </div>
            </div>
            
            <!-- Quick Progress Overview -->
            <div class="glass-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="font-size:1.4rem;">${AppState.currentGoal.title} Progress</h3>
                    <a href="#goals" class="btn btn-ghost btn-sm">View Full Roadmap</a>
                </div>
                
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${calculateOverallProgress()}%; background: var(--gradient-brand); transition: width 1s ease;"></div>
                </div>
                
                <div style="margin-top:12px; font-size:0.9rem; color:var(--text-secondary); text-align:right;">
                    ${AppState.parts.filter(p => p.status === 'Passed').length} / ${AppState.parts.length} Subtopics Mastered
                </div>
            </div>
        </div>
    `;
}

function calculateOverallProgress() {
    if (!AppState.parts || AppState.parts.length === 0) return 0;
    const passed = AppState.parts.filter(p => p.status === 'Passed').length;
    return Math.round((passed / AppState.parts.length) * 100);
}

// ─── Views: Roadmap (Goals) ───────────────────────────────
function renderRoadmap() {
    if (!AppState.currentGoal) {
        location.hash = '#dashboard';
        return;
    }

    let timelineHTML = '';
    
    // Group tasks properly
    const sortedTasks = [...AppState.tasks].sort((a,b) => a.order_index - b.order_index);
    
    sortedTasks.forEach(task => {
        // Find parts for this task
        const taskParts = AppState.parts
            .filter(p => p.task_id === task.id)
            .sort((a,b) => a.order_index - b.order_index);
            
        let partsHTML = '';
        taskParts.forEach(part => {
            let actionBtn = '';
            if (part.status === 'Active') {
                actionBtn = `<a href="#quiz/${part.id}" class="btn btn-sm btn-primary" style="margin-top:12px;"><i class="fas fa-play"></i> Start Quiz</a>`;
            } else if (part.status === 'Passed') {
                actionBtn = `<div style="margin-top:12px; color:var(--status-passed); font-size:0.85rem; font-weight:600;"><i class="fas fa-check-circle"></i> Verified</div>`;
            }
            
            partsHTML += `
                <div class="part-card status-${part.status}">
                    <div class="part-title">${part.title}</div>
                    <div class="part-status status-text-${part.status}">${part.status}</div>
                    ${actionBtn}
                </div>
            `;
        });
        
        timelineHTML += `
            <div class="task-node status-${task.status}">
                <div class="task-header">
                    <div style="font-size:0.85rem; color:var(--accent-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">
                        Chapter ${task.order_index + 1}
                    </div>
                    <div class="task-title">${task.title}</div>
                    <div style="color:var(--text-secondary); font-size:0.95rem;">${task.description || ''}</div>
                </div>
                <div class="parts-grid">
                    ${partsHTML}
                </div>
            </div>
        `;
    });

    document.getElementById('app').innerHTML = `
        <div class="container slide-up">
            <div class="goal-header">
                <h2>${AppState.currentGoal.title}</h2>
                <div class="goal-meta">
                    <span><i class="fas fa-calendar"></i> Target: Expiration Date</span>
                    <span><i class="fas fa-layer-group"></i> ${AppState.tasks.length} Chapters</span>
                </div>
            </div>
            
            <div class="timeline">
                ${timelineHTML}
            </div>
        </div>
    `;
}

// ─── Views: Onboarding Wizard ─────────────────────────────
let wizardState = { goal: '', background: '', schedule: '' };
let currentStep = 1;

function renderOnboard() {
    currentStep = 1;
    wizardState = { goal: '', background: '', schedule: '' };
    
    document.getElementById('app').innerHTML = `
        <div class="container slide-up" style="padding-top: 60px;">
            <div class="wizard-container glass-card">
                
                <div class="wizard-progress">
                    <div class="wizard-bar" id="bar-1"><div class="wizard-bar-fill" style="width:100%"></div></div>
                    <div class="wizard-bar" id="bar-2"><div class="wizard-bar-fill"></div></div>
                    <div class="wizard-bar" id="bar-3"><div class="wizard-bar-fill"></div></div>
                </div>

                <!-- Step 1 -->
                <div class="wizard-step active" id="step-1">
                    <div style="color:var(--accent-primary); font-weight:800; font-size:0.9rem; letter-spacing:0.1em; margin-bottom:12px;">PHASE 1</div>
                    <h2>Primary Directive</h2>
                    <p>What exactly are you trying to master? Be specific (e.g., "Pass the AWS Solutions Architect exam", "Learn conversational Spanish in 3 months")</p>
                    <textarea id="wiz-goal" class="form-textarea" placeholder="Enter your ultimate objective..."></textarea>
                    <div style="margin-top:32px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary btn-lg" onclick="nextWizStep(1)">Continue <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>

                <!-- Step 2 -->
                <div class="wizard-step" id="step-2">
                    <div style="color:var(--accent-primary); font-weight:800; font-size:0.9rem; letter-spacing:0.1em; margin-bottom:12px;">PHASE 2</div>
                    <h2>Current Baseline</h2>
                    <p>What is your current knowledge level? What resources do you have access to? (Syllabus, books, past experience)</p>
                    <textarea id="wiz-bg" class="form-textarea" placeholder="I have 1 year of Python experience, but no cloud knowledge..."></textarea>
                    <div style="margin-top:32px; display:flex; justify-content:space-between;">
                        <button class="btn btn-ghost" onclick="prevWizStep(2)"><i class="fas fa-arrow-left"></i> Back</button>
                        <button class="btn btn-primary btn-lg" onclick="nextWizStep(2)">Continue <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>

                <!-- Step 3 -->
                <div class="wizard-step" id="step-3">
                    <div style="color:var(--accent-primary); font-weight:800; font-size:0.9rem; letter-spacing:0.1em; margin-bottom:12px;">PHASE 3</div>
                    <h2>Study Matrix</h2>
                    <p>When can the system nudge you for daily 15-minute quizzes? Provide comma separated times (HH:MM in 24h format).</p>
                    <input type="text" id="wiz-schedule" class="form-input" placeholder="e.g. 09:00, 20:30" value="09:00, 20:00">
                    <div style="margin-top:32px; display:flex; justify-content:space-between;">
                        <button class="btn btn-ghost" onclick="prevWizStep(3)"><i class="fas fa-arrow-left"></i> Back</button>
                        <button class="btn btn-primary btn-lg" id="generate-btn" onclick="submitWizard()"><i class="fas fa-microchip"></i> Generate Roadmap</button>
                    </div>
                </div>

                <!-- Loading State -->
                <div class="wizard-step" id="step-loading" style="text-align:center; padding: 40px 20px;">
                    <div class="brand-icon" style="font-size: 5rem; animation: pulse-soft 2s infinite;">🧠</div>
                    <h2 style="margin-top:24px;">AI Synthesizing Roadmap...</h2>
                    <p>The neural net is analyzing your parameters and constructing an optimal path.</p>
                </div>
            </div>
        </div>
    `;
}

window.nextWizStep = (current) => {
    if (current === 1) {
        const val = document.getElementById('wiz-goal').value;
        if (!val.trim()) return showToast("Please specify your objective.", "error");
        wizardState.goal = val;
    }
    if (current === 2) {
        const val = document.getElementById('wiz-bg').value;
        if (!val.trim()) return showToast("Please provide baseline context.", "error");
        wizardState.background = val;
    }
    
    document.getElementById(`step-${current}`).classList.remove('active');
    document.getElementById(`step-${current+1}`).classList.add('active');
    document.querySelector(`#bar-${current+1} .wizard-bar-fill`).style.width = '100%';
};

window.prevWizStep = (current) => {
    document.getElementById(`step-${current}`).classList.remove('active');
    document.getElementById(`step-${current-1}`).classList.add('active');
    document.querySelector(`#bar-${current} .wizard-bar-fill`).style.width = '0%';
};

window.submitWizard = async () => {
    const schedVal = document.getElementById('wiz-schedule').value;
    if (!schedVal.trim()) return showToast("Schedule required.", "error");
    wizardState.schedule = schedVal;

    document.getElementById('step-3').classList.remove('active');
    document.getElementById('step-loading').classList.add('active');
    
    // Process Arrays
    const schedules = schedVal.split(',').map(s => s.trim());
    
    try {
        // Build combined prompt for the backend
        const fullPrompt = `Goal: ${wizardState.goal}\nBackground: ${wizardState.background}`;
        
        const res = await apiFetch(`/goals/generate`, {
            method: 'POST',
            body: JSON.stringify({
                user_msg: fullPrompt,
                study_schedule: schedules
            })
        });
        
        showToast("Roadmap Synthesized Successfully!", "success");
        // Reload entire app state to fetch the new goal
        setTimeout(() => initApp(), 1000);
        
    } catch (e) {
        showToast(e.message, "error");
        document.getElementById('step-loading').classList.remove('active');
        document.getElementById('step-3').classList.add('active');
    }
};


// ─── Views: Quiz Arena ────────────────────────────────────
function renderQuizArena(partId) {
    const appEl = document.getElementById('app');
    
    // Fullscreen immersive logic
    appEl.innerHTML = `
        <div class="auth-wrapper" style="align-items: flex-start; padding-top: 10vh;">
            <div id="quiz-container" class="quiz-arena slide-up" style="width:100%;">
                <div style="text-align:center;">
                    <div class="brand-icon" style="font-size:3rem; animation: pulse-soft 2s infinite;">🧠</div>
                    <h2 style="margin-top:20px; font-size:2rem;">Initializing Assessment...</h2>
                    <p style="color:var(--text-secondary);">Connecting to Redis engine</p>
                </div>
            </div>
        </div>
    `;

    initQuizSession(partId);
}

async function initQuizSession(partId) {
    try {
        AppState.quizSession = await apiFetch(`/quiz/start/${partId}`, { method: 'POST' });
        renderQuestion();
    } catch (error) {
        showToast(error.message, "error");
        setTimeout(() => { location.hash = '#dashboard'; }, 1500);
    }
}

function renderQuestion() {
    const session = AppState.quizSession;
    if (!session || !session.session_id) return;
    
    const container = document.getElementById('quiz-container');
    const qCount = session.quiz_length;
    const answeredCount = Object.keys(session.answers).length;
    
    if (answeredCount >= qCount) {
        return handleQuizCompletion();
    }
    
    const currentQData = session.questions[answeredCount];
    const percentage = ((answeredCount) / qCount) * 100;
    
    // TTL Calculation (Visual only, backend enforces strictly)
    const expiresAt = new Date(session.expires_at).getTime();
    
    let optionsHTML = '';
    const labels = ['A', 'B', 'C', 'D'];
    
    currentQData.options.forEach((opt, idx) => {
        const letter = labels[idx];
        optionsHTML += `
            <button class="option-btn" onclick="submitAnswer('${letter}')" id="opt-${letter}">
                <div class="option-badge">${letter}</div>
                <div>${opt}</div>
            </button>
        `;
    });
    
    container.innerHTML = `
        <div class="quiz-timer" id="quiz-countdown">15:00</div>
        
        <div style="text-align:center; margin-bottom:24px; color:var(--text-secondary); font-weight:700; font-size:0.9rem; letter-spacing:0.1em; text-transform:uppercase;">
            Question ${answeredCount + 1} of ${qCount}
        </div>
        
        <!-- Progress Bar -->
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 99px; margin-bottom:40px; overflow:hidden;">
            <div style="height: 100%; width: ${percentage}%; background: var(--gradient-brand); transition: width 0.5s ease;"></div>
        </div>
        
        <div class="question-text">${currentQData.question}</div>
        
        <div class="options-grid">
            ${optionsHTML}
        </div>
    `;
    
    startTimer(expiresAt);
}

let timerInterval;
function startTimer(expiresAt) {
    clearInterval(timerInterval);
    const el = document.getElementById('quiz-countdown');
    if (!el) return;
    
    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const diff = expiresAt - now;
        
        if (diff <= 0) {
            clearInterval(timerInterval);
            el.innerHTML = "EXPIRED";
            handleQuizCompletion();
            return;
        }
        
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        el.innerHTML = `<i class="fas fa-clock"></i> ${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
        
        if (m < 2) el.style.color = 'var(--status-danger)';
    }, 1000);
}

window.submitAnswer = async (selectedLetter) => {
    // Disable all buttons instantly
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        if(btn.id === `opt-${selectedLetter}`) {
            btn.classList.add('selected');
        } else {
            btn.style.opacity = '0.5';
        }
    });
    
    const session = AppState.quizSession;
    const answeredCount = Object.keys(session.answers).length;
    
    try {
        const res = await apiFetch(`/quiz/answer`, {
            method: 'POST',
            body: JSON.stringify({
                part_id: session.part_id,
                question_index: answeredCount,
                selected_option: selectedLetter
            })
        });
        
        AppState.quizSession = res;
        
        // Brief pause for aesthetics before next question
        setTimeout(() => {
            renderQuestion();
        }, 600);
        
    } catch (e) {
        showToast(e.message, "error");
        setTimeout(() => location.hash = '#dashboard', 2000);
    }
};

async function handleQuizCompletion() {
    clearInterval(timerInterval);
    const session = AppState.quizSession;
    const container = document.getElementById('quiz-container');
    
    container.innerHTML = `
        <div style="text-align:center;">
            <div class="brand-icon" style="font-size:5rem; animation: pulse-soft 1s infinite;">⚙️</div>
            <h2 style="margin-top:20px; font-size:2rem;">Processing Evaluation</h2>
        </div>
    `;

    try {
        const result = await apiFetch(`/quiz/finish/${session.part_id}`, { method: 'POST' });
        
        const passed = result.passed;
        const color = passed ? 'var(--status-passed)' : 'var(--status-danger)';
        const icon = passed ? '🌟' : '💀';
        const msg = passed ? 'Verification Accepted' : 'Inadequate. Remediation Required.';
        
        container.innerHTML = `
            <div class="glass-card" style="text-align:center; padding: 60px;">
                <div style="font-size: 6rem; line-height:1; margin-bottom: 24px;">${icon}</div>
                <h1 style="font-size: 3rem; color: ${color}; margin-bottom: 12px; font-family: var(--font-heading);">${result.score}% Accuracy</h1>
                <p style="font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 40px;">${msg}</p>
                <button class="btn btn-primary btn-lg" onclick="initApp()">Return to Dashboard</button>
            </div>
        `;
        
    } catch (e) {
        showToast(e.message, "error");
        setTimeout(() => initApp(), 3000);
    }
}

// ─── Helpers ──────────────────────────────────────────────
function logout() {
    localStorage.removeItem('axiom_token');
    AppState.token = null;
    AppState.user = null;
    AppState.currentGoal = null;
    location.hash = '#login';
    handleRoute();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
