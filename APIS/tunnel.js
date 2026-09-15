// TUNEL DE CLOUDFLARE AUTOMATICO
// Al iniciar el servidor levanta cloudflared hacia http://localhost:PORT.
// - Sin hostname: crea un tunel temporal y captura la URL https://*.trycloudflare.com.
// - Con hostname: lanza el tunel nombrado (cloudflared tunnel run).
// Al detectar la URL la imprime, la guarda en tunnel-url.txt y avisa por email/whatsapp.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

const configsPath = path.join(__dirname, './../configs.json');
const projectDir = path.join(__dirname, './..');
const URL_FILE = path.join(projectDir, 'tunnel-url.txt');
const RE_QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

let child = null;
let notified = false;

function tunnelConfig() {
  try {
    const configs = JSON.parse(fs.readFileSync(configsPath, 'utf8'));
    return configs.tunnel || {};
  } catch (err) {
    return {};
  }
}

function binaryName() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') return arch === 'x64' ? 'cloudflared-windows-amd64.exe' : 'cloudflared-windows-386.exe';
  if (platform === 'linux') return 'cloudflared-linux-' + (arch === 'arm64' ? 'arm64' : (arch === 'arm' ? 'arm' : 'amd64'));
  if (platform === 'darwin') return 'cloudflared-darwin-' + (arch === 'arm64' ? 'arm64' : 'amd64');
  return 'cloudflared-linux-amd64';
}

function binaryPath() {
  const conf = tunnelConfig();
  if (conf.binary && fs.existsSync(conf.binary)) return conf.binary;
  const local = process.platform === 'win32'
    ? path.join(projectDir, 'cloudflared.exe')
    : path.join(projectDir, 'cloudflared');
  return fs.existsSync(local) ? local : null;
}

async function downloadBinary(dest) {
  const asset = binaryName();
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;
  console.log('[*] TUNEL: descargando cloudflared (' + asset + ')...');
  const response = await axios.get(url, { responseType: 'stream', timeout: 120000 });
  const writer = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
}

async function notify(url) {
  const conf = tunnelConfig();
  const message = [
    'Aplicativo ACAPE encendido.',
    '',
    'Acceso remoto (enlace):',
    url,
    '',
    'Fecha: ' + new Date().toLocaleString(),
    'Si este enlace deja de funcionar, reinicia el servidor: este tunel se renueva cada vez que se enciende.'
  ].join('\n');

  if (conf.notifyWhatsapp) {
    try {
      require('./whatsapp.services.js')(message);
    } catch (e) {
      console.log('[tunnel] No se pudo avisar por whatsapp:', e.message);
    }
  }
  if (conf.notifyEmail) {
    try {
      const sendEmail = require('./mail.services.js');
      await sendEmail({ subject: 'URL del servidor ACAPE', text: message });
    } catch (e) {
      console.log('[tunnel] No se pudo avisar por email:', e.message);
    }
  }
}

function mostrarUrl(url) {
  notified = true;
  fs.writeFileSync(URL_FILE, url);
  console.log('');
  console.log('==========================================================');
  console.log('  ACCESO REMOTO A LA APP: ' + url);
  console.log('  (Guardada tambien en: ' + URL_FILE + ')');
  console.log('==========================================================');
  notify(url);
}

async function start() {
  const conf = tunnelConfig();
  if (!conf || conf.enabled !== true) return;

  let bin = binaryPath();
  if (!bin) {
    const dest = process.platform === 'win32'
      ? path.join(projectDir, 'cloudflared.exe')
      : path.join(projectDir, 'cloudflared');
    try {
      await downloadBinary(dest);
      bin = dest;
    } catch (e) {
      console.log('[tunnel] No se pudo descargar cloudflared automaticamente (' + e.message + ').');
      console.log('[tunnel] Descarguelo de https://github.com/cloudflare/cloudflared/releases y ponga la ruta en configs.json (tunnel.binary).');
      return;
    }
  }

  const baseUrl = 'http://localhost:' + (conf.port || 9000);
  const hostname = String(conf.hostname || '').trim();

  if (hostname) {
    const args = ['tunnel', 'run', conf.tunnelName || 'acape'];
    console.log('[*] TUNEL: iniciando cloudflared (tunel nombrado "' + (conf.tunnelName || 'acape') + '")...');
    child = spawn(bin, args, { windowsHide: true });
    mostrarUrl('https://' + hostname);
  } else {
    const args = ['tunnel', '--url', baseUrl];
    console.log('[*] TUNEL: iniciando cloudflared hacia ' + baseUrl + ' ...');
    child = spawn(bin, args, { windowsHide: true });

    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(RE_QUICK_URL);
      if (match && !notified) mostrarUrl(match[0]);
    });
    child.stderr.on('data', (chunk) => {
      buffer += String(chunk);
      const match = buffer.match(RE_QUICK_URL);
      if (match && !notified) mostrarUrl(match[0]);
    });
  }

  child.on('error', (err) => {
    console.log('[tunnel] Error al lanzar cloudflared:', err.message);
  });
  child.on('exit', (code) => {
    if (!notified) console.log('[tunnel] El proceso cloudflared termino (codigo ' + code + '). Revisa que tengas conexion a internet.');
  });

  const kill = () => {
    try { if (child) child.kill(); } catch (e) {}
  };
  process.on('exit', kill);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

module.exports = { start };