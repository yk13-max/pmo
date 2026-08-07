import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/broadsheet.css';
import './styles/app.css';
// Brand layer last: it overrides both the design system's tokens and app chrome.
import './styles/theme.css';
import { App } from './App';
import { PortfolioProvider } from './store/portfolio';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortfolioProvider>
      <App />
    </PortfolioProvider>
  </StrictMode>,
);
