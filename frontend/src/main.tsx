import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { store } from './book/store';
import App from './component/common/App/App';
import TranslationBootstrap from './component/common/TranslationBootstrap/TranslationBootstrap';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}><TranslationBootstrap><HashRouter><App /></HashRouter></TranslationBootstrap></Provider>
  </React.StrictMode>,
);
