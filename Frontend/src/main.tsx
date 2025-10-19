import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const AppAny = App as any;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppAny employeeID={2} />
  </StrictMode>
);
