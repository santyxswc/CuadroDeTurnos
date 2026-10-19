import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProveedorEstado } from './estado';
import { ProveedorSesion } from './sesion';
import { ProveedorTiempoReal } from './api/tiempoReal';
import './estilos.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorSesion>
      <ProveedorTiempoReal>
        <ProveedorEstado>
          <App />
        </ProveedorEstado>
      </ProveedorTiempoReal>
    </ProveedorSesion>
  </StrictMode>,
);
