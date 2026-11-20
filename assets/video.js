// El Garaje - el vídeo de la ruta.
//
// Se carga solo, sin pulsar nada, en cuanto el hueco del vídeo se acerca a
// la pantalla. Sigue siendo diferido a propósito: una ficha que nadie baja
// hasta los vídeos no le pide nada a Instagram ni a YouTube, y la página
// abre igual de rápida.
//
// Ojo: el incrustado de Instagram no tiene parámetro de reproducción
// automática. Esto deja el reproductor puesto y listo; el play sigue
// dándolo el visitante dentro del propio marco.
(function () {
  var cajas = Array.prototype.slice.call(document.querySelectorAll(".video[data-incrustar]"));
  if (!cajas.length) return;

  function cargar(caja, pulsado) {
    if (caja.classList.contains("cargado")) return;
    caja.classList.add("cargado");
    // YouTube arranca solo (silenciado) cuando el visitante pulsa; si el
    // vídeo se pone solo al pasar por delante, no: que no suene nada ni se
    // mueva nada sin que nadie lo haya pedido.
    var src = caja.dataset.incrustar;
    if (!pulsado) src = src.replace(/([?&])autoplay=1/, "$1autoplay=0");
    var marco = document.createElement("iframe");
    marco.src = src;
    marco.title = "Vídeo de la ruta en " + caja.dataset.plataforma;
    marco.allow = "encrypted-media; picture-in-picture; fullscreen";
    marco.allowFullscreen = true;
    marco.referrerPolicy = "strict-origin-when-cross-origin";
    caja.querySelector(".video-marco").replaceChildren(marco);
  }

  // el botón se queda como recurso: si algo falla, siempre se puede pulsar
  cajas.forEach(function (caja) {
    var boton = caja.querySelector(".video-boton");
    if (boton) {
      boton.addEventListener("click", function () {
        cargar(caja, true);
      });
    }
  });

  if (!("IntersectionObserver" in window)) {
    cajas.forEach(cargar);
    return;
  }

  // 600 px de margen: para cuando el vídeo entra en pantalla ya está puesto
  var vigia = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        vigia.unobserve(e.target);
        cargar(e.target);
      });
    },
    { rootMargin: "600px 0px" }
  );
  cajas.forEach(function (caja) {
    vigia.observe(caja);
  });
})();
