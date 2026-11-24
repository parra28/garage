#!/usr/bin/env node
// El Garaje - copias pequenas de las fotos de las rutas, para el movil.
//
//   node src/reducir-fotos.mjs
//
// Para cada rutas/<ruta>/<foto>.webp escribe rutas/<ruta>/640/<foto>.webp, de
// 640 px de ancho. Usa el Chrome (o Edge) instalado, sin ventana: el navegador
// decodifica la foto, la reduce en un canvas y la devuelve en WebP. Solo hace
// las que faltan; se ejecuta a mano al anadir fotos y el resultado se sube al
// repositorio, asi la compilacion no depende de ningun programa.

import { spawn } from "node:child_process";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const DIR_RUTAS = path.join(RAIZ, "rutas");
const ANCHO = 640;
const CALIDAD = 0.8;
const EXT = [".jpg", ".jpeg", ".png", ".webp"];

const NAVEGADORES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

async function pendientes() {
  const out = [];
  for (const d of await readdir(DIR_RUTAS, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const carpeta = path.join(DIR_RUTAS, d.name);
    for (const f of await readdir(carpeta)) {
      if (!EXT.includes(path.extname(f).toLowerCase())) continue;
      const destino = path.join(carpeta, String(ANCHO), f.replace(/\.[^.]+$/, ".webp"));
      const previa = path.join(carpeta, String(ANCHO), f.replace(/\.[^.]+$/, ".previa.webp"));
      if (!existsSync(destino)) out.push({ origen: path.join(carpeta, f), destino, ancho: ANCHO, calidad: CALIDAD });
      // una previa diminuta (24 px) que se pinta de fondo mientras llega la foto
      if (!existsSync(previa)) out.push({ origen: path.join(carpeta, f), destino: previa, ancho: 24, calidad: 0.5 });
    }
  }
  return out;
}

async function main() {
  const lista = await pendientes();
  if (!lista.length) return console.log("  todas las fotos tienen ya su copia de " + ANCHO + " px y su previa");

  const exe = NAVEGADORES.find((p) => existsSync(p));
  if (!exe) throw new Error("no encuentro Chrome ni Edge (o pon su ruta en CHROME)");
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const perfil = path.join(os.tmpdir(), "garaje-reducir-fotos");
  const nav = spawn(exe, ["--headless=new", `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });

  try {
    let pagina = null;
    for (let i = 0; i < 80 && !pagina; i++) {
      try {
        pagina = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === "page");
      } catch {}
      if (!pagina) await new Promise((r) => setTimeout(r, 150));
    }
    if (!pagina) throw new Error("el navegador no ha respondido");

    const ws = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
    let n = 0;
    const espera = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && espera.has(m.id)) { espera.get(m.id)(m); espera.delete(m.id); }
    };
    const enviar = (method, params) => new Promise((r) => { const id = ++n; espera.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

    for (const { origen, destino, ancho, calidad } of lista) {
      const tipo = path.extname(origen).slice(1).replace("jpg", "jpeg");
      const b64 = (await readFile(origen)).toString("base64");
      const expr = `(async () => {
        const img = new Image();
        img.src = "data:image/${tipo};base64,${b64}";
        await img.decode();
        const w = Math.min(${ancho}, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
        return c.toDataURL("image/webp", ${calidad}).split(",")[1];
      })()`;
      const r = await enviar("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      const valor = r.result && r.result.result && r.result.result.value;
      if (!valor) { console.warn(`  x ${path.relative(RAIZ, origen)}: no se ha podido reducir`); continue; }
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, Buffer.from(valor, "base64"));
      const antes = (await stat(origen)).size, despues = (await stat(destino)).size;
      console.log(`  + ${path.relative(RAIZ, destino)}  ${Math.round(antes / 1024)} KB -> ${Math.round(despues / 1024)} KB`);
    }
    ws.close();
  } finally {
    nav.kill();
  }
}

main().catch((e) => { console.error(`\nError: ${e.message}\n`); process.exit(1); });
