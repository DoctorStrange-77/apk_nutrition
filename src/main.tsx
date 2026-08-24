import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { BetaAccessGate } from './components/BetaAccessGate';
import './styles.css';
import './styles-v07.css';
import './styles-v07-calendar.css';
import './styles-v08.css';
import './styles-v09.css';
import './styles-v10.css';
import './styles-v101.css';
import './styles-v102.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BetaAccessGate><App /></BetaAccessGate>
  </React.StrictMode>,
);
