# Finax

App personal para llevar gastos, ingresos y metas de ahorro en el iPhone.
Es una **web app instalable (PWA)**: se agrega a la pantalla de inicio desde Safari,
abre en pantalla completa como cualquier app y funciona sin internet.
Los datos viven **solo en tu iPhone**: no hay servidor ni cuentas.

## Qué hace (versión 1.2)

| Pantalla | Qué ves |
|---|---|
| **Inicio** | Tu dinero disponible, lo apartado en metas, **"Puedes gastar hoy"**, los **próximos pagos fijos**, la semana contra la pasada y lo más reciente |
| **Movimientos** | Todo lo del mes agrupado por día, con filtro de gastos o ingresos. Toca uno para editarlo o eliminarlo. El ícono ⟲ abre los pagos fijos |
| **Pagos fijos** | Renta, servicios y suscripciones: semanales, mensuales o anuales. Los que "se cobran solos" se registran sin tocar nada; los demás se pagan (ajustando el monto si cambió) u omiten desde Inicio |
| **Análisis** | Gasto día por día contra la semana anterior, en qué se fue el dinero, necesidad contra gusto y tendencia de 8 semanas |
| **Metas** | Cada meta con su anillo de progreso y **cuánto apartar por semana** para llegar a la fecha |
| **Ajustes** | Tema claro u oscuro, ocultar montos, colchón mínimo, respaldo y restauración |

### Cómo se calculan las cifras

- **Disponible** = todo lo que entró − todo lo que salió − lo apartado en metas.
- **Apartar por semana** = lo que falta de la meta ÷ semanas que quedan hasta la fecha.
- **Puedes gastar hoy** = (disponible − colchón − lo que tus metas piden apartar en lo que resta del mes − pagos fijos que faltan este mes, incluidos los vencidos) ÷ días que quedan del mes, menos lo que ya gastaste hoy.
  Pagar un pago fijo **no** reduce lo de hoy: ya estaba reservado.
- **Pagos mensuales del día 29, 30 o 31**: en meses más cortos caen el último día del mes.
- **Semana contra semana**: si la semana va a la mitad, se compara contra *los mismos días* de la semana pasada, no contra la semana completa.
- **Fijos contra variables**: si usas pagos fijos, la comparación semanal, las barras de "Día por día" y la categoría
  que más pesa usan solo **gastos variables** (lo que sí decides día a día). Los pagos fijos se muestran aparte
  ("Más $4,500 en pagos fijos"). El total gastado, "En qué se fue", el balance y la tendencia de 8 semanas sí cuentan todo.
- El **saldo inicial** suma a tu disponible pero no cuenta como ingreso de esa semana.

## Probarlo en la computadora

Solo necesitas Node (ya lo tienes, v24).

```bash
node servidor.mjs
```

Abre <http://127.0.0.1:5173>. En Chrome, presiona F12 → ícono de celular para verla con tamaño de iPhone.

Pruebas de los cálculos:

```bash
node --test "pruebas/*.test.mjs"
```

## Instalarla en tu iPhone

Safari solo permite instalar y usar sin conexión páginas con **HTTPS**, así que hay que publicarla.
La forma gratuita más simple es **GitHub Pages**:

1. Crea un repositorio en GitHub llamado `finax`. Puede ser público: lo que se sube es el código, nunca tus datos.
2. Sube esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "feat: primera versión de Finax"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/finax.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. Uno o dos minutos después, abre `https://TU_USUARIO.github.io/finax/` en **Safari** en tu iPhone.
5. Toca **Compartir** → **Agregar a pantalla de inicio** → **Agregar**.
6. Abre Finax desde el ícono. Para comprobar el modo sin internet, activa el modo avión y vuelve a abrirla.

> **Importante:** usa siempre Finax desde el ícono. Safari y la app instalada guardan datos por separado,
> así que lo que registres en una pestaña de Safari no aparece en la app.

### Respaldos

Tus datos están solo en el teléfono. Si borras la app o cambias de iPhone, se pierden.
De vez en cuando ve a **Ajustes → Guardar respaldo** y guárdalo en Archivos o iCloud Drive.
Para recuperarlos: **Ajustes → Restaurar respaldo**.

### Publicar cambios

Al cambiar el código, sube el número de versión de `CACHE` en [sw.js](sw.js) (`finax-v1` → `finax-v2`)
y haz push. La app muestra lo que tiene guardado y descarga la versión nueva en segundo plano,
así que el cambio se ve **la segunda vez** que la abres.

## Estructura

```
index.html            Esqueleto de la app y barra de pestañas
manifest.webmanifest  Nombre, ícono y colores para instalarla
sw.js                 Service worker: guarda la app para abrirla sin internet
css/app.css           Estilo (tokens de color claro y oscuro)
js/app.js             Vistas, hojas, teclado numérico y eventos
js/datos.js           Almacén en localStorage (movimientos, metas, ajustes, respaldo)
js/calculos.js        Las cuentas: disponible, semanas, metas, "puedes gastar hoy"
js/graficas.js        Gráficas en SVG hechas a mano
js/formato.js         Dinero (MXN) y fechas en español
js/iconos.js          Íconos de línea en SVG (pestañas, categorías y metas)
icons/                Ícono de la app (180, 192 y 512 px)
pruebas/              Pruebas de los cálculos con node:test
servidor.mjs          Servidor local para desarrollo
```

## Decisiones

- **Sin frameworks ni dependencias.** HTML, CSS y JavaScript con módulos: no hay que compilar,
  pesa muy poco y GitHub Pages lo publica tal cual.
- **Dinero en centavos (enteros)**, para evitar errores de redondeo como `0.1 + 0.2 = 0.30000000000000004`.
- **Fechas como texto `AAAA-MM-DD` en hora local**: un gasto de las 11 de la noche no se cambia de día por la zona horaria.
- **Íconos propios en escala de grises** para categorías y metas, en lugar de emojis: se ven igual en
  cualquier iPhone, combinan con el resto de la interfaz y no compiten con los colores de las gráficas.
  La opción elegida se muestra invertida (grafito con ícono claro).
- **Colores de gráficas validados para daltonismo** (protanopia, deuteranopia y tritanopia) en claro y oscuro:
  cobalto para gastos, verde para ingresos y oro para lo ahorrado. Cada gráfica con dos series lleva leyenda,
  y al tocar una barra se ve el valor exacto.

## Ideas para siguientes versiones

1. **Presupuesto por categoría**, con aviso al llegar al 80 %.
2. **Resumen del domingo**: la semana en tres frases.
3. **Varias cuentas** (efectivo, débito, tarjeta con fecha de corte y de pago).
4. **"Ya lo compré"** en una meta: convierte lo apartado en un gasto con un toque.
5. **Categorías propias** (nombre e ícono).
6. **Búsqueda** de movimientos por nota.
7. **Bloqueo con Face ID** (con passkeys/WebAuthn).
8. **Exportar a CSV** para abrirlo en Excel o Numbers.
9. **Avisos antes de un cobro** (notificaciones web, disponibles en iOS para apps instaladas).
