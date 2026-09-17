import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Fetch Interceptor to attach JWT token to all server API requests
const originalFetch = window.fetch.bind(window);

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url.startsWith('/api/') && !url.startsWith('/api/auth/otp/request') && !url.startsWith('/api/auth/otp/verify')) {
    const token = localStorage.getItem('tcpp_jwt_token');
    if (token) {
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }
  }

  const response = await originalFetch(input, init);

  // If token is invalid/expired/tampered or server rejected request with 401
  if (response.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/otp/')) {
    console.warn('[AUTH] Session token rejected or expired (401). Redirecting to login...');
    localStorage.removeItem('tcpp_jwt_token');
    localStorage.removeItem('tcpp_user_name');
    localStorage.removeItem('tcpp_user_email');
    localStorage.removeItem('tcpp_user_job_title');
    localStorage.removeItem('tcpp_user_role');
    window.dispatchEvent(new Event('auth_unauthorized'));
  }

  return response;
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    writable: true,
    configurable: true,
  });
} catch {
  try {
    Object.defineProperty(Window.prototype, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
    });
  } catch (err) {
    console.error('[AUTH] Unable to define custom fetch interceptor:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
