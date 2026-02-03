/* /assets/js/ui-scale.js
   Freeze + escala proporcional (sin zoom)
   - Respeta retina-80 (NO duplica ni rompe --retinaScale)
   - Sólo controla: --uiBaseW, --uiScale, --uiScaleInv, --uiVh
   - ON: viewportWidth > 960
   - OFF: viewportWidth <= 960 (limpia todo)
*/
(function () {
  const CFG = {
    breakpointOff: 960,

    baseWNonRetina: 1730,
    baseWRetina: 1400,

    // (Opcional recomendado) evitar tablets:
    // si requireFinePointer=true, retina sólo se considera en hover:hover + pointer:fine
    requireFinePointer: true,

    htmlOnClass: "ui-scale-on",
    rootSelector: "#scroll-container",

    // Pequeña tolerancia para evitar thrash
    eps: 0.0005,
  };

  const html = document.documentElement;
  const root = document.querySelector(CFG.rootSelector);
  if (!root) return;

  // Retina detection robusta (tal como pediste)
  const mqRetina = window.matchMedia(
    "(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)"
  );
  const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");

  let lastScale = 1;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function isRetinaDesktop() {
    if (!mqRetina.matches) return false;
    if (CFG.requireFinePointer && !mqFine.matches) return false;
    return true;
  }

  function getViewportW() {
    // clientWidth suele ser más estable que innerWidth por barras
    return html.clientWidth || window.innerWidth || 0;
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

  function disable() {
    html.classList.remove(CFG.htmlOnClass);
    delete html.dataset.uiScale;
    delete html.dataset.uiBasew;
    clearVars();
    lastScale = 1;
  }

  function enable(baseW, scale) {
    const inv = 1 / scale;
    const vhPx = window.innerHeight || 0;

    if (!html.classList.contains(CFG.htmlOnClass)) {
      html.classList.add(CFG.htmlOnClass);
    }

    setVar("--uiBaseW", String(baseW));
    setVar("--uiScale", scale.toFixed(6));
    setVar("--uiScaleInv", inv.toFixed(6));
    setVar("--uiVh", vhPx ? `${vhPx}px` : "100vh");

    html.dataset.uiScale = scale.toFixed(4);
    html.dataset.uiBasew = String(baseW);

    // Mantener “posición visual” al cambiar escala (QA-friendly):
    // visualY = scrollTop * scale
    // newScrollTop = visualY / newScale
    if (Math.abs(scale - lastScale) > CFG.eps) {
      const visualY = root.scrollTop * lastScale;
      const newTop = visualY / scale;

      const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);
      root.scrollTop = clamp(newTop, 0, maxTop);
    }

    lastScale = scale;
  }

  function computeAndApply() {
    const vw = getViewportW();

    // OFF total en <= 960 (sin residuos)
    if (vw <= CFG.breakpointOff) {
      disable();
      return;
    }

    const retina = isRetinaDesktop();
    const baseW = retina ? CFG.baseWRetina : CFG.baseWNonRetina;

    // uiScale = clamp(vw/baseW, 0..1)
    const scale = clamp(vw / baseW, 0, 1);

    enable(baseW, scale);
  }

  // Throttle con rAF
  let raf = 0;
  function requestUpdate() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      computeAndApply();
    });
  }

  // Recalcular con cambios relevantes
  window.addEventListener("resize", requestUpdate, { passive: true });
  window.addEventListener("orientationchange", requestUpdate, { passive: true });
  window.addEventListener("pageshow", requestUpdate, { passive: true }); // bfcache
  window.addEventListener("load", requestUpdate, { passive: true });

  // Fonts e imágenes pueden cambiar el layout (y el scrollHeight)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(requestUpdate).catch(() => {});
  }

  // ResizeObserver para cambios internos de contenido
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => requestUpdate());
    ro.observe(root);
  }

  // Cambios de media query (retina / pointer fine)
  try {
    mqRetina.addEventListener("change", requestUpdate);
    mqFine.addEventListener("change", requestUpdate);
  } catch {
    // Safari viejo
    mqRetina.addListener(requestUpdate);
    mqFine.addListener(requestUpdate);
  }

  // Init
  requestUpdate();
})();
