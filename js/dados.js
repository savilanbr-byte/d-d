// Tiradas de dados para el banco de PNJ y la salud aproximada que ve la mesa.

const d = (caras) => 1 + Math.floor(Math.random() * caras);

// Bono escrito como "+4", "4", "−1"… Devuelve null si no hay un número (p. ej. "CD 13").
export function bonoNum(t) {
  const m = String(t ?? '').replace('−', '-').match(/^\s*([+-]?\s*\d+)\s*$/);
  return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null;
}

// Primer modificador que aparezca en un texto ("+2", "Iniciativa +3 (13)") o 0
export function modDe(t) {
  const m = String(t ?? '').replace('−', '-').match(/[+-]?\s*\d+/);
  return m ? parseInt(m[0].replace(/\s/g, ''), 10) : 0;
}

// d20 con ventaja o desventaja
export function tirarD20(modo = 'normal') {
  const a = d(20); const b = modo === 'normal' ? null : d(20);
  const nat = b == null ? a : modo === 'ventaja' ? Math.max(a, b) : Math.min(a, b);
  return { nat, dados: b == null ? [a] : [a, b] };
}

// Tira una expresión de daño o libre: "1d8 + 2 cortante", "2d6+1d4", "3".
// Con critico, se tiran el doble de dados (los modificadores no se duplican).
// Devuelve null si no hay dados ni números.
export function tirarExpr(texto, critico = false) {
  const t = String(texto ?? '').replace(/[−–]/g, '-');
  const re = /([+-])?\s*(\d*)\s*[dD](\d+)|([+-])\s*(\d+)(?!\s*[dD\d])/g;
  let total = 0; const partes = []; let hay = false; let m;
  while ((m = re.exec(t))) {
    if (m[3]) {
      const signo = m[1] === '-' ? -1 : 1;
      const n = Math.min(100, (parseInt(m[2], 10) || 1) * (critico ? 2 : 1)); const caras = Math.min(1000, +m[3]);
      if (!caras) continue;
      const tiradas = Array.from({ length: n }, () => d(caras));
      const suma = tiradas.reduce((a, b) => a + b, 0);
      total += signo * suma; hay = true;
      partes.push(`${signo < 0 ? '− ' : partes.length ? '+ ' : ''}${n}d${caras} [${tiradas.join(', ')}]`);
    } else if (m[5]) {
      const v = (m[4] === '-' ? -1 : 1) * +m[5];
      total += v; hay = true;
      partes.push(`${v < 0 ? '−' : '+'} ${Math.abs(v)}`);
    }
  }
  if (!hay) {
    const solo = t.match(/^\s*(\d+)/);
    if (!solo) return null;
    return { total: +solo[1], detalle: solo[1] };
  }
  return { total: Math.max(0, total), detalle: partes.join(' ') };
}

// Promedio de una expresión de dados ("2d8+2" → 11), para los PV de una plantilla
export function promedio(texto) {
  const t = String(texto ?? '').replace(/[−–]/g, '-');
  const re = /([+-])?\s*(\d*)\s*[dD](\d+)|([+-])\s*(\d+)(?!\s*[dD\d])/g;
  let total = 0; let hay = false; let m;
  while ((m = re.exec(t))) {
    if (m[3]) { total += (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) || 1) * ((+m[3] + 1) / 2); hay = true; }
    else if (m[5]) { total += (m[4] === '-' ? -1 : 1) * +m[5]; hay = true; }
  }
  return hay ? Math.max(1, Math.floor(total)) : null;
}

// Lo que la mesa muestra de la salud de un PNJ, sin números
export function saludAprox(pv, max) {
  if (!(max > 0)) return null;
  if (pv <= 0) return { clase: 'caido', texto: 'Derrotado' };
  const r = pv / max;
  if (r >= 1) return { clase: 'ileso', texto: 'Ileso' };
  if (r > 0.5) return { clase: 'herido', texto: 'Herido' };
  if (r > 0.25) return { clase: 'malherido', texto: 'Malherido' };
  return { clase: 'apunto', texto: 'A punto de caer' };
}
