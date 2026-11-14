// Panel de ficha: datos mínimos del catálogo y, si existe, la ficha completa (SPEC §7.4).
import { h, vaciar } from './util/dom.js';
import { icono } from './util/iconos.js';
import { fichaDe } from './datos.js';
import { colorSeguro } from './util/texto.js';

const ETIQUETAS = [
  ['funcion', 'Función'],
  ['irrigacion', 'Irrigación'],
  ['drenaje_venoso', 'Drenaje venoso'],
  ['drenaje_linfatico', 'Drenaje linfático'],
  ['inervacion', 'Inervación'],
  ['relaciones', 'Relaciones'],
];

const urlSegura = (u) => typeof u === 'string' && /^https:\/\//i.test(u);
const hayTexto = (v) => typeof v === 'string' && v.trim() !== '';
const hayLista = (v) => Array.isArray(v) && v.length > 0;

// Secciones óseas opcionales (SPEC §7.4): accidentes, articulaciones, inserciones y osificación.
function seccionesOseas(ficha, seccion) {
  const salida = [];
  const acc = (ficha.accidentes || []).filter((a) => a && hayTexto(a.nombre));
  if (hayLista(ficha.accidentes) && acc.length) {
    salida.push(seccion('Accidentes óseos', h('ul', { class: 'f-lista' }, acc.map((a) =>
      h('li', {},
        h('strong', { text: a.nombre }),
        hayTexto(a.nombre_la) ? [' ', h('i', { lang: 'la', class: 'f-la', text: a.nombre_la })] : null,
        hayTexto(a.nota) ? [' — ', a.nota] : null)))));
  }
  const art = (ficha.articulaciones || []).filter((a) => a && (hayTexto(a.nombre) || hayTexto(a.con)));
  if (hayLista(ficha.articulaciones) && art.length) {
    salida.push(seccion('Articulaciones', h('ul', { class: 'f-lista' }, art.map((a) =>
      h('li', {},
        h('strong', { text: hayTexto(a.nombre) ? a.nombre : a.con }),
        hayTexto(a.con) && hayTexto(a.nombre) ? [' con ', a.con] : null,
        hayTexto(a.tipo) ? [' (', a.tipo, ')'] : null)))));
  }
  const ins = (ficha.inserciones || []).filter((m) => m && hayTexto(m.musculo));
  if (hayLista(ficha.inserciones) && ins.length) {
    salida.push(seccion('Músculos que se insertan', h('ul', { class: 'f-lista f-ins' }, ins.map((m) => {
      const origen = m.tipo === 'origen';
      return h('li', {},
        h('span', { class: 'f-ins-tipo ' + (origen ? 'es-origen' : 'es-insercion'), text: origen ? 'Origen' : 'Inserción' }),
        ' ', h('strong', { text: m.musculo }),
        hayTexto(m.donde) ? [' — ', m.donde] : null);
    }))));
  }
  if (hayTexto(ficha.osificacion)) salida.push(seccion('Osificación', h('p', { text: ficha.osificacion })));
  return salida;
}

export function crearFicha(app, raiz) {
  const { bus } = app;
  let paneles = {};

  function seccion(titulo, ...contenido) {
    return h('section', { class: 'f-seccion' }, h('h3', { text: titulo }), ...contenido);
  }

  function estadoVacio() {
    vaciar(raiz);
    raiz.append(
      h('div', { class: 'hoja-asa', 'data-asa': '' }),
      h('div', { class: 'ficha-vacia' },
        h('p', { class: 'f-kicker', text: 'Ficha' }),
        h('h2', { class: 'f-nombre', text: 'Ninguna estructura seleccionada' }),
        h('p', { text: 'Toca o haz clic sobre una estructura del cuerpo, o búscala por nombre, para ver su ficha.' }),
        h('ul', { class: 'f-atajos' },
          h('li', {}, h('kbd', { text: 'Doble clic' }), ' enfoca la estructura'),
          h('li', {}, h('kbd', { text: '/' }), ' abre el buscador'),
          h('li', {}, h('kbd', { text: 'Esc' }), ' cierra la ficha'),
          h('li', {}, h('kbd', { text: 'M' }), ' cambia entre girar y mover'),
          h('li', {}, h('kbd', { text: 'Mayús' }), ' + arrastrar desplaza la vista'),
          h('li', {}, h('kbd', { text: 'E' }), ' abre el explorador'),
        ),
      ),
    );
    paneles = {};
  }

  function boton(texto, nombreIcono, alHacer, extra = {}) {
    return h('button', { type: 'button', class: 'btn ' + (extra.clase || ''), onclick: alHacer, 'aria-pressed': extra.pressed, 'aria-label': extra.etiqueta }, icono(nombreIcono, 16), h('span', { text: texto }));
  }

  function pintar() {
    const sel = app.seleccion.actual();
    if (!sel) { estadoVacio(); return; }
    const est = sel.est;
    const ficha = fichaDe(app.fichas, est);
    const sis = app.datos.sistemaPorId.get(est.sistema);
    vaciar(raiz);

    const cab = h('header', { class: 'ficha-cab' },
      h('p', { class: 'f-kicker' },
        h('span', { class: 'chip-color', style: `background:${colorSeguro(sis?.color)}`, 'aria-hidden': 'true' }),
        sis ? sis.nombre : est.sistema),
      h('h2', { class: 'f-nombre', text: est.nombre_es }),
      est.nombre_la ? h('p', { class: 'f-latin', lang: 'la', text: est.nombre_la }) : null,
      h('div', { class: 'f-chips' },
        est.lado ? h('span', { class: 'chip', text: 'Lado ' + est.lado }) : null,
        est.region ? h('span', { class: 'chip', text: est.region }) : null,
      ),
      h('button', { type: 'button', class: 'icon-btn f-cerrar', 'aria-label': 'Cerrar ficha', onclick: () => app.seleccion.deseleccionar() }, icono('cerrar')),
    );

    paneles.ocultar = boton('Ocultar', 'ocultar', () => app.diseccion.alternarOculta(est.id), { etiqueta: 'Ocultar la estructura' });
    paneles.aislar = boton('Aislar', 'aislar', () => app.diseccion.aislar(est.id), { pressed: 'false', etiqueta: 'Aislar la estructura' });
    paneles.transparente = boton('Transparente', 'transparente', () => app.diseccion.transparente(est.id), { pressed: 'false', etiqueta: 'Volver transparente la estructura' });

    const acciones = h('div', { class: 'ficha-acciones' },
      h('button', { type: 'button', class: 'btn btn-primario', onclick: () => app.paula.preguntar(), 'aria-label': 'Preguntar a mi tutora: copia una pregunta sobre esta estructura para pegarla en Claude' }, icono('preguntar', 16), h('span', { text: 'Preguntar a mi tutora' })),
      h('div', { class: 'acciones-fila', role: 'group', 'aria-label': 'Disección' },
        boton('Enfocar', 'enfocar', () => app.seleccion.enfocar(est.id), { etiqueta: 'Enfocar la estructura' }),
        paneles.ocultar, paneles.aislar, paneles.transparente),
    );

    const cuerpo = h('div', { class: 'ficha-cuerpo' });
    if (!ficha) {
      cuerpo.append(h('p', { class: 'f-pendiente' }, icono('libro', 16), h('span', { text: 'Ficha en preparación.' })));
    } else {
      if (ficha.resumen) cuerpo.append(h('p', { class: 'f-resumen', text: ficha.resumen }));
      if (ficha.funcion) cuerpo.append(seccion('Función', h('p', { text: ficha.funcion })));
      if (ficha.musculo) {
        const m = ficha.musculo;
        cuerpo.append(seccion('Origen, inserción y acción', h('dl', { class: 'f-musculo' },
          m.origen ? [h('dt', { text: 'Origen' }), h('dd', { text: m.origen })] : null,
          m.insercion ? [h('dt', { text: 'Inserción' }), h('dd', { text: m.insercion })] : null,
          m.accion ? [h('dt', { text: 'Acción' }), h('dd', { text: m.accion })] : null)));
      }
      for (const [campo, titulo] of ETIQUETAS) {
        if (campo === 'funcion' || !ficha[campo]) continue;
        cuerpo.append(seccion(titulo, h('p', { text: ficha[campo] })));
      }
      for (const sec of seccionesOseas(ficha, seccion)) cuerpo.append(sec);
      if (Array.isArray(ficha.relevancia_clinica) && ficha.relevancia_clinica.length) {
        cuerpo.append(seccion('Relevancia clínica', h('ul', {}, ficha.relevancia_clinica.map((t) => h('li', { text: t })))));
      }
      if (ficha.perla) cuerpo.append(h('aside', { class: 'f-perla' }, h('h3', { text: 'Perla' }), h('p', { text: ficha.perla })));
      const fuentes = (ficha.fuentes || []).filter((f) => urlSegura(f.url));
      if (fuentes.length) {
        cuerpo.append(seccion('Fuentes', h('ul', { class: 'f-fuentes' }, fuentes.map((f) =>
          h('li', {}, h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', text: f.titulo || f.url }))))));
      }
      if (ficha.revisado) cuerpo.append(h('p', { class: 'f-revisado', text: 'Revisado: ' + ficha.revisado }));
      if (ficha.contrastado === false) cuerpo.append(h('p', { class: 'f-revisado f-sin-contraste', text: 'Redactada con conocimiento general; sin contraste línea por línea con la fuente.' }));
    }

    raiz.append(h('div', { class: 'hoja-asa', 'data-asa': '' }), cab, acciones, cuerpo);
    raiz.scrollTop = 0;
    cuerpo.scrollTop = 0;
    actualizarBotones();
  }

  function actualizarBotones() {
    const sel = app.seleccion.actual();
    if (!sel || !paneles.ocultar) return;
    const e = app.diseccion.estado;
    const oculta = e.ocultas.has(sel.id);
    paneles.ocultar.querySelector('span:last-child').textContent = oculta ? 'Mostrar' : 'Ocultar';
    paneles.ocultar.setAttribute('aria-label', oculta ? 'Mostrar la estructura' : 'Ocultar la estructura');
    paneles.aislar.setAttribute('aria-pressed', String(e.aislada === sel.id));
    paneles.transparente.setAttribute('aria-pressed', String(e.transparentes.has(sel.id)));
  }

  bus.on('seleccion', pintar);
  bus.on('fichas-cargadas', pintar);
  bus.on('diseccion', actualizarBotones);
  estadoVacio();

  return { pintar };
}
