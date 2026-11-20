// El Garaje - el mapa de cada tarjeta de ruta.
// Se monta cuando la tarjeta asoma por la pantalla: asi la portada no pide
// teselas de rutas que nadie va a mirar.
(function () {
  var nodo = document.getElementById("datos-mapas");
  if (!nodo || typeof L === "undefined" || !("IntersectionObserver" in window)) return;

  var datos;
  try { datos = JSON.parse(nodo.textContent); } catch (e) { return; }
  var estilos = getComputedStyle(document.documentElement);
  var papel = estilos.getPropertyValue("--panel").trim() || "#f8f8f6";
  var tinta = estilos.getPropertyValue("--tinta").trim() || "#14171a";

  function montar(caja) {
    var trazado = datos[caja.dataset.slug];
    if (!trazado || trazado.length < 2) return;

    var lienzo = document.createElement("div");
    lienzo.className = "minimapa";
    caja.appendChild(lienzo);

    var mapa = L.map(lienzo, {
      attributionControl: false, zoomControl: false, dragging: false,
      touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, zoomSnap: 0.25,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17 }).addTo(mapa);
    L.polyline(trazado, { color: papel, weight: 6, opacity: 0.9, lineJoin: "round" }).addTo(mapa);
    var linea = L.polyline(trazado, { color: tinta, weight: 2.5, lineJoin: "round" }).addTo(mapa);

    function encuadrar() {
      mapa.invalidateSize({ animate: false });
      mapa.fitBounds(linea.getBounds(), { padding: [14, 14] });
    }
    encuadrar();
    setTimeout(encuadrar, 80);
    caja.classList.add("con-mapa");
  }

  var vigia = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        vigia.unobserve(e.target);
        montar(e.target);
      });
    },
    { rootMargin: "300px" }
  );

  Array.prototype.forEach.call(document.querySelectorAll(".ruta-mapa[data-slug]"), function (c) {
    if (datos[c.dataset.slug]) vigia.observe(c);
  });
})();
