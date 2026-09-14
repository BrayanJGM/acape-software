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
function parseLine(line) {
  const regex = /(ST|US|OL)([+-])\s*(\d+\.?\d*)\s*(kg|g|t|lb)/;
  const match = line.match(regex);
  if (!match) return null;

  const estado = match[1];
  const signo = match[2];
  const numero = parseFloat(match[3]);
  const unidad = match[4].toLowerCase();
  const valor = signo === '-' ? -numero : numero;

  let pesoKg = valor;
  switch (unidad) {
    case 'g': pesoKg = valor / 1000; break;
    case 'kg': pesoKg = valor; break;
    case 't': pesoKg = valor * 1000; break;
    case 'lb': pesoKg = valor * 0.45359237; break;
  }

  return {
    peso: pesoKg,
    peso_raw: signo + String(numero),
    unidad,
    estable: estado === 'ST',
    sobrecarga: estado === 'OL'
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

  return {
    conectada,
    sinDatos,
    ...lectura,
    timestamp: lastReading ? lastReading.timestamp : null,
    lastRaw,
    readings,
    chunks
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

// Servidor arranca y se conecta automaticamente
connect();
openPort().catch((err) => {
  console.log('Auto-conexión de gramera fallida:', err.message);
});

module.exports = { getPeso, getConfig, conectar, desconectar, listPorts };