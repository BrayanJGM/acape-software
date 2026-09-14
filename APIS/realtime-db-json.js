const path = require('path');
const { LocalStorage } = require('node-localstorage');
const fs = require('fs');

const fsPromises = require('fs').promises;

// Función para generar las rutas y datos específicos recursivamente
function generarRutasYDatos(datos, rutaActual = '') {
  const resultados = [];

  for (const key in datos) {
    if (Object.hasOwnProperty.call(datos, key)) {
      const valor = datos[key];
      const rutaNueva = path.join(rutaActual, key);

      if (typeof valor === 'object' && valor !== null) {
        // Si es un objeto, llamar recursivamente para obtener rutas internas
        const resultadosInternos = generarRutasYDatos(valor, rutaNueva);
        resultados.push(...resultadosInternos);
      } else {
        // Si es un valor simple (string o número), añadir a los resultados
        if (typeof valor === 'string' || typeof valor === 'number') {
          resultados.push({ route: rutaNueva, data: valor });
        }
      }
    }
  }

  return resultados;
}

function eliminarRutaSync(ruta) {
  return fs.rmSync(ruta, { recursive: true, force: true });
}


function asegurarDirectorios(rutaArchivo) {
  const directorio = path.dirname(rutaArchivo);
  if (!fs.existsSync(directorio)) {
    fs.mkdirSync(directorio, { recursive: true });
  }
}

// function debeIgnorarRuta(ruta, ignorePatterns) {
//   // Verifica si la ruta debe ser ignorada basada en los patrones
//   return ignorePatterns.some(ch => ruta.startsWith(ch))
// }

// function leerDirectorio(directorio, ignorePatterns = []) {
//   // Verifica si el directorio existe
//   if (!fs.existsSync(directorio)) {
//     return null;
//   }
//   // Objeto para almacenar la estructura de directorios y archivos
//   let estructura = {};
//   // Lee de manera síncrona el contenido del directorio
//   const archivos = fs.readdirSync(directorio);
//   archivos.forEach(archivo => {
//     // Obtiene la ruta completa del archivo o directorio
//     const rutaCompleta = path.join(directorio, archivo);
//     // Verifica si la ruta completa coincide con alguno de los patrones de ignorados
//     if (ignorePatterns.some(pattern => new RegExp(`${path.join(directorio, pattern)}`).test(rutaCompleta))) {
//       return;
//     }

//     // Verifica si es un directorio
//     if (fs.statSync(rutaCompleta).isDirectory()) {
//       // Si es directorio, recursivamente llama a leerDirectorio
//       estructura[archivo] = leerDirectorio(rutaCompleta, ignorePatterns);
//     } else {
//       // Si es archivo, lee su contenido como JSON
//       const contenido = fs.readFileSync(rutaCompleta, 'utf8');
//       estructura[archivo.split('.')[0]] = JSON.parse(contenido);
//     }
//   });

//   return estructura;
// }

function leerDirectorio(directorio, ignorePatterns = []) {
  if (!fs.existsSync(directorio)) return null;

  let estructura = {};
  const archivos = fs.readdirSync(directorio);

  archivos.forEach(archivo => {
    const rutaCompleta = path.join(directorio, archivo);

    // Ignora si coincide con ignorePatterns
    if (debeIgnorarRuta(rutaCompleta, ignorePatterns)) return;

    const stats = fs.statSync(rutaCompleta);

    if (stats.isDirectory()) {
      estructura[archivo] = leerDirectorio(rutaCompleta, ignorePatterns);
    } else {
      // Lee cualquier archivo como texto y parsea si es .json o .fdb
      const contenido = fs.readFileSync(rutaCompleta, 'utf8');
      try {
        estructura[archivo.split('.')[0]] = JSON.parse(contenido);
      } catch (e) {
        estructura[archivo.split('.')[0]] = contenido; // Devuelve texto si no es JSON válido
      }
    }
  });

  return estructura;
}

function leerDirectorioLimitado(directorio, ignorePatterns = [], limite = 100) {
  if (!fs.existsSync(directorio)) return null;

  let estructura = {};

  const archivos = fs.readdirSync(directorio)
    .map(nombre => {
      const ruta = path.join(directorio, nombre);
      const stats = fs.statSync(ruta);
      return {
        nombre,
        ruta,
        stats
      };
    })
    // Ordenar por última modificación (recientes primero)
    .sort((a, b) => b.stats.mtime - a.stats.mtime)
    // Limitar la cantidad
    .slice(0, limite);

  archivos.forEach(({ nombre, ruta, stats }) => {
    if (debeIgnorarRuta(ruta, ignorePatterns)) return;

    if (stats.isDirectory()) {
      estructura[nombre] = leerDirectorioLimitado(ruta, ignorePatterns, limite);
    } else {
      const contenido = fs.readFileSync(ruta, 'utf8');
      try {
        estructura[nombre.split('.')[0]] = JSON.parse(contenido);
      } catch (e) {
        estructura[nombre.split('.')[0]] = contenido;
      }
    }
  });

  return estructura;
}


// function debeIgnorarRuta(ruta, ignorePatterns) {
//   return ignorePatterns.some(pattern => ruta.includes(pattern));
// }

const minimatchDependencies = require('minimatch');
const minimatch = minimatchDependencies.minimatch;

function debeIgnorarRuta(ruta, ignorePatterns) {
  return ignorePatterns.some(pattern => {
    // Compatibilidad: si el patrón no empieza con *, agregamos **
    const compatiblePattern = pattern.startsWith('*') || pattern.startsWith('**') 
      ? pattern 
      : `**/${pattern}`;
    return minimatch(ruta, compatiblePattern);
  });
}



function rutasAObjeto(ruta, valor) {
  if (!valor) return ruta;

  const partes = ruta.split('/').filter(part => part !== '');

  function asignarValor(obj, partes, valor) {
    let clave = partes.shift();
    if (partes.length === 0) {
      obj[clave] = valor;
    } else {
      obj[clave] = asignarValor(obj[clave] || {}, partes, valor);
    }
    return obj;
  }

  return asignarValor({}, partes, valor);
}


class Database {
  constructor(route_base) {
    this.route = route_base ? route_base : "./system";
  }
  start() {
    asegurarDirectorios(this.route);
    return leerDirectorio(this.route)?leerDirectorio(this.route):{};
  }
  setData(route, object) {
    let super_array = generarRutasYDatos(rutasAObjeto(route, object));
    super_array.forEach((element) => {
      asegurarDirectorios(`${this.route}/${element.route}.fdb`)
      fs.writeFileSync(`${this.route}/${element.route}.fdb`, JSON.stringify(element.data));
    })

    return object;
  }
  getData(name, ignores = []) {
    let final_return = leerDirectorio(`./${path.join(this.route, name)}`, ignores?ignores:[]);
    return final_return?final_return:{};
  }
  initData(name){
    let final_return = leerDirectorio(`./${path.join(this.route, name)}`);
    return final_return;
  }
  removeData(name) {
    let final_return = eliminarRutaSync(`./${path.join(this.route, name)}`);
    return name;
  }  

  async getLastNMovements(directorio, ignore,limite) {
    let final_return = leerDirectorioLimitado(`./${path.join(this.route, directorio)}`, ignore,limite);

    return final_return;
  }

}

module.exports = Database;
