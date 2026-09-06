const BASE_URL = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
export const API_BASE = `${BASE_URL}/api/v1`;

// --- Token Management ---
export const getToken = () => localStorage.getItem('edxiom_token');
export const setToken = (token) => localStorage.setItem('edxiom_token', token);
export const clearToken = () => localStorage.removeItem('edxiom_token');
export const isLoggedIn = () => !!getToken();

const AUTH_HEADER = 'Authorization';

const authHeaders = () => {
  const token = getToken();
  return token ? { [AUTH_HEADER]: `Bearer ${token}` } : {};
};

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
  ...authHeaders(),
});

// --- Sanitized error messages ---
const SAFE_ERROR_MAP = {
  'Failed to fetch': 'Unable to connect to server. Please check your internet connection.',
  'NetworkError': 'Network error. Please try again.',
};

function sanitizeError(message) {
  if (SAFE_ERROR_MAP[message]) return SAFE_ERROR_MAP[message];
  if (message && message.length < 200 && !message.includes('Traceback') && !message.includes('Error:')) {
    return message;
  }
  return 'Something went wrong. Please try again.';
}

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return {};
}

async function handleResponse(res) {
  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired');
  }
  if (res.status === 429) {
    throw new Error('Too many requests. Please wait a moment and try again.');
  }

  const data = await parseResponse(res);
  if (!res.ok) throw new Error(sanitizeError(data.detail || 'Request failed'));
  return data;
}

async function request(method, path, body = null) {
  const opts = { method, headers: jsonHeaders() };
  if (body) opts.body = JSON.stringify(body);
  return handleResponse(await fetch(`${API_BASE}${path}`, opts));
}

// --- Password Validation (mirrors backend rules) ---
export function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one digit');
  return errors;
}

// --- Auth ---
export const register = (email, password, timezone = 'Asia/Kolkata', schedule = ['12:00', '18:00'], accountType = 'student') => {
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) {
    return Promise.reject(new Error(`Password requirements: ${pwErrors.join(', ')}`));
  }
  return request('POST', '/auth/register', { email, password, timezone, study_schedule: schedule, account_type: accountType });
};

export const login = (email, password, accountType = 'student') =>
  request('POST', '/auth/login', { email, password, account_type: accountType });

export const forgotPassword = (email) =>
  request('POST', '/auth/forgot-password', { email });

export const resetPassword = (token, newPassword) => {
  const pwErrors = validatePassword(newPassword);
  if (pwErrors.length > 0) {
    return Promise.reject(new Error(`Password requirements: ${pwErrors.join(', ')}`));
  }
  return request('POST', '/auth/reset-password', { token, new_password: newPassword });
};

export const googleLogin = (credential, accountType = 'student') =>
  request('POST', '/auth/google', { credential, account_type: accountType });

export const linkTelegram = (chatId) =>
  request('POST', '/auth/link-telegram', { telegram_chat_id: chatId });

// --- User ---
export const getProfile = () => request('GET', '/users/me');

export const earnCredit = () => request('POST', '/users/earn-credit');

export const unlockTask = (taskId, useCredit = true) =>
  request('POST', `/goals/tasks/${taskId}/unlock?use_credit=${useCredit}`);

export const updateProfile = (data) => request('PATCH', '/users/profile', data);

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/users/profile/image`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  return handleResponse(res);
};

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

export const getAllTasks = () =>
  request('GET', '/goals/all-tasks');

// --- Quiz ---
export const startQuiz = (partId) => request('POST', `/quiz/start/${partId}`);

export const submitQuiz = (quizToken, answers) =>
  request('POST', '/quiz/submit', { quiz_token: quizToken, answers });

export const getActiveQuiz = () => request('GET', '/quiz/active');
export const completeDirect = (partId) => request('POST', `/quiz/complete-direct/${partId}`);

// --- Architect Chat (Onboarding) ---
export const architectChat = (messages, sessionId = null) =>
  request('POST', '/goals/chat', { messages, session_id: sessionId, session_type: 'architect' });

export const getArchitectSessions = () => request('GET', '/goals/chat-sessions?session_type=architect');

export const deleteArchitectSession = (sessionId) =>
  request('DELETE', `/goals/chat-sessions/${sessionId}`);

// --- Assistant Chat (Edxiom AI) ---
export const assistantChat = (messages, sessionId = null) =>
  request('POST', '/goals/chat', { messages, session_id: sessionId, session_type: 'assistant' });

export const getAssistantSessions = () => request('GET', '/goals/chat-sessions?session_type=assistant');

export const deleteAssistantSession = (sessionId) =>
  request('DELETE', `/goals/chat-sessions/${sessionId}`);

export const getSessionMessages = (sessionId) =>
  request('GET', `/goals/chat-sessions/${sessionId}/messages`);

export const finalizeGoal = (title, roadmap, settings = {}, preferences = {}) =>
  request('POST', '/goals/finalize', {
    title,
    roadmap,
    settings,
    preferred_language: preferences.preferred_language || preferences.language,
    target_months: preferences.target_months || preferences.months,
    daily_hours: preferences.daily_hours || preferences.dailyHours,
    playlist_url: preferences.playlist_url || preferences.playlistUrl,
    website_url: preferences.website_url || preferences.websiteUrl,
  });

export const quickActivateGoal = (title) =>
  request('POST', '/goals/quick-activate', { title });

export const generateYoutubeRoadmap = (url) =>
  request('POST', '/goals/youtube-roadmap', { url });

// --- Personal Workspace ---
export const getPersonalTasks = () => request('GET', '/personal/');
export const createPersonalTask = (data) => request('POST', '/personal/', data);
export const updatePersonalTask = (taskId, status) =>
  request('PUT', `/personal/${taskId}?status_str=${status}`);
export const deletePersonalTask = (taskId) => request('DELETE', `/personal/${taskId}`);
export const activateGoal = (goalId) => request('POST', `/goals/${goalId}/activate`);

export const deleteGoal = (goalId) => request('DELETE', `/goals/${goalId}`);

export const toggleGoalStatus = (goalId) => request('POST', `/goals/${goalId}/toggle`);

export const updateGoalNotes = (goalId, notes) =>
  request('PATCH', `/goals/${goalId}/notes`, { notes });

export const getChatHistory = () =>
  request('GET', '/goals/chat/history');

export const clearChatHistory = () =>
  request('DELETE', '/goals/chat/history');
