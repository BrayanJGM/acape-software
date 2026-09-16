const router = new Router('ACAPE Software', {
  nameweb: "ACAPE Software",
  app: ".app",
  error_404: "<h1>Error, Pagina deshabilitada</h1>"
});
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
  showClass: {
    popup: '' // Desactivar animación de entrada
  },
  hideClass: {
    popup: '' // Desactivar animación de salida
  }
});

axios.defaults.timeout = 1000000;

const socket = {
  events: [],
  eventsOnce: [],
  fullListener: [],
  errorFunc: console.log,
  emit: (name, data) => {
    axios.post(`/${name}`, data).then((then_data) => {
      let findingEventOnce = socket.eventsOnce.find(ch => ch.name == name);
      let findingEvent = socket.events.find(ch => ch.name == name);
      let findingListener = socket.fullListener.find(ch => ch.name == name);
      if (findingListener) {
        findingEvent.func(then_data.data);
      }

      socket.findingListener(name, then_data.data);

      if (!findingEvent) {
        if (!findingEventOnce) return;

        findingEventOnce.func.map(ch => ch(then_data.data));

        socket.eventsOnce.forEach((element, i, array) => {
          if (element.name == name) {
            array.splice(i, 1);
            socket.eventsOnce = array;
          }
        })

        return;
      };

      sessionStorage.setItem(name, JSON.stringify(then_data));

      findingEvent.func.forEach((element) => { element(then_data.data) });
    }).catch(socket.errorFunc)
  },
  on: (name, func) => {
    let findingEvent = socket.events.find(ch => ch.name === name);
    if (!findingEvent) {
      socket.events.push({ name: name, func: [func] });
    } else {
      socket.events.forEach((element, i, array) => {
        if (element.name === name) {
          if (array[i].reproach) {
            console.log('Si se hizo un reproach')
            let event_reproach = socket.events.find(ch => ch.name == array[i].reproach);
            if (event_reproach) event_reproach.func.map(ch => ch(then_data.data))
          } else {
            array[i].func.push(func);
          }
        }
      })
    }
  },
  once: (name, func) => {
    let findingEvent = socket.eventsOnce.find(ch => ch.name === name);
    if (!findingEvent) {
      socket.eventsOnce.push({ name: name, func: [func] });
    } else {
      socket.eventsOnce.forEach((element, i, array) => {
        if (element.name === name) {
          array[i].func.push(func);
        }
      })
    }
  },
  setMultipleListener: (name_rule, final_listener) => {
    socket.fullListener.push({ name: final_listener, rules: name_rule });
  },
  findingListener: (name, data) => {
    let final_retro;
    socket.fullListener.forEach((element, i, array) => {
      if (element.rules.find(ch => ch == name)) {
        let findingEvent = socket.events.find(ch => ch.name == element.name);
        if (!findingEvent) return;

        findingEvent.func.map(ch => ch(data));
      }
    })
  }
};

function openCashDrawer() {
  socket.emit('openCashDrawer', { data: "message" })
}

function toggleNavbar(d) {
  document.querySelector(d ? d : '.dropdown-menu-personalizado').classList.toggle('drop')
}

const alert = Swal.mixin({
  customClass: {
    popup: 'shadow',
    confirmButton: 'btn btn-outline-primary',
    cancelButton: 'btn btn-outline-danger'
  },
  confirmButtonText: "Aceptar",
  cancelButtonText: "Cancelar",
  buttonsStyling: false,
  showClass: {
    popup: '' // Desactivar animación de entrada
  },
  hideClass: {
    popup: '' // Desactivar animación de salida
  },
  inputAttributes: {
    class: "numberify-input-commas",
    type: "text"
  }
});


// SOCKETS ON LISTENER ------------------------------------------------------------
socket.on('token_validation', (data) => {
  if (!data.data) {
    alert.close()
    popup.open({
      title: "Token Invalido",
      content: `
        <p>El token actual es invalido y no se puede seguir usando hasta que se pague la suscripción. Recuerda que puedes cancelar 2 o mas suscripciones al tiempo.</p>
        <button class="btn btn-outline-info" onclick="validTokenPopup()"><i class="fa-solid fa-square-plus"></i> Tengo otra suscripción</button>
      `,
      close: false
    })
    let validateButton = document.querySelector('.validate-button') ? document.querySelector('.validate-button') : {};
    validateButton.innerHTML = "Validar";
    popup.setNotification('El token es invalido');
  } else {
    alert.close()
    localStorage.setItem('acape-data-principal', JSON.stringify({ token: data.data.token, timeRest: data.data.timeRest }));
  }
})


const popup = new alerter('.alerter');
popup.start()

function converterArray(object) {
  let keys = Object.keys(object);
  let arrayToReturn = [];

  keys.forEach((element, i, array) => {
    arrayToReturn.push(object[element]);
  })

  return arrayToReturn;
}

// POPUP -----------------------------------------------------------------------------

function setSubmitCaja(e) {
  localStorage.setItem('caja', JSON.stringify({
    value: Number(removeCommaSeparators(e[0].value)),
    ventas_hechas: [],
    total_recibido: 0,
    egresos: [],
    ventas_eliminadas: [],
    date: new Date() - 0,
    value_egresos: 0,
    starting: Number(removeCommaSeparators(e[0].value)),
    ingresos: [],
    ingreso: 0,
    egreso: 0
  }));

  popup.close();

  return false;
}

function registCaja(venta, total_recibido) {
  let caja = localStorage.getItem('caja');
  if (!caja) setSubmitCaja([{ value: 0 }]);

  let data = JSON.parse(localStorage.getItem('caja'));
  data.value = data.value + Number(total_recibido);
  data.ventas_hechas.push(venta);
  data.total_recibido = Number(data.total_recibido) + Number(total_recibido);

  localStorage.setItem('caja', JSON.stringify(data));

  return data;
}

function registCajaDigital(venta, total_recibido){
  let caja = localStorage.getItem('caja');
  if (!caja) setSubmitCaja([{ value: 0 }]);

  let data = JSON.parse(localStorage.getItem('caja'));
  data.value_digital = (data.value_digital?data.value_digital:0) + Number(total_recibido);
  data.total_recibido = Number(data.total_recibido) + Number(total_recibido);

  localStorage.setItem('caja', JSON.stringify(data));

  return data;
}

function registCajaMinus(venta, total_recibido) {
  let caja = localStorage.getItem('caja');
  if (!caja) setSubmitCaja([{ value: 0 }]);

  let data = JSON.parse(localStorage.getItem('caja'));
  data.value = data.value - Number(total_recibido);

  data.value_egresos = Number(data.value_egresos) + Number(total_recibido);
  data.ventas_eliminadas.push(venta);

  localStorage.setItem('caja', JSON.stringify(data));

  return data;
}

function createIngreso(venta, total_recibido) {
  let caja = localStorage.getItem('caja');
  if (!caja) setSubmitCaja([{ value: 0 }]);

  let data = JSON.parse(localStorage.getItem('caja'));
  data.value = data.value + Number(total_recibido);

  data.ingresos.push(venta);
  data.ingreso = Number(data.ingreso) + Number(total_recibido);

  localStorage.setItem('caja', JSON.stringify(data));
  openCashDrawer();

  axios.post('/whatsapp/ingreso', {token: sessionStorage.getItem('acape-session'), data: venta});

  return data;
}

function createEgreso(venta, total_recibido) {
  let caja = localStorage.getItem('caja');
  if (!caja) setSubmitCaja([{ value: 0 }]);

  let data = JSON.parse(localStorage.getItem('caja'));
  data.value = data.value - Number(total_recibido);

  data.egreso = Number(data.egreso) + Number(total_recibido);
  data.egresos.push(venta);

  localStorage.setItem('caja', JSON.stringify(data));
  openCashDrawer()

  axios.post('/whatsapp/gasto', {token: sessionStorage.getItem('acape-session'), data: venta});

  return data;
}

function addCommaSeparators(input) {
  let value = input.value;

  // Mantener el signo negativo al inicio si existe
  let isNegative = value.startsWith('-');
  let numericValue = value.replace(/[^0-9]/g, '');

  if (numericValue === '') {
    input.value = isNegative ? '-' : '';
    return;
  }

  let withCommas = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  input.value = (isNegative ? '-' : '') + withCommas;
}


function removeCommaSeparators(input) {
  return input.replace(/,/g, '');
}

document.addEventListener('input', function(e) {
  if (e.target.classList.contains('numberify-input-commas')) {
    addCommaSeparators(e.target);
  }
});

function toggleNavigator() {
  document.querySelector('.navigator').classList.toggle('active');
}

function sessionValidator() {
  let sesion = sessionStorage.getItem('acape-session');
  let caja = localStorage.getItem('caja');
  if (!caja) {
    popup.open({
      title: "Caja",
      content: `
        <form onsubmit="return setSubmitCaja(this)">
          <label>Agrega el total que hay de dinero en caja</label>
          <input type="text" placeholder="60,000" class="numberify-input-commas form-control" required>
          <br>
          <button class="btn btn-outline-primary">Aceptar</button>
        </form>
      `,
      close: false
    })
  }

  if (document.querySelector('.aplication')) return null;

  if (!sesion) return null;
  let data = sesion;
  socket.emit('session-validator', { token: data });

  socket.once('session-validator', (data) => {
    if (!data.data) {
      Toast.fire({
        text: data.message,
        icon: "error"
      })
      sessionStorage.removeItem('acape-session');
      location.hash = "#/invalid-user";
    };
    Toast.fire({
      text: data.message,
      icon: data.type ? data.type : "success"
    })

    let userPerms = data.role;

    document.querySelector('.menu').innerHTML = `
      <div class="aplication">
        <div class="final-navbar-phone">
          <div class="navbar-title">Acape Software</div>
          <div class="navbar-toggler">
            <div onclick="toggleNavigator()" class="navbar-toggler-icon toggler-icon">☰</div>
          </div> 
        </div>
        <nav class="navigator">
          <div class="logos text-center">
            <a href="#" class="navbar-brand-title">ACAPE Software</a>
          </div>

          <ul class="list-navbar">
          <li class="item-navbar">
              <a href="#/" class="active">
                  <i class="fa-solid fa-house"></i>
                  <div class="disabled-cel"><span>Principal</span></div>
              </a>
          </li>
          <li class="item-navbar">
              <a href="#/pedidos">
                  <i class="fa-solid fa-rug"></i>
                  <div class="disabled-cel">Pedidos</div>
              </a>
          </li>    <li class="item-navbar">
              <a class="item-navbar toggle-navbar" onclick="toggleNavbar('.administrator-menu')">
                  <i class="fa-solid fa-sliders"></i>
                  <div class="disabled-cel">Administración <span class="change-rotation">
                      <span class="set-right">&#9660;</span>
                  </span></div>
              </a>
              <ul class="dropdown-menu-personalizado administrator-menu">
                      ${userPerms['productManager'] || userPerms['all'] ? `
                      <li class="item-navbar">
                          <a href="#/productos">
                              <i class="fa-solid fa-shop"></i>
                              <div class="disabled-cel">Productos</div>
                          </a>
                      </li>` : ""}
                      ${userPerms['facturar'] || userPerms['all'] ? `
                      <li class="item-navbar">
                          <a href="#/clientes">
                              <i class="fa-regular fa-user"></i>
                              <div class="disabled-cel">Clientes</div>
                          </a>
                      </li>` : ""}
                      <li class="item-navbar">
                          <a href="#/deudores">
                              <i class="fa-solid fa-person-circle-exclamation"></i>
                              <div class="disabled-cel">Deudores</div>
                          </a>
                      </li>
                      ${userPerms['userManager'] || userPerms['all'] ? `
                      <li class="item-navbar">
                          <a href="#/config">
                              <i class="fa-solid fa-gear"></i>
                              <div class="disabled-cel">Configuraciones</div>
                          </a>
                      </li>` : ""}
                      ${userPerms['all'] ? `
                      <li class="item-navbar">
                          <a href="/app">
                              <i class="fa-solid fa-mobile-screen-button"></i>
                              <div class="disabled-cel">Aplicación Administrativa</div>
                          </a>
                      </li>
                      <li class="item-navbar">
                          <a href="/zopelapp">
                              <i class="fa-solid fa-mobile-screen-button"></i>
                              <div class="disabled-cel">Zopelapp / Bodega</div>
                          </a>
                      </li>
                      ` : ""}
                  </ul>
              </li>
              <li class="item-navbar">
                  <a href="#/caja">
                      <i class="fa-solid fa-coins"></i>
                      <div class="disabled-cel">Caja</div>
                  </a>
              </li>
              ${(userPerms['facturar'] || userPerms['all']) ? `
              <li class="item-navbar">
                  <a href="#/facturero">
                      <i class="fa-solid fa-file"></i>
                      <div class="disabled-cel">Facturero</div>
                  </a>
              </li>` : ""}
              <li class="item-navbar">
                  <a href="#/user">
                      <i class="fa-solid fa-user"></i>
                      <div class="disabled-cel">Usuario</div>
                  </a>
              </li>
          </ul>

        </nav>
      </div>
      `;
    document.querySelector('.app').classList.add('active')
  })
}

function deleteMethod(name) {
  let token = sessionStorage.getItem('acape-session');

  alert.fire({
    title: `Eliminar ${name}`,
    text: "¿Estas seguro de eliminarlo?",
    icon: "info"
  }).then((result) => {
    if (result.isConfirmed) {
      socket.emit('deleteMethodPay', {
        method: name,
        token: token
      })

      socket.once('deleteMethodPay', (data) => {
        if (!data.data) return Toast.fire({
          text: data.message,
          icon: "error"
        });


        Toast.fire({
          text: data.message,
          icon: "success"
        })

        updateMethods();
      })
    }
  })
}

function updateMethods() {
  socket.emit('getMethods');

  socket.on('getMethods', (data) => {
    let pay_methods = converterArray(data);
    document.querySelector('.list-pay-methods').innerHTML = `${pay_methods.map(ch => `
      <div class="card">
        <div class="card-header">${ch.name} - <div class="digital-input">${ch.type}</div></div>
        <div class="card-body">
          <p>${ch.desc}</p>
          <button class="btn btn-outline-danger" onclick="deleteMethod('${ch.name}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
        </div>
      </div>
    `)}`;
  })
}

function sendCreateMethod(e) {
  let data = {
    name: e[0].value,
    type: e[1].value,
    desc: e[2].value
  }
  let token = sessionStorage.getItem('acape-session');

  socket.emit('createMethodPay', { method: data, token: token });

  socket.once('createMethodPay', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    Toast.fire({
      text: data.message,
      icon: "success"
    })
    popup.start();

    updateMethods();
  })

  return false;
}

function createMethod() {
  popup.open({
    title: "Crear Metodo De Pago",
    content: `
      <form class="creating-method-pay" onsubmit="return sendCreateMethod(this)">
        <label htmlFor="">Nombre</label>
        <input type="text" requred class="form-control" placeholder="Ejem: Nequi">
        <label htmlFor="">Tipo</label>
        <select name="" class="form-select" value="efectivo">
          <option value="efectivo">efectivo</option>
          <option value="digital">digital</option>
        </select>
        <label htmlFor="">Descripción</label>
        <textarea name="" required class="form-control" id="" placeholder="Descripción del metodo"></textarea>
        <br>
        <button class="btn btn-outline-primary w-100"><i class="fa-solid fa-floppy-disk"></i> Guardar Metodo</button>
      </form>
    `
  })
}

router.get('/methods', () => {
  sessionValidator();
  updateMethods();

  return `<div class="methods-pay my-2 container">
    <h1 class="text-center">Metodos de pago</h1>
    <p class="text-center">Agregale metodos de pago a tu negoció</p>
    <div class="text-center">
      <button class="btn btn-outline-primary" onclick="createMethod()"><i class="fa-solid fa-money-bill-transfer"></i> Crear Metodo De Pago</button>
    </div>
    <br>

    <div class="list-pay-methods"></div>
  </div>`;
});


// FORMS SUBMITS ---------------------------------------------------------------------
function sendValidationToken(e) {
  socket.emit('token_validation', { token: e[0].value });

  let validateButton = document.querySelector('.validate-button');
  validateButton.innerHTML = `<div class="center-x"><div class="loader-validate-button"></div></div>`;

  return false;
}

function loginFunc(e) {
  let data = {
    user: e[0].value,
    password: e[1].value
  }

  socket.emit('login-acape', data);

  return false;
}


// LISTENING SOCKETS -------------------------------------------------------------------
socket.on('login-acape', (data) => {
  if (!data.data) return Toast.fire({
    text: data.message,
    icon: "error"
  });
  sessionStorage.setItem('acape-session', data.data.token);
  location.reload()
})

// ROUTER FUNCTIONS --------------------------------------------------

function setListProduct(data, desdePesaje = false) {
  let products = JSON.parse(sessionStorage.getItem('products'));

  let array_products = converterArray(products)
  let findingProduct = array_products.find(ch => ch.id == data);

  if (!findingProduct) return Toast.fire({
    title: "Manager de productos",
    text: "El producto no se encuentra registrado en el sistema o fue eliminado.",
    icon: "error"
  });

  if (esDePeso(findingProduct) && !desdePesaje) {
    abrirPesajePopup(data, 'agregar');
    return;
  }

  document.querySelector('.reseting-listing').value = '';
  document.querySelector('.searching').innerHTML = '';

  let listing = sessionStorage.getItem('actually-list-products');
  if (!listing) sessionStorage.setItem('actually-list-products', JSON.stringify([]));

  let actuallyListing = listing ? JSON.parse(listing) : [];

  let findingProduct2 = actuallyListing.find(ch => ch.name == findingProduct.name);
  if (findingProduct2) {
    actuallyListing.forEach((element, i, array) => {
      if (element.name == findingProduct2.name) {
        element.cantidad = element.cantidad ? element.cantidad : 0;
        element.cantidad = element.cantidad + 1;
        array[i] = element;
        sessionStorage.setItem('actually-list-products', JSON.stringify(array));
      }
    })
  } else {
    if (!findingProduct.price) {
      findingProduct.cantidad = 1;
      alert.fire({
        title: "Precio",
        input: "text",
        inputAttributes: {
          'class': 'numberify-input-commas',
          'placeholder': 'Ejem: 10,000'
        },
        preConfirm: (value) => {
          let rawValue = value.replace(/,/g, '');
          return rawValue;
        },
        didOpen: () => {
          // Add event listener to the input once the Swal is open
          const input = Swal.getInput();
          input.addEventListener('input', function() {
            addCommaSeparators(this);
          });
        }
      }).then((element) => {
        if (element.isConfirmed) {
          findingProduct.cantidad = null;
          findingProduct.price = removeCommaSeparators(element.value);
          actuallyListing.push(findingProduct);
          sessionStorage.setItem('actually-list-products', JSON.stringify(actuallyListing));
          listingProducts();
        }
      })
    } else {
      if (findingProduct.stock == null) {
        findingProduct.cantidad = 1;
        actuallyListing.push(findingProduct);
        sessionStorage.setItem('actually-list-products', JSON.stringify(actuallyListing));
        listingProducts();
        return;
      }
      if (findingProduct.stock < 1) return Toast.fire({
        title: "Manager de productos",
        text: "Al parecer no hay cantidad de este producto.",
        icon: "error"
      });
      findingProduct.cantidad = 1;
      actuallyListing.push(findingProduct);
      sessionStorage.setItem('actually-list-products', JSON.stringify(actuallyListing));
    }
  }

  listingProducts();
}

function setListEntrada(data) {
  let products = JSON.parse(sessionStorage.getItem('products'));

  let array_products = converterArray(products)
  let findingProduct = array_products.find(ch => ch.id == data);

  if (!findingProduct) return Toast.fire({
    title: "Manager de productos",
    text: "El producto no se encuentra registrado en el sistema o fue eliminado.",
    icon: "error"
  });

  document.querySelector('.reseting-listing').value = '';
  document.querySelector('.searching').innerHTML = '';

  let listing = sessionStorage.getItem('entrada-almacen');
  if (!listing) sessionStorage.setItem('entrada-almacen', JSON.stringify([]));

  let actuallyListing = listing ? JSON.parse(listing) : [];

  let findingProduct2 = actuallyListing.find(ch => ch.name == findingProduct.name);
  if (findingProduct2) {
    actuallyListing.forEach((element, i, array) => {
      if (element.name == findingProduct2.name) {
        element.cantidad = element.cantidad ? element.cantidad : 0;
        element.cantidad = element.cantidad + 1;
        array[i] = element;
        sessionStorage.setItem('entrada-almacen', JSON.stringify(array));
      }
    })
  } else {
    findingProduct.cantidad = 1;
    alert.fire({
      title: "Precio",
      input: "number"
    }).then((element) => {
      if (element.isConfirmed) {
        findingProduct.cantidad = 1;
        findingProduct.price = element.value;
        actuallyListing.push(findingProduct);
        sessionStorage.setItem('entrada-almacen', JSON.stringify(actuallyListing));
        listingEntrada();
      }
    });
  }

  listingEntrada();
}

function inputVentas(e) {
  let actuallyProducts = JSON.parse(sessionStorage.getItem('products') ? sessionStorage.getItem('products') : "{}");

  let array_products = converterArray(actuallyProducts);
  let filtering = array_products.filter(ch => {
    return ch.name.toLowerCase().includes(e.value.toLowerCase()) || ch.id.toString().includes(e.value.toLowerCase());
  });
  if (e.value == "") return document.querySelector('.searching').innerHTML = '';
  document.querySelector('.searching').innerHTML = `
    <div class="buscando">
      ${filtering.map(ch => `<div onclick="setListProduct('${ch.id}')" class="sill-btn">#${ch.id} <b>${ch.name}</b> - ${formatNumber(ch.price?ch.price:"?")}</div>`).join('')}
    </div>
  `;
}

function deleteList(id) {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);

  productList.forEach((element, i, array) => {
    if (element.id == id) {
      array.splice(i, 1);
      sessionStorage.setItem('actually-list-products', JSON.stringify(array));
    }
  })

  listingProducts();
}

// GRAMERA (BALANZA): CAPTURA EL PESO ACTUAL Y LO PONE COMO CANTIDAD DEL PRODUCTO
// POPUP DE PESAJE: ESPERA EL PESO ESTABLE Y SE CONFIRMA CON ENTER
let _pesajePopupAbierto = false;
let _pesajePopupTimer = null;
let _pesajePopupId = null;
let _pesajePopupModo = 'agregar';
let _pesajePopupPeso = null;
let _pesajePopupProducto = null;

// INDICA SI UN PRODUCTO SE VENDE POR PESO (GRAMERA), acepta "true", true o 1
function esDePeso(product) {
  if (!product) return false;
  let v = product.venta_por_peso;
  return v === true || v === 1 || v === "true" || String(v).toLowerCase() === "true";
}

function abrirPesajePopup(id, modo = 'agregar') {
  let products = JSON.parse(sessionStorage.getItem('products') || "{}");
  let product = converterArray(products).find(ch => ch.id == id);
  if (!product) return Toast.fire({ text: "Producto no encontrado.", icon: "error" });

  if (_pesajePopupAbierto) return Toast.fire({ text: "Ya hay un pesaje en curso.", icon: "info" });

  _pesajePopupAbierto = true;
  _pesajePopupId = id;
  _pesajePopupModo = modo;
  _pesajePopupPeso = null;
  _pesajePopupProducto = product;

  popup.open({
    title: `Pesaje: ${product.name}`,
    close: false,
    content: `
      <div class="pesaje-rapido">
        <p class="small text-muted">Coloca el producto en la gramera y espera a que el peso se estabilice. Luego presiona Enter para ${modo == 'agregar' ? 'agregarlo a la venta' : 'guardar el pesaje'}.</p>
        <div class="pesaje-peso">— kg</div>
        <div class="pesaje-precio">
          <div class="pesaje-precio-unitario">Precio: $ ${formatNumber(product.price || 0)} / kg</div>
          <div class="pesaje-precio-total" id="pesajeTotal">Total: $ —</div>
        </div>
        <div class="pesaje-estado"><span class="spinner-border spinner-border-sm me-1"></span>Pesando…</div>
        <button class="btn btn-outline-success d-block w-100 mt-3" id="btnConfirmarPesaje" disabled onclick="confirmarPesajeRapido()">
          <i class="fa-solid fa-check"></i> ${modo == 'agregar' ? "Agregar (Enter)" : "Guardar peso (Enter)"}
        </button>
        <button class="btn btn-outline-secondary d-block w-100 mt-2" onclick="cancelarPesajePopup()">Cancelar (Esc)</button>
      </div>
    `
  });

  pesajePopupTick();
  _pesajePopupTimer = setInterval(pesajePopupTick, 400);
}

function pesajePopupTick() {
  let elPeso = document.querySelector('.pesaje-peso');
  if (!elPeso) {
    clearInterval(_pesajePopupTimer);
    return;
  }

  axios.get('/gramera/peso').then((resp) => {
    const data = resp.data;
    let elEstado = document.querySelector('.pesaje-estado');
    let btn = document.querySelector('#btnConfirmarPesaje');
    let elTotal = document.querySelector('#pesajeTotal');

    if (!data.conectada) {
      elPeso.innerHTML = '— kg';
      if (elTotal) elTotal.innerHTML = 'Total: $ —';
      if (elEstado) { elEstado.innerHTML = '<i class="fa-solid fa-plug-circle-xmark"></i> Gramera no conectada'; elEstado.className = "pesaje-estado pesaje-error"; }
      if (btn) btn.disabled = true;
      return;
    }
    if (data.sobrecarga) {
      elPeso.innerHTML = '— kg';
      if (elTotal) elTotal.innerHTML = 'Total: $ —';
      if (elEstado) { elEstado.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sobrecarga en la gramera'; elEstado.className = "pesaje-estado pesaje-error"; }
      if (btn) btn.disabled = true;
      return;
    }

    let actual = Number(Number(data.peso).toFixed(3));
    elPeso.innerHTML = `${actual} kg`;
    if (elTotal) {
      let precio = Number(_pesajePopupProducto && _pesajePopupProducto.price || 0);
      elTotal.innerHTML = `Total: $ ${formatNumber(actual * precio)}`;
    }

    if (data.estable) {
      _pesajePopupPeso = actual;
      if (elEstado) { elEstado.innerHTML = '<i class="fa-solid fa-circle-check"></i> Peso estable'; elEstado.className = "pesaje-estado pesaje-ok"; }
      if (btn) btn.disabled = false;
    } else {
      if (elEstado) { elEstado.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Pesando…'; elEstado.className = "pesaje-estado"; }
      if (btn) btn.disabled = true;
    }
  }).catch(() => {
    let elEstado = document.querySelector('.pesaje-estado');
    let elTotal = document.querySelector('#pesajeTotal');
    if (elTotal) elTotal.innerHTML = 'Total: $ —';
    if (elEstado) { elEstado.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error leyendo la gramera'; elEstado.className = "pesaje-estado pesaje-error"; }
  });
}

function aplicarPesaje(id, peso, modo) {
  let list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  if (modo == 'agregar') {
    setListProduct(id, true);
    list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  }
  list.forEach((el) => { if (el.id == id) el.cantidad = peso; });
  sessionStorage.setItem('actually-list-products', JSON.stringify(list));
  listingProducts();
}

function confirmarPesajeRapido() {
  if (!_pesajePopupAbierto) return;
  if (_pesajePopupPeso == null) return Toast.fire({ text: "Espera a que el peso se estabilice.", icon: "info" });

  let id = _pesajePopupId;
  let peso = _pesajePopupPeso;
  let modo = _pesajePopupModo;

  let product = converterArray(JSON.parse(sessionStorage.getItem('products') || "{}")).find(ch => ch.id == id);

  cerrarPesajePopup();
  aplicarPesaje(id, peso, modo);
  enfocarBuscador();

  if (product) {
    let precioFinal = Number(product.price || 0) * peso;
    Toast.fire({ text: `${product.name} · ${peso} kg → $ ${formatNumber(precioFinal)}`, icon: "success" });
  }
}

function cancelarPesajePopup() {
  if (!_pesajePopupAbierto) return;
  cerrarPesajePopup();
  Toast.fire({ text: "Pesaje cancelado.", icon: "info" });
  enfocarBuscador();
}

function cerrarPesajePopup() {
  clearInterval(_pesajePopupTimer);
  _pesajePopupTimer = null;
  _pesajePopupAbierto = false;
  _pesajePopupId = null;
  _pesajePopupModo = 'agregar';
  _pesajePopupPeso = null;
  _pesajePopupProducto = null;
  popup.close();
}

function pesarProducto(id) {
  abrirPesajePopup(id, 'pesar');
}

document.addEventListener('keydown', (event) => {
  if (!_pesajePopupAbierto) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopImmediatePropagation();
    confirmarPesajeRapido();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelarPesajePopup();
  }
});

// ATAJOS DE TECLADO: VENTA RÁPIDA DESDE LA PANTALLA PRINCIPAL

function normalizarTecla(t) {
  return String(t || '').trim().toLowerCase();
}

function renderAtajos() {
  let cont = document.querySelector('.atajos-productos');
  if (!cont) return;

  let products = JSON.parse(sessionStorage.getItem('products') || "{}");
  let porTecla = {};
  converterArray(products).forEach(ch => {
    let tk = normalizarTecla(ch.tecla);
    if (!tk || !ch) return;
    if (!porTecla[tk] || Number(ch.id) < Number(porTecla[tk].id)) porTecla[tk] = ch;
  });

  let atajos = Object.keys(porTecla).sort().map(tk => porTecla[tk]);

  if (!atajos.length) {
    cont.innerHTML = `<p class="small text-muted text-center">Para vender rápido, asigna teclas a tus productos (ficha del producto → “Tecla de acceso rápido”). También puedes usar el buscador.</p>`;
    return;
  }

  cont.innerHTML = atajos.map(ch => {
    let precio = ch.price ? formatNumber(ch.price) : "?";
    let icono = esDePeso(ch) ? '<i class="fa-solid fa-weight-scale" title="Por peso"></i> ' : "";
    return `
      <button class="atajo" data-tecla="${ch.tecla}" onclick="agregarPorTecla('${ch.id}')" title="${ch.name}">
        <span class="atajo-tecla">${ch.tecla.toUpperCase()}</span>
        <span class="atajo-nombre">${ch.name}</span>
        <span class="atajo-precio">${icono}${precio}</span>
      </button>`;
  }).join('');
}

function agregarPorTecla(id, tecla) {
  let products = JSON.parse(sessionStorage.getItem('products') || "{}");
  let product = converterArray(products).find(ch => ch.id == id);
  if (!product) return Toast.fire({ text: "Producto no encontrado.", icon: "error" });

  let key = tecla || normalizarTecla(product.tecla);
  let tile = document.querySelector(`.atajo[data-tecla="${key}"]`);
  if (tile) {
    tile.classList.add('atajo-press');
    setTimeout(() => tile.classList.remove('atajo-press'), 400);
  }

  if (esDePeso(product)) {
    abrirPesajePopup(id, 'agregar');
    return;
  }

  setListProduct(id);
}

document.addEventListener('keydown', (event) => {
  let atajos = document.querySelector('.atajos-productos');
  if (!atajos) return;

  if (document.querySelector('.overlay.active')) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
  if (event.key == 'Escape') return;

  let input = document.querySelector('.reseting-listing');
  let focoEnBuscador = !!input && document.activeElement === input;

  if (event.key == 'Enter') {
    if (!focoEnBuscador) return;
    event.preventDefault();
    let valor = (input.value || '').trim();
    if (valor) {
      buscarRapido(valor);
    } else {
      facturacion();
    }
    return;
  }

  let tecla = normalizarTecla(event.key);
  if (!tecla) return;

  let esOtroInput = event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && !focoEnBuscador;
  if (esOtroInput) return;
  if (focoEnBuscador && (input.value || '').trim() !== '') return;

  let product = productoPorTecla(tecla);
  if (!product) return;

  event.preventDefault();
  agregarPorTecla(product.id, tecla);
});

function obtenerProductosCache() {
  return converterArray(JSON.parse(sessionStorage.getItem('products') || "{}"));
}

function productoPorTecla(tecla) {
  let tk = normalizarTecla(tecla);
  if (!tk) return null;
  return obtenerProductosCache().find(ch => normalizarTecla(ch.tecla) == tk) || null;
}

function primerResultadoBusqueda(texto) {
  let valor = String(texto || '').trim().toLowerCase();
  if (!valor) return null;
  return obtenerProductosCache().find(ch => ch.name.toLowerCase().includes(valor) || String(ch.id).includes(valor)) || null;
}

function buscarRapido(texto) {
  let primer = primerResultadoBusqueda(texto);
  let cont = document.querySelector('.searching');
  let input = document.querySelector('.reseting-listing');
  if (input) input.value = '';
  if (cont) cont.innerHTML = '';
  if (!primer) return;
  agregarPorTecla(primer.id);
}

function enfocarBuscador() {
  if (document.querySelector('.overlay.active')) return;
  let input = document.querySelector('.reseting-listing');
  if (input) input.focus();
}

document.addEventListener('mouseup', (event) => {
  let atajos = document.querySelector('.atajos-productos');
  if (!atajos) return;
  if (document.querySelector('.overlay.active')) return;
  let t = event.target;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
  let input = document.querySelector('.reseting-listing');
  if (input) input.focus();
});

// ESTADO DE LA GRAMERA EN LA PANTALLA DE FACTURACIÓN
function checkGramera() {
  axios.get('/gramera/peso').then((resp) => {
    let el = document.querySelector('.gramera-status');
    if (!el) return;

    const data = resp.data;

    el.className = "gramera-status text-center mb-2 py-1 px-2 rounded cursor-pointer " + (data.conectada ? (data.sinDatos ? "gramera-espera" : (data.estable ? "gramera-ok" : "gramera-espera")) : "gramera-off");

    if (!data.conectada) {
      el.innerHTML = `<i class="fa-solid fa-weight-scale"></i> Gramera <span class="badge bg-danger">No conectada</span> <i class="fa-solid fa-gear ms-1"></i>`;
    } else if (data.sinDatos) {
      el.innerHTML = `<i class="fa-solid fa-weight-scale"></i> Puerto abierto, sin lectura de la balanza <i class="fa-solid fa-gear ms-1"></i>`;
    } else {
      const badge = data.estable ? '<span class="badge bg-success">Estable</span>' : '<span class="badge bg-warning text-dark">Pesando...</span>';
      el.innerHTML = `<i class="fa-solid fa-weight-scale"></i> Gramera: <b>${data.peso.toFixed(3)} kg</b> ${badge} <i class="fa-solid fa-gear ms-1"></i>`;
    }
  }).catch(() => {});
}
setInterval(checkGramera, 3000);

// ABRE EL POPUP DE CONEXIÓN DE LA GRAMERA
function abrirGramera() {
  popup.open({
    title: "Conectar Gramera",
    content: `<div class="gramera-ui-root"></div>`
  });
  setTimeout(() => {
    GrameraUI.iniciar('.gramera-ui-root');
  }, 20);
}

function deleteListEntrada(id) {
  let actuallyProductsList = sessionStorage.getItem('entrada-almacen');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);

  productList.forEach((element, i, array) => {
    if (element.id == id) {
      array.splice(i, 1);
      sessionStorage.setItem('entrada-almacen', JSON.stringify(array));
    }
  })

  listingEntrada();
}

function changeCantidad(id, e) {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);
  productList.forEach((element, i, array) => {
    if (element.id == id) {
      if (!array[i].stock) {
        array[i].cantidad = e.value ? e.value : 1;
        sessionStorage.setItem('actually-list-products', JSON.stringify(array));
        actualizarLinea(id, { setFinal: true });
        return;
      }
      if (array[i].stock < Number(e.value)) return Toast.fire({
        title: "Manager de productos",
        text: "No hay stock suficiente para la cantidad deseada.",
        icon: "error"
      });

      array[i].cantidad = e.value ? e.value : 1;
      sessionStorage.setItem('actually-list-products', JSON.stringify(array));
      actualizarLinea(id, { setFinal: true });
    }
  });

  return false;
}

function listingProducts() {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products') ? JSON.parse(sessionStorage.getItem('actually-list-products')) : [];

  let array_productsList = actuallyProductsList;
  // xd
  let finalPrice = 0;
  let final_html = array_productsList.map(ch => {
    finalPrice = Number(finalPrice) + Number(ch.cantidad ? (ch.price * (ch.cantidad ? ch.cantidad : 0)) : ch.price);
    return `<tr>
        <td>${ch.id}</td>
        <td>${ch.name}</td>
        <td class="non-padding">
          <input class="line-precio-${ch.id}" oninput="return changePrecioLinea('${ch.id}', this)" type="number" step="any" value="${ch.price?ch.price:0}">
        </td>
        <td class="non-padding">
          <input class="line-cantidad-${ch.id}" oninput="return changeCantidad('${ch.id}', this)" type="number" step="0.001" value="${ch.cantidad?ch.cantidad:1}">
        </td>
        <td class="text-center">
          ${esDePeso(ch) ? `<button class="btn btn-outline-info btn-sm" onclick="pesarProducto('${ch.id}')"><i class="fa-solid fa-weight-scale"></i> Pesar</button>` : ""}
        </td>
        <td class="non-padding">
          <input class="line-final-${ch.id}" oninput="return changeImporteLinea('${ch.id}', this)" type="number" step="any" value="${ch.cantidad?(ch.price*(ch.cantidad?ch.cantidad:0)):ch.price}">
        </td>
        <td class="text-center cursor-pointer" onclick="deleteList('${ch.id}')">x</td>
      </tr>`
  }).join('')

  if (document.querySelector('.tbody-products')) {
    document.querySelector('.tbody-products').innerHTML = `
    ${final_html}
  `;
  }

  document.querySelector('.edit-total').innerHTML = `$ ${formatNumber(finalPrice)}`;
}

// RECALCULA EL TOTAL DE LA VENTA A PARTIR DE LA LISTA GUARDADA
function actualizarTotalVenta() {
  let list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  let total = list.reduce((acc, ch) => acc + Number(ch.cantidad ? (ch.price * ch.cantidad) : ch.price), 0);
  let el = document.querySelector('.edit-total');
  if (el) el.innerHTML = `$ ${formatNumber(total)}`;
}

// ACTUALIZA LOS CAMPOS DEPENDIENTES DE UNA LINEA SIN PERDER EL FOCO
function actualizarLinea(id, opciones = {}) {
  let list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  let it = list.find(ch => ch.id == id);
  if (!it) return;

  if (opciones.setFinal) {
    let final = it.cantidad ? (Number(it.price) * Number(it.cantidad)) : Number(it.price);
    let input = document.querySelector(`.line-final-${id}`);
    if (input) input.value = final;
  }
  if (opciones.setCantidad) {
    let input = document.querySelector(`.line-cantidad-${id}`);
    if (input) input.value = it.cantidad;
  }
  actualizarTotalVenta();
}

// CAMBIA EL PRECIO DE UNA LINEA (SOLO ESTA VENTA) Y RECALCULA SU PRECIO FINAL
function changePrecioLinea(id, e) {
  let list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  let it = list.find(ch => ch.id == id);
  if (!it) return false;
  it.price = Number(removeCommaSeparators(e.value)) || 0;
  if (it.price_mayor != null) it.price_mayor = it.price;
  sessionStorage.setItem('actually-list-products', JSON.stringify(list));
  actualizarLinea(id, { setFinal: true });
  return false;
}

// CAMBIA EL PRECIO FINAL (MONTO $) DE UNA LINEA Y CALCULA LA CANTIDAD (KG)
function changeImporteLinea(id, e) {
  let list = JSON.parse(sessionStorage.getItem('actually-list-products') || "[]");
  let it = list.find(ch => ch.id == id);
  if (!it) return false;
  let precio = Number(it.price) || 0;
  if (precio <= 0) return false;
  let importe = Number(removeCommaSeparators(e.value)) || 0;
  it.cantidad = Math.round((importe / precio) * 1000) / 1000;
  sessionStorage.setItem('actually-list-products', JSON.stringify(list));
  actualizarLinea(id, { setCantidad: true });
  return false;
}

function changeCantidadEntrada(id, e) {
  let actuallyProductsList = sessionStorage.getItem('entrada-almacen');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);
  let finalPrice = 0;
  productList.forEach((element, i, array) => {
    if (element.id == id) {
      array[i].cantidad = e.value ? e.value : 1;
      finalPrice = Number(finalPrice) + Number((element.cantidad ? ((element.costo_adquisitivo ? element.costo_adquisitivo : element.price) * array[i].cantidad) : (element.costo_adquisitivo ? element.costo_adquisitivo : element.price)));
      sessionStorage.setItem('entrada-almacen', JSON.stringify(array));
      document.querySelector(`.change-price-${id}`).innerHTML = `${array[i].price*array[i].cantidad}`;
      document.querySelector('.edit-total').innerHTML = formatNumber(finalPrice);
    } else {
      finalPrice = Number(finalPrice) + Number(element.cantidad ? ((element.costo_adquisitivo ? element.costo_adquisitivo : element.price) * element.cantidad) : (element.costo_adquisitivo ? element.costo_adquisitivo : element.price));
    }
  });
}


function listingEntrada() {
  let actuallyProductsList = sessionStorage.getItem('entrada-almacen') ? JSON.parse(sessionStorage.getItem('entrada-almacen')) : [];

  let array_productsList = actuallyProductsList;
  // xd
  let finalPrice = 0;
  let final_html = array_productsList.map(ch => {
    finalPrice = Number(finalPrice) + Number(ch.cantidad ? ((ch.costo_adquisitivo ? ch.costo_adquisitivo : ch.price) * (ch.cantidad ? ch.cantidad : 0)) : ch.costo_adquisitivo);
    return `<tr>
        <td>${ch.id}</td>
        <td>${ch.name}</td>
        <td>${formatNumber(ch.costo_adquisitivo?ch.costo_adquisitivo:ch.price)}</td>
        <td class="non-padding">
          <input oninput="changeCantidadEntrada('${ch.id}', this)" type="number" value="${ch.cantidad?ch.cantidad:1}" ${!ch.cantidad?"disabled":""}>
        </td>
        <td class="change-price-${ch.id}">${formatNumber(ch.cantidad?((ch.costo_adquisitivo?ch.costo_adquisitivo:ch.price)*(ch.cantidad?ch.cantidad:0)):ch.price)}</td>
        <td class="text-center cursor-pointer" onclick="deleteListEntrada('${ch.id}')">x</td>
      </tr>`
  }).join('')

  if (document.querySelector('.tbody-products')) {
    document.querySelector('.tbody-products').innerHTML = `
    ${final_html}
  `;
  }

  document.querySelector('.edit-total').innerHTML = `$ ${formatNumber(finalPrice)}`;
}

function limpiarListadoVenta() {
  sessionStorage.removeItem('actually-list-products');
  listingProducts();
  renderAtajos();
  enfocarBuscador();
  let buscando = document.querySelector('.searching');
  if (buscando) buscando.innerHTML = '';
  let inputBusqueda = document.querySelector('.reseting-listing');
  if (inputBusqueda) inputBusqueda.value = '';
}

function sendCreateVenta(e, mayor, finalPrice, event) {
  event.preventDefault();
  let actuallyList = JSON.parse(sessionStorage.getItem('actually-list-products'));
  let token = sessionStorage.getItem('acape-session');
  let data = {
    venta: actuallyList,
    total_recibido: removeCommaSeparators(e[1].value),
    token: token,
    mayor: mayor,
    type: e[0].value,
    clientId: e[2] && e[2].value ? e[2].value : null,
    date: new Date() - 0
  };

  let finalToPay = 0;

  actuallyList.flatMap(ch => {
    let simplifiedPay = 0;

    ch.cantidad = ch.cantidad ? ch.cantidad : 1;

    if (mayor) {
      simplifiedPay = ch.price_mayor ? (ch.price_mayor * ch.cantidad) : ch.price * ch.cantidad;
    } else {
      simplifiedPay = ch.price * ch.cantidad;
    }

    finalToPay = finalToPay + Number(simplifiedPay);
    return simplifiedPay;
  });

  if (data.total_recibido < finalToPay) return Toast.fire({
    text: "No puede ser menor el total Recibido",
    icon: "error"
  });


  data.total_pago = finalToPay;

  console.log(data)
  
  let methods = sessionStorage.getItem('methods') ? JSON.parse(sessionStorage.getItem('methods')) : {};

  let array_methods = converterArray(methods);

  let finding_method = array_methods.find(ch => data.type == ch.name);

  window._ventaReciboSnapshot = {
    venta: actuallyList,
    total_pago: finalToPay,
    recibido: data.total_recibido,
    digital: (finding_method && finding_method.type == "digital") ? finding_method.name : null,
    clientId: data.clientId,
    date: data.date
  };

  if (finding_method && finding_method.type == "digital") {
    setTimeout(() => {
      socket.emit('createVentaDigital', data);

      socket.once('createVentaDigital', (data) => {
        sessionStorage.removeItem('actually-list-products');
        listingProducts()
        Toast.fire({
          text: data.message,
          icon: data.data ? "success" : "error"
        });
        registCajaDigital(data, finalToPay)
      })
    })
  } else {
    registCaja(data, finalToPay);
    socket.emit('openCashDrawer', { token: "1" });
    setTimeout(() => { socket.emit('createVenta', data) }, 1000);
  }

popup.open({
    title: "Venta hecha",
    content: `Total a pagar: ${formatNumber(finalPrice)} <br> Total Recibido: ${formatNumber(data.total_recibido)} <br><br> Vueltos: ${formatNumber(Number(removeCommaSeparators(e[1].value)) - finalPrice)} <br><br> <button class="btn btn-outline-success" onclick="imprimirReciboVenta()">Imprimir recibo</button> <button id="btnAceptarVentaHecha" class="btn btn-outline-info" onclick="popup.close()">Aceptar</button>`
  });

  limpiarListadoVenta();

  let btnAceptar = document.getElementById('btnAceptarVentaHecha');
  if (btnAceptar) btnAceptar.focus();

  return false;
}

function imprimirReciboVenta() {
  let snap = window._ventaReciboSnapshot;
  if (!snap) return Toast.fire({ title: "Recibo", text: "No hay una venta reciente para imprimir.", icon: "warning" });

  getClientesVenta((lista) => {
    let cliente = lista.find(c => String(c.id) === String(snap.clientId));
    imprimirHTML(reciboVentaHTML({
      products: snap.venta,
      total_pago: snap.total_pago,
      recibido: snap.recibido,
      digital: snap.digital,
      cliente: cliente ? cliente.name : "Consumidor Final",
      date: snap.date
    }));
  });
}

const CLIENTS_LITE_TTL = 120000;
let _clientesLiteInflight = null;

function cargarClientesLite(respuesta) {
  try {
    let cache = JSON.parse(sessionStorage.getItem('clients-lite'));
    if (cache && Array.isArray(cache.list) && (Date.now() - cache.ts) < CLIENTS_LITE_TTL) {
      return respuesta(cache.list);
    }
  } catch (e) {}

  if (_clientesLiteInflight) return _clientesLiteInflight.push(respuesta);
  _clientesLiteInflight = [respuesta];

  let token = sessionStorage.getItem('acape-session');
  socket.once('getAllClients', (data) => {
    let arr = data && data.data ? converterArray(data.data).sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
    sessionStorage.setItem('clients-lite', JSON.stringify({ ts: Date.now(), list: arr }));
    let callbacks = _clientesLiteInflight || [];
    _clientesLiteInflight = null;
    callbacks.forEach(fn => fn && fn(arr));
  });
  socket.emit('getAllClients', { token: token });
}

function getClientesVenta(respuesta) {
  cargarClientesLite(respuesta);
}

function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function activarBuscadorCliente(clientes, opts = {}) {
  let input = document.querySelector('#buscarCliente');
  let hiddenInput = document.querySelector('#clienteId');
  let resultados = document.querySelector('#resultadosCliente');
  let quitar = document.querySelector('#quitarCliente');
  if (!input || !hiddenInput || !resultados) return;

  let lista = converterArray(clientes || []);
  let seleccionado = null;

  if (window._buscadorDocHandler) document.removeEventListener('click', window._buscadorDocHandler);

  function dibujar(consulta) {
    let q = normalizarTexto(consulta);
    let filtrados = q
      ? lista.filter(c => normalizarTexto(c.name).includes(q) || normalizarTexto(c.document).includes(q)).slice(0, 8)
      : [];
    if (!filtrados.length) {
      resultados.innerHTML = q ? '<div class="buscador-cliente-resultado sin-coincidencias">Sin coincidencias</div>' : '';
      resultados.hidden = !q;
      return;
    }
    resultados.innerHTML = filtrados.map(c => `
      <div class="buscador-cliente-resultado" data-id="${c.id}">
        <span class="buscador-cliente-nombre">${c.name}</span>
        <span class="small">${c.document ? c.document : ''}</span>
        <span class="small text-muted">${c.phone ? 'Tel: ' + c.phone : ''}</span>
      </div>
    `).join('');
    resultados.hidden = false;
  }

  function seleccionar(c) {
    seleccionado = c;
    input.value = c.name || '';
    hiddenInput.value = String(c.id);
    resultados.hidden = true;
    if (quitar) quitar.hidden = false;
    if (opts.onSelect) opts.onSelect(c);
    if (opts.focusOnSelect) {
      let destino = document.getElementById(opts.focusOnSelect);
      if (destino) destino.focus();
    }
  }

  function limpiarSeleccion() {
    seleccionado = null;
    input.value = '';
    hiddenInput.value = '';
    resultados.hidden = true;
    resultados.innerHTML = '';
    if (quitar) quitar.hidden = true;
    if (opts.onSelect) opts.onSelect(null);
  }

  input.addEventListener('input', () => {
    if (seleccionado && input.value !== (seleccionado.name || '')) {
      seleccionado = null;
      hiddenInput.value = '';
      if (quitar) quitar.hidden = true;
    }
    dibujar(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      let primero = resultados.querySelector('.buscador-cliente-resultado');
      if (primero && !primero.classList.contains('sin-coincidencias')) {
        e.preventDefault();
        seleccionar(lista.find(c => String(c.id) === primero.dataset.id));
      }
    } else if (e.key === 'Escape') {
      resultados.hidden = true;
    }
  });

  resultados.addEventListener('click', (e) => {
    let fila = e.target.closest('.buscador-cliente-resultado');
    if (!fila || fila.classList.contains('sin-coincidencias')) return;
    seleccionar(lista.find(c => String(c.id) === fila.dataset.id));
  });

  window._buscadorDocHandler = (e) => {
    if (resultados && !e.target.closest('.buscador-cliente')) resultados.hidden = true;
  };
  document.addEventListener('click', window._buscadorDocHandler);

  if (quitar) quitar.addEventListener('click', limpiarSeleccion);
}

function facturacion() {
  let actuallyList = sessionStorage.getItem('actually-list-products');
  if (!actuallyList) return Toast.fire({
    title: "Manager de venta",
    text: "Actualmente no hay nada para vender"
  });

  let finalList = JSON.parse(actuallyList);

  let finalPrice = 0;

  let finalProducts = finalList.map(ch => {
    finalPrice = Number(finalPrice) + Number(ch.cantidad ? (ch.price * ch.cantidad) : ch.price);

    return `<hr> <div class="product bt-1">ID: ${ch.id} | ${ch.name} | Cantidad: ${ch.cantidad?ch.cantidad:1} | Precio Unitario: ${formatNumber(ch.price)} | Precio Final: ${formatNumber(ch.cantidad?(ch.price * ch.cantidad):ch.price)}</div>`;
  }).join('');

  let methods = sessionStorage.getItem('methods') ? JSON.parse(sessionStorage.getItem('methods')) : {};
  let array_methods = converterArray(methods);

  getClientesVenta((clientesVenta) => {
    popup.open({
      title: "Venta Normal",
      content: `
      <form onsubmit="return sendCreateVenta(this, null, ${finalPrice}, event)">
        <label htmlFor="">Metodos De Pago</label>
        <select name="" value="efectivo" class="form-select">
          <option value="efectivo">efectivo</option>
          ${array_methods.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join('')}
        </select>
        <label>Total Recibido</label>
        <input type="text" class="form-control numberify-input-commas" value="${formatNumber(finalPrice)}">
        <div class="buscador-cliente">
          <input type="hidden" id="clienteId" value="">
          <label>Cliente (opcional)</label>
          <input type="text" id="buscarCliente" class="form-control" autocomplete="off" placeholder="Buscar por nombre o número de identidad">
          <div id="resultadosCliente" class="buscador-cliente-resultados" hidden></div>
          <button type="button" id="quitarCliente" class="btn btn-light btn-sm mt-1" hidden><i class="fa-solid fa-xmark"></i> Quitar cliente</button>
        </div>
        <div class="actual-venta">
          ${finalProducts}
          <hr>
        </div>
        <br>
        <div class="precio-final"><h5>Total a pagar: $ ${formatNumber(finalPrice)}</h5></div>
        <br>
        <button id="btnFinalizarVenta" class="btn btn-block btn-outline-primary focusing" autofocus><i class="fa-solid fa-floppy-disk"></i> Finalizar</button>
      </form>
    `
    });
    activarBuscadorCliente(clientesVenta, { focusOnSelect: 'btnFinalizarVenta' });
    let btnFinalizar = document.getElementById('btnFinalizarVenta');
    if (btnFinalizar) btnFinalizar.focus();
  });
}

function facturacionMayor() {
  let actuallyList = sessionStorage.getItem('actually-list-products');
  if (!actuallyList) return Toast.fire({
    title: "Manager de venta",
    text: "Actualmente no hay nada para vender"
  });

  let finalList = JSON.parse(actuallyList);

  let finalPrice = 0;

  let finalProducts = finalList.map(ch => {
    finalPrice = Number(finalPrice) + Number(ch.cantidad ? ((ch.price_mayor ? ch.price_mayor : ch.price) * ch.cantidad) : (ch.price_mayor ? ch.price_mayor : ch.price));

    return `<hr> <div class="product bt-1">ID: ${ch.id} | ${ch.name} | Cantidad: ${ch.cantidad?ch.cantidad:1} | Precio Unitario: ${formatNumber(ch.price_mayor?ch.price_mayor:ch.price + ' (Este producto no tiene precio por mayor)')} | Precio Final: ${formatNumber(Number(ch.cantidad?((ch.price_mayor?ch.price_mayor:ch.price) * ch.cantidad):(ch.price_mayor?ch.price_mayor:ch.price)))}</div>`;
  }).join('')

  let methods = sessionStorage.getItem('methods') ? JSON.parse(sessionStorage.getItem('methods')) : {};
  let array_methods = converterArray(methods);

  getClientesVenta((clientesVenta) => {
    popup.open({
      title: "Venta Por Mayor",
      content: `
      <form onsubmit="return sendCreateVenta(this, true, ${finalPrice}, event)">
        <label htmlFor="">Metodos De Pago</label>
        <select name="" value="efectivo" class="form-select">
          <option value="efectivo">efectivo</option>
          ${array_methods.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join('')}
        </select>
        <label>Total Recibido</label>
        <input type="text" class="form-control numberify-input-commas" value="${formatNumber(finalPrice)}">
        <div class="buscador-cliente">
          <input type="hidden" id="clienteId" value="">
          <label>Cliente (opcional)</label>
          <input type="text" id="buscarCliente" class="form-control" autocomplete="off" placeholder="Buscar por nombre o número de identidad">
          <div id="resultadosCliente" class="buscador-cliente-resultados" hidden></div>
          <button type="button" id="quitarCliente" class="btn btn-light btn-sm mt-1" hidden><i class="fa-solid fa-xmark"></i> Quitar cliente</button>
        </div>
        <div class="actual-venta">
          ${finalProducts}
          <hr>
        </div>
        <br><br>
        <div class="precio-final"><h5>Total a pagar: $ ${formatNumber(finalPrice)}</h5></div>

        <button id="btnFinalizarVentaMayor" class="btn btn-block btn-outline-primary"><i class="fa-solid fa-floppy-disk"></i> Finalizar</button>
      </form>
    `
    });
    activarBuscadorCliente(clientesVenta, { focusOnSelect: 'btnFinalizarVentaMayor' });
    let btnFinalizarMayor = document.getElementById('btnFinalizarVentaMayor');
    if (btnFinalizarMayor) btnFinalizarMayor.focus();
  });
}

function borrarLista() {
  sessionStorage.removeItem('actually-list-products');
  listingProducts();
}

function submitEntrada(e) {
  let actuallyProducts = JSON.parse(sessionStorage.getItem('products') ? sessionStorage.getItem('products') : "{}");

  let array_products = converterArray(actuallyProducts);

  let filtering = array_products.filter(ch => {
    return ch.name.toLowerCase().includes(e[0].value.toLowerCase()) || ch.id.toString().includes(e[0].value.toLowerCase());
  });

  let final_product = filtering[0];

  if (!final_product) return alert.fire({
    title: "Producto No Registrado",
    icon: "info",
    confirmButtonText: "Aceptar"
  });


  setListEntrada(final_product.id)
}


// Utilizamos delegación de eventos en un elemento padre que siempre esté presente en el DOM
document.addEventListener('submit', function(event) {
  if (event.target && event.target.matches('.productListening')) {
    event.preventDefault(); // Evitamos que el formulario se envíe
    submitProduct(event.target)
  }
  if (event.target && event.target.matches('.productListening-2')) {
    event.preventDefault();
    submitEntrada(event.target);
  }
});


function submitProduct(e) {
  let actuallyProducts = JSON.parse(sessionStorage.getItem('products') ? sessionStorage.getItem('products') : "{}");

  let array_products = converterArray(actuallyProducts);

  let filtering = array_products.filter(ch => {
    return ch.name.toLowerCase().includes(e[0].value.toLowerCase()) || ch.id.toString().includes(e[0].value.toLowerCase());
  });

  let final_product = filtering[0];

  if (!final_product) return alert.fire({
    title: "Producto No Registrado",
    icon: "info",
    confirmButtonText: "Aceptar"
  });


  setListProduct(final_product.id)
}

router.get(['/', '', '/app'], () => {
  const sesion = sessionStorage.getItem('acape-session');
  if (!sesion) {
    return `
      <div class="center-center center-full">
        <form class="siops-sesion card p-5" onsubmit="return loginFunc(this)">
          <h3 class="text-center">ACAPE</h3>
          <p>Aplicación Contable Administrativa Para Empresas</p>
          <label htmlFor="user">Usuario</label>
          <input type="text" id="user" class="form-control" placeholder="Usuario">
          <br>
          <label htmlFor="password">Contraseña</label>
          <input type="password" placeholder="Contraseña" class="form-control">
          <br>
          <button class="btn btn-outline-primary btn-block d-block w-100">Iniciar</button>
          <br><br>
          <a href="/app" class="link">Ir A Administración</a>
        </form>
      </div>
    `;
  } else {
    sessionValidator()
    cargarClientesLite(() => {});

    socket.emit('getAllProducts', { token: sesion });
    socket.once('getAllProducts', (data) => {
      sessionStorage.setItem('products', JSON.stringify(data.data));
      sessionStorage.setItem('methods', JSON.stringify(data.methods))
      listingProducts()
      renderAtajos()
      enfocarBuscador()
    })

    return `<div class="container"><br><br>
      <div class="gramera-status" onclick="abrirGramera()" title="Conectar gramera"></div>
      <h1 class="text-center">Facturación</h1>
      <p class="text-center">Creación de ventas.</p>
      <div class="justify-content-center text-center">
        <button class="btn btn-outline-primary" onclick="facturacion()"><i class="fa-solid fa-money-bill"></i> Normal</button>
        <button class="btn btn-outline-secondary" onclick="facturacionMayor()"><i class="fa-solid fa-money-bills"></i>Por Mayor</button>
        <button class="btn btn-outline-info" onclick="openCreatePedido()"><i class="fa-solid fa-receipt"></i> Crear Pedido</button>
        <button class="btn btn-outline-danger" onclick="borrarLista()"><i class="fa-solid fa-trash"></i> Borrar lista</button>
        <a class="btn btn-outline-success" href="/" target="_blank"><i class="fa-solid fa-plus"></i> Nuevo Espacio</a>
      </div>
      <br>
      <div class="atajos-productos mb-3"></div>
      <br>
      <form class="productListening">
        <div class="input-group mb-3">
          <input type="text" class="form-control reseting-listing" oninput="inputVentas(this)" placeholder="12, Nombre Producto">
          <button class="btn btn-outline-secondary" type="button" id="button-addon2"><i class="fa-solid fa-magnifying-glass"></i></button>
        </div>
      </form>
      <div class="setting-data">
        <div class="searching"></div>
        <br>
        <div class="table-ventas container-fluid">
          <table class="table-products">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Cantidad</th>
                <th>Pesar</th>
                <th>Precio Final</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody class="tbody-products">
              
            </tbody>
          </table>
          <br>
          <h3>Total: <span class="edit-total">0</span></h3>
        </div>
      </div>
    </div>`;
  }
});

router.get('/invalid-user', () => {
  setTimeout(() => {
    location.hash = "#/"
  }, 2000)
  return `<div class="center-center center-full">La sesion de usuario es invalida</div>`;
})

function deleteProducts(id) {
  let token = sessionStorage.getItem('acape-session');
  alert.fire({
    title: "Eliminar Producto",
    text: `Estas seguro de que querer eliminar el producto: ${id}`,
    icon: "info",
    confirmButtonText: "Aceptar",
    showCancelButton: true,
    cancelButtonText: "Cancelar"
  }).then((result) => {
    if (result.isConfirmed) {
      socket.emit('deleteProduct', { product: id, token: token });
    }
  })
}

function sendEditProduct(e, id) {
  let data = {
    name: e[0].value,
    price: removeCommaSeparators(e[1].value),
    price_mayor: removeCommaSeparators(e[2].value),
    iva: removeCommaSeparators(e[3].value),
    stock: removeCommaSeparators(e[4].value),
    costo_adquisitivo: removeCommaSeparators(e[5].value),
    id_personalizado: removeCommaSeparators(e[6].value),
    venta_por_peso: e[7].checked,
    tecla: e[8] ? e[8].value : '',
    id: id
  }

  let token = sessionStorage.getItem('acape-session')
  socket.emit('editProduct', { product: data, token: token });

  return false;
}

// EDITANDO PRODUCTOS
function editProduct(id) {
  let token = sessionStorage.getItem('acape-session')
  socket.emit(`getProduct/${id}`, { token: token });
  socket.once(`getProduct/${id}`, (data) => {
    if (!data.data) {
      return Toast.fire({
        title: "Manager de productos",
        text: data.message,
        icon: "error"
      });
    }
    let info_inputs = data.data;

    popup.open({
      title: "Ver o editar producto",
      content: `
        <form onsubmit="return sendEditProduct(this, '${id}')">
          <p>Aqui la info del producto</p>
          <label>Nombre del producto: </label>
          <input type="text" required placeholder="Producto x und" value="${info_inputs.name}" class="form-control">

          <label>Precio por unidad (opcional): </label>
          <p>Si no agregas precio, cada vez que vayas a vender este producto se te pedira un precio.</p>
          <div class="input-group mb-3">
            <span class="input-group-text" id="basic-addon1">$</span>
            <input type="text" class="form-control numberify-input-commas" value="${formatNumber(info_inputs.price?info_inputs.price:"")}" placeholder="1000">
          </div>

          <label htmlFor="">Precio por mayor o por descuento (opcional)</label>
          <div class="input-group mb-3">
            <span class="input-group-text" id="basic-addon1">$</span>
            <input type="text" class="form-control numberify-input-commas" value="${formatNumber(info_inputs.price_mayor?info_inputs.price_mayor:"")}" placeholder="700">
          </div>

          <label class="d-inline">IVA (opcional)</label>
          <div class="input-group mb-3">
            <span class="input-group-text">%</span>
            <input type="number" class="form-control d-inline" value="${info_inputs.iva?info_inputs.iva:0}" placeholder="1 - 100" max="100" min="0">
          </div>

          <label class="d-inline">Cantidad (opcional)</label>
          <p>Si no se pone cantidad, el stock sera infinito hasta que se cambie.</p>
          <div class="input-group mb-3">
            <span class="input-group-text">#</span>
            <input type="text" value="${info_inputs.stock?info_inputs.stock:""}" class="form-control numberify-input-commas d-inline" placeholder="10">
          </div>

          <label htmlFor="">Costo Adquisitivo o precio original (opcional)</label>
          <p>Este precio no se vera a la hora de venderlo</p>
          <div class="input-group mb-3">
            <span class="input-group-text">$</span>
            <input type="text" class="form-control numberify-input-commas" value="${formatNumber(info_inputs.costo_adquisitivo?info_inputs.costo_adquisitivo:"")}">
          </div>

          <label>ID Personalizado (opcional)</label>
          <div class="input-group mb-3">
            <span class="input-group-text">#</span>
            <input type="number" class="form-control value="${info_inputs.id_personalizado}" d-inline" placeholder="00318293"">
          </div>

          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="editVentaPorPeso" ${esDePeso(info_inputs) ? 'checked' : ''}>
            <label class="form-check-label" for="editVentaPorPeso">
              <i class="fa-solid fa-weight-scale"></i> Venta por peso (precio por kg)
            </label>
            <p class="text-muted small">Si lo activas, el precio se tomará como precio por kilo y tendrás un botón Pesar al vender</p>
          </div>

          <label>Tecla de acceso rápido (opcional)</label>
          <p class="text-muted small">Presiona esa tecla en la pantalla de Facturación para vender este producto al instante.</p>
          <div class="input-group mb-3">
            <span class="input-group-text"><i class="fa-solid fa-keyboard"></i></span>
            <input type="text" value="${info_inputs.tecla || ""}" class="form-control d-inline" placeholder="Ej: F2, Q, 5">
          </div>
          <br>
          <div class="edit-buttons">
            <button class="btn btn-outline-primary w-100"><i class="fa-solid fa-pen"></i> Editar</button>
            <a class="btn btn-outline-danger w-100" onclick="deleteProducts('${info_inputs.id}')"><i class="fa-solid fa-circle-minus"></i> Eliminar</a>
          </div>
        </form>
      `
    })
  })
}

function getProducts() {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getAllProducts', { token: token });

  socket.once('getAllProducts', (data) => {
    if (!data.data) return Toast.fire({ text: data.message });

    let final_products = converterArray(data.data);

    sessionStorage.setItem('products', JSON.stringify(data.data))

    finalDetergente(final_products)
  })
}

function sendCreateProduct(e) {
  let data = {
    name: e[0].value,
    price: removeCommaSeparators(e[1].value),
    price_mayor: removeCommaSeparators(e[2].value),
    iva: removeCommaSeparators(e[3].value),
    stock: removeCommaSeparators(e[4].value),
    costo_adquisitivo: removeCommaSeparators(e[5].value),
    id_personalizado: e[6].value,
    venta_por_peso: e[7].checked,
    tecla: e[8] ? e[8].value : ''
  }
  let token = sessionStorage.getItem('acape-session');

  socket.emit('createProduct', { product: data, token: token })
  return false;
}

function createProduct() {
  popup.open({
    title: "Crear producto",
    content: `
      <form class="create-product-form" onsubmit="return sendCreateProduct(this)">
        <p>Agrega la información del producto.</p>
        <label>Nombre del producto: </label>
        <input type="text" required placeholder="Producto x und" class="form-control">

        <label>Precio por unidad (opcional): </label>
        <p>Si no agregas precio, cada vez que vayas a vender este producto se te pedira un precio.</p>
        <div class="input-group mb-3">
          <span class="input-group-text" id="basic-addon1">$</span>
          <input type="text" class="numberify-input-commas form-control" placeholder="1000">
        </div>

        <label htmlFor="">Precio por mayor o por descuento (opcional)</label>
        <div class="input-group mb-3">
          <span class="input-group-text" id="basic-addon1">$</span>
          <input type="text" class="form-control numberify-input-commas" placeholder="700">
        </div>

        <label class="d-inline">IVA (opcional)</label>
        <div class="input-group mb-3">
          <span class="input-group-text">%</span>
          <input type="text" class="form-control d-inline numberify-input-commas" placeholder="1 - 100" max="100" min="0">
        </div>

        <label class="d-inline">Cantidad (opcional)</label>
        <p>Si no se pone cantidad, el stock sera infinito hasta que se cambie.</p>
        <div class="input-group mb-3">
          <span class="input-group-text">#</span>
          <input type="text" class="form-control numberify-input-commas d-inline" placeholder="10">
        </div>

        <label htmlFor="">Costo Adquisitivo o precio original (opcional)</label>
        <p>Este precio no se vera a la hora de venderlo</p>
        <div class="input-group mb-3">
          <span class="input-group-text">$</span>
          <input type="text" class="form-control numberify-input-commas">
        </div>

          <label>ID Personalizado (opcional)</label>
          <div class="input-group mb-3">
            <span class="input-group-text">#</span>
            <input type="number" class="form-control d-inline" placeholder="00318293"">
          </div>

          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="venta_por_peso">
            <label class="form-check-label" for="venta_por_peso">
              <i class="fa-solid fa-weight-scale"></i> Venta por peso (precio por kg)
            </label>
            <p class="text-muted small">Si lo activas, el precio se tomará como precio por kilo y tendrás un botón Pesar al vender</p>
          </div>

          <label>Tecla de acceso rápido (opcional)</label>
          <p class="text-muted small">Presiona esa tecla en la pantalla de Facturación para vender este producto al instante.</p>
          <div class="input-group mb-3">
            <span class="input-group-text"><i class="fa-solid fa-keyboard"></i></span>
            <input type="text" class="form-control d-inline" placeholder="Ej: F2, Q, 5">
          </div>
          <br>
          <button class="btn btn-outline-primary d-block w-100">Crear Producto</button>
      </form>
    `
  })
}

function getList(func) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getProductsScan', token);
  socket.on('getProductsScan', (data) => {
    socket.off('getProductsScan');

    func(data);
  })
}

function finalDetergente(data) {
  let final_detergente = document.querySelector('.all-products');
  if (!final_detergente) return;
  let total_inversion = 0;
  let total_venta = 0;

  let final_products = data;

  final_detergente.innerHTML = `<table class="table-products">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Precio</th>
          <th>IVA</th>
          <th>Cantidad</th>
          <th>Costo</th>
          <th>Tecla</th>
          <th>Editar</th>
        </tr>
      </thead>
      <tbody class="tbody-products">
        ${final_products.map(ch => {
          let actual_stock = ch.stock;
          total_inversion = Number(total_inversion) + Number(Number(ch.costo_adquisitivo?ch.costo_adquisitivo:Number(ch.precio?ch.precio:0)) * Number(ch.stock?ch.stock:0));
          total_venta = Number(total_venta) + (Number(ch.price?ch.price:0) * Number(ch.stock?ch.stock:0));

          return `<tr>
            <td># ${ch.id}</td>
            <td>${ch.name}</td>
            <td>Precio Normal: $ ${formatNumber(ch.price?ch.price:0)} <br> <span>Por Mayor: </span> $ ${formatNumber(ch.price_mayor?ch.price_mayor:0)}</td>
            <td>${ch.iva?ch.iva:0} %</td>
            <td># ${actual_stock==null?'Infinito':actual_stock}</td>
            <td>$ ${formatNumber(ch.costo_adquisitivo?ch.costo_adquisitivo:"0")}</td>
            <td>${ch.tecla ? `<span class="badge tecla-badge">${ch.tecla.toUpperCase()}</span>` : ""}</td>
            <td><button class="btn btn-outline-success" onclick="editProduct('${ch.id}')"><i class="fa-solid fa-pen"></i></button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <br><br>
    <h5>Total Adquisición: $ ${formatNumber(total_inversion)}</h5>
    <h5>Total de venta: $ ${formatNumber(total_venta)}</h5>
    <hr>
    <h5>Total ganancias: ${formatNumber(total_venta - total_inversion)}</h5>`
}

function inputProducts(e) {
  let actuallyProducts = JSON.parse(sessionStorage.getItem('products') ? sessionStorage.getItem('products') : "{}");

  let array_products = converterArray(actuallyProducts);
  let filtering = array_products.filter(ch => {
    return ch.name.toLowerCase().includes(e.value.toLowerCase()) || ch.id.toString().includes(e.value.toLowerCase());
  });

  finalDetergente(filtering)
}


function save_ingreso_productos(e) {
  let data_token = sessionStorage.getItem('acape-session');

  let product = {
    id: e[0].value,
    price: Number(removeCommaSeparators(e[2].value)),
    cantidad: e[1].value,
    caja: e[3].checked
  }

  if (product.caja == true) {
    let data_to_egreso = {
      money: Number(`${product.price<0?"-":""}${product.price}`),
      description: `${product.price < 0?"Egreso":"Ingreso"} de productos`,
      date: new Date()
    }

    createEgreso(data_to_egreso, data_to_egreso.money);
    Toast.fire({
      title: "Pagado de caja",
      description: "El Pago sera cobrado en caja",
      icon: "success"
    })
  }

  socket.emit('products/ingreso', {
    token: data_token,
    product: product
  });

  return false;
}

function ingreso_productos() {
  let actually_products = JSON.parse(sessionStorage.getItem('products'));

  let array_products = converterArray(actually_products);

  popup.open({
    title: "Ingreso De Productos A Bodega",
    content: `<form onsubmit="return save_ingreso_productos(this)">
      <p>Ingresa los productos nuevos comprados para bodega</p>
      <select name="products" class="form-select" id="product_select">
        <option value="null">Elige un producto</option>
        ${array_products.map(ch => `
          <option value="${ch.id}">${ch.name}</option>
        `).join('')}
      </select>
      <br>
      <label>Cantidad De Ingreso O Egreso De Productos</label>
      <input type="number" class="form-control" placeholder="Cantidad">
      <label htmlFor="">Precio Completo</label>
      <div class="input-group mb-3">
        <span class="input-group-text" id="basic-addon1">$</span>
        <input type="text" class="form-control numberify-input-commas" placeholder="Costo Completo De Los Productos">
      </div>


      <div class="form-check ml-2">
        <input class="form-check-input" type="checkbox" value="" id="flexCheckDefault">
        <label class="form-check-label" for="flexCheckDefault">Pagar De Caja</label>
      </div>

      <br>
      <button class="btn btn-outline-info">Entrada De Productos</button>
    </form>`
  })
}

router.get(['/productos'], () => {
  sessionValidator();

  getProducts();

  return `<div class="container-fluid my-2">
    <h1 class="text-center">Productos</h1>
    <p class="text-center">La sección de productos, todas sus funciones necesitan permisos de dueño para poder agregar o quitar.</p>
    <div class="menu-products text-center w-100">
      <button class="btn btn-outline-primary" onclick="createProduct(this.value)"><i class="fa-solid fa-square-plus"></i> Nuevo Producto</button>
      <button class="btn btn-outline-warning" onclick="ingreso_productos()">Ingreso De Productos</button>
    </div>
    <br>
    <form class="form-searching">
      <div class="input-group mb-3">
        <input type="text" class="form-control" oninput="inputProducts(this)" placeholder="12, Nombre Producto">
        <button class="btn btn-outline-secondary" type="button" id="button-addon2"><i class="fa-solid fa-magnifying-glass"></i></button>
      </div>
      <div class="searching"></div>
    </form>
    <br>
    <div class="all-products"></div>
  </div>`;
})

function eliminarVenta(id, total_valor) {
  alert.fire({
    title: "Eliminar venta",
    text: `Estas seguro de querer eliminar la venta: # ${id}`,
    confirmButtonText: "Aceptar",
    showCancelButton: true,
    cancelButtonText: "Cancelar"
  }).then((element) => {
    if (element.isConfirmed) {
      socket.emit('deleteVenta', { venta: id });



      popup.close();
    }
  })
}

function prepareToEdit(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getAllVentas', { token: token });

  socket.once('getAllVentas', (data) => {
    let productID = data.data[id];
    let final_products = productID.products;
    let products_list = [];
    socket.emit('getAllProducts', token);
    socket.once('getAllProducts', (data) => {
      converterArray(final_products).forEach((element, i, array) => {
        if (data.data[element.id]) {
          data.data[element.id].precio_final = element.precio_final;
          data.data[element.id].price = element.precio_unitario == element.precio_final ? element.precio_final : element.precio_unitario;
          data.data[element.id].cantidad = element.cantidad;
          products_list.push(data.data[element.id]);
        }
      })

      sessionStorage.setItem('actually-list-products', JSON.stringify(products_list))
    })
    popup.close();
    location.hash = "#/"
    socket.emit('deleteVentaEdit', { token: token, venta: id });;
  })

  return false;
}

function editarVenta(id, products) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getAllVentas', { token: token })
  socket.once('getAllVentas', (data) => {
    let maping_products = converterArray(data.data[id].products).map(ch => `
      <div>
        <span><b>ID: </b> ${ch.id} | <b>Precio Unitario: </b>${formatNumber(ch.precio_unitario)} | <b>Cantidad: </b> ${ch.cantidad}</span>
        <span><b>Precio Final: ${formatNumber(ch.precio_final)}</b></span>
      </div>
    `).join('hr');
    popup.open({
      title: "Editar venta",
      content: `<form onsubmit="return prepareToEdit('${id}')">
        <p>Estas seguro de querer editar esta venta. Esta venta sera eliminada y reemplazada con un nuevo id.</p>
        <hr>
        ${maping_products}
        <br>
        <button class="btn btn-outline-info">Aceptar</button>
      </form>`
    })
  })
}

function submitIngreso(e) {
  let data = {
    money: removeCommaSeparators(e[0].value),
    description: e[1].value,
    date: new Date()
  }

  createIngreso(data, data.money);

  Toast.fire({
    title: "Ingresos",
    text: `Se acaban de ingresar $ ${e[0].value} al sistema.`,
    icon: "info"
  })

  popup.close();

  document.querySelector('.app').innerHTML = reloadCaja();

  return false;
}

function submitEgreso(e) {
  let data = {
    money: removeCommaSeparators(e[0].value),
    description: e[1].value,
    date: new Date()
  }

  createEgreso(data, data.money);

  Toast.fire({
    title: "Egresos",
    text: `Se acaban de egresar $ ${e[0].value} al sistema.`,
    icon: "info"
  })

  document.querySelector('.app').innerHTML = reloadCaja();
  popup.close();

  return false;
}

function openWindowIngreso() {
  popup.open({
    title: "Agregar Ingreso",
    content: `
      <form class="form-ingreso" onsubmit="return submitIngreso(this)">
        <label htmlFor="">Total del ingreso</label>
        <div class="input-group mb-3">
          <span class="input-group-text">$</span>
          <input type="text" required class="numberify-input-commas form-control d-inline" placeholder="10000">
        </div>
        <label>Descripción (Opcional)</label>
        <textarea class="form-control" placeholder="Ejem: Pago de deuda de un cliente..."></textarea>
        <br>
        <button class="btn btn-outline-primary d-block w-100">Guardar Ingreso</button>
      </form>
    `
  })
}

function openWindowEgreso() {
  popup.open({
    title: "Agregar Egreso",
    content: `
      <form class="form-egreso" onsubmit="submitEgreso(this)">
        <label>Total del egreso</label>
        <div class="input-group mb-3">
          <span class="input-group-text">$</span>
          <input type="text" required class="numberify-input-commas form-control d-inline" placeholder="10,000">
        </div>
        <label>Descripción (opcional)</label>
        <textarea class="form-control" placeholder="Ejem: Compra de articulos para uso diario..."></textarea>
        <br>
        <button class="btn btn-outline-danger">Guardar Egreso</button>
      </form>
    `
  })
}

function deleteIngreso(date) {
  let caja = JSON.parse(localStorage.getItem('caja'));
  let ingresos = caja.ingresos;

  ingresos.forEach((element, i, array) => {
    if (date == element.date) {
      caja.ingreso = Number(caja.ingreso) - Number(element.money);
      caja.value = caja.value - Number(element.money);
      array.splice(i, 1);
      caja.ingresos = array;
      localStorage.setItem('caja', JSON.stringify(caja));
      listIngresosEgresos();
      Toast.fire({
        text: "Ingreso eliminado satisfactoriamente.",
        icon: "success"
      });

    }
  })
}

function deleteEgreso(date) {
  let caja = JSON.parse(localStorage.getItem('caja'));
  let egresos = caja.egresos;

  egresos.forEach((element, i, array) => {
    if (date == element.date) {
      caja.egreso = Number(caja.egreso) - Number(element.money);
      caja.value = caja.value + Number(element.money);
      array.splice(i, 1);
      caja.egresos = array;
      localStorage.setItem('caja', JSON.stringify(caja));
      listIngresosEgresos();
      Toast.fire({
        text: "Ingreso eliminado satisfactoriamente.",
        icon: "success"
      });

    }
  })
}

function listIngresosEgresos() {
  let caja = JSON.parse(localStorage.getItem('caja'));
  popup.open({
    title: "Lista de ingresos y egresos",
    content: `
      <div>
        <div class="list-ingresos-egresos">
          <h4>Ingresos del dia.</h4>
          ${caja.ingresos.map(ch => `
            <div class="card">
              <div class="card-body">
                <span>${new Date(ch.date).toLocaleString()} - Hace ${getTimeLong(new Date()-new Date(ch.date))}</span>
                <span>Descripción: ${ch.description?ch.description:"Sin descripción"}</span>
                <span>Valor de: ${ch.money} $</span>
                <button class="btn btn-outline-danger d-inline-block" onclick="deleteIngreso('${ch.date}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
              </div>
            </div>
          `).join('')}
          <hr>
          <h4>Egresos del dia</h4>
          ${caja.egresos.map(ch => `
            <div class="card">
              <div class="card-body">
                <span>${new Date(ch.date).toLocaleString()} - Hace ${getTimeLong(new Date()-new Date(ch.date))}</span>
                <span>Descripción: ${ch.description?ch.description:"Sin descripción"}</span>
                <span>Valor de: ${ch.money} $</span>
                <button class="btn btn-outline-danger d-inline-block" onclick="deleteEgreso('${ch.date}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
              </div>
            </div>
          `)}
        </div>
      </div>
    `
  })
}

// GENERAR EXCEL DEL CIERRE DE CAJA
function generarExcelCierre(caja) {
  if (typeof ExcelJS === 'undefined') {
    return Toast.fire({ title: "Excel", text: "La librería de Excel no está cargada. Recarga la página (Ctrl+F5).", icon: "error" });
  }
  if (!caja) return Toast.fire({ title: "Excel", text: "No hay caja para exportar.", icon: "warning" });

  const ventas = converterArray(caja.ventas_hechas || []);
  const eliminadas = converterArray(caja.ventas_eliminadas || []);
  const ingresos = converterArray(caja.ingresos || []);
  const egresos = converterArray(caja.egresos || []);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACAPE';
  wb.created = new Date();

  function productosDeVenta(v) {
    let arr = (Array.isArray(v.products) && v.products.length) ? v.products
            : (Array.isArray(v.venta) && v.venta.length) ? v.venta
            : [];
    return converterArray(arr);
  }
  function lineaProducto(p) {
    let cantidad = Number(p.cantidad != null ? p.cantidad : (p.quantity || 1));
    let unit = Number(p.precio_unitario != null ? p.precio_unitario : (p.price || 0));
    let total = Number(p.precio_final != null ? p.precio_final : (unit * cantidad));
    return { name: p.name || ('Producto #' + (p.id || '')), cantidad, unit, total };
  }
  function totalVenta(v) {
    if (v.total_pago != null) return Number(v.total_pago);
    let suma = 0;
    productosDeVenta(v).forEach(p => { suma += lineaProducto(p).total; });
    return suma;
  }
  function recibidoVenta(v) {
    if (v.recibido != null) return Number(v.recibido);
    if (v.total_recibido != null) return Number(v.total_recibido);
    return totalVenta(v);
  }
  function tipoPagoVenta(v) {
    if (v.digital) return 'Digital (' + v.digital + ')';
    if (v.type && String(v.type).toLowerCase() != 'efectivo') return 'Digital (' + v.type + ')';
    if (v.type) return String(v.type);
    return 'Efectivo';
  }
  function fechaVenta(v) {
    let d = (v.date != null ? v.date : (v.cerrada || Date.now()));
    return new Date(d).toLocaleString();
  }
  function estilizarHoja(hoja, filas, opts) {
    const nCols = Math.max(filas[0].length, opts.anchos ? opts.anchos.length : 0);
    hoja.columns = Array.from({ length: nCols }, (_, c) => ({ width: (opts.anchos && opts.anchos[c]) || 18 }));

    filas.forEach((fila, i) => {
      const row = hoja.addRow(fila);
      if (opts.tituloFila && i === 0) {
        const t = row.getCell(1);
        t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        t.alignment = { horizontal: 'center', vertical: 'middle' };
        if (nCols > 1) hoja.mergeCells(1, 1, 1, nCols);
      } else if (opts.cabecera && i === 0) {
        row.eachCell((c) => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        (opts.monedaCol || []).forEach((cin) => {
          const celda = row.getCell(cin + 1);
          if (typeof celda.value === 'number') {
            celda.numFmt = '#,##0';
            celda.alignment = { horizontal: 'right' };
          }
        });
        if (opts.etiquetaCol !== undefined && fila[opts.etiquetaCol] !== undefined) {
          const celda = row.getCell(opts.etiquetaCol + 1);
          celda.font = { bold: true };
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }
        if (opts.resaltar && opts.resaltar.indexOf(i) >= 0) {
          row.eachCell((c) => {
            c.font = { bold: true };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
          });
        }
      }
    });

    (opts.wrapCol || []).forEach((cin) => { hoja.getColumn(cin + 1).alignment = { wrapText: true }; });
    if (opts.cabecera) hoja.views = [{ state: 'frozen', ySplit: 1 }];
    return hoja;
  }

  // 1. RESUMEN
  let resumen = [
    ['INFORME GENERAL'],
    ['Caja #', caja.id || ''],
    ['Apertura', caja.date ? new Date(caja.date).toLocaleString() : ''],
    ['Cierre', caja.cerrada ? new Date(caja.cerrada).toLocaleString() : ''],
    ['Responsable', caja.closedByName || ''],
    [],
    ['Dinero Inicial', Number(caja.starting || 0)],
    ['Venta Total', Number(caja.total_recibido || 0)],
    ['Ventas Digitales', Number(caja.value_digital || 0)],
    ['Ingresos', Number(caja.ingreso || 0)],
    ['Egresos', Number(caja.egreso || 0)],
    ['Balance Final', Number(caja.value || 0)],
    ['Total Entregado', Number(caja.value || 0) - Number(caja.starting || 0)],
    [],
    ['Cantidad de Ventas', ventas.length],
    ['Ventas Anuladas', eliminadas.length]
  ];
  let shResumen = estilizarHoja(wb.addWorksheet('Resumen'), resumen, {
    tituloFila: true,
    etiquetaCol: 0,
    monedaCol: [1],
    ancho: [25, 45]
  });

  // 2. VENTAS
  let ventasAoa = [['#', 'Fecha', 'Tipo de Pago', 'Productos', 'Unidades', 'Recibido', 'Total Venta', 'Cambio', 'Cliente']];
  ventas.forEach((v, i) => {
    let unidades = 0;
    let txt = [];
    productosDeVenta(v).forEach(p => {
      let lp = lineaProducto(p);
      unidades += lp.cantidad;
      txt.push(lp.name + ' x' + lp.cantidad + ' = $' + formatNumber(lp.total));
    });
    let total = totalVenta(v);
    let recibido = recibidoVenta(v);
    ventasAoa.push([i + 1, fechaVenta(v), tipoPagoVenta(v), txt.join('; '), unidades, recibido, total, recibido - total, v.cliente || 'Consumidor Final']);
  });
  let shVentas = estilizarHoja(wb.addWorksheet('Ventas'), ventasAoa, {
    cabecera: true,
    monedaCol: [5, 6, 7],
    wrapCol: [3],
    ancho: [6, 20, 18, 55, 10, 14, 14, 12, 22]
  });

  // 3. PRODUCTOS RESUMIDOS
  let prodMap = {};
  ventas.forEach(v => {
    productosDeVenta(v).forEach(p => {
      let lp = lineaProducto(p);
      if (!prodMap[lp.name]) prodMap[lp.name] = { cantidad: 0, total: 0 };
      prodMap[lp.name].cantidad += lp.cantidad;
      prodMap[lp.name].total += lp.total;
    });
  });
  let prodAoa = [['Producto', 'Unidades Vendidas', 'Total Vendido $']];
  let totalUnd = 0, totalVal = 0;
  Object.keys(prodMap).sort().forEach(k => {
    prodAoa.push([k, prodMap[k].cantidad, Math.round(prodMap[k].total)]);
    totalUnd += prodMap[k].cantidad;
    totalVal += prodMap[k].total;
  });
  prodAoa.push(['TOTAL', totalUnd, Math.round(totalVal)]);
  let shProd = estilizarHoja(wb.addWorksheet('Productos Resumidos'), prodAoa, {
    cabecera: true,
    monedaCol: [2],
    resaltar: [prodAoa.length - 1],
    ancho: [40, 20, 18]
  });

  // 4. VENTAS ANULADAS
  let anulAoa = [['#', 'Fecha', 'Productos', 'Total']];
  eliminadas.forEach((v, i) => {
    let txt = productosDeVenta(v).map(p => { let lp = lineaProducto(p); return lp.name + ' x' + lp.cantidad; }).join('; ');
    anulAoa.push([i + 1, fechaVenta(v), txt, totalVenta(v)]);
  });
  let shAnul = estilizarHoja(wb.addWorksheet('Ventas Anuladas'), anulAoa, {
    cabecera: true,
    monedaCol: [3],
    wrapCol: [2],
    ancho: [6, 20, 55, 14]
  });

  // 5. INGRESOS
  let ingAoa = [['Fecha', 'Descripcion', 'Valor $']];
  ingresos.forEach(ch => ingAoa.push([ch.date ? new Date(ch.date).toLocaleString() : '', ch.description || '', Number(ch.money || 0)]));
  let shIng = estilizarHoja(wb.addWorksheet('Ingresos'), ingAoa, {
    cabecera: true,
    monedaCol: [2],
    wrapCol: [1],
    ancho: [20, 45, 16]
  });

  // 6. EGRESOS
  let egrAoa = [['Fecha', 'Descripcion', 'Valor $']];
  egresos.forEach(ch => egrAoa.push([ch.date ? new Date(ch.date).toLocaleString() : '', ch.description || '', Number(ch.money || 0)]));
  let shEgr = estilizarHoja(wb.addWorksheet('Egresos'), egrAoa, {
    cabecera: true,
    monedaCol: [2],
    wrapCol: [1],
    ancho: [20, 45, 16]
  });

  // 7. OBSERVACIONES
  let obs = [];
  egresos.forEach(el => {
    if (Number(el.money) == 0) obs.push('Se abrio la caja ' + (el.description ? ('para: ' + el.description) : 'Sin motivo alguno.'));
    if (String(el.description || '').startsWith('Prestamo >')) obs.push('Se Hizo Un Prestamo A ' + el.description.slice(10) + '. Por Un Valor De: ' + formatNumber(el.money));
  });
  eliminadas.forEach(el => obs.push('Se elimino una venta por: ' + formatNumber(totalVenta(el))));
  let obsAoa = [['Observaciones']].concat(obs.map(o => [o]));
  let shObs = estilizarHoja(wb.addWorksheet('Observaciones'), obsAoa, {
    cabecera: true,
    ancho: [120]
  });

  let fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = 'Cierre de Caja ' + (caja.id ? '#' + caja.id + ' ' : '') + fecha + '.xlsx';
  wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  });
}

function sendCerrarCaja() {
  let caja = JSON.parse(localStorage.getItem('caja'));
  let token = sessionStorage.getItem('acape-session');
  let configs = localStorage.getItem('configs') ? JSON.parse(localStorage.getItem('configs')) : {};
  popup.open({
    close: false,
    title: "Cerrando Caja",
    text: "Se esta cerrando caja, espere un momento"
  })

  let cerrandoCaja = Swal.fire({
    title: 'Cerrando caja...',
    text: 'Por favor, espera mientras cargamos la información.',
    icon: 'info',
    showConfirmButton: false, // No mostrar el botón de confirmación
    allowOutsideClick: false, // No permitir cerrar al hacer clic fuera
    allowEscapeKey: false, // No permitir cerrar con la tecla Escape
    didOpen: () => {
      Swal.showLoading(); // Mostrar el spinner de carga
    }
  });


  socket.emit('registrarCaja', { caja: caja, token: token, user: configs });

  socket.once('registrarCaja', (data) => {
    let ultimateCaja = data.data;

    let observaciones = [];
    ultimateCaja.egresos.forEach((element, i, array) => {
      if (Number(element.money) == 0) {
        observaciones.push(`Se abrio la caja ${element.description?(`para: `+element.description):"Sin motivo alguno."} `);
      }
      if (element.description.startsWith('Prestamo >')) {
        observaciones.push(`Se Hizo Un Prestamo A ${element.description.slice(10)}. Por Un Valor De: ${formatNumber(element.money)}`);
      }
    });

    let filteringVentasDigitales = ultimateCaja.ventas_hechas.filter(ch => ch.type != "efectivo");

    let ventasDigitales = 0;

    filteringVentasDigitales.map(ch => {
      ventasDigitales = ventasDigitales + ch.total_pago;
    });

    ultimateCaja.ventas_eliminadas.forEach((element, i, array) => {
      observaciones.push(`Se elimino una venta por: ${formatNumber(element.total_pago)}`);
    })

    generarExcelCierre(ultimateCaja);

    document.querySelector('body').innerHTML = `
      <style>
        body {
          font-family: monospace;
          font-size: 16px;
          margin: 0;
          padding: 0;
        }
        h2, h4, p {
          text-align: center;
          margin: 4px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        td {
          padding: 2px 0;
        }
        .bold {
          font-weight: bold;
        }
        .section {
          border-top: 1px dashed #000;
          margin-top: 8px;
          padding-top: 5px;
        }
      </style>

      <h2>INFORME DE CAJA</h2>
      <p>Caja #${ultimateCaja.id} - ${ultimateCaja.closedByName}</p>
      <p>${new Date().toLocaleString()}</p>

      <div class="section">
        <table>
          <tr><td class="bold">Dinero Inicial:</td><td style="text-align:right;">${formatNumber(ultimateCaja.starting)}</td></tr>
          <tr><td class="bold">Venta Total:</td><td style="text-align:right;">${formatNumber(ultimateCaja.total_recibido)}</td></tr>
          <tr><td class="bold">Ingresos Totales:</td><td style="text-align:right;">${formatNumber(ultimateCaja.ingreso)}</td></tr>
          <tr><td class="bold">Egresos Totales:</td><td style="text-align:right;">${formatNumber(ultimateCaja.egreso)}</td></tr>
          <tr><td class="bold">Total Gastado:</td><td style="text-align:right;">${formatNumber(ultimateCaja.ingreso - ultimateCaja.egreso)}</td></tr>
          <tr><td class="bold">Balance Final:</td><td style="text-align:right;">${formatNumber(ultimateCaja.value)}</td></tr>
          <tr><td class="bold">Total Entregado:</td><td style="text-align:right;">${formatNumber(ultimateCaja.value - ultimateCaja.starting)}</td></tr>
          <tr><td class="bold">Ventas Digitales:</td><td style="text-align:right;">${formatNumber(ventasDigitales)}</td></tr>
        </table>
      </div>

      <div class="section">
        <h4>DETALLE DE GASTOS</h4>
        <table>
          ${ultimateCaja.egresos.map(ch => `
            <tr>
              <td>- ${formatNumber(ch.money)}</td>
              <td>${ch.description}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="section">
        <h4>DETALLE DE INGRESOS</h4>
        <table>
          ${ultimateCaja.ingresos.map(ch => `
            <tr>
              <td>+ ${formatNumber(ch.money)}</td>
              <td>${ch.description}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="section">
        <h4>OBSERVACIONES</h4>
        <ul style="padding-left: 15px;">
          ${observaciones.map(ch => `<li>${ch}</li>`).join('')}
        </ul>
      </div>
    `;



    localStorage.removeItem('caja');

    window.print();
    sessionStorage.removeItem('acape-session');

    cerrandoCaja.close();

    location.replace('/')
  })
}

function cerrarCaja() {
  let caja = JSON.parse(localStorage.getItem('caja'));

  popup.open({
    title: "Cerrar caja",
    content: `
      <div class="serve-continue">
        <p><b>Total dinero ingresado: </b> ${formatNumber(caja.total_recibido + caja.ingreso)}</p>
        <p><b>Total dinero egresado: </b> ${formatNumber(caja.value_egresos + caja.egreso)}</p>
        <hr>
        <p>Dinero total: ${formatNumber(caja.value)}</p>
        <hr>
        <button class="btn btn-outline-success" onclick="generarExcelCierre(JSON.parse(localStorage.getItem('caja')))">Descargar Excel <i class="fa-solid fa-file-excel"></i></button>
        <button class="btn btn-outline-success" onclick="sendCerrarCaja()">Cerrar Caja <i class="fa-solid fa-x"></i></button>
      </div>
    `
  })
};

function guardarNuevaCaja(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('reabrirCaja', { token: token });
  socket.once('reabrirCaja', (data) => {
    if (!data.data) return Toast.fire({
      text: "No tienes permisos suficientes",
      icon: "error"
    });

    let finding_caja = data.data[id];
    if (!finding_caja) return Toast.fire({
      text: "Parece que esta caja ya no existe.",
      icon: "error"
    });

    finding_caja.ingresos = finding_caja.ingresos ? converterArray(finding_caja.ingresos) : [];
    finding_caja.egresos = finding_caja.egresos ? converterArray(finding_caja.egresos) : [];
    finding_caja.ventas_hechas = finding_caja.ventas_hechas ? converterArray(finding_caja.ventas_hechas) : [];
    finding_caja.ventas_eliminadas = finding_caja.ventas_eliminadas ? converterArray(finding_caja.ventas_eliminadas) : [];

    localStorage.setItem('caja', JSON.stringify(finding_caja));

    popup.start();
    location.hash = "#/"
  })
}

function reabrirCaja() {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('reabrirCaja', { token: token });
  socket.once('reabrirCaja', (data) => {
    if (!data.data) return Toast.fire({
      text: "No tienes permisos suficientes",
      icon: "error"
    });

    let array_cajas = converterArray(data.data).reverse().slice(-20);

    popup.open({
      title: "Cajas registradas",
      content: `
        <div class="cajas-registradas">
          ${array_cajas.map(ch => `
            <div class="card">
              <div class="card-body">
                <span><b>ID: </b> ${ch.id} - Cerrada hace ${getTimeLong(new Date() - new Date(ch.cerrada))}</span><br>
                <span>Valor de la caja: ${formatNumber(ch.value)}</span><br><br>
                <button class="btn btn-outline-primary" onclick="guardarNuevaCaja('${ch.id}')"><i class="fa-regular fa-folder-open"></i> Reabrir</button>
              </div>
            </div>
          `).join('<br>')}
        </div>
      `
    })
  })
}

function reloadCaja() {
  let caja = JSON.parse(localStorage.getItem('caja'));
  sessionValidator();

  return `
    <div class="container-fluid my-2">
      <h1 class="text-center">Administración de caja</h1>
      <p class="text-center">En esta sección abra todos los movimientos hechos en la caja.</p>
      <hr>
      <div class="center-x">
        <button class="btn btn-outline-success mr-2" onclick="openWindowIngreso()"><i class="fa-solid fa-up-long"></i> Ingreso</button>
        <button class="btn btn-outline-danger" onclick="openWindowEgreso()"><i class="fa-solid fa-down-long"></i> Egreso</button>
        <button class="btn btn-outline-info" onclick="listIngresosEgresos()"><i class="fa-solid fa-up-down"></i> Lista de ingresos y egresos</button>
      </div>
      <br>
      <p><b>Valor inicial de la caja</b>: $ ${formatNumber(caja.starting)} | <b>La caja fue iniciada hace:</b> ${getTimeLong(new Date() - caja.date)}</p>
      <span><b>Total Ventas Recibido: </b> <span class="text-success"> $ ${formatNumber(caja.total_recibido)}</span></span>
      <span><b>Total Ventas Egresado: </b> <span class="text-danger"> $ ${formatNumber(caja.value_egresos)}</span></span>
      <p><b>Ventas Hechas: </b> ${caja.ventas_hechas.length} | <b>Ventas eliminadas: </b> ${caja.ventas_eliminadas.length} <br> <b>Ventas Totales:</b> ${caja.ventas_hechas.length - caja.ventas_eliminadas.length}</p>
      <hr>
      <p><b>Ingresos: </b> <span class="text-success">${formatNumber(caja.ingreso)}</span> | <b>Total Ingresos: </b> ${caja.ingresos.length}</p>
      <p><b>Egresos: </b> <span class="text-danger">${formatNumber(caja.egreso)}</span> | <b>Total Egresos: </b> ${caja.egresos.length}</p>


      <hr>
      <h4><b>Valor actual:</b> $ ${formatNumber(caja.value)}</h4>
      <br>
      <button class="btn btn-outline-info" onclick="cerrarCaja()"><i class="fa-solid fa-parachute-box"></i> Cerrar Caja / Servicio</button>
      <hr>
      <h3>Servicio de cajas</h3>
      <p>Las cajas que han sido cerradas pueden volver a ser abiertas en cualquier momento, pero para eso se tienen que tener permisos de administración.</p>
      <button class="btn btn-outline-primary" onclick="reabrirCaja()"><i class="fa-regular fa-folder-open"></i> Reabrir Caja</button>
    </div>
  `;
}

router.get(['/caja'], () => {
  return reloadCaja();
});

function deleteClient(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('deleteClient', {
    token: token,
    client: id
  });
}

function editClient(id, e) {
  let data = {
    name: e[0].value,
    type: e[1].value,
    document: e[2].value,
    phone: e[3].value,
    correo: e[4].value,
    city: e[5].value,
    direccion: e[6].value,
    categoria: e[7] ? e[7].value : '',
    proviene: e[8] ? e[8].value : '',
    id: id
  }

  let token = sessionStorage.getItem('acape-session');

  socket.emit('editClient', {
    client: data,
    token: token
  });
  return false;
}

function editarCliente(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getClientesCompletos', { token: token });

  socket.once('getClientesCompletos', (data) => {
    let cliente = data.data[id];
    popup.open({
      title: "Manager Cliente",
      content: `
        <form onsubmit="return editClient('${cliente.id}', this)">
          <p>El usuario actual es el # ${id}</p>
          <label>Nombre del cliente</label> 
          <input type="text" required class="form-control" value="${cliente.name}" placeholder="Ejem: Jhon Doe Carreo">

          <label>Documento de identidad</label>
          <div class="input-group mb-3">
            <select value="${cliente.type}" class="form-valuate w-auto" required>
              <option value="cc">C.C</option>
              <option value="ti">T.I</option>
              <option value="ex">Ext</option>
            </select>
            <input type="number" value="${cliente.document}" required class="form-control d-inline" placeholder="Ejem: 102029192">
          </div>

          <label>Numero de telefono (Colombiano)</label>
          <div class="input-group mb-3">
            <span class="input-group-text">+57</span>
            <input type="number" value="${cliente.phone}" required class="form-control d-inline" placeholder="Ejem: 3112259328">
          </div>

          <label>Correo Electronico</label>
          <div class="input-group mb-3">
          <span class="input-group-text">Email</span>
            <input type="text" value="${cliente.correo}" required class="form-control" placeholder="Ejem: email@example.com">
          </div>

          <label>Lugar de expedicion</label>
          <input type="text" value="${cliente.city}" required class="form-control" placeholder="Fortul - Arauca">

          <label>Dirección del pedido / vivienda</label>
          <input type="text" value="${cliente.direccion}" required class="form-control" placeholder="Calle #15 12-13">

          <label>Categoría (opcional)</label>
          <input type="text" value="${cliente.categoria || ""}" class="form-control" placeholder="Ej: Empresa">

          <label>Proviene de (opcional)</label>
          <input type="text" value="${cliente.proviene || ""}" class="form-control" placeholder="Ej: nombre de la empresa">
          <br>
          <div class="edit-buttons">
            <button class="btn btn-outline-info w-100"><i class="fa-solid fa-pen"></i> Editar</button>
            <span class="btn btn-outline-danger w-100" onclick="deleteClient('${cliente.id}')"><i class="fa-solid fa-trash"></i> Eliminar</span>
          </div>
        </form>
      `
    })
  })
}

function reloadClientes() {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getClientesCompletos', { token: token });
  socket.once('getClientesCompletos', (data) => {
    if (!data.data) return Toast.fire({
      title: "Clientes",
      text: data.message
    });

    window._clientesPagina = converterArray(data.data).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    let inputBusqueda = document.querySelector('#buscarClientePagina');
    renderTablaClientes(inputBusqueda && inputBusqueda.value ? inputBusqueda.value : '');
  })
}

function renderTablaClientes(consulta) {
  let tbody = document.querySelector('.tbody-clientes');
  if (!tbody) return;
  let q = normalizarTexto(consulta || '');
  let lista = (window._clientesPagina || []).filter(ch => {
    if (!q) return true;
    return normalizarTexto(ch.name || '').includes(q) || normalizarTexto(ch.document || '').includes(q);
  });

  tbody.innerHTML = "";
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin coincidencias</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(ch => `
    <tr>
      <td>${ch.id}</td>
      <td>${ch.name}</td>
      <td>${ch.document}</td>
      <td>${ch.phone}</td>
      <td>${ch.categoria || ""}</td>
      <td>${ch.proviene || ""}</td>
      <td>
        <button class="btn btn-outline-info" onclick="editarCliente('${ch.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-outline-primary" onclick="verComprasCliente(${ch.id})"><i class="fa-solid fa-bag-shopping"></i> Compras</button>
      </td>
    </tr>
  `).join('');
}

function filtrarClientesPagina(valor) {
  renderTablaClientes(valor);
}

function verComprasCliente(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getComprasCliente', { id: id, token: token });
  socket.once('getComprasCliente', (data) => {
    if (!data.data) return Toast.fire({ title: "Compras del cliente", text: data.message, icon: "info" });
    window._comprasClienteActual = data.data;
    renderComprasCliente(data.data, 'todo');
    popup.open({
      title: "Compras del cliente: " + (data.data.name || id),
      content: `
        <div class="cliente-compras">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <b>Total acumulado: $ ${formatNumber(data.data.total)}</b>
            <span class="text-muted small">${data.data.cantVentas || 0} venta(s)</span>
          </div>
          <div class="mb-2">
            <label class="small text-muted">Período</label>
            <select id="filtroComprasCliente" class="form-select" onchange="filtrarComprasCliente(this.value)">
              <option value="todo">Todo</option>
              <option value="30d">Últimos 30 días</option>
              <option value="mes">Este mes</option>
              <option value="mesAnterior">Mes pasado</option>
            </select>
          </div>
          <div id="comprasClienteContenido"></div>
          <div id="comprasClienteResumen"></div>
        </div>
      `
    });
  });
}

function filtrarComprasCliente(filtro) {
  renderComprasCliente(window._comprasClienteActual, filtro);
}

function renderComprasCliente(info, filtro) {
  const cont = document.querySelector('#comprasClienteContenido');
  const res = document.querySelector('#comprasClienteResumen');
  if (!cont) return;

  const ahora = new Date();
  const filtradas = (info.compras || []).filter(c => {
    const d = new Date(c.fecha || 0);
    if (filtro === '30d') return (ahora - d) <= 30 * 24 * 3600 * 1000;
    if (filtro === 'mes') return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
    if (filtro === 'mesAnterior') {
      const anio = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();
      const mes = ahora.getMonth() === 0 ? 11 : ahora.getMonth() - 1;
      return d.getFullYear() === anio && d.getMonth() === mes;
    }
    return true;
  });

  const subtotal = filtradas.reduce((s, c) => s + Number(c.total || 0), 0);

  if (!filtradas.length) {
    cont.innerHTML = '<p class="text-muted small">Este cliente no tiene compras en este período.</p>';
  } else {
    cont.innerHTML = `<table class="table table-sm table-striped">
      <thead><tr><th># Vent</th><th>Fecha</th><th>Items</th><th>Total</th><th></th></tr></thead>
      <tbody>
        ${filtradas.map(c => `
          <tr>
            <td>${c.ventaId}</td>
            <td>${formatDate(c.fecha)}</td>
            <td class="small">${(c.productos || []).map(p => p.nombre + ' x' + p.cantidad).join('<br>')}</td>
            <td>$ ${formatNumber(c.total)}</td>
            <td><button class="btn btn-outline-secondary btn-sm" onclick="verCompraCliente(${c.ventaId})">Ver</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  res.innerHTML = `<div class="alert alert-info p-2 small">Total comprado en el período seleccionado: <b>$ ${formatNumber(subtotal)}</b> en ${filtradas.length} venta(s).</div>`;
}

function compraAVenta(compra, info) {
  return {
    id: compra.ventaId,
    date: compra.fecha,
    cliente: info.name || "Consumidor Final",
    total_pago: compra.total,
    recibido: compra.total,
    products: (compra.productos || []).map(p => {
      let cant = Number(p.cantidad) || 1;
      return {
        name: p.nombre,
        cantidad: p.cantidad,
        price: cant ? (Number(p.total) || 0) / cant : 0,
        precio_final: p.total
      };
    })
  };
}

function verCompraCliente(ventaId) {
  let info = window._comprasClienteActual;
  if (!info) return Toast.fire({ title: "Compras del cliente", text: "Carga primero las compras del cliente.", icon: "warning" });

  let compra = (info.compras || []).find(c => String(c.ventaId) === String(ventaId));
  if (!compra) return Toast.fire({ title: "Compras del cliente", text: "Esta compra no aparece en los datos del cliente.", icon: "error" });

  let venta = compraAVenta(compra, info);

  popup.open({
    title: "Compra del cliente: " + (info.name || ventaId),
    content: `
      <div class="facturar pd-1">
        <div class="factura-termica">
          ${reciboVentaHTML(venta)}
        </div>
        <hr>
        <button class="btn btn-outline-success" onclick="imprimirCompraCliente(${venta.id})"><i class="fa-solid fa-print"></i> Imprimir</button>
        <button class="btn btn-outline-info" onclick="verComprasCliente(${info.id})"><i class="fa-solid fa-arrow-left"></i> Volver a compras</button>
      </div>
    `
  });
}

function imprimirCompraCliente(ventaId) {
  let info = window._comprasClienteActual;
  if (!info) return Toast.fire({ title: "Compras del cliente", text: "Carga primero las compras del cliente.", icon: "warning" });

  let compra = (info.compras || []).find(c => String(c.ventaId) === String(ventaId));
  if (!compra) return Toast.fire({ title: "Compras del cliente", text: "Esta compra no aparece en los datos del cliente.", icon: "error" });

  let venta = compraAVenta(compra, info);
  window._ventaReciboSnapshot = {
    venta: venta.products,
    total_pago: venta.total_pago,
    recibido: venta.recibido,
    digital: null,
    clientId: info.id,
    date: venta.date
  };
  imprimirReciboVenta();
}

function submitCreateClient(e) {
  let data = {
    name: e[0].value,
    type: e[1].value,
    document: e[2].value,
    phone: e[3].value,
    correo: e[4].value,
    city: e[5].value,
    direccion: e[6].value,
    categoria: e[7] ? e[7].value : '',
    proviene: e[8] ? e[8].value : ''
  }
  let token = sessionStorage.getItem('acape-session');
  socket.emit('createClient', {
    client: data,
    token: token
  })

  return false;
}

function createClient() {
  popup.open(({
    title: "Crear Cliente",
    content: `
      <form class="form-inline" onsubmit="return submitCreateClient(this)">
        <p>Crea un cliente para poder facturar a nombre de este cliente.</p>
        <label>Nombre Completo Del Cliente</label>
        <input type="text" class="form-control" required placeholder="Ejem: Jhon Andres Doe Clinton">
        
        <br>
        <label>Documento de identidad</label>
        <div class="input-group mb-3">
          <select value="cc" class="form-valuate w-auto">
            <option value="cc">C.C</option>
            <option value="ti">T.I</option>
            <option value="ex">Ext</option>
          </select>
          <input type="number" class="form-control d-inline" placeholder="Ejem: 102029192">
        </div>

        <label>Numero de telefono (Colombiano)</label>
        <div class="input-group mb-3">
          <span class="input-group-text">+57</span>
          <input type="number" class="form-control d-inline" placeholder="Ejem: 3112259328">
        </div>

        <label>Correo Electronico</label>
        <div class="input-group mb-3">
        <span class="input-group-text">Email</span>
          <input type="text" class="form-control" placeholder="Ejem: email@example.com">
        </div>

        <label>Lugar de expedicion</label>
        <input type="text" class="form-control" placeholder="Fortul - Arauca">

        <label>Dirección del pedido / vivienda</label>
        <input type="text" class="form-control" placeholder="Calle #15 12-13">

        <br>
        <label>Categoría (opcional)</label>
        <input type="text" class="form-control" placeholder="Ej: Empresa">

        <br>
        <label>Proviene de (opcional)</label>
        <input type="text" class="form-control" placeholder="Ej: nombre de la empresa">
        <br>
        <button class="btn btn-outline-primary d-block w-100">Guardar Cliente</button>
      </form>
    `
  }))
}

function importarClientes() {
  popup.open({
    title: "Importar Clientes (Excel)",
    content: `
      <div class="importar-clientes">
        <p class="small text-muted">Copia las filas en Excel y pégalas aquí. El programa detecta el separador (tabulador, coma o punto y coma) automáticamente.</p>

        <label class="small">Tipo de documento (se aplica a todos)</label>
        <select id="tipoDocImport" class="form-select w-auto mb-2" onchange="previewImportarClientes()">
          <option value="cc" selected>C.C</option>
          <option value="ti">T.I</option>
          <option value="ex">Ext</option>
        </select>

        <div class="row mt-1 mb-2">
          <div class="col-6">
            <label class="small">Categoría (opcional, se aplica a todos)</label>
            <input id="categoriaImport" class="form-control form-control-sm" type="text" placeholder="Ej: Empresa" oninput="previewImportarClientes()" list="listaCategorias">
            <datalist id="listaCategorias">
              <option value="Empresa"></option>
              <option value="Persona Natural"></option>
            </datalist>
          </div>
          <div class="col-6">
            <label class="small">Proviene de (opcional, se aplica a todos)</label>
            <input id="provieneImport" class="form-control form-control-sm" type="text" placeholder="Ej: nom. de la empresa" oninput="previewImportarClientes()">
          </div>
        </div>

        <button class="btn btn-outline-secondary btn-sm mb-2" type="button" onclick="pegarDesdeExcel()">Pegar desde Excel</button>
        <textarea id="textoImportar" class="form-control" rows="8" placeholder="Pega aqui las filas copiadas de Excel. Ejem (con tabulador):${String.fromCharCode(10)}Jhon Doe	102029192	3112259328${String.fromCharCode(10)}Maria Gomez	1098765432	3210000000" oninput="previewImportarClientes()"></textarea>

        <div class="row mt-3">
          <div class="col-4">
            <label class="small">Columna Nombre</label>
            <select id="colNombre" class="form-select form-select-sm" onchange="previewImportarClientes()">
              <option value="0">Ninguna</option>
              <option value="1" selected>1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </div>
          <div class="col-4">
            <label class="small">Columna Documento</label>
            <select id="colDocumento" class="form-select form-select-sm" onchange="previewImportarClientes()">
              <option value="0">Ninguna</option>
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </div>
          <div class="col-4">
            <label class="small">Columna Teléfono</label>
            <select id="colTelefono" class="form-select form-select-sm" onchange="previewImportarClientes()">
              <option value="0">Ninguna</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col-4">
            <label class="small">Columna Correo</label>
            <select id="colCorreo" class="form-select form-select-sm" onchange="previewImportarClientes()">
              ${[0,1,2,3,4,5,6].map(n => `<option value="${n}">${n || "Ninguna"}</option>`).join('')}
            </select>
          </div>
          <div class="col-4">
            <label class="small">Columna Ciudad</label>
            <select id="colCiudad" class="form-select form-select-sm" onchange="previewImportarClientes()">
              ${[0,1,2,3,4,5,6].map(n => `<option value="${n}">${n || "Ninguna"}</option>`).join('')}
            </select>
          </div>
          <div class="col-4">
            <label class="small">Columna Dirección</label>
            <select id="colDireccion" class="form-select form-select-sm" onchange="previewImportarClientes()">
              ${[0,1,2,3,4,5,6].map(n => `<option value="${n}">${n || "Ninguna"}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="vistaPreviaImportar" class="mt-3 small"></div>

        <button class="btn btn-outline-primary d-block w-100 mt-3" onclick="enviarImportacionClientes()">Importar clientes</button>
      </div>
    `
  })
}

function pegarDesdeExcel() {
  let area = document.querySelector('#textoImportar');
  if (!area) return;

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then((texto) => {
      if (texto) {
        area.value = texto;
        previewImportarClientes();
      }
    }).catch(() => {
      Toast.fire({ title: "Pegar desde Excel", text: "Usa Ctrl+V dentro del cuadro.", icon: "info" });
      area.focus();
    });
  } else {
    area.focus();
  }
}

function parsearClientesImportar() {
  let area = document.querySelector('#textoImportar');
  if (!area) return [];
  let texto = area.value;
  if (!texto.trim()) return [];

  let lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lineas.length) return [];

  let contadores = { "\t": 0, ";": 0, ",": 0 };
  lineas.forEach(l => {
    contadores["\t"] += (l.match(/\t/g) || []).length;
    contadores[";"] += (l.match(/;/g) || []).length;
    contadores[","] += (l.match(/,/g) || []).length;
  });

  let delim = Object.keys(contadores).sort((a, b) => contadores[b] - contadores[a])[0];
  if (contadores[delim] === 0) delim = "\t";

  let colNombre = Number(document.querySelector('#colNombre').value);
  let colDocumento = Number(document.querySelector('#colDocumento').value);
  let colTelefono = Number(document.querySelector('#colTelefono').value);
  let colCorreo = Number(document.querySelector('#colCorreo').value);
  let colCiudad = Number(document.querySelector('#colCiudad').value);
  let colDireccion = Number(document.querySelector('#colDireccion').value);
  let tipo = document.querySelector('#tipoDocImport').value;
  let categoria = document.querySelector('#categoriaImport').value.trim();
  let proviene = document.querySelector('#provieneImport').value.trim();

  let celda = (arr, col) => (col > 0 && arr[col - 1] != null) ? String(arr[col - 1]).trim() : "";

  return lineas.map((linea, idx) => {
    let celdas = linea.split(delim);
    return {
      fila: idx + 1,
      name: celda(celdas, colNombre),
      document: celda(celdas, colDocumento),
      phone: celda(celdas, colTelefono),
      correo: celda(celdas, colCorreo),
      city: celda(celdas, colCiudad),
      direccion: celda(celdas, colDireccion),
      type: tipo,
      categoria: categoria,
      proviene: proviene
    };
  });
}

function escapeHtmlImportar(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function previewImportarClientes() {
  let cont = document.querySelector('#vistaPreviaImportar');
  if (!cont) return;

  let clientes = parsearClientesImportar();
  if (!clientes.length) {
    cont.innerHTML = '<span class="text-muted">Pega las filas para ver la vista previa.</span>';
    return;
  }

  let validos = clientes.filter(c => c.name);
  let notaCategoria = clientes[0].categoria ? ` · <b>Categoría:</b> ${escapeHtmlImportar(clientes[0].categoria)}` : "";
  let notaProviene = clientes[0].proviene ? ` · <b>Proviene de:</b> ${escapeHtmlImportar(clientes[0].proviene)}` : "";
  cont.innerHTML = `
    <b>Se detectaron ${clientes.length} fila(s)${clientes.length !== validos.length ? ` (${validos.length} con nombre)` : ""}.${notaCategoria}${notaProviene}</b>
    <table class="table table-sm table-striped mt-1">
      <thead><tr><th>#</th><th>Nombre</th><th>Doc.</th><th>Tel.</th><th>Correo</th></tr></thead>
      <tbody>
        ${clientes.slice(0, 5).map(c => `<tr><td>${c.fila}</td><td>${escapeHtmlImportar(c.name)}</td><td>${escapeHtmlImportar(c.document)}</td><td>${escapeHtmlImportar(c.phone)}</td><td>${escapeHtmlImportar(c.correo)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function enviarImportacionClientes() {
  let clientes = parsearClientesImportar();
  let validos = clientes.filter(c => c.name);
  if (!validos.length) return Toast.fire({ title: "Importar clientes", text: "No hay filas con nombre para importar.", icon: "warning" });

  let token = sessionStorage.getItem('acape-session');
  socket.emit('createClientsBulk', { clientes: validos, token: token });
  socket.once('createClientsBulk', (data) => {
    if (!data.data) return Toast.fire({ title: "Importar clientes", text: data.message || "No se pudo importar.", icon: "error" });

    sessionStorage.removeItem('clients-lite');
    popup.close();
    reloadClientes();

    let resumen = data.data;
    if (resumen.omitidos && resumen.omitidos.length) {
      let detalles = resumen.omitidos.map(o => `${o.fila}. ${o.name || "(sin nombre)"} — ${o.razon}`).join('<br>');
      popup.open({
        title: `Importados ${resumen.creados.length} de ${resumen.total}`,
        content: `
          <p class="small text-muted">Plantillas omitidas:</p>
          <div class="small">${detalles}</div>
          <br>
          <button class="btn btn-outline-info d-block w-100" onclick="popup.close()">Aceptar</button>
        `
      });
    } else {
      Toast.fire({ title: "Importación completada", text: `Se importaron ${resumen.creados.length} cliente(s).`, icon: "success" });
    }
  });
}

router.get('/clientes', () => {
  sessionValidator();
  reloadClientes();
  return `
    <div class="my-2 container-fluid">
      <h3 class="text-center">Clientes</h3>
      <p class="text-center">La zona de clientes tiene un accesso restringido.</p>
      <div class="text-center">
        <button class="btn btn-outline-primary" onclick="createClient()">Nuevo Cliente</button>
        <button class="btn btn-outline-primary" onclick="importarClientes()">Importar Clientes</button>
      </div>
      <div class="my-3">
        <input type="text" id="buscarClientePagina" class="form-control" autocomplete="off" placeholder="Buscar cliente por nombre o documento..." oninput="filtrarClientesPagina(this.value)">
      </div>
      <br>
      <div class="clients-table">
        <table class="table-products">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Telefono</th>
              <th>Categoria</th>
              <th>Proviene de</th>
              <th>Eliminar</th>
            </tr>
          </thead>
          <tbody class="tbody-clientes">  
          </tbody>
        </table>
      </div>
    </div>
  `;
})

function updateFacturas(funcToExec) {
  let token = sessionStorage.getItem('acape-session');

  /// ALERT FOR UPDATING FACTURAS NON ERROR
  let updatingFacturas = Swal.fire({
    title: 'Descargando facturas',
    text: 'Por favor, espera mientras cargamos la información.',
    icon: 'info',
    showConfirmButton: false, // No mostrar el botón de confirmación
    allowOutsideClick: false, // No permitir cerrar al hacer clic fuera
    allowEscapeKey: false, // No permitir cerrar con la tecla Escape
    didOpen: () => {
      Swal.showLoading(); // Mostrar el spinner de carga
    }
  });


  socket.emit('getAllVentas', { token: token });
  socket.once('getAllVentas', (data) => {
    if (!data.data) return Toast.fire({
      title: "Error de permisos",
      text: "Parece que tu usuario no tiene permisos para facturar.",
    });

    localStorage.setItem('all-data-ventas', JSON.stringify(data.data));

    updatingFacturas.close();

    funcToExec()
  })
}

function imprimirHTML(html) {
  document.querySelector('body').innerHTML = `
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .factura-termica { width: 72mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 13pt; font-weight: bold; line-height: 1.4; padding: 2mm; }
      .ft-head { text-align: center; margin-bottom: 4px; }
      .ft-emp { font-size: 15pt; font-weight: bold; text-transform: uppercase; }
      .ft-slogan { font-size: 11pt; }
      .ft-line { display: flex; justify-content: space-between; font-size: 12pt; padding: 2px 0; }
      .ft-strong span { font-weight: bold; }
      .ft-divider { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; font-size: 12pt; }
      .ft-headrow { display: flex; justify-content: space-between; border-top: 1px solid #000; border-bottom: 1px solid #000; font-weight: bold; font-size: 12pt; padding: 3px 0; margin-top: 4px; margin-bottom: 4px; }
      .ft-item { border-bottom: 1px dashed rgba(0, 0, 0, 0.2); padding: 6px 0; }
      .ft-item-row { display: flex; justify-content: space-between; align-items: baseline; }
      .ft-col-desc { flex: 1 1 auto; text-align: left; padding-right: 6px; white-space: normal; }
      .ft-col-val { white-space: nowrap; text-align: right; }
      .ft-sub { font-size: 10pt; color: #000; margin-top: 3px; }
      .ft-espacio { height: 10px; }
      .ft-tot { display: flex; justify-content: space-between; font-size: 12pt; padding: 2px 0; }
      .ft-val { text-align: right; white-space: nowrap; }
      .ft-separador { border-top: 1px dashed #000; margin: 9px 0 6px; }
      .ft-footer { text-align: center; font-size: 11pt; margin-top: 2px; }
      .ft-disclaimer { text-align: center; font-size: 10pt; color: #000; margin-top: 4px; }
      table, th, td { border: none !important; }
      @media print {
        body { width: 78mm; margin: 0; padding: 0; color: #000000 !important; background: #ffffff !important; -webkit-font-smoothing: none !important; -moz-osx-font-smoothing: unset !important; font-smooth: never !important; text-rendering: optimizeSpeed !important; }
        * { text-shadow: none !important; box-shadow: none !important; filter: none !important; }
      }
    </style>
    <div class="factura-termica">
      ${html}
    </div>
  `;
  window.print();

  setTimeout(() => {
    location.reload()
  }, 1000)
}

function imprimirFactura() {
  let element = document.querySelector('.factura-termica');
  if (!element) return Toast.fire({
    title: "Imprimir",
    text: "No hay un documento listo para imprimir.",
    icon: "warning"
  });

  imprimirHTML(element.innerHTML);
}

function generarPDF(id, ele, pd) {
  var element = ele ? ele : document.querySelector('.factura-termica');
  let generado = html2pdf(element, {
    margin: pd ? pd : 0,
    filename: `${id}-${new Date()-0}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  })

  return generado;
}

function $(htmlSelector) {
  return document.querySelector(htmlSelector);
}

function changeUser(e) {
  $('.change-user').innerHTML = e.value;
}

function facturaHoja() {
  generarPDF('hoja', document.querySelector('.hoja-factura'), 0.1);
}

function generarNumeroFactura(num, px) {
  const prefix = px ? px : "INFO-";
  const numStr = num.toString().padStart(6, '0'); // Formatea el número con ceros a la izquierda
  return prefix + numStr;
}

// Moneda compacta para ticket térmico (sin decimales cuando el monto es entero)
function ftMoney(n) {
  let num = Number(n) || 0;
  let texto = formatNumber(num);
  return (num % 1 === 0) ? texto.replace(/\.00$/, '') : texto;
}

// DOMINIO TEMPORAL: devuelve el HTML del ticket térmico (80mm) de una venta
function reciboVentaHTML(venta) {
  let configs = !localStorage.getItem('configs') ? {} : JSON.parse(localStorage.getItem('configs'));
  let productos = converterArray(venta.products || []);
  let fecha = new Date(venta.date || Date.now());
  let pagodigital = venta.digital ? 'Transferencia > ' + venta.digital : 'Efectivo > De Contado';
  let numero = (venta.id != null) ? generarNumeroFactura(venta.id) + '  &nbsp;' : '';

  return `
    <div class="ft-head">
      <div class="ft-emp">${configs.name ? configs.name : "Factura Desprendible"}</div>
      <div class="ft-slogan">${configs.slogan ? configs.slogan : "Para servirte"}</div>
      ${configs.user ? `<div class="ft-line">${configs.user.name || ""}</div>` : ""}
      ${configs.user ? `<div class="ft-line">NIT: ${configs.user.document || ""}  Tel: ${configs.user.phone || ""}${configs.user.email ? "  " + configs.user.email : ""}</div>` : ""}
      <div class="ft-divider">${numero}${fecha.toLocaleDateString()} &nbsp; ${fecha.toLocaleTimeString()}</div>
    </div>

    <div class="ft-headrow">
      <span class="ft-col-desc">DESCRIPCION</span>
      <span class="ft-col-val">VALOR</span>
    </div>

    ${productos.map(ch => {
      let unitario = (ch.precio_unitario != null ? ch.precio_unitario : ch.price) || 0;
      let valor = ch.precio_final != null ? ch.precio_final : (Number(unitario) * Number(ch.cantidad || 1));
      return `
      <div class="ft-item">
        <div class="ft-item-row">
          <span class="ft-col-desc">${ch.name}</span>
          <span class="ft-col-val ft-val">${ftMoney(valor)}</span>
        </div>
        <div class="ft-sub">x${ch.cantidad} @ ${ftMoney(unitario)}</div>
      </div>`;
    }).join('')}

    <div class="ft-espacio"></div>

    <div class="ft-tot">
      <span>Cliente:</span><span class="ft-val">${venta.cliente ? venta.cliente : "Consumidor Final"}</span>
    </div>
    <div class="ft-tot">
      <span>Pago:</span><span class="ft-val">${pagodigital}</span>
    </div>
    <div class="ft-line ft-strong">
      <span>TOTAL</span><span class="ft-val">${ftMoney(venta.total_pago)}</span>
    </div>
    <div class="ft-line">
      <span>RECIBIDO</span><span class="ft-val">${ftMoney(venta.recibido)}</span>
    </div>
    <div class="ft-line">
      <span>CAMBIO</span><span class="ft-val">${ftMoney(Number(venta.recibido || 0) - Number(venta.total_pago || 0))}</span>
    </div>

    <div class="ft-separador"></div>
    <div class="ft-footer">${configs.footer ? configs.footer : ""}</div>
    <div class="ft-disclaimer">ESTE DOCUMENTO ES INFORMATIVO, NO ES FACTURA LEGAL NI DE CAMBIO. SI NECESITA FACTURA ELECTRONICA AVISAR DESPUES DE LA COMPRA.</div>
  `;
}


// HERE STAY

function factVenta(id) {
  let data = JSON.parse(localStorage.getItem('all-data-ventas'));

  let configs = !localStorage.getItem('configs') ? {} : JSON.parse(localStorage.getItem('configs'))
  if (!configs.user) return alert.fire({
    title: "Error de configuraciones",
    text: "Tienes que configurar los datos del usuario/vendedor primero para poder facturar.",
    icon: "error"
  });


  let ventas = converterArray(data);
  let filter_ventas = ventas.filter(ch => new Date() - timems('1d') <= ch.date);
  let finding_venta = data[id];

  if (!finding_venta) return Toast.fire({
    text: "Parece que esta venta ya no existe.",
    icon: "error"
  });

  popup.open({
    title: `Facturando ${id}`,
    content: `
      <div class="facturar pd-1">
        <hr>
        <div class="factura-termica">
          ${reciboVentaHTML(finding_venta)}
        </div>

        <hr>

        <hr>
        <button class="btn btn-outline-primary" onclick="generarPDF('${finding_venta.id}')">Generar PDF</button>
        <button class="btn btn-outline-success" onclick="imprimirFactura('${finding_venta.id}')">Imprimir</button>
        <button class="btn btn-outline-danger" onclick="eliminarVenta('${finding_venta.id}', ${finding_venta.recibido})">Eliminar</button>
        <br>
      </div>
    `,
    closeButtonFunction: facturaVenta
  })
}

function setOpenFacturas() {
  let data = JSON.parse(localStorage.getItem('all-data-ventas'));

  let ventas = converterArray(data ? data : {});
  let filter_ventas = ventas;
  popup.open({
    title: "Facturar ventas",
    content: `
      <div>
        <p>Las facturas de ventas se generan automaticamente.</p>
        ${filter_ventas.reverse().map(ch => `
          <div class="card">
            <div class="card-body">
              <b>ID: </b> ${ch.id} | <b>Productos: </b> ${converterArray(ch.products).length} | <b>Recibido:</b> ${formatNumber(ch.recibido)}
              <b>Total Pago: </b> ${formatNumber(ch.total_pago)} | <b>Cambio: </b> ${formatNumber(Number(ch.recibido)-Number(ch.total_pago))} - <b>Pagado a través de: ${ch.digital?("Transferencia Bancaria > "+ch.digital):"Efectivo > De Contado."}</b>
            </div>
            <div class="card-footer">
              <button class="btn btn-sm btn-outline-info" onclick="factVenta('${ch.id}')">Abrir</button>
            </div>
          </div>
        `)}
      </div>
    `
  })
}

function facturaVenta() {
  updateFacturas(setOpenFacturas);
}

function facturaViewIngreso(date) {
  let caja = JSON.parse(localStorage.getItem('caja'));
  let ingresos = caja.ingresos
  let finding_ingreso = ingresos.find(ch => ch.date == date);

  let configs = !localStorage.getItem('configs') ? {} : JSON.parse(localStorage.getItem('configs'))
  configs = configs ? configs : {};

  popup.open({
    title: `Creando factura de ingreso`,
    content: `
      <div class="facturar pd-1">
        <div class="factura-termica">
          <div class="factura-head">
            <h3 class="text-center">${configs.name?configs.name:"Factura Desprendible"}</h3>
            <p class="text-center">${configs.slogan?configs.slogan:"Para servirte"}</p>
            <br>
          </div>
          <b>Fecha: ${new Date(finding_ingreso.date).toLocaleDateString()}</b><br>
          <b>$ ${formatNumber(finding_ingreso.money)}</b><br>
          <b>Descripción: <td>${finding_ingreso.description}</b>
          <br><br>
          <hr>
          <br>
          <p>Este ingreso fue registrado en el turno actual de la caja, la caja fue abierta: ${new Date(caja.date).toLocaleString()}</p>
        </div>

        <hr>
        <button class="btn btn-outline-primary" onclick="generarPDF('ingreso')">Generar PDF</button>
        <button class="btn btn-outline-success" onclick="imprimirFactura('ingreso')">Imprimir</button>
      </div>
    `,
    closeButtonFunction: facturaIngreso
  })
}

function facturaIngreso() {
  let data = JSON.parse(localStorage.getItem('all-data-server'));
  let caja = JSON.parse(localStorage.getItem('caja'));

  let ingresos = caja.ingresos.reverse();
  let final_html = !ingresos[0] ? "No hay ingresos registrados" : ingresos.map(ch => `<div class="card">
    <div class="card-body">
      <div class="content-card">
        <b>Registro: </b> Hace ${getTimeLong(new Date() - new Date(ch.date))}<br>
        <b>Entrada: </b> $ ${formatNumber(ch.money)} - ${ch.description}
      </div>
    </div>
    <div class="card-footer"><button class="btn btn-outline-primary" onclick="facturaViewIngreso('${ch.date}')"><i class="fa-solid fa-eye"></i></button></div>
  </div>`)

  popup.open({
    title: "Facturar Ingreso",
    content: `
      <div class="facturar">
        <div class="cards">
          ${final_html}
        </div>
      </div>
    `
  })
}

function facturaViewEgreso(date) {
  let caja = JSON.parse(localStorage.getItem('caja'));
  let egresos = caja.egresos
  let finding_egreso = egresos.find(ch => ch.date == date);

  let configs = !localStorage.getItem('configs') ? {} : JSON.parse(localStorage.getItem('configs'))
  configs = configs ? configs : {};

  popup.open({
    title: `Creando factura de egreso`,
    content: `
      <div class="facturar pd-1">
        <div class="factura-termica">
          <div class="factura-head">
            <h1 class="text-center">${configs.name?configs.name:"Factura Desprendible"}</h1>
            <p class="text-center">${configs.slogan?configs.slogan:"Para servirte"}</p>
            <br>
          </div>
          <b>${new Date(finding_egreso.date).toLocaleDateString()}</b><br>
          <b>-${formatNumber(finding_egreso.money)}</b><br>
          <b>${finding_egreso.description}</b><br>
          <br>
          <hr>
          <br>
          <p>Este egreso fue registrado en el turno actual de la caja, la caja fue abierta: ${new Date(caja.date).toLocaleString()}</p>
        </div>

        <hr>
        <button class="btn btn-outline-primary" onclick="generarPDF('egreso')">Generar PDF</button>
        <button class="btn btn-outline-success" onclick="imprimirFactura('egreso')">Imprimir</button>
      </div>
    `,
    closeButtonFunction: facturaEgreso
  })
}

function facturaEgreso() {
  let data = JSON.parse(localStorage.getItem('all-data-server'));
  let caja = JSON.parse(localStorage.getItem('caja'));

  let egresos = caja.egresos.reverse();
  let final_html = !egresos[0] ? "No hay egresos registrados" : egresos.map(ch => `<div class="card">
    <div class="card-body">
      <div class="content-card">
        <b>Registro: </b> Hace ${getTimeLong(new Date() - new Date(ch.date))}<br>
        <b>Entrada: </b> $ ${formatNumber(ch.money)} - ${ch.description}
      </div>
    </div>
    <div class="card-footer"><button class="btn btn-outline-success" onclick="facturaViewEgreso('${ch.date}')"><i class="fa-solid fa-eye"></i></button></div>
  </div>`)

  popup.open({
    title: "Facturar Egreso",
    content: `
      <div class="facturar">
        <div class="cards">
          ${final_html}
        </div>
      </div>
    `
  })
}

function getDayName(dateString) {
  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const date = new Date(dateString);
  const dayName = daysOfWeek[date.getDay()];
  return dayName;
}

function formatDate(final) {
  const date = new Date(final);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // Los meses son indexados desde 0
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function fnformat(final) {
  const date = new Date(final);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // Los meses son indexados desde 0
  const year = date.getUTCFullYear();

  return `${month}/${day}/${year}`;
}


function imprimirPedido(id) {
  socket.emit('pedido', { id: id });
  socket.once('pedido', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    let productsList = converterArray(data.data.cotizar.products);

    let configs = localStorage.getItem('configs') ? JSON.parse(localStorage.getItem('configs')) : {};
    let facturaImprimir = `
      <div class="facturar pd-1">
          <div class="factura-termica">
            <div class="factura-head">
              <h1 class="text-center">${configs.name?configs.name:"Factura Desprendible"}</h1>
              <p class="text-center">${configs.slogan?configs.slogan:"Para servirte"}</p>
              <p class="text-center"><span style="font-size: 11pt;">${configs.user.name} <br> NIT: ${configs.user.document}</span> <br> Telefono: ${configs.user.phone}</p>
              <p class="text-center">${generarNumeroFactura(id, 'FP-')} - Dia:  ${formatDate(data.data.entrega)} - ${getDayName(fnformat(data.data.entrega))} A Las ${data.data.hora}</p>
            </div>
            <div class="container-fluid text-center" style="border: 1px solid rgba(0, 0 ,0, 0.5);">
              ${productsList.map(ch => `<div class="principal-text">${ch.id} - ${ch.name} - ${formatNumber(ch.precio_unitario)} x ${ch.cantidad} = ${formatNumber(ch.precio_final)}</div>`).join('<br>')}
            </div>
            <br>
            <div>
              <b>Detalles: </b> ${data.data.detalles}
            <span><b>Cliente:</b> <l class="change-user">${data.data.cliente?data.data.cliente:"Consumidor Final"}</l> - Telefono: ${data.data.phone_cliente}</span><br>
            <span><b>Atendido por: </b> ${data.data.atendido}</span><br>
            <span class="price-data"><b>Total:</b> ${formatNumber(data.data.cotizar.total_pago)}</span><br>
            <span class="price-data"><b>Recibido / Abonado: </b> $ ${formatNumber(data.data.abono)}</span>
            <br>
            <span class="price-data"><b>Saldo Faltante:</b> $ ${formatNumber(data.data.saldo)}</span>
            <h5 class="ft-background">${data.data.cancelado=="false"?"PENDIENTE":"CANCELADO"}</h5>
            <br>
            <p class="text-center">${configs.footer}</p>
          </div>
        </div>
    `;

    document.querySelector('body').innerHTML = `
      <div class="CONTAINER-1">${facturaImprimir}</div>
    `;

    window.print()
    location.reload();
  })
}

function setPayPedido(e, id) {
  let token = sessionStorage.getItem('acape-session');

  socket.emit('setPayPedido', {
    pedido: id,
    pago: removeCommaSeparators(e[0].value),
    token: token
  });

  socket.once('setPayPedido', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });


    Toast.fire({
      text: data.message,
      icon: "success"
    })

    popup.start();
    updatePedidos();
    registCaja(data.data, Number(data.pago))
  })

  return false;
}

function deletePedido(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('deletePedido', {
    pedido: id,
    token: token
  });

  socket.once('deletePedido', (data) => {
    Toast.fire({
      text: data.message,
      icon: data.data ? "success" : "error"
    })

    if (data.data) {
      updatePedidos();
      popup.start();
      registCajaMinus(data.data, data.data.abono)
    }
  })
}

function finalizarPedido(id) {
  let token = sessionStorage.getItem('acape-session');

  socket.emit('finalizarPedido', {
    pedido: id,
    token: token
  });

  socket.once('finalizarPedido', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    Toast.fire({
      text: data.message,
      icon: "success"
    })

    popup.start();
    updatePedidos();
  })
}

function adminPedido(id) {
  socket.emit('pedido', { id: id });
  socket.once('pedido', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    let productsList = converterArray(data.data.cotizar.products);

    let fulldata = data.data;
    let configs = localStorage.getItem('configs') ? JSON.parse(localStorage.getItem('configs')) : {};
    popup.open({
      title: `Pedido ${id}`,
      content: `
        <div class="all-content-pedido">
          <p>${fulldata.cancelado=="true"?"Pedido Cancelado, una vez entregado puedes finalizarlo":"Este pedido no esta cancelado por completo, asi que no podras finalizarlo."}</p>
          <span><b>Salto Total: </b> ${formatNumber(fulldata.cotizar.total_pago)}</span><br>
          <span><b>Recibido / Abonado: </b> ${formatNumber(fulldata.abono)}</span><br><br>
          <span><b>Saldo Pendiente: </b> ${formatNumber(fulldata.saldo)}</span><br>

          <form onsubmit="return setPayPedido(this, '${id}')">
            <label htmlFor="">Cantidad de Abono</label>
            <input type="text" class="form-control numberify-input-commas" placeholder="Ejem: 40000">
            <br>
            <button class="btn btn-outline-primary"><i class="fa-solid fa-money-bill"></i> Agregar Pago</button>
          </form>
          <br>
          <button class="btn btn-outline-success" onclick="finalizarPedido('${id}')" ${fulldata.cancelado=="true"?"":"disabled"}><i class="fa-solid fa-receipt"></i> Finalizar Pedido</button>
          <button class="btn btn-outline-danger" onclick="deletePedido('${id}')"><i class="fa-solid fa-trash"></i> Eliminar Pedido</button>
        </div>
      `
    })
  })
}

function sendConfirmPedido(e, id) {
  socket.emit('confirmPedido', {
    id: id,
    abono: e[0].value,
    token: sessionStorage.getItem('acape-session')
  });
  socket.once('confirmPedido', (data) => {
    Toast.fire({
      text: data.message,
      icon: data.data ? "success" : "error"
    })

    if (data.data) {
      sessionStorage.removeItem('actually-list-products');
      popup.start();
      updatePedidos();
      listingProducts();
      registCaja(data.data, data.data.abono)
    }
  })

  return false;
}

function confirmarPedido(id) {
  socket.emit('notconfirmed', { id: id });
  socket.once('notconfirmed', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    let productsList = converterArray(data.data.products?data.data.products:{});
    let total_pago = 0;

    productsList.map(ch => total_pago = total_pago + (ch.price * ch.cantidad));

    let fulldata = data.data;
    let configs = localStorage.getItem('configs') ? JSON.parse(localStorage.getItem('configs')) : {};
    popup.open({
      title: `Pedido sin confirmar - ${id}`,
      content: `
        <div class="all-content-pedido">
          ${productsList.map(ch => `<p>${ch.name} - ${formatNumber(ch.price)} x ${ch.cantidad} = ${formatNumber(ch.price*ch.cantidad)}</p>`).join('')}
          <span><b>Total A Pagar: </b> ${formatNumber(total_pago)}</span><br>

          <form onsubmit="return sendConfirmPedido(this, ${id})">
            <label htmlFor="">Cantidad de Abono</label>
            <input type="number" required value="0" class="form-control" placeholder="Ejem: 40000">
            <input type="hidden" value="${id}">
            <br>
            <button class="btn btn-outline-primary"><i class="fa-solid fa-money-bill"></i> Confirmar Pedido</button>
          </form>
        </div>
      `
    })
  })
}

function updatePedidos() {
  socket.emit('getPedidos');
  socket.once('getPedidos', (data) => {
    let pedidos = document.querySelector('.container-pedidos');

    if(!pedidos) return;
    let arreglo_pedidos = converterArray(data.pedidos).reverse();

    pedidos.innerHTML = arreglo_pedidos.map(ch => `
      <div class="card">
        <div class="card-header">${ch.cliente} - ${ch.cancelado=="true"?"<span class='increase'>Cancelado</span>":"<span class='decrease'>Debe</span>"}</div>
        <div class="card-body">
          <span class="detalles" style="white-space: pre-wrap;">${ch.detalles}</span>
          <span>Fecha de entrega: ${ch.hora} - ${ch.entrega}</span>
          <br><br>
          <button class="btn btn-outline-primary" onclick="adminPedido('${ch.id}')"><i class="fa-solid fa-cash-register"></i> Administrar</button>
          <button class="btn btn-outline-info" onclick="imprimirPedido('${ch.id}')"><i class="fa-solid fa-print"></i> Imprimir</button>
        </div>
      </div>
    `).join('<br>');


    document.querySelector('.container-notconfirmed').innerHTML = converterArray(data.notconfirmed).map(ch => `
    <div class="card">
      <div class="card-header">${ch.cliente} - SIN CONFIRMAR</div>
      <div class="card-body">
        <span class="detalles" style="white-space: pre-wrap;">${ch.detalles}</span>
        <span>Fecha de entrega: ${ch.hora} - ${ch.entrega}</span>
        <br><br>
        <button class="btn btn-outline-primary" onclick="confirmarPedido('${ch.id}')"><i class="fa-solid fa-cash-register"></i> Confirmar</button>
      </div>
    </div>
    `)
  });
}

function selectChange(e) {
  let data = e.value;
  if (data == select) return;
}

function sendCreatePedido(e, productsSetter) {
  let productList = sessionStorage.getItem('actually-list-products') ? JSON.parse(sessionStorage.getItem('actually-list-products')) : [];
  let data = {
    products: productList ? productList : productsSetter,
    cliente: e[0].value,
    phone_cliente: e[1].value,
    entrega: e[2].value,
    hora: e[3].value,
    detalles: e[4].value,
    abono: removeCommaSeparators(e[5].value),
    clienteId: document.querySelector('#clienteId') ? document.querySelector('#clienteId').value : null,
    mayor: e[6].value == "true" ? "true" : null
  }
  let token = sessionStorage.getItem('acape-session');

  socket.emit('createPedido', {
    pedido: data,
    token: token
  })

  socket.once('createPedido', (data) => {
    Toast.fire({
      icon: data.data ? "success" : "error",
      text: data.message
    })


    if (data.data) {
      sessionStorage.removeItem('actually-list-products');
      popup.start();
      updatePedidos();
      listingProducts();
      registCaja(data.data, data.data.abono)
    }
  })

  return false;
}

function openCreatePedido(mayor) {
  let products = sessionStorage.getItem('products');
  let superArray = converterArray(products ? JSON.parse(products) : {});
  let actuallyProductsList = sessionStorage.getItem('actually-list-products');
  let finalProductList = actuallyProductsList ? JSON.parse(actuallyProductsList) : [];

  let finalPrice = 0;

  let finalProducts = finalProductList.map(ch => {
    if (mayor) {
      finalPrice = Number(finalPrice) + Number(ch.cantidad ? ((ch.price_mayor ? ch.price_mayor : ch.price) * ch.cantidad) : (ch.price_mayor ? ch.price_mayor : ch.price));

      return `<hr> <div class="product bt-1">ID: ${ch.id} | ${ch.name} | Cantidad: ${ch.cantidad?ch.cantidad:1} | Precio Unitario: ${formatNumber(ch.price_mayor?ch.price_mayor:ch.price + ' (Este producto no tiene precio por mayor)')} | Precio Final: ${formatNumber(Number(ch.cantidad?((ch.price_mayor?ch.price_mayor:ch.price) * ch.cantidad):(ch.price_mayor?ch.price_mayor:ch.price)))}</div>`;
    } else {
      finalPrice = Number(finalPrice) + Number(ch.cantidad ? (ch.price * ch.cantidad) : ch.price);

      return `<hr> <div class="product bt-1">ID: ${ch.id} | ${ch.name} | Cantidad: ${ch.cantidad?ch.cantidad:1} | Precio Unitario: ${formatNumber(ch.price)} | Precio Final: ${formatNumber(ch.cantidad?(ch.price * ch.cantidad):ch.price)}</div>`;
    }
  }).join('')

  getClientesVenta((clientesPedido) => {
  popup.open({
    title: "Crear Pedido",
    content: `
      <form class="super-form-create-pedido" onsubmit="return sendCreatePedido(this)">
        <div class="buscador-cliente">
          <label>Cliente (buscar por nombre o número de identidad)</label>
          <input type="text" id="buscarCliente" class="form-control" required autocomplete="off" placeholder="Buscar por nombre o número de identidad">
          <div id="resultadosCliente" class="buscador-cliente-resultados" hidden></div>
          <button type="button" id="quitarCliente" class="btn btn-light btn-sm mt-1" hidden><i class="fa-solid fa-xmark"></i> Quitar cliente</button>
        </div>
        <label htmlFor="">Numero de telefono del cliente</label>
        <input type="text" placeholder="Numero de telefono" class="form-control" required>
        <label>Dia de entrega</label>
        <input type="date" required class="form-control">
        <label>Hora de entrega</label>
        <input type="time" required placeholder="hora de entrega" class="form-control">
        <label htmlFor="">Detalles del pedido</label>
        <textarea class="form-control" required name="" id="" placeholder="Agrega aqui todos los detalles que necesites para espesificarle al cliente y/o encargado de los pedidos"></textarea>
        <br>
        <hr>
        <div class="container-1">
          ${finalProducts}
        </div>
        <br>
        <div class="total-pagar"><b>Total:</b> ${formatNumber(finalPrice)}</div>
        <label>Abono</label>
        <input class="form-control numberify-input-commas" placeholder="$ 10,000" type="text">
        <input type="hidden" value="${mayor?'true':"false"}">
        <input type="hidden" id="clienteId" value="">
        <br><br>
        <button class="btn btn-outline-primary">Generar Pedido</button>
        <a class="btn btn-outline-info" onclick="${mayor?"openCreatePedido()":"openCreatePedido(true)"}">Cambiar A ${mayor?"Normal":"Por Mayor"}</a>
      </form>
    `
    });
    activarBuscadorCliente(clientesPedido, {
      onSelect: (cliente) => {
        let formularioPedido = document.querySelector('.super-form-create-pedido');
        if (formularioPedido) {
          let telefono = formularioPedido.elements[1];
          if (telefono) telefono.value = cliente ? cliente.phone : '';
        }
      }
    });
  })
}

router.get('/pedidos', () => {
  updatePedidos();
  sessionValidator();

  return `
    <br>
    <div class="container-fluid">
      <h1 class="text-center">Pedidos</h1>
      <p class="text-center">Todos los pedidos de tu negocio aqui.</p>
      <div class="text-center">
        <button class="btn btn-outline-primary" onclick="openCreatePedido()"><i class="fa-solid fa-sort"></i> Crear Pedido</button>
      </div>
    </div>
    <br>
    <hr>
    <div class="container-pedidos container-fluid"></div>
    <hr>
    <h1 class="text-center">Pedidos Sin Confirmar</h1>
    <div class="container-fluid container-notconfirmed"></div>
    <hr>
  `;
})

router.get('/facturero', () => {
  sessionValidator()

  return `<div class="container-fluid">
    <br>
    <h1 class="text-center">Facturero</h1>
    <p class="text-center">Crea tus facturas de ingresos, egresos y ventas</p>
    <div class="text-center">
      <button class="btn btn-outline-primary" onclick="facturaVenta()">Crear Factura De Venta</button>
      <button class="btn btn-outline-info" onclick="facturaIngreso()">Crear Factura De Ingreso</button>
      <button class="btn btn-outline-success" onclick="facturaEgreso()">Crear Factura De egreso</button>
    </div>

    <div class="facturero-container"></div>
  </div>`;
})

function saveConfigsBasic(e) {
  let data = {
    name: e[0].value,
    slogan: e[1].value,
    footer: e[2].value,
    user: {
      name: e[3].value,
      document: e[4].value,
      phone: e[5].value,
      email: e[6].value,
      direct: e[7].value
    }
  }

  localStorage.setItem('configs', JSON.stringify(data));

  Toast.fire({
    title: "Configuraciones",
    text: "Nueva configuración guardad exitosamente",
    icon: "success"
  })
  return false;
}

function sendEditUser(e, id, ident) {
  let data = {
    user: e[0].value,
    password: e[1].value,
    role: e[2].value,
    token: id,
    id: ident
  }
  let token = sessionStorage.getItem('acape-session');
  socket.emit('editUser', { user: data, token: token });

  return false;
}

function sendDeleteUser(token) {
  let session = sessionStorage.getItem('acape-session');
  alert.fire({
    title: "Eliminar usuario",
    text: "¿Estas seguro de eliminar a este usuario?",
    confirmButtonText: "SI",
    showCancelButton: true,
    cancelButtonText: "NO"
  }).then((result) => {
    if (result.isConfirmed) {
      socket.emit('deleteUser', { user: token, token: session });
    }
  })
}

function editUser(id) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('getUser', { token: token, id: id })
  socket.once('getUser', (data) => {
    if (!data.data) return Toast.fire({
      message: data.data.message,
      icon: "error"
    });

    let roles = Object.keys(data.roles);

    let usuario = data.data;

    popup.open({
      title: "Configurando usuario",
      content: `
        <form onsubmit="return sendEditUser(this, '${usuario.token}', '${usuario.id}')">
          <label>Nombre de usuario</label>
          <input type="text" class="form-control" placeholder="Nombre de usuario" value="${usuario.user}">
          <label>Contraseña</label>
          <input type="text" class="form-control" placeholder="Contraseña" value="${usuario.password}">
          <label>Rol</label>
          <select class="form-select">
            <option value="${usuario.role}">${usuario.role} (Actual del usuario)</option>
            ${roles.map(ch => `<option value="${ch}">${ch}</option>`)}
          </select>
          <br>
          <div class="edit-buttons">
            <button class="btn w-50 btn-outline-primary">Guardar Cambios</button>
            <a class="btn w-50 btn-outline-danger" onclick="sendDeleteUser('${usuario.token}')">Eliminar Usuario</a>
          </div>
        </form>
      `
    })
  })
}

function sendCreateUser(e) {
  let data = {
    user: e[0].value,
    password: e[1].value,
    role: e[2].value
  }

  let token = sessionStorage.getItem('acape-session');

  socket.emit('createUser', { user: data, token: token });

  return false;
}

function createUser() {
  let token = sessionStorage.getItem('acape-session');

  socket.emit('configServ', { token: token })
  socket.once('configServ', (data) => {
    if (!data.data) return Toast.fire({
      text: "Error de permisos",
      icon: "error"
    });

    let roles = Object.keys(data.data.roles);

    popup.open({
      title: "Crear un nuevo usuario",
      content: `
        <form onsubmit="return sendCreateUser(this)">
          <label>Nombre de usuario</label>
          <input type="text" class="form-control" placeholder="Ejem: usuario cajero"
          <label>Contraseña</label>
          <input type="text" class="form-control" placeholder="Ejem: pass123">
          <label>Rol del usuario</label>
          <select class="form-select">
            <option value="non-role">Elige un rol</option>
            ${roles.map(ch => `<option value="${ch}">${ch}</option>`)}
          </select>
          <br>
          <button class="btn btn-outline-primary d-block w-100"><i class="fa-solid fa-plus"></i> Crear nuevo usuario</button>
        </form>
      `
    })
  })
}

function editandoRol(e, name) {
  let token = sessionStorage.getItem('acape-session');
  let data = {
    all: e[0].checked == true ? "true" : null,
    productManager: e[1].checked == true ? "true" : null,
    userManager: e[2].checked == true ? "true" : null,
    roleManager: e[3].checked == true ? "true" : null,
    clientManager: e[4].checked == true ? "true" : null,
    facturar: e[5].checked == true ? "true" : null,
    view: e[6].checked == true ? "true" : null
  }
  socket.emit('editRole', { role: { name: name, perms: data }, token: token });
}

function deleteRole(name) {
  let token = sessionStorage.getItem('acape-session');

  socket.emit('deleteRole', { role: name, token: token });
}

socket.on('role-manager', (data) => {
  Toast.fire({
    text: data.message,
    icon: data.data ? "success" : "error"
  });

  if (data.data) {
    popup.start()
    updateConfigs();
  };
})

function editarRol(name) {
  if (name == "owner") return Toast.fire({
    text: "El rol owner no se puede modificar.",
    icon: "error"
  });
  socket.emit('editarRol', { token: sessionStorage.getItem('acape-session'), name: name });
  socket.once('editarRol', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    let received = data.data;
    let roles = received.roles;

    let finding_role = received;
    if (!finding_role) return Toast.fire({
      text: "Este rol no existe.",
      icon: "error"
    });

    let keys_perms = finding_role;
    let all_permissions = [{
        input: "Administración",
        perm: "all"
      },
      {
        input: "Manejar y editar productos",
        perm: "productManager"
      },
      {
        input: "Modificar y eliminar usuarios",
        perm: "userManager"
      },
      {
        input: "Modificar y eliminar roles",
        perm: "roleManager"
      },
      {
        input: "Manejar clientes",
        perm: "clientManager"
      },
      {
        input: "Poder facturar",
        perm: "facturar"
      }, {
        input: "Mirar facturas, ventas y otros datos de la aplicación",
        perm: "view"
      }
    ]

    popup.open({
      title: `Editando rol ${name}`,
      content: `
        <form onsubmit="return editandoRol(this, '${name}')">
          <div class="listing">
            ${all_permissions.map(ch => `
              <input type="checkbox" ${!finding_role[ch.perm]==true?"non":"checked"}>
              <label htmlFor="">${ch.input}</label>
              <br>
            `).join('')}
          </div>
          <div class="separated-div">
            <button class="btn btn-outline-primary w-50"><i class="fa-solid fa-parachute-box"></i> Guardar Cambio</button>
            <a class="btn btn-outline-danger w-50" onclick="deleteRole('${name}')"><i class="fa-solid fa-trash"></i> Eliminar</a>
          </div>
        </form>
      `
    })
  })
}

function sendingNewRole(e) {
  let token = sessionStorage.getItem('acape-session');
  socket.emit('createRole', { role: { name: e[0].value }, token: token });
}

function createNewRole() {
  popup.open({
    title: "Crea un nuevo rol",
    content: `
      <form onsubmit="return sendingNewRole(this)">
        <label htmlFor="">Nombre del rol</label>
        <input required class="form-control" type="text" placeholder="Ejem: Admin">
        <br>
        <button class="btn btn-outline-primary d-block w-100"><i class="fa-solid fa-gear"></i> Guardar Nuevo Rol</button>
      </form>
    `
  })
}

function updateConfigs() {
  let configs = !localStorage.getItem('configs') ? { user: {} } : JSON.parse(localStorage.getItem('configs'));
  let token = sessionStorage.getItem('acape-session');

  socket.emit('configServ', { token: token });
  socket.once('configServ', (received) => {
    if (!received.data) return alert.fire({
      title: "Error",
      text: "No tienes permisos suficientes para acceder a estas funciones.",
      icon: "error",
      footer: "Para acceder a las funciones de configuraciones necesitas tener todos los permisos activos"
    });

    let data = received.data;
    let usuarios = data.users;
    let roles = data.roles;

    let usuarios_array = converterArray(usuarios);
    let roles_array = Object.keys(data.roles);

    let final_roles = roles_array.map(ch => `
      <div class="card">
        <div class="card-body">
          <div class="separated-div">
            <div><b>Nombre: </b> ${ch}</div>
            <div class="btns">
              <button class="btn btn-outline-primary" onclick="editarRol('${ch}')">
                <i class="fa-solid fa-pen"></i> Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('')

    let final_usuarios = usuarios_array.map(ch => `
      <div class="card">
        <div class="card-body">
          <div><b>ID: </b> ${ch.id} | <b>Nombre de usuario:</b> ${ch.user} | <b>Rol: </b> ${ch.role}</div>
        </div>
        <div class="card-footer">
          <button class="btn btn-outline-primary" onclick="editUser('${ch.id}')"><i class="fa-solid fa-pen"></i> Configurar usuario</button>
        </div>
      </div>
    `).join('')

    document.querySelector('.app').innerHTML = `
      <div class="container-fluid my-2">
        <h1 class="text-center">Centro de configuraciones</h1>
        <p class="text-center">En este centro de configuraciones puedes configurar toda la aplicación</p>
        <hr>
        <p>Empecemos por lo basico, darle una marca y nombre a tu negocio/empresa</p>
        <form onsubmit="return saveConfigsBasic(this)">
          <label>Nombre de la empresa</label>
          <p>Este nombre aparecera en las facturas desprendibles</p>
          <input class="form-control" type="text" value="${configs.name?configs.name:''}" placeholder="Ejem: SIOPS Solutions">
          <br>
          <label>Eslogan</label>
          <p>El texto que aparece debajo del titulo en los desprendibles</p>
          <input type="text" class="form-control" value="${configs.slogan?configs.slogan:''}" placeholder="Ejem: Para servirte :)">
          <label htmlFor="">Pie de pagina</label>
          <p>El texto que aparece al final de cada factura</p>
          <input type="text" class="form-control" placeholder="Gracias por la compra">
          <hr>
          <h5>Información del dueño / vendedor</h5>
          <label htmlFor="">Nombre del vendedor</label>
          <input type="text" value="${configs.user.name?configs.user.name:""}" class="form-control" placeholder="Ejem: Jhon Doe Arnuld">
          <label>Documento o NIT valido</label>
          <input type="text" class="form-control" placeholder="Ejem: 1112929019" value="${configs.user.document?configs.user.document:""}">
          <label htmlFor="">Numero de telefono</label>
          <input type="number" value="${configs.user.phone?configs.user.phone:""}" class="form-control" placeholder="Ejem: 3112232020">
          <label htmlFor="">Correo Electronico</label>
          <input type="text" class="form-control" value="${configs.user.email?configs.user.email:""}" placeholder="email@example.com">
          <label htmlFor="">Dirección del establecimiento</label>
          <input type="text" class="form-control" value="${configs.user.direct?configs.user.direct:""}" placeholder="Ejem: Calle 12 #9-23 Fortul - Arauca">
          <br>
          <button class="btn btn-outline-primary">Guardar Marca</button>
        </form>
        <hr>
        <h3>Usuarios</h3>
        <p>Crea usuarios para darle a tus empleados acceso a la aplicación, recuerdas darles un rol para que el usuario no pueda acceder a ciertas funciones de administración</p>
        <button class="btn btn-outline-primary d-block w-100" onclick="createUser()"><i class="fa-solid fa-user"></i> Crear un nuevo usuario</button>
        <br>
        <p>Los usuarios creados actualmente son: ${usuarios_array.length}</p>
        <div class="users-container">${final_usuarios}</div>
        <hr>
        <h3>Roles</h3>
        <p>Los roles sirven para que tus otros usuarios tengan permisos espesificos y pueda acceder a las funciones de forma limitada.</p>
        <button class="btn btn-outline-primary btn-block w-100 d-block" onclick="createNewRole()"><i class="fa-solid fa-address-book"></i> Crear nuevo rol</button>
        <hr>
        <h3>Correo de aviso (acceso remoto)</h3>
        <p>Configura un Gmail para recibir en tu correo el enlace de acceso remoto cada vez que enciendas el servidor. Usa una <b>contraseña de aplicación</b> de Gmail (16 caracteres) — se crea 1 sola vez en tu cuenta de Google.</p>
        <form id="formGmail" class="form-gmail" onsubmit="return connectGmailForm(this, false)">
          <label>Correo de Gmail (emisor)</label>
          <input id="mailInputUser" type="text" class="form-control" placeholder="tucorreo@gmail.com">
          <label>Contraseña de aplicación</label>
          <input id="mailInputPass" type="password" class="form-control" placeholder="Los 16 caracteres que te dio Gmail">
          <label>Correo que recibe el aviso</label>
          <input id="mailInputTo" type="text" class="form-control" placeholder="tucorreo@gmail.com">
          <br>
          <button class="btn btn-outline-primary d-block w-100">Guardar correo</button>
          <button class="btn btn-outline-success d-block w-100 mt-1" type="button" onclick="connectGmailForm(document.getElementById('formGmail'), true)">Guardar y enviar correo de prueba</button>
        </form>
      </div>
      <div class="roles-container">${final_roles}</div>
    `;
    loadGmailConfig();
  })
}

function connectGmailForm(form, test) {
  let token = sessionStorage.getItem('acape-session');
  let mail = {
    user: document.getElementById('mailInputUser').value.trim(),
    pass: document.getElementById('mailInputPass').value,
    to: document.getElementById('mailInputTo').value.trim()
  };

  if (!mail.user || !mail.pass || !mail.to) {
    return alert.fire({
      title: "Faltan datos",
      text: "Llena los 3 campos del correo.",
      icon: "warning"
    });
  }

  let url = test ? '/config/mail/test' : '/config/mail';
  axios.post(url, { token: token, mail: mail }).then((res) => {
    let r = res.data || {};
    let ok = !/no se pudo|error/i.test(r.message || '');
    Toast.fire({
      title: "Correo",
      text: r.message || "Configuración guardada",
      icon: ok ? "success" : "error"
    });
  }).catch(() => {
    Toast.fire({
      title: "Correo",
      text: "No se pudo conectar el correo. Revisa la contraseña de aplicación.",
      icon: "error"
    });
  });
  return false;
}

function loadGmailConfig() {
  axios.get('/config/mail').then((res) => {
    let d = res.data || {};
    if (document.getElementById('mailInputUser')) document.getElementById('mailInputUser').value = d.user || '';
    if (document.getElementById('mailInputTo')) document.getElementById('mailInputTo').value = d.to || '';
  }).catch(() => {});
}

router.get('/config', () => {
  sessionValidator()
  updateConfigs()

  return `Ingresando...`;
})

function cerrarSesion() {
  sessionStorage.removeItem('acape-session');
  location.hash = "#/";
  location.reload()
  sessionValidator();
}

function validTokenPopup(title) {
  popup.open({
    title: title ? title : "Primer Inicio",
    content: `
      <form onsubmit="return sendValidationToken(this)">
        <p>Es el primer inicio de la aplicación, ingresa el token de la app para poder iniciar.</p>
        <label htmlFor="">Token de la aplicación: </label>
        <input type="text" class="form-control" placeholder="xxxx-xxxx-xxxx-xxxx">
        <br>
        <button class="btn btn-outline-primary d-block w-100 validate-button">Validar</button>
      </form>
    `,
    close: title ? true : false
  })
}

function updateUser() {
  let simple_data = localStorage.getItem('acape-data-principal') ? JSON.parse(localStorage.getItem('acape-data-principal')) : {}
  socket.emit('get_token_valid', simple_data.token);
  socket.once('get_token_valid', (data) => {
    if (!data.data) return document.querySelector('.valid-token').innerHTML = '<h5>La validación del token es nula</h5>';

    let sirving = data.data;
    let tiempo_restante = getTimeRest(new Date(sirving.timeRest) - 0);
    document.querySelector('.valid-token').innerHTML = `
      <br><hr>
      <h5>Token y suscripción de la aplicación</h5>
      <p>Puedes obtener un token de prueba en nuestro sitio web de SIOPS.</p>
      <p>A tu suscripción todavia le quedan: ${tiempo_restante}</p>
      <button class="btn btn-outline-primary" onclick="validTokenPopup('Validar otro token')"><i class="fa-solid fa-scroll"></i> Validar Otro Token</button>
    `;
  })

  return `
    <div class="container-fluid my-2">
      <h1>Usuario</h1>
      <p>Las configuraciones de usuario se encuentran justo aqui.</p>
      <hr>
      <p>Si quieres modificar algún parametro de tu cuenta esto lo puedes hacer en el apartado de administración, aqui solamente puedes cerrar sesión, o validar tu token como usuario de SIOPS.</p>
      <hr>
      <button class="btn btn-danger" onclick="cerrarSesion()"><i class="fa-solid fa-door-open"></i> Cerrar Sesion</button>
      <hr>
      <div class="valid-token"></div>
    </div>
  `;
}

router.get('/user', () => {
  sessionValidator();
  return updateUser();
})

// Función para sumar objetos consecutivos por tipo y manejar los no consecutivos
function sumarConsecutivos(arreglo) {
  if (arreglo.length === 0) {
    return [];
  }

  let resultado = [];
  let tipoActual = arreglo[0].type;
  let sumaActual = arreglo[0].cantidad;

  for (let i = 1; i < arreglo.length; i++) {
    if (arreglo[i].type === tipoActual) {
      sumaActual += arreglo[i].cantidad;
    } else {
      resultado.push({ type: tipoActual, cantidad: sumaActual });
      tipoActual = arreglo[i].type;
      sumaActual = arreglo[i].cantidad;
    }
  }

  // Agregar el último tipo acumulado
  resultado.push({ type: tipoActual, cantidad: sumaActual });

  return resultado;
}

function gendingPDF() {
  return generarPDF('metricas', document.querySelector('.metricas'));
}

// window.onload = () => {
//   let dataApp = localStorage.getItem('acape-data-principal');
//   if(!dataApp) {
//     validTokenPopup()
//   }else {
//     socket.emit('token_validation', JSON.parse(dataApp));
//     alert.fire({
//       title: "Validando Suscripción",
//       text: "Estamos validando la suscripción espera un momento",
//       showConfirmButton: false,
//       allowOutsideClick: false,
//       allowEscapeKey: true,
//       allowEnterKey: true
//     })
//   }
// }


function sendCreateEntrada(e, mayor, finalPrice) {
  let actuallyList = JSON.parse(sessionStorage.getItem('entrada-almacen'));
  let token = sessionStorage.getItem('acape-session');
  let data = {
    entrada: actuallyList,
    total_recibido: e[0].value,
    token: token,
    mayor: mayor
  };

  setTimeout(() => { socket.emit('createEntrada', data) }, 1000);

  socket.once('createEntrada', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    popup.open({
      title: "Entrada Hecha",
      content: `Total a pagar: ${formatNumber(finalPrice)} <br><br> <button class="btn btn-outline-info" onclick="popup.close()">Aceptar</button>`
    });

    sessionStorage.removeItem('entrada-almacen');
    listingEntrada();
  })

  return false;
}


function deleteDeudor(id) {
  let token = sessionStorage.getItem('acape-session');

  socket.emit('removeDeudor', { id: id, token: token });
  socket.once('removeDeudor', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    listingDeudores();

    Toast.fire({
      title: "Deudor eliminado satisfactoriamente",
      text: "Recuerda que el eliminarlo no tendra efecto en caja.",
      icon: "success"
    })
    popup.start();
  })
}

function makePrestamo(id) {
  let token = sessionStorage.getItem('acape-session');
  let valor = document.querySelector('.data-input-deudor-movements').value;
  let desc = document.querySelector('.data-textarea-deudor-desc').value;

  socket.emit('addDeuda', {
    id: id,
    token: token,
    deuda: {
      monto: removeCommaSeparators(valor),
      desc: desc
    }
  });

  socket.once('addDeuda', (data) => {
    if (!data.data) return Toast.fire({
      icon: "error",
      text: data.message
    });


    Toast.fire({
      title: "Prestamo Hecho Satisfactoriamente",
      text: "El prestamo se vera reflejado en caja",
      icon: "success"
    });

    popup.start();
    listingDeudores();

    createEgreso({
      money: data.movement.monto,
      description: `Prestamo > ${data.data.name}: ${data.movement.desc}`,
      date: new Date()
    }, data.movement.monto)
  })
}

function makePago(id) {
  let token = sessionStorage.getItem('acape-session');
  let valor = document.querySelector('.data-input-deudor-movements').value;
  let desc = document.querySelector('.data-textarea-deudor-desc').value;

  socket.emit('removeDeuda', {
    id: id,
    token: token,
    deuda: {
      monto: removeCommaSeparators(valor),
      desc: desc
    }
  });

  socket.once('removeDeuda', (data) => {
    if (!data.data) return Toast.fire({
      icon: "error",
      text: data.message
    });


    Toast.fire({
      title: "Pago Hecho Satisfactoriamente",
      text: "El Pago se vera reflejado en caja",
      icon: "success"
    });

    popup.start();
    listingDeudores();
    createIngreso({
      money: data.movement.monto,
      description: `Prestamo > ${data.movement.desc}`,
      date: new Date()
    }, data.movement.monto)
  })
}

function editDeudor(id) {
  socket.emit('getDeudores', { token: sessionStorage.getItem('acape-session') });
  socket.once('getDeudores', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    let deudor = data.data[id];

    if (!deudor) return Toast.fire({
      text: "No se encontro este deudor, actualiza la pagina.",
      icon: "error"
    });
    popup.open({
      title: "Editando Deudor",
      content: `
        <p>${id} - ${deudor.name}</p>
        <label>Dinero de movimiento</label>
        <input type="text" class="form-control numberify-input-commas data-input-deudor-movements" placeholder="0">
        <label htmlFor="">Descripción</label>
        <textarea name="" id="" class="form-control data-textarea-deudor-desc" placeholder="Ejem: Prestamo para compras"></textarea>
        <br>
        <button class="btn btn-outline-danger" onclick="makePrestamo('${id}')"><i class="fa-solid fa-money-bill"></i> Prestamo</button>
        <button class="btn btn-outline-primary" onclick="makePago('${id}')"><i class="fa-solid fa-receipt"></i> Pago de deuda</button>
        <hr>
        <button class="btn btn-danger w-100 d-block" onclick="deleteDeudor('${deudor.id}')"><i class="fa-solid fa-trash"></i> Eliminar Deudor</button>
      `
    })
  })
}

function listingDeudores() {
  socket.emit('getDeudores', { token: sessionStorage.getItem('acape-session') });

  let final_html = "";

  socket.once('getDeudores', (data) => {
    if (!data.data) return Toast.fire({
      text: "Ocurrio un error en la solicitud de datos.",
      icon: "error"
    });

    let all_deudores = converterArray(data.data);
    let finalDeuda = 0;

    document.querySelector('.tbody-deudores').innerHTML = all_deudores.map(ch => {
      finalDeuda = finalDeuda + Number(ch.deuda)

      return `<tr>
      <td>${ch.id}</td>
      <td>${ch.name}</td>
      <td>${formatNumber(ch.deuda)}</td>
      <td class="text-center cursor-pointer" onclick="editDeudor('${ch.id}')"><i class="fa-solid fa-pen"></i></td>
    </tr>`
    }).join('');

    document.querySelector('.edit-total-deudores').innerHTML = formatNumber(finalDeuda)
  })
}

function sendNewDeudor(e) {
  let final_data = {
    deudor: {
      name: e[0].value,
      deuda: e[1].value
    },
    token: sessionStorage.getItem('acape-session')
  }

  socket.emit('createDeudor', final_data);
  socket.once('createDeudor', (data) => {
    if (!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });


    popup.start();
    Toast.fire({
      text: "Deudor nuevo registrado",
      icon: "success"
    })
    listingDeudores();
  })

  return false;
}

function addDeudor(e) {
  popup.open({
    title: "Añadir Deudor",
    content: `
      <form onsubmit="return sendNewDeudor(this)">
        <label htmlFor="">Nombre Del Deudor</label>
        <input type="text" class="form-control" placeholder="EJem: Jhon Doe" required>
        <label htmlFor="">Deuda Inicial</label>
        <p>Deja el valor 0 si el deudor es nuevo</p>
        <input class="form-control" type="number" placeholder="0" value="0">
        <br>
        <button class="btn btn-outline-primary d-block w-100" ><i class="fa-solid fa-plus"></i>Crear Nuevo Deudor</button>
      </form>
    `
  })
}

router.get('/deudores', () => {
  sessionValidator();

  listingDeudores()

  return `
    <div class="container-fluid my-2">
      <h1 class="text-center">Deudores</h1>
      <p class="text-center">Aqui estan todos los deudores registrados</p>
      <div class="text-center">
        <button onclick="addDeudor()" class="btn text-center btn-outline-primary"><i class="fa-solid fa-user-plus"></i> Agregar Deudor</button>
      </div>
      <br>
      <div class="container-deudores">
        <table class="table-products">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Deuda</th>
              <th>Editar</th>
            </tr>
          </thead>
          <tbody class="tbody-deudores">  
          </tbody>
        </table>

        <br><br>
        <h1>Total: <div class="edit-total-deudores">0</div></h1>
      </div>
    </div>
  `;
})

function listingFacturacion(e) {
  e.preventDefault();
  let arrayFacturacion = localStorage.getItem('listing-facturas') ? JSON.parse(localStorage.getItem('listing-facturas')) : [];

  let data = {
    name: e.target[0].value,
    price: removeCommaSeparators(e.target[1].value),
    unds: removeCommaSeparators(e.target[2].value),
    cantidad: removeCommaSeparators(e.target[3].value),
    porcentaje: removeCommaSeparators(e.target[4].value)
  }

  let finalProducts = data.unds * data.cantidad;
  let precioFinalTodos = Number(data.price) + (Number(data.price) * (Number(data.porcentaje) / 100));
  let finalProductsPrice = precioFinalTodos / finalProducts;

  data.productsPrice = finalProductsPrice;

  arrayFacturacion.push(data);

  localStorage.setItem('listing-facturas', JSON.stringify(arrayFacturacion));
  updateSimplified(true);
}

function deletefacturacionthis(name) {
  let arrayFacturacion = localStorage.getItem('listing-facturas') ? JSON.parse(localStorage.getItem('listing-facturas')) : [];

  arrayFacturacion.forEach((element, i, array) => {
    if (element.name == name) {
      array.splice(i, 1);

      localStorage.setItem('listing-facturas', JSON.stringify(array));
      updateSimplified(true);
    }
  })
}

function updateSimplified(html) {
  let arrayFacturacion = localStorage.getItem('listing-facturas') ? JSON.parse(localStorage.getItem('listing-facturas')) : [];

  let finalHTMLmap = arrayFacturacion.map(ch => `
    <tr onclick="deletefacturacionthis('${ch.name}')" class="cursoring-pointer">
      <td>${ch.name}</td>
      <td>${ch.unds * ch.cantidad}</td>
      <td>${ch.porcentaje} %</td>
      <td>${formatNumber(Number(ch.price).toFixed(0))} - ${formatNumber(formatNumber(Number(ch.price) + (ch.price * (30 / 100))))}</td>
      <td>${formatNumber(ch.productsPrice)}</td>
    </tr>
  `)

  if (html) {
    let finging = document.querySelector('.edit-table-setc');
    finging.innerHTML = finalHTMLmap;
  } else {
    return finalHTMLmap;
  }
}

function nuevoInventariado() {
  popup.open({
    title: "Inventariado",
    content: `
      <div class="simplified-form-setter">
        <form action="" onsubmit="listingFacturacion(event)">
          <label htmlFor="">Nombre Del Producto</label>
          <input type="text" class="form-control" placeholder="Ejem: Bon yurt">
          <label htmlFor="">Precio En Factura</label>
          <p>Pon el precio que aparece en factura.</p>
          <input type="text" class="numberify-input-commas form-control" placeholder="Precio Completo">
          <label htmlFor="">Unidades De Productos Por Paquete</label>
          <input type="text" class="numberify-input-commas form-control" placeholder="10 UND Por paquetes">
          <label htmlFor="">Cantidad De Paquetes</label>
          <input type="text" class="numberify-input-commas form-control" placeholder="2 Paquetes">
          <label htmlFor="">Porcentaje De Ganancia</label>
          <p>Esto es para el porcentaje de ganancia a la hora de venta</p>
          <input type="text" class="numberify-input-commas form-control" placeholder="30%">
          <br>
          <button class="btn btn-primary btn-block"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
        </form>
        <br>
        <button class="btn btn-sucess btn-block" onclick="imprimirFactura()"><i class="fa-solid fa-print"></i> Imprimir</button>
      </div>
      <br><br>
      <hr>
      <br><br>
      <div class="documento-to-print factura-termica">
        <h5 class="nuevo-inventariado-title text-center">Inventariado</h5>
        <table class="table-products">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>UNDs</th>
              <th>% G</th>
              <th>P. Fact</th>
              <th>P. UND</th>
            </tr>
          </thead>
          <tbody class="edit-table-setc">
            ${updateSimplified()}
          </tbody>
        </table>
      </div>
    `
  })
}

router.get('/calculator', () => {
  sessionValidator();

  return `
    <br><br>
    <div class="container-fluid">
      <h1 class="text-center">Calculadora</h1>
      <p class="text-center">Haz las cuentas mucho mas facil con nuestra herramienta.</p>
      <div class="text-center silents-btns">
        <button class="btn btn-primary" onclick="nuevoInventariado()"><i class="fa-solid fa-barcode"></i> Inventariado</button>
        <button class="btn btn-primary"><i class="fa-solid fa-book"></i> Cuentas</button>
        <button class="btn btn-primary"><i class="fa-solid fa-folder-open"></i> Archivero</button>
      </div>
    </div>
  `;
})

// SOCKETS MANAGER

socket.on('user-manager', (data) => {
  Toast.fire({
    text: data.message,
    icon: !data.data ? "error" : "success"
  })

  if (data.data) {
    updateConfigs()
    popup.close();
  }
});

socket.on('products-manager', (data) => {
  Toast.fire({
    title: "Manager de productos",
    text: data.message,
    icon: data.data ? "success" : "error"
  })
  if (data.data) {
    popup.close();
    getProducts()
  }
})

socket.on('ventas-manager', (data) => {

  Toast.fire({
    title: "Manager de ventas",
    text: data.message,
    icon: data.data ? "success" : "error"
  });


  if (data.data) {
    sessionStorage.removeItem('actually-list-products');

    if (data.ventaEliminada) {
      let caja = localStorage.getItem('caja') ? JSON.parse(localStorage.getItem('caja')) : null;
      if (!caja) return;

      if (caja.date > data.ventaEliminada.date) return Toast.fire({
        title: "Manager de ventas",
        text: "Esta venta no fue hecha mientras estaba la caja actual activa asi que no tendra ningun efecto en las cuentas del dia.",
        icon: "success"
      });

      registCajaMinus(data.ventaEliminada, data.ventaEliminada.total_pago);
    } else {
      listingProducts();
    }
  }
})

socket.on('clientes-manager', (data) => {
  Toast.fire({
    title: "Clientes",
    text: data.message,
    icon: data.data ? "success" : "error"
  })

  if (data.data) {
    sessionStorage.removeItem('clients-lite');
    popup.close()
    reloadClientes();
  };
})

socket.on('ventaEdit', (data) => {
  if (!data.ventaEliminada) return;

  let caja = localStorage.getItem('caja') ? JSON.parse(localStorage.getItem('caja')) : null;
  if (!caja) return;

  if (caja.date > data.ventaEliminada.date) return Toast.fire({
    title: "Manager de ventas",
    text: "Esta venta no fue hecha mientras estaba la caja actual activa asi que no tendra ningun efecto en las cuentas del dia.",
    icon: "info"
  });

  registCajaMinus(data.ventaEliminada, data.ventaEliminada.total_pago);
})

router.start();

router.listen();

socket.setMultipleListener(['createProduct', 'editProduct', 'deleteProduct', 'products/ingreso'], 'products-manager');
socket.setMultipleListener(['createRole', 'editRole', 'deleteRole'], 'role-manager');
socket.setMultipleListener(['createVenta', 'editVenta', 'deleteVenta'], 'ventas-manager');
socket.setMultipleListener(['createClient', 'editClient', 'deleteClient'], 'clientes-manager');
socket.setMultipleListener(['createUser', 'editUser', 'deleteUser'], 'user-manager');
socket.setMultipleListener(['registrarCaja'], 'caja-manager');


// document.addEventListener('keydown', (event) => {
//   if(event.keyCode == 17){
//     facturacion();
//     let focusing = document.querySelector('.focusing');
//     if(focusing){
//       focusing.focus();
//     }
//   }
// })
