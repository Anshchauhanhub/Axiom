const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

// --- Token Management ---
export const getToken = () => localStorage.getItem('axiom_token');
export const setToken = (token) => localStorage.setItem('axiom_token', token);
export const clearToken = () => localStorage.removeItem('axiom_token');
export const isLoggedIn = () => !!getToken();

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

async function request(method, path, body = null) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (res.status === 401) {
    clearToken();
    window.location.href = '/onboarding';
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// --- Auth ---
export const register = (email, password, timezone = 'Asia/Kolkata', schedule = ['12:00', '18:00']) =>
  request('POST', '/auth/register', { email, password, timezone, study_schedule: schedule });

export const login = (email, password) =>
  request('POST', '/auth/login', { email, password });

export const linkTelegram = (chatId) =>
  request('POST', '/auth/link-telegram', { telegram_chat_id: chatId });

// --- User ---
export const getProfile = () => request('GET', '/users/me');

export const updateSchedule = (timezone, schedule) =>
  request('PUT', '/users/schedule', { timezone, study_schedule: schedule });

// --- Goals ---
export const createGoal = (title) => request('POST', '/goals/', { title });

export const listGoals = () => request('GET', '/goals/');

export const generateRoadmap = (goalId) =>
  request('POST', `/goals/${goalId}/generate-roadmap`);

export const getRoadmap = (goalId) =>
  request('GET', `/goals/${goalId}/roadmap`);

export const getPartContent = (partId) =>
  request('GET', `/goals/parts/${partId}/content`);

// --- Quiz ---
export const startQuiz = (partId) => request('POST', `/quiz/start/${partId}`);

export const submitQuiz = (quizToken, answers) =>
  request('POST', '/quiz/submit', { quiz_token: quizToken, answers });

export const getActiveQuiz = () => request('GET', '/quiz/active');

// --- Conversational Onboarding ---
export const onboardingChat = (messages) =>
  request('POST', '/goals/chat', { messages });

export const finalizeGoal = (title, roadmap) =>
  request('POST', '/goals/finalize', { title, roadmap });

export const quickActivateGoal = (title) =>
  request('POST', '/goals/quick-activate', { title });
 
export const activateGoal = (goalId) =>
  request('POST', `/goals/${goalId}/activate`);
 
export const deleteGoal = (goalId) =>
  request('DELETE', `/goals/${goalId}`);
 
export const toggleGoalStatus = (goalId) =>
  request('POST', `/goals/${goalId}/toggle`);
