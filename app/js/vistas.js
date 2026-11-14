// Vistas rápidas: anterior (+Z), posterior, derecha del paciente (-X), izquierda (+X) y superior.
import * as THREE from 'three';
import { DIRECCIONES } from './escena.js';

export function crearVistas(app) {
  const { escena } = app;

  function encuadre() {
    const caja = app.separar ? app.separar.caja() : app.sistemas.cuerpoBox; // incluye las piezas separadas
    const centro = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());
    // Se encuadra por alto y por ancho; la profundidad del cuerpo se suma a la distancia.
    const ancho = Math.max(tam.x, tam.z) / 2;
    return { centro, distancia: escena.distanciaParaCaja(Math.max(ancho, 0.1), Math.max(tam.y / 2, 0.3), ancho * 0.5) };
  }

  function ir(nombre, duracion = 350) {
    const dir = DIRECCIONES[nombre];
    if (!dir) return false;
    const { centro, distancia } = encuadre();
    escena.irA({ objetivo: centro, distancia, direccion: dir, duracion });
    return true;
  }

  return { ir, encuadre, nombres: Object.keys(DIRECCIONES) };
}
