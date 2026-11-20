// El Garaje - lectura de las fichas .md (metadatos + descripcion).

/** Escapa texto para insertarlo en HTML. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Separa los metadatos (entre --- y ---) de la descripcion.
 * Formato de metadatos: "clave: valor", una por linea.
 * Las listas se escriben entre corchetes: "tags: [puerto, asfalto]".
 */
export function parseFicha(texto) {
  const t = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, cuerpo: t.trim() };

  const meta = {};
  const lineas = m[1].split("\n");
  let listaAbierta = null; // clave cuya lista "- ..." estamos leyendo

  for (const linea of lineas) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;

    // elemento de lista: "- lo que sea"
    if (listaAbierta && /^-\s+/.test(l)) {
      meta[listaAbierta].push(l.replace(/^-\s+/, "").replace(/^"|"$/g, ""));
      continue;
    }
    listaAbierta = null;

    const i = l.indexOf(":");
    if (i < 0) continue;
    const clave = l.slice(0, i).trim();
    let valor = l.slice(i + 1).trim();
    if (valor.startsWith('"') && valor.endsWith('"') && valor.length > 1) {
      valor = valor.slice(1, -1);
    }
    if (valor.startsWith("[") && valor.endsWith("]")) {
      meta[clave] = valor
        .slice(1, -1)
        .split(",")
        .map((x) => x.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      continue;
    }
    if (valor === "") {
      // puede ser una clave vacia o el comienzo de una lista en varias lineas
      meta[clave] = [];
      listaAbierta = clave;
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(valor)) {
      meta[clave] = parseFloat(valor);
      continue;
    }
    if (valor === "true" || valor === "false") {
      meta[clave] = valor === "true";
      continue;
    }
    meta[clave] = valor;
  }
  // una "lista" que se quedo vacia era en realidad una clave sin valor
  for (const clave of Object.keys(meta)) {
    if (Array.isArray(meta[clave]) && meta[clave].length === 0) meta[clave] = "";
  }
  return { meta, cuerpo: m[2].trim() };
}

// ------------------------------------------------------------------- markdown

/**
 * Deja pasar solo rutas relativas (videos/x.gif) y URL http(s).
 * Corta cualquier otro esquema, javascript: incluido.
 */
function urlSegura(u) {
  const l = String(u).trim();
  if (/^https?:\/\//i.test(l)) return l;
  if (/^[a-z][a-z0-9+.-]*:/i.test(l) || l.startsWith("//")) return "";
  return l;
}

const RE_IMG = /!\[([^\]]*)\]\(([^\s)]+)\)/;

function enLinea(s) {
  // sobre texto ya escapado: imagen, codigo, negrita, cursiva y enlaces
  return s
    .replace(new RegExp(RE_IMG.source, "g"), (_, alt, src) => {
      const u = urlSegura(src);
      return u ? `<img src="${u}" alt="${alt}" loading="lazy" decoding="async">` : "";
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>'
    );
}

/** Celdas de una fila de tabla, sin los pipes de los extremos. */
function celdas(linea) {
  let l = linea.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

/** La fila "|:---:|---|" que separa la cabecera del cuerpo. */
function esSeparadorTabla(l) {
  return l.includes("|") && /-/.test(l) && /^[\s|:-]+$/.test(l);
}

function alineacion(c) {
  const izq = c.startsWith(":");
  const der = c.endsWith(":");
  if (izq && der) return "center";
  if (der) return "right";
  return "";
}

const esImagenSola = (l) => new RegExp(`^${RE_IMG.source}$`).test(l.trim());
const esPieCursiva = (l) => /^\*[^*].*\*$/.test(l.trim());

/**
 * Markdown reducido pero suficiente para una ficha de ruta y para una rutina
 * de gimnasio: titulos, parrafos, listas, citas de varios parrafos, tablas,
 * imagenes (con pie cuando vienen precedidas de una linea en cursiva),
 * bloques de codigo, reglas horizontales, negrita, cursiva y enlaces.
 */
export function markdown(texto) {
  if (!texto) return "";
  const lineas = esc(String(texto).replace(/\r\n/g, "\n")).split("\n");
  const html = [];
  let i = 0;

  const figura = (img, pie) => {
    const cuerpo = enLinea(img.trim());
    if (!pie) return `<p class="animacion">${cuerpo}</p>`;
    const texto = pie.trim().replace(/^\*|\*$/g, "");
    return `<figure class="animacion"><p>${cuerpo}</p><figcaption>${enLinea(texto)}</figcaption></figure>`;
  };

  // Indice de la siguiente linea con contenido, o -1.
  const siguiente = (desde) => {
    for (let j = desde; j < lineas.length; j++) if (lineas[j].trim() !== "") return j;
    return -1;
  };

  while (i < lineas.length) {
    const l = lineas[i];

    if (l.trim() === "") { i++; continue; }

    // bloque de codigo cercado
    if (/^\s*```/.test(l)) {
      i++;
      const cuerpo = [];
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) cuerpo.push(lineas[i++]);
      i++;
      html.push(`<pre><code>${cuerpo.join("\n")}</code></pre>`);
      continue;
    }

    // regla horizontal
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { html.push("<hr>"); i++; continue; }

    // titulos: # -> h2, ## -> h3, ### -> h4...
    const t = l.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (t) {
      const n = Math.min(t[1].length + 1, 6);
      html.push(`<h${n}>${enLinea(t[2])}</h${n}>`);
      i++; continue;
    }

    // tabla
    if (l.includes("|") && i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1])) {
      const cab = celdas(l);
      const alin = celdas(lineas[i + 1]).map(alineacion);
      i += 2;
      const filas = [];
      while (i < lineas.length && lineas[i].includes("|") && lineas[i].trim() !== "") {
        filas.push(celdas(lineas[i])); i++;
      }
      const th = cab
        .map((c, k) => `<th${alin[k] ? ` style="text-align:${alin[k]}"` : ""}>${enLinea(c)}</th>`)
        .join("");
      const tb = filas
        .map(
          (f) =>
            "<tr>" +
            cab
              .map(
                (_, k) =>
                  `<td${alin[k] ? ` style="text-align:${alin[k]}"` : ""}>${enLinea(f[k] ?? "")}</td>`
              )
              .join("") +
            "</tr>"
        )
        .join("");
      html.push(`<div class="tabla-scroll"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }

    // imagen sola, con el pie en cursiva de la linea anterior si lo hay
    if (esImagenSola(l)) { html.push(figura(l, null)); i++; continue; }
    if (esPieCursiva(l)) {
      const j = siguiente(i + 1);
      if (j > -1 && esImagenSola(lineas[j])) {
        html.push(figura(lineas[j], l)); i = j + 1; continue;
      }
    }

    // cita: lineas consecutivas que empiezan por >, con parrafos dentro
    if (/^\s*&gt;/.test(l)) {
      const dentro = [];
      while (i < lineas.length && /^\s*&gt;/.test(lineas[i])) {
        dentro.push(lineas[i].replace(/^\s*&gt;\s?/, "")); i++;
      }
      const parrafos = [];
      let actual = [];
      for (const d of dentro) {
        if (d.trim() === "") { if (actual.length) parrafos.push(actual); actual = []; }
        else actual.push(d);
      }
      if (actual.length) parrafos.push(actual);
      html.push(
        `<blockquote>${parrafos.map((p) => `<p>${enLinea(p.join(" "))}</p>`).join("")}</blockquote>`
      );
      continue;
    }

    // listas; un elemento puede ocupar varias lineas
    const lista = (marca, etiqueta) => {
      if (!marca.test(l)) return false;
      const items = [];
      while (i < lineas.length && lineas[i].trim() !== "") {
        const li = lineas[i];
        if (marca.test(li)) items.push(li.replace(marca, ""));
        else if (items.length) items[items.length - 1] += " " + li.trim();
        else break;
        i++;
      }
      if (!items.length) return false;
      html.push(`<${etiqueta}>${items.map((x) => `<li>${enLinea(x)}</li>`).join("")}</${etiqueta}>`);
      return true;
    };
    if (lista(/^\s*[-*]\s+/, "ul")) continue;
    if (lista(/^\s*\d+[.)]\s+/, "ol")) continue;

    // parrafo
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() !== "") {
      if (/^\s*(```|&gt;|#{1,6}\s)/.test(lineas[i]) || esImagenSola(lineas[i])) break;
      parrafo.push(lineas[i]); i++;
    }
    if (parrafo.length) html.push(`<p>${enLinea(parrafo.join(" "))}</p>`);
    else i++;
  }
  return html.join("\n");
}

/** Convierte un nombre en slug para la URL. */
export function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
