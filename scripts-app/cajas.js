const acape = axios.create({
  baseURL: "/",
  headers: {
    "ngrok-skip-browser-warning": "true"
  },
  timeout: 600000
});

const router = new Router('ACAPE Administrativo', {
  nameweb: "ACAPE Administrativo",
  app: ".container-app",
  error_404: "<h1>Error, Pagina deshabilitada</h1>"
});

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

document.addEventListener('submit', e => {
  e.preventDefault();
  if(e.target.classList.contains('form-login-cajas')){
    let data ={
      user: e.target[0].value,
      password: e.target[1].value
    }

    acape.post('/login-acape', data).then((data) => {
      let dataResponse = data.data;
      let dataFinal = dataResponse.data;
      if(!dataFinal) return alert.fire({
        title: "Error De Sesion",
        text: "Contraseña o usuario incorrectos",
        icon: "error"
      });

      localStorage.setItem('token-cajas-admin', dataResponse.data.token);

      alert.fire({
        title: "Sesion iniciada correctamente"
      })
    })
  }
});


router.get(['', '/'], () => {
  return `<div class="centered-xy-cajas">
  <div class="card">
    <form action="" class="card-body form-login-cajas p-5">
      <h3 class="text-center">Acape Administrativo</h3>
      <p>Registra las ventas</p>
      <br>
      <label for="">Nombre de usuario</label>
      <input class="form-control" placeholder="Coloca Tu Nombre De Usuario" type="text" name="total_venta" id="" class="numberify-input-commas">
      <br>
      <label for="">Contraseña</label>
      <input class="form-control" placeholder="Coloca Tu Contraseña" type="text" name="total_gastos" id="">
      <br>
      <button class="btn-outline-primary btn btn-block">Iniciar Sesion</button>
    </form>
  </div>
</div>`;
})


router.start();

router.listen()
