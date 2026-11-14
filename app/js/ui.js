// Interfaz: lista de sistemas, profundidad, corte, vistas, créditos, avisos y comportamiento móvil.
import { h, vaciar } from './util/dom.js';
import { icono } from './util/iconos.js';
import { formatoMB, colorSeguro } from './util/texto.js';

const $ = (id) => document.getElementById(id);
const esMovil = () => window.matchMedia('(max-width: 860px)').matches;

const TEXTO_PROFUNDIDAD = [
  'Nivel 0: se muestra todo, desde la piel.',
  'Nivel 1: se oculta la piel; quedan músculos superficiales y por dentro.',
  'Nivel 2: músculos profundos, vasos, nervios, esqueleto y vísceras.',
  'Nivel 3: vasos y nervios periféricos, linfático, esqueleto y vísceras.',
  'Nivel 4: esqueleto, articulaciones, vísceras y sistema nervioso central.',
  'Nivel 5: solo vísceras, encéfalo, médula, corazón y grandes vasos.',
];

export function montarUI(app) {
  const { bus, sistemas, diseccion } = app;

  // ---- íconos de los botones estáticos ----
  document.querySelectorAll('[data-icono]').forEach((el) => el.append(icono(el.dataset.icono)));

  // ---- avisos (toasts) ----
  const contAvisos = $('avisos');
  function aviso(texto, { ms = 3600, contenido = null } = {}) {
    const el = h('div', { class: 'aviso' }, texto, contenido);
    contAvisos.append(el);
    const quitar = () => el.remove();
    setTimeout(quitar, ms);
    return quitar;
  }
  bus.on('aviso', (t) => aviso(t));
  bus.on('pregunta-copiada', ({ via, texto }) => {
    if (via === 'manual') {
      const ta = h('textarea', { readonly: '', 'aria-label': 'Pregunta para copiar a mano' });
      ta.value = texto;
      aviso('Pregunta copiada: pégala en Claude', {
        ms: 20000,
        contenido: h('div', {}, h('span', { text: 'Si no se copió sola, selecciona y copia este texto:' }), ta),
      });
      setTimeout(() => { ta.focus(); ta.select(); }, 30);
    } else {
      aviso('Pregunta copiada: pégala en Claude');
    }
  });

  // ---- lista de sistemas ----
  const lista = $('lista-sistemas');
  const filas = new Map();
  function textoEstado(st) {
    if (st.estado === 'cargando') return st.total ? `${formatoMB(st.cargado).replace(' MB', '')} / ${formatoMB(st.total)}` : formatoMB(st.cargado);
    if (st.estado === 'error') return 'No cargó · reintentar';
    return formatoMB(st.estado === 'listo' ? st.total : st.def.bytes);
  }
  function pintarFila(st) {
    const f = filas.get(st.def.id);
    if (!f) return;
    f.boton.setAttribute('aria-checked', String(!!st.activo));
    f.boton.dataset.estado = st.estado;
    f.estado.textContent = textoEstado(st);
    f.boton.setAttribute('aria-busy', String(st.estado === 'cargando'));
    f.barra.hidden = st.estado !== 'cargando';
    const pct = st.total ? Math.min(100, (st.cargado / st.total) * 100) : 40;
    f.progreso.style.width = pct + '%';
  }
  for (const st of sistemas.lista()) {
    const boton = h('button', { type: 'button', class: 'sis-fila', role: 'switch', 'aria-checked': 'false', 'aria-describedby': 'est-' + st.def.id },
      h('span', { class: 'interruptor', 'aria-hidden': 'true' }),
      h('span', { class: 'chip-color', style: `background:${colorSeguro(st.def.color)}`, 'aria-hidden': 'true' }),
      h('span', { class: 'sis-nombre' }, st.def.nombre, st.def.opcional ? h('small', { text: 'opcional' }) : null),
      h('span', { class: 'sis-estado', id: 'est-' + st.def.id }));
    const progreso = h('span');
    const barra = h('span', { class: 'barra-carga', hidden: true, 'aria-hidden': 'true' }, progreso);
    boton.addEventListener('click', () => {
      const s = sistemas.estadoDe(st.def.id);
      const ahora = s.estado === 'error' ? true : !s.activo;
      sistemas.activar(st.def.id, ahora);
    });
    lista.append(h('li', {}, boton, barra));
    filas.set(st.def.id, { boton, estado: boton.querySelector('.sis-estado'), barra, progreso });
    pintarFila(st);
  }
  bus.on('sistema-estado', (st) => { pintarFila(st); pintarCarga(); if (st.estado === 'error') aviso(`No se pudo cargar «${st.def.nombre}». Pulsa de nuevo para reintentar.`, { ms: 6000 }); });

  // ---- indicador de carga global ----
  const carga = $('carga');
  function pintarCarga() {
    const cargando = sistemas.lista().filter((s) => s.estado === 'cargando');
    carga.hidden = !cargando.length;
    if (!cargando.length) return;
    vaciar(carga);
    for (const st of cargando) {
      const pct = st.total ? Math.min(100, (st.cargado / st.total) * 100) : 0;
      const txt = st.total ? `${formatoMB(st.cargado).replace(' MB', '')} de ${formatoMB(st.total)}` : formatoMB(st.cargado);
      carga.append(h('div', {},
        h('div', { text: `Cargando ${st.def.nombre.toLowerCase()}… ${txt}` }),
        h('span', { class: 'barra-carga', 'aria-hidden': 'true' }, h('span', { style: `width:${pct}%` }))));
    }
  }

  // ---- profundidad ----
  const rngProf = $('rng-profundidad');
  const txtProf = $('txt-profundidad');
  function pintarProfundidad() {
    const n = diseccion.estado.profundidad;
    rngProf.value = String(n);
    rngProf.setAttribute('aria-valuetext', TEXTO_PROFUNDIDAD[n]);
    txtProf.textContent = TEXTO_PROFUNDIDAD[n];
  }
  rngProf.addEventListener('input', () => diseccion.setProfundidad(Number(rngProf.value)));
  bus.on('profundidad', pintarProfundidad);
  pintarProfundidad();

  // ---- corte ----
  const btnCorte = $('btn-corte');
  const btnInvertir = $('btn-invertir');
  const rngCorte = $('rng-corte');
  const ejes = [...document.querySelectorAll('[data-eje]')];
  function pintarCorte() {
    const c = diseccion.estado.corte;
    const r = diseccion.rangoCorte();
    rngCorte.min = r.min.toFixed(3);
    rngCorte.max = r.max.toFixed(3);
    rngCorte.step = '0.002';
    rngCorte.value = String(c.posicion);
    rngCorte.disabled = !c.activo;
    btnInvertir.disabled = !c.activo;
    btnCorte.setAttribute('aria-pressed', String(c.activo));
    $('txt-btn-corte').textContent = c.activo ? 'Apagar corte' : 'Activar corte';
    ejes.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.eje === c.eje)));
    const cm = Math.round(c.posicion * 100);
    rngCorte.setAttribute('aria-valuetext', `${cm} centímetros desde el origen`);
  }
  btnCorte.addEventListener('click', () => diseccion.setCorte({ activo: !diseccion.estado.corte.activo }));
  btnInvertir.addEventListener('click', () => diseccion.setCorte({ invertido: !diseccion.estado.corte.invertido }));
  rngCorte.addEventListener('input', () => diseccion.setCorte({ posicion: Number(rngCorte.value) }));
  ejes.forEach((b) => b.addEventListener('click', () => diseccion.setCorte({ eje: b.dataset.eje })));
  bus.on('corte', pintarCorte);
  pintarCorte();

  // ---- aspecto: realista / esquemático ----
  const grupoAspecto = $('grupo-aspecto');
  const botonesAspecto = [...document.querySelectorAll('[data-aspecto]')];
  const tejidos = app.tejidos;
  function pintarAspecto() {
    if (!tejidos) { grupoAspecto.hidden = true; return; }
    const modo = tejidos.aspecto();
    const hay = tejidos.disponible();
    botonesAspecto.forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.aspecto === modo));
      b.disabled = b.dataset.aspecto === 'realista' && !hay;
    });
    const cargando = tejidos.pendientes();
    $('txt-aspecto').textContent = !hay
      ? 'Aún no hay texturas instaladas: se usan colores planos por sistema. Copia la carpeta «texturas» dentro de la app (ver texturas/LEEME.md).'
      : modo === 'realista'
        ? (cargando ? `Cargando texturas de tejido (${cargando})…` : 'Texturas de tejido. Se descargan solo para los sistemas que muestras.')
        : 'Colores planos por sistema, sin texturas.';
    pintarFascias();
  }
  // Casilla de las fascias de revestimiento: solo tiene efecto en el aspecto realista.
  const chkFascias = $('chk-fascias');
  function pintarFascias() {
    if (!tejidos || !chkFascias) return;
    const real = tejidos.aspecto() === 'realista';
    chkFascias.checked = tejidos.fascias();
    chkFascias.disabled = !real;
    $('lbl-fascias').classList.toggle('inactiva', !real);
    $('txt-fascias').textContent = !real
      ? 'Solo en el aspecto Realista: en esquemático las fascias se dibujan como cualquier otra estructura.'
      : chkFascias.checked
        ? 'Las fascias que envuelven los músculos se ven como una película translúcida. Retináculos, aponeurosis y vainas siguen opacos.'
        : 'Fascias de revestimiento ocultas. Se siguen pudiendo buscar y seleccionar desde el buscador o el explorador.';
  }
  if (chkFascias) chkFascias.addEventListener('change', () => { if (tejidos) tejidos.fijarFascias(chkFascias.checked); });
  bus.on('fascias', pintarFascias);
  botonesAspecto.forEach((b) => b.addEventListener('click', () => { if (tejidos) tejidos.fijar(b.dataset.aspecto); }));
  bus.on('aspecto', pintarAspecto);
  bus.on('tejido-estado', pintarAspecto);
  pintarAspecto();

  // ---- disección ----
  $('chk-contexto').addEventListener('change', (ev) => diseccion.setContexto(ev.target.checked));
  const btnDeshacer = $('btn-deshacer');
  const btnRestaurar = $('btn-restaurar');
  btnDeshacer.addEventListener('click', () => diseccion.deshacer());
  btnRestaurar.addEventListener('click', () => diseccion.restaurar());
  function pintarHistorial() {
    btnDeshacer.disabled = !diseccion.puedeDeshacer();
    btnRestaurar.disabled = !diseccion.hayCambios();
  }
  bus.on('diseccion', pintarHistorial);
  pintarHistorial();

  // ---- vistas rápidas ----
  document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => app.vistas.ir(b.dataset.vista)));

  // ---- separar (vista explosionada) ----
  const rngSep = $('rng-separar');
  const txtSep = $('txt-separar');
  const btnSepReiniciar = $('btn-separar-reiniciar');
  const selSis = $('sel-sep-sistema');
  const chkAtenuar = $('chk-sep-atenuar');
  const txtAlcance = $('txt-sep-alcance');
  const botonesAlcance = [...document.querySelectorAll('[data-alcance]')];
  let modoAlcance = 'visible';
  let regionFijada = null;
  for (const st of sistemas.lista()) selSis.append(h('option', { value: st.def.id, text: st.def.nombre }));
  const nombreSistema = (id) => app.datos.sistemaPorId.get(id)?.nombre || id;
  function alcanceDeUI() {
    if (modoAlcance === 'sistema') return { sistemas: [selSis.value] };
    if (modoAlcance === 'region' && regionFijada) return { region: regionFijada };
    return 'visible';
  }
  function pintarSeparar() {
    if (!app.separar) return;
    const r = app.separar.resumen();
    rngSep.value = String(r.pct);
    txtSep.textContent = r.pct + ' %';
    rngSep.setAttribute('aria-valuetext', r.pct + ' por ciento');
    btnSepReiniciar.disabled = r.pct === 0;
    chkAtenuar.checked = r.atenuar;
    const a = r.alcance;
    let texto;
    if (a === 'visible') { modoAlcance = 'visible'; texto = 'Se separan todas las piezas que están visibles.'; }
    else if (a.sistemas && a.sistemas.length === 1 && !a.region && !a.subsistema) {
      modoAlcance = 'sistema'; selSis.value = a.sistemas[0];
      texto = `Solo se separa «${nombreSistema(a.sistemas[0])}»; el resto ${r.atenuar ? 'queda atenuado' : 'queda en su sitio'}.`;
    } else if (a.region && !a.sistemas && !a.subsistema) {
      modoAlcance = 'region'; regionFijada = a.region;
      texto = `Solo se separa la región «${a.region}»; el resto ${r.atenuar ? 'queda atenuado' : 'queda en su sitio'}.`;
    } else {
      modoAlcance = 'otro';
      const partes = [a.sistemas && a.sistemas.map(nombreSistema).join(', '), a.region, a.subsistema].filter(Boolean);
      texto = `Solo se separa: ${partes.join(' · ')}; el resto ${r.atenuar ? 'queda atenuado' : 'queda en su sitio'}.`;
    }
    botonesAlcance.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.alcance === modoAlcance)));
    selSis.hidden = modoAlcance !== 'sistema';
    txtAlcance.textContent = texto;
  }
  rngSep.addEventListener('input', () => app.separar.aplicar(Number(rngSep.value), { alcance: alcanceDeUI(), duracion: 0, encuadrar: false }));
  rngSep.addEventListener('change', () => app.separar.encuadrarAlcance()); // al soltar: reencuadra solo si no cabe
  btnSepReiniciar.addEventListener('click', () => app.separar.reiniciar());
  chkAtenuar.addEventListener('change', () => app.separar.aplicar(app.separar.estado.pct, { atenuar: chkAtenuar.checked, duracion: 0, encuadrar: false }));
  selSis.addEventListener('change', () => app.separar.aplicar(app.separar.estado.pct || 0, { alcance: alcanceDeUI() }));
  botonesAlcance.forEach((b) => b.addEventListener('click', () => {
    const modo = b.dataset.alcance;
    if (modo === 'region') {
      const sel = app.seleccion.actual();
      if (!sel) { aviso('Selecciona una pieza para separar su región.'); return; }
      regionFijada = sel.est.region || null;
    }
    modoAlcance = modo;
    app.separar.aplicar(app.separar.estado.pct, { alcance: alcanceDeUI() });
    if (modo === 'visible' || app.separar.estado.pct === 0) pintarSeparar();
  }));
  bus.on('separacion', pintarSeparar);
  if (app.separar) pintarSeparar();

  // ---- modo de arrastre: Girar / Mover ----
  const botonesModo = [...document.querySelectorAll('[data-modo]')];
  function pintarModo() {
    const m = app.escena.modo ? app.escena.modo() : 'girar';
    botonesModo.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modo === m)));
  }
  botonesModo.forEach((b) => b.addEventListener('click', () => { app.escena.fijarModo?.(b.dataset.modo); pintarModo(); }));
  app.escena.alCambiarModo?.add(pintarModo);
  pintarModo();

  // ---- panel de sistemas (plegable en escritorio, cajón en móvil) ----
  const raiz = $('app');
  const btnSis = $('btn-sistemas');
  const telon = $('telon');
  const tabVista = $('tab-vista');
  const tabExp = $('tab-explorador');
  const btnExp = $('btn-explorador');
  let pestana = 'vista';
  function fijarPanel(abierto) {
    raiz.classList.toggle('plegado-izq', !abierto);
    btnSis.setAttribute('aria-expanded', String(abierto));
    btnExp.setAttribute('aria-expanded', String(abierto && pestana === 'explorador'));
    telon.hidden = !(abierto && esMovil());
    // En escritorio, el visor cambia de ancho: la escena se ajusta sola con ResizeObserver.
  }
  function fijarPestana(nombre) {
    pestana = nombre;
    const exp = nombre === 'explorador';
    $('pestana-vista').hidden = exp;
    $('pestana-explorador').hidden = !exp;
    tabVista.setAttribute('aria-selected', String(!exp)); tabVista.tabIndex = exp ? -1 : 0;
    tabExp.setAttribute('aria-selected', String(exp)); tabExp.tabIndex = exp ? 0 : -1;
    raiz.classList.toggle('explorador-abierto', exp);
    btnExp.setAttribute('aria-expanded', String(exp && !raiz.classList.contains('plegado-izq')));
  }
  tabVista.addEventListener('click', () => fijarPestana('vista'));
  tabExp.addEventListener('click', () => fijarPestana('explorador'));
  for (const t of [tabVista, tabExp]) t.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const siguiente = t === tabVista ? tabExp : tabVista;
    fijarPestana(siguiente === tabExp ? 'explorador' : 'vista');
    siguiente.focus();
  });
  function alternarExplorador() {
    if (pestana === 'explorador' && !raiz.classList.contains('plegado-izq')) { fijarPanel(false); return; }
    fijarPestana('explorador');
    fijarPanel(true);
    setTimeout(() => $('q-explorador').focus(), 0);
  }
  btnExp.addEventListener('click', alternarExplorador);
  if (app.explorador) {
    app.explorador.montar({ raiz: $('arbol-explorador'), filtro: $('q-explorador'), total: $('txt-exp-total'), vacio: $('exp-vacio'), restablecerBtn: $('btn-restablecer-vista') });
  }
  btnSis.addEventListener('click', () => fijarPanel(raiz.classList.contains('plegado-izq')));
  telon.addEventListener('click', () => fijarPanel(false));
  fijarPanel(!esMovil());
  window.matchMedia('(max-width: 860px)').addEventListener('change', (ev) => fijarPanel(!ev.matches));

  // ---- hoja inferior (ficha en móvil) ----
  const ficha = $('ficha');
  const ALTO_ASOMADA = 178;
  bus.on('seleccion', (sel) => {
    if (!esMovil()) { ficha.dataset.estado = sel ? 'abierta' : 'cerrada'; return; }
    if (sel) { if (ficha.dataset.estado === 'cerrada') ficha.dataset.estado = 'asomada'; fijarPanel(false); } else ficha.dataset.estado = 'cerrada';
  });
  let arrastre = null;
  ficha.addEventListener('pointerdown', (ev) => {
    if (!esMovil() || !ev.target.closest('.hoja-asa')) return;
    const alto = ficha.offsetHeight;
    const pos = { cerrada: alto, asomada: Math.max(alto - ALTO_ASOMADA, 0), abierta: 0 };
    arrastre = { y0: pos[ficha.dataset.estado] ?? alto, inicio: ev.clientY, alto, pos, movido: false, id: ev.pointerId, y: 0 };
    ficha.setPointerCapture(ev.pointerId);
    ficha.classList.add('arrastrando');
  });
  ficha.addEventListener('pointermove', (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const dy = ev.clientY - arrastre.inicio;
    if (Math.abs(dy) > 4) arrastre.movido = true;
    arrastre.y = Math.min(Math.max(arrastre.y0 + dy, 0), arrastre.alto);
    ficha.style.transform = `translateY(${arrastre.y}px)`;
  });
  function terminarArrastre(ev) {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const a = arrastre;
    arrastre = null;
    ficha.classList.remove('arrastrando');
    ficha.style.transform = '';
    if (!a.movido) { ficha.dataset.estado = ficha.dataset.estado === 'abierta' ? 'asomada' : 'abierta'; return; }
    if (a.y > a.pos.asomada + 60) { app.seleccion.deseleccionar(); return; }
    ficha.dataset.estado = Math.abs(a.y - a.pos.abierta) < Math.abs(a.y - a.pos.asomada) ? 'abierta' : 'asomada';
  }
  ficha.addEventListener('pointerup', terminarArrastre);
  ficha.addEventListener('pointercancel', terminarArrastre);
  ficha.addEventListener('click', (ev) => {
    if (esMovil() && ficha.dataset.estado === 'asomada' && !ev.target.closest('button, a, .hoja-asa')) ficha.dataset.estado = 'abierta';
  });

  // ---- teclado global ----
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'e' || ev.key === 'E') && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.defaultPrevented) {
      const t = ev.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      ev.preventDefault();
      alternarExplorador();
      return;
    }
    if (ev.key !== 'Escape' || ev.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return; // el diálogo se cierra solo
    if (document.activeElement === $('q')) return; // lo gestiona el buscador
    if (esMovil() && !raiz.classList.contains('plegado-izq')) { fijarPanel(false); return; }
    if (app.seleccion.actual()) app.seleccion.deseleccionar();
  });

  // ---- créditos ----
  const dlg = $('dlg-creditos');
  const enlace = (texto, url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: texto });
  dlg.append(
    h('div', { class: 'dialogo-cab' },
      h('h2', { id: 't-creditos', text: 'Créditos y licencias' }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar créditos', onclick: () => dlg.close() }, icono('cerrar'))),
    h('div', { class: 'dialogo-cuerpo' },
      h('p', { text: 'Atlas de estudio de anatomía. Material de estudio: no sustituye el criterio clínico ni la supervisión docente. El modelo es masculino adulto.' }),
      h('h3', { text: 'Gestos y teclas del visor' }),
      h('ul', {},
        h('li', {}, 'Girar: arrastra con un dedo o con el botón izquierdo del ratón (modo «Girar»).'),
        h('li', {}, 'Mover la vista (subir hasta la cabeza, bajar hasta los pies o ir a los lados): activa el modo «Mover» (tecla M), o mantén Mayús y arrastra, o arrastra con el botón derecho, o con dos dedos. Con el foco en el visor también sirven las flechas del teclado.'),
        h('li', {}, 'Acercar o alejar: rueda del ratón o pellizco. Doble clic o doble toque enfoca la estructura.'),
        h('li', {}, 'Nervios y vasos son muy finos: acércate con la rueda o el pellizco antes de tocarlos, o búscalos por nombre o elígelos en el Explorador.'),
        h('li', {}, 'Teclas: / abre el buscador, E el explorador, M cambia entre Girar y Mover, Esc cierra la ficha.')),
      h('h3', { text: 'Modelos 3D' }),
      h('ul', {},
        h('li', {}, enlace('Z-Anatomy — The libre 3D atlas of anatomy', 'https://github.com/LluisV/Z-Anatomy'), ' — CC BY-SA 4.0.'),
        h('li', {}, 'BodyParts3D, © The Database Center for Life Science, licencia CC Attribution 4.0 International (',
          enlace('licencia', 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html'), ').'),
        h('li', {}, 'Nombres en latín y español: TA2.csv de Z-Anatomy.')),
      h('p', {}, 'Las mallas derivadas se distribuyen bajo CC BY-SA 4.0.'),
      h('h3', { text: 'Partes de licencia no comercial' }),
      h('p', { text: 'El oído interno (University of Dundee, CC BY-NC-SA 4.0) y el riñón (Lissie Cowley, CC BY-NC 4.0) tienen licencia no comercial. Este proyecto es no comercial y las marca una por una en las atribuciones.' }),
      h('h3', { text: 'Código y tipografías' }),
      h('ul', {},
        h('li', {}, 'Código de la app: licencia MIT. Visor: three.js (MIT).'),
        h('li', {}, 'Fraunces e Inter: SIL Open Font License 1.1.')),
      h('p', { style: 'margin-top:14px' }, h('a', { href: 'ATRIBUCIONES.md', text: 'Ver la lista completa de atribuciones' }))));
  $('btn-creditos').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });

  // ---- depuración: ?debug=1 ----
  if (app.debug) {
    const caja = $('debug');
    caja.hidden = false;
    let ultimo = performance.now();
    let fps = 0;
    app.escena.alRenderizar.add((info) => {
      const ahora = performance.now();
      const dt = ahora - ultimo;
      ultimo = ahora;
      if (dt < 1000) fps = fps ? fps * 0.8 + (1000 / dt) * 0.2 : 1000 / dt;
      caja.textContent = `FPS (al renderizar) ${fps.toFixed(0)}\nLlamadas de dibujo ${info.calls}\nTriángulos ${info.triangles.toLocaleString('es-CO')}\nEstructuras ${sistemas.recs.size}\nMallas sin catálogo ${sistemas.sinCatalogo.length}`;
    });
  }

  pintarCarga();
  return { aviso, pintarCarga };
}
