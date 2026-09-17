// API DE AXIOS
const acape = axios.create({
  baseURL: "/",
  headers: {
    "ngrok-skip-browser-warning": "true"
  },
  timeout: 600000
});

// CONSTRUCTOR DE LA PAGINA WEB
const router = new Router('ACAPE Administrativo', {
  nameweb: "ACAPE Administrativo",
  app: ".app",
  error_404: "<h1>Error, Pagina deshabilitada</h1>"
});

// REPLACE THIS: REEMPLAZAR ESTO EN LA PARTE DE CODIGO DE DESCARGA
// let movements = converterArray(server_data.accounting.movements).slice(-3).reverse();

// TOAST, O NOTIFICADOR
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


// EL REMPLAZO DE WEBSOCKETS
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

      localStorage.setItem(name, JSON.stringify(then_data));

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
  let sesion = localStorage.getItem('admin-acape-session');

  if (!sesion) return null;

  let data = sesion;

  socket.emit('admin-validator', { token: data });

  socket.once('admin-validator', (data) => {
    if (!data.data) {
      Toast.fire({
        text: data.message,
        icon: "error"
      })
      localStorage.removeItem('admin-acape-session');
      location.hash = "#/invalid-user";
    };


    localStorage.setItem('admin-acape-session/data', JSON.stringify(data.data))

    let userPerms = data.role;

    let finalData = localStorage.getItem('admin-acape-session/data');

    if(!finalData) return;

    let jsonData = JSON.parse(finalData);

    let movements = converterArray(jsonData.movements?jsonData.movements:{}).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-3).reverse();

    jsonData.accounting.movements = movements;

    let methodsArray = converterArray(jsonData.methods?jsonData.methods:{});

    let pagosArray = converterArray(jsonData.pagosFijos?jsonData.pagosFijos:{});

    let document_movementsPrincipal = document.querySelector('.movements-principal');

    if(!document_movementsPrincipal) return;

    let editingNumbering = document.querySelector('.editing-numbering-accounting');

    if(!editingNumbering) return;

    editingNumbering.innerHTML = `$ ${formatNumber(jsonData.accounting.value)} COP`;

    document_movementsPrincipal.innerHTML = movements.map(ch => `
        <div class="contain mb-2">
          <h7>${ch.type} - ${ch.sign=="+"?"<span class='increase'>Entrante</span>":"<span class='decrease'>Saliente</span>"}</h7><br>
          <span>Monto: $ ${formatNumber(ch.money)}</span>
        </div>
      `).join('');

      document.querySelector('.carteras').innerHTML = `
        <div class="col-lg-3 col-sm-6">
                <div class="card blur border border-white mb-4 shadow-xs">
                  <div class="card-body p-4 final-carding">
                    <div class="d-flex centered-carding">
                      <div class="icon icon-shape bg-white">
                        <svg xmlns="http://www.w3.org/2000/svg" height="19" width="19" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z" />
                          <path fill-rule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zM9 12.75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z" clip-rule="evenodd" />
                          <path d="M12 7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
                        </svg>
                      </div>
                      <span class="text-sm text-carding">Efectivo</span>
                    </div>
                    <h5 class="mb-0 font-weight-bold editing-numbering-accounting">$ ${formatNumber(jsonData.accounting.value)} COP</h5>
                  </div>
                </div>
              </div>
        ` + methodsArray.map(ch => `
            <div class="col-lg-3 col-sm-6">
              <div class="card blur border border-white mb-4 shadow-xs">
                <div class="card-body p-4 final-carding">
                  <div class="d-flex centered-carding">
                    <div class="icon icon-shape bg-white">
                      <svg xmlns="http://www.w3.org/2000/svg" height="19" width="19" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                        <path fill-rule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-sm text-carding">${ch.name}</span>
                  </div>
                  <h5 class="mb-0 font-weight-bold">$ ${formatNumber(ch.value)} COP</h5>
                </div>
              </div>
            </div>
      `).join('');

      document.querySelector('.array-money').innerHTML = `
        <div class="row row-cols-1 row-cols-md-2 g-4">
          ${pagosArray.map(ch => {
            return `
            <div class="col">
              <div class="card">
                <div class="card-body">
                  <h5 class="card-title">${ch.name}</h5>
                  <p class="card-text">
                    <b>Fecha Ultimo Pago: </b> ${new Date(ch.empieza).toLocaleDateString()}<br>
                    <b>Total A Pagar: </b> ${ch.monto?formatNumber(ch.monto):"Valor Variable"}<br>
                    <br>
                    <b>Proximo Pago:</b> ${new Date(ch.empieza + timems(`${ch.days}d`)).toLocaleDateString()}
                  </p>
                </div>
                <div class="card-footer">

                  <div class="divided-content-2">
                    <button class="btn btn-info" onclick="setPay(${ch.id})">Pagar</button>
                    <div class="another-btns">
                      <button class="btn btn-success" onclick="editingPagoFijo(${ch.id})"><i class="fa-solid fa-pen"></i></button>
                      <button class="btn btn-danger" onclick="deletePagoFijo(${ch.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                  </div>



                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      `;


    document.querySelector('.app').classList.add('active')
  })
}


// FUNCIONES DE METODOS/CARTERAS ------------------------------
function deleteMethod(name) {
  let token = localStorage.getItem('admin-acape-session');

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
  let token = localStorage.getItem('admin-acape-session');

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

// FIN FUNCIONES DE METODOS / CARTERAS

// ZONA DE METHODS, O DE CARTERAS
router.get('/wallets', () => {
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


function converterArray(object) {
  let keys = Object.keys(object);
  let arrayToReturn = [];

  keys.forEach((element, i, array) => {
    arrayToReturn.push(object[element]);
  })

  return arrayToReturn;
}

// SUBIR ARCHIVOS DE FACTURAS Y PROCESAMIENTO DE FACTURAS

async function uploadBodega(e){
  let token = localStorage.getItem('admin-acape-session');
  const fileInput = document.getElementById('xmlFile');
  const files = fileInput.files;  // Obtener todos los archivos seleccionados
  if (files.length === 0) return;

  const formData = new FormData();
  
  // Agregar todos los archivos al FormData
  for (let i = 0; i < files.length; i++) {
    formData.append('xml', files[i]);
  }

  try {
    const res = await axios.post('/bodega/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
    });

    alert.fire({
      title: "Factura procesada Correctamente",
      text: res.data.message,
      icon: "success"
    });
  } catch (err) {
    alert.fire({
      title: "Error",
      text: err.response ? err.response.data.message : err.message,
      icon: "error"
    });
  }
  
  return false;
}

// FIN DE LA SUBIDA DE PROCESAMIENTO DE FACTURAS DIAN XML


// PARA BUSCAR EN BODEGA

document.addEventListener('input', async (e) => {
  if(e.target.classList.contains('searching-bodega')){
    let finalizing = JSON.parse(localStorage.getItem('acape-products')?localStorage.getItem('acape-products'):"{}");
    let arrayBodega = converterArray(finalizing);

    let busqueda = e.target.value.toLowerCase();

    let arrayBodegaFilter = arrayBodega.filter(item => item.id.toString().toLowerCase().includes(busqueda) ||
    item.name.toLowerCase().includes(busqueda));

    finalDetergente(arrayBodegaFilter);
  }
})


// CREACIÓN DE PRODUCTOS | FUNCION DE ENVIO DE PRODUCTOS
function sendCreateProduct(e) {
  let data = {
    name: e[0].value,
    price: removeCommaSeparators(e[1].value),
    price_mayor: removeCommaSeparators(e[2].value),
    iva: removeCommaSeparators(e[3].value),
    stock: removeCommaSeparators(e[4].value),
    costo_adquisitivo: removeCommaSeparators(e[5].value),
    id_personalizado: e[6].value,
    pesaje: e[7].value,
    max_stock: e[8].value,
    venta_por_peso: e[9].checked
  }
  let token = localStorage.getItem('admin-acape-session');

  socket.emit('createProduct', { product: data, token: token })
  return false;
}


// POPUP PARA LA CREACIÓN DE PRODUCTO CON SUS RESPECTIVOS INPUTS
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
        <br>

        <label>Pesaje / UNIDADES</label>
          <p>Este pesaje si lo agrega, el producto pasara a ser materia prima, y dejara de tener existencias de venta y se pasara al sistema de bodega y producción. Recuerda anotar el dato en gramos.</p>
          <p>Puede agregar cero para volverlo materia prima nomas</p>
          <div class="input-group mb-3">
            <span class="input-group-text">g</span>
            <input type="number" class="form-control" d-inline" placeholder="1000 G">
          </div>


          <label>MAXIMO DE STOCK</label>
          <p>ESTE MAXIMO DE STOCK SIRVE PARA HACER PEDIDOS O VER CUANTOS FALTAN EN BODEGA/p>
          <p>RECUERDA TENER EL MAXIMO QUE TENIAS EN BODEGA</p>
          <div class="input-group mb-3">
            <span class="input-group-text">#</span>
            <input type="number" class="form-control" d-inline" placeholder="15">
          </div>

          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="venta_por_peso">
            <label class="form-check-label" for="venta_por_peso">
              <i class="fa-solid fa-weight-scale"></i> Venta por peso (precio por kg)
            </label>
            <p class="text-muted small">Si lo activas, el precio se tomará como precio por kilo y tendrás un botón Pesar al vender</p>
          </div>

        <br>
        <button class="btn btn-outline-primary d-block w-100">Crear Producto</button>
      </form>
    `
  })
}


// FUNCION PARA OBTENER LOS PRODUCTOS
// ESTA FUNCION TIENE EL FINALDETERGENTE QUE FUE UNA FUNCION CREADA PARA ACTUALIZAR LOS PRODUCTOS, MAL LLAMADA PERO POR QUE EL SISTEMA MUY GRANDE, ENTONCES PODRIA GENERAR ALGUNA INESTABILIDAD
function getProducts(retorno) {
  let token = localStorage.getItem('admin-acape-session');
  socket.emit('bodega/products', { token: token });

  socket.once('bodega/products', (data) => {
    if (!data.data) return Toast.fire({ text: data.message });

    let final_products = converterArray(data.data);

    localStorage.setItem('acape-products', JSON.stringify(data.data))

    if(!retorno) finalDetergente(final_products);
  })
}


// FUNCION DE PRODUCTOS | ACTUALIZACION DE DATOS EN PRODUCTS

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
          <th>Cantidad</th>
          <th>Costo</th>
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
            <td># ${actual_stock==null?'Infinito':actual_stock}</td>
            <td>$ ${formatNumber(ch.costo_adquisitivo?ch.costo_adquisitivo:"0")}</td>
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


// ENVIO DE DATOS PARA LA EDICION
function sendEditProduct(e, id) {
  let data = {
    name: e[0].value,
    price: removeCommaSeparators(e[1].value),
    price_mayor: removeCommaSeparators(e[2].value),
    iva: removeCommaSeparators(e[3].value),
    stock: removeCommaSeparators(e[4].value),
    costo_adquisitivo: removeCommaSeparators(e[5].value),
    id_personalizado: removeCommaSeparators(e[6].value),
    id: id,
    pesaje: e[7].value,
    max_stock: e[8].value,
    venta_por_peso: e[9].checked
  }

  console.log(data)

  let token = localStorage.getItem('admin-acape-session')
  socket.emit('editProduct', { product: data, token: token });

  return false;
}

// EDITANDO PRODUCTOS
function editProduct(id) {
  let token = localStorage.getItem('admin-acape-session')
  socket.emit(`getProduct/${id}`, { token: token });
  socket.once(`getProduct/${id}`, (data) => {
    let info_inputs = data.data;

    if (!info_inputs) return Toast.fire({
      title: "Manager de productos",
      text: "El producto que quieres editar no existe o fue eliminado.",
      icon: "error"
    });

    console.log(info_inputs)

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
            <input type="text" value="${Number(info_inputs.stock)}" class="form-control numberify-input-commas d-inline" placeholder="10">
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
          <br>

          <label>Pesaje / UNIDADES</label>
          <p>Este pesaje si lo agrega, el producto pasara a ser materia prima, y dejara de tener existencias de venta y se pasara al sistema de bodega y producción. Recuerda anotar el dato en gramos.</p>
          <p>Puede agregar cero para volverlo materia prima nomas</p>
          <div class="input-group mb-3">
            <span class="input-group-text">g</span>
            <input type="number" class="form-control" value="${Number(info_inputs.pesaje)}" d-inline" placeholder="1000 G">
          </div>

          <label>MAXIMO DE STOCK</label>
          <p>ESTE MAXIMO DE STOCK SIRVE PARA HACER PEDIDOS O VER CUANTOS FALTAN EN BODEGA/p>
          <p>RECUERDA TENER EL MAXIMO QUE TENIAS EN BODEGA</p>
          <div class="input-group mb-3">
            <span class="input-group-text">#</span>
            <input type="number" class="form-control" d-inline" placeholder="15" value="${info_inputs.max_stock?info_inputs.max_stock:""}">
          </div>

          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="editVentaPorPeso" ${info_inputs.venta_por_peso == "true" ? 'checked' : ''}>
            <label class="form-check-label" for="editVentaPorPeso">
              <i class="fa-solid fa-weight-scale"></i> Venta por peso (precio por kg)
            </label>
            <p class="text-muted small">Si lo activas, el precio se tomará como precio por kilo y tendrás un botón Pesar al vender</p>
          </div>


          <div class="edit-buttons">
            <button class="btn btn-outline-primary w-100"><i class="fa-solid fa-pen"></i> Editar</button>
            <a class="btn btn-outline-danger w-100" onclick="deleteProducts('${info_inputs.id}')"><i class="fa-solid fa-circle-minus"></i> Eliminar</a>
          </div>
        </form>
      `
    })
  })
}


// BORRAR PRODUCTOS
function deleteProducts(id) {
  let token = localStorage.getItem('admin-acape-session');
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

function inputVentas(e) {
  let actuallyProducts = JSON.parse(localStorage.getItem('acape-products') ? localStorage.getItem('acape-products') : "{}");

  let array_products = converterArray(actuallyProducts);
  let filtering = array_products.filter(ch => {
    return ch.name.toLowerCase().includes(e.value.toLowerCase()) || ch.id.toString().includes(e.value.toLowerCase());
  });
  if (e.value == "") return document.querySelector('.searching').innerHTML = '';
  document.querySelector('.searching').innerHTML = `
    <div class="buscando">
      ${filtering.map(ch => `<div onclick="setListProduct('${ch.id}')" class="sill-btn">#${ch.id} <b>${ch.name}</b> - U: ${ch.stock?ch.stock:"?"}</div>`).join('')}
    </div>
  `;
}

function changeCantidad(id, e) {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products-acape-admin');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);
  let finalPrice = 0;
  productList.forEach((element, i, array) => {
    if (element.id == id) {
      if (!array[i].stock) {
        array[i].cantidad = e.value ? e.value : 1;
        finalPrice = Number(finalPrice) + Number(element.cantidad ? (element.price * array[i].cantidad) : element.price);
        sessionStorage.setItem('actually-list-products', JSON.stringify(array));
        document.querySelector(`.change-price-${id}`).innerHTML = `${formatNumber(array[i].price*array[i].cantidad)}`;
        document.querySelector('.edit-total').innerHTML = formatNumber(finalPrice);
        return;
      }

      array[i].cantidad = e.value ? e.value : 1;
      finalPrice = Number(finalPrice) + Number(element.cantidad ? (element.price * array[i].cantidad) : element.price);
      sessionStorage.setItem('actually-list-products-acape-admin', JSON.stringify(array));
      document.querySelector(`.change-price-${id}`).innerHTML = `${formatNumber(array[i].price*array[i].cantidad)}`;
    } else {
      finalPrice = Number(finalPrice) + Number(element.cantidad ? (element.price * element.cantidad) : element.price);
    }

    document.querySelector('.edit-total').innerHTML = formatNumber(finalPrice);
  });

  return false;
}

function deleteList(id) {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products-acape-admin');
  if (!actuallyProductsList) return;

  let productList = JSON.parse(actuallyProductsList);

  productList.forEach((element, i, array) => {
    if (element.id == id) {
      array.splice(i, 1);
      sessionStorage.setItem('actually-list-products-acape-admin', JSON.stringify(array));
    }
  })

  listingProducts();
}


function setListProduct(data) {
  let products = JSON.parse(localStorage.getItem('acape-products')?localStorage.getItem('acape-products'):{});

  let array_products = converterArray(products)
  let findingProduct = array_products.find(ch => {
    return ch.id.toString() === data;
  });

  if (!findingProduct) return Toast.fire({
    title: "Manager de productos",
    text: "El producto no se encuentra registrado en el sistema o fue eliminado.",
    icon: "error"
  });

  document.querySelector('.reseting-listing').value = '';
  document.querySelector('.searching').innerHTML = '';

  let listing = sessionStorage.getItem('actually-list-products-acape-admin');
  if (!listing) sessionStorage.setItem('actually-list-products-acape-admin', JSON.stringify([]));

  let actuallyListing = listing ? JSON.parse(listing) : [];

  let findingProduct2 = actuallyListing.find(ch => ch.name == findingProduct.name);
  if (findingProduct2) {
    actuallyListing.forEach((element, i, array) => {
      if (element.name == findingProduct2.name) {
        element.cantidad = element.cantidad ? element.cantidad : 0;
        element.cantidad = element.cantidad + 1;
        array[i] = element;
        sessionStorage.setItem('actually-list-products-acape-admin', JSON.stringify(array));
      }
    })
  } else {

    alert.fire({
      title: "Precio Unitario",
      text: "Recuerda agregar el precio unitario",
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
        findingProduct.cantidad = 1;
        findingProduct.price = !removeCommaSeparators(element.value) ? findingProduct.costo_adquisitivo : removeCommaSeparators(element.value);
        actuallyListing.push(findingProduct);
        sessionStorage.setItem('actually-list-products-acape-admin', JSON.stringify(actuallyListing));
        listingProducts();
      }
    })

  }

  listingProducts();
}

function listingProducts() {
  let actuallyProductsList = sessionStorage.getItem('actually-list-products-acape-admin') ? JSON.parse(sessionStorage.getItem('actually-list-products-acape-admin')) : [];

  let array_productsList = actuallyProductsList;
  // xd
  let finalPrice = 0;
  let final_html = array_productsList.map(ch => {
    finalPrice = Number(finalPrice) + Number(ch.cantidad ? (ch.price * (ch.cantidad ? ch.cantidad : 0)) : ch.price);
    return `<tr>
        <td>${ch.id}</td>
        <td>${ch.name}</td>
        <td>${formatNumber(ch.price)}</td>
        <td class="non-padding">
          <input oninput="return changeCantidad('${ch.id}', this)" type="number" value="${ch.cantidad?ch.cantidad:1}" ${!ch.cantidad?"disabled":""}>
        </td>
        <td class="change-price-${ch.id}">${formatNumber(ch.cantidad?(ch.price*(ch.cantidad?ch.cantidad:0)):ch.price)}</td>
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

function sendFactura(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');
  let token = localStorage.getItem('admin-acape-session');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  popup.close();


  socket.emit('bodega/facturar', {factura: finalListArray, token: token});

  socket.once('bodega/facturar', (data) => {
    if(!data.data) return Toast.fire({
      title: "Hubo un error al procesar la factura",
      text: data.message,
      icon: "error"
    });


    popup.close();

    sessionStorage.removeItem('actually-list-products-acape-admin');

    listingProducts();

    alert.fire({
      title: "Factura Procesada Correctamente",
      text: "El servidor aprobo la factura, revisa los movimientos registrados en el server.",
      icon: "success"
    });

  })
}

function genFacturaNormal(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  let sumando = 0;

  finalListArray.forEach((element) => {
    sumando = sumando + (parseFloat(element.price?element.price:(element.costo_adquisitivo?element.costo_adquisitivo:0)) * element.cantidad);
  })


  popup.open({
    title: "Factura A Credito",
    content: `
      <p>Recuerda que esta factura cobra directamente a la base principal de dinero.</p>
      <p><b>Total de la factura: </b> $ ${formatNumber(sumando)}</p>

      <button class="btn btn-block btn-outline-primary" onclick="sendFactura()">Enviar Factura</button>
    `
  })
}


function sendInventarioSalida(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');
  let token = localStorage.getItem('admin-acape-session');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  let finaltosend = finalListArray.map(ch => {
    return {...ch, cantidad: Number(ch.cantidad)*-1};
  });

  console.log(finaltosend)

  popup.close();


  socket.emit('bodega/inventario', {factura: finaltosend, token: token});

  socket.once('bodega/inventario', (data) => {
    if(!data.data) return Toast.fire({
      title: "Hubo un error al procesar esta factura",
      text: data.message,
      icon: "error"
    });


    popup.close();

    sessionStorage.removeItem('actually-list-products-acape-admin');

    listingProducts();

    alert.fire({
      title: "Inventario Procesado Correctamente",
      text: "El servidor aprobo el inventario",
      icon: "success"
    });
  })
}

function sendInventarioEntrada(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');
  let token = localStorage.getItem('admin-acape-session');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  popup.close();


  socket.emit('bodega/inventario', {factura: finalListArray, token: token});

  socket.once('bodega/inventario', (data) => {
    if(!data.data) return Toast.fire({
      title: "Hubo un error al procesar esta factura",
      text: data.message,
      icon: "error"
    });


    popup.close();

    sessionStorage.removeItem('actually-list-products-acape-admin');

    listingProducts();

    alert.fire({
      title: "Inventario Procesado Correctamente",
      text: "El servidor aprobo el inventario",
      icon: "success"
    });
  })
}

function salidaInventario(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  let sumando = 0;

  finalListArray.forEach((element) => {
    sumando = sumando - (parseFloat(element.price?element.price:(element.costo_adquisitivo?element.costo_adquisitivo:0)) * element.cantidad);
  })


  popup.open({
    title: "Salida de inventario",
    content: `
      <p>Esto solo marca el gasto de inventario que hubo y de igual manera genera movimiento y factura al sistema</p>
      <p><b>Total del movimiento: </b> $ ${formatNumber(sumando)}</p>

      <button class="btn btn-block btn-outline-primary" onclick="sendInventarioSalida()">Enviar Factura</button>
    `
  })
}

function entradaInventario(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  let sumando = 0;

  finalListArray.forEach((element) => {
    sumando = sumando + (parseFloat(element.price?element.price:(element.costo_adquisitivo?element.costo_adquisitivo:0)) * element.cantidad);
  })


  popup.open({
    title: "Entrada de inventario",
    content: `
      <p>Esto solo marca el gasto de inventario que hubo y de igual manera genera movimiento y factura al sistema</p>
      <p><b>Total del movimiento: </b> $ ${formatNumber(sumando)}</p>

      <button class="btn btn-block btn-outline-primary" onclick="sendInventarioEntrada()">Enviar Factura</button>
    `
  })
}


function sendCorrector(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');
  let token = localStorage.getItem('admin-acape-session');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  popup.close();


  socket.emit('bodega/inventario/update', {factura: finalListArray, token: token});

  socket.once('bodega/inventario/update', (data) => {
    if(!data.data) return Toast.fire({
      title: "Hubo un error al procesar el movimiento",
      text: data.message,
      icon: "error"
    });


    popup.close();

    sessionStorage.removeItem('actually-list-products-acape-admin');

    listingProducts();

    alert.fire({
      title: "Inventario Procesado Correctamente",
      text: "El servidor aprobo el inventario, se ha actualizado la información",
      icon: "success"
    });
  })
}

function correctorInventory(){
  let actuallyList = sessionStorage.getItem('actually-list-products-acape-admin');

  let finalListArray = converterArray(JSON.parse(actuallyList));

  let sumando = 0;

  finalListArray.forEach((element) => {
    sumando = sumando + (parseFloat(element.price?element.price:(element.costo_adquisitivo?element.costo_adquisitivo:0)) * element.cantidad);
  })


  popup.open({
    title: "Correción de inventario",
    content: `
      <p>Esta función es peligrosa y puede dañar el orden del inventario, tener mucho cuidado a la hora de hacer correciones de inventario</p>
      <p><b>Total del movimiento: </b> $ ${formatNumber(sumando)}</p>

      <button class="btn btn-block btn-outline-primary" onclick="sendCorrector()">Enviar Correción</button>
    `
  })
}

router.get('/facturacion-bodega', () => {
  sessionValidator();

  let token = localStorage.getItem('admin-acape-session');
  getProducts();

  setTimeout(() => {
    listingProducts();
  }, 500);

  return `
    <div class="container my-2 facturacion-bodega">
      <h1 class="text-center">Facturacion en la bodega</h1>
      <p class="text-center">Creacion de facturas entradas y salidas de bodega</p>

      <div class="justify-content-center text-center">
        <button class="btn btn-outline-primary" onclick="genFacturaNormal()"><i class="fa-solid fa-money-bill"></i> Generar Factura Credito</button>
        <button class="btn btn-outline-danger" onclick="salidaInventario()"><i class="fa-solid fa-money-bill-transfer"></i> Salida del inventario</button>
        <button class="btn btn-outline-success" onclick="entradaInventario()"><i class="fa-solid fa-money-bill-transfer"></i> Entrada del inventario</button>
        <button class="btn btn-outline-info" onclick="correctorInventory()"><i class="fa-solid fa-truck"></i> Correción De Inventario</button>
      </div>

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
                <th>Precio U</th>
                <th>Cantidad</th>
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

    </div>
  `;
})


function separarMateriasPrimas(){
  let gettingProducts = JSON.parse(localStorage.getItem('acape-products'));

  let filtering = converterArray(gettingProducts).filter(ch => ch.materia_prima);

  finalDetergente(filtering)
}

router.get('/bodega', () => {
  sessionValidator();

  let token = localStorage.getItem('admin-acape-session');
  getProducts();

  return `
    <div class="container my-2 bodega">
      <h1>Bodega</h1>
      <p>Vea los precios actualizados de la bodega.</p>
      <div class="text-center">
        <button class="btn btn-outline-primary" onclick="createProduct(this.value)"><i class="fa-solid fa-square-plus"></i> Nuevo Producto</button>
      </div>

      <br><br>

      <div class="container">
        <form id="form-upload" class="card p-4" onsubmit="return uploadBodega(this)">
          <div class="mb-3">
            <label for="xmlFile" class="form-label">Selecciona archivo XML</label>
            <input class="form-control" type="file" multiple id="xmlFile" accept=".xml" required>
          </div>
          <button type="submit" class="btn btn-primary">Subir</button>
          <div id="msg" class="mt-3"></div>
        </form>

        <div class="my-3">

          <div class="">
            <div class="input-group mb-3 shadow-sm rounded">
              <span class="input-group-text bg-white border-end-0">
                <i class="fa fa-search"></i>
              </span>
              <input type="text" class="form-control searching-bodega border-start-0" placeholder="Buscar..." aria-label="Buscar">
            </div>

          </div>

          <br>

          <div class="text-center mb-2" onclick="separarMateriasPrimas()"><button class="btn btn-outline-warning">Separar Materias Primas</button></div>

          <div class="all-products"></div>

        </div>
      </div>
    </div>
  `;
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
  localStorage.setItem('admin-acape-session', data.data.token);
  location.reload()
})

// ROUTER FUNCTIONS --------------------------------------------------
// FUNCIONES RUTA PRINCIPAL -----------------------------

function addCommaSeparators(input) {
  let value = input.value.replace(/[^\d.]/g, '');
  let parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  input.value = parts.join('.');
}

function removeCommaSeparators(input) {
  return input.replace(/,/g, '');
}

document.addEventListener('input', function (e) {
  if (e.target.classList.contains('numberify-input-commas')) {
    addCommaSeparators(e.target);
  }
});


// REFACTORIZADA ------
function openDecrease(user, password) {
  let methods = localStorage.getItem('admin-acape-session/data');
  if (!methods) return Toast.fire({ icon: "error", text: "Error de sesión." });

  let methodsArray = converterArray(JSON.parse(methods).methods);

  popup.open({
    title: "<div class='decrease'>Saliente</div>",
    content: `
      <form class="form-decrease">
        <p>Recuerda proceder con precaución.</p>
        <label>Cartera</label>
        <select name="digital" class="form-select">
          <option value="">Efectivo</option>
          ${methodsArray.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join("")}
        </select>
        
        <label>Monto</label>
        <div class="input-group mb-3">
          <span class="input-group-text">$</span>
          <input inputmode="numeric" type="text" name="monto" class="focusing numberify-input-commas form-control" placeholder="111,000.00" required>
        </div>

        <label>Descripción</label>
        <input type="text" name="desc" class="form-control" placeholder="Ej: Salida de caja">
        <br>
        <button class="btn btn-outline-primary w-100">Guardar</button>
      </form>
    `
  });

  document.querySelector('.focusing')?.focus();
}

function openIncrease(user, password) {
  let methods = localStorage.getItem('admin-acape-session/data');

  if (!methods) return Toast.fire({
    icon: "error",
    text: "Parece que hay un error con la sesión, recarga la página."
  });

  let methodsArray = converterArray(JSON.parse(methods).methods);

  popup.open({
    title: "<div class='increase'>Entrante</div>",
    content: `
      <form class="form-increase">
        <p>Los registros no se pueden borrar, así que recuerda proceder con precaución</p>

        <label>Cartera</label>
        <select name="digital" class="form-select">
          <option value="">Efectivo</option>
          ${methodsArray.map(ch => `
            <option value="${ch.name}">${ch.name}</option>
          `).join("")}
        </select>
        
        <label>Monto</label>
        <div class="input-group mb-3">
          <span class="input-group-text">$</span>
          <input inputmode="numeric" type="text" autofocus name="monto" class="focusing numberify-input-commas form-control" placeholder="Monto: 10,000" required>
        </div>

        <label>Descripción</label>
        <div class="input-group mb-3">
          <span class="input-group-text">ABC</span>
          <input type="text" name="desc" class="form-control" placeholder="Ejem: Dinero Entrante">
        </div>

        <input type="hidden" name="user" value="${user}">
        <input type="hidden" name="password" value="${password}">
        <br>
        <button class="btn btn-outline-primary btn-block w-100">
          <i class="fa-solid fa-floppy-disk"></i> Guardar
        </button>
      </form>
    `
  });

  document.querySelector('.focusing')?.focus();
}
function addPagoFijo(user, password) {
  popup.open({
    title: "Crear Pago Fijo",
    content: `
      <form class="form-pago-fijo">
        <label>Nombre del pago</label>
        <input required name="name" class="form-control" placeholder="Ej: Luz">
        
        <label>Fijo o Variable</label>
        <select name="fijo" class="form-select">
          <option value="">Fijo</option>
          <option value="variable">Variable</option>
        </select>

        <label>Días de pago</label>
        <input name="days" class="form-control" placeholder="Ej: 10">

        <label>Última fecha de pago</label>
        <input type="date" name="empieza" class="form-control">

        <label>Monto</label>
        <input required name="monto" class="form-control numberify-input-commas" placeholder="Ej: 100,000">

        <input type="hidden" name="user" value="${user}">
        <input type="hidden" name="password" value="${password}">
        <br>
        <button class="btn btn-primary w-100">Guardar Pago Fijo</button>
      </form>
    `
  });
}

function openCaja(user, password) {
  popup.open({
    title: "Registrar Caja",
    content: `
      <form class="form-caja">
        <label>Total en ventas</label>
        <input inputmode="numeric" placeholder="100,000" required name="total_recibido" class="form-control numberify-input-commas">

        <label>Total en egresos</label>
        <input inputmode="numeric" placeholder="50,000" required name="egreso" class="form-control numberify-input-commas">

        <label>Total entregado</label>
        <input inputmode="numeric" placeholder="50,000" required name="value" class="form-control numberify-input-commas">

        <label>Responsable Del Cierre</label>
        <input placeholder="@JhonDoe" required name="responsable" class="form-control">
        <br>
        <button class="btn btn-outline-primary w-100">Registrar</button>
      </form>
    `
  });
}
function transferenciaOpen(user, password) {
  let methods = localStorage.getItem('admin-acape-session/data');
  if (!methods) return Toast.fire({ icon: "error", text: "Error de sesión." });

  let methodsArray = converterArray(JSON.parse(methods).methods);

  popup.open({
    title: "Transferencia de Dinero",
    content: `
      <form class="form-transferencia">
        <label>Cartera de Envío</label>
        <select name="from" class="form-select">
          <option value="">Efectivo</option>
          ${methodsArray.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join("")}
        </select>

        <label>Cartera de Recepción</label>
        <select name="to" class="form-select">
          <option value="">Efectivo</option>
          ${methodsArray.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join("")}
        </select>

        <label>Monto</label>
        <input inputmode="numeric" name="monto" required class="form-control numberify-input-commas" placeholder="100,000">
        <br>
        <button class="btn btn-outline-primary w-100">Transferir</button>
      </form>
    `
  });
}


// REFACTORIZADA FIN -----

function setPay(id) {
  let finalData = localStorage.getItem('admin-acape-session/data');
  if(!finalData) return;

  let jsonData = converterArray(JSON.parse(finalData).pagosFijos);

  let pagosArray = jsonData;

  const session = localStorage.getItem('admin-acape-session');
  if (!session) {
    return Toast.fire({ icon: "error", text: "Sesión inválida. Recarga la página." });
  }

  const token = session;
  const findingIt = pagosArray.find(ch => ch.id == id);
  if (!findingIt) return Toast.fire({ icon: "error", text: "No se encontró el pago" });

  const finalAlert = {
    title: "Hacer Pago Fijo",
    text: "Confirma el pago.",
    confirmButtonText: "Pagar",
    showCancelButton: true
  };

  if (findingIt.fijo !== "true") {
    finalAlert.input = "text";
    finalAlert.inputAttributes = {
      placeholder: "Total a pagar",
      inputmode: "numeric"
    };
  }

  alert.fire(finalAlert).then(async (result) => {
    if (result.isConfirmed) {
      const monto = findingIt.fijo === "true" ? findingIt.monto : result.value;

      try {
        const res = await axios.post('/app/setPagoFijo', { id, monto, token }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const message = res.data?.message || "Pago realizado correctamente";
        Toast.fire({ icon: "success", text: message });

        const extra = res.data?.data;
        if (extra) console.log("Info adicional:", extra);

        sessionValidator()
      } catch (err) {
        console.error(err);
        Toast.fire({ icon: "error", text: "Error al hacer el pago" });
      }
    }
  });
}


function editingPagoFijo(id) {
  let finalData = localStorage.getItem('admin-acape-session/data');
  if(!finalData) return;

  let jsonData = converterArray(JSON.parse(finalData).pagosFijos);

  let pagosArray = jsonData;

  const findingIt = pagosArray.find(ch => ch.id == id);
  if (!findingIt) return Toast.fire({ icon: "error", text: "Pago no encontrado." });

  popup.open({
    title: "Editar Pago Fijo",
    content: `
      <form class="form-editar-fijo">
        <label>Nombre del pago</label>
        <input name="name" required class="form-control" value="${findingIt.name}">

        <label>Fijo o Variable</label>
        <select name="fijo" class="form-select">
          <option value="${findingIt.fijo == 'true' ? '' : 'variable'}">${findingIt.fijo == 'true' ? 'Fijo' : 'Variable'}</option>
          <option disabled>────────</option>
          <option value="">Fijo</option>
          <option value="variable">Variable</option>
        </select>

        <label>Días de pago</label>
        <input name="days" class="form-control" value="${findingIt.days || ''}">

        <label>Última fecha de pago</label>
        <input type="date" name="empieza" class="form-control">

        <label>Monto</label>
        <input required name="monto" class="form-control numberify-input-commas" value="${findingIt.monto ? formatNumber(findingIt.monto) : ''}">

        <input type="hidden" name="id" value="${id}">
        <br>
        <button class="btn btn-info w-100">Editar Pago Fijo</button>
      </form>
    `
  });
}


function deletePagoFijo(id) {

  let finalData = localStorage.getItem('admin-acape-session/data');
  if(!finalData) return;

  let jsonData = converterArray(JSON.parse(finalData).pagosFijos);

  let pagosArray = jsonData;

  const session = localStorage.getItem('admin-acape-session');
  if (!session) {
    return Toast.fire({ icon: "error", text: "Sesión inválida. Recarga la página." });
  }

  const token = session;

  alert.fire({
    title: "¿Eliminar Pago Fijo?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    confirmButtonText: "Sí, eliminar",
    showCancelButton: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await axios.post('/app/deletePagoFijo', { id, token }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const message = res.data?.message || "Pago eliminado correctamente";
        Toast.fire({ icon: "success", text: message });

        const extra = res.data?.data;
        if (extra) console.log("Info adicional:", extra);

        sessionValidator();

        // Opcional: actualizar la vista, eliminar elemento, etc.
      } catch (err) {
        console.error(err);
        Toast.fire({ icon: "error", text: "Error al eliminar el pago" });
      }
    }
  });
}



// RUTA PRINCIPAL

function sendReporteDia() {
  let token = localStorage.getItem('admin-acape-session');

  // Mostrar pantalla de carga
  Swal.fire({
    title: 'Enviando reporte...',
    text: 'Por favor espera mientras generamos y enviamos el reporte.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  axios.post('/app/reporte', { token: token })
    .then((data) => {
      Swal.fire({
        title: "Mensaje Enviado Correctamente",
        text: "Revisa tu WhatsApp para ver el reporte generado.",
        icon: "success"
      });
    })
    .catch(() => {
      Swal.fire({
        title: "Error de servidor",
        text: "Parece que no hay conexión con el servidor.",
        icon: "error"
      });
    });
}


router.get(['/', '', '/app'], () => {
  const sesion = localStorage.getItem('admin-acape-session');
  if (!sesion) {
    return `
      <div class="center-center center-full">
        <form class="siops-sesion card p-5" onsubmit="return loginFunc(this)">
          <h3 class="text-center">ADMIN</h3>
          <p>Inicia sesion en ACAPE Administrativo</p>
          <label htmlFor="user">Usuario</label>
          <input type="text" id="user" class="form-control" placeholder="Usuario">
          <br>
          <label htmlFor="password">Contraseña</label>
          <input type="password" placeholder="Contraseña" class="form-control">
          <br>
          <button class="btn btn-outline-primary btn-block d-block w-100">Iniciar</button>
          <br>
        </form>
      </div>
    `;
  } else {
    sessionValidator();

    let finalData = localStorage.getItem('admin-acape-session/data');
    let json_data = JSON.parse(finalData);

    let numberingMoney = formatNumber(json_data.accounting.value);

    return `
      <div class="container-principal-money">
        <div class="messages"></div>
        <div class="container principal-money-sers">
          <div class="container-carteras-principal text-center">
            <div class="row mt-n6 mb-6 carteras">

              <div class="col-lg-3 col-sm-6">
                <div class="card blur border border-white mb-4 shadow-xs">
                  <div class="card-body p-4 final-carding">
                    <div class="d-flex centered-carding">
                      <div class="icon icon-shape bg-white">
                        <svg xmlns="http://www.w3.org/2000/svg" height="19" width="19" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z" />
                          <path fill-rule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zM9 12.75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z" clip-rule="evenodd" />
                          <path d="M12 7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
                        </svg>
                      </div>
                      <span class="text-sm text-carding">Efectivo</span>
                    </div>
                    <h5 class="mb-0 font-weight-bold editing-numbering-accounting">$ ${numberingMoney} COP</h5>
                  </div>
                </div>
              </div>



            </div>
          </div>

          <br>
          
          <div class="btn-group w-100" role="group" aria-label="Basic mixed styles example">
            <button class="btn btn-outline-primary" onclick="openIncrease('{{{user.user}}}', '{{{user.password}}}')"><i class="fa-solid fa-arrow-trend-up"></i> Ingr</button>
            <button class="btn btn-outline-danger" onclick="openDecrease('{{{user.user}}}', '{{{user.password}}}')"><i class="fa-solid fa-arrow-trend-down"></i> Gast</button>
            <button class="btn btn-outline-info" onclick="transferenciaOpen('{{{user.user}}}', '{{{user.password}}}')"><i class="fa-solid fa-money-bill-transfer"></i> Transf</button>
          </div>

          <br><br>
          <div class="btn-group w-100 text-center">
            <button class="btn btn-outline-success" onclick="openCaja('{{{user.user}}}', '{{{user.password}}}')"> <i class="fa-solid fa-cart-plus"></i> Caja</button>
            <button class="btn btn-outline-primary" onclick="sendReporteDia()">Generar Reporte</button>
          </div>
        </div>
      </div>

      <hr>
      <div class="bills-money container text-center">
        <button class="btn btn-outline-primary" onclick="addPagoFijo()"><i class="fa-solid fa-plus"></i> Añadir Pago Fijo</button>
        <br><br>
        <div class="array-money"></div>
      </div>

      <br><br><br>
      <div class="movements container">
        <h6><i class="fa-solid fa-money-bill-transfer"></i> Movimientos de la cuenta</h6>
        <div class="movements-principal"></div>
        <br>
        <div class="view-movements"><a href="#/movements" class="link">Ver Todos Los Movimientos</a></div>
        <br><br>
      </div>
    `;
  }
});

/// -----------------------------------------------------------
let indiceMovimientos = 0;
const tamañoLote = 10;

function cargarMas() {
  const movimientos = [...window._cachedMovements].reverse();

  if (!movimientos) return;

  const lote = movimientos.slice(indiceMovimientos, indiceMovimientos + tamañoLote);
  indiceMovimientos = indiceMovimientos + tamañoLote;

  const fila = document.getElementById("fila-tarjetas");

  lote.forEach(item => { 
    const color = item.sign == "+" ? "success" : "danger";
    const simbolo = item.sign === "+" ? "increase" : "decrease";
    const tarjeta = document.createElement("div");

    tarjeta.className = "col-md-6 mb-2";
    tarjeta.innerHTML = `
      <div class="card border-start shadow-sm mb-3">
        <div class="card-body d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-1 fw-semibold">${item.type} - <div class="${simbolo}">${item.sign=="+"?"Entrante":"Saliente"}</div></h6>
            <small class="text-muted">${formatearFecha(item.date)}</small>
          </div>
          <div class="text-end">
            <span class="fw-bold text-${color} fs-8">${formatNumber(item.money)}</span>
          </div>
          <button class="btn btn-sm btn-primary m-2" title="Editar movimiento">
            <i class="fa-solid fa-pencil"></i>
          </button>
        </div>
      </div>
    `;

    fila.appendChild(tarjeta);
  });

  if (indiceMovimientos >= movimientos.length) {
    document.getElementById("btn-cargar-mas").style.display = "none";
  }
}

function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Activar al cargar la vista
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-cargar-mas");
  if (btn && window._cachedMovements) {
    btn.addEventListener("click", cargarMas);
  }
});

function rellenarStock(){
  let products = localStorage.getItem('acape-products');
  let finalProducts = converterArray(JSON.parse(products?products:{}));

  let filteringProducts = finalProducts.filter(ch => ch.max_stock);

  let finalFiltering = filteringProducts.filter(ch => ch.max_stock > ch.stock);

  let finalFill = document.querySelector('.fill-information-movements-bodega');


  let finalPriceStock_price = 0;
  let finalPriceStock = filteringProducts.map(ch => {
    if(ch.max_stock < ch.stock) return;

    let finalChantityStock = ch.max_stock - ch.stock;

    let silving = finalChantityStock * ch.costo_adquisitivo;

    finalPriceStock_price = Number(finalPriceStock_price) + Number(silving);
  })

  finalFill.innerHTML = `
    <div class="margin-top-br">
      <b>RELLENAR STOCK</b>
      <ul class="text-start">
        ${finalFiltering.map(ch => `
          <li>${Number(ch.max_stock) - Number(ch.stock)} ${ch.name}</li>
        `).join('')}
      </ul>
      <h4>TOTAL ESTIMADO: $ ${formatNumber(finalPriceStock_price)}</h4>
    </div>
  `;
}

router.get('/movements-bodega', () => {
  sessionValidator();

  getProducts("none");

  return `
    <div class="text-center">
      <h1>MOVIMIENTOS DE BODEGA</h1>
      <p>Genera cuentas y contabilidad con los movimientos de bodega</p>
      <button class="btn btn-outline-primary" onclick="rellenarStock()">RELLENAR STOCK</button>

      <div class="fill-information-movements-bodega"></div>
    </div>
  `;
});

function renderMiniMovimientos(json) {
    const container = document.getElementById("mini-movimientos");
    container.innerHTML = "";

    let arrayOrdenated = json.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    arrayOrdenated.forEach(mov => {
      let clase = "";
      switch (mov.tipo) {
        case "crear": clase = "card-crear"; break;
        case "editar": clase = "card-editar"; break;
        case "eliminar": clase = "card-eliminar"; break;
        case "facturacion-bodega": clase = "card-facturacion-bodega"; break;
      }

      const card = `
        <div class="col">
          <div class="card h-100 ${clase}">
            <div class="card-body">
              <h6 class="card-title mb-2">${mov.descripcion}</h6>
              <p class="card-text mb-1">
                <small class="text-muted">
                  ${new Date(mov.fecha).toLocaleDateString()} - ${mov.responsable}
                </small>
              </p>
              <a href="#/bodega/movimientos/${mov.idMovimiento}" class="stretched-link"></a>
            </div>
            <div class="card-footer"><small>${mov.idMovimiento}</small></div>
          </div>
        </div>
      `;
      container.innerHTML += card;
    });
}

router.get('/bodega-facturas', () => {
  sessionValidator();
  let sessionToken = localStorage.getItem('admin-acape-session');

  socket.emit('bodega/movimientos', {token: sessionToken});

  socket.once('bodega/movimientos', (data) => {
    if(!data.data) return alert.fire({
      title: "error",
      text: "Error en el servicio",
      icon: "error"
    });



    renderMiniMovimientos(converterArray(data.data))
  })

  return `
    <div id="mini-movimientos"></div>
  `;
});

function renderFactura(mov) {
    const container = document.getElementById("factura-detalle");
    container.innerHTML = `
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <h4 class="card-title mb-3">${mov.descripcion}</h4>
          <p class="mb-1"><strong>ID Movimiento:</strong> ${mov.idMovimiento}</p>
          <p class="mb-1"><strong>Fecha:</strong> ${new Date(mov.fecha).toLocaleString()}</p>
          <p class="mb-1"><strong>Responsable:</strong> ${mov.responsable}</p>
          <p class="mb-1"><strong>Tipo:</strong> ${mov.tipo}</p>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Ítems de la factura</h5>
          <div class="table-responsive">
            <table class="table table-sm table-striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(mov.items).map((item, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${item.nombre}</td>
                    <td>${item.cantidad}</td>
                    <td>$${parseInt(item.precioUnitario).toLocaleString()}</td>
                    <td>$${parseInt(item.total).toLocaleString()}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="text-end mt-3">
            <h5>Total Factura: 
              <span class="text-success">
                $${Object.values(mov.items).reduce((acc, item) => acc + parseInt(item.total), 0).toLocaleString()}
              </span>
            </h5>
          </div>
        </div>
      </div>
    `;
  }

router.get(`/bodega/movimientos/:id`, (data) => {
  let idToGet = data.params.id;
  let sessionToken = localStorage.getItem('admin-acape-session');

  socket.emit(`bodega/movimientos/${idToGet}`, {token: sessionToken});

  socket.once(`bodega/movimientos/${idToGet}`, (data) => {
    if(!data.data) return alert.fire({
      title: "error",
      icon: "error",
      text: data.message
    });

    renderFactura(data.data)
  });

  return `<div id="factura-detalle"></div>`;
})

router.get('/movements', () => {
  sessionValidator();

  indiceMovimientos = 0;

  let finalData = localStorage.getItem('admin-acape-session/data');

  if (!finalData) return `
    <br>
    <h1 class="text-center">Actualiza la página</h1>
    <p class="text-center">No se pudo cargar la información correctamente</p>
  `;

  let json_data = JSON.parse(finalData);
  let movements = json_data.movements;
  let movementsArray = converterArray(movements).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Guardamos los datos en una variable global temporal en JS
  window._cachedMovements = movementsArray;

  setTimeout(() => {
    cargarMas();
  }, 1000)

  return `
    <div class="container my-4">
      <h3 class="mb-4 text-center">Movimientos</h3>
      <p>Lista de movimientos, ingresos, egresos y transferencias.</p>

      <div class="row" id="fila-tarjetas">

      </div>

      <div class="text-center mt-4">
        <button id="btn-cargar-mas" class="btn btn-primary" onclick="cargarMas()">Cargar más</button>
      </div>
    </div>
  `;
});

router.get('/contabilidad', () => {
  return `

    <div class="container text-center">
      <h1 class="text-center">Contabilidad De Tu Negocio</h1>
      <p class="text-center">Maneja la contabilidad y movimientos en tus cuentas, registros de cajas y otros servicios que puedes encontrar aqui. ¿Buscas algo mas espesifico?</p>
      <br>
      <div class="container my-5">
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">

          <!-- Cuentas y Movimientos -->

          <!-- Informes -->
          <div class="col">
            <a href="#/contabilidad/informes" class="text-decoration-none text-dark">
              <div class="card h-100 shadow-sm border-0">
                <div class="card-body text-center">
                  <i class="bi bi-file-earmark-bar-graph fs-2 mb-2"></i>
                  <h5 class="card-title">Informes</h5>
                  <p class="card-text small text-muted">Informes financieros automatizados de cada periodo.</p>
                </div>
              </div>
            </a>
          </div>

          <!-- Balance de cuentas -->
          <div class="col">
            <a href="#/contabilidad/balance-cuentas" class="text-decoration-none text-dark">
              <div class="card h-100 shadow-sm border-0">
                <div class="card-body text-center">
                  <i class="bi bi-diagram-3 fs-2 mb-2"></i>
                  <h5 class="card-title">Balance de Cuentas</h5>
                  <p class="card-text small text-muted">Visualiza el estado general de todas las cuentas.</p>
                </div>
              </div>
            </a>
          </div>

          <!-- Registros de Cajas -->
          <div class="col">
            <a href="#/contabilidad/registros-cajas" class="text-decoration-none text-dark">
              <div class="card h-100 shadow-sm border-0">
                <div class="card-body text-center">
                  <i class="bi bi-box-seam fs-2 mb-2"></i>
                  <h5 class="card-title">Registros de Cajas</h5>
                  <p class="card-text small text-muted">Movimientos de efectivo y arqueo por cada caja.</p>
                </div>
              </div>
            </a>
          </div>


          <div class="col">
            <a href="#/contabilidad/promedium-cajas" class="text-decoration-none text-dark">
              <div class="card h-100 shadow-sm border-0">
                <div class="card-body text-center">
                  <i class="bi bi-box-seam fs-2 mb-2"></i>
                  <h5 class="card-title">Ventas Y Promedios</h5>
                  <p class="card-text small text-muted">Revisa Las Ventas Y Promedios.</p>
                </div>
              </div>
            </a>
          </div>

        </div>
      </div>


    </div>
    <br>


  `;
});


// ------------- CONTABILIDAD INFORMES --------------------------------------------

const submitInput = async (e) => {
  let dataServer = localStorage.getItem('admin-acape-session/data');
  if (!dataServer) return;

  let json_data = JSON.parse(dataServer);
  let data_server = json_data.accounting;

  let data_cajas_sub = await acape.post('/app/registros', {
    token: localStorage.getItem('admin-acape-session')
  });

  if (!data_cajas_sub.data.data) return;

  let data_cajas = data_cajas_sub.data.data;

  // Función para obtener fecha segura con fallback
  const getFechaSegura = (val, fallback) => new Date(val ? `${val}T00:00:00` : `${fallback}T00:00:00`);

  // Obtener fecha de hoy en formato YYYY-MM-DD
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  // Obtener valores de los inputs con fallback
  let inicio = getFechaSegura(e[0].value, "1900-01-01");
  let final = getFechaSegura(e[1].value, hoyStr);

  let finalData = { inicio, final };

  let finalArray = converterArray(data_server.movements);

  const datosFiltrados = finalArray.filter(d => {
    let fechaDato = new Date(d.date);
    let fechaDatoNormalizada = new Date(fechaDato.getFullYear(), fechaDato.getMonth(), fechaDato.getDate());
    let inicioNormalizado = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    let finalNormalizado = new Date(final.getFullYear(), final.getMonth(), final.getDate());

    return fechaDatoNormalizada >= inicioNormalizado && fechaDatoNormalizada <= finalNormalizado;
  });

  const finalDatosFiltrados = datosFiltrados.filter(d => !d.type.includes('Transferencia'));
  let contabilidad_movements = finalDatosFiltrados;

  let finalCajas = converterArray(data_cajas).filter(d => {
    let fechaDato = new Date(d.cerrada);
    let fechaDatoNormalizada = new Date(fechaDato.getFullYear(), fechaDato.getMonth(), fechaDato.getDate());
    let inicioNormalizado = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    let finalNormalizado = new Date(final.getFullYear(), final.getMonth(), final.getDate());

    return fechaDatoNormalizada >= inicioNormalizado && fechaDatoNormalizada <= finalNormalizado;
  });

  // -----------------------------------------------------------

  const movements = document.querySelector('.tbody-movements');
  let filter_movements_negatives = converterArray(contabilidad_movements).filter(ch => ch.sign == "-");
  let filter_movements_positives = converterArray(contabilidad_movements).filter(ch => ch.sign == "+");

  let suma_positives = 0;
  let suma_negatives = 0;
  let suma_movements = 0;

  converterArray(contabilidad_movements).map(ch => {
    suma_movements += Math.abs(ch.money);
    return `${ch.money}`;
  });
  filter_movements_negatives.map(ch => suma_negatives += ch.money)
  filter_movements_positives.map(ch => suma_positives += ch.money)

  let percentaje_positivies = (Math.abs(suma_positives) / suma_movements) * 100;
  let percentaje_negatives = (Math.abs(suma_negatives) / suma_movements) * 100;

  let final_movements = [...new Set(converterArray(contabilidad_movements).map(ch => ch.type))];

  document.querySelector('.information').innerHTML = `
    <h5>Dinero Actual: $ ${formatNumber(data_server.value)}</h5>
    <h5>Cantidad De Movimientos: ${converterArray(contabilidad_movements).length}</h5>
    <hr>
    <p><b>Dinero Gastado:</b> $ ${formatNumber(suma_negatives)} - <div class="decrease">${percentaje_negatives.toFixed(2)} %</div> ${filter_movements_negatives.length} Movimiento(s)</p><br>
    <p><b>Dinero Entrante:</b> $ ${formatNumber(suma_positives)} - <div class="increase">${percentaje_positivies.toFixed(2)} %</div> ${filter_movements_positives.length} Movimiento(s)</p>
    <br>
    <p><b>Total Recaudado:</b> ${formatNumber(suma_positives + suma_negatives)}</p>
  `;

  movements.innerHTML = contabilidad_movements.map(ch => `
    <tr>
      <td>${new Date(ch.date).toLocaleString()}</td>
      <td>${ch.type}</td>
      <td class="${ch.sign == "-" ? "text-danger" : "text-primary"}">${formatNumber(ch.money)}</td>
    </tr>
  `).join('');

  // SETTER CAJAS
  let entradas_cajas = 0;
  let salidas_cajas = 0;
  let totales_cajas = 0;
  let suma_movements_cajas = 0;

  finalCajas.map(ch => {
    totales_cajas += (ch.value - ch.starting);
    salidas_cajas += ch.egreso;
    entradas_cajas += ch.total_recibido;
  });

  document.querySelector('.information-cajas').innerHTML = `
    <div class="simple-cont">
      <p><b>Total De Ventas: </b> <span class="text-primary">${formatNumber(entradas_cajas)}</span></p>
      <p><b>Total En Gastos: </b> <span class="text-danger">${formatNumber(salidas_cajas)}</span></p>
      <p><b>Total Recaudado: </b> ${formatNumber(totales_cajas)}</p>
    </div>
  `;

  document.querySelector('.tbody-cajas').innerHTML = finalCajas.map(ch => `
    <tr>
      <td>${new Date(ch.cerrada).toLocaleString()}</td>
      <td>${formatNumber(ch.total_recibido)}</td>
      <td><span class="text-danger">${formatNumber(ch.egreso)}</span></td>
      <td>${formatNumber(ch.value - ch.starting)}</td>
    </tr>
  `).join('');

  return false;
};

router.get('/contabilidad/informes', () => {
  return `

    <br><br>
    <div class="container">
      <div class="text-center header-container">
        <h1>Contabilidad e Informes</h1>
        <p>Encuentra los datos, genera informes, y crea nuevas estrategias viendo la contabilidad de tu negocio.</p>
      </div>

      <form class="selected-form" onclick="return submitInput(this)">
        <label>Fecha de inicio</label>
        <input type="date" name="date-started" id="" class="form-control">

        <label for="">Fecha De Fin</label>
        <input type="date" name="date-end" id="" class="form-control">

        <br>
        <button type="submit" class="btn btn-primary">Generar Reporte</button>
      </form>

      <br><br>

      <div class="information"></div>

      <br><br>

      <div class="table">
          <table class="table-products">
              <thead>
                  <tr>
                      <th>Fecha</th>
                      <th>Descripcion</th>
                      <th>Monto</th>
                  </tr>
              </thead>
              <tbody class="tbody-movements">
              </tbody>
          </table>
      </div>

      <br><br>
      <h4>Informe de cajas</h4>
      <br>
      <div class="information-cajas">
        
      </div>
      <br>
      <div class="table">
        <table class="table-products">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ventas</th>
              <th>Gastos</th>
              <th>Entregado</th>
            </tr>
          </thead>
          <tbody class="tbody-cajas"></tbody>
        </table>
      </div>

    </div>

  `;
})


// ---------------------- CONTABILIDAD -----------------------------


// ---------------------- CONTABILIDAD -----------------------------

function formatearFechaCompleta(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true // Forzar AM/PM
  });
}


let indexCaja = 0;
const cantidadPorCarga = 5;

function cargarMasCajas() {
  let cajasStorage = localStorage.getItem('admin-acape-session/data/cajas');

  if(!cajasStorage) return;

  let cajas = [...converterArray(JSON.parse(cajasStorage))].reverse();

  const siguienteLote = cajas.slice(indexCaja, indexCaja + cantidadPorCarga);

  siguienteLote.forEach((item) => {
    const totalEgresos = item.egreso + item.value_egresos;
    const tarjeta = document.createElement("div");
    tarjeta.className = "col-12";
    tarjeta.innerHTML = `
      <div class="card shadow-sm border-start border-primary mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <div>
              <h6 class="fw-semibold mb-0">Cierre #${item.id}</h6>
              <small class="text-muted">${formatearFechaCompleta(item.cerrada)}</small><br>
              <small class="text-muted">Responsable: <strong>${item.closedByName}</strong></small>
            </div>
            <span class="badge bg-primary align-self-start">Caja Final: $${item.value.toLocaleString()}</span>
          </div>

          <hr class="my-2">

          <div class="d-flex justify-content-between small">
            <div>
              <div><strong>Inicio:</strong> $${item.starting.toLocaleString()}</div>
              <div><strong>Ingresos:</strong> $${item.ingreso.toLocaleString()}</div>
              <div><strong>Recibido:</strong> $${item.total_recibido.toLocaleString()}</div>
            </div>
            <div class="text-end">
              <div><strong>Egreso:</strong> $${item.egreso.toLocaleString()}</div>
              <div><strong>Ventas Eliminadas:</strong> $${(item.value_egresos ? item.value_egresos : 0).toLocaleString()}</div>
              <div><strong>Abierta:</strong> ${item.date ? formatearFechaCompleta(item.date) : "No hay fecha"}</div>
            </div>
          </div>

          <div class="text-end mt-3">
            <a href="#/registros/${item.id}" class="btn btn-sm btn-outline-secondary">
              <i class="fa-solid fa-link"></i> Ver detalles
            </a>
          </div>
        </div>
      </div>
    `;

    document.querySelector('.cierres-container').appendChild(tarjeta);
  });

  indexCaja += cantidadPorCarga;
  if (indexCaja >= cajas.length) {
    document.querySelector('#btn-cargar-mas-cajas').style.display = "none";
  }
}

router.get('/registros', async () => {
  sessionValidator();

  indexCaja = 0;

  let finalData = localStorage.getItem('admin-acape-session/data');

  if (!finalData) return `
    <br>
    <h1 class="text-center">Actualiza la página</h1>
    <p class="text-center">No se pudo cargar la información correctamente</p>
  `;

  let dataCajas = await acape.post('/app/registros', {token: localStorage.getItem('admin-acape-session')});


  let finalCajas = converterArray(dataCajas.data.data);
  localStorage.setItem('admin-acape-session/data/cajas', JSON.stringify(finalCajas));

  setTimeout(() => {
    cargarMasCajas();
  }, 1000)

  return `
    <div class="container">
      <h3 class="mb-4 text-center">Cierres de Caja</h3>
      <p class="text-muted">Resumen de cierres realizados y montos totales registrados.</p>

      <div class="cierres-container list-group mb-4">
        <!-- Aquí se cargan las cajas -->
      </div>

      <div class="text-center">
        <button id="btn-cargar-mas-cajas" onclick="cargarMasCajas()" class="btn btn-outline-primary">Cargar más</button>
      </div>
    </div>
  `;
});

function addDeudor(e) {
  popup.open({
    title: "Añadir Deudor",
    content: `
      <form onsubmit="return sendNewDeudor(this)">
        <label htmlFor="">Nombre Del Deudor</label>
        <input type="text" class="form-control" placeholder="EJem: Jhon Doe" required>
        <label htmlFor="">Deuda Inicial</label>
        <p>Deja el valor 0 si el deudor es nuevo</p>
        <input class="form-control numberify-input-commas" type="text" placeholder="0" value="0">
        <br>
        <button class="btn btn-outline-primary d-block w-100" ><i class="fa-solid fa-plus"></i>Crear Nuevo Deudor</button>
      </form>
    `
  })
}

function deleteDeudor(id) {
  let token = localStorage.getItem('admin-acape-session');

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
  let token = localStorage.getItem('admin-acape-session');
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
  })
}

function makePago(id) {
  let token = localStorage.getItem('admin-acape-session');
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
  })
}

function editDeudor(id) {
  socket.emit('getDeudores', { token: localStorage.getItem('admin-acape-session') });
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
  socket.emit('getDeudores', { token: localStorage.getItem('admin-acape-session') });

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
      deuda: removeCommaSeparators(e[1].value)
    },
    token: localStorage.getItem('admin-acape-session')
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

function setServicesSubmit(e) {
  e.preventDefault();

  let token = localStorage.getItem('admin-acape-session');

  let data = {
    time: e.target[0].value,
    mail: e.target[1].value
  }

  socket.emit('services/set', { token: token, services: data });

  socket.once('services/set', (data) => {
    if (!data.data) return Toast.fire({
      text: "No se pudo guardar la configuración",
      title: "Error En El Servidor",
      icon: "error"
    });

    alert.fire({
      title: "Servicios",
      text: "Se ha guardado correctamente la información",
      icon: "success"
    });
  })
};

function updateServices() {
  let token = localStorage.getItem('admin-acape-session');
  socket.emit('services/get', { token: token });

  socket.once('services/get', (data) => {
    if (!data.data) return Toast.fire({
      text: "Error al descargar la información",
      icon: "error"
    });

    document.querySelector('.set-data').innerHTML = `
      <form onsubmit="setServicesSubmit(event)">
        <h4>Recepción de Mails</h4>
        <p>Este servicio, entrega un reporte como mensaje de whatsapp una vez configurado el servicio de envios de whatsapp atravéz del bot CALLMEBOT servicio gratuito de envio de mensajes por la api de whatsapp.</p>
        <label htmlFor="">Hora de recepción</label>
        <p>Esta sera la hora en que el software te enviara el reporte del dia.</p>
        <input type="time" value="${data.data.time}" placeholder="Elige la hora de recepción de email" class="form-control">
        <br><br>
        <button class="btn btn-primary btn-block">Guardar Configuraciónes</button>
      </form>
    `;
  })
}

router.get('/services', () => {
  sessionValidator();

  updateServices()
  setTimeout(loadGrameraConfig, 0)

  return `
    <br><br><br>
    <div class="container-fluid">
      <h1 class="text-center">Servicios ACAPE</h1>
      <p>Activa nuestros servicios acape para lograr una mejor funcionalidad y rendimiento en tu negocio.</p>
    </div>
    <div class="container set-data">
      <b class="text-center">DESCARGANDO INFORMACION...</b>
    </div>
    <div class="container gramera-config my-4">
      <b class="text-center">CARGANDO GRAMERA...</b>
    </div>
  `;
})

// GRAMERA: CARGA LA INTERFAZ DE CONEXIÓN EN LA PÁGINA DE SERVICIOS
function loadGrameraConfig(intentos = 20) {
  let el = document.querySelector('.gramera-config');
  if (!el) {
    if (intentos > 0) setTimeout(() => loadGrameraConfig(intentos - 1), 50);
    return;
  }
  GrameraUI.iniciar(el);
}

router.get('/deudores', async () => {
  listingDeudores()

  return `
    <div class="container-fluid my-2">
      <h1 class="text-center">Deudores</h1>
      <p class="text-center">Registro de deudas, deudores y movimientos</p>
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
});


// REGISTROS ID
router.get('/registros/:id', async (header) => {
  let finalID = header.params.id;

  let finalToken = localStorage.getItem('admin-acape-session');

  if(!finalToken) return `Parece que el token es invalido, reinicia la pagina`;

  let finalCaja_acape = await acape.post(`/app/registros/${finalID}`, {token: finalToken});

  let finalCaja = finalCaja_acape.data.data;

  if(!finalCaja) {
    alert.fire({
      title: "Error de registros",
      text: "El registro ya no existe.",
      icon: "error"
    });

    return "";
  }

  let arrayIngresos = converterArray(finalCaja.ingresos?finalCaja.ingresos:{});
  let arrayEgresos = converterArray(finalCaja.egresos?finalCaja.egresos:{});
  let arrayVentasEliminadas = converterArray(finalCaja.ventas_eliminadas?finalCaja.ventas_eliminadas:{});
  let arrayVentas = converterArray(finalCaja.ventas_hechas?finalCaja.ventas_hechas:{});


  return `

    <div class="container my-4" id="detalle-caja">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3>Detalle del cierre #<span id="detalle-id">${finalCaja.id}</span></h3>
        <div>
          <button class="btn btn-outline-secondary btn-sm me-2" onclick="window.print()">
            <i class="fa-solid fa-print"></i> Imprimir
          </button>
          <button class="btn btn-outline-danger btn-sm">
            <i class="fa-solid fa-file-pdf"></i> Exportar PDF
          </button>
        </div>
      </div>

      <!-- Resumen general -->
      <div class="card mb-4">
        <div class="card-body" id="resumen-caja">
          <!-- Aquí va el resumen dinámico -->
          <div class="row">
            <div class="col-md-6">
              <p><strong>Responsable:</strong> ${finalCaja.closedByName}</p>
              <p><strong>Fecha de apertura:</strong> ${formatearFecha(finalCaja.date)}</p>
              <p><strong>Fecha de cierre:</strong> ${formatearFecha(finalCaja.cerrada)}</p>
              <p><strong>Duración:</strong> ${finalCaja.timeLapse}</p>
            </div>
            <div class="col-md-6">
              <p><strong>Inicio en caja:</strong> $${Number(finalCaja.starting).toLocaleString()}</p>
              <p><strong>Ingresos:</strong> $${Number(finalCaja.ingreso).toLocaleString()}</p>
              <p><strong>Recibido total:</strong> $${Number(finalCaja.total_recibido).toLocaleString()}</p>
              <p><strong>Egresos:</strong> $${Number(finalCaja.egreso).toLocaleString()}</p>
              <p><strong>Ventas eliminadas:</strong> $${Number(finalCaja.value_egresos || 0).toLocaleString()}</p>
              <p><strong>Caja final:</strong> <span class="fw-bold text-primary">$${Number(finalCaja.value).toLocaleString()}</span></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Ingresos registrados -->
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="mb-3">Ingresos registrados</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody id="tabla-ingresos">
                ${arrayIngresos.map(ch => `
                  <tr>
                    <td>${formatearFecha(ch.date)}</td>
                    <td>${ch.description}</td>
                    <td>${Number(ch.money).toLocaleString()}</td>
                    <td></td>
                  </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Egresos registrados -->
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="mb-3">Egresos registrados</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody id="tabla-egresos">

                ${arrayEgresos.map(ch => `
                  <tr>
                    <td>${formatearFecha(ch.date)}</td>
                    <td>${ch.description}</td>
                    <td>${Number(ch.money).toLocaleString()}</td>
                  </tr>
                  `).join('')}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ventas realizadas -->
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="mb-3">Ventas realizadas</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                  <th>Productos</th>
                </tr>
              </thead>
              <tbody id="tabla-ventas">
                ${arrayVentas.map(ch => {
                  let finalProducts = ch.venta?converterArray(ch.venta):[];

                  return `
                    <tr>
                      <td>${formatearFecha(ch.date)}</td>
                      <td>${ch.total_pago}</td>
                      <td>${ch.type}</td>
                      <td>${finalProducts.map(ch => `${ch.name} - ${Number(ch.price) * ch.cantidad}`).join('<br>')}</td>
                    </tr>
                    `;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ventas eliminadas -->
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="mb-3 text-danger">Ventas eliminadas</h5>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Productos</th>
                </tr>
              </thead>
              <tbody id="tabla-ventas-eliminadas">
                ${arrayVentasEliminadas.map(ch => {
                  let finalProducts = ch.products?converterArray(ch.products):[];

                  return `
                    <tr>
                      <td>${formatearFecha(ch.date)}</td>
                      <td>${ch.total_pago}</td>
                      <td>${ch.type}</td>
                      <td>${finalProducts.map(ch => `${ch.name} - ${Number(ch.precio_final) * ch.cantidad}`).join('<br>')}</td>
                    </tr>
                    `;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

  `;
});


// SEARCHINGHERE

function contabilidadPromedium(day){
  let sessionTokenGet = localStorage.getItem('admin-acape-session');

  socket.emit(`app/contabilidad/ventas/${day}`, {token: sessionTokenGet});

  const finalizingCharge = Swal.fire({
    title: 'Enviando reporte...',
    text: 'Por favor espera mientras generamos y enviamos el reporte.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  socket.once(`app/contabilidad/ventas/${day}`, (data) =>{
    finalizingCharge.close()
    if(!data.data) return alert.fire({
      title: "Error",
      text: "Parece que no hay permisos o no se puede acceder en este momento",
      icon: "error"
    });

    let arrayTopSellers = converterArray(data.data.topSellers);
    let arrayProducts = converterArray(data.data.products);

    let bestSeller = arrayTopSellers.sort((a, b) => b.ventas - a.ventas);
    let bestGaster = arrayTopSellers.sort((a, b) => b.egreso - a.egreso);
    let bestProductChantity = arrayProducts.sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    let bestProductPrice = arrayProducts.sort((a, b) => b.recogido - a.recogido).slice(0, 10);

    console.log(bestProductPrice)

    let promedium = {
      ventas: 0,
      gastos: 0,
      total_entregado: 0,
      bestSeller,
      bestProductChantity,
      bestProductPrice
    }

    switch(day){
      case "diarias":
        promedium.ventas = Number(data.data.ventas / 7).toFixed(2);
        promedium.egresos = Number(data.data.egresos / 7).toFixed(2);
        promedium.total_entregado = Number(data.data.ventas / 7) - Math.floor(data.data.egresos / 7).toFixed(2);
        break;
      case "semanales":
        promedium.ventas = Number(data.data.ventas / 30).toFixed(2);
        promedium.egresos = Number(data.data.egresos / 30).toFixed(2);
        promedium.total_entregado = Number(data.data.ventas / 30).toFixed(2) - Number(data.data.egresos / 30).toFixed(2);
        break;
      case "quincenales":
        promedium.ventas = Number(data.data.ventas / 15).toFixed(2);
        promedium.egresos = Number(data.data.egresos / 15).toFixed(2);
        promedium.total_entregado = Number(data.data.ventas / 15).toFixed(2) - Number(data.data.egresos / 15).toFixed(2);
      case "mensuales":
        promedium.ventas = Number(data.data.ventas / 90).toFixed(2);
        promedium.egresos = Number(data.data.egresos / 90).toFixed(2);
        promedium.total_entregado = Number(data.data.ventas / 90).toFixed(2) - Number(data.data.egresos / 90).toFixed(2);
        break;
      case "todas":
        promedium.ventas = Number(data.data.ventas).toFixed(2);
        promedium.egresos = Number(data.data.egresos).toFixed(2);
        promedium.total_entregado = Number(data.data.ventas).toFixed(2) - Number(data.data.egresos).toFixed(2);
        break;
    }


    document.querySelector('.container-promedium').innerHTML = `
      <h3 class="text-center mt-2">Promedios</h3>
      <p>
        <h4>Datos</h4>
        <p><b>Ventas: </b> ${formatNumber(data.data.ventas)}</p>\n
        <p><b>Gastos: </b> ${formatNumber(data.data.egresos)}</p>
        <p><b>Total Entregado: </b> ${formatNumber(Number(data.data.ventas).toFixed(2) - Number(data.data.egresos).toFixed(2))}</p>
      </p>
      <hr>
      <p class="mt-2">
        <h4>Datos Promediales</h4>
        <p><b>Ventas: </b> ${formatNumber(promedium.ventas)}</p>\n
        <p><b>Gastos: </b> ${formatNumber(promedium.egresos)}</p>
        <p><b>Total Entregado: </b> ${formatNumber(promedium.total_entregado)}</p>
      </p>
      <hr>
      <h4>Mejor Vendedor</h4>
      <table>
        <thead>
          <tr>
            <th>Responsable</th>
            <th>Ventas</th>
          </tr>
        </thead>
        <tbody id="topSellersTable">
          ${bestSeller.map(ch => `
            <tr>
              <td>${ch.closedBy}</td>
              <td>$ ${formatNumber(ch.ventas)}</td>
            </tr>
            `).join('')}
        </tbody>
      </table>

      <hr>
      <h4>Vendedor Con Mas Gastos</h4>
      <table>
          <thead>
          <tr>
            <th>Responsable</th>
            <th>Gastos</th>
          </tr>
        </thead>
        <tbody id="topSellersTable">
          ${bestGaster.map(ch => `
            <tr>
              <td>${ch.closedBy}</td>
              <td>$ ${formatNumber(ch.egreso)}</td>
            </tr>
            `).join('')}
        </tbody>
      </table>

      <hr>

      <h4>Top 10 Productos Vendidos Este Periodo</h4>
      <table>
          <thead>
          <tr>
            <th>Productos</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody id="topSellersTable">
          ${bestProductChantity.map(ch => `
            <tr>
              <td>${ch.name}</td>
              <td>${ch.cantidad}</td>
            </tr>
            `).join('')}
        </tbody>
      </table>

      <hr>

      <h4>Top 10 Productos Con Mas Recaudo Este Periodo</h4>
      <table>
          <thead>
          <tr>
            <th>Productos</th>
            <th>Dinero Recogido</th>
          </tr>
        </thead>
        <tbody id="topSellersTable">
          ${bestProductPrice.map(ch => `
            <tr>
              <td>${ch.name}</td>
              <td>${formatNumber(ch.recogido)}</td>
            </tr>
            `).join('')}
        </tbody>
      </table>

    `;
  });
}

// PAGINAS DE CONTABILIDAD
router.get('/contabilidad/promedium-cajas', () => {
  return `
    <div class="header-container container">
      <div class="text-center">
        <h1>Promedio De Ventas Y De Cajas</h1>
        <p>Compara las ventas Diarias, Semanales, Quincenales, Mensuales</p>
        <div class="buttons-container">
          <button class="btn btn-outline-primary" onclick="contabilidadPromedium('diarias')">P. Diario</button>
          <button class="btn btn-outline-secondary" onclick="contabilidadPromedium('semanales')">P. Semanal</button>
          <button class="btn btn-outline-info" onclick="contabilidadPromedium('quincenales')">P. Quincenales</button>
          <button class="btn btn-outline-warning" onclick="contabilidadPromedium('mensuales')">P. Mensual</button>
          <button class="btn btn-outline-danger" onclick="contabilidadPromedium('todas')">P. De Siempre</button>
        </div>
      </div>


      <div class="container-promedium"></div>
    </div>
  `;
})

router.get('/proveedores', () => {

});

router.get('/registros-bodega', () => {

})

router.get('/configs', () => {
  return ``;
})

// USUARIO INVALIDO
router.get('/invalid-user', () => {
  setTimeout(() => {
    location.hash = "#/"
  }, 2000)
  return `<div class="center-center center-full">La sesion de usuario es invalida</div>`;
})


// FUNCIONES DE PRESUPUESTOS
async function cargarPresupuestoActivo(){
  let session = localStorage.getItem('admin-acape-session');

  const finalPresupuesto = await axios.post('/app/presupuestos/get', {token: session});

  const finalResponse = finalPresupuesto.data?finalPresupuesto.data:{};

  if(!finalResponse.data) return alert.fire({
    title: "Error",
    icon: "error",
    text: finalResponse.message
  });

  let finalData = finalResponse.data;

  let finalArrayPagos = converterArray(finalData.pagos?finalData.pagos:{});

  document.querySelector('.presupuesto-activo').innerHTML = `
      <form class="form-presupuestos">
        <div class="mb-3">
          <label for="tituloPresupuesto" class="form-label">Título</label>
          <input type="text" value="${finalData.name?finalData.name:""}" class="form-control" name="name" id="tituloPresupuesto" placeholder="Ej: Presupuesto Abril">
        </div>

        <div class="mb-4">
          <label for="descripcionPresupuesto" name="description" class="form-label">Descripción</label>
          <textarea name="description" class="form-control" id="descripcionPresupuesto" rows="2" placeholder="Breve descripción del presupuesto...">${finalData.description?finalData.description:""}</textarea>
        </div>

        <div id="gastosContainer" class="vstack gap-2">
          <!-- Aquí se insertarán los inputs dinámicos -->
        </div>

        <br><br>

        <button type="button" class="btn btn-outline-primary w-100 my-3" onclick="agregarGasto()">➕ Agregar Otro Gasto</button>

        <hr>

        <button type="submit" class="btn btn-success w-100">💾 Guardar Presupuesto</button>

        <hr>

        <h4>Finaliza tu presupuesto</h4>
        <p>Con el boton de abajo puedes finalizar el presupuesto, si tienes el whatsapp bien configurado, te llegara una notificacion del final de rendimiento.</p>
        <button class="button" class="btn btn-outline-danger">Finalizar Presupuesto</button>
      </form>
  `;

  finalArrayPagos.map(ch => agregarGasto(ch.description, ch.valor, ch.type, ch.tachado))
}

function eliminarGasto(boton) {
  const grupo = boton.parentElement;
  grupo.remove();
}

function agregarGasto(description = "", valor = 0, type = undefined, tachado = false) {
  const container = document.getElementById('gastosContainer');

  const inputGroup = document.createElement('div');
  inputGroup.className = 'input-group';

  inputGroup.innerHTML = `
    <input type="text" value="${description}" name="description" class="form-control" placeholder="Descripción del gasto">
    <input type="text" name="valor" value="${formatNumber(valor)}" class="form-control numberify-input-commas" placeholder="$ Valor">
    <select class="form-select" name="type">
      <option disabled ${!type ? 'selected' : ''}>Tipo</option>
      <option value="Variable" ${type === 'Variable' ? 'selected' : ''}>Variable</option>
      <option value="Fijo" ${type === 'Fijo' ? 'selected' : ''}>Fijo</option>
    </select>
    <input type="hidden" name="tachado[]" value="${tachado === "true" || tachado === true ? 'true' : 'false'}">
    <button class="btn btn-outline-danger" type="button" onclick="eliminarGasto(this)">🗑️</button>
    <button class="btn btn-outline-secondary" type="button" onclick="alternarTachado(this)">✅</button>
  `;

  // Si está tachado, aplicamos el estilo directamente
  if (tachado === "true" || tachado === true) {
    inputGroup.classList.add('text-decoration-line-through');
    const btn = inputGroup.querySelector('.btn-outline-secondary');
    btn.innerText = '🚫';
  }

  container.appendChild(inputGroup);
}


function alternarTachado(boton) {
  const grupo = boton.parentElement;
  const descripcion = grupo.querySelector('.descripcion');
  const valor = grupo.querySelector('.valor');
  const tipo = grupo.querySelector('.tipo');
  const hiddenInput = grupo.querySelector('input[type="hidden"]');

  const tachado = grupo.classList.toggle('text-decoration-line-through');

  hiddenInput.value = tachado ? 'true' : 'false';

  // Cambiar botón visual
  boton.innerText = tachado ? '🚫' : '✅';
}

router.get('/presupuestos', async () => {
  cargarPresupuestoActivo()

  return `<div class="my-2">
    <div class="container">
      <h1 class="text-center">Presupuestos</h1>
      <p>Genera un informe de presupuesto: Aqui puedes lograr genera una meta de pago, ir tachando a conforme se paga cada cosa, y ir viendo la rentabilidad de tu negocio, Empieza generando un reporte con dinero inicial, los pagos a realizar y ver cada movimiento que se genere a partir de la fecha dada.</p>
      <div class="presupuesto-activo"></div>
    </div>
  </div>`;
});

// FUNCIONES ZOPELAPP
function updatePrincipal(exist){
  const dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  const principal = document.querySelector('.data-principal');
  if(!dataProduction[0] && principal){
    principal.innerHTML = "No Hay Producción Agregada";
  }

  let finalGastos = 0;
  let recibidoVentas = 0;

  const finalRetorn = dataProduction.map(ch => {
    const superArray = converterArray(ch.formula.products);
    const bodega = localStorage.getItem('acape-products')?JSON.parse(localStorage.getItem('acape-products')):{};

    let finalSumaProducts = 0;
    const supBodega = converterArray(bodega);

    superArray.forEach((element, i, array) => {
      let superfinding = supBodega.find(ch => ch.id == element.id);
      if(!superfinding) return;

      let superdit = ((superfinding.costo_adquisitivo?superfinding.costo_adquisitivo:0) / (superfinding.pesaje?superfinding.pesaje:1)) * element.gramaje;
      finalSumaProducts = finalSumaProducts + superdit;
    })

    finalGastos = finalGastos + (finalSumaProducts * ch.cantidad);

    let arrayProductionVenting = converterArray(ch.production?ch.production:{});
    arrayProductionVenting.forEach((element, i, array) => {
      recibidoVentas = recibidoVentas + (element.cantidad * Number(element.ventaFinal));
    })

    return `
      <div class="card">
        <div class="card-header">${ch.formula.name}</div>
        <div class="card-body">
          <b>Costo de la formula: </b> ${formatNumber(finalSumaProducts)} x ${ch.cantidad} = ${formatNumber(finalSumaProducts * ch.cantidad)}
          <br><br>
          <div class="simplified">
            ${ch.production?converterArray(ch.production).map(ch2 => `${ch2.name} > ${ch2.cantidad} UND x ${formatNumber(ch2.ventaFinal)} $ = ${formatNumber(ch2.cantidad*ch2.ventaFinal)} $`).join('<br>'):"No Hay Productos De Ventas"}
          </div>
          <br><br>
          <button class="btn btn-danger" onclick="deleteThisProduction('${ch.formula.id}')">Eliminar</button>
          <button class="btn btn-info" onclick="addVentsProduction('${ch.formula.id}')">Venta de producción</button>
        </div>
      </div>
    `;
  }).join('<br>');


  let simpleRetorn = `
    <b>Gastos Finales: ${formatNumber(finalGastos)}</b><br>
    <b>Dinero Por Venta: ${formatNumber(recibidoVentas)}</b>
    <br><br>
  ` + finalRetorn;

  if(!exist){
    principal.innerHTML = simpleRetorn;
  }
  return simpleRetorn;
}

function deleteThisProduction(id){
  let dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  dataProduction.forEach((element, i, array) => {
    if(element.formula.id == id){
      array.splice(i, 1);

      localStorage.setItem('zopelapp/production', JSON.stringify(array));
      updatePrincipal();
    }    
  })
}

function deleteItProductinVent(id_producting, id_parent){
  let dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  let findingFormula = dataProduction.find(ch => ch.formula.id == id_parent);

  if(!findingFormula) return Toast.fire({
    text: "Parece que este producto ya fue eliminado",
    icon: "error"
  });

  findingFormula.production = findingFormula.production?findingFormula.production:{};
  let arrayProducting = findingFormula.production;
  let validate = arrayProducting[id_producting];

  if(!validate) return Toast.fire({
    text: "No existe este producto de la lista",
    icon: "error"
  });

  delete arrayProducting[id_producting];
  findingFormula.production = arrayProducting;

  dataProduction.forEach((element, i, array) => {
    if(element.formula.id == id_parent){
      array[i] = findingFormula;

      localStorage.setItem('zopelapp/production', JSON.stringify(array));

      updatingListProductsVents(id_parent)
    }
  })
}

function updatingListProductsVents(id, html){
  let dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  let findingFormula = dataProduction.find(ch => ch.formula.id == id);

  if(!findingFormula) return Toast.fire({
    text: "Parece que este registro de producción ya fue eliminado",
    icon: "error"
  });

  let arrayProducting = converterArray(findingFormula.production?findingFormula.production:{});

  let finalToRetorn = arrayProducting.map(ch => `
    <div class="card">
      <div class="card-body">
        <b>${ch.name}: </b>${ch.gramaje} G x ${ch.cantidad} UNDs = ${formatNumber(ch.gramaje * ch.cantidad)} Gramaje <button class="btn btn-secondary" onclick="deleteItProductinVent('${ch.id}', '${id}')"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
  `);

  if(!html){
    document.querySelector('.settings-products').innerHTML = finalToRetorn;
  }

  updatePrincipal();

  return finalToRetorn;
}

function addingVentingProduction(e, id){
  e.preventDefault();

  let dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  let findingFormula = dataProduction.find(ch => ch.formula.id == id);

  if(!findingFormula) return Toast.fire({
    text: "Parece que este registro de producción ya fue eliminado",
    icon: "error"
  });

  const dataPr= {
    name: e.target[0].value,
    cantidad: e.target[1].value,
    gramaje: e.target[2].value,
    final: Number(e.target[1].value) * Number(e.target[2].value),
    ventaFinal: e.target[3].value,
    id: new Date()-0
  };

  findingFormula.production = findingFormula.production?findingFormula.production:{};

  findingFormula.production[dataPr.id] = dataPr;

  dataProduction.forEach((element, i, array) => {
    if(element.formula.id == findingFormula.formula.id){
      array[i] = findingFormula;

      localStorage.setItem('zopelapp/production', JSON.stringify(array));
      updatingListProductsVents(id);
      Toast.fire({
        text: "Producto Agregado A La Venta"
      })
    }
  })
}

function addVentsProduction(id){
  let dataProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

  let findingFormula = dataProduction.find(ch => ch.formula.id == id);

  if(!findingFormula) return Toast.fire({
    text: "Parece que este registro de producción ya fue eliminado",
    icon: "error"
  });

  let sumaGramaje = 0;

  converterArray(findingFormula.formula.products).map(ch => {
    sumaGramaje = sumaGramaje + Number(ch.gramaje);
  })

  popup.open({
    title: "Añadir Ventas A Esta Producción",
    content: `
      <form action="" onsubmit="addingVentingProduction(event, '${id}')">
        <label htmlFor="">Total Gramaje Usado: ${formatNumber(sumaGramaje * findingFormula.cantidad)} - ${formatNumber((sumaGramaje/1000) * findingFormula.cantidad)} KG</label>
        <br>
        <label>Agregar Un Nuevo Producto</label>
        <input type="text" class="form-control" required placeholder="Nombre del producto: Pan de queso sencillo">
        <label htmlFor="">Cantidad</label>
        <input type="number" class="form-control" required placeholder="Cantidad de Producto">
        <label htmlFor="">Gramaje por unidad</label>
        <input type="number" class="form-control" required placeholder="Gramaje de producto">
        <label htmlFor="">Precio de venta</label>
        <input type="number" class="form-control" placeholder="Precio: 400 x unidad">
        <br>
        <button class="btn btn-primary btn-block">Agregar Producto</button>
        <hr>
      </form>
      <div class="settings-products">${updatingListProductsVents(id, 'html')}</div>
    `
  })
}

function addingProduction(e){
  const data = e.target.value;
  if(data == "null") return;

  let formulas = JSON.parse(localStorage.getItem('zopelapp/formulas')?localStorage.getItem('zopelapp/formulas'):[]);

  let findingFormula = formulas.find(ch => ch.id == data);

  let productions = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];
  let findingProductionSet = productions.find(ch => ch.formula.id == data);

  if(findingProductionSet) return Toast.fire({
    text: "Esta formula ya se encuentra agregada a la lista, eliminala y vuelve a agregar si tuviste algún error",
    icon: "info"
  });

  if(!findingFormula) return Toast.fire({
    text: "Esta formula no se encuentra disponible, actualiza la pagina",
    icon: "error"
  });

  alert.fire({
    title: "Agregando Producción",
    input: "number",
    inputAttributes: {
      placeholder: "Agrega el numero de formulas o por partes 0.5 etc",
      step: "0.01"
    }
  }).then((result) => {
    if(result.isConfirmed) {
      const finalToSave = {
        cantidad: result.value,
        formula: findingFormula
      }

      const zopelappProduction = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];

      zopelappProduction.push(finalToSave);

      localStorage.setItem('zopelapp/production', JSON.stringify(zopelappProduction));

      updatePrincipal();
      Toast.fire({
        title: "Producción Agregada",
        text: "Puedes editar tu producción y marcar ventas con esta formula",
        icon: "success"
      })
    }
  })

  return data;
}

// SUBMIT FORMS 
function addProduction(){
  const dataBodega = localStorage.getItem('zopelapp/formulas');
  const bodegaArray = JSON.parse(dataBodega?dataBodega:"[]");

  popup.open({
    title: "Agregar Producción Del Dia",
    content: `
      <form action="" onchange="addingProduction(event)">
        <label htmlFor="">Elige la formula que vas a usar</label>
        <select class="form-select">
          <option value="null">Seleccione Un Producto</option>
          ${bodegaArray.map(ch => `
            <option value="${ch.id}">${ch.name}</option>
          `)}
        </select>
      </form>
    `
  })
}

function addVenta(){
  popup.open({
    title: "Agregar Venta De Producción",
    content: `
      <p>Aqui pones la venta que sale de la producción es decir los productos finales que vendes</p>
    `
  })
}

function activeChecking(event, ingreso, costo){
  let data = {
    active: event.target.checked,
    id: event.target.id.slice(3)
  };
  let simplifiedData = localStorage.getItem('zopelapp/indirectos')?JSON.parse(localStorage.getItem('zopelapp/indirectos')):[];

  simplifiedData.forEach((element, i, array) => {
    if(element.id == data.id){
      array[i].active = data.active;

      localStorage.setItem('zopelapp/indirectos', JSON.stringify(array));
      finallyRegister();
    }
  })
}

function eliminarLocalStoragePorPrefijo(prefijo) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        let key = localStorage.key(i);
        if (key.startsWith(prefijo)) {
            localStorage.removeItem(key);
        }
    }
}

function saveRegister(data){
  let pupilas = localStorage.getItem('zopelapp/costos')?JSON.parse(localStorage.getItem('zopelapp/costos')):null;

  if(!pupilas) return Toast.fire({
    title: "Parece que el registro a guardar no se ha guardado correctamente, intenta de nuevo",
    icon: "info"
  });

  socket.emit('zopelapp/registros/save', {registro: pupilas, user: dataSession});

  socket.once('zopelapp/registros/save', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });
      
    eliminarLocalStoragePorPrefijo('zopelapp'); 
    alert.fire({
      title: "Registro Guardado",
      icon: "success",
      text: data.message
    });
    imprimirFactura();
  })
}

/* ----------------------------- EDITING ------------------------------------ */

function finallyRegister(){
  const production = localStorage.getItem('zopelapp/production')?JSON.parse(localStorage.getItem('zopelapp/production')):[];
  const indirectos = localStorage.getItem('zopelapp/indirectos')?JSON.parse(localStorage.getItem('zopelapp/indirectos')):[];
  const bodega = converterArray(localStorage.getItem('acape-products')?JSON.parse(localStorage.getItem('acape-products')):[]);

  const costos = {
    formulas: [],
    gastosIndirectos: [],
    gastosFinales: 0,
    notas: [],
    gastosIndirectosActivos: []
  };

  production.forEach((element, i, array) => {
    let productsToCostos = [];
    let superify;

    const products = converterArray(element.formula.products);

    const finalFormula = {
      name: element.formula.name,
      description: element.formula.description,
      cantidad: element.cantidad,
      products: [],
      production: [],
      costoGramajeFormula: 0,
      totalGramos: 0,
    };

    let simplifiedProduction = converterArray(element.production?element.production:{});
    

    products.forEach((ele1, i2, array2) => {
      let findingProduct = bodega.find(ch => ch.id == ele1.id);

      if(!findingProduct) return costos.notas.push(`No se encontro el producto con ID #${ele1.id}`);

      let pricingUnd = ((findingProduct.costo_adquisitivo?findingProduct.costo_adquisitivo:0) / (findingProduct.pesaje?findingProduct.pesaje:1)) * ele1.gramaje;
      finalFormula.products.push({
        pricingUnd: pricingUnd,
        pricingByGramo: (findingProduct.costo_adquisitivo?findingProduct.costo_adquisitivo:0) / (findingProduct.pesaje?findingProduct.pesaje:1),
        name: findingProduct.product,
        pricingByUnity: findingProduct.price,
        gramajeUsado: ele1.gramaje
      });

      finalFormula.totalGramos = finalFormula.totalGramos + Number(ele1.gramaje);
      finalFormula.costoGramajeFormula = finalFormula.costoGramajeFormula + pricingUnd;
    })

    finalFormula.gramajeValue = finalFormula.costoGramajeFormula / finalFormula.totalGramos;

    simplifiedProduction.forEach((ele2, i3, array3) => {
      finalFormula.production.push({
        name: ele2.name,
        gramajeUsado: Number(ele2.cantidad) * Number(ele2.gramaje),
        precioGramajeUnitario: finalFormula.gramajeValue,
        gramaje: Number(ele2.gramaje),
        precioDeVentaUnitario: Number(ele2.ventaFinal),
        cantidad: Number(ele2.cantidad)
      })
    })

    costos.formulas.push(finalFormula)
    costos.gastosIndirectos = indirectos;
  })

  let finalPrice = {
    costo: 0,
    ingreso: 0
  }

  let formulating = costos.formulas.map(ch => {
    finalPrice.costo = finalPrice.costo + (ch.costoGramajeFormula * ch.cantidad);

    return `
      <b>${ch.name}</b> - <span>${ch.cantidad} formulas</span>
      <br>
      <b>Costo de la formula: </b> ${formatNumber(ch.costoGramajeFormula)} $ x ${ch.cantidad} =
      <b>${formatNumber(ch.costoGramajeFormula * ch.cantidad)} $</b>
      <br>
      <b>Precio de 1 gramo de formula: </b>${ch.gramajeValue.toFixed(2)}
      <ul>
        ${ch.production.map(ch => {
            finalPrice.ingreso = finalPrice.ingreso + Number((ch.precioDeVentaUnitario * ch.cantidad));

            return`
              <li>
                <span>${ch.name} - ${formatNumber((ch.gramaje * ch.precioGramajeUnitario).toFixed(0))} x UND</span>
                <ul>
                  <li>Venta Final: ${ch.precioDeVentaUnitario} x ${ch.cantidad} = ${formatNumber(ch.precioDeVentaUnitario * ch.cantidad)}</li>
                  <li>Gasto Final: ${formatNumber(((ch.gramaje * ch.precioGramajeUnitario) * ch.cantidad).toFixed(0))}</li>
                  <li>Total Ganancia: ${formatNumber((ch.precioDeVentaUnitario * ch.cantidad) - ((ch.gramaje * ch.precioGramajeUnitario) * ch.cantidad).toFixed(0))}</li>
                </ul>
              </li>
            `
          }
        )}
      </ul>
    `;
  }
  ).join('<hr>')

  let totallyIndirectos = 0;

  popup.open({
    title: "Registro final",
    content: `
      <div class="final-to-print">
        <h5 class="text-center">Registro final</h5>
        <p class="text-center">Aqui esta el registro final</p>
        <hr>
        <div class="formulas-principales">
          ${formulating}
        </div>
        <br>
        <b>Gastos Finales: </b>${formatNumber(finalPrice.costo)}<br>
        <b>Dinero Por Ventas: </b>${formatNumber(finalPrice.ingreso)}
        <hr>
        <b>Total Final: ${formatNumber(finalPrice.ingreso - finalPrice.costo)}</b>
        <br><br>
        <b></b>
        ${indirectos.map(ch => {
          if(ch.active == true) totallyIndirectos = totallyIndirectos + Number((ch.costo/ch.daycounter).toFixed());
          return `
            <div class="form-check form-switch">
              <input class="form-check-input" ${ch.active==true?"checked":""} onchange="activeChecking(event, '${finalPrice.ingreso}', '${finalPrice.costo}')" id="id-${ch.id}" type="checkbox" role="switch" id="flexSwitchCheckDefault">
              <label class="form-check-label" for="flexSwitchCheckDefault">${ch.name} - ${formatNumber((Number(ch.costo)/Number(ch.daycounter)).toFixed(0))}</label>
            </div>
          `
        }).join('')}
        <br>
        <b>Total De Gastos Indirectos: ${formatNumber(totallyIndirectos)}</b>
        <hr>
        <b>Total NETO: ${formatNumber((finalPrice.ingreso - finalPrice.costo) - totallyIndirectos)}</b>
        <br><br>
        <button class="btn btn-primary btn-block" onclick="saveRegister()">Guardar Registro</button>
      </div>
    `
  })

  costos.finalPrice = finalPrice;
  costos.finalPrice.totallyIndirectos = totallyIndirectos;
  costos.production = production;
  costos.indirectos = indirectos;

  console.log(totallyIndirectos)

  localStorage.setItem('zopelapp/costos', JSON.stringify(costos));
};

/* ----------------------------- EDITING ------------------------------------ */

function imprimirFactura() {
  let element = document.querySelector('.final-to-print');
  document.querySelector('body').innerHTML = `
    <div class="factura-termica">
      ${element.innerHTML}
    </div>
  `;
  window.print();

  setTimeout(() => {
    location.reload()
  }, 1000)
}

function formatearFecha(timestamp) {
    // Crear un objeto Date con el timestamp dado
    const fecha = new Date(timestamp);

    // Obtener el día de la semana en español
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diaSemana = diasSemana[fecha.getDay()];

    // Obtener el día del mes
    const diaMes = fecha.getDate();

    // Obtener el mes en español
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mes = meses[fecha.getMonth()];

    // Obtener el año
    const año = fecha.getFullYear();

    // Formatear la fecha
    return `${diaSemana} ${diaMes} de ${mes} del ${año}`;
}

function viewRegistro(id){
  const usering = {
    user: localStorage.getItem('admin-acape-session')
  };

  socket.emit('zopelapp/registros/get', {id: id, user: usering});

  socket.once('zopelapp/registros/get', (data) => {
    if(!data.data) return alert.fire({
      title: "Error",
      text: data.message,
      icon: "error"
    });

    let finalData = data.data;
  })
}

function deleteRegistro(id){
  const usering = {
    user: localStorage.getItem('admin-acape-session')
  };

  alert.fire({
    title: "¿Estas Seguro De Eliminar Este Registro?",
    text: `Estas a punto de eliminar el registro #${id}, no hay reversion ni vuelta atras una vez eliminado.`,
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    icon: "warning"
  }).then((result) => {
    if(result.isConfirmed){
      socket.emit('zopelapp/registros/delete', {id: id, user: usering.user});

      socket.once('zopelapp/registros/delete', (data) => {
        if(!data.data) return alert.fire({
          title: "Error",
          description: data.message,
          icon: "error"
        });

        alert.fire({
          title: "Registro eliminado satisfactoriamente",
          text: data.message,
          icon: "success"
        });

        getRegistros();
      })
    }
  })
}

function getRegistros(){

  const usering = {
    user: localStorage.getItem('admin-acape-session')
  };

  socket.emit('zopelapp/registros/all', usering);

  socket.once('zopelapp/registros/all', (data) => {
    if(!data) return Toast.fire({
      title: "Error de descarga",
      text: data.message,
      icon: "error"
    });

    let finalRegistros = converterArray(data.data);

    document.querySelector('.container-production').innerHTML = `${finalRegistros.map(ch => `<div class="card">
        <div class="card-body">
          <p>#${ch.id} -> ${formatearFecha(ch.date)}</p>
          <p><b>Total De Venta: </b> ${formatNumber(ch.data.finalPrice.ingreso)}</p>
          <p><b>Total De Gastos De Producción: </b> -${formatNumber(ch.data.finalPrice.costo)}</p>
          <p><b>Total De Gastos Indirectos: </b>${formatNumber(ch.data.finalPrice.totallyIndirectos)}</p>
          <hr>
          <b>TOTAL NETO: ${formatNumber(ch.data.finalPrice.ingreso - ch.data.finalPrice.costo - ch.data.finalPrice.totallyIndirectos)}</b>
        </div>
        <div class="card-footer">
          <!-- <button class="btn btn-primary" onclick="viewRegistro('${ch.id}')">Ver Registro</button>
          <button class="btn btn-info">Editar</button> -->
          <button class="btn btn-danger" onclick="deleteRegistro('${ch.id}')">Eliminar</button>
        </div>
      </div>`)}`;
  })
}

function submitProductToBodega(e){
  let data = {
    name: e[0].value,
    gramaje: e[1].value,
    cantidad: e[2].value,
    price: e[3].value
  }

  socket.emit('bodega/products/createProduct', {
    product: data,
    user: localStorage.getItem('admin-acape-session')
  });

  socket.once('bodega/products/createProduct', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });
    popup.start();
    updateBodega();

    Toast.fire({
      text: "Producto Agregado A La Bodega Satisfactoriamente",
      icon: "success"
    })
  })

  return false;
}

function inputProducts(e){
  const filtering = document.querySelector('.input-products');
  if(!filtering) return Toast.fire({
    text: "Fallo en el aplicativo",
    icon: "error"
  });

  let bodega = JSON.parse(localStorage.getItem('acape-products'));
  let bodegaArray = converterArray(bodega);

  let filterProducts = bodegaArray.filter(ch => ch.product.toLowerCase().includes(e.value.toLowerCase()))

  filtering.innerHTML = filterProducts.map(ch => `
    <div class="card p-1 text-center cursor-pointer">
      ${ch.id} - ${ch.product}
    </div>
  `)
}

function addToListProduct(e, id){
  let listProducts = localStorage.getItem('zopelapp/list-products');
  let renoving = listProducts?JSON.parse(listProducts):[];

  let dataInput = {
    price: e[0].value,
    cantidad: e[1].value,
    gramaje: e[2].value,
    product: e[3].value,
    id: id
  }

  renoving.push(dataInput);

  localStorage.setItem('zopelapp/list-products', JSON.stringify(renoving));
  bodegaIngreso();

  Toast.fire({
    icon: "info",
    text: "Producto agregado a la lista."
  })

  return false;
}


function listarProduct(id){
  let products = JSON.parse(localStorage.getItem('acape-products'));
  let findingProduct = products[id];
  if(!findingProduct) return alert.fire({
    title: "Error",
    text: "Parece que este producto no fue encontrado, actualiza la pagina",
    icon: "info"
  });

  popup.open({
    title: `Ingresando ${findingProduct.product}`,
    content: `<form onsubmit="return addToListProduct(this, '${id}')">
      <label htmlFor="">Precio de entrada</label>
      <p>Si el precio a cambiado cambia el precio aqui.</p>
      <input type="number" required value="${findingProduct.price}" class="form-control" placeholder="Ejem: 150000">
      <label htmlFor="">Cantidad de entrada</label>
      <p>Solamente la cantidad nueva que entra</p>
      <input type="number" required value="0" class="form-control" placeholder="Ejem: 10 - UND">
      <label htmlFor="">Gramaje</label>
      <p>Editar esta opción en caso de que el gramaje haya subido o bajado.</p>
      <input type="number" class="form-control" placeholder="Agrega el nuevo gramaje" value="${findingProduct.pesaje}">
      <input type="hidden" class="form-control" value="${findingProduct.product}">
      <br>
      <button class="btn btn-primary btn-block">Listar</button>
    </form>`,
    closeButtonFunction: bodegaIngreso
  })
}

function deleteIt(id){
  let productList = JSON.parse(localStorage.getItem('zopelapp/list-products'));

  let finalArray = [];

  productList.forEach((element, i, array) => {
    if(element.id == id){
      array.splice(i, 1);
      finalArray = array;
    }
  })
  localStorage.setItem('zopelapp/list-products', finalArray);
  viewListProducts();
  return finalArray;
}

function viewListProducts(veing){
  const listProducts = localStorage.getItem('zopelapp/list-products');
  const finalList = listProducts?JSON.parse(listProducts):[];

  popup.open({
    title: "Viendo la lista de productos entrantes",
    content: `
      <div class="container-cards">
        ${finalList.map(ch => `<div class="card text-center p-1">
            ${ch.product} - ${ch.cantidad} * ${formatNumber(ch.price)}
            <button class="btn btn-outline-secondary" onclick="deleteIt('${ch.id}')"><i class="fa-solid fa-xmark"></i></button>
          </div>`)}
      </div>
    `,
    closeButtonFunction: veing?bodegaEgreso:bodegaIngreso
  })
}

function sendingEntrada(){
  const listProducts = localStorage.getItem('zopelapp/list-products');
  const finalArray = listProducts?JSON.parse(listProducts):[];

  socket.emit('bodega/products/entrada', {
    list: finalArray,
    user: dataSession
  });

  socket.once('bodega/products/entrada', (data) =>{
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    alert.fire({
      title: "Ingreso a la bodega",
      text: "Ingreso de bodega hecho satisfactoriamente",
      icon: "success"
    })

    popup.start();
    localStorage.removeItem('zopelapp/list-products');

    updateBodega();
  })
}

function sendingSalida(){
  const listProducts = localStorage.getItem('zopelapp/list-products');
  const finalArray = listProducts?JSON.parse(listProducts):[];

  socket.emit('bodega/products/salida', {
    list: finalArray,
    user: dataSession
  });

  socket.once('bodega/products/salida', (data) =>{
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    alert.fire({
      title: "Salida de la bodega",
      text: "Salida de bodega hecho satisfactoriamente",
      icon: "success"
    })

    popup.start();
    localStorage.removeItem('zopelapp/list-products');

    updateBodega();
  })
}

function deleteGastoIndirecto(id){
  socket.emit('zopelapp/indirectos/delete', {
    indirecto: id,
    user: dataSession
  })

  socket.once('zopelapp/indirectos/delete', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    alert.fire({
      title: "Gasto Indirecto Eliminado",
      text: "Se ha eliminado correctamente el gasto.",
      icon: "success"
    });

    popup.start();
    updateIndirectos();
  })
}

function sendGuardarCambiosIndirectos(e){
  e.preventDefault();
  let simple = e.target;

  const data = {
    name: simple[0].value,
    description: simple[1].value,
    daycounter: simple[2].value,
    costo: simple[3].value,
    id: simple[4].value
  };

  socket.emit('zopelapp/indirectos/edit', {
    indirecto: data,
    user: dataSession
  });

  socket.once('zopelapp/indirectos/edit', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    alert.fire({
      icon: "success",
      text: "Cambios guardados exitosamente"
    });

    popup.start();
    updateIndirectos();
  })
}

function bodegaEditCosto(id){
  const dataIndirectos = localStorage.getItem('zopelapp/indirectos');
  const finalData = JSON.parse(dataIndirectos);
  const findingById = finalData.find(ch => ch.id == id);

  if(!findingById) return Toast.fire({
    text: "Parece que este gasto indirecto no esta registrado en el sistema",
    icon: "error"
  });

  popup.open({
    title: "Editar Gasto Indirecto",
    content: `
      <form onsubmit="sendGuardarCambiosIndirectos(event)">
        <label htmlFor="name">Nombre del gasto</label>
        <input type="text" value="${findingById.name}" id="name" name="name" placeholder="Ejem: Energia" class="form-control">
        <label htmlFor="description-input">Descripción del gasto</label>
        <textarea name="description" id="description-input" class="form-control" placeholder="Ejem: Gasto energetico global">${findingById.description}</textarea>
        <label htmlFor="daycounter">¿En cuantos dias es este gasto?</label>
        <p>Pon 1 dia si es un gasto diario o 30 si es mensual, y asi sucesivamente.</p>
        <input type="number" id="daycounter" value="${findingById.daycounter}" class="form-control" placeholder="Ejem: en 10 Dias se hace este gasto">
        <label htmlFor="">¿Cuanto Es?</label>
        <p>Pon el total de dinero qe se gasta en el total de los dias que proporcionaste en el espacio de arriba</p>
        <input type="number" value="${findingById.costo}" class="form-control" placeholder="Ejem: 350,000 x 5 Dias">
        <input type="hidden" value="${findingById.id}">
        <br>
        <button class="btn btn-success">Guardar Cambios</button>
        <a class="btn btn-danger" type="btn" onclick="deleteGastoIndirecto('${findingById.id}')">Eliminar Gasto Indirecto</a>
      </form>
    `
  })
}

function updateIndirectos(){
  socket.emit('zopelapp/indirectos', {user: dataSession});

  socket.once('zopelapp/indirectos', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    const arrayIndirectos = converterArray(data.data)

    localStorage.setItem('zopelapp/indirectos', JSON.stringify(arrayIndirectos));

    document.querySelector('.gastos-indirectos').innerHTML = arrayIndirectos.map(ch => `
      <div class="card">
        <div class="card-header">${ch.name}</div>
        <div class="card-body">
          <p>${ch.description}</p>
          <b>${formatNumber(ch.costo)} / ${ch.daycounter} = ${formatNumber(Number(ch.costo) / Number(ch.daycounter))} por dia</b>
          <br><br>
          <button class="btn btn-primary" onclick="bodegaEditCosto('${ch.id}')">Editar</button>
        </div>
      </div>
    `);
  })
}

function sendGastoIndirecto(e){
  e.preventDefault();
  const simple = e.target;

  const data = {
    name: simple[0].value,
    description: simple[1].value,
    daycounter: simple[2].value,
    costo: simple[3].value
  };

  socket.emit('zopelapp/indirectos/create', {
    indirectos: data,
    user: dataSession
  })

  socket.once('zopelapp/indirectos/create', (data) => {
    popup.start();
    updateIndirectos();

    alert.fire({
      icon: "success",
      text: "Gasto indirecto agregado, agregalo a la formulación"
    })
  })
}

function addGastoIndirecto(){
  popup.open({
    title: "Agregando Gasto Indirecto",
    content: `
      <form onsubmit="sendGastoIndirecto(event)">
        <label htmlFor="name">Nombre del gasto</label>
        <input type="text" id="name" name="name" placeholder="Ejem: Energia" class="form-control">
        <label htmlFor="description-input">Descripción del gasto</label>
        <textarea name="description" id="description-input" class="form-control" placeholder="Ejem: Gasto energetico global"></textarea>
        <label htmlFor="daycounter">¿En cuantos dias es este gasto?</label>
        <p>Pon 1 dia si es un gasto diario o 30 si es mensual, y asi sucesivamente.</p>
        <input type="number" id="daycounter" class="form-control" placeholder="Ejem: en 10 Dias se hace este gasto">
        <label htmlFor="">¿Cuanto Es?</label>
        <p>Pon el total de dinero qe se gasta en el total de los dias que proporcionaste en el espacio de arriba</p>
        <input type="number" class="form-control" placeholder="Ejem: 350,000 x 5 Dias">
        <br>
        <button class="btn btn-primary btn-block">Agregar Gasto Indirecto</button>
      </form>
    `
  })
}

function deleteListingActually(id){
  let locallyStorageListing = localStorage.getItem('zopelapp/formulas/list');
  let finallyData = locallyStorageListing?JSON.parse(locallyStorageListing):[];
  let finalRetorn = [];

  finallyData.forEach((element, i, array) => {
    if(element.id == id){
      array.splice(i, 1);
      finalRetorn = array;
    }
  })

  localStorage.setItem('zopelapp/formulas/list', JSON.stringify(finalRetorn));

  updatingListing();
}



function updatingListing(){
  let finallyListing = document.querySelector('.actually-listing');
  if(!finallyListing) return Toast.fire({
    text: "Parece que no se encuentra el objeto para hacer la lista",
    icon: "info"
  });

  let locallyStorageListing = localStorage.getItem('zopelapp/formulas/list');
  let finallyData = locallyStorageListing?JSON.parse(locallyStorageListing):[];

  let bodegaProducts = localStorage.getItem('acape-products');
  let finalBodega = bodegaProducts?converterArray(JSON.parse(bodegaProducts)):[];

  let productsFormula = [];
  let finalPrice = 0;

  finallyListing.innerHTML = finallyData.map(ch1 => {
    let findingProducting = finalBodega.find(ch2 => ch1.id === ch2.id);
    if(!findingProducting) return;
    productsFormula.push(findingProducting);

    finalPrice = finalPrice + ((findingProducting.costo_adquisitivo?findingProducting.costo_adquisitivo:0) / (findingProducting.pesaje?findingProducting.pesaje:1)) * ch1.gramaje;

    return `<div class="card">
      <div class="p-1">${findingProducting.name} - <b>Gramaje Usado: </b> ${ch1.gramaje} = ${formatNumber(
        ((findingProducting.costo_adquisitivo?findingProducting.costo_adquisitivo:0) / (findingProducting.pesaje?findingProducting.pesaje:1)) * ch1.gramaje)} - <button class="btn" onclick="deleteListingActually('${ch1.id}')"><i class="fa-solid fa-xmark"></i></button></div>
    </div>`;
  }).join('<br>') + `<br> <b>Total Precio: ${formatNumber(finalPrice)}</b>`;
}

function selectListing(event){
  const data = event.target.value;
  let bodegaProducts = localStorage.getItem('acape-products');
  const finalData = converterArray(JSON.parse(bodegaProducts?bodegaProducts:"{}"));

  let findingProduct = finalData.find(ch => ch.id == data);
  if(!findingProduct) return Toast.fire({
    title: "Error de productos",
    text: "No se ha encontrado el producto que seleccionaste.",
    icon: "error"
  });

  alert.fire({
    title: `${findingProduct.name}`,
    text: "Pon el gramaje usado en tu formula",
    input: "number"
  }).then((result) => {
    if(result.isConfirmed){
      let listingLocale = localStorage.getItem('zopelapp/formulas/list');
      let finalListing = listingLocale?JSON.parse(listingLocale):[];

      finalListing.push({
        id: data,
        gramaje: result.value
      });

      localStorage.setItem('zopelapp/formulas/list', JSON.stringify(finalListing));
      updatingListing();
    }
  })
}

function deleteThisFormula(id){
  socket.emit('zopelapp/formulas/delete', {
    formula: id,
    user: dataSession
  });

  socket.once('zopelapp/formulas/delete', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    alert.fire({
      text: data.message,
      icon: "success"
    })

    popup.start();
    updateFormulas();
  })
}

function editarThisFormula(id){
  let zopelappFormulas = localStorage.getItem('zopelapp/formulas');
  let finallyData = zopelappFormulas?JSON.parse(zopelappFormulas):[];

  let findingFormula = finallyData.find(ch => ch.id == id);
  if(!findingFormula) return Toast.fire({
    text: "Parece que no se encuentra esta formula",
    icon: "error"
  });

  const finalProducts = [];
  let finalPrice = 0;

  let productsArrayUsed = converterArray(findingFormula.products);
  const bodega = converterArray(JSON.parse(localStorage.getItem('acape-products')?localStorage.getItem('acape-products'):"{}"));

  productsArrayUsed.forEach((element, i, array) => {
    let findingToPush = bodega.find(ch => ch.id == element.id);
    if(findingToPush){
      findingToPush.used = (element.gramaje?element.gramaje:0);
      findingToPush.pricing = (((findingToPush.costo_adquisitivo?findingToPush.costo_adquisitivo:0) / (findingToPush.pesaje?findingToPush.pesaje:1)) * element.gramaje);
      finalProducts.push(findingToPush);

      finalPrice = finalPrice + (((findingToPush.costo_adquisitivo?findingToPush.costo_adquisitivo:0) / (findingToPush.pesaje?findingToPush.pesaje:1)) * element.gramaje)
    }
  });

  popup.open({
    title: "Editando Formula",
    content: `
      ${finalProducts.map(ch => `<div class="card p-1">
        ${ch.name} - ${formatNumber(ch.used)} = ${formatNumber(ch.pricing)}
      </div>
      <br>
      `).join('')+ `<b>Total: ${formatNumber(finalPrice)}</b><br><br><button class="btn btn-danger btn-block" onclicK="deleteThisFormula('${id}')">Eliminar Formula</button>`}
    `
  })
}

function updateFormulas(){

  socket.emit('zopelapp/formulas', {user: localStorage.getItem('admin-acape-session')});

  socket.once('zopelapp/formulas', (data) => {
    let htmlSelector = document.querySelector('.formulas-updating');
    if(!data.data) return Toast.fire({
      text: "La sesion del usuario es invalida o no es permitida",
      icon: "error"
    });


    localStorage.setItem('zopelapp/formulas', JSON.stringify(converterArray(data.data)))

    let formulasArray = converterArray(data.data);

    htmlSelector.innerHTML = formulasArray.map(ch => `
      <div class="card">
        <div class="card-body">
          ${ch.name} - ${ch.description}
          <br><br>
          <button class="btn btn-primary" onclicK="editarThisFormula('${ch.id}')">Editar</button>
        </div>
      </div>
    `).join('<br>');
  })
}

function sendCreateFormula(e){
  e.preventDefault();
  let locallyStorageListing = localStorage.getItem('zopelapp/formulas/list');
  let finallyData = locallyStorageListing?JSON.parse(locallyStorageListing):[];

  let data = {
    formula: {
      products: finallyData,
      name: e.target[0].value,
      description: e.target[1].value,
    },
    user: localStorage.getItem('admin-acape-session')
  }

  socket.emit('zopelapp/formulas/create', data);
  socket.once('zopelapp/formulas/create', (data) => {
    console.log(data)
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    popup.start();
    Toast.fire({
      title: "Formula Guardada Satisfactoriamente",
      icon: "success"
    })

    updateFormulas()
    localStorage.removeItem('zopelapp/formulas/list')
  })
}

function agregarFormula(){
  socket.emit('bodega/products', {token: localStorage.getItem('admin-acape-session')});

  socket.once('bodega/products', (data) => {
    if(!data.data) return Toast.fire({
      text: data.message,
      icon: "error"
    });

    const arrayProducts = converterArray(data.data).filter(ch => ch.materia_prima);
    localStorage.setItem('acape-products', JSON.stringify(data.data));

    popup.open({
      title: "Agregando Formula",
      content: `
        <form onsubmit="sendCreateFormula(event)">
          <label htmlFor="">Nombre de la formula</label>
          <input type="text" class="form-control" placeholder="Ejem: Papás a la francesa">
          <label htmlFor="">Descripción de la formula</label>
          <textarea class="form-control" placeholder="Ejem: Papás a la francesa normales para la venta a 2k por paq.."></textarea>
          <label htmlFor="">Selecciona Las Materias Primas</label>
          <p>Selecciona las materias primas que usas para este producto, se te pedira el gramaje que usas de cada materia prima que usas</p>
          <select class="form-select" onchange="selectListing(event)">
            <option value="null">Seleccione el producto</option>
            ${arrayProducts.map(ch => `<option value="${ch.id}">${ch.name}</option>`).join('')}
          </select>
          <hr>
          <div class="actually-listing"></div>
          <br>
          <button class="btn btn-primary btn-block">Agregar Formula</button>
        </form>
      `
    });

    updatingListing();
  })
}

const dataZopelappLocal = localStorage.getItem('zopelapp-services');
const dataSession = localStorage.getItem('admin-acape-session');


router.get('/formulacion', () => {
  updateFormulas();
  sessionValidator();

  return `
    <br>
    <div class="container-fluid">
      <h1 class="text-center">Formulación</h1>
      <p>Crea la formulación de tus productos aqui y aprende el costo por formula</p>
      <div class="text-center">
        <button class="btn btn-primary" onclick="agregarFormula()">Agregar Formula</button>
      </div>
      <br>
      <div class="formulas-updating"></div>
    </div>
  `;
})

router.get('/costos-productivos', () => {
  updateIndirectos();
  sessionValidator();

  return `
    <br><br>
    <div class="container-fluid">
      <h1 class="text-center">Gastos Indirectos</h1>
      <p class="text-center">Aqui puedes anotar los gastos indirectos que tengas de forma mensual, semanal o diaria</p>
      <div class="text-center">
        <button class="btn btn-primary" onclick="addGastoIndirecto()">Agregar Gasto Indirecto</button>
      </div>
      <br><br>
      <div class="gastos-indirectos"></div>
    </div>
  `;
})


router.get('/produccion', () => {
  sessionValidator();

  return `
      <br>
      <div class="text-center">
        <h1>Zopelapp</h1>
        <p>El unico servicio que te permite conocer tu producción</p>
        <div class="simplified-data"></div>
        <div class="text-center">
          <button class="btn btn-primary" onclick="addProduction()">Agregar Producción</button>
          <button class="btn btn-info" onclick="finallyRegister()">Finalizar registro</button>
        </div>
        <hr>
      </div>
      <div class="container-fluid data-principal">${updatePrincipal('html')}</div>
  `;
});



// ROUTER FINALIZING
router.start();

router.listen();

socket.setMultipleListener(['createProduct', 'editProduct', 'deleteProduct', 'products/ingreso'], 'products-manager');
socket.setMultipleListener(['createRole', 'editRole', 'deleteRole'], 'role-manager');
socket.setMultipleListener(['createVenta', 'editVenta', 'deleteVenta'], 'ventas-manager');
socket.setMultipleListener(['createClient', 'editClient', 'deleteClient'], 'clientes-manager');
socket.setMultipleListener(['createUser', 'editUser', 'deleteUser'], 'user-manager');
socket.setMultipleListener(['registrarCaja'], 'caja-manager');


// MANEJO DE EVENTOS
document.addEventListener('submit', async (e) => {
  const form = e.target;
  let tokenSession = localStorage.getItem('admin-acape-session');

  if(form.classList.contains('form-presupuestos')) return;

  if (!(form instanceof HTMLFormElement)) return;
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  data.token = tokenSession;

  if(form.classList.contains('form-presupuestos')){
    
    response = await axios.post('/app/presupuestos/set', data);


    return;
  }

  popup.close();

  try {
    let response;

    if (form.classList.contains('form-decrease')) {
      response = await axios.post('/app/egreso', data);
    } else if (form.classList.contains('form-pago-fijo')) {
      response = await axios.post('/app/createPagoFijo', data);
    } else if (form.classList.contains('form-editar-fijo')) {
      response = await axios.post('/app/editarPagoFijo', data);
    } else if (form.classList.contains('form-caja')) {
      response = await axios.post('/app/registrarCaja', data);
    } else if (form.classList.contains('form-transferencia')) {
      response = await axios.post('/app/transferencia', data);
    } else if (form.classList.contains('form-increase')) {
      response = await axios.post('/app/ingreso', data);
    }

    if(!response) return;

    const resData = response?.data;

    if (!resData || !resData.data) {
      return Toast.fire({
        icon: 'error',
        text: 'No se recibió información del servidor.'
      });
    }

    sessionValidator();
    location.hash = "#"

    Toast.fire({
      icon: 'success',
      text: resData.message || 'Operación realizada correctamente.'
    });
  } catch (err) {
    console.error(err);
    Toast.fire({ icon: 'error', text: 'Error al enviar los datos' });
  }
});


// SUBMIT PARA PRESUPUESTOS
function obtenerGastosDesdeFormulario() {
  const gastos = [];
  const grupos = document.querySelectorAll('#gastosContainer .input-group');

  grupos.forEach(grupo => {
    const descripcion = grupo.querySelector('input[name="description"]').value.trim();
    const valor = grupo.querySelector('input[name="valor"]').value.replace(/[^0-9.-]+/g, ''); // quitar formato
    const tipo = grupo.querySelector('select[name="type"]').value;
    const tachado = grupo.querySelector('input[type="hidden"]').value;

    if (descripcion && valor && tipo) {
      gastos.push({
        description: descripcion,
        valor: parseFloat(valor),
        type: tipo,
        tachado
      });
    }
  });

  return gastos;
}

document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.classList.contains('form-presupuestos')) return;
  e.preventDefault();

  const token = localStorage.getItem('admin-acape-session');
  const name = form.querySelector('input[name="name"]').value.trim();
  const description = form.querySelector('textarea[name="description"]').value.trim();
  const pagos = obtenerGastosDesdeFormulario();

  if (!name || !pagos.length) {
    return Toast.fire({ icon: 'error', text: 'El presupuesto debe tener un título y al menos un gasto.' });
  }

  try {
    const response = await axios.post('/app/presupuestos/set', {
      token,
      name,
      description,
      pagos
    });

    const res = response.data;
    if (res.data) {
      Toast.fire({ icon: 'success', text: 'Presupuesto guardado correctamente' });
    } else {
      Toast.fire({ icon: 'error', text: res.message || 'Error al guardar el presupuesto' });
    }
  } catch (err) {
    console.error(err);
    Toast.fire({ icon: 'error', text: 'Error de conexión con el servidor' });
  }
});
