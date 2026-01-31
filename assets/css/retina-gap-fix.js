/* retina-gap-fix.js
   - Solo desktop retina: sincroniza html/body/#body-inner a un único alto real
   - Evita usar rects escalados (usa scrollHeight)
   - No interfiere con scroll-lock (modales/preloader/menu)
*/
(function () {
  const root = document.documentElement;
  const body = document.body;
  const main = document.getElementById("body-inner");
  if (!main) return;

  const MQ_NO_SCALE = window.matchMedia(
    "(max-width: 960px), (hover: none), (pointer: coarse)",
  );
  const MQ_DESKTOP = window.matchMedia(
    "(min-width: 961px) and (hover: hover) and (pointer: fine)",
  );

  const isRetina = () => (window.devicePixelRatio || 1) >= 1.5;

  function isScrollLocked() {
    // cubrimos tus locks típicos + algunos de theme
    return (
      root.classList.contains("no-scroll") ||
      body.classList.contains("no-scroll") ||
      root.classList.contains("modal-lock") ||
      body.classList.contains("modal-lock") ||
      root.classList.contains("modal-open") ||
      body.classList.contains("modal-open") ||
      body.classList.contains("tt-ol-menu-open") ||
      root.classList.contains("tt-scroll-locked")
    );
  }

  function shouldRun() {
    if (!isRetina()) return false;
    if (MQ_NO_SCALE.matches) return false; // mobile/tablet incluso retina: NO
    if (!MQ_DESKTOP.matches) return false;
    if (isScrollLocked()) return false;
    return true;
  }

  function getAppliedScale(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return 1;

    // matrix(a,b,c,d,tx,ty) => scaleX = a
    if (t.startsWith("matrix(")) {
      const a = parseFloat(t.slice(7).split(",")[0]);
      return Number.isFinite(a) && a > 0 ? a : 1;
    }

    // matrix3d(a1, ...) => scaleX = a1
    if (t.startsWith("matrix3d(")) {
      const a1 = parseFloat(t.slice(9).split(",")[0]);
      return Number.isFinite(a1) && a1 > 0 ? a1 : 1;
    }

    return 1;
  }

  function readViewportH() {
    // visualViewport suele ser más fiel en Safari/mac cuando hay barras/zoom
    const vv = window.visualViewport;
    const h = vv?.height || window.innerHeight || root.clientHeight;
    return h || 0;
  }

  function getContentEl() {
    // si usás smooth-scrollbar, suele crear .scroll-content adentro
    return (
      document.querySelector("#scroll-container .scroll-content") ||
      document.getElementById("scroll-container") ||
      main
    );
  }

  // redondeo “a device pixel” para evitar gaps por fracciones (Safari)
  function snapToDevicePx(cssPx) {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(cssPx * dpr) / dpr;
  }

  function calcDocHeightUnscaled() {
    const scale = getAppliedScale(main) || 1;
    const vvh = readViewportH();

    // mínimo: cubrir exactamente 1 viewport “real” luego de escalar
    const minNeeded = vvh > 0 ? vvh / scale : 0;

    const content = getContentEl();
    const contentH = content?.scrollHeight || 0;
    const mainH = main.scrollHeight || 0;

    // OJO: NO usamos body/html scrollHeight para no perpetuar el “extra height”
    const raw = Math.max(minNeeded, contentH, mainH);

    // evita 0 / NaN y reduce gaps por rounding
    return snapToDevicePx(Math.ceil(raw));
  }

  let raf = 0;

  function apply() {
    if (!shouldRun()) {
      root.classList.remove("ui-retina-scale");
      root.style.removeProperty("--ui-doc-h");
      return;
    }

    root.classList.add("ui-retina-scale");

    const docH = calcDocHeightUnscaled();
    if (!docH || !Number.isFinite(docH)) return;

    // set solo si cambia “en serio” para evitar layout thrash
    const prev = parseFloat(
      getComputedStyle(root).getPropertyValue("--ui-doc-h"),
    );
    if (!prev || Math.abs(prev - docH) > 1) {
      root.style.setProperty("--ui-doc-h", docH + "px");
    }
  }

  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  }

  // Recalcular en resize/viewport changes
  window.addEventListener("resize", schedule, { passive: true });
  window.visualViewport?.addEventListener("resize", schedule, {
    passive: true,
  });
  window.addEventListener("orientationchange", schedule, { passive: true });

  // Después de cargar (imágenes/fonts pueden cambiar scrollHeight)
  window.addEventListener("load", () => {
    schedule();
    setTimeout(schedule, 80);
    setTimeout(schedule, 400);
  });

  // Observa cambios de layout (si hay animaciones/async content)
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    ro.observe(main);
    const content = getContentEl();
    if (content && content !== main) ro.observe(content);
  }

  // Si cambian locks/clases, recalculamos (al cerrar modal/menu suele arreglar)
  const mo = new MutationObserver(schedule);
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  mo.observe(body, { attributes: true, attributeFilter: ["class"] });

  // init
  schedule();
})();

function fixRetinaEndGap() {
  const html = document.documentElement;
  if (!html.classList.contains("retina-desktop-scale")) return;

  const sc = document.getElementById("scroll-container");
  if (!sc) return;

  const s =
    parseFloat(getComputedStyle(html).getPropertyValue("--retina-scale")) || 1;
  if (s >= 0.999) return;

  const getVVH = () => window.visualViewport?.height || window.innerHeight;
  const getUnscaledVVH = () => getVVH() / s;

  // --- Caso A: Smooth Scrollbar (si existe) ---
  const sb = window.Scrollbar?.get?.(sc) || null;
  if (sb && typeof sb.addListener === "function") {
    const clamp = () => {
      // Importante: update antes de leer limit
      sb.update?.();

      const vv = getVVH(); // 1389
      const unscaled = getUnscaledVVH(); // 1736.25
      const diff = unscaled - vv; // 347.25 (lo que te “sobra” en el límite)

      // limit.y quedó calculado con un alto “visual” (vv), pero el contenedor real equivale a unscaled.
      const maxY = Math.max(0, (sb.limit?.y ?? 0) - diff);

      if ((sb.offset?.y ?? 0) > maxY) {
        sb.setPosition(sb.offset.x, maxY);
      }
    };

    sb.addListener(clamp);
    window.addEventListener("resize", clamp, { passive: true });
    window.visualViewport?.addEventListener("resize", clamp, { passive: true });

    requestAnimationFrame(clamp);
    return;
  }

  // --- Caso B: Scroll nativo dentro de #scroll-container ---
  const clampNative = () => {
    const max = Math.max(0, sc.scrollHeight - getUnscaledVVH());
    if (sc.scrollTop > max) sc.scrollTop = max;
  };

  sc.addEventListener("scroll", clampNative, { passive: true });
  window.addEventListener("resize", clampNative, { passive: true });
  window.visualViewport?.addEventListener("resize", clampNative, {
    passive: true,
  });

  clampNative();
}
