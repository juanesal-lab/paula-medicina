// Renderer, cámara, luces, controles y bucle de render a demanda.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reducirMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const suavizado = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const DIRECCIONES = {
  anterior: [0, 0, 1],
  posterior: [0, 0, -1],
  derecha: [-1, 0, 0], // la derecha del paciente es -X
  izquierda: [1, 0, 0],
  superior: [0, 1, 0.0001],
};

// Luz e imagen por aspecto. Esquemático = el aspecto original (sin tone mapping, luces directas).
// Realista = iluminación por imagen (RoomEnvironment + PMREM), tone mapping ACES y luces directas más suaves.
// AJUSTE VISUAL: si en realista los colores se queman, baja `exposicion`/`entorno`; si se ve apagado, súbelos.
// Los valores de realista salen de `app/dev/calcular-luz.mjs` (estimación por cálculo del valor final tras ACES para una
// superficie de frente a la luz principal): hueso marfil ~76 % y músculo ~31 % de luminancia de salida, sin recorte.
// Vuelve a ejecutarlo con `--exposicion=... --entorno=... --hemisferica=... --camara=... --contraluz=...` antes de tocarlos.
export const ESTILO_LUZ = {
  esquematico: { tono: THREE.NoToneMapping, exposicion: 1, entorno: 0, hemisferica: 1.6, camara: 2.6, contraluz: 0.8 },
  realista: { tono: THREE.ACESFilmicToneMapping, exposicion: 0.8, entorno: 0.3, hemisferica: 0.15, camara: 1.15, contraluz: 0.3 },
};

// ---- modo de manejo: Girar (arrastre = rotar) / Mover (arrastre = desplazar) ----
// En ambos modos siguen funcionando: botón derecho o dos dedos = desplazar, rueda o pellizco = zoom,
// y Mayús (o Ctrl) + arrastre = lo contrario del modo (OrbitControls lo intercambia solo).
export const MODOS = ['girar', 'mover'];
export function aplicarModo(controls, modo) {
  if (!MODOS.includes(modo)) return false;
  controls.mouseButtons.LEFT = modo === 'mover' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  controls.touches.ONE = modo === 'mover' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  return true;
}

// ---- teclado del visor ----
export const MARGEN_OBJETIVO = 0.5; // m: cuánto puede salirse el punto de mira de la caja del cuerpo
const FLECHAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const esCampo = (el) => !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable === true);
// Las flechas solo desplazan la vista si el foco está en el visor o en el cuerpo de la página: nunca en campos,
// botones, deslizadores, el explorador (árbol), listas, diálogos ni el buscador.
export function flechasPermitidas(el, { canvas, contenedor } = {}) {
  if (!el) return true;
  if (el === canvas || el === contenedor) return true;
  return el.tagName === 'BODY' || el.tagName === 'HTML';
}
// Desplazamiento que devuelve el punto de mira `t` a la caja (con margen), o null si ya está dentro.
export function correccionObjetivo(t, caja, margen = MARGEN_OBJETIVO) {
  if (!caja || caja.isEmpty()) return null;
  const d = new THREE.Vector3(
    Math.min(Math.max(t.x, caja.min.x - margen), caja.max.x + margen) - t.x,
    Math.min(Math.max(t.y, caja.min.y - margen), caja.max.y + margen) - t.y,
    Math.min(Math.max(t.z, caja.min.z - margen), caja.max.z + margen) - t.z,
  );
  return d.lengthSq() === 0 ? null : d;
}
// Devuelve true si la tecla se usó. `acciones`: { desplazar(dx, dy, rapido), alternarModo(), destino }.
export function procesarTecla(ev, acciones, contexto) {
  if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  const destino = ev.target;
  if (FLECHAS[ev.key]) {
    if (!flechasPermitidas(destino, contexto)) return false;
    const [dx, dy] = FLECHAS[ev.key];
    acciones.desplazar(dx, dy, !!ev.shiftKey);
    ev.preventDefault();
    return true;
  }
  if ((ev.key === 'm' || ev.key === 'M') && !esCampo(destino) && !destino?.closest?.('[role="tree"], [role="listbox"], dialog')) {
    acciones.alternarModo();
    ev.preventDefault();
    return true;
  }
  return false;
}

export function crearEscena(contenedor, opciones = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Visor 3D del cuerpo humano. Arrastra para girar, rueda para acercar, clic para seleccionar.');
  canvas.setAttribute('role', 'img');
  contenedor.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 40);
  camera.position.set(0, 1.0, 3.6);
  scene.add(camera);

  // Luces: hemisférica suave + luz "de linterna" pegada a la cámara + contraluz tenue.
  const luzHemisferica = new THREE.HemisphereLight(0xfff4e6, 0x2a2e36, 1.6);
  scene.add(luzHemisferica);
  const luzCamara = new THREE.DirectionalLight(0xffffff, 2.6);
  luzCamara.position.set(0.6, 0.9, 1);
  camera.add(luzCamara);
  const contraluz = new THREE.DirectionalLight(0xbcc8e0, 0.8);
  contraluz.position.set(-1, 0.6, -1.2);
  scene.add(contraluz);

  // Entorno IBL: se genera la primera vez que se pide el aspecto realista.
  let entornoPMREM = null;
  let aspecto = 'esquematico';
  function fijarAspecto(modo) {
    const e = ESTILO_LUZ[modo];
    if (!e) return false;
    aspecto = modo;
    if (e.entorno > 0 && !entornoPMREM) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      entornoPMREM = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    scene.environment = e.entorno > 0 ? entornoPMREM : null;
    scene.environmentIntensity = e.entorno;
    renderer.toneMapping = e.tono;
    renderer.toneMappingExposure = e.exposicion;
    luzHemisferica.intensity = e.hemisferica;
    luzCamara.intensity = e.camara;
    contraluz.intensity = e.contraluz;
    pedirRender();
    return true;
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.06;
  controls.maxDistance = 7;
  controls.target.set(0, 0.9, 0);
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();
  canvas.style.touchAction = 'none';

  // ---- modo Girar / Mover ----
  let modoActual = 'girar';
  const alCambiarModo = new Set();
  function fijarModo(modo) {
    if (!aplicarModo(controls, modo)) return false;
    modoActual = modo;
    canvas.style.cursor = modo === 'mover' ? 'move' : '';
    for (const fn of alCambiarModo) fn(modo);
    return true;
  }
  const alternarModo = () => fijarModo(modoActual === 'girar' ? 'mover' : 'girar');

  // ---- el punto de mira no se pierde: se mantiene dentro de la caja del cuerpo (con margen) ----
  let proveedorLimite = null;
  function acotarObjetivo() {
    const caja = proveedorLimite && proveedorLimite();
    const d = correccionObjetivo(controls.target, caja, MARGEN_OBJETIVO);
    if (!d) return;
    camera.position.add(d); // se mueve la cámara igual que el punto de mira: la vista no cambia, solo se desplaza
    controls.target.add(d);
  }
  controls.addEventListener('change', acotarObjetivo);

  // Desplaza la vista en el plano de la pantalla (flechas del teclado).
  function desplazar(dx, dy, rapido = false) {
    const paso = camera.position.distanceTo(controls.target) * 0.07 * (rapido ? 3 : 1);
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const delta = new THREE.Vector3(e[0] * dx + e[4] * dy, e[1] * dx + e[5] * dy, e[2] * dx + e[6] * dy).multiplyScalar(paso);
    camera.position.add(delta);
    controls.target.add(delta);
    acotarObjetivo();
    controls.update();
    pedirRender();
  }
  document.addEventListener('keydown', (ev) => procesarTecla(ev, { desplazar, alternarModo }, { canvas, contenedor }));

  // ---- render a demanda ----
  let pendiente = false;
  let sucio = true;
  const animaciones = new Set();
  const alRenderizar = new Set();
  let ultimoInfo = { calls: 0, triangles: 0 };

  function pedirRender() {
    sucio = true;
    if (!pendiente) { pendiente = true; requestAnimationFrame(cuadro); }
  }

  function cuadro(ahora) {
    pendiente = false;
    let activo = false;
    for (const a of [...animaciones]) {
      if (a(ahora)) activo = true; else animaciones.delete(a);
    }
    const cambio = controls.update();
    if (cambio || activo || sucio) {
      sucio = false;
      renderer.render(scene, camera);
      ultimoInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      for (const fn of alRenderizar) fn(ultimoInfo);
    }
    if (cambio || activo) pedirRender();
  }

  controls.addEventListener('change', pedirRender);

  function ajustarTamano() {
    const w = Math.max(contenedor.clientWidth, 1);
    const h = Math.max(contenedor.clientHeight, 1);
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pedirRender();
  }
  new ResizeObserver(ajustarTamano).observe(contenedor);
  ajustarTamano();

  // ---- animaciones ----
  // Anima t de 0 a 1 en `duracion` ms. Devuelve una promesa que se resuelve al terminar.
  function animar(duracion, fn) {
    return new Promise((resolver) => {
      if (reducirMovimiento() || duracion <= 0) { fn(1); pedirRender(); resolver(); return; }
      let inicio = null;
      let terminada = false;
      const fin = () => { if (!terminada) { terminada = true; resolver(); } };
      const paso = (ahora) => {
        if (terminada) return false;
        if (inicio === null) inicio = ahora;
        const t = Math.min((ahora - inicio) / duracion, 1);
        fn(suavizado(t));
        if (t >= 1) { fin(); return false; }
        return true;
      };
      animaciones.add(paso);
      // Respaldo por si la pestaña está en segundo plano y no hay requestAnimationFrame.
      setTimeout(() => { if (!terminada) { fn(1); animaciones.delete(paso); fin(); pedirRender(); } }, duracion + 200);
      pedirRender();
    });
  }

  // Mueve cámara y objetivo: conserva la dirección actual (o usa `direccion`) y ajusta la distancia.
  function irA({ objetivo, distancia, direccion, duracion = 300 }) {
    const t0 = controls.target.clone();
    const off0 = camera.position.clone().sub(t0);
    const d0 = off0.length() || 1;
    const dir0 = off0.clone().normalize();
    const dir1 = direccion ? new THREE.Vector3(...direccion).normalize() : dir0.clone();
    const t1 = objetivo ? objetivo.clone() : t0.clone();
    const d1 = distancia ?? d0;
    const rel = new THREE.Quaternion().setFromUnitVectors(dir0, dir1);
    const id = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    return animar(duracion, (t) => {
      q.copy(id).slerp(rel, t);
      const dir = dir0.clone().applyQuaternion(q);
      const dist = d0 + (d1 - d0) * t;
      controls.target.lerpVectors(t0, t1, t);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      camera.lookAt(controls.target);
      controls.update();
    });
  }

  function distanciaParaRadio(radio) {
    const medio = THREE.MathUtils.degToRad(camera.fov / 2);
    const porAlto = radio / Math.sin(medio);
    const porAncho = radio / Math.sin(Math.atan(Math.tan(medio) * camera.aspect));
    return Math.min(Math.max(Math.max(porAlto, porAncho) * 1.35, 0.14), controls.maxDistance);
  }

  // Distancia para que quepa una caja de medio ancho `mitadAncho` y media altura `mitadAlto` (más su profundidad).
  function distanciaParaCaja(mitadAncho, mitadAlto, mitadFondo = 0) {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(mitadAlto / t, mitadAncho / (t * camera.aspect));
    return Math.min(Math.max(d * 1.1 + mitadFondo, 0.14), controls.maxDistance);
  }

  return {
    THREE, renderer, scene, camera, controls, canvas, contenedor,
    pedirRender, animar, irA, distanciaParaRadio, distanciaParaCaja, alRenderizar, fijarAspecto,
    fijarModo, alternarModo, modo: () => modoActual, alCambiarModo, desplazar, acotarObjetivo,
    fijarLimite: (fn) => { proveedorLimite = fn; },
    aspecto: () => aspecto,
    info: () => ultimoInfo,
  };
}
