# Cambios en el Excel de ventas de clientes

Documento de los ultimos cambios para saber que se hizo, por que, y que problemas
pueden aparecer. Todo verificado contra la base real que esta en `system/`
(366 clientes, 146 con compras, 452 compras).

---

## 1. El problema que se estaba corrigiendo

El Excel de ventas mostraba un total mas bajo que el panel de compras del cliente.
Habia dos causas distintas, y la primera se resolvio antes que la segunda.

### 1.1 Ventas que se colaban al filtro de categoria (ESTE era el error grave)

Con el filtro **Categoria = "luker"**, el archivo traia:

| | ventas | total |
|---|---|---|
| Lo que se descargaba | 94 | $9.498.576 |
| Lo que de verdad era "luker" | 63 | $3.547.276 |
| **Se colaba** | **31** | **$5.951.300** |

Las 31 ventas coladas eran de 17 clientes que **no tienen categoria asignada**. El
filtro las dejaba pasar porque no podia decidir si coincidian, asi que las dejaba
entrar y solo avisaba despues con un Toast.

Para el usuario esto es lo peor que puede pasar: el archivo miente sobre su
contenido sinDecirselo en el momento.

**Esta SOLUCIONADO.** Ahora un cliente sin categoria NO es de la categoria pedida, y
sus ventas quedan fuera. Sale un aviso:

> Se excluyeron 31 venta(s) de 17 cliente(s) sin categoría/proviene asignada ($5.951.300).

### 1.2 Ventas que se perdian por no encontrar el cliente

El filtro buscaba el cliente en `window._clientesPagina` (que se llena con
`getClientesCompletos`, sin historial). Con 366 clientes, si la venta no encontraba
su cliente, el filtro **descartaba la venta entera en silencio**.

**Esta SOLUCIONADO** porque el backend ahora manda la categoria y el proviene, y el
frontend filtra por cliente en vez de por venta.

### 1.3 Un diagnostico equivocado que se descarto

Durante el proceso se sospecho que habia compras duplicadas y fechas corruptas.
**Las dos hypotheses eran falsas**, y se verifico:

- 452 compras, **0 duplicados** por `ventaId`
- Fechas en milisegundos validas, entre 2026-09-15 y 2026-10-01
- `compra.total` cuadra exacto con la suma de sus productos (33.651.874 en ambos casos)

Un `1789439615115675204` que parecia una fecha en microsegundos era en realidad la
concatenacion de tres archivos al hacer `cat`: `fecha`=1789439615115 +
`total`=67520 + `ventaId`=4.

---

## 2. Que se cambio

### 2.1 Backend: `APIS/database.js` — `getAllClientesVentas`

**CAMBIO DE FORMATO EN LA RESPUESTA.** Antes devolvia una lista plana de ventas.
Ahora devuelve **clientes agrupados con sus ventas**:

```js
{
  message: "Clientes con sus ventas",
  data: [
    {
      id, name, document, categoria, proviene, deuda,
      ventas: [ { products, recibido, total_pago, date, clienteId, cliente, ... } ]
    }
  ]
}
```

- Se quitaron `categoria` y `proviene` de cada venta: son datos del cliente, no de la
  venta. Viven solo en el cliente.
- Se agrego `deuda` (la de la ficha) y `document`.
- Los 366 clientes se incluyen, incluso los 220 sin compras (con `ventas: []`), para
  que el filtro por categoria sea completo.
- El nombre de la funcion sigue siendo `getAllClientesVentas` pero **la forma de la
  respuesta cambio**. Si algo mas consume ese endpoint, hay que actualizarlo. Solo lo
  usa el Excel (verificado con grep).

### 2.2 Frontend: `scripts/main.js` — filtro en cascada

El filtro se reescribio para trabajar por pasos, como pediste:

1. **Primero los clientes**: se decide que clientes entran por categoria, proviene y
   cliente. Aqui se resuelve el problema del punto 1.1, porque la categoria ya no hay
   que buscarla venta por venta.
2. **Despues las ventas** de cada cliente que sobrevivio: por rango de fechas y por
   condicion. La condicion sigue siendo por venta porque es una propiedad de la venta.

### 2.3 Frontend: filtro de cliente (nuevo)

Se agrego `<select id="filtroVentasCliente">` a la barra de filtros. Se puebla con los
146 clientes que tienen compras (no con los 366), para no ofrecer un cliente que no
puede aparecer en el archivo. Filtra por `clienteId`.

### 2.4 Frontend: `fechaVentaMs(v)` (nuevo, compartido)

Helper unico de parseo de fecha, usado por el Excel y por el panel de compras. Antes
cada pantalla lo parseaba por su cuenta y por eso excluian ventas distintas con los
mismos filtros. Acepta `date`, `fecha`, `cerrada`, `created_at`, en numero o texto, y
normaliza `"AAAA-MM-DD"` a formato local (Safari no lo parsea).

### 2.5 Frontend: hoja Totales

- Agrupa por `id` del cliente usando la ficha (no reconstruyendo desde el mapa del
  frontend), asi dos clientes con el mismo nombre no se fusionan.
- **"En Deuda" ahora toma `deuda` de la ficha** en vez de sumar saldos del rango.

---

## 3. Verificacion

Simulado contra la base real con el codigo tal como quedo:

| Escenario | Esperado | Resultado |
|---|---|---|
| Sin filtros, rango amplio | 452 ventas / $33.651.874 | OK |
| Categoria "luker" | 63 ventas / $3.547.276 | OK |
| Cliente AMBUILA WILMER (#2) | 8 ventas / $348.000 | OK |
| Cliente #1 | 113 ventas / $6.342.027 | OK |
| Control: clientes ajenos en cada categoria | 0 | OK |

Tambien se comparo cliente por cliente (los 146 con compras): panel y Excel coinciden
en ventas y montos, **0 diferencias**.

`node --check` pasa en `APIS/database.js` y `scripts/main.js`.

---

## 4. Problemas que puedes ver (leelo antes de quejarte)

### 4.1 La fila de Totales puede quedar incoherente si filtras por fechas

**Este es el riesgo mas serio que introduje.** Como "En Deuda" ahora sale de la ficha
(no del rango), si el cliente tiene deuda $74.000 pero en el rango Solo aparecen
ventas por $50.000, la fila queda:

```
total 50.000 | deuda 74.000 | contado 0
```

La deuda es **mayor que el total del rango**, lo cual no tiene sentido. El codigo de
antes (sumar saldos del rango) no podia tener ese problema.

Cuando pasa: cuando el rango de fechas no incluye las ventas fiadas del cliente, pero
si incluye otras compras suyas. Con la base actual casi no se nota porque las 4
ventas fiadas del cliente #1 caen dentro del rango habitual, pero con un rango
estrecho (por ejemplo solo un dia) puede aparecer.

Como se arregla: la deuda de la ficha es el saldo total del cliente, no lo que debe
dentro de ese rango. Si prefieres el comportamiento anterior (deuda = saldo del rango)
se cambia en una linea, en `scripts/main.js`, en la parte que dice `deudaFicha`.

### 4.2 El mensaje de "cero ventas" no menciona los filtros

Si el filtro de categoria o cliente deja el archivo vacio, el Toast dice:

> No hay ventas registradas en el rango seleccionado (desde a hasta).

Mentiona solo las fechas, cuando el motivo real puede ser la categoria o el cliente.
Es confuso pero no rompe nada.

### 4.3 El filtro de cliente se arma cada vez que exportas

El desplegable de clientes se reconstruye en cada exportacion (para tener los datos
frescos). Consecuencia: **la seleccion se pierde entre exportaciones distintas**? No,
se preserva (`selCliente.value = previo`), pero si el cliente elegido no trae ventas
en la respuesta, la seleccion se reinicia a "todos".

### 4.4 220 clientes sin compras se procesan siempre

La respuesta incluye los 366 clientes aunque 220 no tengan compras. Son ~269 KB de
JSON y unos 270 ms de armado. No es problema con esta base, pero si crece a miles de
clientes habria que filtrar en el backend.

### 4.5 Un cliente con $1.000 de desfase en la deuda

**MISAEL PERILLA (#367)**: su `deuda` de ficha dice $140.000, pero la suma de sus
movimientos dice $141.000. Los otros 365 clientes cuadran exactamente.

Como la hoja Totales ahora usa la ficha, para ese cliente el Excel va a mostrar
$140.000 mientras el panel de movimientos suma $141.000.

No lo toque: puede ser una venta fiada mal registrada en el otro sistema o un
movimiento duplicado. Se necesita saber cual de las dos.

### 4.6 El panel de compras NO cambio

El panel de compras del cliente (`getComprasCliente`) no se toco. Sigue como estaba.
Los cambios son solo del Excel.

### 4.7 La columna "Documento" puede salir vacia

`documentoCliente(v)` busca el cliente en `mapaClientesPorId` (que viene de
`getClientesCompletos`). Si un cliente no esta cargado ahi, el documento sale vacio
aunque el backend si lo mande en el cliente agrupado. No lo cambié porque afectaba
una columna que funcionaba.

---

## 5. Lo que NO se hizo (a proposito)

- **No se toco la data.** Ninguna compra, movimiento ni deuda fue modificada. Todos
  los cambios son de lectura.
- **No se arreglo el desfase de MISAEL PERILLA** (punto 4.5), por falta de informacion
  para saber cual es el valor correcto.
- **No se cambio el panel de compras**, solo el Excel.
- **No se hizo commit.** Los cambios estan en el working tree.

## 6. Archivos tocados

| Archivo | Que cambio |
|---|---|
| `APIS/database.js` | `_normalizarCompraAVenta` (quito categoria/proviene de la venta), `getAllClientesVentas` (respuesta agrupada) |
| `scripts/main.js` | `fechaVentaMs` (nuevo), filtro en cascada, filtro de cliente, hoja Totales (agrupacion por id + deuda de ficha), aviso de exclusiones, panel usa el helper de fecha |

Para volver atras: `git diff` muestra todo el cambio, y `git checkout -- APIS/database.js scripts/main.js`
lo deshace (perderias estos cambios).