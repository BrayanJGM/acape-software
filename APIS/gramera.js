// SERVICIO DE LECTURA DE GRAMERA (BALANZA) POR PUERTO SERIAL
// Protocolos soportados:
//   - Trumax WT/NT/GS (ST/US/OL + peso ASCII + unidad)
//   - Trumax ONIX III PRO (ACS-30E): tramas hexaadecimales 0x30-0x39 con
//     numero de chequeo EAN-13 y cierre 0D 0A (STX 0x02 + Adr + campos)
const { SerialPort } = require('serialport');
const fs = require('fs');
const path = require('path');

const configsPath = path.join(__dirname, './../configs.json');

let config = loadConfig();
let port = null;
let debug = !!config.debug;

// LOGGER CONTROLADO POR LA UI: imprime SOLO si debug esta activado
const dbg = (...args) => {
  if (debug) console.log(...args);
};
let buffer = '';
let binBuffer = Buffer.alloc(0);
let ultimaTrama = null;
let ultimoBytes = Buffer.alloc(0);
let ultimaTramaHex = '';
let lastReading = null;
let lastRaw = [];
let readings = 0;
let chunks = 0;
let detectMode = false;
let autoReintento = false;
let reintentoTimer = null;
const REINTENTO_MS = 5000;

// TRAZAS: ultimas tramas completas recibidas (para diagnostico remoto)
const trazas = [];

// VALIDACION DE PESAJE: dos capturas de peso conocido para verificar el parser
const tests = [
  { id: 'test1', esperado: null, leido: null, raw: null, unidad: null, formato: null, bytes: null, hex: null, ts: null },
  { id: 'test2', esperado: null, leido: null, raw: null, unidad: null, formato: null, bytes: null, hex: null, ts: null }
];

const PATRON_PESO = /(ST|US|OL)?([+-])?(\d+\.?\d*)\s*(kg|g|t|lb)\b/i;
const PATRON_LINEA = new RegExp('^' + PATRON_PESO.source, 'i');
const BAUD_CANDIDATOS = [9600, 4800, 2400, 19200, 1200, 38400];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadConfig() {
  try {
    const configs = JSON.parse(fs.readFileSync(configsPath, 'utf8'));
    return configs.gramera || { port: 'COM3', baudRate: 9600 };
  } catch (err) {
    return { port: 'COM3', baudRate: 9600 };
  }
}

function saveConfig(nuevoConfig) {
  const configs = JSON.parse(fs.readFileSync(configsPath, 'utf8'));
  configs.gramera = nuevoConfig;
  fs.writeFileSync(configsPath, JSON.stringify(configs, null, '\t'));
}

// PARSEA UNA LINEA TIPO: "WTST+ 600.00 g", "NTST+ 000876 kg", "GSUS- 1.568 lb"
// Tambien acepta tramas continuas simples: "000.560kg", "+000.560 kg", etc.
function construirLectura(m) {
  if (!m) return null;

  const estado = m[1] ? m[1].toUpperCase() : null;
  const signo = m[2] === '-' ? '-' : '+';
  const numero = parseFloat(m[3]);
  const unidad = (m[4] || 'kg').toLowerCase();
  const valor = signo === '-' ? -numero : numero;

  let pesoKg = valor;
  if (unidad === 'g') pesoKg = valor / 1000;
  else if (unidad === 'lb') pesoKg = valor * 0.45359237;
  else if (unidad === 't') pesoKg = valor * 1000;

  return {
    peso: pesoKg,
    peso_raw: signo + String(numero),
    unidad,
    estable: estado === 'ST',
    sobrecarga: estado === 'OL'
  };
}

function parseLine(line) {
  return construirLectura(line.match(PATRON_LINEA));
}

// CALCULA EL DIGITO DE CHEQUEO EAN-13 (algoritmo GS1 que usa la Onix)
function ean13Check(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    sum += digits[i] * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

// PARSER DE LAS TRAMAS HEXADECIMALES DE LA TRUMAX ONIX III PRO (ACS-30E).
// Cada digito viaja como un byte (0x00-0x09).
// Estrategias, en orden de confianza:
//   1) TRAMA UNIFICADA (layout real validado con tramas reales): 13 bytes,
//      STX 0x02, y el ultimo byte es el chequeo EAN-13 de los 12 digitos
//      completos [0..11]. El peso son los 4 digitos de gramos en [8..11].
//   2) ANCLA FINAL (Formato 2 del manual): los ultimos 6 bytes son [W5][CK]
//      (5 digitos de peso + chequeo EAN-13 del grupo).
//   3) BARRIDO DESLIZANTE: ventanas de 5 bytes con chequeo trailing o
//      embebido, filtrando por plausibilidad (0..60 kg).
function parseOnix(buf) {
  if (!buf || buf.length < 8 || buf[0] !== 0x02) return null;

  const g = Array.from(buf);
  const esDigito = (v) => v >= 0 && v <= 9;
  const CAP = 60000;

  // 1) TRAMA UNIFICADA (layout real ACS-30E)
  if (g.length === 13 && esDigito(g[12]) && ean13Check(g.slice(0, 12)) === g[12]) {
    const w5 = g.slice(7, 12);
    if (w5.every(esDigito)) {
      const gramos = w5.reduce((acc, d) => acc * 10 + d, 0);
      if (gramos >= 0 && gramos <= CAP) {
        const pesoKg = gramos / 1000;
        return {
          peso: pesoKg,
          peso_raw: pesoKg.toFixed(3),
          unidad: 'kg',
          estable: true,
          sobrecarga: gramos > 40000,
          formato: 'onix'
        };
      }
    }
  }

  // Estrategias 2 y 3 (otros layouts / Formato 2 del manual)
  const candidatos = [];

  const agregar = (gramos, inicio, tipo) => {
    if (gramos >= 0 && gramos <= CAP) candidatos.push({ gramos, inicio, tipo });
  };
  const aGramos = (digitos) => digitos.reduce((acc, d) => acc * 10 + d, 0);

  // 2) Ancla final: ultimo grupo [W5][CK] (Formato 2 del manual)
  if (g.length >= 7) {
    const w5 = g.slice(-6, -1);
    const ck = g[g.length - 1];
    if (w5.every(esDigito) && esDigito(ck) && ean13Check(w5) === ck) {
      agregar(aGramos(w5), 'final', 'trailing');
    }
  }

  // 3) Barrido deslizante de ventanas de 5 bytes
  for (let i = 0; i + 5 <= g.length; i++) {
    const win = g.slice(i, i + 5);
    if (win.some((v) => !esDigito(v))) continue;

    // trailing: el byte siguiente valida el grupo de 5 digitos
    const chkTrail = g[i + 5];
    if (chkTrail !== undefined && ean13Check(win) === chkTrail) {
      agregar(aGramos(win), i, 'trailing');
    }

    // embebido: el 5to byte valida los 4 primeros
    if (win[4] !== undefined && ean13Check(win.slice(0, 4)) === win[4]) {
      agregar(aGramos(win.slice(0, 4)), i, 'embebido');
    }
  }

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    // 1) trailing (formato conocido) antes que embebido
    if (a.tipo !== b.tipo) return a.tipo === 'trailing' ? -1 : 1;
    // 2) peso no-cero antes (evita falsos positivos del precio en ceros)
    if ((a.gramos > 0) !== (b.gramos > 0)) return a.gramos > 0 ? -1 : 1;
    // 3) ventana mas cerca del final del frame (el peso cierra la trama)
    const fa = a.inicio === 'final' ? g.length : a.inicio + 5;
    const fb = b.inicio === 'final' ? g.length : b.inicio + 5;
    return (g.length - fa) - (g.length - fb);
  });

  const mejor = candidatos[0];
  const pesoKg = mejor.gramos / 1000;

  return {
    peso: pesoKg,
    peso_raw: pesoKg.toFixed(3),
    unidad: 'kg',
    estable: true,
    sobrecarga: mejor.gramos > 40000,
    formato: 'onix'
  };
}

function connect() {
  try {
    port = new SerialPort({
      path: config.port,
      baudRate: config.baudRate,
      autoOpen: false
    });

    port.on('data', (chunk) => {
      const texto = chunk.toString('ascii');

      if (detectMode) {
        buffer += texto;
        if (buffer.length > 5000) buffer = buffer.slice(-1000);
        return;
      }

      chunks++;
      buffer += texto;
      if (buffer.length > 5000) buffer = buffer.slice(-1000);

      // Acumulacion binaria: separamos tramas por salto de linea (0x0A)
      binBuffer = Buffer.concat([binBuffer, chunk]);
      if (binBuffer.length > 6000) binBuffer = binBuffer.slice(-2000);

      let idx;
      while ((idx = binBuffer.indexOf(0x0a)) !== -1) {
        let seg = binBuffer.slice(0, idx);
        binBuffer = binBuffer.slice(idx + 1);
        if (seg.length && seg[seg.length - 1] === 0x0d) seg = seg.slice(0, -1);
        if (!seg.length) continue;

        const clave = seg.toString('hex').toUpperCase();

        // Rastreo de la ultima trama completa recibida (diagnostico/test)
        ultimoBytes = seg;
        ultimaTramaHex = clave;
        trazas.push({ ts: Date.now(), hex: clave, bytes: Array.from(seg) });
        if (trazas.length > 20) trazas.shift();

        // Paso 1: Onix (trama hexaadecimal) validada por chequeo EAN-13
        const onix = parseOnix(seg);
        if (onix) {
          if (clave !== ultimaTrama) {
            ultimaTrama = clave;
            dbg('GRAMERA ONIX:', JSON.stringify({ hex: clave, bytes: Array.from(seg), peso: onix.peso }));
          }
          readings++;
          lastReading = { ...onix, timestamp: Date.now() };
          dbg('GRAMERA PESO:', JSON.stringify(onix));
          continue;
        }

        // Paso 2: trama ASCII
        const limpia = seg.toString('ascii').trim();
        if (!limpia) continue;

        if (clave !== ultimaTrama) {
          ultimaTrama = clave;
          lastRaw.push(limpia);
          if (lastRaw.length > 8) lastRaw.shift();
          dbg('GRAMERA CAMBIO:', JSON.stringify(limpia));
        }

        const reading = parseLine(limpia);
        if (reading) {
          readings++;
          lastReading = { ...reading, timestamp: Date.now() };
          dbg('GRAMERA PESO:', JSON.stringify(reading));
        }
      }

      // Tramas continuas sin salto de linea: "000.560kg000.560kg"
      if (buffer.length > 60) {
        const m = PATRON_PESO.exec(buffer);
        if (m) {
          const reading = construirLectura(m);
          if (reading) {
            readings++;
            lastReading = { ...reading, timestamp: Date.now() };
          }
          buffer = buffer.slice(m.index + m[0].length);
        } else {
          buffer = buffer.slice(-40);
        }
      }
    });

    port.on('error', (err) => {
      console.log('Error gramera:', err.message);
    });

    port.on('open', () => {
      console.log(`Gramera conectada en ${config.port}`);
    });
  } catch (err) {
    console.log('No se pudo inicializar la gramera:', err.message);
  }
}

function disconnect() {
  if (port && port.isOpen) {
    try { port.close(); } catch (err) {}
  }
  port = null;
}

function getPeso() {
  const conectada = !!(port && port.isOpen);
  const lectura = lastReading || { peso: 0, peso_raw: "0", unidad: "kg", estable: false, sobrecarga: false };

  let sinDatos = false;
  if (conectada) {
    if (lastReading && lastReading.timestamp) {
      sinDatos = (Date.now() - lastReading.timestamp) > 8000;
    } else {
      sinDatos = true;
    }
  }

  const bufferRaw = buffer.length > 40 ? buffer.slice(-40) : buffer;
  const bytesRaw = binBuffer.length > 40 ? binBuffer.slice(-40) : binBuffer;

  return {
    conectada,
    sinDatos,
    ...lectura,
    timestamp: lastReading ? lastReading.timestamp : null,
    lastRaw,
    readings,
    chunks,
    baudRate: config.baudRate,
    bufferRaw,
    bytes: Array.from(bytesRaw),
    hex: bytesRaw.toString('hex').toUpperCase()
  };
}

function getConfig() {
  return { ...config, debug };
}

// ACTIVA/DESACTIVA LOS LOGS DE CONSOLA (diagnostico) desde la interfaz
function setDebug(activo) {
  debug = !!activo;
  config.debug = debug;
  saveConfig(config);
  return { config: getConfig(), mensaje: debug ? 'Logs de gramera activados' : 'Logs de gramera silenciados' };
}

// DIAGNOSTICO DE LAS DOS CAPTURAS DE PESAJE
function calcularDiagnostico() {
  const t1 = tests.find((t) => t.id === 'test1');
  const t2 = tests.find((t) => t.id === 'test2');
  const datos1 = !!(t1 && t1.esperado != null && t1.leido != null && t1.esperado > 0);
  const datos2 = !!(t2 && t2.esperado != null && t2.leido != null && t2.esperado > 0);

  if (!datos1 && !datos2) {
    return { verdicto: 'pendiente', mensaje: 'Captura al menos un peso conocido para validar.' };
  }
  if (!datos2) {
    return { verdicto: 'pendiente', mensaje: 'Solo hay Test 1. Captura el Test 2 con otro peso distinto para comparar.' };
  }

  const f1 = t1.leido / t1.esperado;
  const f2 = t2.leido / t2.esperado;
  const dp1 = ((t1.leido - t1.esperado) / t1.esperado) * 100;
  const dp2 = ((t2.leido - t2.esperado) / t2.esperado) * 100;
  const deltaAbs = Math.abs((t1.leido - t1.esperado) - (t2.leido - t2.esperado));

  let verdicto, mensaje;
  if (Math.abs(dp1) < 1 && Math.abs(dp2) < 1) {
    verdicto = 'confirmado';
    mensaje = 'Ambos pesajes concuerdan (delta < 1%). Formato y magnitud del parser correctos. Listo para Pesar.';
  } else if (Math.abs(f1 - f2) < 0.02) {
    verdicto = 'factor_constante';
    mensaje = 'El parser lee SIEMPRE ×' + f1.toFixed(3) + ' del peso real. Hay un error de escala/magnitud fijo.';
  } else if (deltaAbs < 0.005) {
    verdicto = 'desplazamiento';
    mensaje = 'Diferencia constante de ' + (t1.leido - t1.esperado).toFixed(3) + ' kg en ambos test. Parece un offset fijo.';
  } else {
    verdicto = 'incoherente';
    mensaje = 'Los datos no concuerdan de forma consistente. Revisa que los pesos escritos coincidan con la pantalla de la balanza y que sean distintos.';
  }

  return { verdicto, mensaje, factor: f1, deltaPct1: dp1, deltaPct2: dp2 };
}

function getTests() {
  return { tests: tests.map((t) => ({ ...t })), diagnostico: calcularDiagnostico() };
}

// GUARDA UNA CAPTURA DE PESAJE CON EL PESO CONOCIDO (lo que muestra la balanza)
function guardarTest(id, esperadoKg) {
  const test = tests.find((t) => t.id === id);
  if (!test) return { ok: false, error: 'Test no valido: ' + String(id) };

  const esperado = Number(esperadoKg);
  if (!Number.isFinite(esperado) || esperado <= 0) {
    return { ok: false, error: 'Escribe un peso esperado valido (en kg, mayor que 0)' };
  }

  const lectura = lastReading || null;
  test.esperado = esperado;
  test.leido = lectura ? lectura.peso : null;
  test.raw = lectura ? String(lectura.peso_raw != null ? lectura.peso_raw : lectura.peso) : null;
  test.unidad = lectura ? lectura.unidad : null;
  test.formato = lectura ? lectura.formato : null;
  test.bytes = Array.from(ultimoBytes.length ? ultimoBytes : binBuffer.slice(-64));
  test.hex = (ultimoBytes.length ? ultimoBytes : binBuffer.slice(-64)).toString('hex').toUpperCase();
  test.ts = Date.now();

  const res = getTests();
  return { ok: true, test: { ...test }, diagnostico: res.diagnostico };
}

function limpiarTests() {
  for (const t of tests) {
    t.esperado = null;
    t.leido = null;
    t.raw = null;
    t.unidad = null;
    t.formato = null;
    t.bytes = null;
    t.hex = null;
    t.ts = null;
  }
  return { ok: true, tests: getTests().tests };
}

// ULTIMAS TRAMAS COMPLETAS RECIBIDAS (diagnostico remoto)
function getTrazas() {
  return { trazas: trazas.map((t) => ({ ...t })) };
}

// LISTAR PUERTOS SERIALES DISPONIBLES
async function listPorts() {
  const ports = await SerialPort.list();
  return ports.map(p => ({
    path: p.path,
    manufacturer: p.manufacturer || null,
    serialNumber: p.serialNumber || null,
    vendorId: p.vendorId || null,
    productId: p.productId || null,
    friendlyName: p.friendlyName || null,
    usb: !!(p.vendorId && p.productId)
  })).sort((a, b) => {
    if (b.usb !== a.usb) return b.usb - a.usb;
    return a.path.localeCompare(b.path);
  });
}

// ESPERA EL OPEN DEL PUERTO (con timeout) PARA SABER SI REALMENTE SE ABRIO
function openPort() {
  return new Promise((resolve, reject) => {
    if (!port) return reject(new Error('Puerto no inicializado'));

    const timer = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado abriendo el puerto ' + config.port));
    }, 5000);

    port.open((err) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve();
    });
  });
}

// CONECTAR A UN PUERTO ESPECIFICO (await del open para devolver el estado REAL)
async function conectar({ port: puerto, baudRate: baud }) {
  cancelarReintento();
  disconnect();
  lastReading = null;
  buffer = '';
  binBuffer = Buffer.alloc(0);
  ultimaTrama = null;
  lastRaw = [];
  readings = 0;
  chunks = 0;

  if (puerto) config.port = String(puerto);
  if (baud) config.baudRate = Number(baud);

  saveConfig(config);
  connect();

  try {
    await openPort();
    await recordarIdentidadPuerto();
    return { config, conectada: true, mensaje: 'Conectado a ' + config.port };
  } catch (err) {
    const error = (err && err.message) ? err.message : 'No se pudo abrir el puerto ' + config.port;
    disconnect();
    return { config, conectada: false, error };
  }
}

// DESCONECTAR (cierra el puerto pero conserva la config)
function desconectar() {
  cancelarReintento();
  disconnect();
  lastReading = null;
  buffer = '';
  binBuffer = Buffer.alloc(0);
  ultimaTrama = null;
  lastRaw = [];
  readings = 0;
  chunks = 0;
  return { config, conectada: false };
}

// PUNTUA UN TEXTO: mas puntos = mas parecido a una trama ASCII de balanza
function puntuarTramas(texto) {
  let puntos = 0;
  for (const ch of texto) {
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) puntos += 2;
    else if (c >= 0x20 && c <= 0x7e) puntos += 1;
  }
  puntos += (texto.match(/kg|g|lb/gi) || []).length * 30;
  puntos += (texto.match(/ST|US|OL/gi) || []).length * 20;
  puntos += (texto.match(/\r\n/g) || []).length * 5;
  return puntos;
}

// PRUEBA TODOS LOS BAUD RATE Y SE QUEDA CON EL QUE MEJOR LEA LA BALANZA
async function detectarBaud() {
  const portName = config.port;
  const original = config.baudRate;

  cancelarReintento();

  const resultado = [];
  let mejor = { baud: original, puntos: 0, muestra: '' };

  for (const baud of BAUD_CANDIDATOS) {
    disconnect();
    config.baudRate = baud;
    buffer = '';
    detectMode = true;
    connect();
    try {
      await openPort();
    } catch (err) {
      // el puerto no abrio a este baud: se puntua con 0
    }
    await sleep(1800);

    const texto = buffer.slice(-200);
    detectMode = false;

    const puntos = puntuarTramas(texto);
    resultado.push({ baud, puntos, muestra: texto.slice(0, 60) });
    dbg(`Baud ${baud}: ${puntos} pts | ${JSON.stringify(texto.slice(0, 60))}`);

    if (puntos > mejor.puntos) {
      mejor = { baud, puntos, muestra: texto.slice(0, 60) };
    }
  }

  disconnect();
  config.baudRate = mejor.puntos > 0 ? mejor.baud : original;
  saveConfig(config);
  buffer = '';
  binBuffer = Buffer.alloc(0);
  ultimaTrama = null;
  lastReading = null;
  lastRaw = [];
  readings = 0;
  chunks = 0;
  connect();
  try {
    await openPort();
    await recordarIdentidadPuerto();
  } catch (err) {}

  return { port: portName, resultado, mejor, config };
}

// REINTENTO AUTOMATICO: si la auto-conexion de arranque falla (ej. "OPENCOM"),
// se reintenta abrir el puerto periodicamente hasta lograrlo, sin necesidad
// de desconectar y reconectar la gramera fisicamente.
function cancelarReintento() {
  autoReintento = false;
  if (reintentoTimer) {
    clearTimeout(reintentoTimer);
    reintentoTimer = null;
  }
}

// ELIGE EL PUERTO DE LA GRAMERA ENTRE LOS DISPONIBLES:
// 1) el mismo dispositivo de la ultima conexion (serial/vendor),
// 2) el puerto configurado si sigue existiendo,
// 3) el unico puerto USB, o el unico puerto disponible.
function elegirPuertoGramera(puertos) {
  if (!puertos || !puertos.length) return null;

  if (config.serialNumber || (config.vendorId && config.productId)) {
    const mismo = puertos.find(p =>
      (config.serialNumber && p.serialNumber === config.serialNumber) ||
      (config.vendorId && p.vendorId === config.vendorId && p.productId === config.productId)
    );
    if (mismo) return mismo;
  }

  const configurado = puertos.find(p => p.path === config.port);
  if (configurado) return configurado;

  const usb = puertos.filter(p => p.vendorId && p.productId);
  if (usb.length === 1) return usb[0];

  if (puertos.length === 1) return puertos[0];

  return null;
}

// GUARDA LA IDENTIDAD DEL DISPOSITIVO CONECTADO PARA RECONOCERLO AUNQUE
// WINDOWS LE CAMBIE EL NUMERO DE COM TRAS UN REINICIO O RECONEXION.
async function recordarIdentidadPuerto() {
  try {
    const puertos = await SerialPort.list();
    const p = puertos.find(x => x.path === config.port);
    if (!p) return;
    config.serialNumber = p.serialNumber || null;
    config.vendorId = p.vendorId || null;
    config.productId = p.productId || null;
    saveConfig(config);
  } catch (err) {}
}

// INTENTA CONECTAR DESCUBRIENDO EL PUERTO CORRECTO (por si cambio de numero)
async function intentarConexionAutomatica() {
  let puertos = [];
  try { puertos = await SerialPort.list(); } catch (err) {}

  const elegido = elegirPuertoGramera(puertos);
  if (!elegido) throw new Error('No hay un puerto serial disponible para la gramera');

  if (elegido.path !== config.port) {
    console.log('Gramera: usando el puerto ' + elegido.path + ' (antes ' + config.port + ')');
    config.port = elegido.path;
    saveConfig(config);
  }

  disconnect();
  connect();
  await openPort();
  await recordarIdentidadPuerto();
}

function programarReintento() {
  if (autoReintento) return;
  autoReintento = true;

  const reintentar = () => {
    if (!autoReintento) return;
    intentarConexionAutomatica().then(() => {
      cancelarReintento();
      console.log('Gramera auto-reconectada en ' + config.port);
    }).catch((err) => {
      console.log('Reintento de gramera fallido (' + config.port + '): ' + err.message);
      reintentoTimer = setTimeout(reintentar, REINTENTO_MS);
    });
  };

  reintentoTimer = setTimeout(reintentar, REINTENTO_MS);
}

// Servidor arranca y se conecta automaticamente
intentarConexionAutomatica().then(() => {
  console.log('Gramera conectada en ' + config.port);
}).catch((err) => {
  console.log('Auto-conexión de gramera fallida:', err.message);
  programarReintento();
});

module.exports = { getPeso, getConfig, setDebug, getTests, guardarTest, limpiarTests, getTrazas, conectar, desconectar, listPorts, detectarBaud };