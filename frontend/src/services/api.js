const BASE_URL = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
export const API_BASE = `${BASE_URL}/api/v1`;

// --- Token Management ---
export const getToken = () => localStorage.getItem('axiom_token');
export const setToken = (token) => localStorage.setItem('axiom_token', token);
export const clearToken = () => localStorage.removeItem('axiom_token');
export const isLoggedIn = () => !!getToken();

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// --- Sanitized error messages ---
const SAFE_ERROR_MAP = {
  'Failed to fetch': 'Unable to connect to server. Please check your internet connection.',
  'NetworkError': 'Network error. Please try again.',
};

function sanitizeError(message) {
  // Return mapped safe message, or the server message if it's short and non-technical
  if (SAFE_ERROR_MAP[message]) return SAFE_ERROR_MAP[message];
  // Don't expose stack traces or internal details
  if (message && message.length < 200 && !message.includes('Traceback') && !message.includes('Error:')) {
    return message;
  }
  return 'Something went wrong. Please try again.';
}

async function request(method, path, body = null) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (res.status === 401) {
    clearToken();
    // Disabled redirect for debugging
    // window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (res.status === 429) {
    throw new Error('Too many requests. Please wait a moment and try again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(sanitizeError(data.detail || 'Request failed'));
  return data;
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
export const register = (email, password, timezone = 'Asia/Kolkata', schedule = ['12:00', '18:00']) => {
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) {
    return Promise.reject(new Error(`Password requirements: ${pwErrors.join(', ')}`));
  }
  return request('POST', '/auth/register', { email, password, timezone, study_schedule: schedule });
};

export const login = (email, password) =>
  request('POST', '/auth/login', { email, password });

export const forgotPassword = (email) =>
  request('POST', '/auth/forgot-password', { email });

export const resetPassword = (token, newPassword) => {
  const pwErrors = validatePassword(newPassword);
  if (pwErrors.length > 0) {
    return Promise.reject(new Error(`Password requirements: ${pwErrors.join(', ')}`));
  }
  return request('POST', '/auth/reset-password', { token, new_password: newPassword });
};

export const googleLogin = (credential) =>
  request('POST', '/auth/google', { credential });


export const linkTelegram = (chatId) =>
  request('POST', '/auth/link-telegram', { telegram_chat_id: chatId });

// --- User ---
export const getProfile = () => request('GET', '/users/me');

export const updateProfile = (data) => request('PATCH', '/users/profile', data);

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/users/profile/image`, {
    method: 'POST',
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      // Do NOT set Content-Type header manually here; the browser sets it with the boundary for FormData
    },
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
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

// --- Conversational Onboarding ---
export const onboardingChat = (messages, sessionId = null) =>
  request('POST', '/goals/chat', { messages, session_id: sessionId });

export const getChatSessions = () => request('GET', '/goals/chat-sessions');

export const getSessionMessages = (sessionId) =>
  request('GET', `/goals/chat-sessions/${sessionId}/messages`);

export const deleteChatSession = (sessionId) =>
  request('DELETE', `/goals/chat-sessions/${sessionId}`);

export const finalizeGoal = (title, roadmap, settings = {}) =>
  request('POST', '/goals/finalize', { title, roadmap, settings });

export const quickActivateGoal = (title) =>
  request('POST', '/goals/quick-activate', { title });

export const generateYoutubeRoadmap = (url) =>
  request('POST', '/goals/youtube-roadmap', { url });

// --- Personal Workspace ---
export const getPersonalTasks = () => request('GET', '/personal/');
export const createPersonalTask = (data) => request('POST', '/personal/', data);
export const updatePersonalTask = (taskId, status) => request('PUT', `/personal/${taskId}?status_str=${status}`);
export const deletePersonalTask = (taskId) => request('DELETE', `/personal/${taskId}`);
export const activateGoal = (goalId) =>
  request('POST', `/goals/${goalId}/activate`);
 
export const deleteGoal = (goalId) =>
  request('DELETE', `/goals/${goalId}`);
 
export const toggleGoalStatus = (goalId) =>
  request('POST', `/goals/${goalId}/toggle`);

export const updateGoalNotes = (goalId, notes) =>
  request('PATCH', `/goals/${goalId}/notes`, { notes });

export const getChatHistory = () =>
  request('GET', '/goals/chat/history');

export const clearChatHistory = () =>
  request('DELETE', '/goals/chat/history');

