import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const client = axios.create({
  baseURL: API_URL,
});

// In-memory access token
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Refresh token in localStorage
export const setRefreshToken = (token) => {
  if (token) {
    localStorage.setItem('agrocare_refresh_token', token);
  } else {
    localStorage.removeItem('agrocare_refresh_token');
  }
};

export const getRefreshToken = () => localStorage.getItem('agrocare_refresh_token');

// Request interceptor — attach Bearer token
client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — refresh on 401
let isRefreshing = false;
let refreshQueue = [];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/')
    ) {
      const refreshTkn = getRefreshToken();
      if (!refreshTkn) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshTkn}` } }
        );
        accessToken = res.data.access_token;
        setRefreshToken(res.data.refresh_token);
        refreshQueue.forEach((p) => p.resolve());
        refreshQueue = [];
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach((p) => p.reject(refreshError));
        refreshQueue = [];
        accessToken = null;
        setRefreshToken(null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => client.post('/auth/login', data),
  signup: (data) => client.post('/auth/signup', data),
  refresh: () => {
    const refreshTkn = getRefreshToken();
    if (!refreshTkn) return Promise.reject(new Error('No refresh token'));
    return axios.post(
      `${API_URL}/auth/refresh`,
      {},
      { headers: { Authorization: `Bearer ${refreshTkn}` } }
    );
  },
  logout: () => client.post('/auth/logout'),
  me: () => client.get('/auth/me'),
};

// Cattle API
export const cattleAPI = {
  list: () => client.get('/cattle'),
  get: (id) => client.get(`/cattle/${id}`),
  create: (data) => client.post('/cattle', data),
  update: (id, data) => client.put(`/cattle/${id}`, data),
  delete: (id) => client.delete(`/cattle/${id}`),
};

// Video API
export const videoAPI = {
  upload: (formData, config = {}) =>
    client.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
  get: (id) => client.get(`/videos/${id}`),
  listByCattle: (cattleId) => client.get(`/videos/cattle/${cattleId}`),
  delete: (id) => client.delete(`/videos/${id}`),
  streamUrl: (id) => `${API_URL}/videos/${id}/stream`,
};

// Analysis API
export const analysisAPI = {
  trigger: (videoId) => client.post(`/analysis/${videoId}`),
  get: (videoId) => client.get(`/analysis/${videoId}`),
  dashboardStats: () => client.get('/analysis/dashboard/stats'),
};

export default client;
