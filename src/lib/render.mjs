// El Garaje - plantillas HTML.
//
// El fondo es un tablero perforado y el contenido cuelga de el en paneles de
// tamanos desiguales. Dos colores con funcion: azul de plano para la bici,
// laton para el gimnasio. Nunca decoran.
//
// Dos usos mandan sobre todo lo demas:
//   - el gimnasio se mira en el movil, entre series: animacion grande,
//     numeros grandes y la teoria plegada;
//   - en una ruta lo primero es descargar el GPX y saber como es.

import { esc, markdown } from "./content.mjs";
import { TIPOS_PUNTO } from "./puntos.mjs";
import { analizarVideo } from "./video.mjs";
import { TIPOS_BICI, TIPOS_RECORRIDO, DIFICULTADES, km, entero, decimal, duracion, fechaLarga } from "./formato.mjs";

const SITIO = "El Garaje";
const HOST = "https://parra28.github.io";

const FUENTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chivo:wght@400;600;800&display=swap" rel="stylesheet">`;

const LEAFLET = `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>`;

// --------------------------------------------------------------- silueta

/** Banda de pendiente de un tramo: 1 llano o suave, 2 media, 3 dura. */
function banda(pendiente) {
  if (pendiente === null || pendiente === undefined) return 1;
  return pendiente >= 8 ? 3 : pendiente >= 4 ? 2 : 1;
}

/** Paso redondo para las lineas de altitud: como mucho cuatro lineas. */
function pasoAltitud(rango) {
  for (const p of [25, 50, 100, 200, 250, 500, 1000]) if (rango / p <= 4) return p;
  return 2000;
}

/**
 * El perfil de altimetria como silueta maciza. En la ficha (hero) la silueta
 * se parte en tramos por pendiente, que es lo que de verdad dice como es una
 * ruta, y lleva lineas de altitud y la regla de kilometros.
 */
function silueta(perfil, { puntos = [], hero = false, clase = "" } = {}) {
  const W = 1000;
  const H = 240;
  const validos = perfil.filter((p) => p[1] !== null && p[1] !== undefined);
  if (validos.length < 2) return "";
  const dTotal = perfil[perfil.length - 1][0];
  const eles = validos.map((p) => p[1]);
  const techo = Math.max(...eles);
  const suelo = Math.min(...eles);
  const rango = Math.max(40, techo - suelo);
  const base = suelo - rango * 0.28;
  const alto = techo + rango * 0.12;
  const X = (d) => (d / dTotal) * W;
  const Y = (e) => H - ((e - base) / (alto - base)) * H;
  const xy = (p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;

  if (!hero) {
    const d = `M0,${H} ` + validos.map((p) => `L${xy(p)}`).join(" ") + ` L${W},${H} Z`;
    return `<svg class="silueta${clase ? ` ${clase}` : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  // La pendiente punto a punto es ruido: se mide sobre una ventana de unos
  // cientos de metros y los tramos muy cortos se funden con el anterior.
  const ventana = Math.max(250, dTotal / 250);
  let j0 = 0;
  let j1 = 0;
  const bandas = validos.map((p) => {
    while (validos[j0][0] < p[0] - ventana) j0++;
    while (j1 < validos.length - 1 && validos[j1 + 1][0] <= p[0] + ventana) j1++;
    const dd = validos[j1][0] - validos[j0][0];
    return banda(dd > 0 ? ((validos[j1][1] - validos[j0][1]) / dd) * 100 : 0);
  });
  const minimo = Math.max(400, dTotal / 120);
  let inicio = 1;
  for (let i = 2; i <= validos.length; i++) {
    if (i === validos.length || bandas[i] !== bandas[inicio]) {
      const largo = validos[i - 1][0] - validos[inicio - 1][0];
      if (largo < minimo && inicio > 1) for (let k = inicio; k < i; k++) bandas[k] = bandas[inicio - 1];
      inicio = i;
    }
  }

  // tramos seguidos con la misma banda de pendiente, cada uno su poligono
  const tramos = [];
  let actual = null;
  for (let i = 1; i < validos.length; i++) {
    const b = bandas[i];
    if (!actual || actual.b !== b) {
      actual = { b, pts: [validos[i - 1]] };
      tramos.push(actual);
    }
    actual.pts.push(validos[i]);
  }
  const relleno = tramos
    .map((t) => {
      const x0 = X(t.pts[0][0]).toFixed(1);
      const x1 = X(t.pts[t.pts.length - 1][0]).toFixed(1);
      return `<path class="pend-${t.b}" d="M${x0},${H} ${t.pts.map((p) => `L${xy(p)}`).join(" ")} L${x1},${H} Z"/>`;
    })
    .join("");

  const paso = pasoAltitud(alto - base);
  const niveles = [];
  for (let e = Math.ceil(base / paso) * paso; e < alto; e += paso) {
    if (Y(e) > 14 && Y(e) < H - 10) niveles.push(e);
  }
  const lineasAlt = niveles
    .map((e) => `<line x1="0" x2="${W}" y1="${Y(e).toFixed(1)}" y2="${Y(e).toFixed(1)}"/>`)
    .join("");
  const etiquetasAlt = niveles
    .map((e) => `<span style="top:${((Y(e) / H) * 100).toFixed(2)}%">${entero(e)} m</span>`)
    .join("");

  const kmTotal = dTotal / 1000;
  const pasoKm = kmTotal > 100 ? 20 : kmTotal > 40 ? 10 : kmTotal > 15 ? 5 : 2;
  const marcas = [];
  for (let k = pasoKm; k < kmTotal; k += pasoKm) marcas.push(k);

  const cortes = puntos
    .map((pt) => {
      const x = X(Math.min(pt.metros, dTotal));
      return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"><title>${esc(
        `${pt.etiqueta}, km ${decimal(pt.km)}`
      )}</title></line>`;
    })
    .join("");

  const etiquetas = puntos
    .map((pt) => {
      const pos = Math.min(pt.metros, dTotal) / dTotal;
      return `<span class="corte-etiqueta${pos > 0.8 ? " al-final" : ""}" style="left:${(pos * 100).toFixed(
        3
      )}%">${esc(pt.etiqueta)}, km ${decimal(pt.km)}</span>`;
    })
    .join("");

  const regla = marcas
    .map((k) => `<span class="marca-km" style="left:${(((k * 1000) / dTotal) * 100).toFixed(3)}%"><i></i><b>${entero(k)}</b></span>`)
    .join("");

  return `<div class="perfil-caja">
  <div class="hero-etiquetas">${etiquetas}</div>
  <div class="perfil-lienzo">
    <svg id="perfil" class="silueta hero" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      role="img" aria-label="Perfil de altimetría, de ${entero(suelo)} a ${entero(techo)} metros a lo largo de ${decimal(kmTotal)} kilómetros"
      data-dtotal="${dTotal}" data-base="${base.toFixed(2)}" data-alto="${alto.toFixed(2)}" data-h="${H}" data-w="${W}">
      <g class="rejilla-alt">${lineasAlt}</g>
      ${relleno}
      <g class="cortes">${cortes}</g>
      <line id="perfil-cruz" class="perfil-cruz" x1="0" y1="0" x2="0" y2="${H}" hidden/>
      <circle id="perfil-punto" class="perfil-punto" r="5" hidden/>
    </svg>
    <div class="eje-alt" aria-hidden="true">${etiquetasAlt}</div>
  </div>
  <div class="hero-regla">${regla}</div>
  <div class="perfil-leyenda" aria-hidden="true">
    <span><i class="pend-1"></i>Menos del 4 %</span>
    <span><i class="pend-2"></i>Del 4 al 8 %</span>
    <span><i class="pend-3"></i>Más del 8 %</span>
  </div>
  <div id="perfil-globo" class="globo" hidden></div>
</div>`;
}

/**
 * El trazado de la ruta dibujado en el build, sobre fondo liso. Sin teselas:
 * la tarjeta cuenta la forma de la ruta y la portada no pide nada a nadie.
 */
function trazadoSvg(trazado, maximo = 260) {
  if (!trazado || trazado.length < 2) return "";
  const paso = Math.max(1, Math.ceil(trazado.length / maximo));
  const pts = [];
  for (let i = 0; i < trazado.length; i += paso) pts.push(trazado[i]);
  pts.push(trazado[trazado.length - 1]);

  const latMedia = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos((latMedia * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const ancho = Math.max(maxX - minX, 1e-6);
  const alto = Math.max(maxY - minY, 1e-6);
  const escala = 1000 / Math.max(ancho, alto);
  const margen = 70;
  const W = ancho * escala + margen * 2;
  const H = alto * escala + margen * 2;
  const P = (i) => `${((xs[i] - minX) * escala + margen).toFixed(1)},${((ys[i] - minY) * escala + margen).toFixed(1)}`;
  const d = "M" + pts.map((_, i) => P(i)).join("L");
  const [sx, sy] = P(0).split(",");

  return `<svg class="trazado" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <path class="trazado-borde" d="${d}"/><path class="trazado-linea" d="${d}"/>
    <circle class="trazado-salida" cx="${sx}" cy="${sy}" r="16"/>
  </svg>`;
}

/** Trazado reducido para el mapa de cada tarjeta, que se monta en el navegador. */
function trazadoMini(trazado, maximo = 170) {
  if (!trazado || trazado.length === 0) return [];
  const paso = Math.max(1, Math.ceil(trazado.length / maximo));
  const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
  const out = [];
  for (let i = 0; i < trazado.length; i += paso) out.push(r4(trazado[i]));
  out.push(r4(trazado[trazado.length - 1]));
  return out;
}

/** Datos y scripts de los mapas de las tarjetas de ruta. */
function scriptsMapas(rutas, base, ver) {
  if (!rutas.length) return "";
  const datos = {};
  for (const r of rutas) datos[r.slug] = trazadoMini(r.trazado);
  return `${LEAFLET}
<script type="application/json" id="datos-mapas">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>
<script src="${base}assets/minimapas.js${ver ? `?v=${ver}` : ""}"></script>`;
}

// ---------------------------------------------------------------- piezas

function dato(valor, unidad, etiqueta, { grande = false } = {}) {
  if (valor === null || valor === undefined || valor === "") return "";
  return `<div class="dato${grande ? " grande" : ""}"><b>${valor}${
    unidad ? `<small>${esc(unidad)}</small>` : ""
  }</b><span>${esc(etiqueta)}</span></div>`;
}

function tiempos(r) {
  if (r.tiempoMovimiento) {
    return [
      { etiqueta: "En movimiento", valor: duracion(r.tiempoMovimiento) },
      { etiqueta: "Tiempo total", valor: duracion(r.tiempoTotal) || "—" },
    ];
  }
  return [{ etiqueta: "Tiempo estimado", valor: duracion(r.tiempoEstimado) }];
}

function tipoBici(r) {
  const b = TIPOS_BICI[r.bici];
  if (!b) return "";
  return `<span class="tipo tipo-${esc(r.bici)}">${
    b.icono ? `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">${b.icono}</svg>` : ""
  }${esc(b.etiqueta)}</span>`;
}

/** Lugar y forma de la ruta, en lenguaje llano. */
function lugarRuta(r) {
  const partes = [r.zona, TIPOS_RECORRIDO[r.tipoRecorrido]];
  if (r.dificultad) partes.push(DIFICULTADES[r.dificultad].toLowerCase());
  return esc(partes.filter(Boolean).join(", "));
}

// ------------------------------------------------------------- esqueleto

function layout({ base, titulo, descripcion, seccion = "", contenido, scripts = "", imagen = "", ver = "", clase = "" }) {
  const v = ver ? `?v=${ver}` : "";
  const marca = (s) => (seccion === s ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo === SITIO ? SITIO : `${titulo} · ${SITIO}`)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="website">
${imagen ? `<meta property="og:image" content="${esc(imagen)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#dedfdc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111314" media="(prefers-color-scheme: dark)">
${FUENTES}
<link rel="stylesheet" href="${base}assets/styles.css${v}">
<link rel="icon" href="${base}assets/icono.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem("garaje-tema");if(t)document.documentElement.dataset.tema=t}catch(e){}</script>
</head>
<body${clase ? ` class="${clase}"` : ""}>
<a class="salto" href="#principal">Ir al contenido</a>
<header class="barra">
  <div class="caja barra-fila">
    <a class="marca" href="${base}">${SITIO}</a>
    <nav class="navega">
      <a href="${base}rutas/"${marca("rutas")}>Rutas</a>
      <a href="${base}gimnasio/"${marca("gimnasio")}>Gimnasio</a>
      <button type="button" id="boton-tema" class="boton-tema" aria-label="Cambiar entre tema claro y oscuro">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/></svg>
      </button>
    </nav>
  </div>
</header>
<main id="principal"><div class="caja">
${contenido}
</div></main>
<script src="${base}assets/tema.js${v}"></script>
${scripts}
</body>
</html>
`;
}

// ------------------------------------------------------- paneles sueltos

/**
 * Tarjeta de ruta: arriba la forma del trazado, debajo una franja con el
 * perfil. La destacada ocupa el doble y tiene las cifras grandes.
 */
function panelRuta(r, base, { destacada = false } = {}) {
  const t = tiempos(r);
  const op = { grande: destacada };
  return `<a class="panel enlace ajustado ruta-panel es-bici ${destacada ? "c8 destacada" : "c4"}" href="${base}ruta/${r.slug}/"
  data-busqueda="${esc([r.nombre, r.zona, r.provincia, (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase())}"
  data-zona="${esc(r.zona || "")}" data-bici="${esc(r.bici || "")}"
  data-dist="${r.distancia}" data-dplus="${r.desnivelPositivo}" data-dif="${r.dificultad || 0}" data-orden="${r.orden}">
  <div class="ruta-mapa" data-slug="${esc(r.slug)}">${trazadoSvg(r.trazado)}</div>
  <div class="ruta-perfil">${silueta(r.perfil, { clase: "mini" })}</div>
  <div class="ruta-cuerpo">
    ${destacada ? `<p class="antetitulo">La última ruta</p>` : ""}
    <h3>${esc(r.nombre)}</h3>
    <p class="ruta-lugar">${lugarRuta(r)}</p>
    <div class="ruta-cifras">
      ${dato(km(r.distancia), "km", "Distancia", op)}
      ${dato(entero(r.desnivelPositivo), "m", "Desnivel", op)}
      ${dato(t[0].valor, "", t[0].etiqueta, op)}
    </div>
    <div class="material">${tipoBici(r)}</div>
  </div>
</a>`;
}

function panelRutina(r, base, { destacada = false } = {}) {
  const gif = r.gifs && r.gifs.length ? r.gifs[0].archivo : "";
  const op = { grande: destacada };
  return `<a class="panel enlace ajustado rutina-panel es-gimnasio ${destacada ? "c8 destacada" : "c4"}" href="${base}gimnasio/${r.slug}/">
  ${
    gif
      ? `<div class="rutina-gif"><img src="${base}gimnasio/${r.slug}/videos/${encodeURIComponent(
          gif
        )}" alt="" loading="lazy" decoding="async"></div>`
      : ""
  }
  <div class="rutina-cuerpo">
  ${destacada && r.dia ? `<p class="antetitulo">${esc(r.dia)}</p>` : ""}
  <h3>${esc(sinEmoji(r.nombre))}</h3>
  ${r.resumen ? `<p class="rutina-resumen">${esc(r.resumen)}</p>` : ""}
  <div class="datos">
    ${dato(entero(r.duracion), "min", "Duración", op)}
    ${dato(entero(r.ejercicios), "", "Ejercicios", op)}
    ${dato(entero(r.series), "", "Series", op)}
  </div>
  ${
    r.intensidad || r.material.length
      ? `<div class="material">${r.intensidad ? `<span>${esc(r.intensidad)}</span>` : ""}${r.material
          .map((m) => `<span>${esc(m)}</span>`)
          .join("")}</div>`
      : ""
  }
  </div>
</a>`;
}

/** Cabecera de una seccion: titulo y cifras en un solo panel. */
function cabeceraSeccion(titulo, frase, cifras, extra = "") {
  return `<section class="panel c12 cabecera-seccion">
    <div class="cabecera-texto">
      <h1 class="titular">${esc(titulo)}</h1>
      <p class="sub">${frase}</p>
      ${extra}
    </div>
    <div class="datos">${cifras}</div>
  </section>`;
}

// ---------------------------------------------------------------- portada

export function paginaPortada({ base, rutas, rutinas, ver = "" }) {
  // La portada no lo enseña todo: una pieza destacada por seccion y unas
  // pocas mas. El resto, en la pagina de cada seccion.
  const rutinasVista = rutinas.slice(0, 2);
  const rutasVista = rutas.slice(0, 5);

  const contenido = `
<div class="rejilla">
  <section class="panel c12">
    <h1 class="portada-titulo">El Garaje</h1>
    <p class="portada-frase">El sitio donde se cuelga la bici al volver, se limpia la cadena y se piensa
    la próxima salida. Aquí se guardan las rutas que merece la pena repetir y el trabajo de fuerza
    que hace falta para rodarlas mejor.</p>
  </section>

  <section class="panel c12 cabecera es-gimnasio">
    <div>
      <h2>Gimnasio</h2>
      <p>${entero(rutinas.length)} rutinas de fuerza con la animación de cada ejercicio</p>
    </div>
    <a href="${base}gimnasio/">Ver ${rutinas.length === 1 ? "la rutina" : `las ${entero(rutinas.length)} rutinas`}</a>
  </section>
  ${rutinasVista.map((r, i) => panelRutina(r, base, { destacada: i === 0 && rutinasVista.length > 1 })).join("\n")}

  <section class="panel c12 cabecera es-bici">
    <div>
      <h2>Rutas</h2>
      <p>${entero(rutas.length)} rutas con su mapa, su perfil y el GPX para descargar</p>
    </div>
    <a href="${base}rutas/">Ver ${rutas.length === 1 ? "la ruta" : `las ${entero(rutas.length)} rutas`}</a>
  </section>
  ${rutasVista.map((r, i) => panelRuta(r, base, { destacada: i === 0 && rutasVista.length > 1 })).join("\n")}

  <section class="panel c12"><p class="pie">Rutas propias, trazadas y verificadas sobre el terreno. Los archivos GPX
  se ofrecen tal cual: comprueba siempre el estado de los caminos y la normativa de la zona antes de salir.</p></section>
</div>`;

  return layout({
    base,
    titulo: SITIO,
    descripcion: `${rutas.length} rutas en bici con mapa, perfil y GPX, y ${rutinas.length} rutinas de fuerza para ciclista.`,
    contenido,
    scripts: scriptsMapas(rutasVista, base, ver),
    ver,
  });
}

// ----------------------------------------------------------- lista rutas

function grupoFiltros(id, titulo, opciones) {
  return `<div class="filtros" role="group" aria-labelledby="g-${id}">
      <span class="filtros-titulo" id="g-${id}">${esc(titulo)}</span>
      <button type="button" class="chip activo" data-grupo="${id}" data-valor="" aria-pressed="true">Todas</button>
      ${opciones
        .map(
          ([valor, etiqueta]) =>
            `<button type="button" class="chip${id === "bici" ? ` chip-tipo tipo-${esc(valor)}` : ""}" data-grupo="${id}" data-valor="${esc(valor)}" aria-pressed="false">${esc(etiqueta)}</button>`
        )
        .join("")}
    </div>`;
}

export function paginaIndice({ base, rutas, zonas, ver = "" }) {
  const bicis = [...new Set(rutas.map((r) => r.bici).filter(Boolean))];
  const totalKm = rutas.reduce((a, r) => a + r.distancia, 0);
  const totalD = rutas.reduce((a, r) => a + r.desnivelPositivo, 0);

  const contenido = `
<div class="rejilla">
  ${cabeceraSeccion(
    "Rutas",
    "Cada ruta lleva su mapa, el perfil de altimetría, las paradas y el GPX para descargar.",
    `${dato(entero(rutas.length), "", "Rutas")}
      ${dato(entero(totalKm / 1000), "km", "Recorridos")}
      ${dato(entero(totalD), "m", "Desnivel")}`
  )}

  <section class="panel c12 panel-filtros">
    <div class="buscador">
      <label for="f-buscar" class="sr">Buscar</label>
      <input type="search" id="f-buscar" placeholder="Nombre, zona o pueblo" autocomplete="off">
      <label for="f-orden" class="sr">Ordenar</label>
      <select id="f-orden">
        <option value="orden">Más recientes</option>
        <option value="dist">Más cortas</option>
        <option value="-dist">Más largas</option>
        <option value="dplus">Menos desnivel</option>
        <option value="-dplus">Más desnivel</option>
        <option value="dif">Más fáciles</option>
        <option value="-dif">Más difíciles</option>
      </select>
    </div>
    ${bicis.length > 1 ? grupoFiltros("bici", "Tipo", bicis.map((b) => [b, TIPOS_BICI[b] ? TIPOS_BICI[b].etiqueta : b])) : ""}
    ${zonas.length > 1 ? grupoFiltros("zona", "Zona", zonas.map((z) => [z, z])) : ""}
    <p class="contador" id="contador" aria-live="polite"></p>
  </section>

  <div class="rejilla c12" id="listado-rutas">
    ${rutas.map((r) => panelRuta(r, base)).join("\n")}
  </div>
  <p class="panel c12 vacio" id="vacio" hidden>No hay ninguna ruta que coincida. <button type="button" id="limpiar">Quitar los filtros</button></p>
</div>`;

  return layout({
    base,
    titulo: "Rutas",
    seccion: "rutas",
    descripcion: `${rutas.length} rutas en bici de carretera, gravel y MTB con mapa, perfil de altimetría y descarga del GPX.`,
    contenido,
    scripts: `<script src="${base}assets/indice.js${ver ? `?v=${ver}` : ""}"></script>
${scriptsMapas(rutas, base, ver)}`,
    ver,
  });
}

// ------------------------------------------------------------ ficha ruta

export function paginaRuta({ base, r, otras, ver = "" }) {
  const v = ver ? `?v=${ver}` : "";
  const videos = (r.videos || []).map(analizarVideo).filter(Boolean);
  const t = tiempos(r);
  // los videos verticales (reels) van en una columna estrecha junto a las fotos
  const soloVerticales = videos.length > 0 && videos.every((vi) => vi.vertical);

  // El punto de salida es el primer punto del GPX: con sus coordenadas y un
  // enlace para ir en coche hasta él.
  let salida = r.parking ? esc(r.parking) : "";
  if (r.inicio) {
    const lat = r.inicio.lat.toFixed(5);
    const lon = r.inicio.lon.toFixed(5);
    const coords = `${lat.replace(".", ",")}, ${lon.replace(".", ",")}`;
    salida += `${salida ? "<br>" : ""}<span class="salida">
      <button type="button" class="salida-punto" data-metros="0" aria-label="Ver el punto de salida en el mapa">${coords}</button>
      <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${lat},${lon}" rel="noopener noreferrer" target="_blank">Cómo llegar</a>
    </span>`;
  }

  const practicos = [
    salida ? ["Dónde se sale", salida] : null,
    r.epoca ? ["Mejor época", esc(r.epoca)] : null,
    r.agua ? ["Agua", esc(r.agua)] : null,
    r.superficie ? ["Superficie", esc(r.superficie)] : null,
    r.fecha ? ["Registrada el", esc(fechaLarga(r.fecha) || r.fecha)] : null,
  ].filter(Boolean);

  const contenido = `
<div class="rejilla">
  <section class="panel c8">
    <h1 class="titular">${esc(r.nombre)}</h1>
    <p class="sub">${lugarRuta(r)}</p>
    <div class="material arriba">${tipoBici(r)}</div>
  </section>

  <section class="panel oscuro c4 descarga">
    <a class="descarga-boton" id="descarga-gpx" href="${base}gpx/${r.slug}.gpx" download>
      Descargar GPX
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
    <p class="descarga-pie">${esc(r.pesoGpx)}, ${entero(r.numPuntos)} puntos. Listo para el GPS o para Komoot.</p>
  </section>

  <section class="panel c12">
    <div class="datos">
      ${dato(km(r.distancia), "km", "Distancia", { grande: true })}
      ${dato(entero(r.desnivelPositivo), "m", "Desnivel positivo", { grande: true })}
      ${t.map((x) => dato(x.valor, "", x.etiqueta, { grande: true })).join("")}
      ${r.conAltitud ? dato(entero(r.altitudMaxima), "m", "Altitud máxima", { grande: true }) : ""}
    </div>
  </section>

  <section class="panel ajustado c12"><div id="mapa" class="mapa"></div></section>

  ${
    r.conAltitud
      ? `<section class="panel ajustado c12">${silueta(r.perfil, { puntos: r.puntos || [], hero: true })}</section>`
      : ""
  }

  ${
    r.descripcionHtml
      ? `<section class="panel c7"><div class="prosa">${r.descripcionHtml}</div></section>`
      : ""
  }

  <section class="panel c5">
    ${
      r.puntos && r.puntos.length
        ? `<h2 class="titulo-panel">Paradas</h2>
    <ul class="paradas">
      ${r.puntos
        .map(
          (pt) => `<li><button type="button" class="parada" data-metros="${Math.round(pt.metros)}" aria-label="Ver ${esc(pt.etiqueta)}, km ${decimal(pt.km)}, en el mapa">
        <span class="parada-km">km ${decimal(pt.km)}</span>
        <span class="parada-texto"><b>${esc(pt.etiqueta)}</b>${pt.texto ? ` ${esc(pt.texto)}` : ""}</span>
      </button></li>`
        )
        .join("")}
    </ul>`
        : ""
    }
    ${
      practicos.length
        ? `<dl class="practicos">${practicos
            .map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`)
            .join("")}</dl>`
        : ""
    }
  </section>

  ${
    r.fotos && r.fotos.length
      ? `<section class="panel ${videos.length && soloVerticales ? "c8" : "c12"}">
    <div class="galeria" id="galeria">
      ${r.fotos
        .map(
          (f, i) => `<button type="button" class="galeria-item" data-indice="${i}" aria-label="Ampliar la foto ${i + 1}${
            f.pie ? `: ${esc(f.pie)}` : ""
          }">
        <img src="${base}fotos/${r.slug}/${encodeURIComponent(f.archivo)}" alt="${esc(f.pie)}" loading="lazy" decoding="async">
        ${f.pie ? `<span class="galeria-pie">${esc(f.pie)}</span>` : ""}
      </button>`
        )
        .join("")}
    </div>
  </section>`
      : ""
  }

  ${
    videos.length
      ? `<section class="panel ${r.fotos && r.fotos.length && soloVerticales ? "c4" : "c12"}">
    <div class="videos${soloVerticales ? " verticales" : ""}">
      ${videos
        .map(
          (vi) => `<figure class="video${vi.vertical ? " vertical" : ""}" data-incrustar="${esc(vi.incrustar)}" data-plataforma="${esc(vi.plataforma)}">
        <div class="video-marco">
          <button type="button" class="video-boton">
            <span class="video-play" aria-hidden="true">▶</span>
            Ver el vídeo<small>Se carga desde ${esc(vi.plataforma)} al pulsar</small>
          </button>
        </div>
        <figcaption class="video-enlace"><a href="${esc(vi.enlace)}" rel="noopener noreferrer" target="_blank">Abrir en ${esc(vi.plataforma)}</a></figcaption>
      </figure>`
        )
        .join("")}
    </div>
  </section>`
      : ""
  }

  ${r.avisos ? `<section class="panel c12"><h2 class="titulo-panel">Ojo con esto</h2><div class="prosa">${markdown(r.avisos)}</div></section>` : ""}

  ${
    otras.length
      ? `<section class="panel c12 cabecera es-bici"><div><h2>Otras rutas</h2></div></section>
  ${otras.map((o) => panelRuta(o, base)).join("")}`
      : ""
  }
</div>
<div class="barra-gpx" id="barra-gpx" aria-hidden="true">
  <span class="barra-gpx-cifras"><b>${km(r.distancia)} km</b> · ${entero(r.desnivelPositivo)} m</span>
  <a href="${base}gpx/${r.slug}.gpx" download tabindex="-1">Descargar GPX</a>
</div>
${
  r.fotos && r.fotos.length
    ? `<div class="visor" id="visor" hidden role="dialog" aria-modal="true" aria-label="Foto ampliada">
  <button type="button" class="visor-cerrar" id="visor-cerrar" aria-label="Cerrar">×</button>
  <button type="button" class="visor-nav visor-antes" id="visor-antes" aria-label="Foto anterior">‹</button>
  <figure class="visor-figura"><img id="visor-img" src="" alt=""><figcaption id="visor-pie"></figcaption></figure>
  <button type="button" class="visor-nav visor-despues" id="visor-despues" aria-label="Foto siguiente">›</button>
</div>`
    : ""
}`;

  const datosRuta = JSON.stringify({
    trazado: r.trazado,
    perfil: r.perfil,
    inicio: r.inicio,
    fin: r.fin,
    distancia: r.distancia,
    puntos: (r.puntos || []).map((pt) => ({
      lat: pt.lat, lon: pt.lon, km: pt.km, etiqueta: pt.etiqueta, texto: pt.texto,
      aviso: pt.aviso, icono: (TIPOS_PUNTO[pt.tipo] || TIPOS_PUNTO.otro).icono,
    })),
  });

  return layout({
    base,
    titulo: r.nombre,
    seccion: "rutas",
    descripcion: `${km(r.distancia)} km y ${entero(r.desnivelPositivo)} m de desnivel${r.zona ? ` por ${r.zona}` : ""}. Mapa, perfil y GPX para descargar.`,
    imagen: r.fotos && r.fotos.length ? `${HOST}${base}fotos/${r.slug}/${encodeURIComponent(r.fotos[0].archivo)}` : "",
    contenido,
    scripts: `${LEAFLET}
<script type="application/json" id="datos-ruta">${datosRuta.replace(/</g, "\\u003c")}</script>
<script src="${base}assets/ruta.js${v}"></script>
${r.fotos && r.fotos.length ? `<script src="${base}assets/galeria.js${v}"></script>` : ""}
${videos.length ? `<script src="${base}assets/video.js${v}"></script>` : ""}
${otras.length ? `<script type="application/json" id="datos-mapas">${JSON.stringify(
      Object.fromEntries(otras.map((o) => [o.slug, trazadoMini(o.trazado)]))
    ).replace(/</g, "\\u003c")}</script>
<script src="${base}assets/minimapas.js${v}"></script>` : ""}`,
    clase: "con-barra-gpx",
    ver,
  });
}

// -------------------------------------------------------- lista rutinas

export function paginaGimnasio({ base, rutinas, ver = "" }) {
  const totalEj = rutinas.reduce((a, r) => a + r.ejercicios, 0);
  const totalGif = rutinas.reduce((a, r) => a + r.gifs.length, 0);
  const fase = rutinas.find((r) => r.fase);

  const contenido = `
<div class="rejilla">
  ${cabeceraSeccion(
    "Gimnasio",
    "Rutinas de fuerza para ciclista, con las series, las cargas, los descansos y la animación de cada ejercicio.",
    `${dato(entero(rutinas.length), "", "Rutinas")}
      ${dato(entero(totalEj), "", "Ejercicios")}
      ${dato(entero(totalGif), "", "Animaciones")}`,
    fase ? `<p class="sub">${esc(fase.fase)}</p>` : ""
  )}

  ${
    rutinas.length
      ? rutinas.map((r) => panelRutina(r, base)).join("\n")
      : `<p class="panel c12">Todavía no hay ninguna rutina publicada.</p>`
  }

  <section class="panel c12"><p class="pie">Animaciones de <a href="https://github.com/yuhonas/free-exercise-db" rel="noopener noreferrer" target="_blank">free-exercise-db</a>,
  de dominio público. Metodología basada en <em>Ciclismo 2.0</em>, de Sebastián Sitko.</p></section>
</div>`;

  return layout({
    base,
    titulo: "Gimnasio",
    seccion: "gimnasio",
    descripcion: `${rutinas.length} rutinas de fuerza para ciclista con ${totalEj} ejercicios y la animación de cada uno.`,
    contenido,
    ver,
  });
}

// ------------------------------------------------------------------- 404

export function pagina404({ base, ver = "" }) {
  return layout({
    base,
    titulo: "Página no encontrada",
    descripcion: "Esta página no existe.",
    contenido: `
<div class="rejilla">
  <section class="panel c12 no-existe">
    <h1 class="titular">Esta página no existe</h1>
    <p class="sub">Puede que la ruta o la rutina haya cambiado de nombre.</p>
    <p class="no-existe-enlaces"><a href="${base}rutas/">Ver las rutas</a> <a href="${base}gimnasio/">Ver las rutinas</a></p>
  </section>
</div>`,
    ver,
  });
}

// ----------------------------------------------------- limpieza del texto

/** Fuera los emoji: en una rutina estorban más que ayudan. */
function sinEmoji(t) {
  return String(t)
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/**
 * Al quitar los emoji, las tablas que usaban una columna de iconos se quedan
 * con una columna vacía. Se elimina.
 */
function limpiarTablas(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (todo, dentro) => {
    const filas = [...dentro.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    if (filas.length === 0) return todo;
    const celdas = filas.map((f) => [...f.matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/\1>/g)]);
    const columnas = Math.max(...celdas.map((c) => c.length));
    const vacias = [];
    for (let i = 0; i < columnas; i++) {
      const todoVacio = celdas.every((fila) => {
        const c = fila[i];
        return !c || c[3].replace(/<[^>]+>/g, "").trim() === "";
      });
      if (todoVacio) vacias.push(i);
    }
    if (vacias.length === 0) return todo;
    let i = 0;
    const limpio = dentro.replace(/<tr>([\s\S]*?)<\/tr>/g, (f, interior) => {
      const cs = [...interior.matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/\1>/g)];
      i++;
      return `<tr>${cs.filter((_, j) => !vacias.includes(j)).map((c) => c[0]).join("")}</tr>`;
    });
    return `<table>${limpio}</table>`;
  });
}

// -------------------------------------------------- un ejercicio del día

/** El numero mas alto de un texto como "3–4" o "5". */
function numeroMayor(texto) {
  const n = (texto.match(/\d+/g) || []).map(Number);
  return n.length ? Math.max(...n) : 0;
}

/** "3 min", "2–3 min", "90 s", "60–90 s" -> segundos (el tope del rango). */
function segundosDescanso(texto) {
  const n = numeroMayor(texto);
  if (!n) return 0;
  if (/min/i.test(texto)) return n * 60;
  if (/\bs\b|seg/i.test(texto)) return n;
  return 0;
}

/**
 * Titulos de seccion: las mayusculas de grito pasan a minusculas y lo que
 * va entre parentesis (el tiempo) se separa como dato secundario.
 */
function tituloSeccion(t) {
  let texto = t.trim();
  let nota = "";
  const m = texto.match(/\s*\(([^)]*)\)\s*$/);
  if (m) {
    nota = m[1].trim();
    texto = texto.slice(0, m.index).trim();
  }
  texto = texto.replace(/[A-ZÁÉÍÓÚÜÑ]{2,}/g, (w) => (["RPE", "RM", "GPX"].includes(w) ? w : w.toLowerCase()));
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  const corto = texto.split(/\s+—\s+/)[0];
  return { texto, nota, corto };
}

/**
 * Convierte el trozo de HTML de un ejercicio en una ficha de entreno:
 * el código y el nombre arriba, la animación encuadrada, la dosis en
 * números grandes y, debajo, la técnica.
 */
function ejercicio(trozo) {
  const mTitulo = trozo.match(/^<h3[^>]*>([\s\S]*?)<\/h3>/);
  if (!mTitulo) return `<div class="notas prosa">${trozo}</div>`;
  let resto = trozo.slice(mTitulo[0].length);

  const titulo = sinEmoji(mTitulo[1].replace(/<[^>]+>/g, " "));
  const mCodigo = titulo.match(/^([A-Z]\d+)\s*·\s*(.+)$/);
  const codigo = mCodigo ? mCodigo[1] : "";
  let nombre = mCodigo ? mCodigo[2] : titulo;
  // lo que iba en cursiva tras el nombre es un apunte, no parte del nombre
  const mApunte = mTitulo[1].match(/<em>([\s\S]*?)<\/em>\s*$/);
  const apunte = mApunte ? sinEmoji(mApunte[1].replace(/<[^>]+>/g, "")) : "";
  if (apunte) nombre = sinEmoji(nombre.replace(new RegExp(apunte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), ""));

  // La animación principal es la que va suelta. Las que llevan pie van
  // envueltas en <figure> y son variantes, así que se quedan en las notas.
  let gif = "";
  const mSuelta = resto.match(/<p class="animacion">\s*(<img[^>]*>)\s*<\/p>/);
  if (mSuelta) {
    gif = mSuelta[1];
    resto = resto.replace(mSuelta[0], "");
  } else {
    const mFigura = resto.match(/<figure class="animacion">[\s\S]*?(<img[^>]*>)[\s\S]*?<\/figure>/);
    if (mFigura) {
      gif = mFigura[1];
      resto = resto.replace(mFigura[0], "");
    }
  }

  // la primera tabla es la dosis: series, reps, descanso e intensidad
  const mTabla = resto.match(/<div class="tabla-scroll"><table>([\s\S]*?)<\/table><\/div>/);
  let dosis = "";
  if (mTabla) {
    const encabezados = [...mTabla[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
      sinEmoji(m[1].replace(/<[^>]+>/g, ""))
    );
    const valores = [...mTabla[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      sinEmoji(m[1].replace(/<\/?(strong|b|em|i)>/g, ""))
    );
    if (encabezados.length && valores.length) {
      let series = 0;
      let segundos = 0;
      const casillas = encabezados.map((h, i) => {
        if (valores[i] === undefined) return "";
        const clave = h.trim().toLowerCase();
        const texto = valores[i].replace(/<[^>]+>/g, "").trim();
        let extra = "";
        if (clave === "series") series = numeroMayor(texto);
        if (clave === "descanso") {
          segundos = segundosDescanso(texto);
          if (segundos) extra = ` data-segundos="${segundos}"`;
        }
        // la intensidad es texto largo: va a todo el ancho
        const ancho = clave === "intensidad" || texto.length > 14;
        return `<div${ancho ? ' class="ancho"' : ""}><dt>${h}</dt><dd${extra}>${valores[i]}</dd></div>`;
      });
      dosis = `<dl class="dosis">${casillas.join("")}</dl>`;
      // las series se marcan al hacerlas (lo monta rutina.js)
      if (series > 0 && series <= 10) {
        dosis += `<div class="series-hechas" data-series="${series}"${segundos ? ` data-segundos="${segundos}"` : ""}${
          codigo ? ` data-clave="${esc(codigo)}"` : ""
        }></div>`;
      }
      resto = resto.replace(mTabla[0], "");
    }
  }

  return `<article class="ejercicio">
  <header class="ejercicio-cab">
    ${codigo ? `<span class="codigo">${esc(codigo)}</span>` : ""}
    <div>
      <h4>${esc(nombre)}</h4>
      ${apunte ? `<p class="ejercicio-apunte">${esc(apunte)}</p>` : ""}
    </div>
  </header>
  <div class="ejercicio-cuerpo">
    <div class="ejercicio-gif">${gif || '<span class="sin-gif">Sin animación</span>'}</div>
    <div class="ejercicio-datos">
      ${dosis}
      <div class="notas prosa">${resto.trim()}</div>
    </div>
  </div>
</article>`;
}

/** Parte el cuerpo de una sección en sus ejercicios. */
function cuerpoSeccion(html) {
  const trozos = html.split(/(?=<h3)/).map((t) => t.trim()).filter(Boolean);
  const tieneEjercicios = trozos.some((t) => /^<h3[^>]*>\s*[A-Z]\d+\s*(·|&middot;)/.test(t));
  if (!tieneEjercicios) return `<div class="prosa">${html}</div>`;
  return `<div class="ejercicios">${trozos.map(ejercicio).join("")}</div>`;
}

// -------------------------------------------------------- ficha rutina

/** Parte el cuerpo de la rutina por sus titulos de primer nivel. */
function secciones(html) {
  return html
    .split(/(?=<h2)/)
    .map((trozo) => trozo.trim())
    .filter(Boolean)
    .map((trozo) => {
      const m = trozo.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
      return m
        ? { titulo: m[1].replace(/<[^>]+>/g, ""), cuerpo: trozo.slice(m[0].length) }
        : { titulo: "", cuerpo: trozo };
    });
}

export function paginaRutina({ base, r, otras, ver = "" }) {
  // Las reglas y la teoría van antes del primer titular: se pliegan, porque
  // en el gimnasio lo que se mira entre series son los bloques.
  const bloques = secciones(limpiarTablas(sinEmoji(r.cuerpoHtml))).map((b) =>
    b.titulo
      ? { ...tituloSeccion(sinEmoji(b.titulo)), cuerpo: b.cuerpo, abierto: true }
      : { texto: "Antes de empezar", corto: "Antes de empezar", nota: "", cuerpo: b.cuerpo, abierto: false }
  );

  const contenido = `
<div class="rejilla">
  <section class="panel c8">
    <h1 class="titular">${esc(r.nombre)}</h1>
    <p class="sub">${esc([r.dia, r.grupo, r.objetivo].filter(Boolean).join(", "))}</p>
    ${r.fase ? `<p class="sub">${esc(r.fase)}</p>` : ""}
    ${r.resumen ? `<p class="resumen-largo">${esc(r.resumen)}</p>` : ""}
  </section>
  <section class="panel c4">
    <div class="datos">
      ${dato(entero(r.duracion), "min", "Duración")}
      ${dato(entero(r.ejercicios), "", "Ejercicios")}
      ${dato(entero(r.series), "", "Series")}
    </div>
    ${r.intensidad ? `<div class="material"><span>${esc(r.intensidad)}</span></div>` : ""}
  </section>

  ${
    bloques.length > 1
      ? `<nav class="c12 indice-rutina" aria-label="Secciones de la rutina">
    ${bloques.map((b, i) => `<a href="#s${i}">${esc(b.corto)}</a>`).join("")}
  </nav>`
      : ""
  }

  ${bloques
    .map(
      (b, i) => `<details class="panel ajustado seccion-rutina c12" id="s${i}"${b.abierto ? " open" : ""}>
    <summary><span>${esc(b.texto)}${b.nota ? ` <small>${esc(b.nota)}</small>` : ""}</span></summary>
    <div class="seccion-cuerpo">${cuerpoSeccion(b.cuerpo)}</div>
  </details>`
    )
    .join("\n")}

  ${
    otras.length
      ? `<section class="panel c12 cabecera es-gimnasio"><div><h2>Otras rutinas</h2></div></section>
  ${otras.map((o) => panelRutina(o, base)).join("")}`
      : ""
  }

  ${
    r.material.length
      ? `<section class="panel c12"><h2 class="titulo-panel">Material</h2>
    <div class="material">${r.material.map((m) => `<span>${esc(m)}</span>`).join("")}</div></section>`
      : ""
  }
</div>`;

  return layout({
    base,
    titulo: r.nombre,
    seccion: "gimnasio",
    descripcion: `${r.nombre}: ${r.ejercicios} ejercicios, ${r.series} series, ${r.duracion} minutos. Con la animación de cada movimiento.`,
    contenido,
    scripts: `<script src="${base}assets/rutina.js${ver ? `?v=${ver}` : ""}"></script>`,
    ver,
  });
}
