// COMPONENTE COMPARTIDO DE INTERFAZ DE GRAMERA
// Se usa en el panel admin (Servicios) y en la pantalla de venta (popup)
const GrameraUI = (function () {
  const bauds = [1200, 2400, 4800, 9600, 19200, 38400];
  const timers = new Set();
  let instancias = 0;

  function iniciar(contenedor, opts = {}) {
    const el = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
    if (!el) return null;

    const uid = ++instancias;

    el.innerHTML = `
      <div class="gramera-ui card p-4 mb-3">
        <h4><i class="fa-solid fa-weight-scale"></i> Gramera / Balanza</h4>
        <p>Conecta la gramera (Trumax, RS-232) seleccionando su puerto.</p>
        <div class="gramera-ui-estado mb-3 text-muted">Consultando estado...</div>

        <div class="form-check form-switch mb-3">
          <input class="form-check-input gramera-ui-debug" type="checkbox" id="grameraDebug${uid}">
          <label class="form-check-label small" for="grameraDebug${uid}">Registrar en consola (diagnóstico)</label>
        </div>

        <label class="fw-bold"><i class="fa-solid fa-list"></i> Puertos detectados</label>
        <p class="small text-muted">Los puertos USB (💡) son los que suelen usar las grameras.</p>
        <div class="gramera-ui-puertos mb-2"></div>

        <div class="border rounded p-2 mb-3">
          <div class="form-check">
            <input class="form-check-input gramera-ui-manual-check" type="checkbox" id="grameraManual${uid}">
            <label class="form-check-label" for="grameraManual${uid}">Puerto manual (escribe el nombre del puerto)</label>
          </div>
          <input type="text" class="form-control gramera-ui-manual-input mt-2" placeholder="COM3 o /dev/pts/6" autocomplete="off">
          <div class="form-text small">Si escribes aquí, se conectará a este puerto en lugar de la lista.</div>
        </div>

        <label class="fw-bold">Baud rate</label>
        <select class="form-select gramera-ui-baud mb-3"></select>

        <div class="d-grid gap-2">
          <button class="btn btn-outline-success gramera-ui-conectar"><i class="fa-solid fa-plug"></i> Conectar</button>
          <button class="btn btn-outline-warning gramera-ui-detectar"><i class="fa-solid fa-magnifying-glass"></i> Detectar velocidad automáticamente</button>
          <button class="btn btn-outline-danger gramera-ui-desconectar"><i class="fa-solid fa-unplug"></i> Desconectar</button>
          <button class="btn btn-outline-secondary gramera-ui-actualizar"><i class="fa-solid fa-rotate"></i> Actualizar puertos</button>
        </div>

        <details class="border rounded p-3 mt-3 gramera-test-details">
          <summary class="fw-bold" style="cursor:pointer"><i class="fa-solid fa-flask-vial"></i> Validación de pesaje</summary>
          <div class="mt-2">
            <p class="small text-muted mb-2">Escribe el peso que <b>muestra la pantalla de la balanza</b> y pulsa Capturar. Usa dos pesos distintos (ej. botella de 1 L y de 2.2 L).</p>
            <div class="row g-2 align-items-end mb-1">
              <div class="col-5">
                <label class="form-label small mb-0">Test 1 (kg)</label>
                <input type="number" step="0.001" min="0.001" class="form-control form-control-sm gramera-test-input" data-test="test1" placeholder="ej. 1.000">
              </div>
              <div class="col-3">
                <button class="btn btn-sm btn-primary gramera-test-capturar" data-test="test1">Capturar</button>
              </div>
              <div class="col-4 small gramera-test-result" data-test="test1">—</div>
            </div>
            <div class="row g-2 align-items-end">
              <div class="col-5">
                <label class="form-label small mb-0">Test 2 (kg)</label>
                <input type="number" step="0.001" min="0.001" class="form-control form-control-sm gramera-test-input" data-test="test2" placeholder="ej. 2.200">
              </div>
              <div class="col-3">
                <button class="btn btn-sm btn-primary gramera-test-capturar" data-test="test2">Capturar</button>
              </div>
              <div class="col-4 small gramera-test-result" data-test="test2">—</div>
            </div>
            <div class="mt-2 p-2 rounded gramera-test-diagnostico bg-light small"></div>
            <button class="btn btn-sm btn-outline-secondary mt-2 gramera-test-reset">Limpiar pruebas</button>
          </div>
        </details>

        <details class="border rounded p-3 mt-2 gramera-trazas-details">
          <summary class="fw-bold" style="cursor:pointer"><i class="fa-solid fa-list-ul"></i> Últimas tramas (diagnóstico)</summary>
          <div class="mt-2">
            <div class="gramera-ui-trazas small"></div>
            <button class="btn btn-sm btn-outline-secondary mt-2 gramera-trazas-refrescar">Actualizar</button>
          </div>
        </details>
        <p class="gramera-ui-msg mt-2 mb-0 small text-muted"></p>
      </div>
    `;

    const baudSel = el.querySelector('.gramera-ui-baud');
    baudSel.innerHTML = bauds.map(b => `<option value="${b}">${b}</option>`).join('');

    const manualInput = el.querySelector('.gramera-ui-manual-input');
    const manualCheck = el.querySelector('.gramera-ui-manual-check');

    const activarManual = () => {
      if (!manualCheck.checked) manualCheck.checked = true;
    };
    manualInput.addEventListener('focus', activarManual);
    manualInput.addEventListener('input', activarManual);
    manualCheck.addEventListener('change', () => {
      if (manualCheck.checked) manualInput.focus();
    });

    el.querySelector('.gramera-ui-conectar').addEventListener('click', () => conectar(el));
    el.querySelector('.gramera-ui-detectar').addEventListener('click', () => detectarVelocidad(el));
    el.querySelector('.gramera-ui-desconectar').addEventListener('click', () => desconectar(el));
    el.querySelector('.gramera-ui-actualizar').addEventListener('click', () => cargarTodo(el, true));

    el.querySelector('.gramera-test-reset').addEventListener('click', () => limpiarTests(el));
    el.querySelector('.gramera-trazas-refrescar').addEventListener('click', () => cargarTrazas(el));
    el.querySelector('.gramera-ui-debug').addEventListener('change', (e) => {
      const activo = e.target.checked;
      axios.post('/gramera/debug', { activo }).then((resp) => {
        Toast.fire({ text: resp.data.mensaje || 'Actualizado', icon: activo ? 'info' : 'success' });
      }).catch(() => Toast.fire({ text: 'Error actualizando los logs', icon: 'error' }));
    });
    el.querySelectorAll('.gramera-test-capturar').forEach((btn) => {
      btn.addEventListener('click', () => capturarTest(el, btn.dataset.test));
    });
    el.querySelectorAll('.gramera-test-input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') capturarTest(el, input.dataset.test);
      });
    });

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.gramera-test-copiar');
      if (btn) copiarTexto(el, btn.dataset.copiar || '');
    });

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
      el.querySelector('.gramera-ui-debug').checked = !!config.debug;

      if (conMensaje) mostrarMsg(el, 'Puertos actualizados.');

      renderPuertos(el, ports, actual);
      actualizarEstado(el);
      cargarTests(el);
      cargarTrazas(el);
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
    const manualInput = el.querySelector('.gramera-ui-manual-input');
    let port = manualInput ? manualInput.value.trim() : '';

    if (!port) {
      const radio = el.querySelector('input[name="gramera-puerto"]:checked');
      port = radio ? radio.value : null;
    }

    const baud = Number(el.querySelector('.gramera-ui-baud').value);

    if (!port) return mostrarMsg(el, 'Selecciona un puerto de la lista o escribe un puerto manual.', true);

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

  function detectarVelocidad(el) {
    mostrarMsg(el, 'Probando velocidades (9600, 4800, 2400, 19200, 1200, 38400)... tarda unos 12 segundos.');
    const btn = el.querySelector('.gramera-ui-detectar');
    if (btn) btn.disabled = true;

    axios.get('/gramera/detectar').then((resp) => {
      const mejor = resp.data.mejor || {};
      const sel = el.querySelector('.gramera-ui-baud');
      if (mejor.baud && sel) sel.value = mejor.baud;

      const legible = !!(mejor.muestra && mejor.puntos > 0);
      Toast.fire({
        text: 'Velocidad detectada: ' + (mejor.baud || '?') + ' baud (' + (mejor.puntos || 0) + ' pts)' +
          (legible ? ' — ¡Revisa si ya lee el peso!' : ' — no se encontró señal legible en ningún baud.'),
        icon: legible ? 'success' : 'warning',
        timer: 6000
      });
      cargarTodo(el);
    }).catch((err) => {
      Toast.fire({ text: 'Error detectando: ' + (err.response ? err.response.data.message : err.message), icon: 'error' });
      mostrarMsg(el, 'No se pudo detectar la velocidad.', true);
    }).finally(() => {
      if (btn) btn.disabled = false;
    });
  }

  function cargarTests(el) {
    axios.get('/gramera/test').then((resp) => {
      const { tests, diagnostico } = resp.data || {};
      (tests || []).forEach((test) => {
        const input = el.querySelector('.gramera-test-input[data-test="' + test.id + '"]');
        if (input && test.esperado != null) input.value = test.esperado;
        renderTestResult(el, test);
      });
      renderDiagnostico(el, diagnostico);
    }).catch(() => {});
  }

  function cargarTrazas(el) {
    axios.get('/gramera/trazas').then((resp) => {
      const cont = el.querySelector('.gramera-ui-trazas');
      if (!cont) return;
      const trazas = (resp.data && resp.data.trazas) || [];
      if (!trazas.length) {
        cont.innerHTML = '<span class="text-muted">Aún no llegan tramas completas (revisa cable, modo CONTINUA y que esté conectada).</span>';
        return;
      }
      cont.innerHTML = trazas.slice().reverse().slice(0, 10).map((t) => {
        const hexa = String(t.hex || '');
        const by = Array.isArray(t.bytes) && t.bytes.length ? '[' + t.bytes.join(',') + ']' : '';
        return '<div class="border rounded p-1 mb-1">' +
          '<code style="word-break:break-all">' + esc(hexa) + '</code> ' +
          '<span class="text-muted">' + esc(by) + '</span> ' +
          '<button type="button" class="btn btn-xs btn-outline-secondary gramera-test-copiar" data-copiar="' + esc(hexa) + '">Copiar</button>' +
          '</div>';
      }).join('') + '<div class="text-muted mt-1">Últimas ' + trazas.length + ' de máximo 20 tramas almacenadas.</div>';
    }).catch(() => {
      const cont = el.querySelector('.gramera-ui-trazas');
      if (cont) cont.innerHTML = '<span class="text-danger">Error consultando las trazas</span>';
    });
  }

  function capturarTest(el, testId) {
    const input = el.querySelector('.gramera-test-input[data-test="' + testId + '"]');
    let esperado = input ? Number(input.value) : NaN;
    if (!Number.isFinite(esperado) || esperado <= 0) {
      return mostrarMsg(el, 'Escribe en el Test ' + (testId === 'test1' ? '1' : '2') + ' el peso que muestra la balanza (kg).', true);
    }

    // Si escribieron gramos (ej. 2395 en vez de 2.395) lo convertimos a kg
    let convertidoG = false;
    if (esperado >= 1000) {
      esperado = esperado / 1000;
      convertidoG = true;
      Toast.fire({ text: 'Escribiste gramos: lo convertí a ' + esperado.toFixed(3) + ' kg.', icon: 'info' });
    }
    if (convertidoG && input) input.value = String(esperado).replace('.', ',');

    axios.post('/gramera/test', { id: testId, esperado }).then((resp) => {
      const data = resp.data;
      if (!data.ok) return mostrarMsg(el, data.error || 'No se pudo capturar el test', true);

      renderTestResult(el, data.test);
      renderDiagnostico(el, data.diagnostico);

      if (data.diagnostico && data.diagnostico.verdicto === 'confirmado') {
        Toast.fire({ text: 'Pesaje validado. Listo para usar Pesar.', icon: 'success' });
      } else if (data.diagnostico && data.diagnostico.verdicto === 'pendiente') {
        const siguiente = testId === 'test1' ? '2' : '1';
        Toast.fire({ text: 'Test ' + (testId === 'test1' ? '1' : '2') + ' capturado. Ahora captura el Test ' + siguiente + ' con otro peso.', icon: 'info', timer: 4000 });
      } else if (data.diagnostico) {
        Toast.fire({ text: data.diagnostico.mensaje || 'No concuerda', icon: 'warning', timer: 6000 });
      }
    }).catch((err) => {
      mostrarMsg(el, 'Error guardando el test: ' + (err.response ? err.response.data.error : err.message), true);
    });
  }

  function limpiarTests(el) {
    axios.post('/gramera/test/reset', {}).then(() => {
      el.querySelectorAll('.gramera-test-input').forEach((i) => (i.value = ''));
      el.querySelectorAll('.gramera-test-result').forEach((s) => (s.innerHTML = '—'));
      renderDiagnostico(el, { verdicto: 'pendiente', mensaje: '' });
      Toast.fire({ text: 'Pruebas limpiadas', icon: 'info' });
    }).catch(() => mostrarMsg(el, 'Error limpiando las pruebas', true));
  }

  function renderTestResult(el, test) {
    const span = el.querySelector('.gramera-test-result[data-test="' + test.id + '"]');
    if (!span) return;
    if (test.esperado == null) { span.innerHTML = '—'; return; }

    const sinLectura = test.leido == null;
    const diff = sinLectura ? null : ((test.leido - test.esperado) / test.esperado) * 100;
    const color = diff == null ? '' : (Math.abs(diff) < 1 ? 'text-success' : 'text-danger');

    const frameHex = String(test.hex || '').trim();
    const frameHtml = frameHex
      ? '<br><code class="small mt-1 d-block" style="word-break:break-all">' + esc(frameHex) + '</code>' +
        '<button type="button" class="btn btn-xs btn-outline-secondary mt-1 gramera-test-copiar" data-copiar="' + esc(frameHex) + '">Copiar trama</button>'
      : '';

    span.innerHTML =
      'Esperado: <b>' + test.esperado.toFixed(3) + '</b> kg<br>' +
      'Leído: <b>' + (sinLectura ? 'sin lectura' : test.leido.toFixed(3) + ' kg') + '</b>' +
      (diff == null ? '' : '<br><span class="' + color + '">Δ ' + diff.toFixed(1) + '%</span>') +
      frameHtml;
  }

  function copiarTexto(el, texto) {
    const done = () => Toast.fire({ text: 'Trama copiada', icon: 'success' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(done).catch(() => mostrarMsg(el, 'No se pudo copiar la trama', true));
    } else {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { mostrarMsg(el, 'No se pudo copiar la trama', true); }
      document.body.removeChild(ta);
    }
  }

  function renderDiagnostico(el, diag) {
    const cont = el.querySelector('.gramera-test-diagnostico');
    if (!cont) return;
    if (!diag || !diag.verdicto) { cont.innerHTML = ''; return; }

    const badges = {
      confirmado: '<span class="badge bg-success"><i class="fa-solid fa-check"></i> Confirmado</span>',
      factor_constante: '<span class="badge bg-warning text-dark"><i class="fa-solid fa-triangle-exclamation"></i> Factor de escala</span>',
      desplazamiento: '<span class="badge bg-warning text-dark"><i class="fa-solid fa-triangle-exclamation"></i> Desplazamiento</span>',
      incoherente: '<span class="badge bg-danger"><i class="fa-solid fa-xmark"></i> Incoherente</span>',
      pendiente: '<span class="badge bg-secondary"><i class="fa-solid fa-hourglass-half"></i> Pendiente</span>'
    };
    cont.innerHTML = (badges[diag.verdicto] || '') + '<span class="ms-2">' + esc(diag.mensaje || '') + '</span>';
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
        const muestra = String(s.bufferRaw || '').replace(/[^\x20-\x7E]/g, '.');
        const hexa = String(s.hex || '');
        const dec = Array.isArray(s.bytes) ? s.bytes.join(',') : '';
        html = `
          <span class="badge bg-warning text-dark"><i class="fa-solid fa-plug-circle-exclamation"></i> Puerto abierto, sin lectura</span>
          <span class="ms-2 pequeña">Baud ${s.baudRate || '?'}. Revisa el cable y el modo CONTINUA de la balanza.</span>` +
          (ultima ? `<div class="small text-muted mt-2">Tramas recibidas (${s.chunks || 0}): <code>${esc(ultima)}</code> ...</div>` : '') +
          (muestra ? `<div class="small text-muted mt-1">Bytes: ${s.chunks || 0} fragmentos — <code>${esc(muestra)}</code><br><code>${esc(hexa)}</code><br><code>${esc(dec)}</code></div>` : '');
      } else {
        const badge = s.estable
          ? '<span class="badge bg-success">Estable</span>'
          : '<span class="badge bg-warning text-dark">Pesando...</span>';
        html = `
          <span class="badge bg-success"><i class="fa-solid fa-link"></i> Conectada</span>
          <span class="ms-2">Peso: <b>${s.peso ? s.peso.toFixed(3) : "0.000"} kg</b> ${badge}</span>`;
      }

      estadoEl.innerHTML = html;

      const details = el.querySelector('.gramera-test-details');
      if (details && s.sinDatos) details.setAttribute('open', '');
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