// Utilidades de texto: normalización sin tildes y formatos en español.

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatoMB(bytes) {
  const mb = (Number(bytes) || 0) / 1e6;
  return mb.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
}

export function textoLado(lado) {
  return lado === 'derecho' ? 'derecho' : lado === 'izquierdo' ? 'izquierdo' : '';
}

export function colorSeguro(c, porDefecto = '#999999') {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : porDefecto;
}
