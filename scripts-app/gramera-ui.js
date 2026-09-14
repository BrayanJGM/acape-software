// COMPONENTE COMPARTIDO DE INTERFAZ DE GRAMERA
// Se usa en el panel admin (Servicios) y en la pantalla de venta (popup)
const GrameraUI = (function () {
  const bauds = [1200, 2400, 4800, 9600, 19200, 38400];
  const timers = new Set();

  function iniciar(contenedor, opts = {}) {
    const el = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
    if (!el) return null;

    el.innerHTML = `
      <div class="gramera-ui card p-4 mb-3">
        <h4><i class="fa-solid fa-weight-scale"></i> Gramera / Balanza</h4>
        <p>Conecta la gramera (Trumax, RS-232) seleccionando su puerto.</p>
        <div class="gramera-ui-estado mb-3 text-muted">Consultando estado...</div>

        <label class="fw-bold"><i class="fa-solid fa-list"></i> Puertos detectados</label>
        <p class="small text-muted">Los puertos USB (💡) son los que suelen usar las grameras.</p>
        <div class="gramera-ui-puertos mb-2"></div>

        <div class="border rounded p-2 mb-3">
          <div class="form-check">
            <input class="form-check-input gramera-ui-manual-check" type="checkbox" id="grameraManual">
            <label class="form-check-label" for="grameraManual">Puerto manual (escribe el nombre del puerto)</label>
          </div>
          <input type="text" class="form-control gramera-ui-manual-input mt-2" placeholder="COM3" disabled>
        </div>

        <label class="fw-bold">Baud rate</label>
        <select class="form-select gramera-ui-baud mb-3"></select>

        <div class="d-grid gap-2">
          <button class="btn btn-outline-success gramera-ui-conectar"><i class="fa-solid fa-plug"></i> Conectar</button>
          <button class="btn btn-outline-danger gramera-ui-desconectar"><i class="fa-solid fa-unplug"></i> Desconectar</button>
          <button class="btn btn-outline-secondary gramera-ui-actualizar"><i class="fa-solid fa-rotate"></i> Actualizar puertos</button>
        </div>
        <p class="gramera-ui-msg mt-2 mb-0 small text-muted"></p>
      </div>
    `;

    const baudSel = el.querySelector('.gramera-ui-baud');
    baudSel.innerHTML = bauds.map(b => `<option value="${b}">${b}</option>`).join('');

    const manualInput = el.querySelector('.gramera-ui-manual-input');
    const manualCheck = el.querySelector('.gramera-ui-manual-check');
    manualCheck.addEventListener('change', () => {
      manualInput.disabled = !manualCheck.checked;
      if (manualCheck.checked) manualInput.focus();
    });

    el.querySelector('.gramera-ui-conectar').addEventListener('click', () => conectar(el));
    el.querySelector('.gramera-ui-desconectar').addEventListener('click', () => desconectar(el));
    el.querySelector('.gramera-ui-actualizar').addEventListener('click', () => cargarTodo(el, true));

    cargarTodo(el);

    const timer = setInterval(() => {
      if (!document.body.contains(el)) { clearInterval(timer); return; }
      actualizarEstado(el);
    }, 3000);
    timers.add(timer);

    return el;
  }

  function cargarTodo(el, conMensaje) {
    return Promise.all([
      axios.get('/gramera/config'),
      axios.get('/gramera/ports')
    ]).then(([respConfig, respPorts]) => {
      const config = respConfig.data;
      const { ports, actual } = respPorts.data;

      el.querySelector('.gramera-ui-baud').value = config.baudRate;

      if (conMensaje) mostrarMsg(el, 'Puertos actualizados.');

      renderPuertos(el, ports, actual);
      actualizarEstado(el);
    }).catch((err) => {
      mostrarMsg(el, 'Error consultando la gramera: ' + (err.response ? err.response.data.message : err.message), true);
    });
  }

  function renderPuertos(el, ports, actual) {
    const listEl = el.querySelector('.gramera-ui-puertos');
    if (!ports || !ports.length) {
      listEl.innerHTML = `
        <div class="text-muted small py-2">
          No se detectaron puertos. Revisa el cable, comprueba el driver USB y pulsa "Actualizar puertos".
        </div>`;
      return;
    }

    const primeraUSB = ports.find(p => p.usb);

    listEl.innerHTML = ports.map(p => {
      const extras = [];
      if (p.usb) extras.push('<span class="badge bg-info">💡 USB</span>');
      if (primeraUSB && p.path === primeraUSB.path) extras.push('<span class="badge bg-success">Sugerida</span>');
      if (p.path === actual) extras.push('<span class="badge bg-secondary">Actual</span>');

      const desc = p.friendlyName || p.manufacturer || (p.usb ? 'Adaptador USB' : 'Puerto serial');

      return `
        <label class="gramera-port-option">
          <input type="radio" name="gramera-puerto" value="${p.path}" ${p.path === actual ? 'checked' : ''}>
          <span class="gramera-port-txt"><b>${p.path}</b> ${extras.join(' ')}</span>
          <span class="small text-muted">${esc(desc)}</span>
        </label>`;
    }).join('');
  }

  function conectar(el) {
    const manualCheck = el.querySelector('.gramera-ui-manual-check');
    const manualInput = el.querySelector('.gramera-ui-manual-input');
    let port = null;

    if (manualCheck.checked) {
      port = manualInput.value.trim();
    } else {
      const radio = el.querySelector('input[name="gramera-puerto"]:checked');
      port = radio ? radio.value : null;
    }

    const baud = Number(el.querySelector('.gramera-ui-baud').value);

    if (!port) return mostrarMsg(el, 'Selecciona un puerto de la lista o activa el puerto manual.', true);

    mostrarMsg(el, 'Conectando a ' + port + '...');
    axios.post('/gramera/conectar', { port, baudRate: baud }).then((resp) => {
      const result = resp.data.data || {};
      if (result.conectada) {
        Toast.fire({ text: resp.data.message || ('Conectado a ' + port), icon: 'success' });
      } else {
        Toast.fire({ text: result.error || ('No se pudo abrir ' + port + '. Revisa el puerto y el cable.'), icon: 'warning' });
      }
      cargarTodo(el);
    }).catch((err) => {
      Toast.fire({ text: 'Error conectando: ' + (err.response ? err.response.data.message : err.message), icon: 'error' });
      mostrarMsg(el, 'No se pudo conectar.', true);
    });
  }

  function desconectar(el) {
    axios.post('/gramera/desconectar', {}).then((resp) => {
      Toast.fire({ text: resp.data.message, icon: 'info' });
      cargarTodo(el);
    }).catch((err) => {
      Toast.fire({ text: 'Error desconectando: ' + (err.response ? err.response.data.message : err.message), icon: 'error' });
    });
  }

  function actualizarEstado(el) {
    const estadoEl = el.querySelector('.gramera-ui-estado');
    if (!estadoEl) return;

    axios.get('/gramera/peso').then((resp) => {
      const s = resp.data;
      let html;

      if (!s.conectada) {
        html = `
          <span class="badge bg-danger"><i class="fa-solid fa-unlink"></i> No conectada</span>
          <span class="ms-2">Conecta la gramera para empezar a pesar.</span>`;
      } else if (s.sinDatos) {
        const ultima = Array.isArray(s.lastRaw) && s.lastRaw.length ? s.lastRaw[s.lastRaw.length - 1] : null;
        html = `
          <span class="badge bg-warning text-dark"><i class="fa-solid fa-plug-circle-exclamation"></i> Puerto abierto, sin lectura</span>
          <span class="ms-2 pequeña">Revisa el cable y el modo de transmisión (CONTINUA) de la balanza.</span>` +
          (ultima ? `<div class="small text-muted mt-2">Tramas recibidas (${s.chunks || 0}): <code>${esc(ultima)}</code> ...</div>` : (s.chunks ? `<div class="small text-muted mt-2">Llegaron ${s.chunks} fragmentos pero ninguna línea completa aún...</div>` : ''));
      } else {
        const badge = s.estable
          ? '<span class="badge bg-success">Estable</span>'
          : '<span class="badge bg-warning text-dark">Pesando...</span>';
        html = `
          <span class="badge bg-success"><i class="fa-solid fa-link"></i> Conectada</span>
          <span class="ms-2">Peso: <b>${s.peso ? s.peso.toFixed(3) : "0.000"} kg</b> ${badge}</span>`;
      }

      estadoEl.innerHTML = html;
    }).catch(() => {
      estadoEl.innerHTML = `<span class="badge bg-danger">Error consultando la gramera</span>`;
    });
  }

  function mostrarMsg(el, msg, error) {
    const msgEl = el.querySelector('.gramera-ui-msg');
    if (msgEl) {
      msgEl.innerHTML = msg;
      msgEl.classList.toggle('text-danger', !!error);
      msgEl.classList.toggle('text-success', !error);
    }
  }

  function esc(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  return {
    iniciar,
    cargarTodo,
    actualizarEstado
  };
})();