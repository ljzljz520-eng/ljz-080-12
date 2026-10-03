import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import H5App from './H5App';
import './h5.less';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <H5App />
    </HashRouter>
  </StrictMode>,
);
