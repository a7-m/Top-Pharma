// Content Protection Helpers

function enableContentProtection(options = {}) {
  const {
    userName = "",
    userPhone = "",
    targetId = null,
    blockContextMenu = true,
    blockKeys = true,
    blockSelection = true,
    enableDevToolsDetection = true,
  } = options;

  if (blockSelection) {
    document.body.classList.add("content-protected");
  }

  if (blockContextMenu) {
    // Enhanced right-click protection
    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }, true);

    // Prevent drag and drop
    document.addEventListener("dragstart", (event) => {
      event.preventDefault();
      return false;
    });

    // Prevent select all
    document.addEventListener("selectstart", (event) => {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        return false;
      }
    });
  }

  if (blockKeys) {
    document.addEventListener("keydown", (event) => {
      const key = event.key?.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;

      // Block common shortcuts
      const blockedCombos =
        ctrl &&
        (key === "s" ||  // Save
          key === "p" ||  // Print
          key === "u" ||  // View Source
          key === "c" ||  // Copy
          key === "x" ||  // Cut
          key === "a" ||  // Select All
          key === "i" ||  // Inspect
          key === "j");   // Console

      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      const devToolsKeys = 
        key === "f12" ||
        (ctrl && shift && (key === "i" || key === "j" || key === "c"));

      const captureCombo =
        (ctrl && shift && key === "s") ||  // Screenshot
        (event.metaKey && shift && key === "s");

      if (blockedCombos || captureCombo || devToolsKeys || key === "printscreen") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof showToast === "function") {
          showToast("التنزيل أو النسخ غير مسموح لهذا المحتوى", "error");
        }
        return false;
      }
    }, true);
  }

  // DevTools Detection
  if (enableDevToolsDetection) {
    detectDevTools();
  }

  if (targetId && (userName || userPhone)) {
    const target = document.getElementById(targetId);
    if (!target) return;

    if (!target.classList.contains("content-protected-container")) {
      target.classList.add("content-protected-container");
    }

    if (target.querySelector(".content-protection-layer")) return;

    const layer = document.createElement("div");
    layer.className = "content-protection-layer";

    // Create name watermark
    if (userName) {
      const nameWatermark = document.createElement("div");
      nameWatermark.className = "content-watermark content-watermark-name";
      nameWatermark.textContent = userName;
      layer.appendChild(nameWatermark);
    }

    // Create phone watermark
    if (userPhone) {
      const phoneWatermark = document.createElement("div");
      phoneWatermark.className = "content-watermark content-watermark-phone";
      phoneWatermark.textContent = userPhone;
      layer.appendChild(phoneWatermark);
    }

    target.appendChild(layer);
  }
}

/**
 * DevTools Detection
 * Attempts to detect if developer tools are open
 */
function detectDevTools() {
  let devToolsOpen = false;
  const threshold = 160; // Threshold for detecting devtools

  // Method 1: Console monitoring
  const consoleCheck = setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        handleDevToolsDetected();
      }
    } else {
      devToolsOpen = false;
    }
  }, 1000);

  // Method 2: Debugger trap
  setInterval(() => {
    const start = performance.now();
    // debugger; // Uncomment in production if you want aggressive detection
    const end = performance.now();
    if (end - start > 100) {
      handleDevToolsDetected();
    }
  }, 1000);

  // Method 3: toString override detection
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function() {
      handleDevToolsDetected();
      return 'devtools-detector';
    }
  });
  // console.log(element); // Uncomment for aggressive detection
}

/**
 * Handle DevTools Detection
 */
function handleDevToolsDetected() {
  if (typeof showToast === 'function') {
    showToast('⚠️ تم اكتشاف أدوات المطور. المحتوى محمي.', 'warning');
  }
  
  // Optional: Blur sensitive content
  const sensitiveElements = document.querySelectorAll('.content-protected');
  sensitiveElements.forEach(el => {
    el.style.filter = 'blur(10px)';
  });

  // Optional: Redirect or disable functionality
  // setTimeout(() => {
  //   window.location.href = '/';
  // }, 2000);
}

function applyVideoElementProtection(videoElement) {
  if (!videoElement) return;
  videoElement.setAttribute(
    "controlsList",
    "nodownload noplaybackrate noremoteplayback",
  );
  videoElement.setAttribute("disablePictureInPicture", "");
  videoElement.setAttribute("oncontextmenu", "return false");
}

function enableScreenCaptureDetection(options = {}) {
  const { threshold = 3, cooldownMs = 800, onAttempt, onThreshold } = options;

  let attempts = 0;
  let lastAttemptAt = 0;
  let locked = false;

  const recordAttempt = (reason) => {
    if (locked) return;
    const now = Date.now();
    if (now - lastAttemptAt < cooldownMs) return;
    lastAttemptAt = now;
    attempts += 1;

    if (typeof onAttempt === "function") {
      onAttempt({ attempts, threshold, reason });
    }

    if (attempts >= threshold) {
      locked = true;
      if (typeof onThreshold === "function") {
        onThreshold({ attempts, threshold, reason });
      }
    }
  };

  window.addEventListener("blur", () => recordAttempt("blur"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      recordAttempt("visibility");
    }
  });

  return {
    getAttempts: () => attempts,
    reset: () => {
      attempts = 0;
      lastAttemptAt = 0;
      locked = false;
    },
  };
}
