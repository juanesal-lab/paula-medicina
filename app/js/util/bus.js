// Bus de eventos mínimo para desacoplar módulos.

export function crearBus() {
  const mapa = new Map();
  return {
    on(nombre, fn) {
      if (!mapa.has(nombre)) mapa.set(nombre, new Set());
      mapa.get(nombre).add(fn);
      return () => mapa.get(nombre).delete(fn);
    },
    emit(nombre, datos) {
      const set = mapa.get(nombre);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(datos); } catch (e) { console.error('[paula] error en manejador de', nombre, e); }
      }
    },
  };
}
