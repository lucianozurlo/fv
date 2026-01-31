// assets/js/retina-scale.js
(() => {
  const root = document.documentElement;

  // ===== Config =====
  const RETINA_DESKTOP_SCALE = 0.8;

  const FREEZE_MIN = 961; // inclusive: freeze ON desde 961
  const MOBILE_MAX = 960; // mobile <= 960 => NO engine
  const REF_NON_RETINA = 1780; // referencia desktop normal
  const REF_RETINA = 1420; // referencia desktop retina (1780 * 0.8)

  // MQs (robustas)
  const mqRetinaStd = matchMedia("(min-resolution: 2dppx)");
  const mqRetinaWk = matchMedia("(-webkit-min-device-pixel-ratio: 2)");

  const mqMaxMobile = matchMedia(`(max-width: ${MOBILE_MAX}px)`);
  const mqCoarse = matchMedia("(pointer: coarse)");
  const mqNoHover = matchMedia("(hover: none)");

  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

  const supportsZoom = !!(
    window.CSS &&
    CSS.supports &&
    CSS.supports("zoom", "1")
  );

  // ===== Viewport usable (alto/ancho real) =====
  let raf = 0;
  function setViewportVars() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      const w = vv ? vv.width : window.innerWidth;

      // 1% en px del viewport usable
      root.style.setProperty("--vvh", `${h * 0.01}px`);
      root.style.setProperty("--vvw", `${w * 0.01}px`);
    });
  }

  // ===== Helpers =====
  function getVW() {
    const vv = window.visualViewport;
    return vv ? vv.width : window.innerWidth;
  }

  function isRetina() {
    return (
      (window.devicePixelRatio || 1) >= 2 ||
      mqRetinaStd.matches ||
      mqRetinaWk.matches
    );
  }

  function isMobile() {
    // Definición obligatoria: <=960 y/o coarse/nohover y/o UA
    // (Incluye tablets/phones incluso con DPR alto)
    return (
      mqMaxMobile.matches || mqCoarse.matches || mqNoHover.matches || isMobileUA
    );
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // ===== Core apply =====
  function apply() {
    // Si no hay zoom, apagamos engine para no romper nada.
    if (!supportsZoom) {
      root.classList.remove(
        "scale-engine",
        "retina-desktop-scale",
        "freeze-scale",
      );
      root.style.setProperty("--retina-scale", "1");
      root.style.setProperty("--freeze-scale", "1");
      root.style.setProperty("--final-scale", "1");
      root.style.setProperty("--scale-inv", "1");
      return;
    }

    const vw = getVW();
    const mobile = isMobile() || vw <= MOBILE_MAX;

    // Engine SOLO desktop (no mobile)
    root.classList.toggle("scale-engine", !mobile);

    // Retina scale SOLO desktop retina
    const retinaDesktop = !mobile && isRetina();
    const retinaScale = retinaDesktop ? RETINA_DESKTOP_SCALE : 1;

    root.classList.toggle("retina-desktop-scale", retinaDesktop);

    // Freeze-scale SOLO en desktop y SOLO en [961, ref]
    // ref depende de si estamos en retinaDesktop o no
    const ref = retinaDesktop ? REF_RETINA : REF_NON_RETINA;

    let freezeScale = 1;
    const freezeActive = !mobile && vw >= FREEZE_MIN && vw < ref;

    if (freezeActive) {
      // scaleWidth = vw / ref
      freezeScale = clamp(vw / ref, 0.01, 1);
    }

    root.classList.toggle("freeze-scale", freezeActive);

    const finalScale = retinaScale * freezeScale;
    const inv = 1 / finalScale;

    // Vars para CSS
    root.style.setProperty("--retina-scale", String(retinaScale));
    root.style.setProperty("--freeze-scale", String(freezeScale));
    root.style.setProperty("--final-scale", String(finalScale));
    root.style.setProperty("--scale-inv", String(inv));
  }

  // ===== Init =====
  setViewportVars();
  apply();

  // ===== Listeners =====
  const onResize = () => {
    setViewportVars();
    apply();
  };

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(onResize, 50), {
    passive: true,
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize, {
      passive: true,
    });
  }

  // MQ change handlers (retina/breakpoint/pointer)
  const bindMQ = (mq) => {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onResize);
    else if (mq.addListener) mq.addListener(onResize);
  };
  [mqRetinaStd, mqRetinaWk, mqMaxMobile, mqCoarse, mqNoHover].forEach(bindMQ);
})();
