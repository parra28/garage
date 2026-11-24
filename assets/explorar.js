// El Garaje - la pagina de rutas como un mapa.
// Todas las rutas dibujadas sobre el mapa y su lista al lado. Pasar por una
// ruta de la lista la resalta en el mapa; pulsarla la encuadra y abre su
// ficha pequena. Pulsar una ruta en el mapa hace lo mismo con la lista.
// Los filtros ocultan a la vez la ruta en la lista y en el mapa.
(function () {
  var nodo = document.getElementById("datos-explorar");
  var caja = document.getElementById("mapa-rutas");
  var listado = document.getElementById("listado-rutas");
  if (!nodo || !caja || !listado) return;

  var datos;
  try { datos = JSON.parse(nodo.textContent); } catch (e) { return; }
  var porSlug = {};
  datos.forEach(function (d) { porSlug[d.slug] = d; });

  var css = getComputedStyle(document.documentElement);
  function v(n, def) { return css.getPropertyValue(n).trim() || def; }
  var COLORES = {
    carretera: v("--t-carretera", "#2c5f9e"),
    gravel: v("--t-gravel", "#4f7a28"),
    btt: v("--t-btt", "#b0442c"),
    cicloturismo: v("--t-cicloturismo", "#7a4f9a"),
  };
  var tinta = v("--tinta", "#1c1a18");

  var items = Array.prototype.slice.call(listado.querySelectorAll(".item-ruta"));
  var buscar = document.getElementById("f-buscar");
  var orden = document.getElementById("f-orden");
  var contador = document.getElementById("contador");
  var vacio = document.getElementById("vacio");
  var limpiar = document.getElementById("limpiar");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-grupo]"));
  var filtros = {};

  // ------------------------------------------------------------- el mapa
  var hayMapa = typeof L !== "undefined";
  var mapa = null;
  var capas = {}; // slug -> { borde, linea, marca, grupo }
  var activa = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // ------------------------------------------- el detalle, en un panel
  var detalle = document.getElementById("detalle");
  function $(id) { return document.getElementById(id); }

  function mostrarDetalle(d) {
    if (!detalle) return;
    var fotos = d.fotos || [];
    $("detalle-fotos").className = "detalle-fotos n" + Math.min(fotos.length, 3);
    $("detalle-fotos").innerHTML = fotos.length
      ? fotos.map(function (src) { return '<img src="' + src + '" alt="">'; }).join("") +
        (d.numFotos > 1 ? '<span class="detalle-num"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-3 4 4"/></svg>' + d.numFotos + " fotos</span>" : "")
      : '<div class="detalle-sin-foto">' + (d.perfil || "") + "</div>";
    $("detalle-etiquetas").innerHTML =
      (d.dif ? '<span class="dificultad dif-' + d.nivel + '">' + esc(d.dif) + "</span>" : "") +
      (d.tipo ? '<span class="tipo tipo-' + esc(d.bici) + '">' + esc(d.tipo) + "</span>" : "");
    $("detalle-h").textContent = d.nombre;
    $("detalle-cifras").innerHTML =
      (d.tiempo ? '<span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 13V9M10 3h4"/></svg>' + esc(d.tiempo) + "</span>" : "") +
      '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>' + esc(d.km) + " km</span>" +
      '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M9 5h10v10"/></svg>' + esc(d.dplus) + " m</span>";
    $("detalle-lugar").textContent = d.lugar || "";
    var resumen = d.resumen || "";
    var corto = resumen.length > 240 ? resumen.slice(0, 240).replace(/s+S*$/, "") + "…" : resumen;
    $("detalle-resumen").innerHTML = corto ? esc(corto) + ' <a href="' + d.url + '">Leer más</a>' : "";
    $("detalle-aviso").hidden = !d.aviso;
    $("detalle-aviso").innerHTML = d.aviso ? "<b>Ojo con esto</b> " + esc(d.aviso.length > 160 ? d.aviso.slice(0, 160).replace(/s+S*$/, "") + "…" : d.aviso) : "";
    $("detalle-perfil").innerHTML = d.perfil || "";
    $("detalle-abrir").href = d.url;
    $("detalle-ir").href = d.url;
    $("detalle-gpx").href = d.gpx;
    $("detalle-compartir").dataset.url = new URL(d.url, location.href).href;
    $("detalle-compartir").dataset.titulo = d.nombre;
    detalle.hidden = false;
    detalle.querySelector(".detalle-scroll").scrollTop = 0;
    document.body.classList.add("con-detalle");
  }

  function cerrarDetalle() {
    if (!detalle || detalle.hidden) return;
    detalle.hidden = true;
    document.body.classList.remove("con-detalle");
    soltar();
    encuadrarVisibles(true);
  }

  if (detalle) {
    $("detalle-cerrar").addEventListener("click", cerrarDetalle);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarDetalle(); });
    $("detalle-compartir").addEventListener("click", function () {
      var b = this, url = b.dataset.url;
      if (navigator.share) { navigator.share({ title: b.dataset.titulo, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
        var t = b.lastChild.textContent; b.lastChild.textContent = "Enlace copiado";
        setTimeout(function () { b.lastChild.textContent = t; }, 1800);
      });
    });
  }

  if (hayMapa) {
    mapa = L.map(caja, { zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(mapa);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    datos.forEach(function (d) {
      if (!d.trazado || d.trazado.length < 2) return;
      var color = COLORES[d.bici] || tinta;
      var borde = L.polyline(d.trazado, { color: "#fff", weight: 7, opacity: 0.9, lineJoin: "round" });
      var linea = L.polyline(d.trazado, { color: color, weight: 4, opacity: 0.95, lineJoin: "round" });
      var marca = L.marker(d.trazado[0], {
        icon: L.divIcon({
          className: "salida-ruta",
          html: '<span style="--c:' + color + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 13 3 8.5 13 7.5 9.5z"/></svg></span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: d.nombre,
        keyboard: false,
      });
      var grupo = L.featureGroup([borde, linea, marca]).addTo(mapa);
      grupo.on("click", function () { elegir(d.slug, { desdeMapa: true }); });
      grupo.on("mouseover", function () { resaltar(d.slug, true); });
      grupo.on("mouseout", function () { resaltar(d.slug, false); });
      capas[d.slug] = { borde: borde, linea: linea, marca: marca, grupo: grupo, color: color };
    });

    encuadrarVisibles(false);
  }

  function encuadrarVisibles(animar) {
    if (!mapa) return;
    var limites = null;
    items.forEach(function (it) {
      var c = capas[it.dataset.slug];
      if (!c || it.hidden) return;
      var b = c.linea.getBounds();
      limites = limites ? limites.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
    });
    if (!limites) return;
    mapa.fitBounds(limites, opcionesEncuadre(animar));
  }

  // la lista tapa la izquierda del mapa en escritorio: se encuadra en lo que queda
  function margenes() {
    var lista = detalle && !detalle.hidden ? detalle : document.querySelector(".explorar-lista");
    var ancho = window.innerWidth > 900 && lista ? lista.offsetWidth + 40 : 20;
    return { paddingTopLeft: [ancho, 80], paddingBottomRight: [40, 40] };
  }
  function opcionesEncuadre(animar) {
    var m = margenes();
    return { paddingTopLeft: m.paddingTopLeft, paddingBottomRight: m.paddingBottomRight, animate: animar };
  }

  function resaltar(slug, si) {
    var c = capas[slug];
    if (c && slug !== activa) {
      c.linea.setStyle({ weight: si ? 6 : 4 });
      c.borde.setStyle({ weight: si ? 10 : 7 });
      if (si) { c.borde.bringToFront(); c.linea.bringToFront(); }
    }
    items.forEach(function (it) { if (it.dataset.slug === slug) it.classList.toggle("encima", si); });
  }

  function soltar() {
    if (!activa) return;
    var c = capas[activa];
    if (c) { c.linea.setStyle({ weight: 4 }); c.borde.setStyle({ weight: 7 }); }
    items.forEach(function (it) { it.classList.remove("activa"); });
    caja.classList.remove("con-activa");
    Object.keys(capas).forEach(function (s) {
      capas[s].linea.setStyle({ opacity: 0.95 });
      capas[s].borde.setStyle({ opacity: 0.9 });
    });
    activa = null;
  }

  function elegir(slug, op) {
    op = op || {};
    soltar();
    activa = slug;
    items.forEach(function (it) {
      var si = it.dataset.slug === slug;
      it.classList.toggle("activa", si);
      if (si && op.desdeMapa) it.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    mostrarDetalle(porSlug[slug]);
    var c = capas[slug];
    if (!mapa || !c) return;
    // las demas se apagan para que la elegida destaque
    Object.keys(capas).forEach(function (s) {
      if (s === slug) return;
      capas[s].linea.setStyle({ opacity: 0.35 });
      capas[s].borde.setStyle({ opacity: 0.3 });
    });
    c.linea.setStyle({ weight: 6 });
    c.borde.setStyle({ weight: 10 });
    c.borde.bringToFront();
    c.linea.bringToFront();
    mapa.fitBounds(c.linea.getBounds(), opcionesEncuadre(true));
  }

  items.forEach(function (it) {
    var slug = it.dataset.slug;
    it.addEventListener("mouseenter", function () { resaltar(slug, true); });
    it.addEventListener("mouseleave", function () { resaltar(slug, false); });
    it.addEventListener("click", function (e) {
      // toda la tarjeta, nombre incluido, abre el detalle; sin JavaScript el nombre lleva a la ficha
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      elegir(slug);
    });
  });

  // -------------------------------------------------- filtrar y ordenar
  function normalizar(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function pasa(it, grupo, valor) {
    if (!valor) return true;
    if (grupo === "dist") {
      var r = valor.split("-");
      var k = (parseFloat(it.dataset.dist) || 0) / 1000;
      return k >= parseFloat(r[0]) && k < parseFloat(r[1]);
    }
    return it.dataset[grupo] === valor;
  }

  function aplicar(encuadrar) {
    var texto = normalizar(buscar && buscar.value);
    var visibles = 0;
    items.forEach(function (it) {
      var ok = !texto || normalizar(it.dataset.busqueda).indexOf(texto) !== -1;
      for (var g in filtros) if (ok && !pasa(it, g, filtros[g])) ok = false;
      it.hidden = !ok;
      if (ok) visibles++;
      var c = capas[it.dataset.slug];
      if (c && mapa) {
        if (ok && !mapa.hasLayer(c.grupo)) c.grupo.addTo(mapa);
        if (!ok && mapa.hasLayer(c.grupo)) mapa.removeLayer(c.grupo);
      }
    });
    // si el filtro esconde la ruta abierta, su detalle se cierra
    if (activa && capas[activa] && mapa && !mapa.hasLayer(capas[activa].grupo)) cerrarDetalle();
    if (contador) {
      contador.textContent = visibles === items.length
        ? (items.length === 1 ? "1 ruta" : items.length + " rutas")
        : visibles + " de " + items.length + " rutas";
    }
    if (vacio) vacio.hidden = visibles !== 0;
    if (encuadrar && visibles) encuadrarVisibles(true);
  }

  function ordenar() {
    var criterio = orden ? orden.value : "orden";
    var desc = criterio.charAt(0) === "-";
    var campo = desc ? criterio.slice(1) : criterio;
    items.slice().sort(function (a, b) {
      var x = parseFloat(a.dataset[campo]) || 0, y = parseFloat(b.dataset[campo]) || 0;
      if (x === y) return (parseFloat(a.dataset.orden) || 0) - (parseFloat(b.dataset.orden) || 0);
      return desc ? y - x : x - y;
    }).forEach(function (it) { listado.appendChild(it); });
  }

  function marcar(grupo, valor) {
    filtros[grupo] = valor;
    var etiqueta = "";
    chips.forEach(function (x) {
      if (x.dataset.grupo !== grupo) return;
      var si = x.dataset.valor === valor;
      x.classList.toggle("activo", si);
      x.setAttribute("aria-pressed", si ? "true" : "false");
      if (si && valor) etiqueta = x.textContent;
    });
    // la pildora dice el filtro elegido, como en una app de mapas
    var det = document.querySelector('.filtro[data-grupo="' + grupo + '"]');
    if (det) {
      var nombre = det.querySelector(".filtro-nombre");
      nombre.textContent = etiqueta || nombre.dataset.titulo;
      det.classList.toggle("con-valor", !!valor);
    }
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var g = c.dataset.grupo;
      marcar(g, filtros[g] === c.dataset.valor ? "" : c.dataset.valor);
      aplicar(true);
      var det = c.closest("details");
      if (det) det.open = false;
    });
  });

  // solo un desplegable abierto a la vez; un clic fuera los cierra
  var desplegables = Array.prototype.slice.call(document.querySelectorAll(".filtro"));
  desplegables.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) desplegables.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".filtro")) desplegables.forEach(function (d) { d.open = false; });
  });

  if (buscar) {
    buscar.addEventListener("input", function () { aplicar(false); });
    buscar.addEventListener("search", function () { aplicar(true); });
  }
  if (orden) orden.addEventListener("change", ordenar);
  if (limpiar) {
    limpiar.addEventListener("click", function () {
      if (buscar) buscar.value = "";
      Object.keys(filtros).forEach(function (g) { marcar(g, ""); });
      aplicar(true);
    });
  }

  aplicar(false);
  if (mapa) setTimeout(function () { mapa.invalidateSize(); encuadrarVisibles(false); }, 60);
})();
