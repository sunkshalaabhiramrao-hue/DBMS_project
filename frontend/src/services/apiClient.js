import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Request Interceptor: Automatically attach Bearer token
API.interceptors.request.use(
  (config) => {
    const isAdminRequest = config.url?.startsWith('/admin');
    const token = isAdminRequest
      ? sessionStorage.getItem('rentalAdminToken')
      : localStorage.getItem('rentalToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 (expired/invalid token) globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (error.config?.url?.startsWith('/admin')) {
        sessionStorage.removeItem('rentalAdminToken');
        if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login';
        }
      } else {
        localStorage.removeItem('rentalToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;