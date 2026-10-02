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
// MARCAN CUANDO LLEGO EL ULTIMO BYTE Y LA ULTIMA TRAMA. Antes no se guardaba y
// no habia forma de saber si la balanza estaba mandando algo que el parser
// rechaza, o si simplemente no estaba mandando nada.
let ultimoChunkMs = 0;
let ultimaTramaMs = 0;
let detectMode = false;
let autoReintento = false;
let reintentoTimer = null;
const REINTENTO_MS = 5000;
// WATCHDOG: si el puerto sigue abierto pero no entra trama, se re-descubre el
// puerto real (Windows puede reasignar el COM tras una reconexion).
let watchdogTimer = null;
const WATCHDOG_MS = 30000;

// TRAZAS: ultimas tramas completas recibidas (para diagnostico remoto)
const trazas = [];

// VALIDACION DE PESAJE: dos capturas de peso conocido para verificar el parser
const tests = [
  { id: 'test1', esperado: null, leido: null, raw: null, unidad: null, formato: null, bytes: null, hex: null, ts: null },
  { id: 'test2', esperado: null, leido: null, raw: null, unidad: null, formato: null, bytes: null, hex: null, ts: null }
];

// PATRON ASCII: estado (ST/US/OL) opcional, signo, numero y unidad.
// Se permiten espacios entre los grupos porque los indicadores reales los
// emiten: "ST+ 600.00 g", "WTST+ 600.00 g", " 1.250 kg". Antes el patron estaba
// anclado con ^ sin tolerar espacios, asi que las tramas con "ST+ 600.00 g"
// (justo las documentadas) NO se leian y llegaban como "sin lectura".
// El estado se separa del resto con lookahead para que los grupos capturados
// sean siempre signo/numero/unidad, sin importar si hay estado o no:
//   "WTST+ 600.00 g", "NTST+ 000876 kg", "ST+ 1 kg", "000.560kg", "+000.560 kg"
// El estado NO se captura: se deduce del texto en construirLectura.
const PREFIJO_ESTADO = /(?:[A-Z]{0,3}(?:ST|US|OL))\b\s*/y;
const PATRON_PESO = /^\s*([+-])?\s*(\d+\.?\d*)\s*(kg|g|t|lb)\b/i;
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

// El estado se captura en su propio grupo porque "WTST"/"NTST" contienen un ST
// al final: buscar \b(ST|US|OL)\b en el texto crudo NO lo encuentra (no hay
// limite de palabra antes del ST), y el peso si se leia pero como inestable.
const ESTADO = /(ST|US|OL)/i;

function construirLectura(m, texto) {
  if (!m) return null;

  let estado = null;
  if (texto) {
    const enc = ESTADO.exec(texto.slice(0, 12));
    if (enc) estado = enc[1].toUpperCase();
  }
  const signo = m[1] === '-' ? '-' : '+';
  const numero = parseFloat(m[2]);
  const unidad = (m[3] || 'kg').toLowerCase();
  if (!Number.isFinite(numero)) return null;
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
  if (!line) return null;
  let texto = String(line).trim();

  // Si la trama empieza con un estado (ST/US/OL, posiblemente tras el prefijo
  // del modelo: WTST, NTST, GSUS) se aparta para que el patron de peso no
  // tenga que adivinar y los grupos queden alineados.
  PREFIJO_ESTADO.lastIndex = 0;
  const conEstado = PREFIJO_ESTADO.exec(texto);
  if (conEstado && conEstado.index === 0) {
    texto = texto.slice(conEstado[0].length);
  }

  return construirLectura(texto.match(PATRON_PESO), String(line));
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

// NORMALIZA UNA TRAMA A DIGITOS 0-9.
// La Onix puede enviar los digitos como bytes crudos (0x00-0x09) o como ASCII
// ('0'-'9', 0x30-0x39) segun la version y configuracion del indicador. Antes solo
// se aceptaba la forma cruda, y las tramas ASCII llegaban enteras pero se
// rechazaban todas -> "puerto abierto, sin lectura" con bytes visibles.
//
// Tambien descarta los terminadores CR (0x0d) y LF (0x0a): el puerto los puede
// pegar a la trama y no son digitos. No se puede filtrar "todo lo menor que
// 0x20" porque los digitos crudos SI son 0x00-0x09, asi que solo se quitan
// CR/LF, que nunca son parte de un digito.
const TERMINADORES = new Set([0x0d, 0x0a]);

function aDigitos(buf) {
  const out = [];
  for (const v of Array.from(buf)) {
    if (TERMINADORES.has(v)) continue;
    out.push(v >= 0x30 && v <= 0x39 ? v - 0x30 : v);
  }
  return out;
}

// VARIANTES QUE SE INTENTAN ANTES DE APLICAR EL CHEQUEO EAN-13.
// El STX (0x02) es indistinguible del digito crudo "2", y en ASCII convive con
// el caracter '2' (0x32). Como por inspeccion no se puede saber cual es cual, se
// prueban las combinaciones posibles y el checksum EAN-13 decide, que es el unico
// validador fiable. Asi una trama segmentada a destiempo no se pierde.
function variantesOnix(buf) {
  const bruto = Array.from(buf);
  const variantes = [];

  if (bruto[0] === 0x02) {
    // El STX (0x02) es un byte de control, NO un digito. En crudos coincide con
    // el valor del digito "2", y en ASCII es el caracter '2' (0x32) el que debe
    // ocupar esa posicion. Por eso se separa y se prueban las lecturas posibles:
    //   - quitando el STX: el resto son los digitos (crudos o ASCII)
    //   - dejando el 0x02: crudo completo, o ASCII con 0x02 haciendo de "2"
    const sinStx = bruto.slice(1);
    variantes.push(sinStx);                      // crudos, sin STX
    variantes.push(aDigitos(sinStx));            // ASCII, sin STX
    variantes.push([0x02, ...aDigitos(sinStx)]); // ASCII con STX como digito "2"
    variantes.push(bruto);                       // crudo completo
  }
  variantes.push(aDigitos(bruto));               // sin STX (trama cortada al inicio)

  return variantes.filter(g => g.length >= 8 && g.every(v => v >= 0 && v <= 9));
}

// PARSER DE LAS TRAMAS HEXADECIMALES DE LA TRUMAX ONIX III PRO (ACS-30E).
// Estrategias, en orden de confianza:
//   1) TRAMA UNIFICADA (layout real validado con tramas reales): 13 bytes,
//      STX 0x02 en [0], los ultimos 5 digitos de gramos en [7..11] y el byte
//      [12] es el chequeo EAN-13 de los 13 valores. La trama puede venir con
//      los digitos en crudo (0x00-0x09) o en ASCII (0x30-0x39).
//   2) ANCLA FINAL (Formato 2 del manual): los ultimos 6 bytes son [W5][CK]
//      (5 digitos de peso + chequeo EAN-13 del grupo).
//   3) BARRIDO DESLIZANTE: ventanas de 5 bytes con chequeo trailing o
//      embebido, filtrando por plausibilidad (0..60 kg).
// ESTRATEGIA 1: checksum sobre los 13 digitos completos del frame. Solo acepta
// tramas de exactamente 13 valores: es la unica que valida la trama entera.
function estrategia1(g) {
  if (!g || g.length !== 13) return null;
  const esDigito = (v) => v >= 0 && v <= 9;
  if (!esDigito(g[12]) || ean13Check(g.slice(0, 12)) !== g[12]) return null;

  const w5 = g.slice(7, 12);
  if (!w5.every(esDigito)) return null;

  const gramos = w5.reduce((acc, d) => acc * 10 + d, 0);
  if (gramos < 0 || gramos > 60000) return null;

  return {
    peso: gramos / 1000,
    peso_raw: (gramos / 1000).toFixed(3),
    unidad: 'kg',
    estable: true,
    sobrecarga: gramos > 40000
  };
}

function buscarPesoOnix(g) {
  if (!g || g.length < 8) return null;
  const CAP = 60000;
  const esDigito = (v) => v >= 0 && v <= 9;

  // 1) TRAMA UNIFICADA (layout real ACS-30E)
  const unificada = estrategia1(g);
  if (unificada) return unificada;

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
    sobrecarga: mejor.gramos > 40000
  };
}

// LONGITUD DE LA TRAMA ONIX VALIDADA (13 digitos: STX + 11 + checksum).
const LONGITUD_TRAMA = 13;

// INTERPRETA UN TROZO DE 13 BYTES COMO TRAMA ONIX, probando las variantes de
// codificacion (cruda / ASCII) y exigiendo el checksum de la trama completa.
function leerTrama13(bytes) {
  const variantes = variantesOnix(bytes);
  for (const g of variantes) {
    if (g.length !== LONGITUD_TRAMA) continue;
    const r = estrategia1(g);
    if (r) return { ...r, formato: 'onix' };
  }
  return null;
}

function parseOnix(buf) {
  const bytes = Array.from(buf);
  if (!bytes.length) return null;

  // Una trama llena de ceros no es una lectura: es relleno o ruido. Sin este
  // filtro, ean13Check de un grupo de ceros tambien valida y el parser reportaria
  // un 0,000 kg fantasma cada vez que la balanza no tiene nada que enviar.
  if (!bytes.some((v) => v !== 0)) return null;

  // 1) La trama llega entera y sola: caso normal, un solo intento.
  if (bytes.length === LONGITUD_TRAMA) {
    const r = leerTrama13(bytes);
    if (r) return r;
  }

  // 2) Con relleno, basura o una trama anterior pegada delante: se buscan las
  //    posiciones con STX (0x02), en orden, y se toman 13 bytes desde cada una.
  //    Recorrerlas hacia adelante hace que, si vienen varias tramas juntas, gane
  //    la primera, que es la lectura mas reciente.
  //    IMPORTANTE: solo se prueban posiciones donde HAY un 0x02. Probar todas las
  //    posiciones dejaba que el barrido deslizante encontrara un peso plausible
  //    dentro de una trama simplemente truncada (12 g en vez de null).
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x02) continue;
    const trozo = bytes.slice(i, i + LONGITUD_TRAMA);
    if (trozo.length !== LONGITUD_TRAMA) continue;
    const r = leerTrama13(trozo);
    if (r) return r;
  }

  // 3) La trama empieza por STX pero no mide 13 bytes: esta INCOMPLETA (aun no
  //    llegaron todos los bytes) o tiene bytes de mas. Se devuelve null para que
  //    el manejador siga acumulando. Importante: no se cae al barrido deslizante,
  //    porque sobre una trama truncada encontra una ventana con checksum
  //    coincidente y reporta un peso FALSO (12 g donde deberia leer 12,345 kg).
  if (bytes[0] === 0x02) return null;

  // 4) Formatos alternativos del manual (tramas sin STX, p. ej. "Formato 2" con
  //    checksum embebido). Solo para buffers MENORES que una trama completa: en un
  //    buffer largo cualquier ventana deslizante puede dar un numero plausible y
  //    falso, asi que ahi no se busca.
  if (bytes.length > LONGITUD_TRAMA) return null;

  const variantes = variantesOnix(bytes);
  if (!variantes.length) return null;

  // Una trama con la FORMA del layout real (13 digitos) pero con el checksum
  // equivocado esta corrupta: no se reinterpreta con ventanas parciales, porque
  // eso si inventa pesos (p. ej. 0,000 kg a partir de bytes danados).
  if (variantes.some((g) => g.length === LONGITUD_TRAMA)) return null;

  // Sin forma de layout conocido: se aceptan los formatos alternativos del manual.
  for (const g of variantes) {
    const r = buscarPesoOnix(g);
    if (r) return { ...r, formato: 'onix' };
  }

  return null;
}

// PROCESA UNA TRAMA COMPLETA RECIBIDA. Devuelve si produjo una lectura valida.
function procesarTrama(seg) {
    const clave = seg.toString('hex').toUpperCase();
    ultimaTramaMs = Date.now();
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
      return true;
    }

    // Paso 2: trama ASCII
    const limpia = seg.toString('ascii').trim();
    if (!limpia) return false;

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
      return true;
    }
    return false;
  }

function connect() {
  try {
    const p = new SerialPort({
      path: config.port,
      baudRate: config.baudRate,
      autoOpen: false
    });
    p.cierreIntencional = false;
    port = p;

    port.on('data', (chunk) => {
      const texto = chunk.toString('ascii');
      ultimoChunkMs = Date.now();

      if (detectMode) {
        buffer += texto;
        if (buffer.length > 5000) buffer = buffer.slice(-1000);
        return;
      }

      chunks++;
      buffer += texto;
      if (buffer.length > 5000) buffer = buffer.slice(-1000);

      // Acumulacion binaria: se separa por CR o LF. Antes solo se partia por LF
      // (0x0A); los indicadores que cierran trama solo con CR (0x0D) no llegaban
      // nunca a procesarse y el buffer crecia hasta descartar los bytes.
      binBuffer = Buffer.concat([binBuffer, chunk]);
      if (binBuffer.length > 6000) binBuffer = binBuffer.slice(-2000);

      while (true) {
        const idxLF = binBuffer.indexOf(0x0a);
        const idxCR = binBuffer.indexOf(0x0d);
        let idx;
        if (idxLF === -1) idx = idxCR;
        else if (idxCR === -1) idx = idxLF;
        else idx = Math.min(idxLF, idxCR);
        if (idx === -1) break;

        let seg = binBuffer.slice(0, idx);
        binBuffer = binBuffer.slice(idx + 1);
        if (seg.length && seg[seg.length-1] === 0x0d) seg = seg.slice(0, -1);
        if (seg.length && seg[seg.length-1] === 0x0a) seg = seg.slice(0, -1);
        if (!seg.length) continue;

        procesarTrama(seg);
      }

      // Tramas pegadas sin terminador: si el acumulado ya valida por chequeo, se
      // acepta y se consume. Cubre indicadores en modo continuo que no anaden
      // CR/LF entre trama y trama.
      if (binBuffer.length && binBuffer.length >= 8) {
        const stx = binBuffer.indexOf(0x02);
        if (stx !== -1 && stx + 8 <= binBuffer.length) {
          const candidato = binBuffer.slice(stx);
          if (parseOnix(candidato)) {
            procesarTrama(candidato);
            binBuffer = Buffer.alloc(0);
          }
        }
      }

      // Tramas continuas sin salto de linea: "000.560kg000.560kg"
      if (buffer.length > 60) {
        const m = PATRON_PESO.exec(buffer);
        if (m) {
          const lecturaTxt = m[0];
          const reading = construirLectura(m, lecturaTxt);
          if (reading) {
            readings++;
            lastReading = { ...reading, timestamp: Date.now() };
          }
          buffer = buffer.slice(m.index + lecturaTxt.length);
        } else {
          buffer = buffer.slice(-40);
        }
      }
    });

    port.on('error', (err) => {
      console.log('Error gramera:', err.message);
    });

    // SIN ESTE HANDLER el estado nunca se actualizaba cuando la balanza se
    // soltaba: el puerto podia seguir marcado como abierto y la UI se quedaba
    // en "conectada" para siempre, sin lecturas y sin reintentar.
    //
    // La marca cierreIntencional se pone en la INSTANCIA (p), no en la variable
    // global: cuando disconnect() cierra el puerto, 'close' se emite despues y
    // para entonces la variable global ya es null. Chequear la global no servia
    // y hacia que una desconexion manual se AUTO-RECONECTARA sola.
    port.on('close', (hadError) => {
      console.log('Gramera: puerto cerrado' + (hadError ? ' por error' : ''));
      if (p.cierreIntencional) return;       // cierre pedido por la app
      if (port !== p) return;                // ya hay otra conexion activa
      programarReintento();
    });

    port.on('open', () => {
      console.log(`Gramera conectada en ${config.port}`);
    });
  } catch (err) {
    console.log('No se pudo inicializar la gramera:', err.message);
  }
}

function disconnect() {
  const p = port;
  if (p) {
    // Marca ANTES de cerrar: el evento 'close' llega despues de poner port=null,
    // asi que la marca debe viajar en la instancia para que el handler sepa que
    // el cierre fue a pedido de la app y no debe reintentar la conexion.
    p.cierreIntencional = true;
    if (p.isOpen) {
      try { p.close(); } catch (err) {}
    }
  }
  port = null;
}

// TIMEPOUTS DE DETECCION DE "SIN DATOS".
// El valor anterior (8000 fijo) marcaba ambar aunque la balanza esté bien: una
// balanza en modo normal solo emite trama cuando cambia el peso, asi que sin
// movimiento no hay lectura nueva y se marcaba como fallo. Ahora son configurables
// y, sobre todo, el estado distingue "llegan bytes" de "llegan y no se leen".
const TIMEOUT_TRAMA_MS_DEF = 15000;   // sin bytes ni trama
const TIMEOUT_LECTURA_MS_DEF = 20000; // bytes que llegan pero no se interpretan

function timeoutTrama() {
  const v = Number(config.timeoutTramaMs);
  return Number.isFinite(v) && v >= 2000 ? v : TIMEOUT_TRAMA_MS_DEF;
}
function timeoutLectura() {
  const v = Number(config.timeoutLecturaMs);
  return Number.isFinite(v) && v >= 2000 ? v : TIMEOUT_LECTURA_MS_DEF;
}

function getPeso() {
  const conectada = !!(port && port.isOpen);
  const ahora = Date.now();
  const lectura = lastReading || { peso: 0, peso_raw: "0", unidad: "kg", estable: false, sobrecarga: false };

  const lecturaFresca = !!(lastReading && lastReading.timestamp) && (ahora - lastReading.timestamp) < timeoutLectura();
  const tramaFresca = ultimaTramaMs > 0 && (ahora - ultimaTramaMs) < timeoutTrama();
  const bytesFrescos = ultimoChunkMs > 0 && (ahora - ultimoChunkMs) < timeoutTrama();

  // ESTADOS REALES (antes todo se colapsaba en un solo "sinDatos"):
  //   leyendo               -> hay lectura valida reciente
  //   recibe-no-interpreta  -> LLEGAN bytes pero ninguna trama valida: FALLO REAL
  //   sin-trama             -> no llega nada: puede ser que la balanza este en
  //                           modo normal y solo emita al cambiar el peso
  //   desconectada          -> el puerto no esta abierto
  let estado = 'desconectada';
  if (conectada) {
    if (lecturaFresca) estado = 'leyendo';
    else if (tramaFresca || bytesFrescos) estado = 'recibe-no-interpreta';
    else estado = 'sin-trama';
  }

  const bufferRaw = buffer.length > 40 ? buffer.slice(-40) : buffer;
  const bytesRaw = binBuffer.length > 40 ? binBuffer.slice(-40) : binBuffer;

  return {
    conectada,
    estado,
    // COMPATIBILIDAD: las dos pantallas historicas usaban solo "sinDatos".
    // Ahora significa "hay un problema real", no "llego el peso".
    sinDatos: conectada && estado !== 'leyendo',
    // AMARILLO DE VERDAD: bytes entrando que el parser no logra interpretar.
    problemaLectura: estado === 'recibe-no-interpreta',
    ...lectura,
    timestamp: lastReading ? lastReading.timestamp : null,
    ultimaTramaMs: ultimaTramaMs || null,
    ultimoChunkMs: ultimoChunkMs || null,
    lastRaw,
    readings,
    chunks,
    baudRate: config.baudRate,
    timeoutLecturaMs: timeoutLectura(),
    timeoutTramaMs: timeoutTrama(),
    bufferRaw,
    bytes: Array.from(bytesRaw),
    hex: bytesRaw.toString('hex').toUpperCase()
  };
}

function getConfig() {
  // Devuelve los valores RESUELTOS (con el default aplicado), no solo lo que
  // hay guardado: si el default cambia, la UI debe mostrar el valor vigente.
  return {
    ...config,
    debug,
    timeoutLecturaMs: timeoutLectura(),
    timeoutTramaMs: timeoutTrama()
  };
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
// RESETS DEL ESTADO EN VOLUMEN. Se agrupan para no olvidar uno: si se limpia
// lastReading pero no ultimoChunkMs, el watchdog creeria que sigue habiendo bytes
// recientes y jamas intentaria recuperar el puerto.
function resetEstado() {
  lastReading = null;
  buffer = '';
  binBuffer = Buffer.alloc(0);
  ultimaTrama = null;
  ultimoBytes = Buffer.alloc(0);
  ultimaTramaHex = '';
  lastRaw = [];
  readings = 0;
  chunks = 0;
  ultimoChunkMs = 0;
  ultimaTramaMs = 0;
  trazas.length = 0;
}

async function conectar({ port: puerto, baudRate: baud }) {
  cancelarReintento();
  disconnect();
  resetEstado();

  if (puerto) config.port = String(puerto);
  if (baud) config.baudRate = Number(baud);

  saveConfig(config);
  connect();

  try {
    await openPort();
    await recordarIdentidadPuerto();
    arrancarWatchdog();
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
  resetEstado();
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
  resetEstado();
  connect();
  try {
    await openPort();
    await recordarIdentidadPuerto();
    arrancarWatchdog();
  } catch (err) {}

  return { port: portName, resultado, mejor, config };
}

// CONFIGURA LOS TIEMPOUTS DE "SIN DATOS" DESDE LA INTERFAZ.
// Con una balanza en modo normal (solo emite al cambiar el peso) el valor por
// defecto de 8 s era demasiado corto y la marcaba en ambar sin motivo.
function setTimeouts({ lecturaMs, tramaMs }) {
  if (Number.isFinite(Number(lecturaMs)) && Number(lecturaMs) >= 2000) config.timeoutLecturaMs = Number(lecturaMs);
  if (Number.isFinite(Number(tramaMs)) && Number(tramaMs) >= 2000) config.timeoutTramaMs = Number(tramaMs);
  saveConfig(config);
  return {
    config: getConfig(),
    mensaje: 'Tiempos aplicados: lectura ' + timeoutLectura() + ' ms, trama ' + timeoutTrama() + ' ms'
  };
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

// WATCHDOG DE TRAMA: el puerto puede quedar "abierto" sin que haya dispositivo
// detras (Windows reasigna el COM al reconectar el cable y el puerto viejo sigue
// existiendo). Antes no habia nada que lo detectara: la app se quedaba clavada
// mostrando "conectada" sin lectura hasta que el usuario reiniciara a mano.
function arrancarWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (!port || !port.isOpen || detectMode || autoReintento) return;

    const ahora = Date.now();
    const hayTrama = ultimaTramaMs > 0 && (ahora - ultimaTramaMs) < timeoutTrama();
    const hayLectura = lastReading && lastReading.timestamp && (ahora - lastReading.timestamp) < timeoutLectura();
    const hayBytes = ultimoChunkMs > 0 && (ahora - ultimoChunkMs) < timeoutTrama();
    if (hayTrama || hayLectura || hayBytes) return;

    console.log('Gramera: puerto ' + config.port + ' abierto pero sin trama. Re-descubriendo el puerto real...');
    disconnect();
    intentarConexionAutomatica().then(() => {
      console.log('Gramera recuperada en ' + config.port);
    }).catch((err) => {
      console.log('Watchdog de gramera no pudo recuperar el puerto: ' + err.message);
      programarReintento();
    });
  }, WATCHDOG_MS);
}

// RECUPERACION MANUAL: re-descubre el puerto real y reconecta. Es el mismo
// camino que usa el watchdog, expuesto para que el usuario no dependa de esperar.
async function recuperar() {
  cancelarReintento();
  disconnect();
  resetEstado();
  await intentarConexionAutomatica();
  arrancarWatchdog();
  return getConfig();
}

// Servidor arranca y se conecta automaticamente
if (process.env.GRAMERA_NO_AUTOARRANQUE !== '1') {
  intentarConexionAutomatica().then(() => {
    console.log('Gramera conectada en ' + config.port);
    arrancarWatchdog();
  }).catch((err) => {
    console.log('Auto-conexión de gramera fallida:', err.message);
    programarReintento();
    arrancarWatchdog();
  });
}

// INTERNO SOLO PARA PRUEBAS: expone los parsers sin abrir puertos reales.
module.exports = {
  getPeso, getConfig, setDebug, setTimeouts, recuperar,
  getTests, guardarTest, limpiarTests, getTrazas,
  conectar, desconectar, listPorts, detectarBaud,
  _test: { parseOnix, parseLine, construirLectura, ean13Check, buscarPesoOnix, variantesOnix }
};