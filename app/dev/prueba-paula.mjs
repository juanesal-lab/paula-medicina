// Prueba sin navegador de js/paula.js: tiene_ficha correcto tras paulaApp.seleccionar() aunque las
// fichas terminen de cargar después de la selección, y texto de la pregunta.
// Uso: node app/dev/prueba-paula.mjs
import { crearBus } from '../js/util/bus.js';
import { crearPaula } from '../js/paula.js';

globalThis.window = globalThis;
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FALLA ') + msg); if (!cond) fallos++; };

const est = { id: 'femur_d', nombre_es: 'Fémur', nombre_la: 'Os femoris', sistema: 'oseo', lado: 'derecho', ta2: '1360' };
const sinFicha = { id: 'x_d', nombre_es: 'Otra', nombre_la: null, sistema: 'oseo', lado: null, ta2: '999999' };
const bus = crearBus();
let resolver;
const app = {
  bus,
  fichas: new Map(),
  fichasListas: new Promise((r) => { resolver = r; }),
  datos: { sistemaPorId: new Map([['oseo', { id: 'oseo', nombre: 'Sistema óseo' }]]), porId: new Map([[est.id, est], [sinFicha.id, sinFicha]]) },
};
let actual = null;
app.seleccion = {
  actual: () => actual,
  seleccionar: async (id) => {
    const e = app.datos.porId.get(id); if (!e) return false;
    actual = { id, est: e, rec: {} }; bus.emit('seleccion', actual); return true;
  },
};
crearPaula(app);

// Las fichas llegan 50 ms después de la selección (como en el arranque real).
setTimeout(() => { app.fichas = new Map([['ta2:1360', { nombre_es: 'Fémur' }]]); bus.emit('fichas-cargadas', 1); resolver(1); }, 50);

const r = await window.paulaApp.seleccionar('femur_d');
ok(r === true, 'seleccionar devuelve true');
ok(window.paulaSelection && window.paulaSelection.tiene_ficha === true, 'tiene_ficha es true al resolver seleccionar (fichas cargadas después)');
ok(window.paulaSelection.pregunta.startsWith('/paula Estoy en la app de anatomía viendo: Fémur (Os femoris) — Sistema óseo, lado derecho.'), 'la pregunta empieza por /paula y usa la plantilla');
const r2 = await window.paulaApp.seleccionar('x_d');
ok(r2 === true && window.paulaSelection.tiene_ficha === false, 'sin ficha => tiene_ficha false');
ok(await window.paulaApp.seleccionar('no_existe') === false, 'id inexistente => false sin excepción');
ok(await window.paulaApp.seleccionar(42) === false, 'id no textual => false');

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodas las pruebas pasaron');
process.exit(fallos ? 1 : 0);
