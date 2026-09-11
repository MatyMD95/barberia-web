/* ============================================================
   BACKEND — pegar acá la URL del Web App de Google Apps Script
   (la misma que en turnos-v1.html). Si se deja vacío, el panel
   sigue funcionando con datos guardados en este navegador.
   ============================================================ */
const API_URL = "https://script.google.com/macros/s/AKfycbwtwbefMNsGLxK12pVLXlyAzolL7eEEfIiF-SR9i5ds-V3yVXyH4yRWI9TVh6E4FaLV5A/exec";

/* ============================================================
   PERSISTENCIA — localStorage como respaldo/modo offline;
   si hay API_URL, todas las operaciones van contra Google Sheets.
   ============================================================ */
const STORAGE_KEY = 'turnosAdminV1';
const PASSCODE_KEY = 'turnosAdminPass';

async function apiGet(action){
  const res = await fetch(`${API_URL}?action=${action}`);
  return res.json();
}
async function apiPost(payload){
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS con Apps Script
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || 'Error desconocido del backend.');
  return data.result;
}

function seedData(){
  const hoy = new Date();
  const iso = (d) => d.toISOString().slice(0,10);
  const t = (offsetDias, hora, servicioId, cliente, telefono, estado) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() + offsetDias);
    return { id: crypto.randomUUID(), fecha: iso(d), hora, servicioId, cliente, telefono, estado };
  };
  return {
    servicios: [
      { id:'corte', nombre:'Corte de cabello', descripcion:'Corte a tijera y máquina, incluye lavado.', precio:12000, duracion:30, activo:true, imagen:'' },
      { id:'corte-barba', nombre:'Corte + barba', descripcion:'Combo completo, prolijidad de contornos.', precio:0, duracion:45, activo:true, imagen:'' },
      { id:'barba', nombre:'Barba', descripcion:'Perfilado y arreglo con navaja.', precio:0, duracion:20, activo:true, imagen:'' }
    ],
    turnos: [
      t(0,'10:00','corte','Nicolás Ríos','5493804261374','confirmado'),
      t(0,'11:00','corte-barba','Franco Díaz','5493804261374','pendiente'),
      t(1,'09:30','barba','Emiliano Paz','5493804261374','pendiente'),
      t(2,'17:00','corte','Julián Soto','5493804261374','confirmado')
    ],
    config: {
      diasAtencion: [1,2,3,4,5,6],
      horaApertura: '09:00',
      horaCierre: '20:00',
      duracionSlot: 30,
      descansos: [{ desde:'13:00', hasta:'16:00' }]
    }
  };
}

function loadLocal(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){ try { return JSON.parse(raw); } catch(e){ /* fallthrough */ } }
  const seeded = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); }

// Si hay backend, cada cambio se manda a la API y listo; si no, se persiste en este navegador.
function saveData(){ if(!API_URL) saveLocal(); }

let DATA = seedData(); // placeholder hasta que termine la carga real
let dataLista = false;

async function initData(){
  if(API_URL){
    try{
      DATA = await apiGet('all');
    } catch(err){
      console.error('No se pudo conectar con el backend, se usan datos locales.', err);
      DATA = loadLocal();
    }
  } else {
    DATA = loadLocal();
  }
  dataLista = true;
  renderAll();
}

/* ============================================================
   LOGIN (placeholder simple — auth real llega con el backend)
   ============================================================ */
function checkLogin(){
  if(sessionStorage.getItem('adminLoggedIn') === '1'){
    document.getElementById('loginScreen').style.display = 'none';
  }
}
document.getElementById('loginBtn').onclick = () => {
  const pass = localStorage.getItem(PASSCODE_KEY) || '1234';
  const val = document.getElementById('passInput').value.trim();
  if(val === pass){
    sessionStorage.setItem('adminLoggedIn','1');
    document.getElementById('loginScreen').style.display = 'none';
  } else {
    document.getElementById('loginErr').textContent = 'Código incorrecto.';
  }
};
document.getElementById('passInput').addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('loginBtn').click(); });
document.getElementById('logoutBtn').onclick = () => { sessionStorage.removeItem('adminLoggedIn'); location.reload(); };
checkLogin();

/* ============================================================
   Helpers
   ============================================================ */
const fmt = n => Number(n).toLocaleString('es-AR');
const fmtPrecio = n => n ? `$${fmt(n)}` : 'A confirmar';
const todayISO = () => new Date().toISOString().slice(0,10);
const DIAS_LARGOS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_CORTOS = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
function servicioById(id){ return DATA.servicios.find(s => s.id === id); }
function fechaLarga(iso){ return new Date(iso+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long', day:'numeric', month:'long'}); }
function showToast(msg){ const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1800); }
function openOverlay(id){ document.getElementById(id).classList.add('open'); }
function closeOverlay(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => closeOverlay(btn.dataset.close));

/* ============================================================
   NAV / TABS
   ============================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    renderAll();
  };
});

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard(){
  document.getElementById('dashDate').textContent = fechaLarga(todayISO());
  const hoy = todayISO();
  const activos = DATA.turnos.filter(t => t.estado !== 'cancelado');
  const turnosHoy = activos.filter(t => t.fecha === hoy).sort((a,b)=>a.hora.localeCompare(b.hora));
  const proximos = activos.filter(t => t.fecha > hoy).sort((a,b)=> (a.fecha+a.hora).localeCompare(b.fecha+b.hora)).slice(0,5);

  const conteo = {};
  activos.forEach(t => { conteo[t.servicioId] = (conteo[t.servicioId]||0) + 1; });
  const topServicios = Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0,3);

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="num">${turnosHoy.length}</div><div class="label">Turnos hoy</div></div>
    <div class="stat-card"><div class="num">${activos.length}</div><div class="label">Turnos totales</div></div>
    <div class="stat-card"><div class="num">${DATA.servicios.filter(s=>s.activo).length}</div><div class="label">Servicios activos</div></div>
    <div class="stat-card"><div class="num">${activos.filter(t=>t.estado==='pendiente').length}</div><div class="label">Por confirmar</div></div>
  `;

  document.getElementById('dashHoy').innerHTML = turnosHoy.length
    ? turnosHoy.map(t => `<div class="mini-row"><span>${t.hora} — ${t.cliente}</span><span class="t">${servicioById(t.servicioId)?.nombre||'—'}</span></div>`).join('')
    : '<div class="empty-note">No hay turnos para hoy.</div>';

  document.getElementById('dashProximos').innerHTML = proximos.length
    ? proximos.map(t => `<div class="mini-row"><span>${fechaLarga(t.fecha)}, ${t.hora}</span><span class="t">${t.cliente}</span></div>`).join('')
    : '<div class="empty-note">No hay próximos turnos cargados.</div>';

  document.getElementById('dashTop').innerHTML = topServicios.length
    ? topServicios.map(([id,c]) => `<div class="mini-row"><span>${servicioById(id)?.nombre || 'Servicio eliminado'}</span><span class="t">${c} turno${c===1?'':'s'}</span></div>`).join('')
    : '<div class="empty-note">Todavía no hay datos suficientes.</div>';
}

/* ============================================================
   AGENDA
   ============================================================ */
let agendaModo = 'dia';
document.getElementById('agendaDate').value = todayISO();
document.getElementById('agendaDate').addEventListener('change', renderAgenda);
document.getElementById('agTabDia').onclick = () => { agendaModo='dia'; toggleAgendaTabs(); renderAgenda(); };
document.getElementById('agTabSemana').onclick = () => { agendaModo='semana'; toggleAgendaTabs(); renderAgenda(); };
function toggleAgendaTabs(){
  document.getElementById('agTabDia').classList.toggle('active', agendaModo==='dia');
  document.getElementById('agTabSemana').classList.toggle('active', agendaModo==='semana');
  document.getElementById('agendaWeekGrid').style.display = agendaModo==='semana' ? 'grid' : 'none';
}

function renderAgenda(){
  const baseDate = document.getElementById('agendaDate').value || todayISO();
  if(agendaModo === 'semana'){
    const start = new Date(baseDate+'T00:00:00');
    start.setDate(start.getDate() - start.getDay()); // arranca el domingo
    let html = '';
    const dias = [];
    for(let i=0;i<7;i++){
      const d = new Date(start); d.setDate(start.getDate()+i);
      const iso = d.toISOString().slice(0,10);
      dias.push(iso);
      const cant = DATA.turnos.filter(t => t.fecha===iso && t.estado!=='cancelado').length;
      html += `<button class="week-day ${iso===todayISO()?'today':''}" onclick="selectWeekDay('${iso}')">
        <div class="wd">${DIAS_CORTOS[d.getDay()]}</div><div class="wn">${d.getDate()}</div>
        <div class="wc">${cant||''}</div></button>`;
    }
    document.getElementById('agendaWeekGrid').innerHTML = html;
    renderAgendaList(baseDate);
  } else {
    document.getElementById('agendaWeekGrid').innerHTML = '';
    renderAgendaList(baseDate);
  }
}
function selectWeekDay(iso){ document.getElementById('agendaDate').value = iso; renderAgendaList(iso); }

function renderAgendaList(fechaISO){
  const lista = DATA.turnos.filter(t => t.fecha === fechaISO).sort((a,b)=>a.hora.localeCompare(b.hora));
  const el = document.getElementById('agendaList');
  if(!lista.length){ el.innerHTML = `<div class="empty-note">Sin turnos para el ${fechaLarga(fechaISO)}.</div>`; return; }
  el.innerHTML = lista.map(turnoCardHTML).join('');
}

function turnoCardHTML(t){
  const s = servicioById(t.servicioId);
  return `
    <div class="turno-card">
      <div class="hora">${t.hora}</div>
      <div class="turno-info">
        <div class="cliente">${t.cliente}</div>
        <div class="det">${s ? s.nombre : 'Servicio eliminado'} · ${t.telefono}</div>
        <span class="badge ${t.estado}">${t.estado}</span>
      </div>
      <div class="turno-actions">
        <button class="icon-btn" onclick="editarTurno('${t.id}')">Editar</button>
        ${t.estado!=='cancelado' ? `<button class="icon-btn" onclick="cambiarEstado('${t.id}','cancelado')">Cancelar</button>` : ''}
      </div>
    </div>`;
}

/* ============================================================
   TURNOS — CRUD
   ============================================================ */
function renderTurnos(){
  const ordenados = [...DATA.turnos].sort((a,b)=> (b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  document.getElementById('turnosCount').textContent = `${DATA.turnos.length} turno${DATA.turnos.length===1?'':'s'} cargados`;
  document.getElementById('turnosList').innerHTML = ordenados.length
    ? ordenados.map(t => `
      <div class="turno-card">
        <div class="hora">${t.hora}</div>
        <div class="turno-info">
          <div class="cliente">${t.cliente}</div>
          <div class="det">${fechaLarga(t.fecha)} · ${servicioById(t.servicioId)?.nombre || 'Servicio eliminado'}</div>
          <span class="badge ${t.estado}">${t.estado}</span>
        </div>
        <div class="turno-actions">
          <button class="icon-btn" onclick="editarTurno('${t.id}')">Editar</button>
          <button class="icon-btn" onclick="reprogramarTurno('${t.id}')">Reprogramar</button>
        </div>
      </div>`).join('')
    : '<div class="empty-note">Todavía no hay turnos cargados.</div>';
}

function fillServicioSelect(){
  document.getElementById('tfServicio').innerHTML = DATA.servicios
    .filter(s => s.activo)
    .map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
}

let turnoEditId = null;
document.getElementById('btnNuevoTurno').onclick = () => {
  turnoEditId = null;
  document.getElementById('turnoModalTitle').textContent = 'Nuevo turno';
  fillServicioSelect();
  document.getElementById('tfCliente').value = '';
  document.getElementById('tfTelefono').value = '';
  document.getElementById('tfFecha').value = todayISO();
  document.getElementById('tfHora').value = '10:00';
  document.getElementById('tfEstado').value = 'pendiente';
  document.getElementById('btnEliminarTurno').style.display = 'none';
  openOverlay('turnoOverlay');
};

function editarTurno(id){
  const t = DATA.turnos.find(x => x.id === id);
  if(!t) return;
  turnoEditId = id;
  document.getElementById('turnoModalTitle').textContent = 'Editar turno';
  fillServicioSelect();
  document.getElementById('tfCliente').value = t.cliente;
  document.getElementById('tfTelefono').value = t.telefono;
  document.getElementById('tfServicio').value = t.servicioId;
  document.getElementById('tfFecha').value = t.fecha;
  document.getElementById('tfHora').value = t.hora;
  document.getElementById('tfEstado').value = t.estado;
  document.getElementById('btnEliminarTurno').style.display = 'block';
  openOverlay('turnoOverlay');
}
function reprogramarTurno(id){ editarTurno(id); document.getElementById('tfFecha').focus(); }

document.getElementById('btnGuardarTurno').onclick = async () => {
  const cliente = document.getElementById('tfCliente').value.trim();
  const telefono = document.getElementById('tfTelefono').value.trim();
  const servicioId = document.getElementById('tfServicio').value;
  const fecha = document.getElementById('tfFecha').value;
  const hora = document.getElementById('tfHora').value;
  const estado = document.getElementById('tfEstado').value;
  if(!cliente || !fecha || !hora || !servicioId){ showToast('Completá todos los campos.'); return; }

  const btn = document.getElementById('btnGuardarTurno');
  btn.disabled = true;
  try{
    if(turnoEditId){
      const turno = { id: turnoEditId, cliente, telefono, servicioId, fecha, hora, estado };
      if(API_URL) await apiPost({ action:'updateTurno', turno });
      const t = DATA.turnos.find(x => x.id === turnoEditId);
      Object.assign(t, turno);
      showToast('Turno actualizado.');
    } else {
      if(API_URL){
        const creado = await apiPost({ action:'createTurno', turno:{ cliente, telefono, servicioId, fecha, hora, estado } });
        DATA.turnos.push(creado);
      } else {
        DATA.turnos.push({ id: crypto.randomUUID(), cliente, telefono, servicioId, fecha, hora, estado });
      }
      showToast('Turno creado.');
    }
    saveData();
    closeOverlay('turnoOverlay');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('btnEliminarTurno').onclick = async () => {
  if(!turnoEditId) return;
  try{
    if(API_URL) await apiPost({ action:'deleteTurno', id: turnoEditId });
    DATA.turnos = DATA.turnos.filter(t => t.id !== turnoEditId);
    saveData();
    closeOverlay('turnoOverlay');
    showToast('Turno eliminado.');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  }
};

async function cambiarEstado(id, estado){
  const t = DATA.turnos.find(x => x.id === id);
  if(!t) return;
  const anterior = t.estado;
  t.estado = estado;
  try{
    if(API_URL) await apiPost({ action:'updateTurno', turno: t });
    saveData();
    showToast('Estado actualizado.');
    renderAll();
  } catch(err){
    t.estado = anterior;
    showToast('Error: ' + err.message);
  }
}

/* ============================================================
   SERVICIOS — CRUD
   ============================================================ */
function renderServiciosAdmin(){
  document.getElementById('serviciosAdminList').innerHTML = DATA.servicios.map(s => `
    <div class="servicio-admin-row ${s.activo?'':'inactive'}">
      <div class="sv-info">
        <div class="nom">${s.nombre}${s.activo?'':' (desactivado)'}</div>
        <div class="met">${fmtPrecio(s.precio)} · ${s.duracion} min</div>
      </div>
      <div class="sv-actions">
        <button class="icon-btn" onclick="editarServicio('${s.id}')">Editar</button>
      </div>
    </div>`).join('');
}

let servicioEditId = null;
document.getElementById('btnNuevoServicio').onclick = () => {
  servicioEditId = null;
  document.getElementById('servicioModalTitle').textContent = 'Nuevo servicio';
  document.getElementById('sfNombre').value = '';
  document.getElementById('sfDescripcion').value = '';
  document.getElementById('sfPrecio').value = '';
  document.getElementById('sfDuracion').value = '';
  document.getElementById('sfImagen').value = '';
  document.getElementById('sfActivo').checked = true;
  document.getElementById('btnEliminarServicio').style.display = 'none';
  openOverlay('servicioOverlay');
};

function editarServicio(id){
  const s = servicioById(id);
  if(!s) return;
  servicioEditId = id;
  document.getElementById('servicioModalTitle').textContent = 'Editar servicio';
  document.getElementById('sfNombre').value = s.nombre;
  document.getElementById('sfDescripcion').value = s.descripcion || '';
  document.getElementById('sfPrecio').value = s.precio;
  document.getElementById('sfDuracion').value = s.duracion;
  document.getElementById('sfImagen').value = s.imagen || '';
  document.getElementById('sfActivo').checked = s.activo;
  document.getElementById('btnEliminarServicio').style.display = 'block';
  openOverlay('servicioOverlay');
}

document.getElementById('btnGuardarServicio').onclick = async () => {
  const nombre = document.getElementById('sfNombre').value.trim();
  const descripcion = document.getElementById('sfDescripcion').value.trim();
  const precio = Number(document.getElementById('sfPrecio').value);
  const duracion = Number(document.getElementById('sfDuracion').value);
  const imagen = document.getElementById('sfImagen').value.trim();
  const activo = document.getElementById('sfActivo').checked;
  if(!nombre || !precio || !duracion){ showToast('Completá nombre, precio y duración.'); return; }

  const btn = document.getElementById('btnGuardarServicio');
  btn.disabled = true;
  try{
    if(servicioEditId){
      const servicio = { id: servicioEditId, nombre, descripcion, precio, duracion, imagen, activo };
      if(API_URL) await apiPost({ action:'updateServicio', servicio });
      Object.assign(servicioById(servicioEditId), servicio);
      showToast('Servicio actualizado.');
    } else {
      const idLocal = nombre.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Math.floor(Math.random()*1000);
      if(API_URL){
        const creado = await apiPost({ action:'createServicio', servicio:{ id: idLocal, nombre, descripcion, precio, duracion, imagen, activo } });
        DATA.servicios.push(creado);
      } else {
        DATA.servicios.push({ id: idLocal, nombre, descripcion, precio, duracion, imagen, activo });
      }
      showToast('Servicio creado.');
    }
    saveData();
    closeOverlay('servicioOverlay');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('btnEliminarServicio').onclick = async () => {
  if(!servicioEditId) return;
  try{
    if(API_URL) await apiPost({ action:'deleteServicio', id: servicioEditId });
    DATA.servicios = DATA.servicios.filter(s => s.id !== servicioEditId);
    saveData();
    closeOverlay('servicioOverlay');
    showToast('Servicio eliminado.');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  }
};

/* ============================================================
   HORARIOS / CONFIG
   ============================================================ */
function renderHorariosForm(){
  document.getElementById('diasCheckGrid').innerHTML = DIAS_LARGOS.map((nombre, i) => `
    <div class="day-check">
      <input type="checkbox" id="dia${i}" ${DATA.config.diasAtencion.includes(i)?'checked':''}>
      <label for="dia${i}">${DIAS_CORTOS[i]}</label>
    </div>`).join('');
  document.getElementById('cfgApertura').value = DATA.config.horaApertura;
  document.getElementById('cfgCierre').value = DATA.config.horaCierre;
  document.getElementById('cfgDuracion').value = DATA.config.duracionSlot;
  renderDescansos();
}
function renderDescansos(){
  document.getElementById('descansosList').innerHTML = DATA.config.descansos.map((d,i) => `
    <div class="descanso-row">
      <input type="time" value="${d.desde}" onchange="DATA.config.descansos[${i}].desde=this.value">
      <span style="color:var(--muted); font-size:12px;">a</span>
      <input type="time" value="${d.hasta}" onchange="DATA.config.descansos[${i}].hasta=this.value">
      <button class="remove-x" onclick="quitarDescanso(${i})">✕</button>
    </div>`).join('');
}
function quitarDescanso(i){ DATA.config.descansos.splice(i,1); renderDescansos(); }
document.getElementById('addDescanso').onclick = () => {
  DATA.config.descansos.push({ desde:'13:00', hasta:'14:00' });
  renderDescansos();
};

document.getElementById('btnGuardarHorarios').onclick = async () => {
  const dias = [];
  DIAS_LARGOS.forEach((_, i) => { if(document.getElementById('dia'+i).checked) dias.push(i); });
  const nuevoConfig = {
    diasAtencion: dias,
    horaApertura: document.getElementById('cfgApertura').value,
    horaCierre: document.getElementById('cfgCierre').value,
    duracionSlot: Number(document.getElementById('cfgDuracion').value) || 30,
    descansos: DATA.config.descansos
  };
  const btn = document.getElementById('btnGuardarHorarios');
  btn.disabled = true;
  try{
    if(API_URL) await apiPost({ action:'updateConfig', config: nuevoConfig });
    DATA.config = nuevoConfig;
    saveData();
    showToast('Horarios guardados.');
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
};

/* ============================================================
   QR
   ============================================================ */
let qrInstance = null;
document.getElementById('btnGenerarQr').onclick = () => {
  const url = document.getElementById('qrUrl').value.trim();
  if(!url){ showToast('Pegá primero la URL de la página pública.'); return; }
  const wrap = document.getElementById('qrCanvasWrap');
  wrap.innerHTML = '';
  qrInstance = new QRCode(wrap, {
    text: url,
    width: 260,
    height: 260,
    colorDark: '#120C0D',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
  document.getElementById('qrActions').style.display = 'flex';
};
document.getElementById('btnDescargarQr').onclick = () => {
  const img = document.querySelector('#qrCanvasWrap img') || document.querySelector('#qrCanvasWrap canvas');
  if(!img) return;
  const link = document.createElement('a');
  link.download = 'qr-reservas.png';
  link.href = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
  link.click();
};

/* ============================================================
   RENDER GLOBAL
   ============================================================ */
function renderAll(){
  if(!dataLista) return;
  renderDashboard();
  toggleAgendaTabs();
  renderAgenda();
  renderTurnos();
  renderServiciosAdmin();
  renderHorariosForm();
}
initData();
