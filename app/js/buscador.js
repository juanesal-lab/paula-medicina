// Índice en memoria sobre nombre_es, nombre_la y nombre_en (normalizados) y ranking de resultados.
import { normalizar, colorSeguro } from './util/texto.js';
import { h, vaciar } from './util/dom.js';

// Rangos: 0 igual, 1 empieza por, 2 una palabra empieza por, 3 contiene, 4 todas las palabras aparecen.
function rangoDe(campo, consulta, tokens) {
  if (!campo) return 99;
  if (campo === consulta) return 0;
  if (campo.startsWith(consulta)) return 1;
  if (campo.includes(' ' + consulta) || campo.includes('-' + consulta)) return 2;
  if (campo.includes(consulta)) return 3;
  if (tokens.length > 1 && tokens.every((t) => campo.includes(t))) return 4;
  return 99;
}

export function crearBuscador(app) {
  const entradas = app.datos.estructuras.map((e) => ({
    est: e,
    es: normalizar(e.nombre_es),
    la: normalizar(e.nombre_la),
    en: normalizar(e.nombre_en),
  }));

  function buscar(texto, max = 20) {
    const q = normalizar(texto);
    if (!q) return [];
    const tokens = q.split(' ').filter(Boolean);
    const res = [];
    for (const x of entradas) {
      const r = Math.min(rangoDe(x.es, q, tokens), rangoDe(x.la, q, tokens), rangoDe(x.en, q, tokens));
      if (r < 99) res.push({ x, r });
    }
    // Los marcadores de origen/inserción son un sistema opcional: van después de la estructura real.
    const aux = (y) => (y.x.est.sistema === 'inserciones' ? 1 : 0);
    res.sort((a, b) => aux(a) - aux(b)
      || a.r - b.r
      || a.x.es.length - b.x.es.length
      || a.x.es.localeCompare(b.x.es, 'es')
      || (a.x.est.lado === 'derecho' ? -1 : 1) - (b.x.est.lado === 'derecho' ? -1 : 1));
    return res.slice(0, max).map(({ x }) => x.est);
  }

  // Resultado para la API pública: {id, nombre, sistema}
  function buscarAPI(texto) {
    return buscar(texto, 20).map((e) => ({ id: e.id, nombre: nombreCompleto(e), sistema: e.sistema }));
  }

  function nombreCompleto(e) {
    // Algunos nombres ya traen el lado dentro (p. ej. segmentos hepáticos, bronquios): no se repite.
    return e.nombre_es + (e.lado && !e.nombre_es.toLowerCase().includes(e.lado) ? ' ' + e.lado : '');
  }

  // ---- interfaz del cuadro de búsqueda ----
  function montar(input, lista) {
    let resultados = [];
    let activo = -1;

    function cerrar() {
      lista.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activo = -1;
    }
    function marcarActivo(i) {
      activo = i;
      [...lista.children].forEach((li, k) => {
        const on = k === i;
        li.setAttribute('aria-selected', on ? 'true' : 'false');
        li.classList.toggle('activo', on);
        if (on) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      });
    }
    function elegir(i) {
      const e = resultados[i];
      if (!e) return;
      cerrar();
      input.blur();
      input.value = '';
      app.seleccion.seleccionar(e.id, { enfocar: true });
    }
    function pintar() {
      vaciar(lista);
      if (!resultados.length) {
        const q = input.value.trim();
        lista.append(h('li', { class: 'sin-resultados', role: 'presentation', text: q ? `Sin resultados para «${q}»` : '' }));
        lista.hidden = !q;
        activo = -1;
        return;
      }
      resultados.forEach((e, i) => {
        const sis = app.datos.sistemaPorId.get(e.sistema);
        const li = h('li', { id: 'res-' + i, role: 'option', 'aria-selected': 'false' },
          h('span', { class: 'chip-color', style: `background:${colorSeguro(sis?.color)}`, 'aria-hidden': 'true' }),
          h('span', { class: 'res-texto' },
            h('span', { class: 'res-nombre', text: e.nombre_es }),
            e.nombre_la ? h('span', { class: 'res-latin', text: e.nombre_la }) : null),
          h('span', { class: 'res-meta', text: [e.lado, sis?.nombre?.replace(/^Sistema /, '')].filter(Boolean).join(' · ') }));
        li.addEventListener('pointerdown', (ev) => ev.preventDefault()); // no pierde el foco antes del clic
        li.addEventListener('click', () => elegir(i));
        lista.append(li);
      });
      lista.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      marcarActivo(0);
    }

    input.addEventListener('input', () => {
      resultados = buscar(input.value, 12);
      pintar();
    });
    input.addEventListener('focus', () => { if (input.value.trim()) { resultados = buscar(input.value, 12); pintar(); } });
    input.addEventListener('blur', () => setTimeout(cerrar, 120));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (resultados.length) marcarActivo((activo + 1) % resultados.length); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (resultados.length) marcarActivo((activo - 1 + resultados.length) % resultados.length); }
      else if (ev.key === 'Enter') { ev.preventDefault(); elegir(Math.max(activo, 0)); }
      else if (ev.key === 'Escape') { ev.preventDefault(); if (input.value) { input.value = ''; cerrar(); } else input.blur(); }
    });
    // "/" enfoca el buscador desde cualquier parte (salvo si ya se escribe en un campo).
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      ev.preventDefault();
      input.focus();
      input.select();
    });
  }

  return { buscar, buscarAPI, montar, nombreCompleto };
}
