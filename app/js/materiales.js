// Materiales compartidos por sistema, plano de corte único y fábrica de variantes.
// Aspecto esquemático: color plano. Aspecto realista: texturas PBR por tejido con mapeo triplanar.
import * as THREE from 'three';

export const ACENTO = '#B3261E';
export const OPACIDAD_TRANSPARENTE = 0.25;
export const OPACIDAD_CONTEXTO = 0.1;
export const OPACIDAD_PIEL = 0.35;
export const OPACIDAD_PELICULA = 0.15; // fascias de revestimiento en aspecto realista (el valor real sale de tejidos.json)
export const OPACIDAD_PELICULA_RESALTADA = 0.4;
export const INTENSIDAD_RESALTE = 0.35;
export const OSCURECER_CARA_TRASERA = 0.45; // las caras traseras conservan el 45 % (se oscurecen un 55 %)
export const NITIDEZ_TRIPLANAR = 4; // exponente de la mezcla por la normal (más alto = transiciones más cortas)

// Colores por subsistema (el resto usa el color del sistema, de sistemas.json).
export const COLOR_SUBSISTEMA = {
  cardiovascular: { venas: '#3B5BA9' },
  inserciones: { origen: '#D24B4B', insercion: '#4B7BD2' },
};

// Plano de corte compartido por todos los materiales. Sin corte: constante enorme (nada se recorta).
export const planoCorte = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);

function parcheCaraTrasera(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `#include <opaque_fragment>\n\tgl_FragColor.rgb *= ( gl_FrontFacing ? 1.0 : ${OSCURECER_CARA_TRASERA.toFixed(2)} );`,
  );
}

// ---------------------------------------------------------------------------------------------
// Mapeo triplanar
// ---------------------------------------------------------------------------------------------
// Las mallas de Z-Anatomy/BodyParts3D no tienen UV fiables, así que albedo, normal y rugosidad se
// proyectan sobre tres planos en coordenadas de MUNDO (metros reales del modelo) y se mezclan por la
// normal. Cada tejido tiene un "marco" (a, f, b): sin fibras es el marco del mundo (a=X, f=Y, b=Z); con
// fibras (musculo, tendon, nervio, cerebelo) f es el eje largo de la malla (atributo aFibra, ver
// tejidos.js) y la textura se orienta para que sus fibras verticales sigan ese eje.
// Las coordenadas de mundo sirven porque las mallas son estáticas (matrixAutoUpdate = false).

// Los uniformes de un tejido son UN solo conjunto compartido por todos sus materiales: al terminar de
// descargar las texturas basta con cambiar `.value` aquí y todos los materiales lo ven.
let _neutras = null;
function texturasNeutras() {
  if (!_neutras) {
    const t = (r, g, b, srgb) => {
      const d = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
      d.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      d.needsUpdate = true;
      return d;
    };
    _neutras = { albedo: t(255, 255, 255, true), normal: t(128, 128, 255, false), rugosidad: t(255, 255, 255, false) };
  }
  return _neutras;
}

// def: {escala_m, normal, rugosidad, variacion, brillo}
export function crearUniformesTejido(def = {}) {
  const n = texturasNeutras();
  return {
    uTriAlbedo: { value: n.albedo },
    uTriNormal: { value: n.normal },
    uTriRug: { value: n.rugosidad },
    uTriFrec: { value: 1 / Math.max(def.escala_m || 0.1, 1e-4) }, // repeticiones por metro
    uTriListo: { value: 0 }, // 0 = aún sin texturas (se ve el color plano); 1 = texturas listas
    uTriNormalK: { value: def.normal ?? 1 },
    uTriRugMul: { value: def.rugosidad ?? 1 },
    uTriVar: { value: def.variacion ?? 0.1 },
    uTriBrillo: { value: def.brillo ?? 1 }, // ganancia del albedo (equilibra la luminancia entre tejidos)
    uTriNitidez: { value: NITIDEZ_TRIPLANAR },
  };
}

const DECL_UNIFORMES = `
uniform sampler2D uTriAlbedo;
uniform sampler2D uTriNormal;
uniform sampler2D uTriRug;
uniform float uTriFrec;
uniform float uTriListo;
uniform float uTriNormalK;
uniform float uTriRugMul;
uniform float uTriVar;
uniform float uTriBrillo;
uniform float uTriNitidez;
`;

const VERTEX_DECL = `
#ifdef TRI_FIBRAS
attribute vec4 aFibra;
#endif
varying vec3 vTriW;
varying vec3 vTriF;
`;

const VERTEX_CUERPO = `
vTriW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#ifdef TRI_FIBRAS
float triLong = length( aFibra.xyz );
vTriF = triLong > 0.01 ? aFibra.xyz / triLong : vec3( 0.0, 1.0, 0.0 );
#else
vTriF = vec3( 0.0, 1.0, 0.0 );
#endif
`;

const FRAG_DECL = `
varying vec3 vTriW;
varying vec3 vTriF;
${DECL_UNIFORMES}
float triHash( vec3 p ) {
  p = fract( p * 0.3183099 + vec3( 0.1, 0.2, 0.3 ) );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float triRuido( vec3 x ) {
  vec3 i = floor( x ); vec3 f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( triHash( i ), triHash( i + vec3( 1, 0, 0 ) ), f.x ),
                   mix( triHash( i + vec3( 0, 1, 0 ) ), triHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( triHash( i + vec3( 0, 0, 1 ) ), triHash( i + vec3( 1, 0, 1 ) ), f.x ),
                   mix( triHash( i + vec3( 0, 1, 1 ) ), triHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
`;

// Tras map_fragment: marco, pesos, albedo y rugosidad triplanares.
const FRAG_ALBEDO = `
vec3 triF = normalize( vTriF );
vec3 triRef = abs( triF.z ) < 0.9 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
vec3 triA = normalize( cross( triF, triRef ) );
vec3 triB = cross( triA, triF );
vec3 triNw = inverseTransformDirection( normalize( vNormal ), viewMatrix );
vec3 triN = vec3( dot( triNw, triA ), dot( triNw, triF ), dot( triNw, triB ) );
vec3 triP = vec3( dot( vTriW, triA ), dot( vTriW, triF ), dot( vTriW, triB ) ) * uTriFrec;
vec3 triPeso = pow( abs( triN ), vec3( uTriNitidez ) );
triPeso /= max( triPeso.x + triPeso.y + triPeso.z, 1e-5 );
vec2 triUvX = triP.zy;
vec2 triUvY = triP.xz;
vec2 triUvZ = triP.xy;
vec3 triAlb = texture2D( uTriAlbedo, triUvX ).rgb * triPeso.x
            + texture2D( uTriAlbedo, triUvY ).rgb * triPeso.y
            + texture2D( uTriAlbedo, triUvZ ).rgb * triPeso.z;
float triRug = texture2D( uTriRug, triUvX ).r * triPeso.x
             + texture2D( uTriRug, triUvY ).r * triPeso.y
             + texture2D( uTriRug, triUvZ ).r * triPeso.z;
float triVar = 1.0 + ( triRuido( triP * 0.37 ) - 0.5 ) * 2.0 * uTriVar; // rompe la repetición visible del mosaico
diffuseColor.rgb = mix( diffuseColor.rgb, triAlb * triVar * uTriBrillo, uTriListo );
`;

const FRAG_ROUGH = `
roughnessFactor = mix( roughnessFactor, clamp( triRug * uTriRugMul, 0.05, 1.0 ), uTriListo );
`;

// Tras normal_fragment_maps: mezcla "whiteout" de los tres mapas de normales (convención OpenGL).
const FRAG_NORMAL = `
if ( uTriListo > 0.5 ) {
  vec3 triTX = texture2D( uTriNormal, triUvX ).xyz * 2.0 - 1.0;
  vec3 triTY = texture2D( uTriNormal, triUvY ).xyz * 2.0 - 1.0;
  vec3 triTZ = texture2D( uTriNormal, triUvZ ).xyz * 2.0 - 1.0;
  triTX.xy *= uTriNormalK; triTY.xy *= uTriNormalK; triTZ.xy *= uTriNormalK;
  vec3 triNg = inverseTransformDirection( normal, viewMatrix ); // normal geométrica ya volteada en caras traseras
  vec3 triNf = vec3( dot( triNg, triA ), dot( triNg, triF ), dot( triNg, triB ) );
  triTX = vec3( triTX.xy + triNf.zy, abs( triTX.z ) * triNf.x );
  triTY = vec3( triTY.xy + triNf.xz, abs( triTY.z ) * triNf.y );
  triTZ = vec3( triTZ.xy + triNf.xy, abs( triTZ.z ) * triNf.z );
  vec3 triPf = normalize( triTX.zyx * triPeso.x + triTY.xzy * triPeso.y + triTZ.xyz * triPeso.z );
  vec3 triPw = triA * triPf.x + triF * triPf.y + triB * triPf.z;
  normal = normalize( ( viewMatrix * vec4( triPw, 0.0 ) ).xyz );
}
`;

// Parche triplanar; se llama con el shader de onBeforeCompile. `tej` = {uniformes, fibras}.
export function parcheTriplanar(shader, tej) {
  for (const k of Object.keys(tej.uniformes)) shader.uniforms[k] = tej.uniformes[k];
  let vs = shader.vertexShader;
  vs = (tej.fibras ? '#define TRI_FIBRAS\n' : '') + vs;
  vs = vs.replace('#include <common>', `#include <common>\n${VERTEX_DECL}`);
  vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_CUERPO}`);
  shader.vertexShader = vs;
  let fs = shader.fragmentShader;
  fs = fs.replace('#include <common>', `#include <common>\n${FRAG_DECL}`);
  fs = fs.replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_ALBEDO}`);
  fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`);
  fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  shader.fragmentShader = fs;
}

// cfg: {color, roughness, opacity, emissive, emisividad, esPiel, pelicula, tejido?}
// cfg.pelicula: película translúcida (fascia de revestimiento en aspecto realista): nunca escribe profundidad.
// cfg.tejido (opcional) = {id, uniformes, fibras}: activa el mapeo triplanar con las texturas del tejido.
export function crearMaterial(cfg) {
  const opacity = cfg.opacity ?? 1;
  const transparente = opacity < 1;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.color),
    roughness: cfg.roughness ?? 0.62,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: transparente || !!cfg.pelicula,
    opacity,
    depthWrite: !transparente && !cfg.pelicula,
    clippingPlanes: [planoCorte],
  });
  if (cfg.emissive) {
    m.emissive = new THREE.Color(cfg.emissive);
    m.emissiveIntensity = cfg.emisividad ?? INTENSIDAD_RESALTE;
  }
  if (cfg.esPiel) m.userData.esPiel = true;
  if (cfg.pelicula) m.userData.pelicula = true;
  m.userData.cfg = { ...cfg };
  const tej = cfg.tejido || null;
  if (tej) {
    m.userData.tejido = tej.id;
    m.onBeforeCompile = (shader) => { parcheCaraTrasera(shader); parcheTriplanar(shader, tej); };
    m.customProgramCacheKey = () => 'paula-tri-v2' + (tej.fibras ? '-fib' : '');
  } else {
    m.onBeforeCompile = parcheCaraTrasera;
    m.customProgramCacheKey = () => 'paula-cara-trasera-v1';
  }
  return m;
}

// Variante de un material base: mismo color y rugosidad, otra opacidad y/o emisión.
export function variante(base, cambios) {
  return crearMaterial({ ...base.userData.cfg, ...cambios });
}

// Material compartido de "contexto" (aislamiento con el resto al 10 %), uno por material base.
export function materialContexto(base) {
  if (!base.userData.contexto) {
    base.userData.contexto = variante(base, { opacity: OPACIDAD_CONTEXTO, emissive: null });
  }
  return base.userData.contexto;
}

export function liberar(material) {
  if (material && material.userData && material.userData.propio) material.dispose();
}
