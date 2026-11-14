// Selección por clic o toque (raycast en pointerup sin arrastre), resaltado, etiqueta flotante y enfoque.
import * as THREE from 'three';

const cero = new THREE.Vector3();
const UMBRAL_ARRASTRE = 6; // px
const VENTANA_DOBLE = 320; // ms
const DISTANCIA_DOBLE = 24; // px

export function crearSeleccion(app) {
  const { bus, escena } = app;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let actual = null; // { id, rec, est }
  let puntoEtiqueta = null; // THREE.Vector3 al que se ancla la etiqueta
  let etiqueta = null;

  // ---- API ----
  async function seleccionar(id, opciones = {}) {
    const est = app.datos.porId.get(id);
    if (!est) return false;
    const st = app.sistemas.estadoDe(est.sistema);
    if (!st) return false;
    // Carga el sistema si hace falta y lo enciende.
    if (!st.activo || st.estado !== 'listo') {
      const ok = await app.sistemas.activar(est.sistema, true);
      if (!ok) return false;
    }
    const rec = app.sistemas.rec(id);
    if (!rec) return false; // el GLB no trae esa estructura
    // Asegura que sea visible: baja la profundidad y la saca de las ocultas si hace falta.
    let aviso = null;
    if (rec.capa < app.diseccion.estado.profundidad) {
      app.diseccion.setProfundidad(rec.capa);
      aviso = `Profundidad ajustada a ${rec.capa} para mostrar la estructura.`;
    }
    if (app.diseccion.mostrar(id)) aviso = 'La estructura estaba oculta: se volvió a mostrar.';
    if (aviso) bus.emit('aviso', aviso);
    marcar(rec, opciones.punto || centroDe(rec));
    if (opciones.enfocar) enfocar(id); // la animación no bloquea la respuesta
    return true;
  }

  // Centro MOSTRADO de la estructura (el del catálogo más el desplazamiento de la vista separada).
  const centroDe = (rec) => (app.separar ? app.separar.centroMostrado(rec) : rec.centro) || null;

  function marcar(rec, punto) {
    if (actual && actual.id !== rec.id) app.sistemas.resaltar(actual.id, false);
    actual = { id: rec.id, rec, est: rec.est };
    // La etiqueta se ancla relativa a la pieza: sigue su desplazamiento mientras se separa.
    puntoEtiqueta = punto ? punto.clone().sub(rec.desp || cero) : null;
    app.sistemas.resaltar(rec.id, true);
    actualizarEtiqueta();
    bus.emit('seleccion', actual);
    escena.pedirRender();
  }

  function deseleccionar() {
    if (!actual) return;
    app.sistemas.resaltar(actual.id, false);
    actual = null;
    puntoEtiqueta = null;
    actualizarEtiqueta();
    bus.emit('seleccion', null);
    escena.pedirRender();
  }

  function enfocar(id) {
    const rec = app.sistemas.rec(id || actual?.id);
    const objetivo = rec && centroDe(rec);
    if (!objetivo) return Promise.resolve(false);
    const distancia = escena.distanciaParaRadio(rec.radio);
    return escena.irA({ objetivo, distancia, duracion: 300 }).then(() => true);
  }

  // ---- raycast ----
  // Rayo exacto: la primera malla visible tocada. La piel y las fascias de revestimiento (películas translúcidas en
  // aspecto realista) solo se aciertan si no hay nada más detrás en el mismo rayo: se prefiere lo de adentro.
  // Orden de preferencia: lo opaco > la película de fascia > la piel.
  function acierto(clienteX, clienteY, mallas) {
    const r = escena.canvas.getBoundingClientRect();
    ndc.set(((clienteX - r.left) / r.width) * 2 - 1, -((clienteY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, escena.camera);
    const hits = raycaster.intersectObjects(mallas, false);
    let hitPiel = null;
    let hitPelicula = null;
    for (const hit of hits) {
      if (app.diseccion.estaRecortado(hit.point)) continue; // lado cortado: no se puede tocar
      const rec = hit.object.userData.rec;
      if (!rec) continue;
      if (rec.sistema === 'piel') { hitPiel = hitPiel || hit; continue; } // la piel es translúcida: se prefiere lo de adentro
      if (rec.enPelicula) { hitPelicula = hitPelicula || hit; continue; } // la fascia de revestimiento, también
      return hit;
    }
    return hitPelicula || hitPiel;
  }

  // Tolerancia de puntería para estructuras finas (nervios, vasos): son tubos de 1–2 px a distancia normal.
  // Criterio de "fina": sistema nervioso, cardiovascular o linfático, o cualquier malla cuyo grosor (la segunda
  // dimensión de su caja, que en un tubo es el diámetro y en una lámina es el ancho) proyectado en pantalla sea
  // menor que GROSOR_FINO_PX a la distancia del acierto.
  // Solo se usa en el clic y solo contra las mallas finas visibles. Si el rayo central acierta algo fino se conserva;
  // si no acierta nada o acierta algo grueso, se lanzan rayos auxiliares en anillos (de dentro hacia fuera) y gana la
  // candidata fina más cercana al cursor, salvo que esté más de PROFUNDIDAD_MAX_M detrás del acierto central.
  const SISTEMAS_FINOS = new Set(['nervioso', 'cardiovascular', 'linfatico']);
  const RADIO_RATON_PX = 6;   // px CSS (ya incluyen el devicePixelRatio: 6 px de pantalla del usuario)
  const RADIO_TACTIL_PX = 12; // el dedo es menos preciso
  const ANILLOS = [1 / 3, 2 / 3, 1];
  const RAYOS_POR_ANILLO = 8;
  const GROSOR_FINO_PX = 8;
  const GROSOR_MAX_FINA_M = 0.04; // preselección barata: mallas con grosor absoluto menor que 4 cm
  const PROFUNDIDAD_MAX_M = 0.02; // una fina no puede estar más de 2 cm detrás del acierto central

  function grosorDe(malla) {
    if (malla.userData.grosor === undefined) {
      const g = malla.geometry;
      if (g && !g.boundingBox) g.computeBoundingBox();
      if (g && g.boundingBox) {
        const t = g.boundingBox.getSize(new THREE.Vector3()).toArray().sort((x, y) => x - y);
        malla.userData.grosor = t[1] * (malla.matrixWorld ? malla.matrixWorld.getMaxScaleOnAxis() : 1);
      } else malla.userData.grosor = Infinity;
    }
    return malla.userData.grosor;
  }
  function pxPorMetro(distancia) {
    const alto = escena.canvas.getBoundingClientRect().height;
    return alto / (2 * Math.tan(THREE.MathUtils.degToRad(escena.camera.fov / 2)) * Math.max(distancia, 1e-6));
  }
  const esFinaPorSistema = (malla) => SISTEMAS_FINOS.has(malla.userData.rec?.sistema);
  function esFinaEnPantalla(malla, distancia) {
    return esFinaPorSistema(malla) || grosorDe(malla) * pxPorMetro(distancia) < GROSOR_FINO_PX;
  }

  function elegir(clienteX, clienteY, opciones = {}) {
    const mallas = app.sistemas.mallasVisibles();
    const central = acierto(clienteX, clienteY, mallas);
    if (opciones.exacto || (central && esFinaEnPantalla(central.object, central.distance))) return central; // `exacto`: sin tolerancia (pruebas)
    const finas = mallas.filter((m) => m.userData.rec && (esFinaPorSistema(m) || grosorDe(m) < GROSOR_MAX_FINA_M));
    if (!finas.length) return central;
    const ref = central && central.object.userData.rec.sistema !== 'piel' && !central.object.userData.rec.enPelicula ? central : null;
    const R = opciones.tactil ? RADIO_TACTIL_PX : RADIO_RATON_PX;
    for (const f of ANILLOS) {
      const radio = R * f;
      let mejor = null;
      for (let i = 0; i < RAYOS_POR_ANILLO; i++) {
        const ang = (i / RAYOS_POR_ANILLO) * Math.PI * 2 + f; // desfase distinto por anillo
        const hit = acierto(clienteX + Math.cos(ang) * radio, clienteY + Math.sin(ang) * radio, finas);
        if (!hit || !esFinaEnPantalla(hit.object, hit.distance)) continue;
        if (ref && hit.distance > ref.distance + PROFUNDIDAD_MAX_M) continue; // claramente detrás: no
        if (!mejor || hit.distance < mejor.distance) mejor = hit;
      }
      if (mejor) return mejor; // los anillos van de dentro hacia fuera: el primero con acierto es el más cercano al cursor
    }
    return central;
  }

  // ---- eventos de puntero ----
  let inicio = null;
  let multitoque = false;
  let ultimoToque = null;
  const punteros = new Set();
  const canvas = escena.canvas;

  canvas.addEventListener('pointerdown', (ev) => {
    punteros.add(ev.pointerId);
    if (punteros.size > 1) multitoque = true;
    if (punteros.size === 1) { multitoque = false; inicio = { x: ev.clientX, y: ev.clientY, t: performance.now() }; }
  });
  canvas.addEventListener('pointercancel', (ev) => { punteros.delete(ev.pointerId); if (!punteros.size) inicio = null; });
  canvas.addEventListener('pointerup', (ev) => {
    punteros.delete(ev.pointerId);
    if (!inicio) return;
    const cancelado = multitoque;
    const ini = inicio;
    if (punteros.size === 0) inicio = null;
    if (cancelado || ev.button > 0) return;
    if (Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) > UMBRAL_ARRASTRE) return;
    const ahora = performance.now();
    const esDoble = ultimoToque && ahora - ultimoToque.t < VENTANA_DOBLE
      && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < DISTANCIA_DOBLE;
    ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY };
    const hit = elegir(ev.clientX, ev.clientY, { tactil: ev.pointerType === 'touch' || ev.pointerType === 'pen' });
    if (!hit) { if (!esDoble) deseleccionar(); return; }
    const rec = hit.object.userData.rec;
    marcar(rec, hit.point);
    if (esDoble) { ultimoToque = null; enfocar(rec.id); }
  });

  // ---- etiqueta flotante ----
  function crearEtiqueta() {
    etiqueta = document.createElement('div');
    etiqueta.className = 'etiqueta-3d';
    etiqueta.setAttribute('aria-hidden', 'true');
    etiqueta.hidden = true;
    escena.contenedor.append(etiqueta);
  }
  const tmp = new THREE.Vector3();
  function actualizarEtiqueta() {
    if (!etiqueta) crearEtiqueta();
    if (!actual || !puntoEtiqueta || !actual.rec.objeto.visible) { etiqueta.hidden = true; return; }
    tmp.copy(puntoEtiqueta).add(actual.rec.desp || cero).project(escena.camera);
    if (tmp.z > 1 || tmp.z < -1) { etiqueta.hidden = true; return; }
    const w = escena.contenedor.clientWidth, h = escena.contenedor.clientHeight;
    const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
    if (x < 0 || x > w || y < 0 || y > h) { etiqueta.hidden = true; return; }
    const texto = actual.est.nombre_es + (actual.est.lado ? ' ' + actual.est.lado : '');
    if (etiqueta.textContent !== texto) etiqueta.textContent = texto;
    etiqueta.hidden = false;
    etiqueta.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 12px))`;
  }
  escena.alRenderizar.add(actualizarEtiqueta);

  return { seleccionar, deseleccionar, enfocar, actual: () => actual, elegir };
}
