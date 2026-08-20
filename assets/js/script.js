// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Hero image-sequence: quick scroll reveal + drag/slider to rotate
(function () {
  var heroSection = document.getElementById('hero-section');
  var card = document.getElementById('sequence-card');
  var canvas = document.getElementById('sequence-canvas');
  var dragHint = document.getElementById('drag-hint');
  var range = document.getElementById('sequence-range');
  if (!heroSection || !card || !canvas) return;

  var ctx = canvas.getContext('2d');
  var FRAME_COUNT = 72;
  var LAST_INDEX = FRAME_COUNT - 1;
  var frameUrl = function (i) {
    return 'assets/images/sequence/' + String(i).padStart(4, '0') + '.webp';
  };

  var images = [];
  var currentIndex = 0;

  function drawFrame(idx) {
    var img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  }

  function updateRangeUI() {
    if (!range) return;
    range.value = String(currentIndex);
    var pct = (currentIndex / LAST_INDEX) * 100;
    range.style.setProperty('--fill', pct + '%');
  }

  // Single source of truth for the current frame — the scroll reveal, the
  // drag gesture, and the slider input all funnel through this so they can
  // never fall out of sync with each other.
  function setIndex(idx) {
    currentIndex = Math.min(LAST_INDEX, Math.max(0, idx));
    drawFrame(currentIndex);
    updateRangeUI();
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(currentIndex);
  }

  function preload() {
    for (var i = 1; i <= FRAME_COUNT; i++) {
      (function (i) {
        var img = new Image();
        img.onload = function () {
          if (i === 1) resizeCanvas();
        };
        img.src = frameUrl(i);
        images.push(img);
      })(i);
    }
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var userInteracted = false;
  var ticking = false;

  // Quick scroll reveal: the rotation finishes within the first ~55% of the
  // hero's own height, so it settles on a clean frame while still fully
  // visible on screen — it never has to "race" the hero off the top of the
  // page. No pinning, scrolling is never blocked.
  var REVEAL_FRACTION = 0.55;

  function onScroll() {
    if (reduceMotion || userInteracted) return;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var revealDistance = heroSection.offsetHeight * REVEAL_FRACTION;
      var progress = revealDistance > 0 ? window.scrollY / revealDistance : 0;
      progress = Math.min(1, Math.max(0, progress));

      setIndex(Math.floor(progress * FRAME_COUNT));
      ticking = false;
    });
  }

  // Drag-to-rotate on the product itself, clamped to the real first/last
  // frame — this isn't a seamless 360° loop, so it stops firmly at both
  // ends instead of wrapping around into a jump cut.
  var DRAG_SENSITIVITY = 4; // px of pointer movement per frame step
  var DIRECTION_THRESHOLD = 8; // px of movement before we commit to a direction
  // Touch gestures go through three states instead of a plain on/off drag
  // flag: 'watching' (finger is down, direction not yet decided), 'dragging'
  // (confirmed horizontal — we own the gesture), or 'scrolling' (confirmed
  // vertical — untouched, left entirely to the browser's native scroll).
  // We deliberately do NOT call setPointerCapture or preventDefault until a
  // horizontal intent is confirmed. Relying on `touch-action` in CSS alone
  // isn't enough on iOS Safari, which can ignore touch-action on elements
  // that also carry a 3D transform (this card has perspective/rotateY) —
  // so the gesture is arbitrated here in JS instead, which works regardless
  // of that bug.
  var gestureState = 'idle';
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartIndex = 0;
  var activePointerId = null;

  function hideHint() {
    if (dragHint) dragHint.classList.add('is-hidden');
  }

  function beginDrag(e) {
    gestureState = 'dragging';
    userInteracted = true;
    dragStartIndex = currentIndex;
    card.classList.add('is-dragging');
    hideHint();
    if (card.setPointerCapture && e.pointerId != null) {
      try { card.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onPointerDown(e) {
    gestureState = 'watching';
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartIndex = currentIndex;
  }

  function onPointerMove(e) {
    if (gestureState === 'idle' || gestureState === 'scrolling') return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;

    var deltaX = e.clientX - dragStartX;
    var deltaY = e.clientY - dragStartY;

    if (gestureState === 'watching') {
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) {
        return; // not enough movement yet to know the intent
      }
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical intent — hand this gesture back to the browser entirely.
        // We never captured the pointer or called preventDefault, so the
        // page scrolls exactly as if this element weren't here.
        gestureState = 'scrolling';
        return;
      }
      beginDrag(e);
    }

    if (gestureState === 'dragging') {
      var frameDelta = Math.round(deltaX / DRAG_SENSITIVITY);
      setIndex(dragStartIndex - frameDelta);
    }
  }

  function onPointerUp() {
    gestureState = 'idle';
    activePointerId = null;
    card.classList.remove('is-dragging');
  }

  card.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // The slider is the explicit, always-visible control: it shows the exact
  // start/end bounds and lets a visitor jump straight to any angle.
  if (range) {
    range.addEventListener('input', function () {
      userInteracted = true;
      hideHint();
      setIndex(parseInt(range.value, 10));
    });
  }

  preload();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', onScroll, { passive: true });
  updateRangeUI();
  onScroll();
})();

// Before / after compare sliders
document.querySelectorAll('.compare').forEach(function (el) {
  var input = el.querySelector('.compare-range-input');
  var beforeWrap = el.querySelector('.compare-before-wrap');
  var handle = el.querySelector('.compare-handle');
  if (!input) return;

  function update(val) {
    beforeWrap.style.clipPath = 'inset(0 ' + (100 - val) + '% 0 0)';
    handle.style.left = val + '%';
  }

  update(input.value);
  input.addEventListener('input', function () { update(input.value); });
});

// Play video tiles on hover (desktop), keep poster on mobile until tapped
document.querySelectorAll('.tile-video').forEach(function (tile) {
  var video = tile.querySelector('video');
  if (!video) return;
  tile.addEventListener('mouseenter', function () {
    video.play().catch(function () {});
  });
  tile.addEventListener('mouseleave', function () {
    video.pause();
    video.currentTime = 0;
  });
});

// YouTube facade — loads only a local poster image on page load. The real
// YouTube iframe (and everything that comes with it: youtube.com's JS,
// cookies, etc.) is only injected once the person actually clicks play.
document.querySelectorAll('.tile-youtube').forEach(function (tile) {
  var videoId = tile.getAttribute('data-yt-id');
  var facade = tile.querySelector('.yt-facade');
  if (!videoId || !facade) return;

  var warmed = false;
  function warmConnection() {
    if (warmed) return;
    warmed = true;
    ['https://www.youtube-nocookie.com', 'https://i.ytimg.com'].forEach(function (origin) {
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      document.head.appendChild(link);
    });
  }
  // Warm the connection just before the click actually lands, so the
  // handshake overlaps with the person's click instead of happening after it.
  facade.addEventListener('pointerenter', warmConnection, { once: true });
  facade.addEventListener('touchstart', warmConnection, { once: true, passive: true });

  function playVideo() {
    var wrap = document.createElement('div');
    wrap.className = 'yt-embed';

    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    iframe.title = facade.getAttribute('aria-label') || 'YouTube video player';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'eager');

    wrap.appendChild(iframe);
    tile.innerHTML = '';
    tile.appendChild(wrap);
  }

  facade.addEventListener('click', playVideo);
});

// Lightbox
var lightbox = document.getElementById('lightbox');
var lightboxContent = document.getElementById('lightbox-content');
var lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src, isVideo) {
  lightboxContent.innerHTML = '';
  if (isVideo) {
    var v = document.createElement('video');
    v.src = src;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    lightboxContent.appendChild(v);
  } else {
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    lightboxContent.appendChild(img);
  }
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  var media = lightboxContent.querySelector('video');
  if (media) media.pause();
  setTimeout(function () { lightboxContent.innerHTML = ''; }, 300);
}

document.querySelectorAll('[data-lightbox]').forEach(function (el) {
  el.addEventListener('click', function () {
    var target = el.getAttribute('data-lightbox');
    if (target === 'video') {
      var src = el.querySelector('source').getAttribute('src');
      openLightbox(src, true);
    } else {
      openLightbox(target, false);
    }
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', function (e) {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
});

// Contact — copy email to clipboard
document.querySelectorAll('[data-copy]').forEach(function (btn) {
  var originalLabel = null;
  var textEl = btn.querySelector('.copy-chip-text');

  btn.addEventListener('click', function () {
    var value = btn.getAttribute('data-copy');

    function showCopied() {
      btn.classList.add('is-copied');
      if (textEl) {
        originalLabel = originalLabel || textEl.textContent;
        textEl.textContent = 'Copied!';
      } else if (originalLabel === null) {
        originalLabel = btn.textContent;
        btn.textContent = 'Copied!';
      }
      setTimeout(function () {
        btn.classList.remove('is-copied');
        if (textEl) {
          textEl.textContent = originalLabel;
        } else if (originalLabel !== null) {
          btn.textContent = originalLabel;
        }
      }, 1800);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(showCopied).catch(function () {
        fallbackCopy(value);
        showCopied();
      });
    } else {
      fallbackCopy(value);
      showCopied();
    }
  });
});

// FAQ accordion
(function () {
  var items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  items.forEach(function (item) {
    var btn = item.querySelector('.faq-question');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('is-open');

      items.forEach(function (other) {
        other.classList.remove('is-open');
        var otherBtn = other.querySelector('.faq-question');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

function fallbackCopy(text) {
  var tmp = document.createElement('textarea');
  tmp.value = text;
  tmp.style.position = 'fixed';
  tmp.style.opacity = '0';
  document.body.appendChild(tmp);
  tmp.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(tmp);
}
