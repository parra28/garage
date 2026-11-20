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

/** El perfil de altimetria como silueta maciza. */
function silueta(perfil, { puntos = [], hero = false } = {}) {
  const W = 1000;
  const H = 240;
  const dTotal = perfil[perfil.length - 1][0];
  const eles = perfil.map((p) => p[1]).filter((e) => e !== null);
  if (eles.length === 0) return "";
  const techo = Math.max(...eles);
  const suelo = Math.min(...eles);
  const rango = Math.max(40, techo - suelo);
  const base = suelo - rango * 0.28;
  const alto = techo + rango * 0.12;
  const X = (d) => (d / dTotal) * W;
  const Y = (e) => H - ((e - base) / (alto - base)) * H;

  const d =
    `M0,${H} ` + perfil.map((p) => `L${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ") + ` L${W},${H} Z`;

  if (!hero) {
    return `<svg class="silueta" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  const kmTotal = dTotal / 1000;
  const paso = kmTotal > 100 ? 20 : kmTotal > 40 ? 10 : kmTotal > 15 ? 5 : 2;
  const marcas = [];
  for (let k = paso; k < kmTotal; k += paso) marcas.push(k);

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
  <svg id="perfil" class="silueta hero" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
    role="img" aria-label="Perfil de altimetría, de ${entero(suelo)} a ${entero(techo)} metros a lo largo de ${decimal(kmTotal)} kilómetros"
    data-dtotal="${dTotal}" data-base="${base.toFixed(2)}" data-alto="${alto.toFixed(2)}" data-h="${H}" data-w="${W}">
    <path d="${d}"/>
    <g class="cortes">${cortes}</g>
    <line id="perfil-cruz" class="perfil-cruz" x1="0" y1="0" x2="0" y2="${H}" hidden/>
    <circle id="perfil-punto" class="perfil-punto" r="5" hidden/>
  </svg>
  <div class="hero-regla">${regla}</div>
  <div id="perfil-globo" class="globo" hidden></div>
</div>`;
}

/** Trazado reducido para el mapa de las tarjetas. */
function trazadoMini(trazado, maximo = 170) {
  if (!trazado || trazado.length === 0) return [];
  const paso = Math.max(1, Math.ceil(trazado.length / maximo));
  const out = [];
  for (let i = 0; i < trazado.length; i += paso) {
    out.push([Math.round(trazado[i][0] * 1e4) / 1e4, Math.round(trazado[i][1] * 1e4) / 1e4]);
  }
  const u = trazado[trazado.length - 1];
  out.push([Math.round(u[0] * 1e4) / 1e4, Math.round(u[1] * 1e4) / 1e4]);
  return out;
}

function datosMapas(rutas) {
  const datos = {};
  for (const r of rutas) datos[r.slug] = trazadoMini(r.trazado);
  return `<script type="application/json" id="datos-mapas">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>`;
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
  return `<span class="tipo">${
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

function layout({ base, titulo, descripcion, seccion = "", contenido, scripts = "", imagen = "", ver = "" }) {
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
<body>
<a class="salto" href="#principal">Ir al contenido</a>
<header class="barra">
  <div class="caja barra-fila">
    <a class="marca" href="${base}">${SITIO}</a>
    <nav class="navega">
      <a href="${base}rutas/"${marca("rutas")}>Bici</a>
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

function panelRuta(r, base) {
  const t = tiempos(r);
  return `<a class="panel enlace ajustado ruta-panel es-bici c4" href="${base}ruta/${r.slug}/"
  data-busqueda="${esc([r.nombre, r.zona, r.provincia, (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase())}"
  data-zona="${esc(r.zona || "")}" data-bici="${esc(r.bici || "")}"
  data-dist="${r.distancia}" data-dplus="${r.desnivelPositivo}" data-dif="${r.dificultad || 0}" data-orden="${r.orden}">
  <div class="ruta-mapa" data-slug="${esc(r.slug)}">${silueta(r.perfil)}</div>
  <div class="ruta-cuerpo">
    <h3>${esc(r.nombre)}</h3>
    <p class="ruta-lugar">${lugarRuta(r)}</p>
    <div class="ruta-cifras">
      ${dato(km(r.distancia), "km", "Distancia")}
      ${dato(entero(r.desnivelPositivo), "m", "Desnivel")}
      ${dato(t[0].valor, "", t[0].etiqueta)}
    </div>
    <div class="material">${tipoBici(r)}</div>
  </div>
</a>`;
}

function panelRutina(r, base) {
  const gif = r.gifs && r.gifs.length ? r.gifs[0].archivo : "";
  return `<a class="panel enlace ajustado rutina-panel es-gimnasio c4" href="${base}gimnasio/${r.slug}/">
  ${
    gif
      ? `<div class="rutina-gif"><img src="${base}gimnasio/${r.slug}/videos/${encodeURIComponent(
          gif
        )}" alt="" loading="lazy" decoding="async"></div>`
      : ""
  }
  <div class="rutina-cuerpo">
  <h3>${esc(sinEmoji(r.nombre))}</h3>
  ${r.resumen ? `<p class="rutina-resumen">${esc(r.resumen)}</p>` : ""}
  <div class="datos">
    ${dato(entero(r.duracion), "min", "Duración")}
    ${dato(entero(r.ejercicios), "", "Ejercicios")}
    ${dato(entero(r.series), "", "Series")}
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

// ---------------------------------------------------------------- portada

export function paginaPortada({ base, rutas, rutinas, ver = "" }) {
  const totalKm = rutas.reduce((a, r) => a + r.distancia, 0);
  const totalD = rutas.reduce((a, r) => a + r.desnivelPositivo, 0);

  const contenido = `
<div class="rejilla">
  <section class="panel c8">
    <h1 class="portada-titulo">El Garaje</h1>
    <p class="portada-frase">Las rutas y el gimnasio en el mismo sitio. ${entero(rutas.length)} rutas con su mapa,
    su perfil y el GPX listo para descargar, y ${entero(rutinas.length)} rutinas de fuerza con la animación de cada ejercicio.</p>
  </section>
  <section class="panel c4">
    <div class="datos">
      ${dato(entero(totalKm / 1000), "km", "Recorridos")}
      ${dato(entero(totalD), "m", "Desnivel acumulado")}
      ${dato(entero(rutinas.reduce((a, r) => a + r.ejercicios, 0)), "", "Ejercicios")}
    </div>
  </section>

  <section class="panel c12 cabecera es-gimnasio">
    <div>
      <h2>Gimnasio</h2>
      <p>${entero(rutinas.length)} rutinas de fuerza con la animación de cada ejercicio</p>
    </div>
    <a href="${base}gimnasio/">Ver las rutinas</a>
  </section>
  ${rutinas.map((r) => panelRutina(r, base)).join("\n")}

  <section class="panel c12 cabecera es-bici">
    <div>
      <h2>Bici</h2>
      <p>${entero(rutas.length)} rutas con su mapa, su perfil y el GPX para descargar</p>
    </div>
    <a href="${base}rutas/">Buscar entre las rutas</a>
  </section>
  ${rutas.map((r) => panelRuta(r, base)).join("\n")}

  <section class="panel c12"><p class="pie">Rutas propias, trazadas y verificadas sobre el terreno. Los archivos GPX
  se ofrecen tal cual: comprueba siempre el estado de los caminos y la normativa de la zona antes de salir.</p></section>
</div>`;

  return layout({
    base,
    titulo: SITIO,
    descripcion: `${rutas.length} rutas en bici con mapa, perfil y GPX, y ${rutinas.length} rutinas de fuerza para ciclista.`,
    contenido,
    scripts: `${LEAFLET}\n${datosMapas(rutas)}\n<script src="${base}assets/minimapas.js${ver ? `?v=${ver}` : ""}"></script>`,
    ver,
  });
}

// ----------------------------------------------------------- lista rutas

export function paginaIndice({ base, rutas, zonas, ver = "" }) {
  const bicis = [...new Set(rutas.map((r) => r.bici).filter(Boolean))];
  const totalKm = rutas.reduce((a, r) => a + r.distancia, 0);
  const totalD = rutas.reduce((a, r) => a + r.desnivelPositivo, 0);

  const contenido = `
<div class="rejilla">
  <section class="panel c8">
    <h1 class="titular">Bici</h1>
    <p class="sub">Cada ruta lleva su mapa, el perfil de altimetría, las paradas y el GPX para descargar.</p>
  </section>
  <section class="panel c4">
    <div class="datos">
      ${dato(entero(rutas.length), "", "Rutas")}
      ${dato(entero(totalKm / 1000), "km", "Recorridos")}
      ${dato(entero(totalD), "m", "Desnivel")}
    </div>
  </section>

  <section class="panel c12">
    <div class="buscador">
      <label for="f-buscar" class="sr">Buscar</label>
      <input type="search" id="f-buscar" placeholder="Busca por nombre, zona o pueblo" autocomplete="off">
    </div>
    <div class="filtros">
      <button type="button" class="chip activo" data-bici="">Todas</button>
      ${bicis
        .map((b) => `<button type="button" class="chip" data-bici="${esc(b)}">${esc(TIPOS_BICI[b] ? TIPOS_BICI[b].etiqueta : b)}</button>`)
        .join("")}
      ${zonas.length > 1 ? zonas.map((z) => `<button type="button" class="chip" data-zona="${esc(z)}">${esc(z)}</button>`).join("") : ""}
    </div>
    <p class="contador" id="contador" aria-live="polite"></p>
  </section>

  <div class="rejilla c12" id="listado-rutas" style="grid-column:span 12">
    ${rutas.map((r) => panelRuta(r, base)).join("\n")}
  </div>
  <p class="panel c12 vacio" id="vacio" hidden>No hay ninguna ruta que coincida. <button type="button" id="limpiar">Quitar los filtros</button></p>
</div>`;

  return layout({
    base,
    titulo: "Bici",
    seccion: "rutas",
    descripcion: `${rutas.length} rutas en bici de carretera, gravel y MTB con mapa, perfil de altimetría y descarga del GPX.`,
    contenido,
    scripts: `${LEAFLET}
${datosMapas(rutas)}
<script src="${base}assets/indice.js${ver ? `?v=${ver}` : ""}"></script>
<script src="${base}assets/minimapas.js${ver ? `?v=${ver}` : ""}"></script>`,
    ver,
  });
}

// ------------------------------------------------------------ ficha ruta

export function paginaRuta({ base, r, otras, ver = "" }) {
  const v = ver ? `?v=${ver}` : "";
  const videos = (r.videos || []).map(analizarVideo).filter(Boolean);
  const t = tiempos(r);

  const practicos = [
    r.parking ? ["Dónde se sale", esc(r.parking)] : null,
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
    <div class="material" style="margin-top:14px">${tipoBici(r)}</div>
  </section>

  <section class="panel oscuro c4 descarga">
    <a class="descarga-boton" href="${base}gpx/${r.slug}.gpx" download>
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
        ? `<h2 style="font-size:1.05rem;margin-bottom:12px">Paradas</h2>
    <ul class="paradas">
      ${r.puntos
        .map(
          (pt) => `<li class="parada">
        <span class="parada-km">km ${decimal(pt.km)}</span>
        <span class="parada-texto"><b>${esc(pt.etiqueta)}</b>${pt.texto ? ` ${esc(pt.texto)}` : ""}</span>
      </li>`
        )
        .join("")}
    </ul>`
        : ""
    }
    ${
      practicos.length
        ? `<dl class="practicos"${r.puntos && r.puntos.length ? ' style="margin-top:20px"' : ""}>${practicos
            .map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`)
            .join("")}</dl>`
        : ""
    }
  </section>

  ${
    r.fotos && r.fotos.length
      ? `<section class="panel c12">
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
      ? `<section class="panel c12">
    <div class="videos">
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

  ${r.avisos ? `<section class="panel c12"><h2 style="font-size:1.05rem;margin-bottom:10px">Ojo con esto</h2><div class="prosa">${markdown(r.avisos)}</div></section>` : ""}

  ${
    otras.length
      ? `<section class="panel c12 cabecera es-bici"><div><h2>Otras rutas</h2></div></section>
  ${otras.map((o) => panelRuta(o, base)).join("")}`
      : ""
  }
</div>`;

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
${otras.length ? `${datosMapas(otras)}\n<script src="${base}assets/minimapas.js${v}"></script>` : ""}`,
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
  <section class="panel c8">
    <h1 class="titular">Gimnasio</h1>
    <p class="sub">Rutinas de fuerza para ciclista, con las series, las cargas, los descansos y la animación de cada ejercicio.</p>
    ${fase ? `<p class="sub">${esc(fase.fase)}</p>` : ""}
  </section>
  <section class="panel c4">
    <div class="datos">
      ${dato(entero(rutinas.length), "", "Rutinas")}
      ${dato(entero(totalEj), "", "Ejercicios")}
      ${dato(entero(totalGif), "", "Animaciones")}
    </div>
  </section>

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
      dosis = `<dl class="dosis">${encabezados
        .map((h, i) => (valores[i] === undefined ? "" : `<div><dt>${h}</dt><dd>${valores[i]}</dd></div>`))
        .join("")}</dl>`;
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
      ? { titulo: sinEmoji(b.titulo), cuerpo: b.cuerpo, abierto: true }
      : { titulo: "Antes de empezar", cuerpo: b.cuerpo, abierto: false }
  );

  const contenido = `
<div class="rejilla">
  <section class="panel c8">
    <h1 class="titular">${esc(r.nombre)}</h1>
    <p class="sub">${esc([r.dia, r.grupo, r.objetivo].filter(Boolean).join(", "))}</p>
    ${r.fase ? `<p class="sub">${esc(r.fase)}</p>` : ""}
  </section>
  <section class="panel c4">
    <div class="datos">
      ${dato(entero(r.duracion), "min", "Duración")}
      ${dato(entero(r.ejercicios), "", "Ejercicios")}
      ${dato(entero(r.series), "", "Series")}
    </div>
    ${r.intensidad ? `<div class="material"><span>${esc(r.intensidad)}</span></div>` : ""}
  </section>

  ${r.resumen ? `<section class="panel c12"><p class="sub" style="margin:0;max-width:72ch">${esc(r.resumen)}</p></section>` : ""}

  ${
    bloques.length > 1
      ? `<nav class="panel c12 indice-rutina" aria-label="Secciones de la rutina">
    ${bloques.map((b, i) => `<a href="#s${i}">${esc(b.titulo)}</a>`).join("")}
  </nav>`
      : ""
  }

  ${bloques
    .map(
      (b, i) => `<details class="panel ajustado seccion-rutina c12" id="s${i}"${b.abierto ? " open" : ""}>
    <summary>${esc(b.titulo)}</summary>
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
      ? `<section class="panel c12"><h2 style="font-size:1.05rem;margin-bottom:10px">Material</h2>
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
    ver,
  });
}
