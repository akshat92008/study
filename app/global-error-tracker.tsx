'use client';

import { useEffect } from 'react';

export function GlobalErrorTracker() {
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.background = 'red';
      el.style.color = 'white';
      el.style.zIndex = '999999';
      el.style.padding = '20px';
      el.style.fontSize = '24px';
      el.style.overflow = 'auto';
      el.innerHTML = `<h1>CLIENT CRASH</h1><pre>${e.error?.stack || e.message}</pre>`;
      document.body.appendChild(el);
    };
    window.addEventListener('error', handleError);
    
    const handleRejection = (e: PromiseRejectionEvent) => {
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.background = 'orange';
      el.style.color = 'white';
      el.style.zIndex = '999999';
      el.style.padding = '20px';
      el.style.fontSize = '24px';
      el.style.overflow = 'auto';
      el.innerHTML = `<h1>PROMISE CRASH</h1><pre>${e.reason?.stack || e.reason}</pre>`;
      document.body.appendChild(el);
    };
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  return null;
}
