import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './index.css';
import { TooltipProvider } from "@/components/ui/tooltip"
import ErrorBoundary from './components/ErrorBoundary';

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
