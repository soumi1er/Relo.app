import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/tailwind.css";
import "./index.css";
import "./styles/modules.css";

// HashRouter : indispensable en Electron packagé (chargement via file://,
// un BrowserRouter classique casserait la navigation).
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
