// Genera la guía de usuario en PDF (docs/Guia_de_Usuario_TurnoCare.pdf) con capturas reales de la app.
//
// 1. Arranca la API empaquetada con una carpeta de datos temporal y carga un equipo de ejemplo
//    (cuadro publicado, chat, solicitudes, pacientes).
// 2. Abre la app en una ventana oculta, entra como enfermero y como coordinadora y toma una captura de cada pantalla.
// 3. Convierte docs/guia/guia.html (que usa esas capturas) en PDF.
//
// Uso: npm run guia:pdf   (requiere haber compilado la app: npm run build y la API empaquetada)
// Autor: Santiago Caicedo
const { app, BrowserWindow } = require('electron');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const escritorio = path.join(raiz, 'apps', 'desktop');
const carpetaImg = path.join(raiz, 'docs', 'guia', 'img');
const PASSWORD = 'Demo2026';

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const dia = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function cargarEjemplo(url) {
  const pedir = async (token, metodo, ruta, cuerpo) => {
    const r = await fetch(url + ruta, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: cuerpo && JSON.stringify(cuerpo),
    });
    const texto = await r.text();
    if (!r.ok) console.warn(`  (aviso) ${metodo} ${ruta}: ${r.status} ${texto.slice(0, 120)}`);
    return texto ? JSON.parse(texto) : null;
  };
  const entrar = async (documento) => (await pedir(null, 'POST', '/auth/login', { usuario: documento, password: PASSWORD })).tokenAcceso;
  const coord = await entrar('52123456');
  const andres = await entrar('80234567');
  const camila = await entrar('1020345678');

  const usuarios = await pedir(coord, 'GET', '/usuarios');
  const tipos = await pedir(coord, 'GET', '/tipos-turno');
  const tipo = (codigo) => tipos.find((t) => t.codigo === codigo).id;
  const idDe = (documento) => usuarios.find((u) => u.documento === documento).id;

  // Período: desde el lunes de la semana pasada, tres semanas.
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7);
  const inicio = dia(lunes, 0);
  const fin = dia(lunes, 20);
  const cuadro = await pedir(coord, 'POST', '/cuadros', { periodoInicio: inicio, periodoFin: fin });

  // Rotación sencilla: dos mañanas, dos tardes, dos noches y dos libres, corrida por persona.
  const patron = ['M', 'M', 'T', 'T', 'N', 'N', null, null];
  const hora = hoy.getHours();
  const turnoAhora = hora >= 7 && hora < 13 ? 'M' : hora >= 13 && hora < 19 ? 'T' : 'N';
  const cambios = [];
  usuarios
    .filter((u) => u.rol === 'ENFERMERO')
    .forEach((u, i) => {
      for (let d = 0; d <= 20; d++) {
        const fecha = dia(lunes, d);
        let codigo = patron[(d + i * 3) % patron.length];
        // Andrés está de turno ahora mismo, para mostrar la marcación y el estado "En turno".
        if (u.documento === '80234567' && fecha === dia(hoy, 0)) codigo = turnoAhora;
        if (u.documento === '80234567' && fecha === dia(hoy, -1) && turnoAhora === 'M') codigo = 'T';
        cambios.push({ usuarioId: u.id, fecha, tipoTurnoId: codigo && tipo(codigo) });
      }
    });
  await pedir(coord, 'PUT', `/cuadros/${cuadro.id}/celdas`, { cambios });
  await pedir(coord, 'POST', `/cuadros/${cuadro.id}/publicar`);

  await pedir(andres, 'POST', '/marcaciones', { equipo: 'Estación de enfermería' });

  // El resto del equipo también marcó: así «Estado del turno actual» no muestra a todos ausentes.
  const ahora = Date.now();
  const deHoy = await pedir(coord, 'GET', `/cuadros/asignaciones?desde=${dia(hoy, -1)}&hasta=${dia(hoy, 0)}`);
  for (const a of deHoy.filter((x) => x.usuarioId !== idDe('80234567') && Date.parse(x.inicio) <= ahora && Date.parse(x.fin) + 6 * 3600_000 > ahora)) {
    const enHora = (iso, minutos) => new Date(Date.parse(iso) + minutos * 60_000).toISOString();
    await pedir(coord, 'POST', '/marcaciones/correcciones', { usuarioId: a.usuarioId, asignacionId: a.id, tipo: 'ENTRADA', hora: enHora(a.inicio, -4), motivo: 'Datos de ejemplo' });
    if (Date.parse(a.fin) <= ahora) {
      await pedir(coord, 'POST', '/marcaciones/correcciones', { usuarioId: a.usuarioId, asignacionId: a.id, tipo: 'SALIDA', hora: enHora(a.fin, 3), motivo: 'Datos de ejemplo' });
    }
  }

  // Pacientes atendidos en los turnos ya pasados de Andrés.
  const asignaciones = await pedir(coord, 'GET', `/cuadros/asignaciones?desde=${inicio}&hasta=${dia(hoy, -1)}`);
  let n = 0;
  for (const a of asignaciones.filter((x) => x.usuarioId === idDe('80234567'))) {
    await pedir(andres, 'PUT', `/atenciones/${a.id}`, { cantidad: [6, 8, 5, 7, 9][n++ % 5] });
  }

  // Chat del equipo.
  await pedir(coord, 'POST', '/chat', { contenido: 'Buenos días, equipo. Recuerden revisar el cuadro de las próximas dos semanas.', esNovedad: true });
  await pedir(camila, 'POST', '/chat', { contenido: 'Gracias, Laura. ¿Alguien me puede cubrir el jueves en la tarde?', esNovedad: false });
  await pedir(andres, 'POST', '/chat', { contenido: 'Yo reviso en el filtro de aptos y te confirmo.', esNovedad: false });

  // Solicitudes: un permiso pendiente de la coordinadora y una cesión que Andrés debe responder.
  await pedir(andres, 'POST', '/solicitudes', { tipo: 'PERMISO', desde: dia(hoy, 4), hasta: dia(hoy, 4), categoria: 'CITA_MEDICA', comentario: 'Control médico en la mañana.' });
  const futuros = await pedir(coord, 'GET', `/cuadros/asignaciones?desde=${dia(hoy, 2)}&hasta=${fin}`);
  const deAndres = new Set(futuros.filter((a) => a.usuarioId === idDe('80234567')).map((a) => a.fecha));
  const deCamila = futuros.find((a) => a.usuarioId === idDe('1020345678') && !deAndres.has(a.fecha) && !deAndres.has(dia(a.fecha + 'T12:00', -1)));
  if (deCamila) await pedir(camila, 'POST', '/solicitudes', { tipo: 'CESION', asignacionId: deCamila.id, companeroId: idDe('80234567'), comentario: '¿Me cubres este turno? Tengo clase.' });
}

async function capturar(ventana, nombre, espera = 1200) {
  await esperar(espera);
  // Sin foco en el botón pulsado, para que el menú no muestre dos opciones resaltadas.
  await js(ventana, 'document.activeElement && document.activeElement.blur()');
  const imagen = await ventana.webContents.capturePage();
  writeFileSync(path.join(carpetaImg, `${nombre}.png`), imagen.toPNG());
  console.log(`  ✓ ${nombre}.png`);
}

const js = (ventana, codigo) => ventana.webContents.executeJavaScript(codigo);
const pulsar = (ventana, texto) =>
  js(ventana, `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(texto)})); b && b.click(); return !!b; })()`);

async function entrar(ventana, documento) {
  await js(
    ventana,
    `(() => {
      const poner = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      const [u, p] = document.querySelectorAll('input');
      poner(u, ${JSON.stringify(documento)}); poner(p, ${JSON.stringify(PASSWORD)});
      setTimeout(() => document.querySelector('button.primario').click(), 50);
    })()`,
  );
  await esperar(2500);
}

async function main() {
  mkdirSync(carpetaImg, { recursive: true });
  const datos = mkdtempSync(path.join(tmpdir(), 'turnocare-guia-'));
  const { iniciarServidor } = require(path.join(escritorio, 'dist-api', 'servidor.js'));
  const { url, app: api } = await iniciarServidor(datos);
  console.log('Cargando el equipo de ejemplo…');
  await cargarEjemplo(url);

  console.log('Tomando capturas…');
  const ventana = new BrowserWindow({ width: 1366, height: 860, show: false, webPreferences: { offscreen: false } });
  await ventana.loadFile(path.join(escritorio, 'dist', 'index.html'), { query: { api: url } });
  await esperar(800);
  await capturar(ventana, '01-ingreso');

  await entrar(ventana, '80234567');
  await capturar(ventana, '02-inicio-enfermero');
  for (const [menu, nombre] of [
    ['Solicitudes', '03-solicitudes'],
    ['Filtro de aptos', '04-aptos'],
    ['Horas y recargos', '05-horas'],
    ['Vacaciones', '06-vacaciones'],
    ['Pacientes atendidos', '07-pacientes'],
    ['Ayuda', '08-ayuda'],
  ]) {
    await pulsar(ventana, menu);
    await capturar(ventana, nombre);
  }
  await pulsar(ventana, 'Salir');
  await esperar(800);

  await entrar(ventana, '52123456');
  await capturar(ventana, '09-inicio-coordinadora');
  for (const [menu, nombre] of [
    ['Editor de cuadro', '10-editor'],
    ['Solicitudes', '11-solicitudes-coordinadora'],
    ['Administración', '12-administracion'],
  ]) {
    await pulsar(ventana, menu);
    await capturar(ventana, nombre, 3000);
  }

  console.log('Generando el PDF…');
  const pdf = new BrowserWindow({ show: false });
  await pdf.loadFile(path.join(raiz, 'docs', 'guia', 'guia.html'));
  await esperar(500);
  const contenido = await pdf.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font:8px Segoe UI,sans-serif;color:#6b7c85;padding:0 16mm;display:flex;justify-content:space-between">' +
      '<span>TurnoCare · Guía de usuario · Santiago Caicedo</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
  });
  writeFileSync(path.join(raiz, 'docs', 'Guia_de_Usuario_TurnoCare.pdf'), contenido);
  console.log('✔ docs/Guia_de_Usuario_TurnoCare.pdf');

  await api.close();
  rmSync(datos, { recursive: true, force: true });
  app.quit();
}

app.whenReady().then(() =>
  main().catch((e) => {
    console.error(e);
    app.exit(1);
  }),
);
