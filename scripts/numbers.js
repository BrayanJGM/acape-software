let mil = 1000;
let millon = mil * 1000;
let trillon = millon * 1000;
let quatrillon = trillon * 1000;


function number(str){
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(k|m|t|q|kilo|millon|trillon|cuatrillon)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'k').toLowerCase();
  switch (type) {
    case 'cuatrillon':
      return n * quatrillon;
    case 'trillon':
      return n * trillon;
    case 'millon':
      return n * millon;
    case 'kilo':
      return n * mil;
    case 'q':
      return n * quatrillon;
    case 't':
      return n * trillon;
    case 'm':
      return n * millon;
    case 'k':
      return n * mil;  
    default:
      return undefined;
  }
}

function getNumber(ms) {
  let msAbs = Math.abs(ms);
  if(msAbs >= quatrillon){
    return Math.round(ms / quatrillon) + 'Q'
  }
  if(msAbs >= trillon){
    return Math.round(ms / trillon) + 'T'
  }
  if (msAbs >= millon) {
    return Math.round(ms / millon) + 'M';
  }
  if (msAbs >= mil) {
    return Math.round(ms / mil) + 'k';
  }
  return ms;
}

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  if(name == "mes"){
    return Math.round(ms / n) + ' ' + name + (isPlural ? 'es' : '');
  }else {
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
  }
}

function formatNumber(number) {
  // Limita a dos decimales
  const formattedNumber = Number(number).toFixed(2);

  // Aplica el formateo con comas
  return formattedNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
