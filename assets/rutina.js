// El Garaje - la rutina en el gimnasio.
//   - el indice de bloques se queda arriba y marca por donde vas;
//   - el descanso se pulsa y arranca una cuenta atras;
//   - las series se marcan al hacerlas y se recuerdan durante el dia.
(function () {
  // ------------------------------------------------------------ indice
  var indice = document.querySelector(".indice-rutina");
  var secciones = Array.prototype.slice.call(document.querySelectorAll(".seccion-rutina"));

  if (indice) {
    var enlaces = Array.prototype.slice.call(indice.querySelectorAll("a"));

    // un bloque cerrado se abre al ir a el desde el indice
    enlaces.forEach(function (a) {
      a.addEventListener("click", function () {
        var destino = document.getElementById(a.getAttribute("href").slice(1));
        if (destino && destino.tagName === "DETAILS") destino.open = true;
      });
    });

    if ("IntersectionObserver" in window) {
      var visibles = {};
      var vigia = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (e) { visibles[e.target.id] = e.isIntersecting; });
          var actual = null;
          for (var i = 0; i < secciones.length; i++) {
            if (visibles[secciones[i].id]) { actual = secciones[i].id; break; }
          }
          enlaces.forEach(function (a) {
            var es = a.getAttribute("href") === "#" + actual;
            if (es) {
              a.setAttribute("aria-current", "true");
              // en el movil el indice se desplaza solo para que se vea el activo
              var izq = a.offsetLeft - indice.clientWidth / 2 + a.clientWidth / 2;
              indice.scrollTo({ left: izq, behavior: "smooth" });
            } else {
              a.removeAttribute("aria-current");
            }
          });
        },
        { rootMargin: "-80px 0px -55% 0px" }
      );
      secciones.forEach(function (s) { vigia.observe(s); });
    }
  }

  // ------------------------------------------------------------- reloj
  var reloj = null;
  var fin = 0;
  var tic = null;
  var etiqueta = "";
  var cierre = null;
  var bloqueo = null;

  function formato(seg) {
    seg = Math.max(0, Math.ceil(seg));
    var m = Math.floor(seg / 60);
    var s = seg % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function crearReloj() {
    reloj = document.createElement("div");
    reloj.className = "reloj";
    reloj.setAttribute("role", "timer");
    reloj.setAttribute("aria-live", "off");
    reloj.hidden = true;
    reloj.innerHTML =
      '<div class="reloj-texto"><span class="reloj-tiempo">0:00</span><span class="reloj-etiqueta"></span></div>' +
      '<button type="button" class="reloj-mas">+15 s</button>' +
      '<button type="button" class="reloj-parar">Parar</button>';
    document.body.appendChild(reloj);
    reloj.querySelector(".reloj-mas").addEventListener("click", function () {
      if (reloj.classList.contains("terminado")) return arrancar(15, etiqueta);
      fin += 15000;
      pintar();
    });
    reloj.querySelector(".reloj-parar").addEventListener("click", parar);
  }

  function pintar() {
    var resta = (fin - Date.now()) / 1000;
    reloj.querySelector(".reloj-tiempo").textContent = formato(resta);
    if (resta <= 0) terminar();
  }

  function pedirPantalla() {
    // que la pantalla no se apague mientras corre el descanso
    try {
      if (navigator.wakeLock && !bloqueo) {
        navigator.wakeLock.request("screen").then(function (b) { bloqueo = b; }).catch(function () {});
      }
    } catch (e) {}
  }

  function soltarPantalla() {
    if (bloqueo) { try { bloqueo.release(); } catch (e) {} bloqueo = null; }
  }

  function pitido() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      [0, 0.25, 0.5].forEach(function (t) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
      });
      setTimeout(function () { ctx.close(); }, 1200);
    } catch (e) {}
  }

  function arrancar(segundos, texto) {
    if (!reloj) crearReloj();
    clearInterval(tic);
    clearTimeout(cierre);
    etiqueta = texto || "Descanso";
    fin = Date.now() + segundos * 1000;
    reloj.classList.remove("terminado");
    reloj.querySelector(".reloj-etiqueta").textContent = etiqueta;
    reloj.hidden = false;
    document.body.classList.add("con-reloj");
    pintar();
    tic = setInterval(pintar, 250);
    pedirPantalla();
  }

  function terminar() {
    clearInterval(tic);
    reloj.classList.add("terminado");
    reloj.querySelector(".reloj-tiempo").textContent = "¡Vamos!";
    reloj.querySelector(".reloj-etiqueta").textContent = "Siguiente serie";
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    pitido();
    soltarPantalla();
    cierre = setTimeout(parar, 8000);
  }

  function parar() {
    clearInterval(tic);
    clearTimeout(cierre);
    if (reloj) reloj.hidden = true;
    document.body.classList.remove("con-reloj");
    soltarPantalla();
  }

  function nombreEjercicio(nodo) {
    var art = nodo.closest(".ejercicio");
    var h = art && art.querySelector("h4");
    return h ? h.textContent.trim() : "";
  }

  // el dato de descanso se convierte en boton
  Array.prototype.forEach.call(document.querySelectorAll(".dosis dd[data-segundos]"), function (dd) {
    var seg = parseInt(dd.dataset.segundos, 10);
    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "temporizador";
    boton.innerHTML = dd.innerHTML + '<span class="temporizador-icono" aria-hidden="true"></span>';
    boton.setAttribute("aria-label", "Empezar descanso de " + dd.textContent.trim());
    boton.addEventListener("click", function () { arrancar(seg, "Descanso · " + nombreEjercicio(dd)); });
    dd.replaceChildren(boton);
  });

  // ------------------------------------------------------------ series
  var hoy = new Date();
  var dia = hoy.getFullYear() + "-" + (hoy.getMonth() + 1) + "-" + hoy.getDate();
  var prefijo = "garaje-series:" + location.pathname + ":";
  var clave = prefijo + dia;
  var hechas = {};

  try {
    hechas = JSON.parse(localStorage.getItem(clave) || "{}") || {};
    // fuera lo de otros dias
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefijo) === 0 && k !== clave) localStorage.removeItem(k);
    }
  } catch (e) { hechas = {}; }

  function guardar() {
    try { localStorage.setItem(clave, JSON.stringify(hechas)); } catch (e) {}
  }

  Array.prototype.forEach.call(document.querySelectorAll(".series-hechas"), function (caja, n) {
    var total = parseInt(caja.dataset.series, 10);
    var seg = parseInt(caja.dataset.segundos, 10) || 0;
    var id = caja.dataset.clave || "e" + n;
    var estado = hechas[id] || [];

    var titulo = document.createElement("span");
    titulo.className = "series-titulo";
    titulo.textContent = "Series hechas";
    caja.appendChild(titulo);

    for (var s = 0; s < total; s++) {
      (function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "serie";
        b.textContent = s + 1;
        b.setAttribute("aria-label", "Serie " + (s + 1));
        b.setAttribute("aria-pressed", estado[s] ? "true" : "false");
        b.addEventListener("click", function () {
          estado[s] = !estado[s];
          b.setAttribute("aria-pressed", estado[s] ? "true" : "false");
          hechas[id] = estado;
          guardar();
          // al marcar una serie que no es la ultima, empieza el descanso
          var quedan = 0;
          for (var j = 0; j < total; j++) if (!estado[j]) quedan++;
          if (estado[s] && seg && quedan > 0) arrancar(seg, "Descanso · " + nombreEjercicio(caja));
        });
        caja.appendChild(b);
      })(s);
    }
    caja.classList.add("lista");
  });
})();
