// VARIABLES
const Admin = require('./realtime-db-json.js');
const sha256 = require('crypto-js/sha256');
const sha3 = require('crypto-js/sha3');
const {converter, timems, getTime, getTimeLong, getRemainTime, forDate} = require('./timems-server.js');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const carpetaFacturas = path.join(__dirname, './../uploads');

const whatsapp = require('./whatsapp.services.js');

function limpiarCantidad(cantidad) {
  // Convierte a string por seguridad
  cantidad = cantidad.toString();
  // Si termina en '.00', quítalo
  if (cantidad.endsWith('.00')) {
    return cantidad.slice(0, -3);
  }
  return cantidad;
}

// GENERAR TOKENS PARA LOS PRODUCTOS, MERAMENTE PRODUCTOS

function generarToken(numeroUsuario) {
  // Convertir el número a string
  const numeroString = numeroUsuario.toString();

  // Combinar el número con una cadena aleatoria
  const cadenaAleatoria = crypto.randomBytes(30).toString('hex'); // Genera 20 bytes aleatorios en hexadecimal
  const cadenaCombinada = numeroString + cadenaAleatoria;

  // Generar un UUID usando la cadena combinada
  const token = uuidv4(cadenaCombinada);

  // Devolver el token
  return token;
}

function removeCommaSeparators(input) {
  return input.replace(/,/g, '');
}

// REDONDEA UN MONTO A 2 DECIMALES PARA EVITAR ERRORES DE PUNTO FLOTANTE EN VENTAS POR PESO
function redondearMoneda(numero) {
  return Math.round(Number(numero) * 100) / 100;
}

function formatNumber(number) {
  // Limita a dos decimales
  const formattedNumber = Number(number).toFixed(2);

  // Aplica el formateo con comas
  return formattedNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// CONVERTIR CUALQUIER OBJETO EN UN ARREGLO 

function converterArray(object){
	if(!object) return [];
	let keys = Object.keys(object);
	let arrayToReturn = [];
	
	keys.forEach((element, i, array) => {
		arrayToReturn.push(object[element]);
	})

	return arrayToReturn;
}

function sumByDate(array) {
  // Ordenar el arreglo por fecha
  array.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Objeto para almacenar los resultados
  const result = {};

  // Recorrer el arreglo y sumar los valores por fecha
  array.forEach(item => {
    const date = new Date(item.date).toLocaleDateString();
    if (result[date]) {
      result[date].value += item.value;
    } else {
      result[date] = { date: new Date(date).toLocaleDateString(), value: item.value };
    }
  });

  // Convertir el objeto de resultados en un arreglo
  return Object.values(result);
}


// CLASE PRINCIPAL
class Database {

	// RECIBIR TODOS LOS DATOS DEL USUARIO
	constructor(config = {}){
		this.user = config.user?config.user:"admin";
		this.password = config.password?config.password:"server";
		this.route = config.route?config.route:"./system",
		this.name = config.name;
		this.db = null;
		this.data = null;
		this.anteriorData = null;
	}

	// INICIALIZAR LA BASE DE DATOS Y GUARDAR TODAS LAS CATEGORIAS DE TRABAJO
	start(){
		this.db = new Admin(this.route);

		// EN CASO DE QUE NO EXISTE ALGUNA DE ESTAS CATEGORIAS SE CREA, EN TANTO LA MAS IMPORTANTE ES LA DE USUARIOS Y DESPUES LA ID
		if(!this.db.initData('/data/simple/id')) {
			this.db.setData('/data/simple/id', {
				users: 0,
				products: 0,
				ventas: 0,
				logs: 0,
				clientes: 0,
				caja: 0,
				facturas: 0,
				entradas: 0,
				deudores: 0,
				pedidos: 0,
				methods: 0,
				bodega: 0
			})
		};

		if(!this.db.initData('/data/simple/accounting')){
			this.db.setData('/data/simple/accounting', {value: 0})
		};

		// VALIDACIÓN DE ROLES
		if(!this.db.initData('/data/simple/roles')){
			this.db.setData('/data/simple/roles', {
				owner: {
					all: "true",
					productManager: "true",
					userManager: "true",
					roleManager: "true",
					view: "true",
					clientManager: "true",
					facturar: "true",
					inventario: "true"
				},
				user: {
					view: "true"
				}
			})
		}

		return {message: "Servicio iniciado"};
	}

	// NO ES NECESARIO OPTIMIZAR
	// NECESARIAS LAS FUNCIONES DE SERVICIO?
	serviceSet(data, token){
		let valid = this.validatePerms(token);

		if(!valid) return {message: "No tienes permisos suficientes para ejecutar esta acción"};

		let services = this.db.getData('/data/simple/services');

		services.time = data.time?data.time:services.time;
		services.mail = data.mail?data.mail:services.mail;

		this.db.setData('/data/simple/services', services);

		return {message: "Información guardada satisfactoriamente.", data: services};
	}

	servicesGet(token){
		let valid = this.validatePerms(token);

		if(!valid) return {message: "No tienes permisos suficientes para ejecutar esta acción"};

		let services = this.db.getData('/data/simple/services');

		return {message: "Información Descargada Satisfactoriamente", data: services};
	}

	validatingUsering(user){
		let final_user = this.getUser(user.user, user.password);
		if(!final_user.data) return {message: "Error, Este usuario es invalido la contraseña o el usuario"};

		let validatePerms = this.validatePerms(final_user.data.token, 'all');
		if(!validatePerms) return {message: "No tienes permisos suficientes para manejar zopelapp."};

		return {message: "Correcto", data: final_user};
	}

	validatingUseringToken(token){
		let final_user = this.getUserToken(token);
		if(!final_user.data) return {message: "Error, Este usuario es invalido la contraseña o el usuario"};

		let validatePerms = this.validatePerms(final_user.data.token, 'all');
		if(!validatePerms) return {message: "No tienes permisos suficientes para manejar zopelapp."};

		return {message: "Correcto", data: final_user};
	}

	// ACTUALMENTE FUNCIONAN ------------
	bodegaGetIndirectos(user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let indirectos = this.db.getData('/data/simple/zopelapp/indirectos');

		return {message: "Información descargada correctamente.", data: indirectos};
	}

	// BODEGAINDIRECTOSCREATE OPTIMIZADA
	bodegaIndirectosCreate(data = {}, user = {}){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let id = this.db.getData('/data/simple/id').indirectos;
		if(!data.name) return {message: "Rellena todos los espacios. Agrega el nombre"};
		if(!data.daycounter) return {message: "Rellena todos los espacios, Agrega los dias de gasto"};
		if(!data.costo) return {message: "Rellena todos los espacios, Agrega el costo"};
		if(!data.description) return {message: "Rellena todos los espacios, Agrega la descripción"};

		let db_id = id?id:0;

		db_id = db_id+1;

		let finalIndirecto = {
			name: data.name,
			daycounter: data.daycounter,
			costo: data.costo,
			id: db_id,
			description: data.description
		}

		this.db.setData('/data/simple/id', {indirectos: db_id});
		this.db.setData(`/data/simple/zopelapp/indirectos/${db_id}`, finalIndirecto);

		return {message: "Gasto indirecto nuevo agregado", data: finalIndirecto};
	}

	// OPTIMIZADA
	bodegaIndirectosEdit(data, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let findingIndirecto = this.db.initData(`/data/simple/zopelapp/indirectos/${data.id}`);
		if(!findingIndirecto) return {message: "Este gasto indirecto no existe"};

		findingIndirecto.name = data.name;
		findingIndirecto.description = data.description;
		findingIndirecto.daycounter = data.daycounter;
		findingIndirecto.costo = data.costo;

		this.db.setData(`/data/simple/zopelapp/indirectos/${data.id}`, findingIndirecto);

		return {message: "Cambios guardados exitosamente", data: findingIndirecto};
	}

	// OPTIMIZADA
	bodegaIndirectosDelete(id, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let indirectos = this.db.initData(`/data/simple/zopelapp/indirectos/${id}`);
		if(!indirectos) return {message: "Este gasto indirecto no existe."};

		this.db.removeData(`/data/simple/zopelapp/indirectos/${id}`);

		return {message: "Información descargada correctamente", data: indirectos};
	}


	// OPTIMIZADA
	bodegaGetFormulas(user){
		let valid = this.getUserToken(user.user);
		if(!valid.data) return valid;

		let formulas = this.db.getData('/data/simple/zopelapp/formulas');

		return {message: "Información descargada satisfactoriamente", data: formulas};
	}


	// OPTIMIZADA
	bodegaCreateFormula(data, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		if(!data.name) return {message: "Agrega el nombre de la formula"};
		if(!data.description) return {message: "Agrega la descripción de la formula"};
		if(!data.products) return {message: "Agrega los productos a la formula"};
		if(!data.products[0]) return {message: "Agrega los productos a la formula"};

		let id = this.db.getData('/data/simple/id').formulas;
		let db_id = id?id:0;

		db_id = db_id + 1;

		let final_formula = {
			name: data.name,
			description: data.description,
			products: data.products,
			date: new Date(),
			id: db_id
		}

		this.db.setData('/data/simple/id', {formulas: db_id});

		this.db.setData(`/data/simple/zopelapp/formulas/${db_id}`, final_formula);

		return {message: "Formula Creada Satisfactoriamente", data: final_formula};
	}


	// OPTIMIZADA
	bodegaDeleteFormula(data, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let findingformula = this.db.initData(`/data/simple/zopelapp/formulas/${data}`);
		if(!findingformula) return {message: "Esta formula no existe o no se encuentra registrada"};

		this.db.removeData(`/data/simple/zopelapp/formulas/${data}`);

		return {message: "Formula Eliminada Satisfactoriamente", data: findingformula};
	}

	// OPTIMIZADA
	bodegaSaveRegister(data, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let id = this.db.getData('/data/simple/id').registrosBodega;

		let db_id = id?id:0;

		db_id = db_id + 1;
		let findingRegistro = {
			data: data,
			id: db_id,
			date: new Date()-0
		};

		this.db.setData(`/data/simple/zopelapp/registros/${db_id}`, findingRegistro);
		this.db.setData('/data/simple/id', {registrosBodega: db_id});

		return {message: "Registro Guardado satisfactoriamente", data: findingRegistro};
	}


	// OPTIMIZADA
	getRegistros(user){
		let valid = this.getUserToken(user.user);
		if(!valid.data) return valid;

		let registros = this.db.getData('/data/simple/zopelapp/registros');

		return {message: "Registros Descargados", data: registros};
	}


	// OPTIMIZADA
	getRegistroByID(id, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let registros = this.db.initData(`/data/simple/zopelapp/registros/${id}`);
		if(!registros) return {message: "Registro no encontrado o ya eliminado, prueba actualizar la pagina"};

		return {message: "Registro descargado satisfactoriamente", data: registros};
	}

	// OPTIMIZADA
	deleteRegistroByID(id, user){
		let valid = this.getUserToken(user);
		if(!valid.data) return valid;

		let registro = this.getRegistroByID(id, user);

		if(!registro.data) return registro;

		this.db.removeData(`/data/simple/zopelapp/registros/${id}`);

		return {message: "Registro eliminado satisfactoriamente", data: registro};
	}



	// ZOPELAPP FUNCTIONS TO SAVE


	// PEDIDOS ?? FUNCIONALIDAD??
	createPedido(pedido, token){
		let validateUser = this.validatePerms(token, 'facturar');
		let getUser = this.getUserToken(token);
		if(!validateUser) return {message: "El usuario parece no tener permisos"};
		if(!pedido.cliente) return {message: "Pon la información del cliente"};
		if(!pedido.phone_cliente) return {message: "Tienes que poner el telefono del cliente"};
		if(!pedido.entrega) return {message: "Pon la fecha de entrega"};
		if(!pedido.hora) return {message: "Pon la hora de entrega"};
		if(!pedido.products[0]) return {message: "Por lo minimo se tiene que facturar un producto"};

		let ids = this.db.getData('/data/simple/id');
		let pedidos = this.db.getData('/data/simple/pedidos');
		ids.pedidos = ids.pedidos+1;
		
		pedido.id = ids.pedidos;

		pedido.received = token;
		let cotizando = this.cotizar(pedido.products, token, pedido.mayor);
		if(!cotizando.data) cotizando;

		pedido.cotizar = cotizando.data;
		pedido.cancelado = pedido.abono == pedido.cotizar.total_pago?"true":"false";
		pedido.saldo = pedido.cotizar.total_pago - pedido.abono;
		pedido.atendido = getUser.data.user;

		this.db.setData(`/data/simple/pedidos/${pedido.id}`, pedido);
		this.db.setData('/data/simple/id/pedidos', ids.pedidos);

		return {message: "Pedido guardado exitosamente", data: pedido};
	}

	setPayPedido(id, pago, token){
		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		let pedido = this.db.getData(`/data/simple/pedidos/${id}`);
		if(!pedido) return {message: "Este pedido no existe o ya fue entregado"};

		pedido.abono = Number(pedido.abono) + Number(pago);
		pedido.cancelado = JSON.stringify(Number(pedido.abono) >= Number(pedido.cotizar.total_pago));
		pedido.saldo = Number(pedido.saldo) - Number(pago)

		this.db.setData(`/data/simple/pedidos/${pedido.id}`, pedido);

		return {message: "Pago de abono hecho", data: pedido, pago: pago};
	}

	deletePedido(id_pedido, token){
		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		let pedido = this.db.getData(`/data/simple/pedidos/${id_pedido}`);
		if(!pedido) return {message: "Este pedido no existe o ya fue entregado"};

		this.db.removeData(`/data/simple/pedidos/${id_pedido}`);

		return {message: "Pedido eliminado satisfactoriamente", data: pedido};
	}

	finalizarPedido(id_pedido, token){
		let pedido = this.deletePedido(id_pedido, token);
		if(!pedido.data) return pedido;

		this.db.setData(`/data/simple/pedidos_finalizados/${pedido.id}`, pedido);

		return {message: "Pedido finalizado de forma correcta", data: pedido.data};
	}

	getPedidos(){
		let data = this.db.getData('/data/simple/pedidos');

		return data;
	}

	// ------------- FINALIZACION DE PEDIDOS

	// METODOS DE PAGO // ACTUALIZACION COMPLETA PORQUEEEE: ESTO ESTA MAL CONFIGURADO Y NECESITA UNA MEJORA SIGNIFIICATIVA

	// --------------------------------------------------------------------------------------------
	// -> ACTUALIZACION
	// --------------------------------------------------------------------------------------------

	// OPTIMIZADA
	createMethodPay(method, token){
		let validateUser = this.validatePerms(token, 'all');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		let findingMethod = this.db.initData(`/data/simple/methods/${method.name}`);

		let methods_type = ['credito', 'digital', 'efectivo', 'cartera'];
		let finding_type = methods_type.find(ch => ch == method.type);
		if(!finding_type) return {message: `El tipo de pago ${method.type} no existe. Los metodos de pago disponibles son: ${methods_type.map(ch => ch)}`};
		if(findingMethod) return {message: "Este metodo de pago ya existe"};

		method.value = 0;
		let finalMethod = method;

		this.db.setData(`/data/simple/methods/${method.name}`, finalMethod);

		return {message: "Metodo de pago guardado exitosamente", data: finalMethod};
	}

	// optimizada
	editMethodPay(method, token){
		let validateUser = this.validatePerms(token, 'all');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		// let methods = this.db.getData('/data/simple/methods');
		let findingMethod = this.db.initData(`/data/simple/methods/${methods.name}`);

		let methods_type = ['credito', 'digital', 'efectivo'];
		let finding_type = methods_type.find(ch => ch == method.type);
		if(!finding_type) return {message: `El tipo de pago ${method.type} no existe. Los metodos de pago disponibles son: ${methods_type.map(ch => ch)}`};
		if(!findingMethod) return {message: "Este metodo de pago no existe o no se encuentra registrado."};

		method.desc = method.desc?method.desc:`Metodo de pago tipo: ${method.type}`
		let finalMethod = method;

		this.db.setData(`/data/simple/methods/${method.name}`, finalMethod);

		return {message: "Cambios guardados exitosamente", data: method}
	}

	// optimizada
	deleteMethodPay(method, token){
		let validateUser = this.validatePerms(token, 'all');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		// let methods = this.db.getData('/data/simple/methods');
		let findingMethod = this.db.initData(`/data/simple/methods/${method.name}`);

		if(!findingMethod) return {message: "Este metodo de pago no existe o no fue eliminado."};

		this.db.removeData(`/data/simple/methods/${findingMethod.name}`);

		return {message: "Metodo de pago eliminado", data: findingMethod};
	}

	// optimizada
	method(name){
		let method_1 = this.db.initData(`/data/simple/methods/${name}`);
		if(!method_1) return {message: "Este metodo de pago no existe"};

		return {message: "Metodo de pago encontrado", data: method_1};
	}

	// optimizada
	getMethods(){
		return this.db.getData('/data/simple/methods');
	}

	// --------------------------------------------------------------------------------------------
	// -> ACTUALIZACION
	// --------------------------------------------------------------------------------------------


	// MOVIMIENTOS REGISTRADOS, RECORDAR GENERAR FACTURAS CUENTAS DE COBRO Y OTROS DOCUMENTOS NECESARIOS PARA QUE TODO ESTO FUNCIONE DE MEJOR MANERA, TENIENDO RECIBOS Y REGISTRO DE CADA MOVIMIENTO Y SI ES POSIBLE AGREGARLE


	// OPTIMIZADA
	addToGeneral(value){
		let accounting = this.db.getData('/data/simple/accounting', ['movements']);

		let finalMovement = {
			type: value.digital?`${value.digital}: ${value.desc?value.desc:"Sin Descripción"}`:`Global: ${value.desc?value.desc:"Sin Descripción"}`,
			sign: "+",
			money: +value.monto,
			date: new Date().toString(),
			id: generarToken(new Date().toString()),
			digital: value.digital,
			dateID: new Date()-0
		};

		if(!value.digital){
			accounting.value = accounting.value + Number(value.monto);
		}else {
			let findingMethod = this.method(value.digital);

			if(!findingMethod.data) return {message: "Esta cartera no fue encontrada."};

			findingMethod.data.value = findingMethod.data.value + Number(value.monto);

			this.db.setData(`/data/simple/methods/${findingMethod.data.name}`, {value: findingMethod.data.value});
		}

		this.db.setData('/data/simple/accounting', accounting);

		// AHORA QUE HAGO PARA HACER PUSH DE MOVIMIENTOS
		this.db.setData(`/data/simple/accounting/movements/${finalMovement.id}`, finalMovement)

		return {message: "Movimiento guardado exitosamente", data: finalMovement};
	}

	// OPTIMIZADA
	removeToGeneral(value) {
		let accounting = this.db.getData('/data/simple/accounting', ['movements']);

		let finalMovement = {
			type: value.digital 
				? `${value.digital}: ${value.desc ? value.desc : "Sin Descripción"}`
				: `Global: ${value.desc ? value.desc : "Sin Descripción"}`,
			sign: "-",
			money: -Number(value.monto),
			date: new Date().toString(),
			id: generarToken(new Date().toString()),
			digital: value.digital
		};

		if (!value.digital) {
			accounting.value -= Number(value.monto);
		} else {
			let findingMethod = this.method(value.digital);

			if (!findingMethod.data) return { message: "Esta cartera no fue encontrada." };

			findingMethod.data.value -= Number(value.monto);

			this.db.setData(`/data/simple/methods/${findingMethod.data.name}`, { value: findingMethod.data.value });
		}

		this.db.setData('/data/simple/accounting', accounting);

		// ✅ Guarda el movimiento como archivo independiente, igual que en addToGeneral
		this.db.setData(`/data/simple/accounting/movements/${finalMovement.id}`, finalMovement);

		return { message: "Movimiento guardado exitosamente", data: finalMovement };
	}

	// OPTIMIZADA
	transferirGeneral(from, to, monto){
		if(from == to) return {message: "Parece que estas intentando transferir a la misma cuenta."};

		let validatingFrom = from == "efectivo" ? true : (this.method(from).data);
		let validatingTo = from == "efectivo" ? true : (this.method(from).data);

		if(!validatingFrom) return {message: "La cartera de envio no se encuentra disponible"};
		if(!validatingTo) return {message: "La cartera de recepción no se encuentra disponible"};

		this.removeToGeneral({
			digital: from=="efectivo"?null:from,
			desc: `Transferencia a ${to}`,
			monto: Number(monto?monto:0)
		});

		this.addToGeneral({
			digital: to=="efectivo"?null:to,
			desc: `Transferencia Recibida De ${from}`,
			monto: Number(monto?monto:0)
		})

		return {message: "Transferencia terminada", data: {from, to, monto}};
	}

	// OPTIMIZADA
	getDeudores(token){
		return this.getClientesConDeuda(token);
	}

	// AÑADIR DEUDA A UN CLIENTE: incrementa la deuda y registra el movimiento
	addDeuda(id, deuda = {}, token){
		if(!id) return {message: "Tienes que poner el id del cliente"};
		if(!deuda.monto) return {message: "Tienes que poner el valor de la deuda"};
		if(!deuda.desc) return {message: "Tienes que poner la descripcion de la deuda"};
		
		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};		

		let clientes = this.db.getData('/data/simple/clientes');

		let finding_client = clientes[id];
		if(!finding_client) return {message: "Este cliente no existe"};

		clientes[id].deuda = Number(clientes[id].deuda ? clientes[id].deuda : 0) + Number(deuda.monto);
		if(!clientes[id].cuenta_abierta) clientes[id].cuenta_abierta = new Date();

		let settings_data = converterArray(clientes[id].movements?clientes[id].movements:{});
		deuda.date = new Date().toString();
		deuda.sign = "-";
		settings_data.push(deuda);

		clientes[id].movements = settings_data;

		this.db.setData('/data/simple/clientes', clientes);

		return {message: "Deuda añadida exitosamente.", data: clientes[id], movement: deuda};
	}

	// PAGAR DEUDA DE UN CLIENTE: disminuye la deuda y registra el movimiento
	removeDeuda(id, deuda = {}, token){
		if(!id) return {message: "Tienes que poner el id del cliente"};
		if(!deuda.monto) return {message: "Tienes que poner el valor de la deuda"};
		if(!deuda.desc) return {message: "Tienes que poner la descripcion de la deuda"};
		
		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};		

		let clientes = this.db.getData('/data/simple/clientes');

		let finding_client = clientes[id];
		if(!finding_client) return {message: "Este cliente no existe"};

		let deudaActual = Number(clientes[id].deuda ? clientes[id].deuda : 0);
		let nuevoValor = deudaActual - Number(deuda.monto);
		if(nuevoValor < 0) nuevoValor = 0;

		clientes[id].deuda = nuevoValor;
		deuda.sign = "+"

		let settings_data = converterArray(clientes[id].movements?clientes[id].movements:{});
		settings_data.push(deuda);

		clientes[id].movements = settings_data;

		this.db.setData('/data/simple/clientes', clientes);

		return {message: "Deuda removida exitosamente.", data: clientes[id], movement: deuda};
	}

	// ----------------------------------------------------------------------------
	// -> POR ACTUALIZAR ^^
	// ----------------------------------------------------------------------------

	// OPTIMIZADA
	createPagoFijo(data, user){
		let valid = this.validatePerms(user);
		if(!valid) return {message: "No tienes permisos suficientes para generar un pago fijo"};

		const ids = this.db.getData('/data/simple/id').pagosFijos;

		let db_id = ids?ids:0;
		db_id = db_id + 1;

		let finalFijo = {
			name: data.name?data.name:"Factura Por Pagar",
			fijo: !data.fijo?"true":"false",
			monto: !data.fijo?(data.monto?removeCommaSeparators(data.monto):0):null,
			empieza: data.empieza?new Date(data.empieza)-0:new Date()-0,
			days: data.days,
			id: db_id
		};

		this.db.setData(`/data/simple/pagos-fijos/${db_id}`, finalFijo);
		this.db.setData('/data/simple/id', {pagosFijos: db_id});

		return {message: "Pago Fijo Creado.", data: finalFijo};
	}

	// OPTIMIZADA
	editPagoFijo(data, user){
		let valid = this.validatePerms(user);

		if(!valid) return {message: "No tienes permisos suficientes para generar un pago fijo"};

		if(!data.id) return {message: "Tienes que poner el id del pago fijo."};

		let getting = this.db.initData(`/data/simple/pagos-fijos/${data.id}`);

		if(!getting) return {message: "No se pudo encontrar este pago fijo"};

		getting.fijo = !data.fijo?"true":"false";
		getting.name = data.name?data.name:"Factura Por Pagar";
		getting.monto = !data.fijo?(data.monto?data.monto:0):null;
		getting.empieza = data.empieza?new Date(data.empieza)-0:new Date()-0;
		getting.days = data.days;

		this.db.setData(`/data/simple/pagos-fijos/${data.id}`, getting);

		return {message: "Pago fijo editado exitosamente", data: getting};
	}

	// OPTIMIZADA
	deletePagoFijo(id, user){
		let valid = this.validatePerms(user);
		if(!valid) return {message: "Este usuario no tiene permisos para lograr esto"};

		if(!id) return {message: "Agrega el id del pago"};

		let finding = this.db.initData(`/data/simple/pagos-fijos/${id}`);

		if(!finding) return {message: "Este pago fijo no existe."};

		this.db.removeData(`/data/simple/pagos-fijos/${id}`);

		return {message: "Datos removidos satisfactoriamente", data: finding};
	}

	// OPTIMIZAD
	setPagoFijo(data, user = {}){
		let valid = this.validatePerms(user);

		if(!valid) return {message: "No tienes permisos para ejecutar esta acción"};

		let getPay = this.db.initData(`/data/simple/pagos-fijos/${data.id}`);

		if(!getPay) return {message: "Este pago fijo no existe."};

		let ultimatePago = new Date(getPay.empieza) + timems(`${getPay.days}d`);
		getPay.empieza = ultimatePago;

		this.db.setData(`/data/simple/pagos-fijos/${data.id}`, getPay);

		this.removeToGeneral({
			desc: `Pagos Fijos: ${getPay.name}`,
			monto: Number(getPay.monto?getPay.monto:(data.monto?removeCommaSeparators(data.monto):0))
		})

		return {message: "Pago fijo hecho de la cartera global", data: getPay};
	}

	// REGISTRO DE CAJA ?? ESTO ES PELIGROSO Y DEJARA DE USARLO PORQUE TIENE MUCHOS FALLO Y NO CALCULA NO DA INFORMAS Y SOLO GENERA CIERRES.


	// OPTIMIZADA
	async registrarCaja(newCaja, token){
		if(!newCaja) return {message: "Agrega la información de la caja."};
		if(!token) return {message: "Agrega el usuario que hace el movimiento y cierre de la caja."};

		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		let finalUser = this.getUserToken(token);

		let ids = this.db.getData('/data/simple/id');
		// let caja = this.db.getData('/data/simple/caja');
		if(!newCaja.date) return {message: "La fecha de la caja no existe, agrega una para poder registrarla"};

		newCaja.date = newCaja.date?newCaja.date:new Date()-0;
		newCaja.cerrada = new Date().toString();
		newCaja.timeLapse = getTimeLong((new Date()-0) - new Date(newCaja.date));
		newCaja.closedBy = token;
		newCaja.closedByName = finalUser.data.user;

		ids['caja'] = (ids['caja']?ids['caja']:0) + 1;

		newCaja.id = newCaja.id?newCaja.id:ids.caja;

		this.addToGeneral({
			desc: `CAJAS: Cierre #${newCaja.id} - ${newCaja.responsableRegistered?responsableRegistered:newCaja.closedByName}`,
			sign: "+",
			monto: +(newCaja.value - newCaja.starting)
		});

		this.db.setData(`/data/simple/caja/${newCaja.id}`, newCaja);
		this.db.setData('/data/simple/id/caja', ids.caja);
		this.db.removeData('/data/simple/ventas');

		// HERESTAY
		await whatsapp(
		  `🧾 *CIERRE DE CAJA*\n\n` +
		  `👤 *Responsable:* ${newCaja.responsableRegistered?responsableRegistered:newCaja.closedByName}\n` +
		  `📅 *Fecha:* ${new Date(newCaja.cerrada).toLocaleString()}\n` +
		  `🕒 *Duración de la caja:* ${newCaja.timeLapse}\n` +
		  `🆔 *Caja N°:* ${newCaja.id}\n\n` +
		  
		  `📊 *Resumen del día:*\n` +
		  `• Total en ventas: ${formatNumber(newCaja.total_recibido)}\n` +
		  `• Ventas digitales: ${formatNumber(newCaja.value_digital || 0)}\n` +
		  `• Ingresos: ${formatNumber(newCaja.ingreso || 0)}\n` +
		  `• Egresos: ${formatNumber(newCaja.egreso || 0)}\n` +
		  `• Gastos netos: ${formatNumber(newCaja.egreso - newCaja.ingreso)}\n` +
		  `• Balance final: ${formatNumber(newCaja.value)}\n` +
		  `• Entregan: ${formatNumber(newCaja.value - newCaja.starting)}\n`
		);

		console.log(newCaja)


		return {message: "Caja guardada", data: newCaja};
	}


	
	// CREAR UN USUARIO ESTE COMANDO NO EXIGE ROL, SIN EMBARGO SE CREA OTRA FUNCION LLAMANDA callCreateUser QUE SI PEDIRA QUE TENGA PERMISOS PARA PODER CREAR UN USUARIO

	// --------------------------------------------------------------------
	// -> POR ACTUALIZAR >>
	// --------------------------------------------------------------------
	createUser(user, password, role){
		let users_fin = this.db.getData('/data/simple/users');
		let ids = this.db.getData('/data/simple/id');

		let users = converterArray(users_fin);
		let searching = users.find(ch => ch.user == user);

		if(!searching){
			ids.users += 1;
			let users_object = users_fin;
			users_object[ids.users] = {
				user: user,
				password: password,
				role: role?role:"user",
				id: ids.users,
				token: sha256(`${user}+${new Date()}`).toString(),
				sha256: sha256(user).toString()
			};

			users_object[ids.users].logs = this.createLog('createUser', users_object[ids.users].id);

			this.db.setData('/data/simple/users', users_object);
			this.db.setData('/data/simple/id', ids);

			return {message: "Usuario creado satisfactoriamente.", data: users_object[ids.users]};
		}else {
			return {message: "Este nombre de usuario ya se encuentro usado.", type: "error"};
		}
	}

	// ELIMINAR UN USUARIO POR EL TOKEN
	deleteUser(token){
		let userFinding = this.getUserToken(token);
		if(!userFinding.data) return userFinding;
		let users = this.db.getData('/data/simple/users');
		this.db.removeData(`/data/simple/users/${userFinding.data.id}`);
		return {message: "Usuario eliminado satisfactoriamente", data: userFinding.data};
	}

	// EDITAR USUARIO

	editUser(id, data){
		let users = this.db.getData('/data/simple/users');
		let userFinding = users[id];
		if(!userFinding) return userFinding;

		users[userFinding.id].user = data.user;
		users[userFinding.id].password = data.password;
		users[userFinding.id].role = data.role;

		this.db.setData(`/data/simple/users/${userFinding.id}`, users[userFinding.id]);
		return {message: "Usuario editado satisfactoriamente", data: users[userFinding.id]};
	}
	// OBTENER LA INFO DE UN USUARIO CON EL USUARIO Y LA CONTRASEÑA, ES MAS QUE TODO PARA EL LOGIN DE LA INTERFAZ
	getUser(user, password){
		let data = this.db.getData('/data/simple/users');

		let users = converterArray(data);
		let searching = users.find(ch => ch.user == user);
		if(!searching) return {message: "Este nombre no de usuario no existe.", type: "error"};

		if(searching.password != password) return {message: "La contraseña es incorrecta.", type: "error"};

		return {message: "Usuario iniciado.", data: searching};
	}

	// INICIAR A TRAVEZ DEL TOKEN
	getUserToken(token){
		let data = this.db.getData('/data/simple/users');
		let users = converterArray(data);
		let searching = users.find(ch => ch.token == token);
		if(!searching) return {message: "El token es invalido"};

		return {message: "Token iniciado", data: searching};
	}

	// --------------------------------------------------------------------
	// -> POR ACTUALIZAR ^^
	// --------------------------------------------------------------------


	// ------------------------- PRODUCTOS --------------------------
	// CREAR UN PRODUCTO, SIN EMBARGO TIENE UNA LIMITACIÓN DE ROL.

	// --------------------------------------------------------------------
	// -> ACTUALIZACION PENDIENTE
	// --------------------------------------------------------------------
	// OPTIMIZADA
	createProduct(data, token) {
	  let data_db = this.db.getData('/data/simple/products');
	  let ids = this.db.getData('/data/simple/id');

	  ids.products = ids.products + 1;

	  if (!data.name) return { message: "Agrega un nombre del producto" };

	  let validateUser = this.validatePerms(token, 'productManager');
	  if (!validateUser) return { message: "El usuario no tiene permisos para crear un producto" };

	  let products_array = converterArray(data_db);
	  let findingProduct = products_array.find(ch => ch.name === data.name);
	  if (findingProduct) return { message: "Ya hay un producto con el mismo nombre guardado." };

	  let final_data = {
	    name: data.name,
	    price: data.price,
	    price_mayor: data.price_mayor,
	    iva: data.iva ? data.iva : "0",
	    stock: data.stock ? data.stock : Infinity,
	    costo_adquisitivo: data.costo_adquisitivo ? data.costo_adquisitivo : 0,
	    id_personalizado: data.id_personalizado,
	    nanoid: generarToken(new Date()),
	    fechaCreacion: new Date() - 0,
	    token: sha256(data.name).toString(),
	    id: data.id_personalizado ? data.id_personalizado : ids.products,
	    log: this.createLog('createProduct', sha256(data.name).toString(), token),
	    pesaje: data.pesaje,
	    venta_por_peso: data.venta_por_peso ? "true" : "false",
	    tecla: data.tecla != null ? String(data.tecla).trim().toLowerCase() : "",
	    max_stock: data.max_stock
	  };

	  if(final_data.pesaje){
	  	final_data.materia_prima = "true";
	  }

	  data_db[final_data.id] = final_data;

	  this.db.setData(`/data/simple/products/${final_data.id}`, final_data);
	  this.db.setData('/data/simple/id', ids);

	  // 🔑 Registrar el movimiento unificado
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "crear",
	    fecha: new Date().toISOString(),
	    responsable: validateUser.user || 'desconocido',
	    descripcion: `Creación de producto`,
	    items: [{
	      productoId: final_data.id,
	      nombre: final_data.name,
	      cantidad: final_data.stock ?? 0,
	      precioUnitario: final_data.costo_adquisitivo ?? 0,
	      total: final_data.stock * final_data.costo_adquisitivo
	    }]
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  return { message: "Producto registrado satisfactoriamente", data: final_data, movimiento };
	}



	// INGRESO DE PRODUCTOS Y SALIDA ESTO TOCA MODIFICARLO PARA QUE TAMBIEN TOQUE SUBIRLO.
	async ingresoProducts(productos = [], token) {
	  if (!Array.isArray(productos) || productos.length === 0) {
	    return { message: "Agrega productos para procesar." };
	  }

	  // Validar permisos
	  const validateUser = this.validatePerms(token, 'productManager');
		if (!validateUser) {
	    return { message: "El usuario no tiene permisos suficientes." };
	  }

	  let allProducts = this.db.getData('/data/simple/products');
	  let itemsProcesados = [];
	  let errores = [];

	  for (const item of productos) {
	    const { id, cantidad, price } = item;

	    if (!id || cantidad === undefined || price === undefined) {
	      errores.push(`Datos incompletos para producto ID ${id || 'desconocido'}`);
	      continue;
	    }

	    let findingProduct = allProducts[id];
	    if (!findingProduct) {
	      errores.push(`Producto no existe: ${id}`);
	      continue;
	    }

	    let precioUnitario = Number(price) / Math.abs(cantidad);

	    findingProduct.stock = Number(findingProduct.stock ?? 0) + Number(cantidad);
	    findingProduct.costo_adquisitivo = precioUnitario;
	    allProducts[findingProduct.id] = findingProduct;

	    itemsProcesados.push({
	      productoId: findingProduct.id,
	      nombre: findingProduct.name,
	      cantidad: Number(cantidad),
	      precioUnitario: precioUnitario,
	      total: Number(price)
	    });
	  }

	  // Guardar productos actualizados
	  this.db.setData(`/data/simple/products`, allProducts);

	  // Guardar movimiento único y unificado
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "ingresoManual", // o solo "ingreso" o "salida" según tu lógica
	    fecha: new Date().toISOString(),
	    responsable: validateUser.user || 'desconocido',
	    descripcion: "Ingreso/Salida manual de productos",
	    items: itemsProcesados
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  return {
	    message: "Productos procesados y movimiento registrado.",
	    errores,
	    movimiento
	  };
	}


	// OPTIMIZADA 
	editProduct(id, newInfo, token) {
	  // let products = this.db.getData('/data/simple/products');
	  let findingProduct = this.db.initData(`/data/simple/products/${id}`);
	  if (!findingProduct) return { message: "El producto no existe." };

	  if (!newInfo) return { message: "Agrega la información de cambio para el producto." };

	  let validateUser = this.validatePerms(token, 'productManager');
	  if (!validateUser) return { message: "El usuario no tiene permisos para editar un producto" };

	  // Actualizar campos
	  findingProduct.name = newInfo.name ? newInfo.name : findingProduct.name;
	  findingProduct.price = newInfo.price ? newInfo.price : findingProduct.price;
	  findingProduct.price_mayor = newInfo.price_mayor ? newInfo.price_mayor : findingProduct.price_mayor;
	  findingProduct.iva = newInfo.iva ? newInfo.iva : findingProduct.iva;
	  findingProduct.stock = newInfo.stock ? newInfo.stock : findingProduct.stock;
	  findingProduct.costo_adquisitivo = newInfo.costo_adquisitivo ? newInfo.costo_adquisitivo : findingProduct.costo_adquisitivo;
	  findingProduct.max_stock = newInfo.max_stock;

	  findingProduct.pesaje = newInfo.pesaje;

	  findingProduct.venta_por_peso = newInfo.venta_por_peso ? "true" : "false";
	  findingProduct.tecla = newInfo.tecla != null ? String(newInfo.tecla).trim().toLowerCase() : (findingProduct.tecla || "");

	  if(findingProduct.pesaje){
	  	findingProduct.materia_prima = "true";
	  }

	  findingProduct.ultimateDate = new Date() - 0;
	  findingProduct.log = this.createLog('editProduct', findingProduct.token, token);

	  this.db.setData(`/data/simple/products/${findingProduct.id}`, findingProduct);

	  // 📌 Registrar movimiento estandarizado
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "editar",
	    fecha: new Date().toISOString(),
	    responsable: validateUser.user || 'desconocido',
	    descripcion: "Edición de producto",
	    items: [{
	      productoId: findingProduct.id,
	      nombre: findingProduct.name,
	      cantidad: findingProduct.stock ?? 0,
	      precioUnitario: findingProduct.costo_adquisitivo ?? 0,
	      total: findingProduct.stock * findingProduct.costo_adquisitivo
	    }]
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  return {
	    message: "Producto actualizado y movimiento registrado satisfactoriamente.",
	    data: findingProduct,
	    movimiento
	  };
	}

	// OPTIMIZADA 
	deleteProduct(id, token) {
	  // let products = this.db.getData('/data/simple/products');
	  let findingProduct = this.db.initData(`/data/simple/products/${id}`);
	  if (!findingProduct) return { message: "El producto no existe." };

	  let validateUser = this.validatePerms(token, 'productManager');
	  if (!validateUser) return { message: "El usuario no tiene permisos para eliminar un producto" };

	  // Guardar movimiento ANTES de eliminar
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "eliminar",
	    fecha: new Date().toISOString(),
	    responsable: validateUser.user || 'desconocido',
	    descripcion: "Eliminación de producto",
	    items: [{
	      productoId: findingProduct.id,
	      nombre: findingProduct.name,
	      cantidad: findingProduct.stock ?? 0,
	      precioUnitario: findingProduct.costo_adquisitivo ?? 0,
	      total: findingProduct.stock * findingProduct.costo_adquisitivo
	    }]
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  // Eliminar producto real
	  this.db.removeData(`/data/simple/products/${id}`);

	  return {
	    message: "Producto eliminado y movimiento registrado satisfactoriamente.",
	    data: { id: id },
	    movimiento
	  };
	}

	// OPTIMIZADA LA FUNCION DE OBTENER PRODUCTO
	getProduct(id, token){
		let validateUser = this.validatePerms(token, 'view');
		if(!validateUser) return {message: "El usuario parece no tener permisos para ver los productos"};

		// let products = this.db.getData('/data/simple/products');
		let findingProduct = this.db.initData(`/data/simple/products/${id}`);
		if(!findingProduct) return {message: "Este id o producto esta registrado."};

		return {message: "Producto encontrado.", data: findingProduct};
	}
	// OPTIMIZADA
	getAllProducts(token){
		let validateUser = this.validatePerms(token, 'view');
		if(!validateUser) return {message: "El usuario parece no tener permisos para ver los productos"};

		let products = this.db.getData('/data/simple/products');

		return {message: "Listado de productos.", data: products, methods: this.db.getData('/data/simple/methods')};
	}

	// ROLES MANAGER


	// OPTIMIZADA
	createRole(data = {}, token){
		let validateUser = this.validatePerms(token, 'roleManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		// let roles = this.db.getData('/data/simple/roles');
		let findingRole = this.db.initData(`/data/simple/roles/${data.name}`);
		if(findingRole) return {message: "Este rol ya existe, usa otro nombre."};

		this.db.setData(`/data/simple/roles/${data.name}`, data.perms?data.perms:{view: "true"});
		return {message: "Rol creado satisfactoriamente", data: data.perms?data.perms:{view: "true"}};
	}

	// OPTIMIZADA
	editRole(data = {}, token){
		let validateUser = this.validatePerms(token, 'roleManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(!data.name) return {message: "Tienes que ingresar un nombre al rol"};

		let findingRole = this.db.initData(`/data/simple/roles/${data.name}`)

		if(!findingRole) return {message: "Este rol parece ser inexistente."};

		findingRole = data.perms;

		this.db.setData(`/data/simple/roles/${data.name}`, findingRole);
		return {message: "Rol editado correctamente.", data: findingRole};
	}


	// OPTIMIZADA
	deleteRole(name, token){
		let validateUser = this.validatePerms(token, 'roleManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(!name) return {message: "Este rol parece ser inexistente."};

		let findingRole = this.db.initData(`/data/simple/roles/${name}`);

		if(!findingRole) return {message: "Este rol parece ser inexistente."};

		this.db.removeData(`/data/simple/roles/${name}`);

		return {message: `El rol ${name} ha sido eliminado satisfactoriamente.`, data: {name: name}};
	}

	// ------------------ ADMINISTRATION USERS -------------------------------
	// OPTIMIZADA
	adminCreateUser(data = {}, token){
		let validateUser = this.validatePerms(token, 'all');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(!data.user) return {message: "Ingresa el nombre del usuario."};
		if(!data.password) return {message: "Ingresa la contraseña del usuario"};
		if(!data.role) return {message: "Ingresa el nombre del rol que el usuario va a usar."};
		
		return this.createUser(data.user, data.password, data.role);
	}

	// OPTIMIZADA
	adminEditUser(data = {}, token){
		let validateUser = this.validatePerms(token, 'all');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(!data.user) return {message: "Ingresa el nombre del usuario."};
		if(!data.password) return {message: "Ingresa la contraseña del usuario"};
		if(!data.role) return {message: "Ingresa el nombre del rol que el usuario va a usar."};
		if(!data.id) return {message: "Agrega el id del usuario a modificar."};

		let user = this.getUserToken(token);

		if(user.data.id == data.id){
			data.role = user.data.role;
		}
		
		return this.editUser(data.id, data);
	}

	// OPTIMIZADA
	adminDeleteUser(token_user, token){
		let validateUser = this.validatePerms(token, 'all');

		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(token_user == token) return {message: "No te puedes eliminar a ti mismo."};

		let userFinding = this.getUserToken(token_user);
		if(!userFinding) return {message: "El token del usuario enviado no existe."};
		
		return this.deleteUser(token_user);
	};

	// PARA COTIZACIONES ------------------- FALTA DE OPTIMIZACION
	cotizar(ventas = [], token, mayor){
		if(!ventas[0]) return {"message": "Añade productos para concretar la venta."};

		let products = this.db.getData('/data/simple/products');
		let ids = this.db.getData('/data/simple/id');

		let final_data = [];
		let products_dont = [];
		let final_count = 0;

		ventas.forEach((element, i, array) => {
			let findingProduct = products[element.id];
			if(!findingProduct) return products_dont.push(element.id);
			let final_product = {};

			if(findingProduct.stock != null) findingProduct.stock = findingProduct.stock - Number(element.cantidad?element.cantidad:0);
			products[findingProduct.id] = findingProduct;

			if(!mayor) {
				final_product = {
					id: element.id,
					precio_unitario: findingProduct.price?findingProduct.price:(element.price?element.price:0),
					cantidad: element.cantidad?element.cantidad:1,
					name: findingProduct.name,
					costo_adquisitivo: findingProduct.costo_adquisitivo
				}
			}else {
				final_product = {
					id: element.id,
					precio_unitario: findingProduct.price_mayor?findingProduct.price_mayor:(element.price?element.price:0),
					cantidad: element.cantidad?element.cantidad:1,
					name: findingProduct.name,
					costo_adquisitivo: findingProduct.costo_adquisitivo
				}
			}
			
			final_product.precio_final = redondearMoneda(final_product.precio_unitario * final_product.cantidad);

			final_data.push(final_product)			
			final_count = final_count + final_product.precio_final;
		})

		ids.ventas = ids.ventas + 1;

		let final_venta = {
			products: final_data,
			productsNone: products_dont,
			total_pago: final_count,
			id: ids.ventas,
			date: new Date()-0,
			ventaHechaPor: token?token:"Cajero Común",
			mayor: mayor
		};

		this.db.setData(`/data/simple/products`, products);

		return {message: "Cotización", data: final_venta};
	}

	// OPTIMIZADA
	// NO NECESITA ELIMINARSE LA LINEA CANTIDADSOLICITADA
	createVenta(ventas = [], total_recibido = 0, token, mayor, digital, clientId, deudorId) {
	  if (!ventas[0]) return { message: "Añade productos para concretar la venta." };

	  total_recibido = redondearMoneda(removeCommaSeparators(String(total_recibido == null ? 0 : total_recibido))) || 0;

	  let products = this.db.getData('/data/simple/products');
	  let ids = this.db.getData('/data/simple/id');

	  let final_data = [];
	  let products_dont = [];
	  let final_count = 0;

	  for (const element of ventas) {
	    let findingProduct = products[element.id];
	    if (!findingProduct) {
	      products_dont.push(element.id);
	      continue;
	    }

	    let cantidadSolicitada = Number(element.cantidad);
	    if (findingProduct.stock != null && findingProduct.stock < cantidadSolicitada) {
	      return {
	        message: `No hay suficiente stock para "${findingProduct.name}". Disponible: ${findingProduct.stock}, Solicitado: ${cantidadSolicitada}`
	      };
	    }
	  }

	  ventas.forEach(element => {
	    let findingProduct = products[element.id];
	    if (!findingProduct) return products_dont.push(element.id);

	    let cantidadSolicitada = Number(element.cantidad ?? 0);
	    if (cantidadSolicitada <= 0) cantidadSolicitada = 1;

	    if (findingProduct.stock != null) {
	      findingProduct.stock -= cantidadSolicitada;
	    }

	    // ⚡ NO vuelves a guardar TODO products
	    // ⚡ Guarda solo el archivo individual

	    let final_product = {
	      id: element.id,
	      precio_unitario: mayor?(findingProduct.price_mayor?findingProduct.price_mayor:(element.price?element.price:0)):(findingProduct.price?findingProduct.price:(element.price?element.price:0)),
	      cantidad: cantidadSolicitada,
	      name: findingProduct.name,
	      costo_adquisitivo: findingProduct.costo_adquisitivo
	    };

	    final_product.precio_final = redondearMoneda(final_product.precio_unitario * final_product.cantidad);

	    // PARA SABER QUE PRODUCTOS FUERON MAS VENDIDOS
	    findingProduct.selledChantity = (findingProduct.selledChantity?findingProduct.selledChantity:0) + 1;
	    findingProduct.selledPricing = (findingProduct.selledPricing?findingProduct.selledPricing:0) + final_product.precio_final;

	    this.db.setData(`/data/simple/products/${findingProduct.id}`, findingProduct);

	    final_data.push(final_product);
	    final_count = redondearMoneda(final_count + final_product.precio_final);
	  });

	  // Si no hay deudor, el pago debe cubrir el total
	  if (!deudorId && final_count - total_recibido > 0.005) {
	    return { message: "El total recibido no puede ser menor al total pago." };
	  }

	  ids.ventas += 1;

	  let final_venta = {
	    products: final_data,
	    productsNone: products_dont,
recibido: total_recibido == null ? final_count : redondearMoneda(total_recibido),
    total_pago: final_count,
    id: ids.ventas,
    date: new Date() - 0,
    ventaHechaPor: token || "Cajero Común",
    mayor: mayor,
    digital: digital
  };

final_venta.vueltas = Math.max(0, redondearMoneda(final_venta.recibido - final_venta.total_pago));

  this.db.setData(`/data/simple/ventas/${final_venta.id}`, final_venta);
  this.db.setData('/data/simple/id', ids);

  // VINCULACION CON CLIENTE / DEUDOR: registra la compra y/o la deuda fiada
  let vinculoId = clientId || deudorId;
  if (vinculoId) {
    try {
      let clientes = this.db.getData('/data/simple/clientes');
      let findingClient = clientes[clientId];

      if (findingClient && clientId) {
        final_venta.clienteId = clientId;
        final_venta.cliente = findingClient.name;
        findingClient.compras = converterArray(findingClient.compras || []);
        findingClient.compras.push({
          ventaId: final_venta.id,
          fecha: final_venta.date,
          total: final_venta.total_pago,
          productos: final_data.map(p => ({
            nombre: p.name,
            cantidad: p.cantidad,
            total: p.precio_final
          }))
        });
      }

      // VENTA A CREDITO (fiado): la diferencia se registra como deuda del deudor
      let deudaPendiente = redondearMoneda(final_venta.total_pago - final_venta.recibido);
      if (deudorId && deudaPendiente > 0.005) {
        let clienteDeudor = clientes[deudorId];
        if (clienteDeudor) {
          clienteDeudor.deuda = Number(clienteDeudor.deuda ? clienteDeudor.deuda : 0) + deudaPendiente;
          if(!clienteDeudor.cuenta_abierta) clienteDeudor.cuenta_abierta = new Date();
          clienteDeudor.movements = converterArray(clienteDeudor.movements || []);
          clienteDeudor.movements.push({
            monto: deudaPendiente,
            desc: `Venta fiada #${final_venta.id}`,
            date: new Date().toString(),
            sign: "-",
            ventaId: final_venta.id
          });
        }
      }

      if (findingClient || deudorId) {
        this.db.setData(`/data/simple/ventas/${final_venta.id}`, final_venta);
        this.db.setData('/data/simple/clientes', clientes);
      }
    } catch (err) {}
  }

  // MARCA LA VENTA COMO FIADA PARA REFERENCIA EN REPORTES
  if (deudorId) {
    final_venta.deudorId = deudorId;
    final_venta.fiado = true;
    this.db.setData(`/data/simple/ventas/${final_venta.id}`, final_venta);
  }

  return { message: "Venta hecha satisfactoriamente", data: final_venta };
}


	// OPTIMIZADA
	editVenta(data = {id: 0}, total_recibido){
		// let ventas = this.db.getData('/data/simple/ventas');
		let ids = this.db.getData('/data/simple/id');


		let findingVenta = this.db.initData(`/data/simple/ventas/${data.id}`);
		if(!findingVenta) return {message: "Esta venta no existe o no fue concretada"};

		this.db.removeData(`/data/simple/ventas/${findingVenta.id}`, findingVenta);

		return this.createVenta(data.ventas, total_recibido);
	}

	// OPTIMIZADA
	deleteVenta(id){
		// let ventas = this.db.getData('/data/simple/ventas');
		let findingVenta = this.db.initData(`/data/simple/ventas/${id}`);
		if(!findingVenta) return {message: "Esta venta no existe o no fue concretada."};
		
		this.db.removeData(`/data/simple/ventas/${id}`);

		return {message: "Venta eliminada satisfactoriamente.", data: true, ventaEliminada: findingVenta};
	}


	// OPTIMIZADA
	getAllVentas(){
		let ventas = this.db.getData('/data/simple/ventas');

		return {message: "Lista de todas las ventas", data: ventas};
	}

	// -------------------------------------------------------------------------------
	// -> POR ACTUALIZAR >>
	// -------------------------------------------------------------------------------
	findClient(data = {}, token){
		if(!data) return {message: "Agrega la información del cliente"};

		let validateUser = this.validatePerms(token, 'view');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		let users = this.db.getData('/data/simple/clientes');
		let array_user = converterArray(users);

		return users[data.id] || array_user.find(ch => ch.name == data.name) || (data.document ? array_user.find(ch => ch.document == data.document) : undefined);
	}
	createClient(data, token){
		if(!data) return {message: "Agrega la información del cliente"};

		let validateUser = this.validatePerms(token, 'clientManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		let findingClient = this.findClient(data, token);
		if(findingClient) return {message: "Este nombre, documento o id ya existe."};

		if(!data.name) return {message: "El nombre es obligatorio ponerlo."};

		let clients = this.db.getData('/data/simple/clientes');
		let ids = this.db.getData('/data/simple/id');

		ids.clientes = ids.clientes+1;

		let final_client = {
			name: data.name,
			type: data.type,
			document: data.document,
			phone: data.phone,
			correo: data.correo,
			date: new Date()-0,
			city: data.city,
			direccion: data.direccion,
			categoria: data.categoria != null ? String(data.categoria).trim() : "",
			proviene: data.proviene != null ? String(data.proviene).trim() : "",
			compras: [],
			deuda: 0,
			movements: [],
			cuenta_abierta: null,
			id: ids.clientes
		}
		clients[ids.clientes] = final_client;

		this.db.setData('/data/simple/id', ids);
		this.db.setData('/data/simple/clientes', clients);

		return {message: "Cliente guardado satisfactoriamente", data: final_client};
	}

	createClientsBulk(clientes = [], token){
		if(!clientes || !clientes.length) return {message: "Agrega la lista de clientes a importar."};

		let validateUser = this.validatePerms(token, 'clientManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		let clients = this.db.getData('/data/simple/clientes');
		let ids = this.db.getData('/data/simple/id');

		let existingNames = new Set();
		let existingDocs = new Set();
		converterArray(clients).forEach(ch => {
			if(ch && ch.name) existingNames.add(String(ch.name).trim().toLowerCase());
			if(ch && ch.document) existingDocs.add(String(ch.document).trim());
		});

		let creados = [];
		let omitidos = [];

		clientes.forEach((item, index) => {
			let fila = index + 1;
			let name = item.name != null ? String(item.name).trim() : "";
			if(!name) return omitidos.push({ fila, name, razon: "Sin nombre" });

			let document = item.document != null ? String(item.document).trim() : "";
			document = document.replace(/[.\-, ]/g, "");

			if(existingNames.has(name.toLowerCase())) return omitidos.push({ fila, name, razon: "Nombre ya existente" });
			if(document && existingDocs.has(document)) return omitidos.push({ fila, name, razon: "Documento ya existente" });

			existingNames.add(name.toLowerCase());
			if(document) existingDocs.add(document);

			ids.clientes = (ids.clientes || 0) + 1;

			let final_client = {
				name: name,
				type: item.type || "cc",
				document: document,
				phone: item.phone != null ? String(item.phone).trim() : "",
				correo: item.correo != null ? String(item.correo).trim() : "",
				date: new Date() - 0,
				city: item.city != null ? String(item.city).trim() : "",
				direccion: item.direccion != null ? String(item.direccion).trim() : "",
				categoria: item.categoria != null ? String(item.categoria).trim() : "",
				proviene: item.proviene != null ? String(item.proviene).trim() : "",
				compras: [],
				deuda: 0,
				movements: [],
				cuenta_abierta: null,
				id: ids.clientes
			};
			clients[ids.clientes] = final_client;
			creados.push(final_client.id);
		});

		this.db.setData('/data/simple/id', ids);
		this.db.setData('/data/simple/clientes', clients);

		return {
			message: `${creados.length} cliente(s) importado(s) satisfactoriamente.`,
			data: {
				creados,
				omitidos,
				total: clientes.length
			}
		};
	}

	editClient(data, token){
		if(!data) return {message: "Agrega la información del cliente"};

		let validateUser = this.validatePerms(token, 'clientManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		if(!data.id) return {message: "Agrega el id del cliente que quieres modificar."};

		let clients = this.db.getData('/data/simple/clientes');

		if(!clients[data.id]) return {message: "Este cliente no existe o ya fue eliminado."};

		clients[data.id].name = data.name;
		clients[data.id].document = data.document
		clients[data.id].phone = data.phone
		clients[data.id].correo = data.correo;
		clients[data.id].city = data.city
		clients[data.id].direccion = data.direccion;
		clients[data.id].categoria = data.categoria != null ? String(data.categoria).trim() : (clients[data.id].categoria || "");
		clients[data.id].proviene = data.proviene != null ? String(data.proviene).trim() : (clients[data.id].proviene || "");

		this.db.setData('/data/simple/clientes', clients);


		return {message: "Cliente editado satisfactoriamente", data: clients[data.id]};
	}

	deleteClient(id, token){
		if(!id) return {message: "Agrega la información del cliente"};

		let validateUser = this.validatePerms(token, 'clientManager');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		let clients = this.db.getData('/data/simple/clientes');

		if(!clients[id]) return {message: "Este cliente no existe o ya fue eliminado."};

		let clienteEliminado = clients[id];

		this.db.removeData(`/data/simple/clientes/${id}`);
		return {message: "Cliente eliminado satisfactoriamente", data: clienteEliminado};
	}

	getClients(data){
		let validateUser = this.validatePerms(data, 'view');
		if(!validateUser) return {message: "No tiene permisos suficientes."};
		let clientes = this.db.getData('/data/simple/clientes', ['compras']);
		let livianos = {};
		converterArray(clientes).forEach(ch => {
			livianos[ch.id] = {
				id: ch.id,
				name: ch.name != null ? ch.name : '',
				document: ch.document != null ? ch.document : '',
				deuda: Number(ch.deuda ? ch.deuda : 0)
			};
		});
		return {message: "Lista de clientes", data: livianos};
	}

	getClientesCompletos(data){
		let validateUser = this.validatePerms(data, 'view');
		if(!validateUser) return {message: "No tiene permisos suficientes."};
		let clientes = this.db.getData('/data/simple/clientes', ['compras']);
		return {message: "Lista de clientes", data: clientes};
	}

	// CLIENTES CON DEUDA: devuelve unicamente los clientes que deben (deuda > 0)
	getClientesConDeuda(token){
		let validateUser = this.validatePerms(token, 'facturar');
		if(!validateUser) return {message: "El usuario parece no tener permisos"};

		let clientes = this.db.getData('/data/simple/clientes');
		let array_clientes = converterArray(clientes);

		let deudores = {};
		array_clientes.forEach(ch => {
			if(Number(ch.deuda ? ch.deuda : 0) > 0){
				deudores[ch.id] = {
					id: ch.id,
					name: ch.name,
					document: ch.document,
					categoria: ch.categoria || "",
					proviene: ch.proviene || "",
					deuda: Number(ch.deuda),
					movements: ch.movements || []
				};
			}
		});

		return {message: "Info deudores", data: deudores};
	}

	// HISTORIAL DE COMPRAS DE UN CLIENTE: ventas vinculadas, total acumulado
	// y resumen por mes (cuánto ha comprado a lo largo del tiempo)
	getComprasCliente(id, token){
		let validateUser = this.validatePerms(token, 'view');
		if(!validateUser) return {message: "No tiene permisos suficientes."};

		let clientes = this.db.getData('/data/simple/clientes');
		let findingClient = clientes[id];
		if(!findingClient) return {message: "Este cliente no existe o ya fue eliminado."};

		let compras = converterArray(findingClient.compras || {});
		compras.forEach(c => c.productos = converterArray(c.productos || []));
		compras.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

		const total = compras.reduce((sum, c) => sum + Number(c.total || 0), 0);
		const mensual = {};
		compras.forEach(c => {
			const d = new Date(c.fecha || 0);
			const clave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
			mensual[clave] = Number(mensual[clave] || 0) + Number(c.total || 0);
		});

		return {
			message: "Compras del cliente",
			data: {
				id: id,
				name: findingClient.name,
				phone: findingClient.phone,
				document: findingClient.document,
				compras,
				total,
				cantVentas: compras.length,
				mensual
			}
		};
	}

	// -------------------------------------------------------------------------------
	// -> POR ACTUALIZAR ^^
	// -------------------------------------------------------------------------------


	//  --------------------------- PRESUPUESTOS FUNCION ------------------------

	// OBTENER EL PRESUPUESTO ACTUAL

	// OPTIMIZADA
	getPresupuestoActivo(token){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción."};

		let dataPresupuestos = this.db.getData('/data/simple/presupuestos_activo');

		return {message: "Presupuesto activo", data: dataPresupuestos};
	}

	// OPTIMIZADA
	setPresupuestoActivo(token, data = {}){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción"};

		let nuevoPresupuesto = {
			name: data.name,
			pagos: data.pagos,
			description: data.description
		};

		this.db.setData('/data/simple/presupuestos_activo', nuevoPresupuesto);


		let finalPagos = converterArray(nuevoPresupuesto.pagos?nuevoPresupuesto.pagos:{});


		let total = 0;
		let totalPagado = 0;

		finalPagos.forEach(pago => {
		  const valor = Number(pago.valor) || 0;
		  total += valor;
		  if (pago.tachado === 'true') totalPagado += valor;
		});

		whatsapp(`

Presupuesto: *${nuevoPresupuesto.name}*


*Mensaje:* ${nuevoPresupuesto.description || 'Sin descripción.'}

📂 Pagos programados:
${finalPagos.length > 0 ? finalPagos.map((pago, i) => 
  `${i+1}. ${pago.tachado=="true" ? "~" : ""}${pago.description} — $${formatNumber(pago.valor)} ${pago.type=="Fijo" ? ">Fijo" : ">Variable"}${pago.tachado=="true" ? "~" : ""}`).join('\n') : 'No se han registrado pagos aún.'}


📊 *Total a pagar:* $${formatNumber(total)}
✅ *Total pagado:* $${formatNumber(totalPagado)}

🚧 *Faltante:* ${formatNumber(total - totalPagado)}
		`);


		return {message: "Presupuesto guardado satisfactoriamente", data: nuevoPresupuesto};
 	};

 	// OPTIMIZADA
	finalizarPresupuestoActivo(token){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción"};

		let dataPresupuestos = this.db.initData('/data/simple/presupuestos_activo');

		if(!dataPresupuestos) return {message: "No hay un presupuesto activo, crea uno"};

		let ids = this.db.getData('/data/simple/id');
		ids.presupuestos = (ids.presupuestos?ids.presupuestos:0) + 1;

		// let presupuestos = this.db.getData('/data/simple/presupuestos');

		let finalPresupuesto = {
			id: ids.presupuestos,
			closed: new Date() - 0,
			data: data
		};

		this.db.setData(`/data/simple/presupuestos/${finalPresupuesto.id}`, finalPresupuesto);
		this.db.removeData('/data/simple/presupuestos_activo');
		this.db.setData('/data/simple/id', ids);

		return {message: "presupuestos actualizados", data: finalPresupuesto};
	};


	// FUNCION DE PRESUPUESTOS

	// OPTIMIZADA
	presupuestos(token){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción."};

		let dataPresupuestos = this.db.getData('/data/simple/presupuestos');

		return {message: "Presupuestos descargados", data: dataPresupuestos};
	};

	// OPTIMIZADA
	getPresupuesto(token, id){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción"};

		// let presupuestos = this.db.getData('/data/simple/presupuestos');

		let findingPresupuesto = this.db.initData(`/data/simple/presupuestos/${id}`);
		if(!findingPresupuesto) return {message: "Este presupuesto pudo haber sido eliminado ya"};

		return {message: "Información descargada satisfactoriamente", data: findingPresupuesto};
	}

	// OPTIMIZADA
	removePresupuesto(token, id){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción"};

		// let presupuestos = this.db.getData('/data/simple/presupuestos');

		let findingPresupuesto = this.db.initData(`/data/simple/presupuestos/${id}`);
		if(!findingPresupuesto) return {message: "Este presupuesto pudo haber sido eliminado ya"};

		return {message: "Presupuesto encontrado", data: findingPresupuesto};
	}

	// OPTIMIZADA
	presupuestoAActivo(token, id){
		let findingToken = this.validatePerms(token);

		if(!findingToken) return {message: "No tienes permisos suficientes para esta acción"};

		// let presupuestos = this.db.getData('/data/simple/presupuestos');

		let findingPresupuesto = this.db.initData(`/data/simple/presupuestos/${id}`);
		if(!findingPresupuesto) return {message: "Este presupuesto pudo haber sido eliminado ya"};

		let findingPresupuestoActivo = this.db.initData('/data/simple/presupuestos_activo');

		if(findingPresupuestoActivo) return {message: "Hay un presupuesto activo ya, finalizalo o eliminalo."};

		this.removeData(`/data/simple/presupuestos/${id}`);

		this.db.setData('/data/simple/presupuestos_activo', findingPresupuesto);

		return {message: "Presupuesto colocado en activo, satisfactoriamente", data: findingPresupuesto};
	}

	// -------------------------- LOGS CREATOR -----------------------------------

	createLog(type, data, author){
		return {
			date: new Date()
		}
	}

	logsSetDay(data){

	}

	// ---------------------------- FUNCIONES DE VALIDACIÓN ---------------------------------

	// OBTENER PARAMETROS DE LOS ROLES
	// OPTIMIZADA
	getInfoPerms(role){
		// let data = this.db.getData('/data/simple/roles');
		let findingRole = this.db.initData(`/data/simple/roles/${role}`);
		if(!findingRole) return null;

		return findingRole;
	}

	// VALIDAR SI TIENE EL PERMISO NECESARIO PARA LA ACCIÓN DESEADA
	// optimizada
	validatePerms(token, perm){
		let user = this.getUserToken(token);
		if(!user.data) return null;

		let data_role = user.data.role;

		let perms = this.getInfoPerms(data_role);

		return perms[perm] || perms['all'];
	}

	// PROCESAR ARCHIVOS XML // MANEJO DE PRODUCTOS

	// PROCESAR PROVEEDOR
	// optimizada
	procesarProveedor(archivo) {
	  const data = archivo;


	  const factura = data['Invoice'];

	  // 1️⃣ CUFE
	  const cufe = factura['cbc:UUID']['_']?factura['cbc:UUID']['_']:factura['cbc:UUID'];

	  // 2️⃣ Número de factura
	  const numeroFactura = factura['cbc:ID'];

	  // 3️⃣ Datos del vendedor
	  const proveedor = factura['cac:AccountingSupplierParty']['cac:Party'];
	  const nombreProveedor = proveedor['cac:PartyName']['cbc:Name'];

	  const partyTaxScheme = proveedor['cac:PartyTaxScheme'];
		const partyLegalEntity = proveedor['cac:PartyLegalEntity'];

		let nitProveedor = '';

		if (partyTaxScheme && partyTaxScheme['cbc:CompanyID']) {
		  nitProveedor = typeof partyTaxScheme['cbc:CompanyID'] === 'object'
		    ? partyTaxScheme['cbc:CompanyID']['_']
		    : partyTaxScheme['cbc:CompanyID'];
		} else if (partyLegalEntity && partyLegalEntity['cbc:CompanyID']) {
		  nitProveedor = typeof partyLegalEntity['cbc:CompanyID'] === 'object'
		    ? partyLegalEntity['cbc:CompanyID']['_']
		    : partyLegalEntity['cbc:CompanyID'];
		} else {
		  throw new Error(`❌ No se encontró NIT del proveedor en PartyTaxScheme ni PartyLegalEntity.`);
		}
	  // 4️⃣ Total a pagar
	  const totalFactura = factura['cac:LegalMonetaryTotal']['cbc:PayableAmount'];

	  // 5️⃣ Productos y cantidades
	  const lineas = Array.isArray(factura['cac:InvoiceLine'])
	    ? factura['cac:InvoiceLine']
	    : [factura['cac:InvoiceLine']];

	  const productos = lineas.map(linea => ({
	    descripcion: linea['cac:Item']['cbc:Description'].trim(),
	    cantidad: parseFloat(linea['cbc:InvoicedQuantity']),
	    unidad: linea['cbc:InvoicedQuantity'].$.unitCode,
	    precioUnitario: parseFloat(linea['cac:Price']['cbc:PriceAmount']),
	    valorLinea: parseFloat(linea['cbc:LineExtensionAmount'])
	  }));

	  return {
	    cufe,
	    numeroFactura,
	    proveedor: {
	      nombre: nombreProveedor,
	      nit: nitProveedor
	    },
	    totalFactura,
	    productos
	  };
	}


	// PROCESAMIENTO DE FACTURAS
	// optimizada
	async procesarFactura(rutaArchivo, archivo) {
	  const xml = rutaArchivo?fs.readFileSync(rutaArchivo, 'utf8'):archivo;
	  const parser = new xml2js.Parser({ explicitArray: false });
	  const data = await parser.parseStringPromise(xml);


	  // PROCESANDO AL PROVEEDOR
	  const processingProveedor = this.procesarProveedor(data);

	 	let gettingProveedor = this.db.initData(`/data/simple/proveedores/${processingProveedor.proveedor.nit}`);

	 	if(!gettingProveedor) {
	 		this.db.setData(`/data/simple/proveedores/${processingProveedor.proveedor.nit}`, {
	 			...processingProveedor.proveedor,
	 			totalFacturado: parseFloat(processingProveedor.totalFactura),
	 			facturas: [{cufe: processingProveedor.cufe, numeroFactura: processingProveedor.numeroFactura}],
	 			ultimaFactura: parseFloat(processingProveedor.totalFactura),
	 			deudaActual: parseFloat(processingProveedor.totalFactura)
	 		});
	 	}else {
	 		gettingProveedor.totalFacturado = parseFloat(gettingProveedor.totalFacturado) + parseFloat(processingProveedor.totalFactura);
	 		gettingProveedor.ultimaFactura = parseFloat(processingProveedor.totalFactura);

	 		gettingProveedor.facturas = converterArray(gettingProveedor.facturas).push({cufe: processingProveedor.cufe, numeroFactura: processingProveedor.numeroFactura});

	 		gettingProveedor.deudaActual += parseFloat(processingProveedor.totalFactura);

	 		this.db.setData(`/data/simple/proveedores/${gettingProveedor.nit}`, gettingProveedor);
	 	}
	 	// FINALIZA EL PROCESAMIENTO DEL PROVEEDOR

	 	// SE GUARDA LA FACTURA PARA FUTURAS OPCIONES.
	 	this.db.setData(`/data/simple/facturas/${processingProveedor.cufe}`, processingProveedor);

	  const factura = data['Invoice'];
	  const lineas = Array.isArray(factura['cac:InvoiceLine']) ? factura['cac:InvoiceLine'] : [factura['cac:InvoiceLine']];

	  let finalLogs = [];

	  for (const linea of lineas) {
		  const item = linea['cac:Item'] || {};
		  const standardIdObj = item['cac:StandardItemIdentification']?.['cbc:ID'];
		  let standardId = '';

		  if (typeof standardIdObj === 'object') {
		    standardId = standardIdObj._;
		  } else if (typeof standardIdObj === 'string') {
		    standardId = standardIdObj;
		  }

		  let id = '';
		  if (standardId && standardId !== '999') {
		    id = standardId;
		  } else {
		    // fallback al SellersItemIdentification si el Standard ID es 999 o no existe
		    const sellersIdObj = item['cac:SellersItemIdentification']?.['cbc:ID'];
		    if (typeof sellersIdObj === 'object') {
		      id = sellersIdObj._;
		    } else if (typeof sellersIdObj === 'string') {
		      id = sellersIdObj;
		    } else {
		      throw new Error(`No se pudo encontrar un ID válido para una línea de producto.`);
		    }
		  }

		  // El resto de tu lógica aquí...

		  const nombre = linea['cac:Item']['cbc:Description'].trim();

	    const cantidadRaw = linea['cbc:InvoicedQuantity'];
			const cantidad = parseFloat(cantidadRaw._ || cantidadRaw);
	    const subtotal = parseFloat(linea['cbc:LineExtensionAmount']._);
	    const impuesto = parseFloat(linea['cac:TaxTotal']?.['cbc:TaxAmount']._ || 0);
	    const totalLinea = subtotal + impuesto;
	    const precioUnidad = totalLinea / cantidad;

	    const ruta = `/data/simple/products/${id}`;

	    // OBTENIENDO PRODUCTO
	    const productoActual = this.db.initData(ruta);

	    if (!productoActual || !productoActual.id) {
	      // Si no existe el producto, se guarda por primera vez
	      this.db.setData(ruta, {
	        name: nombre,
	        costo_adquisitivo: parseFloat(precioUnidad),
	        fechaCreación: new Date()-0,
	        id_personalizado: id,
	        id: id,
	        price: data.price,
					price_mayor: data.price_mayor,
					stock: (data.stock + cantidad),
					nanoid: generarToken(new Date()),
					token: sha256(nombre).toString(),
					stock: cantidad,
					materia_prima: "true", // ESTO ES PARA PODER MARCAR EL PESO Y OTROS DATOS. 
					visible: "false",
					pesaje: 0
	      });
	      finalLogs.push(`🆕 Producto nuevo guardado: ${id} - ${nombre}`);
	    } else {
	      // Si el precio es mayor, se actualiza

	    	productoActual.stock = (Number(productoActual.stock?productoActual.stock:0) + Number(cantidad));
	    	productoActual.costo_adquisitivo = parseFloat(limpiarCantidad(precioUnidad));
	      this.db.setData(ruta, productoActual);

	      finalLogs.push(`⬆️ Precio actualizado #${id}: ${productoActual.precioUnidadConImpuestos} → ${precioUnidad.toFixed(2)} - ${nombre}`)
	    }
		}

	  if(finalLogs[0]){
	  	await whatsapp(`
		  	*CAMBIOS EN LAS MATERIAS PRIMAS*
		  	${finalLogs.map(ch => ch).join('\n')}
		  `);
	  }

	  this.db.setData(`/data/simple/bodega/logs`, finalLogs);
	}

	// OPTIMIZADA
	async procesarTodas(rutas) {
	  for (const ruta of rutas) {
	    try {
	      await this.procesarFactura(ruta);
	      console.log(`📄 Procesada factura: ${ruta}`);
	    } catch (err) {
	      console.error(`❌ Error en ${ruta}:`, err.message);
	    }
	  }
	}


	// MANEJO REAL DE BODEGA, CON ACTUALIZACIÓN DE PRODUCTOS Y OTROS:


	// optimizada
	inventariado(data = [], token){
		let finalMovement = this.createMovement(data, token);

		if(!finalMovement.data) return {message: "No se pudo generar la salida de inventario debido a que el token no parece ser correcto o algun producto de la lista ya fue eliminado por otro usuario en este momento."};

		const productos = finalMovement.data.products.map(p => 
		  `- ${p.name} | Cantidad: ${p.cantidad} | Precio unitario: $${formatNumber(p.precio_final)}`
		).join('\n');

		const mensaje = `
		📦 *MOVIMIENTO DE INVENTARIO*
		🗓️ Fecha: ${new Date().toLocaleString('es-CO')}
		🔢 ID Movimiento: ${finalMovement.data.id}

		📋 Productos:
		${productos}

		💰 *Total:* $${finalMovement.data.total_pago.toLocaleString('es-CO')}
		`;

		whatsapp(mensaje);

		return finalMovement;
	}


	// optimizada
	generarFacturaCredito(data = [], token){
		let finalMovement = this.createMovement(data, token);

		if(!finalMovement.data) return {message: "No se pudo generar el movimiento ni la factura de inventario."};

		let movementMoney = this.removeToGeneral({
			desc: `Factura pagada de credito: ${generarToken(new Date())}`,
			monto: Number(finalMovement.data.total_pago)
		});

		const fecha = new Date().toLocaleString('es-CO');

		const productos = finalMovement.data.products.map(p => 
		  `- ${p.name} | Cantidad: ${p.cantidad} | Precio unitario: $${formatNumber(p.precio_final)}`
		).join('\n');

		const mensaje = `
		📦 *Movimiento de Bodega*
		🗓️ Fecha: ${fecha}
		🔢 ID Movimiento: ${finalMovement.data.id}

		📋 Productos:
		${productos}

		💰 *Total:* $${finalMovement.data.total_pago.toLocaleString('es-CO')}

		✅ *Factura:* ${!finalMovement.data.credito ? 'Paga de dinero general' : 'Paga de dinero de cajas'}
		`;

		whatsapp(mensaje);

		return finalMovement;
	}

	getMovements(token){
		let validateUser = this.validatingUseringToken(token);

		if(!validateUser.data) return {message: "Token fallido"};

		let movements = this.db.getLastNMovements('/data/simple/movimientos', 30);

		return {message: "Informacion descargada satisfactoriamente", data: movements};
	}

	// OPTIMIZADA
	createMovement(ventas = [], token) {
	  if (!ventas[0]) return { message: "Añade productos para el movimiento en bodega." };

	  let validateUser = this.validatingUseringToken(token);
	  if (!validateUser.data) return { message: "Token fallido" };

	  let products = this.db.getData('/data/simple/products');
	  let ids = this.db.getData('/data/simple/id');

	  let final_data = [];
	  let products_dont = [];
	  let final_count = 0;

	  ventas.forEach((element) => {
	    let findingProduct = products[element.id];
	    if (!findingProduct) return products_dont.push(element.id);

	    let cantidadSolicitada = Number(element.cantidad);

	    if (findingProduct.stock != null) {
	      findingProduct.stock = Number(findingProduct.stock?findingProduct.stock:0) + Number(cantidadSolicitada);
	    }

	    findingProduct.costo_adquisitivo = findingProduct.costo_adquisitivo ?? element.price;

	    // ✅ Aquí ya NO guardas todo: solo marcas para guardar luego
	    // Solo actualiza en memoria
	    products[findingProduct.id] = findingProduct;

	    let final_product = {
	      id: element.id,
	      precio_unitario: element.price ?? findingProduct.costo_adquisitivo,
	      cantidad: cantidadSolicitada,
	      name: findingProduct.name,
	      costo_adquisitivo: findingProduct.costo_adquisitivo
	    };

	    final_product.precio_final = final_product.precio_unitario * final_product.cantidad;

	    final_data.push(final_product);
	    final_count += final_product.precio_final;
	  });

	  let final_venta = {
	    products: final_data,
	    productsNone: products_dont,
	    total_pago: final_count,
	    id: ids.ventas,
	    date: Date.now(),
	    movimientoHechoPor: token || "Cajero Común",
	  };

	  // ✅ Guarda solo los productos modificados (uno por uno)
	  final_data.forEach(prod => {
	    const productoActualizado = products[prod.id];
	    this.db.setData(`/data/simple/products/${productoActualizado.id}`, productoActualizado);
	  });

	  // ✅ Actualiza IDs globales
	  this.db.setData('/data/simple/id', ids);

	  // ✅ Guarda movimiento
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "facturacion-bodega",
	    fecha: new Date().toISOString(),
	    responsable: validateUser.data.data.user || 'desconocido',
	    descripcion: `Movimientos de la bodega, pagos de facturas creditas y salidas de bodega.`,
	    items: final_venta.products.map(ch => ({
	      productoId: ch.id,
	      nombre: ch.name,
	      cantidad: ch.cantidad,
	      precioUnitario: ch.precio_unitario,
	      total: ch.precio_final
	    }))
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  return { message: "Facturación bodega satisfactoriamente", data: final_venta };
	};

	// OPTIMIZADA
	correctorInventory(ventas = [], token) {
	  let validateUser = this.validatingUseringToken(token);

	  if (!validateUser.data) return { message: "Token Fallido" };

	  let products = this.db.getData('/data/simple/products');
	  let ids = this.db.getData('/data/simple/id');

	  let final_data = [];
	  let products_dont = [];
	  let final_count = 0;

	  ventas.forEach((element) => {
	    let findingProduct = products[element.id];
	    if (!findingProduct) return products_dont.push(element.id);

	    let cantidadSolicitada = Number(element.cantidad);

	    findingProduct.stock = cantidadSolicitada;

	    findingProduct.costo_adquisitivo = element.price ?? findingProduct.costo_adquisitivo;

	    products[findingProduct.id] = findingProduct;

	    let final_product = {
	      id: element.id,
	      precio_unitario: element.price ?? findingProduct.costo_adquisitivo,
	      cantidad: cantidadSolicitada,
	      name: findingProduct.name,
	      costo_adquisitivo: findingProduct.costo_adquisitivo
	    };

	    final_product.precio_final = final_product.precio_unitario * final_product.cantidad;

	    final_data.push(final_product);
	    final_count += final_product.precio_final;
	  });

	  let final_venta = {
	    products: final_data,
	    productsNone: products_dont,
	    total_pago: final_count,
	    id: ids.ventas,
	    date: Date.now(),
	    movimientoHechoPor: token || "Cajero Común",
	  };

	  // ✅ GUARDAR SOLO LOS PRODUCTOS MODIFICADOS
	  final_data.forEach(prod => {
	    const productoActualizado = products[prod.id];
	    this.db.setData(`/data/simple/products/${productoActualizado.id}`, productoActualizado);
	  });

	  // ✅ ACTUALIZAR IDS
	  this.db.setData('/data/simple/id', ids);

	  // ✅ GUARDAR MOVIMIENTO
	  const movimientoId = generarToken(new Date());
	  const movimiento = {
	    idMovimiento: movimientoId,
	    tipo: "facturacion-bodega",
	    fecha: new Date().toISOString(),
	    responsable: validateUser.data.data.user || 'desconocido',
	    descripcion: `Bodega actualizada, stocks actualizados.`,
	    items: final_venta.products.map(ch => ({
	      productoId: ch.id,
	      nombre: ch.name,
	      cantidad: ch.cantidad,
	      precioUnitario: ch.precio_unitario,
	      total: ch.precio_final
	    }))
	  };

	  this.db.setData(`/data/simple/movimientos/${movimientoId}`, movimiento);

	  let finalMovement = { data: final_venta };

	  const productos = finalMovement.data.products.map(p =>
	    `- ${p.name} | Cantidad: ${p.cantidad} | Precio unitario: $${formatNumber(p.precio_final)}`
	  ).join('\n');

	  const mensaje = `
	📦 *ACTUALIZACIÓN DE INVENTARIO*
	🗓️ Fecha: ${new Date().toLocaleString('es-CO')}
	🔢 ID Movimiento: ${finalMovement.data.id}

	SE ACTUALIZÓ EL INVENTARIO, ESTE ES EL STOCK QUE SE HA CAMBIADO:

	📋 Productos:
	${productos}
	`;

	  return { message: "Facturación bodega satisfactoriamente", data: final_venta };
	}



	// FUNCIONES OPTIMIZADAS -------------------------------------------------------------
	viewingStock(){
		let products = this.db.getData('/data/simple/products');

		let finalProductsArray = converterArray(products);

		let productsToAlert = [];


		finalProductsArray.forEach((element, i, array) => {
			if(element.stock < 4){
				productsToAlert.push(element);
			}
		})

		return productsToAlert;
	}
}

module.exports = Database;
module.exports.converterArray = converterArray;
module.exports.sumByDate = sumByDate;
