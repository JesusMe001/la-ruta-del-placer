import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './admin/AdminApp.jsx';
import './styles.css';
import './admin/admin-styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
