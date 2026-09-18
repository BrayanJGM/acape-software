// VARIABLES PAQUETES DESCARGADOS POR NPM
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const handlebars = require('express-handlebars');
const bodyParser = require('body-parser');
const nodeCron = require('node-cron');
const multer = require('multer')

const {SerialPort} = require('serialport');
const gramera = require('./APIS/gramera.js');


// VARIABLES USADAS DE ARCHIVOS Y CONFIGURACIONES
const api_db = require('./APIS/database.js');
const { siops } = require('./APIS/token.js');
const validator = new siops();
const server = express();
const converterArray = api_db.converterArray;
const router = new express.Router();

const whatsapp = require('./APIS/whatsapp.services.js');

const apis_mail = require('./APIS/mail.services.js');



// ESTAS CONFIGURACIONES, ES PARA USAR EN CASO DE QUE NO SE PUEDA ATRAVÉZ DEL METODO DE INYECCION DE CODIGO EN LA IMPRESORA, ENTONCES ESTO AYUDARA A IMPRIMIR Y QUE LA CAJA ABRA.
// const configs = require('./configs.json');

// FUNCION DE APERTURA DE LA CAJA POR INYECCION DE CODIGO:
function openCashDrawer() {
  const port = new SerialPort({path: "COM1", baudRate: 9600, autoOpen: false});

  const openCashDrawerCommand = Buffer.from([27, 112, 0, 50, 250]);
  port.open((err) => {
    if(err) return console.log('error al abrir');

    port.write(openCashDrawerCommand, (err) => {
      if(err) return console.log(err);
      port.close();
    })
  })

  return {message: "opened"};
} 

// FORMATEAR NUMEROS: PONER LAS COMAS COMO SEPARADORES
function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// INICIALIZACIÓN DE BASE DATOS - SERVICIO LOCAL DE BASE DE DATOS
const database = new api_db({
  user: "acape",
  password: "admin"
})
// CUANTO TARDA 
console.time('service')
database.start();


// FUNCIONES, PENSADAS EN MOVERSE A OTRO ARCHIVO DE TAL MANERA QUE ESTE ARCHIVO QUEDE LIMPIO SIN TANTAS FUNCIONES QUE QUEDE CON SOLO RUTAS

function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizarFecha(fecha) {
  let d = new Date(fecha);
  return d.getUTCFullYear() + '-' + 
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + 
    String(d.getUTCDate()).padStart(2, '0');
}

async function sendReporteDia(){
  let services = database.db.getData('/data/simple/services');
  let cajas = database.db.getData('/data/simple/caja', ['**/ventas_hechas', '**/ingresos', '**/egresos']);
  let arrayCajas = converterArray(cajas);

  const hoy = normalizarFecha(new Date());

  const cajasHoy = arrayCajas.filter(item => {
    return normalizarFecha(item.cerrada) === hoy;
  });

  const dataInfo = {
    ventas: 0,
    ingresos: 0,
    egresos: 0,
    gastado: 0,
    entregado: 0,
    starting: 0
  };

  cajasHoy.forEach(element => {
    dataInfo.ventas += Number(element.total_recibido);
    dataInfo.ingresos += Number(element.ingreso);
    dataInfo.egresos += Number(element.egreso);
    dataInfo.gastado += (element.egreso - element.ingreso);
    dataInfo.entregado += (element.value - element.starting);
    dataInfo.starting += Number(element.starting);
  });

  let accounting_movements = database.db.getData('/data/simple/accounting') || {};
  let arrayMovements = converterArray(accounting_movements.movements || {});

  const movementsHoy = arrayMovements.filter(item => {
    return normalizarFecha(item.date) === hoy;
  });

  let finalMoneyToday = 0;

  movementsHoy.forEach(element => {
    finalMoneyToday += Number(element.money);
  });

  let finalMessage = `
*REPORTE DEL DÍA - ${formatearFecha(hoy)}*

💰 *Ventas totales:* $${dataInfo.ventas.toLocaleString()}
📉 *Total Gastado:* $${dataInfo.gastado.toLocaleString()}
📦 *Total Entregado:* $${dataInfo.entregado.toLocaleString()}
══════════════════════════════


📊 *Dinero Final Del Dia:* $${finalMoneyToday.toLocaleString()}


══════════════════════════════
🧾 Cajas cerradas hoy: ${cajasHoy.length}
🗂️ Movimientos Ingresados hoy: ${movementsHoy.length}
`;

  await whatsapp(finalMessage);

  return finalMessage;
}

// SERVICIO DE BASE DE DATOS
let services_data_database = database.db.getData('/data/simple/services');
services_data_database.time = services_data_database.time ? services_data_database.time : "08:30"; 
let finalizing_time = services_data_database.time.split(':');

let tarea = nodeCron.schedule(`${finalizing_time[1]} ${finalizing_time[0]} * * *`, () => {
  sendReporteDia();
});

// REMUEVE LOS SEPARADOS DE COMAS EN LOS NUMEROS: 477,000.00 > 477000
function removeCommaSeparators(input) {
  return input.replace(/,/g, '');
}

server.use(compression());
server.use(bodyParser.json({ limit: '10mb' })); // Aquí puedes ajustar el límite según tus necesidades
server.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
server.use(cors())

process.on('unhandledRejection', (reason, promise) => {
  // console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('Hubo un error: ')
  console.log(reason)
});

server.use('/scripts', express.static('./scripts'))
server.use('/APIS', express.static('./APIS'))
server.use('/database', express.static('./system'));
server.use('/scripts-app', express.static('./scripts-app'));
server.use('/services', express.static('./services'));
server.use('/img', express.static('./img'))

server.engine('.html', handlebars.engine({extname: ".html"}));
server.set('views', './views');
server.set('view engine', 'express-handlebars');
server.use((req, res, next) => {
  res.locals.title = "Acape Software";
  next();
});


/// ------------------------- AQUI EMPIEZA EL SISTEMA DE RUTAS
// EN ESTE APARTADO EMPIEZA EL SISTEMA DE RUTAS Y POR LO TANTO AQUI EMPIEZA EL SISTEMA Y OPTIMIZACIÓN DE LAS NUEVAS RUTAS, Y MEJORAMIENTO DE CODIGO Y SISTEMA, PARA ACTUALIZACIÓNES MAS RAPIDAS Y TODO DE MANERA MAS ORGANIZADA

// ---------------------- RUTAS GET
// EN ESTE APARTADO ESTARAN TODAS LAS RUTAS GET EN LAS QUE NO SE NECESITA QUE SE TENGA UN ORDENAMIENTO PARA APIS, ESTAS RUTAS SON ESTATICAS Y NO DEBERIA TENER LOGICA AVANZADA SOLO SIMPLICIDAD

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/main.html'))
});

router.post('/whatsapp/gasto', (req, res) => {
  const data = req.body;

  const validatingUser = database.getUserToken(data.token);

  if(!validatingUser.data) return res.send(validatingUser);

  whatsapp(`📌 **Gasto registrado:**
📝 **Descripción:** ${data.data.description?data.data.description:"no hay razon o descripción"}
💸 **TOTAL** $${formatNumber(data.data.money)}`);

  return res.send({message: "El mensaje sera enviado en pocos momentos"});
})

router.post('/whatsapp/ingreso', (req, res) => {
  const data = req.body;

  const validatingUser = database.getUserToken(data.token);

  if(!validatingUser.data) return res.send(validatingUser);

  whatsapp(`✅ Ingreso registrado:
📝 Descripción: ${data.data.description?data.data.description:"no hay razon o descripción"}
💸 Total: $${formatNumber(data.data.money)}`);

  return res.send({message: "El mensaje sera enviado en pocos momentos"});
});

router.get('/pedidos', (req, res) => {
  const data = database.db.getData('/data/simple/products');
 
  res.render('pedidos.html', {scripting: "<script src='/scripts-app/pedidos.js'></script>"})
});

router.get('/cajas', (req, res) => {
  res.render('cajas.html', {layout: "non-scripts.html", scripting: `<script src="/scripts-app/cajas.js"></script>`});
})

router.get('/app', (req, res) => {
  res.render('login/admin.html', {layout: "rest.html"})
});

// ----------------- FINALIZA LAS RUTAS GET


// ------------------ RUTAS POST
// AQUI EMPIEZAN TODAS LAS RUTAS Y LOGICA DE LA API, CLARO QUE CON LA ACTUALIZACIÓN SE VA A SEGUIR EL SISTEMA CRUD: USANDO POST, DELETE, PUT Y LAS OTRAS FUNCIONES PARA PODER SER MAS ACTIVOS

router.post('/pedidos/all', (req, res) => {
  return res.json({
    pedidos: database.getPedidos(),
    notconfirmed: database.db.getData('/data/simple/pedidos_notconfirmed')
  });
})

// ------------------ APLICACIÓN BODEGA / ZOPELAPP

router.get(['/app/productions', '/zopelapp'], (req, res) => {
  res.render('./zopelapp.html', {layout: "./none.html", scripting: "<script src='/scripts-app/zopelapp.js'></script>"})
})
// ZOPELAPPS FUNCTIONS
/* --------------------------------- ZOPELAPP -----------------------------------*/

// BODEGA FUNCIONES INDIRECTOS

router.post('/zopelapp/indirectos', (req, res) => {
  const data = req.body;

  res.json(database.bodegaGetIndirectos(data.user));
})

router.post('/zopelapp/indirectos/create', (req, res) => {
  const data = req.body;

  res.json(database.bodegaIndirectosCreate(data.indirectos, data.user))
})

router.post('/zopelapp/indirectos/delete', (req, res) => {
  const data = req.body;

  res.json(database.bodegaIndirectosDelete(data.indirecto, data.user))
})
router.post('/zopelapp/indirectos/edit', (req, res) => {
  const data = req.body;

  res.json(database.bodegaIndirectosEdit(data.indirecto, data.user));
})
router.post('/zopelapp/registros/save', (req, res) => {{
  const data = req.body;

  res.json(database.bodegaSaveRegister(data.registro, data.user));
}})
router.post('/zopelapp/registros/get', (req, res) => {
  const data = req.body;

  res.json(database.getRegistroByID(data.id, data.user));
})
router.post('/zopelapp/registros/delete', (req, res) => {
  const data = req.body;

  res.json(database.deleteRegistroByID(data.id, data.user));
})
router.post('/zopelapp/registros/all', (req, res) => {
  const data = req.body;

  res.json(database.getRegistros(data));
})


// FUNCIONES DE FORMULAS
router.post('/zopelapp/all', (req, res) => {
  const data = req.body;
  let valid = database.getUserToken(data.token);
  if(!valid.data) return res.json(valid);

  let all_data = database.db.getData(`/data/simple/zopelapp`);

  res.json({message: "Información descargada", data: all_data})
})

router.post('/zopelapp/formulas', (req, res) => {
  const data = req.body;

  res.json(database.bodegaGetFormulas(data));
})

router.post('/zopelapp/formulas/create', (req, res) => {
  const data = req.body;

  res.json(database.bodegaCreateFormula(data.formula, data.user));
})

router.post('/zopelapp/formulas/delete', (req, res) => {
  const data = req.body;

  res.json(database.bodegaDeleteFormula(data.formula, data.user));
})


// FUNCIONES DE REGISTROS
router.post('/zopelapp/register/save', (req, res) => {
  const data = req.body;
  let valid = database.validatingUsering(data);
  if(!valid.data) return res.json(valid);

  let all_data = database.db.getData(`/data/simple/zopelapp/registros_save`);

  res.json({message: "Actually message"});
})

router.post('/zopelapp/register/delete', (req, res) => {
  const data = req.body;
  let valid = database.validatingUsering(data);
  if(!valid.data) return res.json(valid);
  
  res.json({message: "Eliminado correctamente"});
});
/* --------------------------------- FIN ZOPELAPP -----------------------------------*/

// ----------------- BODEGA -------------
// AQUI EMPIEZAN TODAS LAS FUNCIONES DEL APARTADO DE BODEGA EN EL PANEL ADMINISTRATIVO

const upload = multer({ dest: 'xmls/' }); // Carpeta temporal
const fs = require('fs');

router.post('/bodega/upload', upload.array('xml', 20), async (req, res) => {
  const data = req.body;
  const auth = req.headers.authorization ? req.headers.authorization.slice(7) : "";

  let receivedUser = database.getUserToken(auth);
  if (!receivedUser.data) {
    return res.status(500).send({ message: "La sesión de usuario ya no es válida" });
  }

  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if (!validatePerms) {
    return res.status(500).send({ message: "No tienes permisos suficientes para entrar a la página administrativa" });
  }

  try {
    const resultados = [];
    const filePaths = []; // Array para almacenar las rutas de los archivos

    // Subir archivos y almacenar las rutas
    for (const file of req.files) {
      filePaths.push(file.path); // Almacena la ruta de cada archivo
      resultados.push({ archivo: file.originalname, estado: "Cargado correctamente" });
    }

    // Procesar todos los archivos después de que se hayan subido
    for (const filePath of filePaths) {
      try {
        await database.procesarFactura(filePath); // Procesa cada archivo con la función procesarFactura
      } catch (err) {
        console.error(`Error procesando el archivo ${filePath}:`, err.message);
        resultados.push({ archivo: filePath, estado: "Error al procesar", error: err.message });
      }
    }

    // Después de procesar, eliminar los archivos
    for (const filePath of filePaths) {
      fs.unlinkSync(filePath); // Borra los archivos una vez procesados
    }

    res.json({ message: 'Carga y procesamiento finalizados.', data: resultados });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Error al procesar los archivos.' });
  }
});


router.post('/bodega/logs', (req, res) => {
  const data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "La sesion de usuario ya no es valida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "No tienes permisos suficientes para entrar a la pagina administrativa"});

  let finalBodega = database.db.getData('/data/simple/bodega/logs');

  res.send({message: "Bodega", data: finalBodega});
})


// BODEGA NUEVAS FUNCIONES
router.post('/bodega/products', (req, res) => {
  const data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "La sesion de usuario ya no es valida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "No tienes permisos suficientes para entrar a la pagina administrativa"});

  res.send(database.getAllProducts(data.token))
})

router.post('/bodega/facturar', (req, res) => {
  let data = req.body;


  let finalBote = database.generarFacturaCredito(data.factura, data.token);

  return res.send(finalBote);
})

router.post('/bodega/inventario', (req, res) => {
  let data = req.body;


  let finalInventario = database.inventariado(data.factura, data.token);

  return res.send(finalInventario);
})

router.post('/bodega/movements', (req, res) => {
  let data = req.body;

  let finalMovements = database.getMovements(data.token);

  return finalMovements;
})

router.post('/bodega/inventario/update', (req, res) => {
  let data = req.body;

  let finalInventario = database.correctorInventory(data.factura, data.token);

  res.send(finalInventario)
});


router.post('/bodega/movimientos', (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "La sesion de usuario ya no es valida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "No tienes permisos suficientes para entrar a la pagina administrativa"});


  let dataservices = database.db.getData('/data/simple/movimientos', ['**/items']);

  return res.send({message: "Informacion descargada satisfactoriamente", data: dataservices});
});

router.post('/bodega/movimientos/:id', (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "La sesion de usuario ya no es valida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "No tienes permisos suficientes para entrar a la pagina administrativa"});

  let dataservices = database.db.initData(`/data/simple/movimientos/${req.params.id}`);

  if(!dataservices) return res.send({message: "Este id es indefinido"});

  res.send({message: "Información descargada satisfactoriamente", data: dataservices});
})

// FINAL BODEGA

// ------------------ VALIDATORS - LOGINS
// AQUI ESTARAN LOS VALIDATORS COMO EL ADMIN-VALIDATOR Y EL SESSION VALIDATOR, Y VER QUE CAMBIOS O RUTAS SE PUEDEN ELIMINAR.

router.post('/admin-validator', async (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "La sesion de usuario ya no es valida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "No tienes permisos suficientes para entrar a la pagina administrativa"});

  let same_data = {
    accounting: database.db.getData('/data/simple/accounting', ['movements']),
    movements: await database.db.getLastNMovements('/data/simple/accounting/movements', [], 100),
    methods: database.db.getData('/data/simple/methods'),
    pagosFijos: database.db.getData('/data/simple/pagos-fijos'),
  };

  same_data.accounting_value = same_data.accounting.value;

  return res.send({message: "Información descargada correctamente", data: same_data});
})


// ----- FUNCIONES DE PRESUPUESTOS DEL APARTADO DE ADMINISTRACIÓN
// ESTARAN TODAS LAS RUTAS DE LOS PRESUPUESTO, BUSCANDO TAMBIEN EN OPTIMIZAR ESTOS BLOQUES LARGOS Y QUITAR TAMBIEN ZOPELAPP
router.post('/app/presupuestos/get', (req, res) => {
  const data = req.body;

  res.send(database.getPresupuestoActivo(data.token));
});

router.post('/app/presupuestos/set', (req, res) => {
  const data = req.body;

  res.send(database.setPresupuestoActivo(data.token, data));
});

router.post('/app/presupuestos/finalizar', (req, res) => {
  const data = req.body;

  res.send(database.finalizarPresupuestoActivo(data.token))
});

router.post('/app/presupuestos', (req, res) => {
  const data = req.body;

  res.send(database.presupuestos(data.token));
});

router.post('/app/presupuestos/:id', (req, res) => {
  const id = req.params.id;
  const data = req.body;

  res.send(database.getPresupuesto(data.token, id));
})

router.post('/app/presupuestos/remove/:id', (req, res) => {
  const id = req.params.id;
  const data = req.body;

  res.send(database.removePresupuesto(data.token, id));
})
router.get('/app/presupuestos/activar/:id', (req, res) => {
  const id = req.params.id;
  const data = req.body;

  res.send(database.presupuestoAActivo);
})


// ENVIAR REPORTE O SOLICITAR REPORTE -- REPORTER//
// APLICACIONES Y SERVICIOS DEL ADMINISTRADOR - API POST
router.post('/app/reporte', async (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let finalReport = await sendReporteDia();

  res.send({message: "Reporte enviado revisa tu whatsapp, en caso de que no llegue en unos segundos comunicate con tu desarrollador o con soporte de aplicación para revisar tu caso", data: finalReport});
});

router.post('/app/registrarCaja', async (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let caja = {
    value: Number(removeCommaSeparators(data.value)),
    total_recibido: Number(removeCommaSeparators(data.total_recibido)),
    egreso: Number(removeCommaSeparators(data.egreso)),
    ingreso: 0,
    type: "another",
    date: new Date(),
    starting: 0,
    responsableRegistered: data.responsable
  }

  let finalRegistering = await database.registrarCaja(caja, receivedUser.data.token)

  res.send({message: "Caja registrada satisfactoriamente", data: finalRegistering});
});

router.post('/app/transferencia', (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let finalTransferencia = database.transferirGeneral(data.from, data.to, removeCommaSeparators(data.monto));

  res.send({message: "Transferencia exitosa", data: finalTransferencia})
});

router.post('/app/createPagoFijo', (req, res) => {
  let data = req.body;

  let user = data.token;
  let addingPago = database.createPagoFijo(data, user);

  if(!addingPago.data) return res.send({message: "Error al crear el pago fijo"});

  res.send({message: "Pago fijo creado satisfactoriamente.", data: addingPago.data});
})

router.post('/app/editarPagoFijo', (req, res) => {
  let data = req.body;

  let user = data.token;

  let finald1 = removeCommaSeparators(data.monto);

  data.monto = finald1;

  let editingPago = database.editPagoFijo(data, user);

  res.send(editingPago);
})

router.post('/app/setPagoFijo', (req, res) => {
  const data = req.body;

  let user = data.token;

  let setPay = database.setPagoFijo(data, user);
  res.send(setPay);
})

router.post('/app/deletePagoFijo', (req, res) => {
  const data = req.body;

  let user = data.token;

  let deletingPago = database.deletePagoFijo(data.id, user);

  res.send(deletingPago)
})

router.post('/app/ingreso', (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let addingToGeneral = database.addToGeneral({
    monto: removeCommaSeparators(req.body.monto),
    desc: req.body.desc,
    digital: req.body.digital
  })

  res.send(addingToGeneral);
})

router.post('/app/egreso', (req, res) => {
  let data = req.body;

  let receivedUser = database.getUserToken(data.token);

  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let removingToGeneral = database.removeToGeneral({
    monto: removeCommaSeparators(req.body.monto),
    desc: req.body.desc,
    digital: req.body.digital
  });

  res.send(removingToGeneral);
})


router.post('/app/registros', (req, res) => {
  const data = req.body;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let cajas = database.db.getLastNMovements('/data/simple/caja/', [
    '**/ventas_hechas',
    '**/ingresos',
    '**/egresos',
    '**/ventas_eliminadas'
    ], 30);

  res.send({message: "Información de registros y cajas", data: cajas});
});

router.post('/app/registros/:id', (req, res) => {
  const data = req.body;
  const id = req.params.id;

  let receivedUser = database.getUserToken(data.token);
  if(!receivedUser.data) return res.send({message: "Usuario invalido o sesion invalida"});
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if(!validatePerms) return res.send({message: "Parece que el usuario no tiene permisos"});

  let caja = database.db.initData(`/data/simple/caja/${id}`);
  if(!caja) return res.send({message: "Registro de caja no encontrado"});

  res.send({message: "Descargando registro de caja", data: caja});
})


//  FUNCIONES DE PEDIDOS -----------------------------
// CREATE PEDIDO
router.post('/createPedido', (req, res) => {
  const data = req.body;

  if(!data.pedido) return res.json({message: "Tienes que agregar la información del pedido."});
  if(!data.token) return res.json({message: "Tienes que agregar el token del usuario."});

  res.json(database.createPedido(data.pedido, data.token));
});

router.post('/confirmPedido', (req, res) => {
  const data = req.body;
  let validatePerms = database.validatePerms(data.token, 'facturar');
  if(!validatePerms) return res.json({message: "No tienes permisos suficientes"});
  if(!data.id) return res.json({message: "Agrega el id del pedido a confirmar."});
  if(!data.abono) return res.json({message: "Tienes que agregar abono."});

  let confirming = database.db.initData(`/data/simple/pedidos_notconfirmed/${data.id}`);
  if(!confirming) return res.json({message: "Este pedido no existe o ya fue confirmado, actualiza la pagina para ver los cambios"});

  confirming.abono = Number(data.abono?data.abono:"0");
  confirming.products = converterArray(confirming.products);

  let creatingPedido = database.createPedido(confirming, data.token);
  if(!creatingPedido.data) return res.json(creatingPedido);

  database.db.removeData(`/data/simple/pedidos_notconfirmed/${data.id}`);

  res.send({message: "Pedido confirmado exitosamente", data: creatingPedido.data})
})

router.post('/setPayPedido', (req, res) => {
  const data = req.body;

  if(!data.pedido) return res.json({message: "Tienes que agregar el id del pedido"});
  if(!data.token) return res.json({message: "Tienes que agregar el token del usuario"});
  if(!data.pago) return res.json({message: "Agrega el total de pago recibido por el"});

  res.json(database.setPayPedido(data.pedido, data.pago, data.token));
})

router.post('/notConfirmed', (req, res) => {
  const data = req.body;

  let getting = database.db.getData(`/data/simple/pedidos_notconfirmed/${data.id}`);
  if(!getting) return res.json({message: "No se pudo obtener el pedido"});

  res.json({message: "Factura encontrada", data: getting});
})

router.post('/setListPedido', (req, res) => {
  const data = req.body;

  let notConfirmed = database.db.initData('/data/simple/id/pedidos_notconfirmed') || 0;

  const pedidos = database.db.getData('/data/simple/pedidos_notconfirmed');

  if(!data.cliente && !data.phone_cliente && !data.entrega && !data.hora && !data.detalles && !data.abono) return res.json({message: "El nombre del cliente es obligatorio"});

  notConfirmed = notConfirmed + 1;
  data.id = notConfirmed;
  pedidos[notConfirmed] = data;

  database.db.setData('/data/simple/id/pedidos_notconfirmed', notConfirmed);
  database.db.setData(`/data/simple/pedidos_notconfirmed/${notConfirmed}`, data);

  res.send({message: "Pedido Enviado", data: data});
})


router.post('/pedido', (req, res) => {
  const data = req.body;

  let getting = database.db.getData(`/data/simple/pedidos/${data.id}`);
  if(!getting) return res.json({message: "No se pudo obtener el pedido"});

  res.json({message: "Factura encontrada", data: getting});
})

router.post('/deletePedido', (req, res) => {
  const data = req.body;

  if(!data.pedido) return res.json({message: "Tienes que el id del pedido para eliminarlo"});
  if(!data.token) return res.json({message: "Agrega el token del usuario"});

  res.json(database.deletePedido(data.pedido, data.token));
})

router.post('/finalizarPedido', (req, res) => {
  const data = req.body;

  if(!data.pedido) return res.json({message: "Agrega el id del pedido"});
  if(!data.token) return res.json({message: "Tienes que agregar el token del usuario"});

  res.json(database.finalizarPedido(data.pedido, data.token))
})

router.post('/getPedidos', (req, res) => {
  return res.json({
    pedidos: database.getPedidos(),
    notconfirmed: database.db.getData('/data/simple/pedidos_notconfirmed')
  });
})

// METODOS DE PAGO -------------
//  FUNCIONES EXCLUSIVAS DEL SERVICIO ADMINISTRATIVO, BUSCAR OPTIMIZAR Y MEJORAR ESTAS OPCIONES

router.post('/createMethodPay', (req, res) => {
  const data = req.body;
  if(!req.body.method) return res.json({message: "Tienes que agregar la información para el metodo de pago"});

  return res.json(database.createMethodPay(req.body.method, req.body.token));
})

router.post('/editMethodPay', (req, res) => {
  const data = req.body;
  if(!req.body.method) return res.json({message: "Tienes que agregar la información para el metodo de pago"});

  return res.json(database.editMethodPay(req.body.method, req.body.token));
})

router.post('/deleteMethodPay', (req, res) => {
  const data = req.body;
  if(!req.body.method) return res.json({message: "Tienes que agregar el nombre para eliminar el metodo de pago"});

  return res.json(database.deleteMethodPay(req.body.method, req.body.token));
})

router.post('/getMethods', (req, res) => {
  res.json(database.getMethods())
})

// FIN => METODOS DE PAGO


// FUNCIONES ADMINISTRATIVAS DE LA APLICACIÓN PRINCIPAL
router.post('/getUser', (req, res) => {
  const data = req.body;

  if(!data.id) return res.json({message: "Añade el id del usuario"});
  let validatePerms = database.validatePerms(data.token, 'all');

  if(!validatePerms) return res.json({message: "No tienes permisos suficientes."});

  let findingUser = database.db.getData(`/data/simple/users/${data.id}`);
  let roles = database.db.getData('/data/simple/roles')
  if(!findingUser) return res.json({message: "Parece que este usuario ya no existe o fue eliminado"});

  return res.json({message: "Usuario encontrado", data: findingUser, roles: roles});
})

router.post('/editarRol', (req, res) => {
  const data = req.body;

  if(!data.name) return res.json({message: "Añade el nombre del rol que quieres editar"});
  let validatePerms = database.validatePerms(data.token, 'all');

  if(!validatePerms) return res.json({message: "No tienes permisos suficientes."});

  let findingRol = database.db.getData(`/data/simple/roles/${data.name}`);
  let roles = database.db.getData('/data/simple/roles')
  if(!findingRol) return res.json({message: "Parece que este usuario ya no existe o fue eliminado"});

  return res.json({message: "Usuario encontrado", data: findingRol, roles: roles});
})

router.post('/openCashDrawer', (req, res) => {
  openCashDrawer();
  return res.json({ message: "Open Cash Drawer" });
})

// ------------------ GRAMERA (BALANZA) ------------------
router.get('/gramera/peso', (req, res) => {
  res.json(gramera.getPeso());
});

router.get('/gramera/config', (req, res) => {
  res.json(gramera.getConfig());
});

router.post('/gramera/debug', (req, res) => {
  const { activo } = req.body || {};
  res.json(gramera.setDebug(!!activo));
});

router.get('/gramera/ports', async (req, res) => {
  try {
    const ports = await gramera.listPorts();
    res.json({ ports, actual: gramera.getConfig().port });
  } catch (err) {
    res.json({ ports: [], actual: gramera.getConfig().port, error: err.message });
  }
});

router.post('/gramera/conectar', async (req, res) => {
  const data = req.body;
  const result = await gramera.conectar({ port: data.port, baudRate: data.baudRate });
  const message = result.conectada ? `Conectado a ${result.config.port}` : (result.error || 'No se pudo conectar');
  res.json({ message, data: result });
});

router.post('/gramera/desconectar', (req, res) => {
  const result = gramera.desconectar();
  res.json({ message: "Desconectado", data: result });
});

router.post('/gramera/config', async (req, res) => {
  const data = req.body;

  const newConfig = await gramera.conectar({ port: data.port, baudRate: data.baudRate });

  res.json({ message: "Configuración de gramera guardada", data: newConfig });
});

router.get('/gramera/detectar', async (req, res) => {
  try {
    const result = await gramera.detectarBaud();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message, port: gramera.getConfig().port });
  }
});

router.get('/gramera/test', (req, res) => {
  res.json(gramera.getTests());
});

router.get('/gramera/trazas', (req, res) => {
  res.json(gramera.getTrazas());
});

router.post('/gramera/test', (req, res) => {
  const data = req.body || {};
  res.json(gramera.guardarTest(data.id, data.esperado));
});

router.post('/gramera/test/reset', (req, res) => {
  res.json(gramera.limpiarTests());
});

router.post('/token_validation', (req, res) => {
  const data = req.body.token;
  validator.start(data, (data, err) => {
    res.json(data ? data : err);
  })
})

router.post('/get_token_valid', (req, res) => {
  const data = req.body;
  validator.start(data, (data, err) => {
    res.json(data ? data : err);
  })
})

router.post('/login-acape', (req, res) => {
  const data = req.body;
  const users = database.db.getData('/data/simple/users');
  const users_array = converterArray(users);

  const validatorUsers = users_array[0];
  if (!validatorUsers) {
    let user = database.createUser(data.user, data.password, 'owner');
    res.json(user);
  } else {
    let receivedUser = database.getUser(data.user, data.password);
    res.json(receivedUser);
  }
});

router.post('/session-validator', (req, res) => {
  const data = req.body.token;
  let user = database.getUserToken(data);
  if(user.data) user.role = database.getInfoPerms(user.data.role);
  res.json(user)
});

// DEUDORES SECCION ---------------------- DEUDORES//
router.post('/getDeudores', (req, res) => {
  const data = req.body;

  if(!data.token) return res.json({message: "Agrega el token del usuario"});

  res.json(database.getDeudores(data.token));
})

router.post('/getClientesConDeuda', (req, res) => {
  const data = req.body;

  if(!data.token) return res.json({message: "Agrega el token del usuario"});

  res.json(database.getClientesConDeuda(data.token));
})

router.post('/addDeuda', (req, res) => {
  const data = req.body;
  if(!data.id) return res.json({message: "Añade la info del id"});
  if(!data.deuda) return res.json({message: "La deuda tiene que ser agregada"});

  let finalUser = {};

  if(data.accounting){
    let getUser = database.getUser(data.accounting.user, data.accounting.password);
    if(!getUser.data) return res.json({message: "El usuario es invalido"});

    finalUser = getUser.data;
    let validatePerms = database.validatePerms(getUser.data.token, 'all');

    if(!validatePerms) return res.json({message: "No tienes permisos suficientes."});
    database.removeToGeneral({
      desc: `Prestamo > ${data.deuda.desc}`,
      monto: Number(data.deuda.monto)
    })
  };

  res.json(database.addDeuda(data.id, data.deuda, data.token?data.token:finalUser.token));
});

router.post('/removeDeuda', (req, res) => {
  const data = req.body;
  if(!data.id) return res.json({message: "Añade la info del id"});
  if(!data.deuda) return res.json({message: "La deuda tiene que ser agregada"});

  let finalUser;

  if(data.accounting){
    let getUser = database.getUser(data.accounting.user, data.accounting.password);
    if(!getUser.data) return res.json({message: "El usuario es invalido"});

    finalUser = getUser.data;
    let validatePerms = database.validatePerms(getUser.data.token, 'all');

    if(!validatePerms) return res.json({message: "No tienes permisos suficientes."});
    database.addToGeneral({
      desc: `Pago De Deuda > ${data.deuda.desc}`,
      monto: Number(data.deuda.monto)
    })
  }

  res.json(database.removeDeuda(data.id, data.deuda, data.token?data.token:finalUser.token));
});



// FUNCIONES DE PRODUCTOS DE LA APP PRINCIPAL --- PRODUCTS//

router.post('/products/ingreso', async (req, res) => {
  const data = req.body;

  if(!data.token) return res.json({message: "Agrega el token para poder acceder a las funciones."});

  if(!data.product) return res.json({message: "Agrega la información del producto"});

  const result = await database.ingresoProducts(
    [{ id: data.product.id, price: data.product.price, cantidad: data.product.cantidad }],
    data.token
  );
  return res.json(result);
})

router.post('/createProduct', (req, res) => {
  const data = req.body;

  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a las funciones." });
  if (!data.product) return res.json({ message: "Agrega la información del producto." });

  return res.json(database.createProduct(data.product, data.token));
})

router.post('/editProduct', (req, res) => {
  const data = req.body;
  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a las funciones." });
  if (!data.product) return res.json({ message: "Agrega la información del producto" });

  return res.json(database.editProduct(data.product.id, data.product, data.token));
})

router.post('/deleteProduct', (req, res) => {
  const data = req.body;
  if (!data.token) return res.json({ message: "Agrega el token para acceder a las funciones." });
  if (!data.product) return res.json({ message: "Agrega el id del producto" });

  return res.json(database.deleteProduct(data.product, data.token));
})
router.post('/getAllProducts', (req, res) => {
  const data = req.body.token;
  const products = database.getAllProducts(data);

  const filtrados = Object.entries(products.data)
  .filter(([key, value]) => !value.materia_prima)
  .reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

  products.data = filtrados;

  return res.json(products);
});
router.post('/getProductsScan', (req, res) => {
  const data = req.body.token;
  return res.json(database.getAllProducts(data));
});
router.post('/getAllVentas', (req, res) => {
  const data = req.body.token;
  return res.json(database.getAllVentas(data));
});

router.post('/getProduct/:id', (req, res) => {
  const data = req.body.token;
  const id = req.params.id;

  return res.json(database.getProduct(id, data));
})


// ROLES DE LA APP PRINCIPAL -------- ROLES//

router.post('/createRole', (req, res) => {
  const data = req.body;
  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a las funciones." });
  if (!data.role) return res.json({ message: "Agrega la información del rol." });

  return res.json(database.createRole(data.role, data.token));
})

router.post('/editRole', (req, res) => {
  const data = req.body;

  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a las funciones" });
  if (!data.role) return res.json({ message: "Agrega la información del rol" });
  if (!data.role.perms) return res.json({ message: "Agrega la información de permisos." });

  return res.json(database.editRole(data.role, data.token));
})

router.post('/deleteRole', (req, res) => {
  const data = req.body;

  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a las funciones." });
  if (!data.role) return res.json({ message: "Agrega el nombre del rol para poder eliminarlo." });

  return res.json(database.deleteRole(data.role, data.token));
})



let ventasCount = 0;
let ventasTotales = 0;

let ventasTOP = 10;

// VENTAS MANAGER DE LA APP PRINCIPAL ---- VENTAS//
router.post('/createVenta', (req, res) => {
  const data = req.body;

  if (!data.venta) return res.json({ message: "Agrega la información de venta." });
  if (data.total_recibido === undefined || data.total_recibido === null || data.total_recibido === '') return res.json({ message: "Agrega el total recibido por parte del cliente." });
  if (!data.token) return res.json({ message: "Agrega el token para registrar la venta con tu usuario." });

  let venta_creada = database.createVenta(data.venta, Number(removeCommaSeparators(String(data.total_recibido))), data.token, data.mayor, null, data.clientId, data.deudorId, data.date);

  if(venta_creada.data){
    ventasCount += 1;
    ventasTotales += Number(venta_creada.data.total_pago);

    if(ventasCount < ventasTOP) return;


    ventasCount = 0;
    const mensajeWhatsapp = 
  `✅ Ventas registradas con éxito!

  💵 Recibido: $${formatNumber(venta_creada.data.recibido)}
  🧾 Total a pagar: $${formatNumber(venta_creada.data.total_pago)}
  🔄 Vueltas entregadas: $${(venta_creada.data.vueltas)}`;


    whatsapp(mensajeWhatsapp);
  }

  return res.json(venta_creada);
})

router.post('/createVentaDigital', (req, res) => {
  const data = req.body;

  let method = database.method(data.type);
  if(!method.data) return res.json(method);

  let creatingVenta = database.createVenta(data.venta, Number(removeCommaSeparators(String(data.total_recibido))), data.token, data.mayor, method.data.name, data.clientId, data.deudorId, data.date);
  if(!creatingVenta.data) return res.json(creatingVenta);

  database.addToGeneral({
    desc: `Pago de venta`,
    monto: creatingVenta.data.total_pago,
    digital: method.data.name
  });

  whatsapp(`
*Venta Pagada Por ${method.data.name}*,
Valor: *${formatNumber(creatingVenta.data.total_pago)}*
  `)

  res.json({message: `Pago realizado por ${data.type} exitosamente`, data: method.data, venta: creatingVenta});
});

router.post('/editVenta', (req, res) => {
  const data = req.body;

  if (!data.venta) return res.json({ message: "Agrega la información de la venta." });
  if (!data.venta.id) return res.json({ message: "Agrega el id de la venta." });
  if (!data.total_recibido) res.json({ message: "Agrega el total recibido del cliente." });

  return res.json(database.editVenta(data.venta, data.total_recibido));
})
router.post('/deleteVenta', (req, res) => {
  const data = req.body;

  if (!data.venta) return res.json({ message: "Agrega la información de la venta." });

  return res.json(database.deleteVenta(data.venta, data.clienteId));
})

router.post('/deleteVentaEdit', (req, res) => {
  const data = req.body;

  if (!data.venta) return res.json({ message: "Agrega la información de la venta." });

  let dataToSend = database.deleteVenta(data.venta);
  dataToSend.return = false;
  return res.json(dataToSend);
})

router.post('/editVentaDate', (req, res) => {
  const data = req.body;

  if (!data.id) return res.json({ message: "Agrega el id de la venta." });
  if (!data.date) return res.json({ message: "Agrega la nueva fecha de la venta." });
  if (!data.token) return res.json({ message: "Agrega el token para autorizar la operación." });

  return res.json(database.editVentaDate(data.id, data.date, data.token));
})


// CLIENTES --- CLIENTES//
router.post('/createClient', (req, res) => {
  const data = req.body;

  if (!data.client) return res.json({ message: "Agrega la información del cliente" });
  if (!data.token) return res.json({ message: "Agrega el token para acceder a la información" });

  return res.json(database.createClient(data.client, data.token));
})
router.post('/createClientsBulk', (req, res) => {
  const data = req.body;

  if (!data.clientes) return res.json({ message: "Agrega la lista de clientes a importar." });
  if (!data.token) return res.json({ message: "Agrega el token para acceder a la información" });

  return res.json(database.createClientsBulk(data.clientes, data.token));
})
router.post('/editClient', (req, res) => {
  const data = req.body;

  if (!data.client) return res.json({ message: "Agrega la información del cliente" });
  if (!data.token) return res.json({ message: "Agrega el token para acceder a la información" });

  return res.json(database.editClient(data.client, data.token));
})
router.post('/deleteClient', (req, res) => {
  const data = req.body;

  if (!data.client) return res.json({ message: "Agrega la información del cliente." });
  if (!data.token) return res.json({ message: "Agrega el token para poder acceder a la informacón." });

  return res.json(database.deleteClient(data.client, data.token));
})

router.post('/getAllClients', (req, res) => {
  const data = req.body;

  if (!data) return res.json({ message: "Agrega el token del usuario." });

  return res.json(database.getClients(data.token));
})

router.post('/getClientesCompletos', (req, res) => {
  const data = req.body;

  if (!data) return res.json({ message: "Agrega el token del usuario." });

  return res.json(database.getClientesCompletos(data.token));
})

router.post('/getComprasCliente', (req, res) => {
  const { id, token } = req.body || {};
  if (id == null) return res.json({ message: "Agrega el id del cliente." });
  if (!token) return res.json({ message: "Agrega el token para acceder a la información." });

  return res.json(database.getComprasCliente(id, token));
})

// USERS FUNCTIONS -- DE LA FUNCION PRINCIPAL

router.post('/createUser', (req, res) => {
  const data = req.body;

  if (!data.user) return res.json({ message: "Agrega la información del usuario" });
  if (!data.token) return res.json({ message: "Agrega el token del usuario." });

  return res.json(database.adminCreateUser(data.user, data.token));
})

router.post('/editUser', (req, res) => {
  const data = req.body;

  if (!data.user) return res.json({ message: "Agrega la información del usuario" });
  if (!data.token) return res.json({ message: "Agrega el token del usuario." });

  return res.json(database.adminEditUser(data.user, data.token));
})



router.post('/deleteUser', (req, res) => {
  const data = req.body;

  if (!data.user) return res.json({ message: "Agrega la información del usuario" });
  if (!data.token) return res.json({ message: "Agrega el token del usuario." });

  return res.json(database.adminDeleteUser(data.user, data.token));
})

// FUNCTIONS VARIATED
router.post('/getAllData', (req, res) => {
  const token = req.body.token;

  if (!token) return res.json({ message: "Agrega el token." });

  if (!database.validatePerms(token, 'facturar')) return res.json({ message: "Parece que no tienes permisos suficientes." });
  let all_data = database.db.start().data.simple;
  all_data.users = undefined;
  all_data.id = undefined;
  all_data.roles = undefined;
  all_data.logs = undefined;
  return res.json({ message: "All Data", data: all_data });
})

router.post('/getAllVentas', (req, res) => {
  const token = req.body.token;
  if(!token) return res.json({message: "Agrega el token"});

  if(!database.validatePerms(token, 'facturar')) return res.json({message: "Fallo de servidor"});
  let allVentas = database.getData('/data/simple/ventas');

  return res.json({message: "Ventas descargadas satisfactoriamente", data: allVentas});
})

router.post('/configServ', (req, res) => {
  const token = req.body.token;

  if (!token) return res.json({ message: "Tienes que tener una sesion iniciada para acceder a este servicio." });

  if (!database.validatePerms(token, 'all')) return res.json({ message: "Parece que no tienes permisos suficientes para configurar esto." });

  let finalDataToReturn = database.db.getData('/data/simple', ['/accounting', '/bodega', '/pedidos', '/pedidos_finalizados', '/pedidos_notconfirmed', '/products']);

  res.json({ message: "Acceso concedido", data: finalDataToReturn })
})

// MOVIMIENTOS DE CAJA
router.post('/registrarCaja', async (req, res) => {
  const data = req.body;

  let inforegistroCaja = await database.registrarCaja(data.caja, data.token);

  if(!inforegistroCaja) return res.json(inforegistroCaja);

  let cajaInfo = inforegistroCaja.data;

  return res.json(inforegistroCaja);
})

router.post('/reabrirCaja', (req, res) => {
  const token = req.body.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  return res.json({message: "Acceso valido", data: database.db.getData('/data/simple/caja')});
})


// ---------------------------------------------------------------------------------
// NUEVAS FUNCIONES CONTABLES ------------------------------------------------------
// ---------------------------------------------------------------------------------


// -----------------------------------------
// CONTABILIDAD 
// ----------------------------------------

function contabilidadVentas(numeroGrande, numeroPequeño){
  const gettingCaja = database.db.getData('/data/simple/caja');
  let finallyArray = converterArray(gettingCaja);

  let finalDayContable = {
    ventas: 0,
    egresos: 0,
    products: {},
    topSellers: {}
  }

  let actualDate = new Date()-0;

  let dia = 86400000;


  let finalSing = new Date()-0;

  finallyArray.reverse().forEach((element, i, array) => {

    let dateCerrada = (new Date(element.cerrada)-0) + (dia*numeroGrande);

    if(finalSing > dateCerrada) return;

    finalDayContable.ventas += Number(element.total_recibido);
    finalDayContable.egresos += (Number(element.egreso) - Number(element.ingreso));

    if(element.ventas_hechas){
      converterArray(element.ventas_hechas).forEach((element2) => {
        if(!element2.venta) return;
        let arrayingVenta = converterArray(element2.venta);

        arrayingVenta.forEach((element2) => {
          if(finalDayContable.products[element2.id]){
            finalDayContable.products[element2.id].cantidad += Number(element2.cantidad);
            finalDayContable.products[element2.id].recogido += (element2.price ?? element2.price_mayor ?? 0) * element2.cantidad;
          }else {
            finalDayContable.products[element2.id] = {
              cantidad: Number(element2.cantidad),
              recogido: (element2.price ?? element2.price_mayor ?? 0) * element2.cantidad,
              name: element2.name,
              id: element2.id
            }
          }
        })
      })
    }

    if (finalDayContable.topSellers[element.responsableRegistered?element.responsableRegistered:element.closedByName]){
      finalDayContable.topSellers[element.responsableRegistered?element.responsableRegistered:element.closedByName].egreso += (Number(element.egreso) - Number(element.ingreso));
      finalDayContable.topSellers[element.responsableRegistered?element.responsableRegistered:element.closedByName].ventas += Number(element.total_recibido);
    }else {
      finalDayContable.topSellers[element.responsableRegistered?element.responsableRegistered:element.closedByName] = {closedBy: element.responsableRegistered?element.responsableRegistered:element.closedByName, egreso: (Number(element.egreso) - Number(element.ingreso)), ventas: Number(element.total_recibido)};
    }
  })

  return finalDayContable;
}


router.post('/app/contabilidad/ventas/todas', (req, res) => {
  const finaldata = req.body;
  const token = finaldata.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  let finalDayContable = contabilidadVentas(9000, 3000);

  res.send({message: "Descargado", data: finalDayContable});
})

router.post('/app/contabilidad/ventas/mensuales', (req, res) => {
  const finaldata = req.body;
  const token = finaldata.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  let finalDayContable = contabilidadVentas(90, 30);

  console.log(finalDayContable)

  res.send({message: "Descargado", data: finalDayContable});
});


router.post('/app/contabilidad/ventas/quincenales', (req, res) => {
  const finaldata = req.body;
  const token = finaldata.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  let finalDayContable = contabilidadVentas(30, 15);

  console.log(finalDayContable)

  res.send({message: "Descargado", data: finalDayContable});
});

router.post('/app/contabilidad/ventas/semanales', (req, res) => {
  const finaldata = req.body;
  const token = finaldata.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  let finalDayContable = contabilidadVentas(30, 7);
  
  res.send({message: "Descargado", data: finalDayContable});
})

router.post('/app/contabilidad/ventas/diarias', (req, res) => {
  const finaldata = req.body;
  const token = finaldata.token;

  if (!database.validatePerms(token, 'all')) return res.json({message: "Parece que no tienes permisos"});

  let finalDayContable = contabilidadVentas(7, 2);

  res.send({message: "Descargado", data: finalDayContable});
});




// ---------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------




// ---------------------------------------------------------------------------------
// CORREO DE AVISO (GMAIL) - configurado desde la interfaz de la app
// ---------------------------------------------------------------------------------

router.get('/config/mail', (req, res) => {
  try {
    res.json(apis_mail.getConfig());
  } catch (err) {
    res.json({ user: '', to: '' });
  }
});

router.post('/config/mail', (req, res) => {
  const data = req.body || {};
  let receivedUser = database.getUserToken(data.token);
  if (!receivedUser.data) return res.send({ message: "La sesion de usuario ya no es valida" });
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if (!validatePerms) return res.send({ message: "No tienes permisos suficientes para configurar el correo" });
  try {
    const mail = apis_mail.saveConfig(data.mail || {});
    res.json({ message: "Correo de aviso guardado", data: { user: mail.user, to: mail.to } });
  } catch (err) {
    res.status(500).json({ message: "Error guardando la configuracion: " + err.message });
  }
});

router.post('/config/mail/test', async (req, res) => {
  const data = req.body || {};
  let receivedUser = database.getUserToken(data.token);
  if (!receivedUser.data) return res.send({ message: "La sesion de usuario ya no es valida" });
  let validatePerms = database.validatePerms(receivedUser.data.token, 'all');
  if (!validatePerms) return res.send({ message: "No tienes permisos suficientes para configurar el correo" });
  try {
    if (data.mail && data.mail.user && data.mail.pass && data.mail.to) apis_mail.saveConfig(data.mail);
    const ok = await apis_mail({
      subject: "Correo de prueba - Servidor ACAPE",
      text: "Hola,\n\nTu correo quedo conectado correctamente y recibiras ahi el enlace de acceso remoto cada vez que enciendas el servidor.\n\n- Servidor ACAPE"
    });
    res.json(ok
      ? { message: "Correo de prueba enviado correctamente" }
      : { message: "No se pudo enviar el correo de prueba. Revisa que la contraseña de aplicacion sea correcta." }
    );
  } catch (err) {
    res.status(500).json({ message: "Error al enviar: " + err.message });
  }
});

router.use((req, res) => {
  res.status(404).render('another/not-configured.html');
})

server.use(express.json())
server.use(router);

server.set('port', 9000);

const service = server.listen(server.get('port'), () => {
  console.log(`Aplicativo y servidor encendido en el puerto: ${server.get('port')}`);
  console.timeEnd('service');

  require('./APIS/tunnel.js').start();

  let finalStock = database.viewingStock();
  if(!finalStock[0]) return;
});

module.exports = { service, database, server, openCashDrawer }
