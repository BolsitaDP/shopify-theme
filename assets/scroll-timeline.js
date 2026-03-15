(() => {
  const BACKGROUND_ID = 'gsap-scroll-bg';
  const CANVAS_ID = 'gsap-scroll-bg-canvas';
  const FRAMES_JSON_ID = 'gsap-scroll-bg-frames';
  const FRAME_STRIDE = 2; // use one frame and skip one
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const MOBILE_QUERY = '(max-width: 749px)';
  const MOBILE_COVER_SCALE = 1.08;
  const MAX_DEVICE_PIXEL_RATIO = 2;
  const PRELOAD_RANGE_BEHIND = 2;
  const PRELOAD_RANGE_AHEAD = 8;

  let frameUrls = [];
  let desiredFrame = 0;
  let paintedFrame = -1;
  let paintQueued = false;
  let warmupOrder = [];
  let warmupIndex = 0;
  let warmupTimer = null;

  const frameCache = new Map();
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function parseFrames() {
    const framesNode = document.getElementById(FRAMES_JSON_ID);
    if (!framesNode) return [];

    try {
      const parsed = JSON.parse(framesNode.textContent);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(Boolean).filter((_, index) => index % FRAME_STRIDE === 0);
    } catch (error) {
      console.error('GSAP timeline background: invalid frame list JSON', error);
      return [];
    }
  }

  function cacheFrame(index, image, promise) {
    frameCache.set(index, {
      image,
      promise,
      loaded: false,
      error: false,
    });
  }

  function getCache(index) {
    return frameCache.get(index);
  }

  function loadFrame(index) {
    const safeIndex = clamp(index, 0, frameUrls.length - 1);
    const cached = getCache(safeIndex);
    if (cached) return cached.promise;

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = frameUrls[safeIndex];

    const loadPromise = new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Frame failed to load: ${safeIndex}`));
    })
      .then(async (img) => {
        // Decoding before drawing avoids visual flicker on fast scroll.
        if (typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch (_) {
            // ignore decode failure and still use loaded image
          }
        }

        const entry = getCache(safeIndex);
        if (entry) entry.loaded = true;
        return img;
      })
      .catch((error) => {
        const entry = getCache(safeIndex);
        if (entry) entry.error = true;
        throw error;
      });

    cacheFrame(safeIndex, image, loadPromise);
    return loadPromise;
  }

  function buildWarmupOrder(startIndex) {
    const indices = Array.from({ length: frameUrls.length }, (_, index) => index);
    indices.sort((a, b) => Math.abs(a - startIndex) - Math.abs(b - startIndex));
    warmupOrder = indices;
    warmupIndex = 0;
  }

  function warmupTick() {
    const batchSize = 2;
    let loadedCount = 0;

    while (warmupIndex < warmupOrder.length && loadedCount < batchSize) {
      const nextIndex = warmupOrder[warmupIndex];
      warmupIndex += 1;

      const cached = getCache(nextIndex);
      if (cached?.loaded || cached?.error) continue;

      loadFrame(nextIndex).catch(() => {});
      loadedCount += 1;
    }

    if (warmupIndex >= warmupOrder.length) {
      warmupTimer = null;
      return;
    }

    warmupTimer = window.setTimeout(warmupTick, 80);
  }

  function startWarmup(startIndex) {
    if (warmupTimer !== null) return;
    buildWarmupOrder(startIndex);
    warmupTick();
  }

  function preloadAround(index) {
    const start = clamp(index - PRELOAD_RANGE_BEHIND, 0, frameUrls.length - 1);
    const end = clamp(index + PRELOAD_RANGE_AHEAD, 0, frameUrls.length - 1);

    for (let i = start; i <= end; i += 1) {
      loadFrame(i).catch(() => {});
    }
  }

  function getFrameFromScrollProgress(progress) {
    return clamp(Math.round(progress * (frameUrls.length - 1)), 0, frameUrls.length - 1);
  }

  function drawFrameImage(context, canvas, image) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imageWidth = image.naturalWidth || image.width || 1;
    const imageHeight = image.naturalHeight || image.height || 1;
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const baseScale = isMobile
      ? Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight)
      : Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
    const scale = isMobile ? baseScale * MOBILE_COVER_SCALE : baseScale;
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function paintFrame(index, context, canvas) {
    const safeIndex = clamp(index, 0, frameUrls.length - 1);
    const cached = getCache(safeIndex);

    if (cached?.loaded) {
      drawFrameImage(context, canvas, cached.image);
      paintedFrame = safeIndex;
      return Promise.resolve();
    }

    return loadFrame(safeIndex)
      .then((image) => {
        if (safeIndex !== desiredFrame) return;
        drawFrameImage(context, canvas, image);
        paintedFrame = safeIndex;
      })
      .catch(() => {});
  }

  function queuePaint(index, context, canvas) {
    desiredFrame = clamp(index, 0, frameUrls.length - 1);
    preloadAround(desiredFrame);

    if (paintQueued) return;
    paintQueued = true;

    requestAnimationFrame(() => {
      paintQueued = false;
      if (desiredFrame === paintedFrame) return;
      paintFrame(desiredFrame, context, canvas);
    });
  }

  function resizeCanvas(canvas, context) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const width = Math.max(Math.round(window.innerWidth * dpr), 1);
    const height = Math.max(Math.round(window.innerHeight * dpr), 1);

    if (canvas.width === width && canvas.height === height) return;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    if (paintedFrame >= 0) {
      const cached = getCache(paintedFrame);
      if (cached?.loaded) drawFrameImage(context, canvas, cached.image);
    }
  }

  function initGsap(queueFrame) {
    if (!window.gsap || !window.ScrollTrigger) {
      const updateFromScroll = () => {
        const maxScroll = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          1
        );
        const progress = clamp(window.scrollY / maxScroll, 0, 1);
        queueFrame(getFrameFromScrollProgress(progress));
      };

      updateFromScroll();
      window.addEventListener('scroll', updateFromScroll, { passive: true });
      window.addEventListener('resize', updateFromScroll);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const state = { frame: 0 };
    gsap.to(state, {
      frame: frameUrls.length - 1,
      ease: 'none',
      onUpdate: () => queueFrame(Math.round(state.frame)),
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.25,
        invalidateOnRefresh: true,
      },
    });

    ScrollTrigger.refresh();
    document.addEventListener('shopify:section:load', () => ScrollTrigger.refresh());
    document.addEventListener('shopify:section:reorder', () => ScrollTrigger.refresh());
  }

  function initTimelineBackground() {
    const background = document.getElementById(BACKGROUND_ID);
    const canvas = document.getElementById(CANVAS_ID);
    if (!background || !canvas) return;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    frameUrls = parseFrames();
    if (!frameUrls.length) return;

    const queueFrame = (index) => queuePaint(index, context, canvas);

    resizeCanvas(canvas, context);
    window.addEventListener('resize', () => resizeCanvas(canvas, context), { passive: true });

    loadFrame(0)
      .then((image) => {
        drawFrameImage(context, canvas, image);
        paintedFrame = 0;
        desiredFrame = 0;
        document.body.classList.add('gsap-scroll-bg-enabled');
        preloadAround(0);
        startWarmup(0);
      })
      .catch(() => {});

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    initGsap(queueFrame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimelineBackground);
  } else {
    initTimelineBackground();
  }
})();
