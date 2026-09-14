let segundos = 1000;
let minutos = segundos * 60;
let horas = minutos * 60;
let dias = horas * 24;
let semana = dias * 7;
let meses = dias * 30;
let años = meses * 12;

function converter(ms, object, date){
  if(!object){
    return getTime(ms);
  }else {
    if(object.long == true){
      if(!date){
        return getTimeLong(ms);
      }else {
        let convirtiendo = getTimeLong(getRemainTime(date).remainTime);
        return convirtiendo;
      }
    }
    if(date){
      let convirtiendo = getTime(getRemainTime(date).remainTime);
      return convirtiendo;
    }
    else {
      return timems(ms)
    }
  }
}

function timems(str){
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(ms|s|m|h|d|mes|año)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'año':
      return n * años;
    case 'mes':
      return n * meses;
    case 'd':
      return n * dias;
    case 'h':
      return n * horas;
    case 'm':
      return n * minutos;
    case 's':
      return n * segundos;
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

function getTime(ms) {
  let msAbs = Math.abs(ms);
  if(msAbs >= años){
    return Math.round(ms / años) + 'año'
  }
  if(msAbs >= meses){
    return Math.round(ms / meses) + 'mes'
  }
  if (msAbs >= dias) {
    return Math.round(ms / dias) + 'd';
  }
  if (msAbs >= horas) {
    return Math.round(ms / horas) + 'h';
  }
  if (msAbs >= minutos) {
    return Math.round(ms / minutos) + 'm';
  }
  if (msAbs >= segundos) {
    return Math.round(ms / segundos) + 's';
  }
  return ms + 'ms';
}

function getTimeLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= años) {
    return plural(ms, msAbs, años, 'año');
  }
  if (msAbs >= meses) {
    return plural(ms, msAbs, meses, 'mes');
  }
  if (msAbs >= dias) {
    return plural(ms, msAbs, dias, 'dia');
  }
  if (msAbs >= horas) {
    return plural(ms, msAbs, horas, 'hora');
  }
  if (msAbs >= minutos) {
    return plural(ms, msAbs, minutos, 'minuto');
  }
  if (msAbs >= segundos) {
    return plural(ms, msAbs, segundos, 'segundo');
  }
  return ms + ' ms';
}

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  if(name == "mes"){
    return Math.round(ms / n) + ' ' + name + (isPlural ? 'es' : '');
  }else {
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
  }
}

const getRemainTime = deadline => {
  if(!deadline){
    deadline = new Date();
  }
  let now = new Date(),
    remainTime = (now - new Date(deadline) + 1000),
    timersegs = (now - new Date(deadline) + 1000) / 1000,
    segundos = ('0' + Math.floor(timersegs % 60)).slice(-2),
    minutos = ('0' + Math.floor(timersegs / 60 % 60)).slice(-2),
    horas = ('0' + Math.floor(timersegs / 3600 % 24)).slice(-2),
    dias = Math.floor(timersegs / (3600 * 24)),
    mes = Math.floor(timersegs / (dias * 30));

  return {
    remainTime,
    timersegs,
    segundos,
    minutos,
    horas,
    dias,
    mes
  }
};

const getTimeRest = deadline => {
  if(!deadline) {
    deadline  = new Date()
  }

  let time = {
    ano: timems('1año'),
    mes: timems('1mes'),
    dia: timems('1d'),
    hora: timems('1h'),
    minuto: timems('1m'),
    segundo: 1000
  };

  let actuallyDate = new Date();
  let ultimateDate = deadline - actuallyDate;

  let años = () => {
    let finally1 = Math.floor(ultimateDate/time.ano);
    ultimateDate = ultimateDate - (time.ano * finally1);
    return finally1;
  },
  mes = () => {
    var finally1 = Math.floor(ultimateDate / time.mes);
    ultimateDate = ultimateDate - (finally1 * time.mes);
    return finally1;
  },
  dia = () => {
    var finally1 = Math.floor(ultimateDate / time.dia);
    ultimateDate = ultimateDate - (finally1 * time.dia);
    return finally1;
  },
  hora = () => {
    var finally1 = Math.floor(ultimateDate / time.hora);
    ultimateDate = ultimateDate - (finally1 * time.hora);
    return finally1;
  },
  min = () => {
    var finally1 = Math.floor(ultimateDate / time.minuto);
    ultimateDate = ultimateDate - (finally1 * time.minuto);
    return finally1;
  },
  seg = () => {
    var finally1 = Math.floor(ultimateDate / time.segundo);
    ultimateDate = ultimateDate - (finally1 * time.segundo);
    return finally1;
  };

  let finalText = "";

  let record_año = años(),
  record_mes = mes(),
  record_dia = dia(),
  record_hora = hora(),
  record_min = min(),
  record_seg = seg();

  if(record_año>0) finalText += `${record_año} año(s), `;
  if(record_mes>0) finalText += `${record_mes} mes(es), `;
  if(record_dia>0) finalText += `${record_dia} dia(s), `;
  if(record_hora>0) finalText += `${record_hora} hora(s), `;
  if(record_min>0) finalText += `${record_min} minuto(s), `;
  if(record_seg>0) finalText += `${record_seg} segundo(s) `;

  return finalText;
}

const forDate = deadline => {
  if(!deadline){
    deadline = new Date();
    console.error('Ingrese la informacion')
  }

  let meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo',
  'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre',
  'Diciembre'];

  let antes = new Date(deadline),
    hora = ('0' + JSON.stringify(antes.getHours())).slice(-2),
    minutos = ('0' + JSON.stringify(antes.getMinutes())).slice(-2),
    data = hora >= 12 || "am",
    dia = antes.getDate(),
    mes = meses[antes.getMonth()],
    año = antes.getFullYear()

    if(data == true){
      data = "pm";
      hora = ('0' + JSON.stringify(hora - 12)).slice(-2);
    }

  return {
    data,
    hora,
    minutos,
    dia,
    mes,
    año,
    Fecha: antes
  }
};