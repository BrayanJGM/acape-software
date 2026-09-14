// API DE AXIOS
const acape = axios.create({
  baseURL: "/",
  headers: {
    "ngrok-skip-browser-warning": "true"
  },
  timeout: 600000
});


// CONSTRUCTOR DE LA PAGINA WEB
const router = new Router('ACAPE Pedidos', {
  nameweb: "ACAPE Pedidos",
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


function sessionValidator(){
  let finalSession = localStorage.getItem('acape-data-pedidos');

  if(!finalSession) return;


}


function loginFunc(){
  let finalSession = localStorage.getItem('acape-data-pedidos');

  if(!finalSession) return alert.fire({
    title: "Error de sesion",
    text: "La sesion ha caducado o ha cambiado",
    icon: "error"
  });

  socket.once('')
}

// SERVICIOS DE RUTAS
router.get(['', '/', '/app'], () => {
  let finalSession = localStorage.getItem('acape-data-pedidos');

  if(!finalSession) return `
    <div class="center-center center-full">
        <form class="siops-sesion card p-5" onsubmit="return loginFunc(this)">
          <h3 class="text-center">Pedidos</h3>
          <p>Maneja los pedidos de la empresa de manera ordenada y organizada con ACAPE Software</p>
          <label htmlFor="user">Usuario</label>
          <input type="text" id="user" class="form-control mb-3" placeholder="Usuario">
          <br>
          <label htmlFor="password">Contraseña</label>
          <input type="password" placeholder="Contraseña" class="mb-4 form-control">
          <button class="btn btn-outline-primary btn-block d-block w-100">Iniciar</button>
        </form>
      </div>
  `;

  sessionValidator();

  return ``;
})


router.start();
