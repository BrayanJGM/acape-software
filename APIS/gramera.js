// SERVICIO DE LECTURA DE GRAMERA (BALANZA) POR PUERTO SERIAL
// Protocolo soportado: Trumax (WT/NT/GS + ST/US/OL + peso ASCII + unidad)
const { SerialPort } = require('serialport');
const fs = require('fs');
const path = require('path');

const configsPath = path.join(__dirname, './../configs.json');

let config = loadConfig();
let port = null;
let buffer = '';
let lastReading = null;
let lastRaw = [];
let readings = 0;
let chunks = 0;
let detectMode = false;

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
      const lines = buffer.split(/[\r\n]+/);
      buffer = lines.pop();

      lines.forEach((line) => {
        const limpia = line.trim();
        if (!limpia) return;

        lastRaw.push(limpia);
        if (lastRaw.length > 8) lastRaw.shift();
        console.log('GRAMERA RAW:', JSON.stringify(limpia));

        const reading = parseLine(limpia);
        if (reading) {
          readings++;
          lastReading = { ...reading, timestamp: Date.now() };
          console.log('GRAMERA PESO:', JSON.stringify(reading));
        }
      });

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
    hex: Buffer.from(bufferRaw, 'ascii').toString('hex').toUpperCase()
  };
}

function getConfig() {
  return config;
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
  disconnect();
  lastReading = null;
  buffer = '';
  lastRaw = [];
  readings = 0;
  chunks = 0;

  if (puerto) config.port = String(puerto);
  if (baud) config.baudRate = Number(baud);

  saveConfig(config);
  connect();

  try {
    await openPort();
    return { config, conectada: true, mensaje: 'Conectado a ' + config.port };
  } catch (err) {
    const error = (err && err.message) ? err.message : 'No se pudo abrir el puerto ' + config.port;
    disconnect();
    return { config, conectada: false, error };
  }
}

// DESCONECTAR (cierra el puerto pero conserva la config)
function desconectar() {
  disconnect();
  lastReading = null;
  buffer = '';
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
    console.log(`Baud ${baud}: ${puntos} pts | ${JSON.stringify(texto.slice(0, 60))}`);

    if (puntos > mejor.puntos) {
      mejor = { baud, puntos, muestra: texto.slice(0, 60) };
    }
  }

  disconnect();
  config.baudRate = mejor.puntos > 0 ? mejor.baud : original;
  saveConfig(config);
  buffer = '';
  lastReading = null;
  lastRaw = [];
  readings = 0;
  chunks = 0;
  connect();
  try {
    await openPort();
  } catch (err) {}

  return { port: portName, resultado, mejor, config };
}

// Servidor arranca y se conecta automaticamente
connect();
openPort().catch((err) => {
  console.log('Auto-conexión de gramera fallida:', err.message);
});

module.exports = { getPeso, getConfig, conectar, desconectar, listPorts, detectarBaud };