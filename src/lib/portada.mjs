// El Garaje - la portada.
//
// Con las mismas plantillas que el resto de la web: una foto grande con el
// titular, una ficha por seccion y las ultimas rutas. Para anadir una seccion
// nueva basta con sumar una entrada a secciones().

import { esc } from "./content.mjs";
import { entero } from "./formato.mjs";
import { layout, nota, panelRuta, scriptsMapas } from "./render.mjs";

const FLECHA = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h9M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Las secciones del sitio, en orden: nombre, enlace, una linea, una cifra y su imagen. */
function secciones({ base, rutas, rutinas }) {
  const fotoRuta = rutas.flatMap((r) => (r.fotos || []).map((f) => ({ r, f })))[0];
  const rutina = rutinas.find((r) => r.gifs && r.gifs.length);
  return [
    {
      nombre: "Rutas",
      href: `${base}rutas/`,
      linea: "Rutas en bici con su mapa, su perfil y el GPX para descargar.",
      cifra: `${entero(rutas.length)} rutas`,
      img: fotoRuta ? `${base}fotos/${fotoRuta.r.slug}/${encodeURIComponent(fotoRuta.f.archivo)}` : "",
    },
    {
      nombre: "Gimnasio",
      href: `${base}gimnasio/`,
      linea: "Rutinas de fuerza para ciclistas, con las series y la animación de cada ejercicio.",
      cifra: `${entero(rutinas.length)} rutinas`,
      img: rutina ? `${base}gimnasio/${rutina.slug}/videos/${encodeURIComponent(rutina.gifQuieto || rutina.gifs[0].archivo)}` : "",
    },
  ];
}

export function paginaPortada({ base, rutas, rutinas, ver = "" }) {
  const lista = secciones({ base, rutas, rutinas });
  const r = rutas.find((x) => x.slug === "venta-culebrin" && x.fotos && x.fotos[1]);
  const hero = r ? `${base}fotos/${r.slug}/${encodeURIComponent(r.fotos[1].archivo)}` : "";
  const ultimas = rutas.slice(0, 3);

  const contenido = `
<div class="inicio">
  <section class="inicio-hero" aria-labelledby="hero-h">
    ${hero ? `<img src="${hero}" alt="" fetchpriority="high">` : ""}
    <div class="inicio-hero-texto">
      <h1 id="hero-h">Rutas y entreno para ciclistas</h1>
      <p class="inicio-lead">Lo que ruedo y cómo entreno, en un solo sitio: rutas con su GPX, rutinas de gimnasio y lo que vaya llegando.</p>
      <div class="botones">
        ${lista.map((s, i) => `<a class="boton${i === 0 ? " claro" : ""}" href="${s.href}">${esc(s.nombre)}${FLECHA}</a>`).join("")}
      </div>
      ${nota("¿Dónde ruedas hoy?")}
    </div>
  </section>
</div>

<div class="caja">
  <section class="bloque" aria-labelledby="secciones-h">
    <div class="bloque-cab">
      <div>
        ${nota("Elige por dónde empezar")}
        <h2 id="secciones-h">Las secciones del Garaje</h2>
      </div>
    </div>
    <div class="secciones">
      ${lista
        .map(
          (s) => `<a class="seccion-ficha" href="${s.href}">
        ${s.img ? `<img src="${s.img}" alt="" loading="lazy">` : ""}
        <div class="seccion-ficha-texto">
          <div>
            <span class="seccion-cifra">${esc(s.cifra)}</span>
            <h3>${esc(s.nombre)}</h3>
            <p>${esc(s.linea)}</p>
          </div>
          <span class="seccion-flecha">${FLECHA}</span>
        </div>
      </a>`
        )
        .join("\n      ")}
    </div>
  </section>

  ${
    ultimas.length
      ? `<section class="bloque" aria-labelledby="ultimas-h">
    <div class="bloque-cab">
      <div>
        ${nota("Recién salidas del garaje")}
        <h2 id="ultimas-h">Últimas rutas</h2>
      </div>
      <a href="${base}rutas/">Ver todas las rutas</a>
    </div>
    <div class="rejilla">
      ${ultimas.map((x) => panelRuta(x, base)).join("\n")}
    </div>
  </section>`
      : ""
  }
</div>`;

  return layout({
    base,
    titulo: "El Garaje",
    descripcion: "Rutas en bici con su GPX, rutinas de gimnasio y lo que vaya llegando, en un solo sitio.",
    imagen: "",
    contenido,
    scripts: scriptsMapas(ultimas, base, ver),
    ver,
    bruto: true,
  });
}
