import { existsSync } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';

// En desarrollo carga el servidor de Vite; en producción, el build empaquetado.
const urlDesarrollo = process.env.VITE_DEV_SERVER_URL;
// La API empaquetada (npm run empaquetar). Si está, la app arranca su propio servidor y no hace falta nada más.
const apiEmpaquetada = path.join(__dirname, '..', 'dist-api', 'servidor.js');

let urlApi: string | undefined;

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'TurnoCare',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // La app no abre ventanas nuevas ni navega a otros sitios: solo muestra su propia interfaz.
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  ventana.webContents.on('will-navigate', (evento, url) => {
    if (!(urlDesarrollo ? url.startsWith(urlDesarrollo) : url.startsWith('file://'))) evento.preventDefault();
  });

  if (urlDesarrollo) {
    void ventana.loadURL(urlDesarrollo);
  } else {
    void ventana.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), urlApi ? { query: { api: urlApi } } : undefined);
  }
}

async function iniciarApi() {
  if (urlDesarrollo || !existsSync(apiEmpaquetada)) return;
  // Los datos quedan en la carpeta del usuario (%APPDATA%\TurnoCare\datos), no en la de instalación.
  const directorioDatos = path.join(app.getPath('userData'), 'datos');
  const { iniciarServidor } = require(apiEmpaquetada) as { iniciarServidor: (dir: string) => Promise<{ url: string }> };
  urlApi = (await iniciarServidor(directorioDatos)).url;
}

// Una sola copia abierta: dos servidores escribiendo los mismos archivos los dañarían.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const ventana = BrowserWindow.getAllWindows()[0];
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  void app.whenReady().then(async () => {
    try {
      await iniciarApi();
    } catch (e) {
      dialog.showErrorBox('TurnoCare no pudo iniciar', `No se pudo arrancar el servidor interno.\n\n${(e as Error).message}`);
      app.quit();
      return;
    }
    crearVentana();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
