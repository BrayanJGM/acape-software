// AUDITORIA DE COHERENCIA DE CLIENTES
// Compara, para cada cliente, lo que el Excel suma (ventas) contra lo que el popup
// suma (compras) y reporta las compras que quedaron apuntando a ventas inexistentes.
//
//   node services/auditar-clientes.js              -> solo lectura (no escribe nada)
//   node services/auditar-clientes.js --json       -> salida JSON para procesar
//   node services/auditar-clientes.js --base=./copia  -> audita otra base
//
// Ejecutar desde la raiz del repo. La capa de datos solo acepta rutas relativas
// (getData antepone "./"), por eso --base es relativo al directorio actual.
//
// Exit code: 0 si todo cuadra, 1 si hay inconsistencias.

const path = require('path');
const Database = require(path.join(__dirname, '..', 'APIS', 'realtime-db-json.js'));

const argBase = process.argv.find(a => a.startsWith('--base='));
const BASE = argBase ? argBase.slice(7) : './system';
const COMO_JSON = process.argv.includes('--json');

function aArreglo(o) {
  if (!o) return [];
  if (Array.isArray(o)) return o;
  return Object.keys(o)
    .filter(k => /^\d+$/.test(k))
    .sort((x, y) => Number(x) - Number(y))
    .map(k => o[k]);
}

const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const money = n => r2(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function main() {
  const db = new Database(BASE);

  const ventasIds = new Set();
  const ventasPorCliente = new Map();
  const ventaFecha = new Map();

  for (const v of aArreglo(db.getData('/data/simple/ventas'))) {
    if (!v || v.id == null) continue;
    ventasIds.add(String(v.id));
    ventaFecha.set(String(v.id), Number(v.date || 0));
    const cid = v.clienteId != null && v.clienteId !== '' ? v.clienteId : v.deudorId;
    if (cid == null || cid === '') continue;
    const k = String(cid);
    ventasPorCliente.set(k, (ventasPorCliente.get(k) || 0) + Number(v.total_pago || 0));
  }

  const clientesIds = aArreglo(db.getData('/data/simple/clientes'))
    .map(c => c && c.id)
    .filter(v => v != null)
    .map(String);

  const filas = [];
  const huerfanas = [];
  const duplicadas = [];

  for (const cid of clientesIds) {
    const c = db.getData('/data/simple/clientes/' + cid);
    if (!c) continue;

    const compras = aArreglo(c.compras);
    const porVentaId = new Map();
    for (const comp of compras) {
      const vid = String(comp.ventaId);
      if (porVentaId.has(vid)) {
        duplicadas.push({ cliente: cid, clienteNombre: c.name, ventaId: vid, total: Number(comp.total || 0) });
      }
      porVentaId.set(vid, (porVentaId.get(vid) || 0) + Number(comp.total || 0));
    }

    for (const comp of compras) {
      const vid = String(comp.ventaId);
      if (!ventasIds.has(vid)) {
        huerfanas.push({ cliente: cid, clienteNombre: c.name, ventaId: vid, total: Number(comp.total || 0) });
      }
    }

    const totalCompras = compras.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalVentas = ventasPorCliente.get(cid) || 0;
    const dif = r2(totalCompras - totalVentas);

    if (Math.abs(dif) >= 0.01 || huerfanas.some(h => h.cliente === cid) || duplicadas.some(d => d.cliente === cid)) {
      filas.push({
        cliente: cid,
        nombre: c.name || '(sin nombre)',
        totalVentas: r2(totalVentas),
        totalCompras: r2(totalCompras),
        diferencia: dif,
        cantVentas: compras.length,
        huerfanas: huerfanas.filter(h => h.cliente === cid).length,
        duplicadas: duplicadas.filter(d => d.cliente === cid).length
      });
    }
  }

  if (COMO_JSON) {
    console.log(JSON.stringify({ filas, huerfanas, duplicadas }, null, 2));
    return filas.length ? 1 : 0;
  }

  console.log('Base de datos:', BASE);
  console.log('Ventas leidas :', ventasIds.size);
  console.log('Clientes     :', clientesIds.length);
  console.log('');

  if (!filas.length) {
    console.log('OK: todos los clientes cuadran. Compras == Ventas, sin huerfanas ni duplicadas.');
    return 0;
  }

  console.log('CLIENTES QUE NO CUADRAN');
  console.log('');
  for (const f of filas.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))) {
    console.log(`  [${f.cliente}] ${f.nombre}`);
    console.log(`      ventas  ${money(f.totalVentas)}   compras ${money(f.totalCompras)}`);
    console.log(`      diferencia ${money(f.diferencia)}  (${f.cantVentas} compras, ${f.huerfanas} huerfanas, ${f.duplicadas} duplicadas)`);
  }

  if (huerfanas.length) {
    console.log('');
    console.log('COMPRAS SIN VENTA CORRESPONDIENTE (aparecen en el popup, no en el Excel)');
    for (const h of huerfanas.slice(0, 100)) {
      console.log(`  cliente ${h.cliente} (${h.clienteNombre}) venta #${h.ventaId}  $ ${money(h.total)}`);
    }
    if (huerfanas.length > 100) console.log(`  ... y ${huerfanas.length - 100} mas`);
  }

  if (duplicadas.length) {
    console.log('');
    console.log('VENTAS REPETIDAS DENTRO DEL HISTORIAL DE COMPRAS');
    for (const d of duplicadas.slice(0, 100)) {
      console.log(`  cliente ${d.cliente} (${d.clienteNombre}) venta #${d.ventaId}  $ ${money(d.total)}`);
    }
    if (duplicadas.length > 100) console.log(`  ... y ${duplicadas.length - 100} mas`);
  }

  return 1;
}

process.exit(main());
