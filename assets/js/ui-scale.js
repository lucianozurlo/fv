/* /assets/js/ui-scale.js
   Freeze + escala proporcional (sin zoom)
   - Respeta retina-80 (NO duplica ni rompe --retinaScale)
   - Controla: --uiBaseW, --uiScale, --uiScaleInv, --uiVh
   - Histéresis para handoff suave (evita flicker)
   - Transición suave SOLO en toggles (html.ui-scale-anim)
*/
(function () {
  const CFG = {
    // Histéresis alrededor del breakpoint:
    // OFF cuando vw <= breakpointOff
    // ON  cuando vw >= breakpointOn
    //
    // Recomendado (seguro, sin afectar mobile):
    //   breakpointOff=958, breakpointOn=962
    //
    // Podés ampliarlo, pero ojo: valores como 940/980 cambian el comportamiento y pueden verse peor.
    breakpointOff: 958,
    breakpointOn: 962,

    baseWNonRetina: 1730,
    baseWRetina: 1400,

    // (Opcional recomendado) evitar tablets:
    // si requireFinePointer=true, retina sólo se considera en hover:hover + pointer:fine
    requireFinePointer: true,

    htmlOnClass: "ui-scale-on",
    htmlAnimClass: "ui-scale-anim",
    rootSelector: "#scroll-container",

    // Transición en toggles (debe matchear CSS)
    toggleAnimMs: 140,

    // Tolerancia mínima para evitar ajustes por ruido
    eps: 0.0005,
  };

  const html = document.documentElement;
  const root = document.querySelector(CFG.rootSelector);
  if (!root) return;

  const mqRetina = window.matchMedia(
    "(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)",
  );
  const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");

  let enabled = false;
  let lastScale = 1;
  let raf = 0;
  let animTimer = 0;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function getViewportW() {
    return html.clientWidth || window.innerWidth || 0;
  }

  function isRetinaDesktop() {
    if (!mqRetina.matches) return false;
    if (CFG.requireFinePointer && !mqFine.matches) return false;
    return true;
  }

  function setVar(name, value) {
    html.style.setProperty(name, value);
  }

  function clearVars() {
    html.style.removeProperty("--uiBaseW");
    html.style.removeProperty("--uiScale");
    html.style.removeProperty("--uiScaleInv");
    html.style.removeProperty("--uiVh");
  }

  function startToggleAnim() {
    // Respeta reduced motion
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    html.classList.add(CFG.htmlAnimClass);
    clearTimeout(animTimer);
    animTimer = setTimeout(() => {
      html.classList.remove(CFG.htmlAnimClass);
    }, CFG.toggleAnimMs + 40);
  }

  function applyVars(baseW, scale) {
    const inv = 1 / scale;
    const vhPx = window.innerHeight || 0;

    setVar("--uiBaseW", String(baseW));
    setVar("--uiScale", scale.toFixed(6));
    setVar("--uiScaleInv", inv.toFixed(6));
    setVar("--uiVh", vhPx ? `${vhPx}px` : "100vh");

    html.dataset.uiScale = scale.toFixed(4);
    html.dataset.uiBasew = String(baseW);
  }

  function preserveScrollOnScaleChange(newScale) {
    // Mantener “posición visual” al cambiar escala:
    // visualY = scrollTop * lastScale
    // newScrollTop = visualY / newScale
    if (Math.abs(newScale - lastScale) <= CFG.eps) return;

    const visualY = root.scrollTop * lastScale;
    const newTop = visualY / newScale;

    const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
    root.scrollTop = clamp(newTop, 0, maxTop);

    lastScale = newScale;
  }

  function enable(baseW, scale) {
    if (!enabled) {
      startToggleAnim();
      html.classList.add(CFG.htmlOnClass);
      enabled = true;

      // Si venimos de OFF (lastScale debería ser 1), preserva scroll al entrar
      preserveScrollOnScaleChange(scale);
    } else {
      // Ya ON, sólo ajusto scroll si cambia scale
      preserveScrollOnScaleChange(scale);
    }

    applyVars(baseW, scale);
  }

  function disable() {
    if (!enabled) return;

    startToggleAnim();

    // Preservar posición visual al salir:
    // Vamos a escala 1.0 (sin transform). Ajusto scrollTop en el próximo frame
    const visualY = root.scrollTop * lastScale;

    // Apago clase (esto dispara la transición de transform -> none si ui-scale-anim está presente)
    html.classList.remove(CFG.htmlOnClass);
    enabled = false;

    // Limpio vars y data
    delete html.dataset.uiScale;
    delete html.dataset.uiBasew;
    clearVars();

    // En el próximo frame, ajusto scrollTop para que la posición visual quede lo más parecida posible
    requestAnimationFrame(() => {
      const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
      root.scrollTop = clamp(visualY, 0, maxTop);
    });

    lastScale = 1;
  }

  function computeAndApply() {
    const vw = getViewportW();

    // Histéresis:
    // - Si está ON, se apaga sólo cuando vw <= breakpointOff
    // - Si está OFF, se enciende sólo cuando vw >= breakpointOn
    //
    // Esto reduce flicker cerca de 960 (scrollbar / rounding).
    if (enabled) {
      if (vw <= CFG.breakpointOff) {
        disable();
        return;
      }
    } else {
      if (vw < CFG.breakpointOn) {
        // permanece apagado
        return;
      }
    }

    // Si llegamos acá, debe estar ON (o encenderse) con la lógica base
    const retina = isRetinaDesktop();
    const baseW = retina ? CFG.baseWRetina : CFG.baseWNonRetina;
    const scale = clamp(vw / baseW, 0, 1);

    enable(baseW, scale);
  }

  function requestUpdate() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      computeAndApply();
    });
  }

  // Eventos relevantes
  window.addEventListener("resize", requestUpdate, { passive: true });
  window.addEventListener("orientationchange", requestUpdate, {
    passive: true,
  });
  window.addEventListener("pageshow", requestUpdate, { passive: true }); // bfcache
  window.addEventListener("load", requestUpdate, { passive: true });

  // Fonts e imágenes pueden cambiar el layout
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(requestUpdate).catch(() => {});
  }

  // ResizeObserver por cambios internos
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => requestUpdate());
    ro.observe(root);
  }

  // Cambios de media query (retina / pointer fine)
  try {
    mqRetina.addEventListener("change", requestUpdate);
    mqFine.addEventListener("change", requestUpdate);
  } catch {
    mqRetina.addListener(requestUpdate);
    mqFine.addListener(requestUpdate);
  }

  // Init
  requestUpdate();
})();
