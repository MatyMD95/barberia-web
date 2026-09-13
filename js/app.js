/* ============================================================
   BACKEND — Supabase
   Estas dos claves son seguras de tener visibles en el código del
   navegador: están protegidas por las reglas de seguridad (RLS)
   configuradas en la base de datos, no por estar "escondidas".
   ============================================================ */
const SUPABASE_URL = "https://jtsjieefztynadznaqro.supabase.co";
const SUPABASE_KEY = "sb_publishable_fEqA0EvuGY4iUtqS-hE5DQ_TDVDwx3F";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ============================================================
   CONFIG DEL NEGOCIO — único bloque a editar por cliente/rubro
   (sirve como valor de arranque / respaldo si Supabase falla)
   ============================================================ */
const NEGOCIO = {
  nombre: "Barbería del Barrio",
  inicial: "B",
  eslogan: "Turno por turno, sin apuro",
  heroTitulo: ["Tu corte,", "a tu hora."],
  heroTexto: "Reservá tu turno en menos de un minuto y confirmalo por WhatsApp.",
  historiaTitulo: "Un corte hecho <em>a mano</em>, con tiempo.",
  historiaTexto: "Acá no se corre. Cada corte se toma el tiempo que necesita: tijera, máquina y buena charla, sin apuro y sin atajos.", // TODO: reemplazar por la historia real del barbero/local
  telefono: "5493804261374", // formato internacional sin '+' ni espacios, para WhatsApp
  telefonoVisible: "+54 9 380 426-1374",
  direccion: "Dirección a confirmar", // TODO: completar
  footerTexto: "Reservá tu turno online, así de simple.",
  horarios: [
    { dias: "Lun a Sáb", rango: "9:00 – 13:00 / 16:00 – 20:00 (a confirmar)" }, // TODO: confirmar horario real
    { dias: "Domingos", rango: "Cerrado" }
  ],
  duracionSlotMin: 30,
  servicios: [
    { id: "corte", nombre: "Corte de cabello", descripcion: "Corte a tijera y máquina, incluye lavado.", precio: 12000, duracion: 30 },
    { id: "corte-barba", nombre: "Corte + barba", descripcion: "Combo completo, prolijidad de contornos.", precio: 0, duracion: 45 }, // TODO: falta precio real
    { id: "barba", nombre: "Barba", descripcion: "Perfilado y arreglo con navaja.", precio: 0, duracion: 20 } // TODO: falta precio real
  ],
  diasAtencion: [1,2,3,4,5,6],
  horaApertura: "09:00",
  horaCierre: "20:00",
  descansos: [{ desde: "13:00", hasta: "16:00" }],
  turnosOcupados: []
};

/* ============================================================
   Render de contenido desde NEGOCIO (estático + datos remotos)
   ============================================================ */
const fmt = (n) => n.toLocaleString('es-AR');
const fmtPrecio = (n) => n ? `$${fmt(n)}` : 'A confirmar';

function renderEstatico(){
  document.getElementById('markInitial').textContent = NEGOCIO.inicial;
  document.getElementById('brandName').textContent = NEGOCIO.nombre;
  document.getElementById('brandSub').textContent = NEGOCIO.eslogan;
  document.getElementById('heroTitle').innerHTML = `${NEGOCIO.heroTitulo[0]} <em>${NEGOCIO.heroTitulo[1]}</em>`;
  document.getElementById('heroText').textContent = NEGOCIO.heroTexto;
  document.getElementById('historiaTitulo').innerHTML = NEGOCIO.historiaTitulo;
  document.getElementById('historiaTexto').textContent = NEGOCIO.historiaTexto;
  document.getElementById('footerText').textContent = NEGOCIO.footerTexto;
  document.getElementById('footerMark').textContent = NEGOCIO.nombre;

  document.getElementById('infoDireccion').textContent = NEGOCIO.direccion;
  document.getElementById('infoHorarios').innerHTML = NEGOCIO.horarios.map(h => `${h.dias} · ${h.rango}`).join('<br>');
  document.getElementById('infoTelefono').innerHTML = `<a href="tel:${NEGOCIO.telefono}" style="color:inherit; text-decoration:none;">${NEGOCIO.telefonoVisible}</a>`;

  renderTicker();
}

function renderTicker(){
  const items = [
    ...NEGOCIO.servicios.map(s => s.nombre),
    NEGOCIO.horarios.map(h => `${h.dias} ${h.rango}`).join(' · '),
    NEGOCIO.telefonoVisible,
    'Reservá tu turno online'
  ];
  const strip = items.map(i => `<span>${i}</span>`).join('•');
  document.getElementById('tickerTrack').innerHTML = strip + strip; // duplicado para loop continuo
}

function renderServiciosList(){
  document.getElementById('serviciosList').innerHTML = NEGOCIO.servicios.map((s,i) => `
    <div class="servicio-row">
      <div class="servicio-num">0${i+1}</div>
      <div class="servicio-body">
        <h3>${s.nombre}</h3>
        <p>${s.descripcion}</p>
        <div class="servicio-meta-line">
          <span>${fmtPrecio(s.precio)}</span>
          <span class="dur">${s.duracion} min</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ---------------- Carga de datos remotos (Supabase) ---------------- */
async function cargarDatosRemotos(){
  try{
    const [srv, cfg, ocupados] = await Promise.all([
      supabase.from('servicios').select('*').eq('activo', true).order('created_at'),
      supabase.from('config').select('*').eq('id', 1).single(),
      supabase.rpc('get_horarios_ocupados')
    ]);

    if(srv.error) throw srv.error;
    if(srv.data && srv.data.length){
      NEGOCIO.servicios = srv.data.map(s => ({
        id: s.id, nombre: s.nombre, descripcion: s.descripcion,
        precio: s.precio, duracion: s.duracion, imagen: s.imagen
      }));
    }

    if(!cfg.error && cfg.data){
      NEGOCIO.diasAtencion = cfg.data.dias_atencion;
      NEGOCIO.horaApertura = cfg.data.hora_apertura;
      NEGOCIO.horaCierre = cfg.data.hora_cierre;
      NEGOCIO.duracionSlotMin = cfg.data.duracion_slot;
      NEGOCIO.descansos = cfg.data.descansos;
    }

    if(!ocupados.error && ocupados.data){
      NEGOCIO.turnosOcupados = ocupados.data; // [{ fecha, hora }]
    }

    renderEstatico();
    renderServiciosList();
    if(typeof renderDays === 'function') renderDays();
  } catch(err){
    console.error('No se pudo conectar con Supabase, se usan los datos de ejemplo.', err);
  }
}

renderEstatico();
renderServiciosList();
cargarDatosRemotos();

/* ============================================================
   Lógica del flujo de reserva
   ============================================================ */
const state = { step: 1, servicio: null, fecha: null, hora: null, nombre: '', telefono: '' };

const overlay = document.getElementById('overlay');
const steps = [1,2,3,4,5].map(n => document.getElementById('step'+n));
const tracks = [1,2,3,4,5].map(n => document.getElementById('tr'+n));
const btnNext = document.getElementById('btnNext');
const btnBack = document.getElementById('btnBack');
const stepCount = document.getElementById('stepCount');

function openSheet(){
  state.step = 1; state.servicio = null; state.fecha = null; state.hora = null;
  state.nombre = ''; state.telefono = '';
  document.getElementById('inpNombre').value = '';
  document.getElementById('inpTel').value = '';
  renderServicioPick();
  renderDays();
  goToStep(1);
  overlay.classList.add('open');
}
['openBooking1','openBooking2','openBooking3'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.onclick = openSheet;
});
document.getElementById('closeSheet').onclick = () => overlay.classList.remove('open');
overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.classList.remove('open'); });

function goToStep(n){
  state.step = n;
  steps.forEach((el,i) => el.classList.toggle('active', i === n-1));
  tracks.forEach((el,i) => el.classList.toggle('done', i < n));
  stepCount.textContent = `Paso ${n} de 5`;
  btnBack.style.visibility = n === 1 ? 'hidden' : 'visible';
  btnNext.textContent = n === 5 ? 'Confirmar por WhatsApp' : 'Continuar';
  validateNext();
  if(n === 5) renderSummary();
}

function validateNext(){
  let ok = true;
  if(state.step === 1) ok = !!state.servicio;
  if(state.step === 2) ok = !!state.fecha;
  if(state.step === 3) ok = !!state.hora;
  if(state.step === 4) ok = document.getElementById('inpNombre').value.trim().length > 1
                          && document.getElementById('inpTel').value.trim().length > 5;
  btnNext.disabled = !ok;
}

btnBack.onclick = () => { if(state.step > 1) goToStep(state.step - 1); };
btnNext.onclick = () => {
  if(state.step === 4){
    state.nombre = document.getElementById('inpNombre').value.trim();
    state.telefono = document.getElementById('inpTel').value.trim();
  }
  if(state.step < 5){ goToStep(state.step + 1); }
  else { confirmarWhatsApp(); }
};

document.getElementById('inpNombre').addEventListener('input', validateNext);
document.getElementById('inpTel').addEventListener('input', validateNext);

function renderServicioPick(){
  document.getElementById('servicioPick').innerHTML = NEGOCIO.servicios.map(s => `
    <button class="pick-item" data-id="${s.id}" onclick="pickServicio('${s.id}')">
      <div>
        <div class="name">${s.nombre}</div>
        <div class="sub">${s.duracion} min</div>
      </div>
      <div class="price">${fmtPrecio(s.precio)}</div>
    </button>
  `).join('');
}
function pickServicio(id){
  state.servicio = NEGOCIO.servicios.find(s => s.id === id);
  document.querySelectorAll('#servicioPick .pick-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });
  validateNext();
}

const DIAS_CORTOS = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
function renderDays(){
  const el = document.getElementById('dayScroll');
  let html = '';
  const hoy = new Date();
  for(let i=0; i<14; i++){
    const d = new Date(hoy); d.setDate(hoy.getDate() + i);
    const habil = NEGOCIO.diasAtencion.includes(d.getDay());
    const iso = d.toISOString().slice(0,10);
    html += `<button class="day-chip" data-iso="${iso}" ${habil ? '' : 'disabled'} onclick="pickDay('${iso}')">
      <div class="dname">${DIAS_CORTOS[d.getDay()]}</div>
      <div class="dnum">${d.getDate()}</div>
    </button>`;
  }
  el.innerHTML = html;
}
function pickDay(iso){
  state.fecha = iso;
  document.querySelectorAll('.day-chip').forEach(el => el.classList.toggle('selected', el.dataset.iso === iso));
  renderSlots();
  validateNext();
}

function toMin(hhmm){ const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function toHHMM(min){ const h = Math.floor(min/60).toString().padStart(2,'0'); const m = (min%60).toString().padStart(2,'0'); return `${h}:${m}`; }

function renderSlots(){
  const grid = document.getElementById('slotGrid');
  if(!state.servicio || !state.fecha){ grid.innerHTML = '<div class="no-slots">Elegí un servicio y una fecha.</div>'; return; }
  const dur = state.servicio.duracion;
  const apertura = toMin(NEGOCIO.horaApertura);
  const cierre = toMin(NEGOCIO.horaCierre);
  const descansos = NEGOCIO.descansos.map(d => [toMin(d.desde), toMin(d.hasta)]);
  const ocupados = NEGOCIO.turnosOcupados.filter(t => t.fecha === state.fecha).map(t => toMin(t.hora));

  const slots = [];
  for(let m = apertura; m + dur <= cierre; m += NEGOCIO.duracionSlotMin){
    const enDescanso = descansos.some(([a,b]) => m < b && m + dur > a);
    const ocupado = ocupados.includes(m);
    if(!enDescanso && !ocupado) slots.push(m);
  }

  grid.innerHTML = slots.length
    ? slots.map(m => `<button class="slot" data-min="${m}" onclick="pickSlot(${m})">${toHHMM(m)}</button>`).join('')
    : '<div class="no-slots">No hay horarios disponibles ese día. Probá con otra fecha.</div>';
  goToStep(3);
}
function pickSlot(min){
  state.hora = toHHMM(min);
  document.querySelectorAll('.slot').forEach(el => el.classList.toggle('selected', Number(el.dataset.min) === min));
  validateNext();
}

function formatFechaLarga(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function renderSummary(){
  document.getElementById('summaryBox').innerHTML = `
    <div class="summary-row"><span>Servicio</span><span>${state.servicio.nombre}</span></div>
    <div class="summary-row"><span>Fecha</span><span>${formatFechaLarga(state.fecha)}</span></div>
    <div class="summary-row"><span>Hora</span><span>${state.hora}</span></div>
    <div class="summary-row"><span>Nombre</span><span>${state.nombre}</span></div>
    <div class="summary-row"><span>Teléfono</span><span>${state.telefono}</span></div>
    <div class="summary-row"><span>Total</span><span>${fmtPrecio(state.servicio.precio)}</span></div>
  `;
}

async function confirmarWhatsApp(){
  btnNext.disabled = true;
  btnNext.textContent = 'Confirmando…';

  // abrir la ventana YA, en blanco, mientras el clic todavía cuenta como acción del usuario
  const waWindow = window.open('', '_blank');

  try{
    const { error } = await supabase.from('turnos').insert({
      cliente: state.nombre,
      telefono: state.telefono,
      servicio_id: state.servicio.id,
      fecha: state.fecha,
      hora: state.hora,
      estado: 'pendiente'
    });
    if(error) console.error('No se pudo registrar el turno en Supabase, se continúa igual por WhatsApp.', error);
  } catch(err){
    console.error('No se pudo registrar el turno, se continúa igual por WhatsApp.', err);
  }

  const msg = `Hola! Quiero reservar un turno para *${state.servicio.nombre}* el ${formatFechaLarga(state.fecha)} a las ${state.hora}.%0A%0ANombre: ${state.nombre}%0ATeléfono: ${state.telefono}`;
  const url = `https://wa.me/${NEGOCIO.telefono}?text=${msg}`;
  if(waWindow) waWindow.location.href = url;
  else window.open(url, '_blank'); // por si el navegador igual bloqueó la primera apertura
  overlay.classList.remove('open');
}
