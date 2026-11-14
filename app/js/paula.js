// Integración con Claude: window.paulaSelection, window.paulaApp, "Preguntar a mi tutora" y portapapeles.
import { fichaDe } from './datos.js';

export function construirPregunta({ nombre, nombre_la, sistema_nombre, lado }) {
  const latin = nombre_la ? ` (${nombre_la})` : '';
  const ladoTxt = lado === 'derecho' ? ', lado derecho' : lado === 'izquierdo' ? ', lado izquierdo' : '';
  return `/paula Estoy en la app de anatomía viendo: ${nombre}${latin} — ${sistema_nombre}${ladoTxt}. `
    + 'Explícame su anatomía, función, irrigación e inervación y su relevancia clínica, y hazme 3 preguntas de repaso.';
}

// Cadena de respaldo: Clipboard API -> textarea + execCommand -> mostrar el texto para copiar a mano.
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(texto);
      return 'portapapeles';
    }
  } catch (e) { /* sigue con el respaldo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return 'execCommand';
  } catch (e) { /* sigue con el respaldo */ }
  return 'manual';
}

export function crearPaula(app) {
  const { bus } = app;
  window.paulaSelection = null;

  function armar(actual, preguntado = false) {
    const est = actual.est;
    const sis = app.datos.sistemaPorId.get(est.sistema);
    const base = {
      id: est.id,
      nombre: est.nombre_es,
      nombre_la: est.nombre_la ?? null,
      sistema: est.sistema,
      sistema_nombre: sis ? sis.nombre : est.sistema,
      lado: est.lado ?? null,
      tiene_ficha: !!fichaDe(app.fichas, est),
    };
    return {
      ...base,
      preguntado,
      pregunta: construirPregunta(base),
      timestamp: new Date().toISOString(),
    };
  }

  function publicar(valor) {
    window.paulaSelection = valor;
    try { window.dispatchEvent(new CustomEvent('paula:seleccion', { detail: valor })); } catch (e) { /* nada */ }
  }

  bus.on('seleccion', (actual) => publicar(actual ? armar(actual) : null));
  // Cuando terminan de cargar las fichas, `tiene_ficha` puede cambiar.
  bus.on('fichas-cargadas', () => {
    const actual = app.seleccion.actual();
    if (actual) publicar(armar(actual, window.paulaSelection?.preguntado || false));
  });

  // Botón "Preguntar a mi tutora": copia la pregunta y lo avisa.
  async function preguntar() {
    const actual = app.seleccion.actual();
    if (!actual) return false;
    const valor = armar(actual, true);
    publicar(valor);
    const via = await copiarTexto(valor.pregunta);
    bus.emit('pregunta-copiada', { via, texto: valor.pregunta });
    return true;
  }

  // ---- API pública ----
  const seguro = (fn, porDefecto) => (...args) => {
    try { return fn(...args); } catch (e) { console.error('[paula] error en paulaApp', e); return porDefecto; }
  };
  const seguroAsync = (fn, porDefecto) => async (...args) => {
    try { return await fn(...args); } catch (e) { console.error('[paula] error en paulaApp', e); return porDefecto; }
  };

  window.paulaApp = {
    version: 1,
    estado: seguro(() => {
      const c = app.diseccion.estado.corte;
      return {
        sistemasVisibles: app.sistemas.idsActivos(),
        profundidad: app.diseccion.estado.profundidad,
        corte: { activo: c.activo, eje: c.eje, posicion: Number(c.posicion.toFixed(4)), invertido: c.invertido },
        seleccion: window.paulaSelection,
        aspecto: app.tejidos ? app.tejidos.aspecto() : 'esquematico',
        fascias: app.tejidos ? app.tejidos.fascias() : true, // película de las fascias de revestimiento (solo en realista)
        separacion: app.separar ? app.separar.estado.pct : 0, // % de separación (0–100)
        alcanceSeparacion: app.separar ? app.separar.resumen().alcance : 'visible', // 'visible' o {sistemas, region, subsistema}
      };
    }, null),
    buscar: seguro((texto) => app.buscador.buscarAPI(texto), []),
    // Espera a que estén cargadas las fichas (máx. 8 s) para que `tiene_ficha` sea correcto
    // cuando la promesa resuelve: antes se calculaba con el mapa de fichas aún vacío.
    seleccionar: seguroAsync(async (id) => {
      if (typeof id !== 'string') return false;
      const ok = await app.seleccion.seleccionar(id, { enfocar: true });
      if (ok && app.fichasListas) {
        await Promise.race([app.fichasListas, new Promise((r) => setTimeout(r, 8000))]);
        const actual = app.seleccion.actual();
        if (actual && actual.id === id) publicar(armar(actual, window.paulaSelection?.preguntado || false));
      }
      return ok;
    }, false),
    mostrarSistema: seguroAsync(async (id, visible = true) => {
      if (typeof id !== 'string') return false;
      return app.sistemas.activar(id, visible !== false);
    }, false),
    aislar: seguro((id) => {
      const objetivo = typeof id === 'string' ? id : app.seleccion.actual()?.id;
      return objetivo ? app.diseccion.aislar(objetivo) : false;
    }, false),
    restaurar: seguro(() => { app.diseccion.restaurar(); return true; }, false),
    vista: seguro((nombre) => app.vistas.ir(nombre), false),
    // separar(pct, { alcance, atenuar }) -> Promise<number>. alcance: 'visible' (por defecto el actual), un id de sistema,
    // 'region' (la de la pieza seleccionada), o { sistemas:[...], region, subsistema }.
    separar: seguroAsync(async (pct, opciones) => (app.separar ? app.separar.aplicar(pct, opciones || {}) : 0), 0),
    // verSolo({ sistema, region, subsistema }) -> Promise<boolean>: apaga lo demás y encuadra.
    verSolo: seguroAsync(async (sel) => (app.explorador ? app.explorador.verSolo(sel || {}) : false), false),
    restablecerVista: seguroAsync(async () => (app.explorador ? app.explorador.restablecer() : false), false),
    // aspecto() devuelve el aspecto actual; aspecto('realista'|'esquematico') lo cambia y devuelve el nuevo,
    // o false si no es posible (valor desconocido o sin texturas instaladas).
    aspecto: seguro((modo) => {
      const t = app.tejidos;
      if (modo === undefined) return t ? t.aspecto() : 'esquematico';
      return t && t.fijar(modo) ? t.aspecto() : false;
    }, false),
    // fascias() devuelve si se muestran las fascias de revestimiento (película translúcida, solo en realista);
    // fascias(true|false) lo cambia y devuelve el nuevo valor.
    fascias: seguro((valor) => {
      const t = app.tejidos;
      if (!t) return true;
      return valor === undefined ? t.fascias() : t.fijarFascias(valor);
    }, true),
  };

  return { preguntar, armar };
}
