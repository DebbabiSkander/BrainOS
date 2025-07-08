// src/index.js - Point d'entrée React mis à jour
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Obtenir le conteneur root
const container = document.getElementById('root');
const root = createRoot(container);

// Rendre l'application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Si vous voulez commencer à mesurer les performances dans votre app,
// passez une fonction pour logger les résultats (par exemple: reportWebVitals(console.log))
// ou envoyez vers un endpoint d'analytics. En savoir plus: https://bit.ly/CRA-vitals
reportWebVitals();