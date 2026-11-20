// El Garaje - lectura de las rutinas de gimnasio.
//
// Una rutina es una carpeta dentro de gimnasio/:
//
//   gimnasio/fuerza-max-inferior/rutina.md      metadatos + cuerpo en markdown
//   gimnasio/fuerza-max-inferior/videos/*.gif   animaciones de los ejercicios
//
// Los GIF se publican junto a la pagina, asi que las rutas relativas del
// markdown ("videos/x.gif") siguen funcionando sin tocar nada.

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { parseFicha, markdown, slugify } from "./content.mjs";

/** Ejercicios del cuerpo: los titulos tipo "## A1 · Sentadilla...". */
export function contarEjercicios(cuerpo) {
  return [...cuerpo.matchAll(/^##\s+([A-Z]\d+)\s*·/gm)].map((m) => m[1]);
}

/** Series declaradas en las tablas "| **4** | **6** | ..." de cada ejercicio. */
function animaciones(cuerpo) {
  return [...cuerpo.matchAll(/!\[[^\]]*\]\(videos\/([^)\s]+)\)/g)].map((m) => m[1]);
}

export async function cargarRutinas(dirGimnasio, aviso = () => {}) {
  if (!existsSync(dirGimnasio)) return [];

  const carpetas = (await readdir(dirGimnasio, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const rutinas = [];
  for (const carpeta of carpetas) {
    const ficha = path.join(dirGimnasio, carpeta, "rutina.md");
    if (!existsSync(ficha)) {
      aviso(`gimnasio/${carpeta} no tiene rutina.md: se ignora`);
      continue;
    }
    const { meta, cuerpo } = parseFicha(await readFile(ficha, "utf8"));

    const nombre = String(meta.nombre || carpeta).trim();
    const slug = slugify(meta.slug || carpeta);

    // Como con el desnivel de las rutas: se cuenta solo y la ficha solo manda
    // si lo declara; si los dos no cuadran, avisa en el build.
    const ejercicios = contarEjercicios(cuerpo);
    if (meta.ejercicios && Number(meta.ejercicios) !== ejercicios.length) {
      aviso(
        `${carpeta}: la ficha declara ${meta.ejercicios} ejercicios y en el cuerpo hay ` +
          `${ejercicios.length} (${ejercicios.join(", ") || "ninguno"}); revisa cuál es el bueno`
      );
    }

    // los GIF que el cuerpo referencia tienen que existir
    const dirVideos = path.join(dirGimnasio, carpeta, "videos");
    const citados = [...new Set(animaciones(cuerpo))];
    const gifs = [];
    for (const g of citados) {
      const origen = path.join(dirVideos, g);
      if (!existsSync(origen)) {
        aviso(`${carpeta}: el cuerpo pide videos/${g} y ese archivo no existe`);
        continue;
      }
      gifs.push({ archivo: g, origen, peso: (await stat(origen)).size });
    }
    const huerfanos = existsSync(dirVideos)
      ? (await readdir(dirVideos)).filter((f) => f.endsWith(".gif") && !citados.includes(f))
      : [];
    for (const h of huerfanos) aviso(`${carpeta}: videos/${h} no lo usa nadie`);

    rutinas.push({
      slug,
      carpeta,
      nombre,
      dia: meta.dia || "",
      duracion: Number(meta.duracion) || 0,
      objetivo: meta.objetivo || "",
      grupo: meta.grupo || "",
      intensidad: meta.intensidad || "",
      fase: meta.fase || "",
      resumen: meta.resumen || "",
      series: Number(meta.series) || 0,
      orden: Number(meta.orden) || 99,
      material: Array.isArray(meta.material) ? meta.material : meta.material ? [meta.material] : [],
      ejercicios: ejercicios.length,
      codigos: ejercicios,
      gifs,
      cuerpoHtml: markdown(cuerpo),
    });
  }

  rutinas.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  return rutinas;
}
