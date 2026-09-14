const axios = require('axios');

class siops {
	constructor(name){
		this.name = name;
		this.databaseURL = "https://siops-54207-default-rtdb.firebaseio.com/";
	}
	async start(token, func){
		let final = axios(`${this.databaseURL}${token}.json`);
		let timejustnow = await axios('http://worldtimeapi.org/api/timezone/America/Bogota');
		return final.then((data) => {
			let justnow = new Date(timejustnow.data.datetime);
			let timeRest = new Date(data.data.timeRest);
			let restJust = timeRest - justnow;
			if(restJust <= 0){
				func(null, {message: "Esta suscripción ya se vencio, por favor cancelar el pago.", type: "error"});
			}else {
				func({message: "Suscripción aceptada.", data: data.data}, null);
			}
		}).catch((err) => {
			func(null, {message: "Esta suscripción no existe o fue cancelada.", type: "error"});
		})
	}
}

module.exports = {siops, token: siops}