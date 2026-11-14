// Hooks de Node que imitan el importmap de index.html: "three" -> vendor/three/three.module.js.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const VENDOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'three');

export async function resolve(especificador, contexto, siguiente) {
  if (especificador === 'three') return { url: pathToFileURL(path.join(VENDOR, 'three.module.js')).href, shortCircuit: true };
  if (especificador.startsWith('three/addons/')) {
    return { url: pathToFileURL(path.join(VENDOR, 'addons', especificador.slice('three/addons/'.length))).href, shortCircuit: true };
  }
  return siguiente(especificador, contexto);
}
