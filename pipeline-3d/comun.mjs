// Utilidades compartidas del pipeline
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(DIR, '..');
export const CRUDO = path.join(DIR, 'crudo');
export const INTER = path.join(DIR, 'intermedio');
// Con PAULA_STAGE=1 todo se escribe en intermedio/stage/app y 'publicar' lo copia de una vez a app/ (la app puede estar abierta)
export const APP = process.env.PAULA_STAGE ? path.join(DIR, 'intermedio', 'stage', 'app') : path.join(RAIZ, 'app');
export const MODELOS = path.join(APP, 'modelos');
export const DATOS = path.join(APP, 'datos');
export const CAPTURAS = path.join(DIR, 'capturas');

export const FBX = [
  { archivo: 'SkeletalSystem100', bytes: 41339660, sha: '294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea' },
  { archivo: 'MuscularSystem100', bytes: 37343180, sha: '4c19df534d5d84aabbce08604306aa0485b43e8a2483c72a95b569e1dfea2279' },
  { archivo: 'CardioVascular41', bytes: 64889388, sha: 'ed7d049117cc944a8c47a416b16ade642cbd1392bbcce3c677450d3234dbf680' },
  { archivo: 'NervousSystem100', bytes: 53887724, sha: '3ea1aad64956cad27348a27b8fb50494b7cc307c6bc77bee0810ec2a67dff2b1' },
  { archivo: 'VisceralSystem100', bytes: 18401708, sha: '22b301c93327929c9a14ee582d1848b550a950376e221a6d1078c7256bb83d0e' },
  { archivo: 'Joints100', bytes: 9804796, sha: 'f4ba7a910cdaef99e31530f368628780d9f06b5d77853f8b721f47f67137e823' },
  { archivo: 'LymphoidOrgans100', bytes: 2130876, sha: '310ff82f502f4f3a79e85f99ddc2009bba9514338119af9edff87b20cf1b3609' },
  { archivo: 'Regions_of_human_body100', fichero: 'Regions of human body100', bytes: 4433260, sha: '9d8da01d4719f9a61ee6ccfcaef85f788c4c67e9bcd74f5725c6946ab8b44199' },
];
export const TA2 = { fichero: 'TA2.csv', bytes: 1510396, sha: '0f9092a328b27dcd15d696d9f9a4087deb229a1aad21b75876657622de835974' };
export const COMMIT_Z = '6c7f9016bd5899ac8edafd31b9900c151df42ed6';
export const COMMIT_TA2 = 'dd72c25bb57e47f8baf0333c3a926fb4ec8172fd';

export const leerJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const escribirJSON = (p, o, ind) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, ind)); };

export function norm(s) { return s.replace(/_/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
export function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

// Sistemas en orden, con color
export const SISTEMAS = [
  { id: 'oseo', nombre: 'Sistema óseo', color: '#E8DCC4', orden: 1, opcional: false, visible_inicio: true, tope: 3.0e6 },
  { id: 'piel', nombre: 'Piel y regiones del cuerpo', color: '#D8B49A', orden: 2, opcional: false, visible_inicio: true, tope: 0.8e6 },
  { id: 'articular', nombre: 'Sistema articular', color: '#9FB8C9', orden: 3, opcional: false, visible_inicio: false, tope: 1.0e6 },
  { id: 'muscular', nombre: 'Sistema muscular', color: '#B5523B', orden: 4, opcional: false, visible_inicio: false, tope: 4.0e6 },
  { id: 'cardiovascular', nombre: 'Sistema cardiovascular', color: '#C8323C', orden: 5, opcional: false, visible_inicio: false, tope: 3.5e6 },
  { id: 'nervioso', nombre: 'Sistema nervioso', color: '#E8C547', orden: 6, opcional: false, visible_inicio: false, tope: 4.0e6 },
  { id: 'linfatico', nombre: 'Sistema linfático', color: '#7FB77E', orden: 7, opcional: false, visible_inicio: false, tope: 0.6e6 },
  { id: 'digestivo', nombre: 'Sistema digestivo', color: '#D99A6C', orden: 8, opcional: false, visible_inicio: false, tope: null },
  { id: 'respiratorio', nombre: 'Sistema respiratorio', color: '#E3A0A8', orden: 9, opcional: false, visible_inicio: false, tope: null },
  { id: 'urinario', nombre: 'Sistema urinario', color: '#C9B458', orden: 10, opcional: false, visible_inicio: false, tope: null },
  { id: 'reproductor', nombre: 'Sistema reproductor', color: '#B07AA1', orden: 11, opcional: false, visible_inicio: false, tope: null },
  { id: 'endocrino', nombre: 'Sistema endocrino', color: '#8E6CC0', orden: 12, opcional: false, visible_inicio: false, tope: null },
  { id: 'inserciones', nombre: 'Orígenes e inserciones musculares', color: '#D24B4B', orden: 13, opcional: true, visible_inicio: false, tope: 1.2e6 },
];
