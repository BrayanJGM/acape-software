// GRAMERA VIRTUAL (SIMULADOR DE BALANZA) - SCRIPT INDEPENDIENTE DEL SERVER
//
// Simula una gramera fisica escribiendo tramas ASCII tipo Trumax por un
// extremo de un par de puertos seriales virtuales. La aplicacion, conectada
// al OTRO extremo, la lee como si fuera hardware real (mismo parser de
// APIS/gramera.js), sin tocar el servidor.
//
// COMO USARLO:
//   Windows: instala com0com y crea un par, ej. COM10 <-> COM11.
//            node gramera-platform.js COM10 9600
//            En la app conecta la gramera a COM11.
//   Linux:   crea el par con socat o con el ayudante incluido:
//              python3 gramera-pair.py        (imprime las dos rutas /dev/pts/N)
//            o
//              socat -d -d pty,raw,echo=0 pty,raw,echo=0
//            node gramera-platform.js /dev/pts/5 9600
//            En la app conecta la gramera a /dev/pts/6.
//
// Ver puertos disponibles:
//   node gramera-platform.js --list
//
// COMANDOS EN LA TERMINAL (prompt "gramera>"):
//   1.5  | 1.5kg   fija 1.5 kg
//   1500g          fija 1.5 kg (convierte gramos a kg)
//   estable        alterna estable/inestable
//   estable on|off fija el estado
//   0 | cero       peso en cero
//   status         muestra el estado actual
//   help           lista de comandos
//   salir          termina
//
// La trama cambia de prefijo segun el estado:
//   estable    -> ST+1.500kg
//   inestable  -> US+1.500kg
//   sobrecarga -> OL+45.000kg  (mas de 40 kg)

const readline = require('readline');

let SerialPort = null;
try {
  SerialPort = require('serialport').SerialPort;
} catch (err) {
  SerialPort = null;
}

const LIMITE_SOBRECARGA_KG = 40;
const REENVIO_MS = 500;

const AYUDA = [
  'Comandos disponibles:',
  '  1.5  | 1.5kg    -> fija el peso en kilogramos',
  '  1500g           -> fija el peso en gramos (se convierte a kg)',
  '  estable [on|off]-> alterna o fija si el peso es estable (ST/US)',
  '  0 | cero        -> pone el peso en cero',
  '  status          -> muestra el estado actual',
  '  help            -> muestra esta ayuda',
  '  salir           -> termina el simulador'
].join('\n');

// ESTADO DE LA GRAMERA VIRTUAL
let estado = {
  pesoKg: 0,
  estable: true,
  sobrecarga: false
};

let port = null;
let intervalo = null;
let ultimoEnvio = null;

// CONSTRUYE LA TRAMA TRUMAX COMPATIBLE CON EL PARSER REAL
function construirFrame(pesoKg, estable, sobrecarga) {
  const peso = Number(pesoKg) || 0;
  const sobre = sobrecarga === undefined ? peso > LIMITE_SOBRECARGA_KG : !!sobrecarga;
  const prefijo = sobre ? 'OL' : (estable ? 'ST' : 'US');
  return prefijo + '+' + peso.toFixed(3) + 'kg\r\n';
}

function describirEstado(e) {
  const tipo = e.sobrecarga ? 'sobrecarga (OL)' : (e.estable ? 'estable (ST)' : 'inestable (US)');
  return 'Peso: ' + Number(e.pesoKg).toFixed(3) + ' kg | Estado: ' + tipo;
}

// INTERPRETA UNA LINEA DE LA TERMINAL Y DEVUELVE EL NUEVO ESTADO
function parsearComando(linea, actual) {
  const previo = { pesoKg: 0, estable: true, sobrecarga: false, ...(actual || {}) };
  const texto = String(linea == null ? '' : linea).trim();

  if (!texto) return { estado: previo };

  const lower = texto.toLowerCase();

  if (lower === 'salir' || lower === 'exit' || lower === 'quit') {
    return { estado: previo, salir: true };
  }

  if (lower === 'help' || lower === 'ayuda' || lower === '?' || lower === 'h') {
    return { estado: previo, mensaje: AYUDA };
  }

  if (lower === 'status' || lower === 'estado') {
    return { estado: previo, mensaje: describirEstado(previo) };
  }

  if (lower === '0' || lower === 'cero' || lower === 'clear' || lower === 'reset') {
    return { estado: { ...previo, pesoKg: 0, sobrecarga: false }, mensaje: 'Peso en cero.' };
  }

  const mEst = lower.match(/^(?:estable|st)\s*(on|off|1|0)?$/);
  if (mEst) {
    const valor = mEst[1];
    const estable = valor === undefined ? !previo.estable : (valor === 'on' || valor === '1');
    return {
      estado: { ...previo, estable },
      mensaje: 'Peso ' + (estable ? 'estable (ST)' : 'inestable (US)') + '.'
    };
  }

  const mPeso = texto.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(kg|g|t|lb)?$/i);
  if (mPeso) {
    const numero = parseFloat(mPeso[1].replace(',', '.'));
    const unidad = (mPeso[2] || 'kg').toLowerCase();

    let kg = numero;
    if (unidad === 'g') kg = numero / 1000;
    else if (unidad === 't') kg = numero * 1000;
    else if (unidad === 'lb') kg = numero * 0.45359237;

    return {
      estado: { ...previo, pesoKg: kg, sobrecarga: kg > LIMITE_SOBRECARGA_KG },
      mensaje: 'Peso fijado: ' + kg.toFixed(3) + ' kg.'
    };
  }

  return {
    estado: previo,
    mensaje: 'Comando no reconocido: "' + texto + '". Escribe "help".',
    error: true
  };
}

// ESCRIBE LA TRAMA ACTUAL POR EL PUERTO
function enviarFrame() {
  if (!port || !port.isOpen) return;
  const frame = construirFrame(estado.pesoKg, estado.estable, estado.sobrecarga);
  ultimoEnvio = frame;
  port.write(frame);
}

function setPeso(pesoKg) {
  estado = { ...estado, pesoKg: Number(pesoKg) || 0, sobrecarga: Number(pesoKg) > LIMITE_SOBRECARGA_KG };
  enviarFrame();
  return estado;
}

function setEstable(valor) {
  estado = { ...estado, estable: !!valor };
  enviarFrame();
  return estado;
}

function getEstado() {
  return { ...estado, frame: construirFrame(estado.pesoKg, estado.estable, estado.sobrecarga) };
}

function aplicarEstado(nuevo) {
  estado = { ...estado, ...nuevo };
}

// ---------- MODO CLI (solo cuando se ejecuta directo) ----------

function abrirPuerto(puerto, baudRate) {
  return new Promise((resolve, reject) => {
    port = new SerialPort({ path: puerto, baudRate, autoOpen: false });
    port.on('error', (err) => reject(err));
    port.open((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function cerrarTodo() {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
  if (port && port.isOpen) {
    try { port.close(); } catch (err) {}
  }
  port = null;
}

function puertoPorDefecto() {
  return process.platform === 'win32' ? 'COM10' : '/dev/ttyUSB0';
}

// IMPRIME LOS PUERTOS SERIALES QUE VE EL SISTEMA (util para elegir el correcto)
function listarPuertos() {
  if (!SerialPort || typeof SerialPort.list !== 'function') {
    console.error('No se encontro el paquete "serialport". Ejecuta "npm install" en el proyecto.');
    process.exit(1);
  }

  return SerialPort.list().then((ports) => {
    console.log('Puertos seriales detectados:');
    if (!ports || !ports.length) {
      console.log('  (ninguno)');
    } else {
      for (const p of ports) {
        const datos = [];
        if (p.manufacturer) datos.push(p.manufacturer);
        if (p.serialNumber) datos.push('SN:' + p.serialNumber);
        if (p.vendorId && p.productId) datos.push('VID:' + p.vendorId + ' PID:' + p.productId);
        console.log('  ' + p.path + (datos.length ? '   [' + datos.join(' | ') + ']' : ''));
      }
    }

    if (process.platform !== 'win32') {
      console.log('');
      console.log('Nota: los puertos PTY del par virtual (/dev/pts/N) NO aparecen aqui.');
      console.log('Para crearlos usa "python3 gramera-pair.py" o socat.');
    }
  }).catch((err) => {
    console.error('No se pudieron listar los puertos: ' + err.message);
    process.exit(1);
  });
}

// AYUDA ESPECIFICA POR SISTEMA OPERATIVO CUANDO NO SE PUEDE ABRIR EL PUERTO
function sugerirParVirtual(puerto) {
  if (process.platform === 'win32') {
    console.error('El puerto ' + puerto + ' no existe en el sistema.');
    console.error('Para simular una gramera necesitas crear un par de COM virtuales:');
    console.error('  1) Instala com0com (https://sourceforge.net/projects/com0com/).');
    console.error('  2) Crea un par, por ejemplo COM10 <-> COM11.');
    console.error('  3) Ejecuta: node gramera-platform.js COM10 9600');
    console.error('  4) En la app conecta la gramera a COM11.');
    console.error('Lista los puertos con: node gramera-platform.js --list');
  } else {
    console.error('El puerto ' + puerto + ' no existe (en Linux no hay puertos COM*).');
    console.error('Para simular una gramera necesitas un par de pseudo-puertos enlazados.');
    console.error('Opcion sin instalar nada (esta en este proyecto):');
    console.error('  Terminal A:  python3 gramera-pair.py        (imprime dos rutas /dev/pts/N)');
    console.error('  Terminal B:  node gramera-platform.js /dev/pts/N 9600');
    console.error('  En la app:   Gramera -> activa "puerto manual" -> escribe la OTRA ruta /dev/pts/N');
    console.error('Opcion con socat (requiere instalarlo):');
    console.error('  socat -d -d pty,raw,echo=0 pty,raw,echo=0');
  }
  console.error('');
  console.error('Verifica tambien que el puerto no este siendo usado por otro programa.');
}

function iniciarCLI(puerto, baudRate) {
  if (!SerialPort) {
    console.error('No se encontro el paquete "serialport". Ejecuta "npm install" en el proyecto.');
    process.exit(1);
  }

  console.log('Gramera virtual ACAPE');
  console.log('Abriendo puerto ' + puerto + ' @ ' + baudRate + ' baud...');

  abrirPuerto(puerto, baudRate).then(() => {
    console.log('Puerto ' + puerto + ' abierto.');
    console.log('En la aplicacion conecta la gramera al OTRO extremo del par virtual.');
    console.log('Escribe "help" para ver los comandos.\n');

    enviarFrame();

    intervalo = setInterval(enviarFrame, REENVIO_MS);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'gramera> ' });
    rl.prompt();

    rl.on('line', (linea) => {
      const res = parsearComando(linea, estado);

      if (res.salir) {
        cerrarTodo();
        rl.close();
        console.log('Gramera virtual apagada.');
        process.exit(0);
      }

      if (res.estado) aplicarEstado(res.estado);
      if (res.mensaje) console.log(res.mensaje);
      if (!res.error) enviarFrame();

      rl.prompt();
    });

    rl.on('close', () => {
      cerrarTodo();
      process.exit(0);
    });
  }).catch((err) => {
    console.error('No se pudo abrir el puerto ' + puerto + ': ' + err.message);
    console.error('');
    sugerirParVirtual(puerto);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\nGramera virtual apagada.');
    cerrarTodo();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cerrarTodo();
    process.exit(0);
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const primero = (args[0] || '').toLowerCase();

  if (primero === '--list' || primero === '-l' || primero === 'list' || primero === '--puertos') {
    listarPuertos();
  } else if (primero === '--help' || primero === '-h' || primero === 'help' || primero === 'ayuda') {
    console.log('Uso: node gramera-platform.js [puerto] [baudRate]');
    console.log('     node gramera-platform.js --list   (lista puertos seriales)');
    console.log('');
    console.log(AYUDA);
    console.log('');
    sugerirParVirtual(puertoPorDefecto());
  } else {
    const puerto = args[0] || puertoPorDefecto();
    const baudRate = Number(args[1]) || 9600;
    iniciarCLI(puerto, baudRate);
  }
}

module.exports = {
  construirFrame,
  parsearComando,
  describirEstado,
  getEstado,
  setPeso,
  setEstable,
  LIMITE_SOBRECARGA_KG
};
