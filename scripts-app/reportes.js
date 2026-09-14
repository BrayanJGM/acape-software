const selectedForm = document.querySelector('.selected-form');

function converterArraySett(object) {
  let keys = Object.keys(object);
  let arrayToReturn = [];

  keys.forEach((element, i, array) => {
    arrayToReturn.push(object[element]);
  })

  return arrayToReturn;
}

selectedForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Obtener valores de los inputs y ajustar la zona horaria correctamente
  let inicio = new Date(e.target[0].value + "T00:00");
  let final = new Date(e.target[1].value + "T00:00");

  // Construcción del objeto con fechas corregidas
  let finalData = {
    inicio: inicio,
    final: final
  };

  let finalArray = converterArraySett(data_server.movements);

  const datosFiltrados = finalArray.filter(d => {
    let fechaDato = new Date(d.date); // Se convierte en objeto Date

    // Normalizar fechas (ignorar horas)
    let fechaDatoNormalizada = new Date(fechaDato.getFullYear(), fechaDato.getMonth(), fechaDato.getDate());
    let inicioNormalizado = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    let finalNormalizado = new Date(final.getFullYear(), final.getMonth(), final.getDate());

    return fechaDatoNormalizada >= inicioNormalizado && fechaDatoNormalizada <= finalNormalizado;
  });

  const finalDatosFiltrados = datosFiltrados.filter(d => !d.type.includes('Transferencia'))

  let contabilidad_movements = finalDatosFiltrados;

  let finalCajas = converterArraySett(data_cajas).filter(d => {
    let fechaDato = new Date(d.cerrada); // Se convierte en objeto Date

    // Normalizar fechas (ignorar horas)
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
    <p><b>Dinero Gastado:</b> $ ${formatNumber(suma_negatives)} - <div class="decrease">${percentaje_negatives.toFixed(2)} %</div> ${filter_movements_negatives.length} Movimiento(s)
    </p><br>
    <p><b>Dinero Entrante:</b> $ ${formatNumber(suma_positives)} - <div class="increase">${percentaje_positivies.toFixed(2)} %</div> ${filter_movements_positives.length} Movimiento(s)</p>
    <br>
    <p><b>Total Recaudado:</b> ${formatNumber(suma_positives + suma_negatives)}</p>
  `;

  movements.innerHTML = contabilidad_movements.map(ch => `
    <tr>
      <td>${new Date(ch.date).toLocaleString()}</td>
      <td>${ch.type}</td>
      <td class="${ch.sign=="-"?"text-danger":"text-primary"}">${formatNumber(ch.money)}</td>
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
  `).join('')

  // -----------------------------------------------------------

});
