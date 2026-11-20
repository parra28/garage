// El Garaje - buscar, filtrar y ordenar las rutas.
// Los paneles ya vienen en el HTML: aqui solo se muestran, se ocultan y se
// reordenan, asi que la pagina tambien funciona sin JavaScript.
(function () {
  var listado = document.getElementById("listado-rutas");
  if (!listado) return;

  var paneles = Array.prototype.slice.call(listado.querySelectorAll(".ruta-panel"));
  var buscar = document.getElementById("f-buscar");
  var orden = document.getElementById("f-orden");
  var contador = document.getElementById("contador");
  var vacio = document.getElementById("vacio");
  var limpiar = document.getElementById("limpiar");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-grupo]"));
  var filtros = {}; // grupo -> valor ("" = todas)

  function normalizar(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function ordenar() {
    var criterio = orden ? orden.value : "orden";
    var desc = criterio.charAt(0) === "-";
    var campo = desc ? criterio.slice(1) : criterio;
    paneles
      .slice()
      .sort(function (a, b) {
        var x = parseFloat(a.dataset[campo]) || 0;
        var y = parseFloat(b.dataset[campo]) || 0;
        if (x === y) return (parseFloat(a.dataset.orden) || 0) - (parseFloat(b.dataset.orden) || 0);
        return desc ? y - x : x - y;
      })
      .forEach(function (p) { listado.appendChild(p); });
  }

  function aplicar() {
    var texto = normalizar(buscar && buscar.value);
    var visibles = 0;

    paneles.forEach(function (p) {
      var ok = !texto || normalizar(p.dataset.busqueda).indexOf(texto) !== -1;
      for (var g in filtros) {
        if (ok && filtros[g] && p.dataset[g] !== filtros[g]) ok = false;
      }
      p.hidden = !ok;
      if (ok) visibles++;
    });

    if (contador) {
      contador.textContent =
        visibles === paneles.length
          ? paneles.length === 1 ? "1 ruta" : paneles.length + " rutas"
          : visibles + " de " + paneles.length + " rutas";
    }
    if (vacio) vacio.hidden = visibles !== 0;
  }

  function marcar(grupo, valor) {
    filtros[grupo] = valor;
    chips.forEach(function (x) {
      if (x.dataset.grupo !== grupo) return;
      var activo = x.dataset.valor === valor;
      x.classList.toggle("activo", activo);
      x.setAttribute("aria-pressed", activo ? "true" : "false");
    });
  }

  if (buscar) {
    buscar.addEventListener("input", aplicar);
    buscar.addEventListener("search", aplicar);
  }
  if (orden) orden.addEventListener("change", ordenar);

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var g = c.dataset.grupo;
      // pulsar el filtro activo lo quita
      marcar(g, filtros[g] === c.dataset.valor ? "" : c.dataset.valor);
      aplicar();
    });
  });

  if (limpiar) {
    limpiar.addEventListener("click", function () {
      if (buscar) buscar.value = "";
      Object.keys(filtros).forEach(function (g) { marcar(g, ""); });
      aplicar();
    });
  }

  aplicar();
})();
