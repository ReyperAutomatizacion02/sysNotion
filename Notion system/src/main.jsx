// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // O './App.js'

// *** Importar los estilos base de ReactFlow PRIMERO ***
import 'reactflow/dist/style.css';

// *** Importar tus estilos globales (con reset y altura) DESPUÉS ***
import './index.css'; // <-- Asegúrate que esta línea esté correcta

// Ya no necesitamos importar los otros CSS globales aquí


// El punto de entrada de tu aplicación React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Renderiza el componente principal de tu aplicación */}
    <App />
  </React.StrictMode>,
);