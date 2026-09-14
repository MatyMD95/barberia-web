/* ============================================================
   BACKEND — Supabase
   ============================================================ */
const SUPABASE_URL = "https://jtsjieefztynadznaqro.supabase.co";
const SUPABASE_KEY = "sb_publishable_fEqA0EvuGY4iUtqS-hE5DQ_TDVDwx3F";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let DATA = { servicios: [], turnos: [], config: { diasAtencion:[1,2,3,4,5,6], horaApertura:'09:00', horaCierre:'20:00', duracionSlot:30, descansos:[] } };
let dataLista = false;

/* ============================================================
   LOGIN — con Supabase Auth (usuario y contraseña reales)
   ============================================================ */
async function checkLogin(){
  const { data: { session } } = await sb.auth.getSession();
  if(session){
    document.getElementById('loginScreen').style.display = 'none';
    initData();
  }
}

document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('emailInput').value.trim();
  const pass = document.getElementById('passInput').value;
  const errEl = document.getElementById('loginErr');
  const btn = document.getElementById('loginBtn');
  errEl.textContent = '';
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Ingresando…';
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){ errEl.textContent = 'Email o contraseña incorrectos.'; return; }
    document.getElementById('loginScreen').style.display = 'none';
    initData();
  } catch(err){
    errEl.textContent = 'No se pudo conectar. Probá de nuevo.';
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
};
document.getElementById('passInput').addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('loginBtn').click(); });
document.getElementById('logoutBtn').onclick = async () => { await sb.auth.signOut(); location.reload(); };
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

// Deja el botón claramente en "procesando" mientras espera al backend.
function setBtnLoading(btn, loadingText){
  if(btn.dataset.originalText === undefined) btn.dataset.originalText = btn.textContent;
  btn.textContent = loadingText;
  btn.disabled = true;
}
function clearBtnLoading(btn){
  if(btn.dataset.originalText !== undefined) btn.textContent = btn.dataset.originalText;
  btn.disabled = false;
}

/* ============================================================
   Carga de datos — traduce snake_case (Supabase) a camelCase (UI)
   ============================================================ */
function turnoDesdeFila(t){
  return { id: t.id, cliente: t.cliente, telefono: t.telefono, servicioId: t.servicio_id, fecha: t.fecha, hora: t.hora, estado: t.estado };
}
function servicioDesdeFila(s){
  return { id: s.id, nombre: s.nombre, descripcion: s.descripcion, precio: s.precio, duracion: s.duracion, activo: s.activo, imagen: s.imagen };
}
function configDesdeFila(c){
  return { diasAtencion: c.dias_atencion, horaApertura: c.hora_apertura, horaCierre: c.hora_cierre, duracionSlot: c.duracion_slot, descansos: c.descansos };
}

async function initData(){
  try{
    const [srv, trn, cfg] = await Promise.all([
      sb.from('servicios').select('*').order('created_at'),
      sb.from('turnos').select('*').order('fecha', { ascending: false }),
      sb.from('config').select('*').eq('id', 1).single()
    ]);
    if(srv.error) throw srv.error;
    if(trn.error) throw trn.error;
    if(cfg.error) throw cfg.error;

    DATA.servicios = srv.data.map(servicioDesdeFila);
    DATA.turnos = trn.data.map(turnoDesdeFila);
    DATA.config = configDesdeFila(cfg.data);
  } catch(err){
    showToast('Error cargando datos: ' + err.message);
    console.error(err);
  }
  dataLista = true;
  renderAll();
}

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
  setBtnLoading(btn, 'Guardando…');
  try{
    if(turnoEditId){
      const { error } = await sb.from('turnos')
        .update({ cliente, telefono, servicio_id: servicioId, fecha, hora, estado })
        .eq('id', turnoEditId);
      if(error) throw error;
      const t = DATA.turnos.find(x => x.id === turnoEditId);
      Object.assign(t, { cliente, telefono, servicioId, fecha, hora, estado });
      showToast('Turno actualizado.');
    } else {
      const { data, error } = await sb.from('turnos')
        .insert({ cliente, telefono, servicio_id: servicioId, fecha, hora, estado })
        .select().single();
      if(error) throw error;
      DATA.turnos.push(turnoDesdeFila(data));
      showToast('Turno creado.');
    }
    closeOverlay('turnoOverlay');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    clearBtnLoading(btn);
  }
};

document.getElementById('btnEliminarTurno').onclick = async () => {
  if(!turnoEditId) return;
  const btn = document.getElementById('btnEliminarTurno');
  setBtnLoading(btn, 'Eliminando…');
  try{
    const { error } = await sb.from('turnos').delete().eq('id', turnoEditId);
    if(error) throw error;
    DATA.turnos = DATA.turnos.filter(t => t.id !== turnoEditId);
    closeOverlay('turnoOverlay');
    showToast('Turno eliminado.');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    clearBtnLoading(btn);
  }
};

async function cambiarEstado(id, estado){
  const t = DATA.turnos.find(x => x.id === id);
  if(!t) return;
  const anterior = t.estado;
  t.estado = estado;
  try{
    const { error } = await sb.from('turnos').update({ estado }).eq('id', id);
    if(error) throw error;
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
  setBtnLoading(btn, 'Guardando…');
  try{
    if(servicioEditId){
      const { error } = await sb.from('servicios')
        .update({ nombre, descripcion, precio, duracion, imagen, activo })
        .eq('id', servicioEditId);
      if(error) throw error;
      Object.assign(servicioById(servicioEditId), { nombre, descripcion, precio, duracion, imagen, activo });
      showToast('Servicio actualizado.');
    } else {
      const { data, error } = await sb.from('servicios')
        .insert({ nombre, descripcion, precio, duracion, imagen, activo })
        .select().single();
      if(error) throw error;
      DATA.servicios.push(servicioDesdeFila(data));
      showToast('Servicio creado.');
    }
    closeOverlay('servicioOverlay');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    clearBtnLoading(btn);
  }
};

document.getElementById('btnEliminarServicio').onclick = async () => {
  if(!servicioEditId) return;
  const btn = document.getElementById('btnEliminarServicio');
  setBtnLoading(btn, 'Eliminando…');
  try{
    const { error } = await sb.from('servicios').delete().eq('id', servicioEditId);
    if(error) throw error;
    DATA.servicios = DATA.servicios.filter(s => s.id !== servicioEditId);
    closeOverlay('servicioOverlay');
    showToast('Servicio eliminado.');
    renderAll();
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    clearBtnLoading(btn);
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
  setBtnLoading(btn, 'Guardando…');
  try{
    const { error } = await sb.from('config').update({
      dias_atencion: nuevoConfig.diasAtencion,
      hora_apertura: nuevoConfig.horaApertura,
      hora_cierre: nuevoConfig.horaCierre,
      duracion_slot: nuevoConfig.duracionSlot,
      descansos: nuevoConfig.descansos
    }).eq('id', 1);
    if(error) throw error;
    DATA.config = nuevoConfig;
    showToast('Horarios guardados.');
  } catch(err){
    showToast('Error: ' + err.message);
  } finally {
    clearBtnLoading(btn);
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
