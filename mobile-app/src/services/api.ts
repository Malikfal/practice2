import axios from 'axios';
import { router } from 'expo-router';

export const API_BASE_URL = 'http://192.168.0.193:8221/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.log('Сессия истекла. Перенаправление на логин...');
      router.replace('/login'); 
    }
    return Promise.reject(error);
  }
);

export default api;