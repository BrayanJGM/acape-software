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
      buffer += chunk.toString('ascii');
      const lines = buffer.split(/[\r\n]+/);
      buffer = lines.pop();
      lines.forEach((line) => {
        const reading = parseLine(line.trim());
        if (reading) {
          lastReading = { ...reading, timestamp: Date.now() };
        }
      });
    });

    port.on('error', (err) => {
      console.log('Error gramera:', err.message);
    });

    port.on('open', () => {
      console.log(`Gramera conectada en ${config.port}`);
    });

    port.open((err) => {
      if (err) console.log('Error abriendo gramera:', err.message);
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
  if (conectada && lastReading && lastReading.timestamp) {
    sinDatos = (Date.now() - lastReading.timestamp) > 8000;
  }

  return {
    conectada,
    sinDatos,
    ...lectura,
    timestamp: lastReading ? lastReading.timestamp : null
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

// CONECTAR A UN PUERTO ESPECIFICO
function conectar({ port: puerto, baudRate: baud }) {
  disconnect();
  lastReading = null;
  buffer = '';

  if (puerto) config.port = String(puerto);
  if (baud) config.baudRate = Number(baud);

  saveConfig(config);
  connect();

  return { config, conectada: !!(port && port.isOpen) };
}

// DESCONECTAR (cierra el puerto pero conserva la config)
function desconectar() {
  disconnect();
  lastReading = null;
  buffer = '';
  return { config, conectada: false };
}

// Servidor arranca y se conecta automaticamente
connect();

module.exports = { getPeso, getConfig, conectar, desconectar, listPorts };