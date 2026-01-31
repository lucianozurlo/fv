// assets/js/retina-scale.js
(() => {
  const root = document.documentElement;

  const SCALE_DESKTOP_RETINA = 0.8;
  const BP_MOBILE = 960;

  // Media queries (robustas)
  const mqRetinaStd = matchMedia("(min-resolution: 2dppx)");
  const mqRetinaWk = matchMedia("(-webkit-min-device-pixel-ratio: 2)");

  const mqMaxMobile = matchMedia(`(max-width: ${BP_MOBILE}px)`);
  const mqCoarse = matchMedia("(pointer: coarse)");
  const mqNoHover = matchMedia("(hover: none)");

  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

  const supportsZoom = !!(
    window.CSS &&
    CSS.supports &&
    CSS.supports("zoom", "1")
  );

  // ---------- viewport usable real (sin jumps agresivos) ----------
  let raf = 0;
  function setViewportVars() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      const w = vv ? vv.width : window.innerWidth;

      // en px => 1% del viewport usable
      root.style.setProperty("--vvh", `${h * 0.01}px`);
      root.style.setProperty("--vvw", `${w * 0.01}px`);
    });
  }

  // ---------- detecciones ----------
  function isRetina() {
    return (
      (window.devicePixelRatio || 1) >= 2 ||
      mqRetinaStd.matches ||
      mqRetinaWk.matches
    );
  }

  function isMobile() {
    // Definición obligatoria (sumamos refuerzo por UA)
    return (
      mqMaxMobile.matches || mqCoarse.matches || mqNoHover.matches || isMobileUA
    );
  }

  // ---------- aplicar estado ----------
  function apply() {
    // Si no hay zoom, no forzamos nada (tu stack es Chrome/Safari, debería estar)
    if (!supportsZoom) {
      root.classList.remove("retina-desktop-scale");
      root.style.setProperty("--retina-scale", "1");
      root.style.setProperty("--scale-inv", "1");
      return;
    }

    const enable = isRetina() && !isMobile();

    const scale = enable ? SCALE_DESKTOP_RETINA : 1;
    const inv = 1 / scale;

    root.classList.toggle("retina-desktop-scale", enable);
    root.style.setProperty("--retina-scale", String(scale));
    root.style.setProperty("--scale-inv", String(inv));
  }

  // init ASAP
  setViewportVars();
  apply();

  // listeners
  const onResize = () => {
    setViewportVars();
    apply();
  };

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(onResize, 50), {
    passive: true,
  });

  // IMPORTANT: NO escucho visualViewport.scroll para evitar saltos por barra mobile.
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize, {
      passive: true,
    });
  }

  // cambios de MQ (retina <-> no retina / breakpoint / pointer)
  const bindMQ = (mq) => {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onResize);
    else if (mq.addListener) mq.addListener(onResize);
  };
  [mqRetinaStd, mqRetinaWk, mqMaxMobile, mqCoarse, mqNoHover].forEach(bindMQ);
})();
