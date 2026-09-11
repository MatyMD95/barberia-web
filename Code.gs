/* ============================================================
   BACKEND — Sistema de turnos
   Google Apps Script + Google Sheets como base de datos.

   Esta hoja de cálculo debe tener 3 pestañas, con estos encabezados
   EXACTOS en la fila 1 (respetar mayúsculas):

   Pestaña "Servicios"
   id | nombre | descripcion | precio | duracion | activo | imagen

   Pestaña "Turnos"
   id | cliente | telefono | servicioId | fecha | hora | estado

   Pestaña "Config"
   key | value
   (filas iniciales sugeridas — se pueden editar desde el panel):
   diasAtencion   | 1,2,3,4,5,6
   horaApertura   | 09:00
   horaCierre     | 20:00
   duracionSlot   | 30
   descansos      | [{"desde":"13:00","hasta":"16:00"}]

   Publicar: Implementar > Nueva implementación > Aplicación web
   - Ejecutar como: Yo
   - Quién tiene acceso: Cualquier usuario
   Copiar la URL resultante y pegarla como API_URL en turnos-v1.html
   y en admin-v2.html.
   ============================================================ */

const SHEET_SERVICIOS = 'Servicios';
const SHEET_TURNOS = 'Turnos';
const SHEET_CONFIG = 'Config';

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'all';
  let data;
  if (action === 'servicios') data = getServicios();
  else if (action === 'turnos') data = getTurnos();
  else if (action === 'config') data = getConfig();
  else data = { servicios: getServicios(), turnos: getTurnos(), config: getConfig() };
  return jsonOutput(data);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput({ ok: false, error: 'JSON inválido en el cuerpo de la petición.' });
  }

  try {
    let result;
    switch (body.action) {
      case 'createTurno':    result = createTurno(body.turno); break;
      case 'updateTurno':    result = updateTurno(body.turno); break;
      case 'deleteTurno':    result = deleteRowById(SHEET_TURNOS, body.id); break;
      case 'createServicio': result = createServicio(body.servicio); break;
      case 'updateServicio': result = updateServicio(body.servicio); break;
      case 'deleteServicio': result = deleteRowById(SHEET_SERVICIOS, body.id); break;
      case 'updateConfig':   result = updateConfig(body.config); break;
      default: throw new Error('Acción desconocida: ' + body.action);
    }
    return jsonOutput({ ok: true, result: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

/* ---------------- Helpers generales ---------------- */

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sh(name) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('No existe la pestaña "' + name + '". Revisá el nombre exacto.');
  return s;
}

function readAll(sheetName) {
  const s = sh(sheetName);
  const values = s.getDataRange().getValues();
  const headers = values.shift();
  return values
    .filter(r => r[0] !== '' && r[0] !== null)
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
}

function findRowIndexById(sheetName, id) {
  const s = sh(sheetName);
  const values = s.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // fila real en la hoja (1-indexed)
  }
  return -1;
}

function deleteRowById(sheetName, id) {
  const row = findRowIndexById(sheetName, id);
  if (row === -1) throw new Error('No se encontró el registro con id ' + id);
  sh(sheetName).deleteRow(row);
  return { deleted: id };
}

/* ---------------- Servicios ---------------- */

function getServicios() {
  return readAll(SHEET_SERVICIOS).map(s => ({
    id: s.id, nombre: s.nombre, descripcion: s.descripcion,
    precio: Number(s.precio), duracion: Number(s.duracion),
    activo: s.activo === true || s.activo === 'TRUE' || s.activo === 'true',
    imagen: s.imagen || ''
  }));
}

function createServicio(sv) {
  const id = sv.id || Utilities.getUuid();
  sh(SHEET_SERVICIOS).appendRow([id, sv.nombre, sv.descripcion || '', sv.precio, sv.duracion, !!sv.activo, sv.imagen || '']);
  return Object.assign({}, sv, { id });
}

function updateServicio(sv) {
  const row = findRowIndexById(SHEET_SERVICIOS, sv.id);
  if (row === -1) throw new Error('Servicio no encontrado: ' + sv.id);
  sh(SHEET_SERVICIOS).getRange(row, 1, 1, 7).setValues([[
    sv.id, sv.nombre, sv.descripcion || '', sv.precio, sv.duracion, !!sv.activo, sv.imagen || ''
  ]]);
  return sv;
}

/* ---------------- Turnos ---------------- */

function getTurnos() {
  return readAll(SHEET_TURNOS).map(t => ({
    id: t.id, cliente: t.cliente, telefono: String(t.telefono),
    servicioId: t.servicioId,
    fecha: Utilities.formatDate(new Date(t.fecha), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    hora: t.hora, estado: t.estado
  }));
}

function createTurno(t) {
  const id = Utilities.getUuid();
  sh(SHEET_TURNOS).appendRow([id, t.cliente, t.telefono, t.servicioId, t.fecha, t.hora, t.estado || 'pendiente']);
  return Object.assign({}, t, { id });
}

function updateTurno(t) {
  const row = findRowIndexById(SHEET_TURNOS, t.id);
  if (row === -1) throw new Error('Turno no encontrado: ' + t.id);
  sh(SHEET_TURNOS).getRange(row, 1, 1, 7).setValues([[
    t.id, t.cliente, t.telefono, t.servicioId, t.fecha, t.hora, t.estado
  ]]);
  return t;
}

/* ---------------- Config ---------------- */

function getConfig() {
  const rows = readAll(SHEET_CONFIG);
  const map = {};
  rows.forEach(r => map[r.key] = r.value);
  return {
    diasAtencion: String(map.diasAtencion || '1,2,3,4,5,6').split(',').map(n => Number(n.trim())),
    horaApertura: map.horaApertura || '09:00',
    horaCierre: map.horaCierre || '20:00',
    duracionSlot: Number(map.duracionSlot || 30),
    descansos: safeParseJSON(map.descansos, [])
  };
}

function updateConfig(cfg) {
  const s = sh(SHEET_CONFIG);
  const values = s.getDataRange().getValues();
  const setOrAppend = (key, value) => {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) { s.getRange(i + 1, 2).setValue(value); return; }
    }
    s.appendRow([key, value]);
  };
  setOrAppend('diasAtencion', cfg.diasAtencion.join(','));
  setOrAppend('horaApertura', cfg.horaApertura);
  setOrAppend('horaCierre', cfg.horaCierre);
  setOrAppend('duracionSlot', cfg.duracionSlot);
  setOrAppend('descansos', JSON.stringify(cfg.descansos));
  return cfg;
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}
