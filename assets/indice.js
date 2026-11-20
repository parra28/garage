// El Garaje - buscar y filtrar las rutas.
// Los paneles ya vienen en el HTML: aqui solo se muestran y se ocultan, asi
// que la pagina tambien funciona sin JavaScript.
(function () {
  var listado = document.getElementById("listado-rutas");
  if (!listado) return;

  var paneles = Array.prototype.slice.call(listado.querySelectorAll(".ruta-panel"));
  var buscar = document.getElementById("f-buscar");
  var contador = document.getElementById("contador");
  var vacio = document.getElementById("vacio");
  var limpiar = document.getElementById("limpiar");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var bici = "";
  var zona = "";

  function normalizar(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function aplicar() {
    var texto = normalizar(buscar && buscar.value);
    var visibles = 0;

    paneles.forEach(function (p) {
      var ok = true;
      if (texto && normalizar(p.dataset.busqueda).indexOf(texto) === -1) ok = false;
      if (ok && bici && p.dataset.bici !== bici) ok = false;
      if (ok && zona && p.dataset.zona !== zona) ok = false;
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

  if (buscar) {
    buscar.addEventListener("input", aplicar);
    buscar.addEventListener("search", aplicar);
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      if (c.dataset.zona !== undefined) {
        // pulsar la zona activa la quita
        zona = zona === c.dataset.zona ? "" : c.dataset.zona;
        chips.forEach(function (x) {
          if (x.dataset.zona !== undefined) x.classList.toggle("activo", x.dataset.zona === zona && zona !== "");
        });
      } else {
        bici = c.dataset.bici || "";
        chips.forEach(function (x) {
          if (x.dataset.bici !== undefined) x.classList.toggle("activo", x === c);
        });
      }
      aplicar();
    });
  });

  if (limpiar) {
    limpiar.addEventListener("click", function () {
      if (buscar) buscar.value = "";
      bici = "";
      zona = "";
      chips.forEach(function (x, i) { x.classList.toggle("activo", i === 0); });
      aplicar();
    });
  }

  aplicar();
})();
