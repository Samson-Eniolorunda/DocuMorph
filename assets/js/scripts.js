/* =========================================================
   DocuMorph — Main Frontend Logic (scripts.js)
   Author: Samson Eniolorunda
   ---------------------------------------------------------
   FIXES (Final Polish):
   - Resize Stats: Now shows "Original" stats immediately.
   - Resize Stats: "New" stats load asynchronously (doesn't block UI).
   - Crash Fix: Solved "null is not an object" crash on iOS.
   - Android Stuck: Uses latest Blob library for compatibility.
   - Logic: Prevents auto-download using background fetch.
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIG
  // =========================================================
  const DAILY_LIMIT = 5;
  const MAX_UPLOAD_MB = 50;

  // Error escalation
  const REJECT_ESCALATE_COUNT = 3;
  const MULTI_REJECT_ESCALATE = 2;

  // =========================================================
  // 2) APP STATE
  // =========================================================
  const appState = {
    view: "convert", // convert | compress | resize | merge
    subTool: "word-to-pdf",
    files: [],
    resultUrl: null,

    rejectCount: 0,

    // Stats capture
    originalStats: { size: 0, width: 0, height: 0 },
  };

  // Wallet addresses
  let CRYPTO_WALLETS = {
    btc: "Loading...",
    eth: "Loading...",
    bnb: "Loading...",
    sol: "Loading...",
    ton: "Loading...",
    tron: "Loading...",
    usdt_eth: "Loading...",
    usdt_bnb: "Loading...",
    usdt_trc: "Loading...",
    usdt_sol: "Loading...",
    usdt_ton: "Loading...",
    usdt_arb: "Loading...",
  };

  const donationState = { selectedKey: "btc" };

  // =========================================================
  // 3) DOM CACHE
  // =========================================================
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  const views = {
    convert: qs("#view-convert"),
    compress: qs("#view-compress"),
    resize: qs("#view-resize"),
    merge: qs("#view-merge"),
  };

  const dropZone = qs("#drop-zone");
  const fileInput = qs("#file-input");
  const fileLimits = qs("#file-limits");
  const fileNameDisplay = qs("#file-name-display");
  const dropError = qs("#drop-error");

  const uploadUI = qs("#upload-ui");
  const readyUI = qs("#ready-ui");
  const processUI = qs("#process-ui");
  const successUI = qs("#success-ui");

  const uploadBar = qs("#upload-bar");
  const uploadPercent = qs("#upload-percent");
  const processBar = qs("#process-bar");
  const processPercent = qs("#process-percent");

  const startBtn = qs("#start-btn");
  // Note: We do NOT cache .download-btn here anymore to avoid the "null" error

  const menuToggle = qs(".menu-toggle");
  const mobileMenu = qs("#mobile-menu");
  const modalContainer = qs("#modal-container");

  const walletInput = qs("#wallet-address");
  const copyFeedback = qs("#copy-feedback");
  const connectBtn = qs("#connect-wallet-btn");
  const qrBox = qs("#qr-container");
  const qrImg = qs("#crypto-qr");

  // =========================================================
  // 4) INIT
  // =========================================================
  initCustomDropdowns();
  initFileInputs();
  updateContext("convert", "word-to-pdf");
  fetchSecureWallets();
  updateRangeLabel();
  toggleCompMode();

  const yearEl = qs("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (connectBtn) {
    connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
    connectBtn.onclick = copyWallet;
  }

  // =========================================================
  // 5) EXPOSED HANDLERS
  // =========================================================
  window.switchView = switchView;
  window.toggleMenu = toggleMenu;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.resetApp = resetApp;
  window.executeProcess = executeProcess;
  window.toggleCompMode = toggleCompMode;
  window.updateRangeLabel = updateRangeLabel;
  window.toggleStartButton = toggleStartButton;
  window.copyWallet = copyWallet;
  window.submitToFormspree = submitToFormspree;

  // =========================================================
  // 6) UTILITIES
  // =========================================================
  function setText(el, text) {
    if (el) el.innerText = text;
  }

  function safeLowerText(el) {
    return (el?.innerText || "").trim().toLowerCase();
  }

  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  function getFileExt(file) {
    const name = file?.name || "";
    const parts = name.split(".");
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
    if (ext) return ext;
    const mime = (file?.type || "").toLowerCase();
    const map = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/msword": "doc",
    };
    return map[mime] || "";
  }

  function normalizeImageExt(ext) {
    const e = String(ext || "").toLowerCase();
    if (e === "jpeg") return "jpg";
    if (["jpg", "png", "webp", "tiff", "bmp"].includes(e)) return e;
    return "jpg";
  }

  function clampFileSize(files) {
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      showInlineDropError(`"${tooBig.name}" is above ${MAX_UPLOAD_MB}MB.`);
      return false;
    }
    return true;
  }

  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          URL.revokeObjectURL(url);
          resolve({ w, h });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Img Error"));
        };
        img.src = url;
      } catch (e) {
        reject(e);
      }
    });
  }

  function getSelectedScalePercent() {
    const label = (
      qs("#resize-scale-dropdown .trigger-text")?.innerText || ""
    ).trim();
    if (label.includes("75")) return 75;
    if (label.includes("50")) return 50;
    if (label.includes("25")) return 25;
    return 100;
  }

  function showInlineDropError(message) {
    if (!dropZone) return;
    if (dropError) {
      dropError.classList.remove("hidden");
      dropError.textContent = message;
    }
    dropZone.classList.remove("shake");
    // eslint-disable-next-line no-unused-expressions
    dropZone.offsetHeight;
    dropZone.classList.add("shake");
    setTimeout(() => {
      dropError?.classList.add("hidden");
      if (dropError) dropError.textContent = "";
    }, 3500);
  }

  function escalateIfNeeded(rejectedCount = 1) {
    appState.rejectCount += 1;
    if (
      rejectedCount >= MULTI_REJECT_ESCALATE ||
      appState.rejectCount >= REJECT_ESCALATE_COUNT
    ) {
      openModal("feedback");
    }
  }

  function isTypeAllowed(file) {
    if (!file) return false;
    const accept = (fileInput?.getAttribute("accept") || "*").trim();
    if (!accept || accept === "*") return true;

    const ext = getFileExt(file);
    const mime = (file.type || "").toLowerCase();
    const rules = accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return rules.some((r) => {
      if (r === "image/*") return mime.startsWith("image/");
      if (r.startsWith(".")) return `.${ext}` === r;
      return mime === r;
    });
  }

  function filterSupportedFiles(files) {
    const supported = [];
    const rejected = [];
    files.forEach((f) => {
      if (isTypeAllowed(f)) supported.push(f);
      else rejected.push(f);
    });
    return { supported, rejected };
  }

  // =========================================================
  // 7) HELPERS
  // =========================================================
  function toggleStartButton() {
    const checkbox = qs("#legal-check");
    if (!checkbox || !startBtn) return;
    if (checkbox.checked) {
      startBtn.classList.remove("disabled");
      startBtn.removeAttribute("disabled");
    } else {
      startBtn.classList.add("disabled");
      startBtn.setAttribute("disabled", "true");
    }
  }

  function getUsage() {
    const today = new Date().toLocaleDateString();
    let data = { date: today, count: 0 };
    try {
      data = JSON.parse(localStorage.getItem("documorph_usage")) || data;
      if (data.date !== today) data = { date: today, count: 0 };
    } catch (_) {}
    return data;
  }

  function checkDailyLimit() {
    const d = getUsage();
    if (d.count >= DAILY_LIMIT) {
      alert("Daily limit reached! Please try again tomorrow.");
      return false;
    }
    return true;
  }

  function incrementUsage() {
    const d = getUsage();
    d.count += 1;
    try {
      localStorage.setItem("documorph_usage", JSON.stringify(d));
    } catch (_) {}
  }

  function toggleMenu() {
    if (menuToggle) menuToggle.classList.toggle("open");
    if (mobileMenu) mobileMenu.classList.toggle("active");
  }

  function switchView(viewName) {
    appState.view = viewName;
    qsa(".nav-btn").forEach((b) =>
      b.classList.toggle("active", safeLowerText(b) === viewName),
    );
    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    if (views[viewName]) views[viewName].classList.remove("hidden");
    resetApp();
    const firstOption = views[viewName]?.querySelector(".option");
    updateContext(
      viewName,
      firstOption ? firstOption.getAttribute("data-value") : null,
    );
    if (viewName === "compress") {
      toggleCompMode();
      updateRangeLabel();
    }
  }

  function openModal(type) {
    qsa(".modal-body").forEach((el) => el.classList.add("hidden"));
    const target = qs(`#modal-${type}`);
    if (target) target.classList.remove("hidden");
    if (modalContainer) modalContainer.classList.remove("hidden");
  }

  function closeModal() {
    if (modalContainer) modalContainer.classList.add("hidden");
  }

  async function submitToFormspree(e) {
    e.preventDefault();
    const status = qs("#form-status");
    const data = Object.fromEntries(new FormData(e.target).entries());
    setText(status, "Sending...");
    try {
      const r = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setText(status, r.ok ? "Thanks! Message sent." : "Oops! Server error.");
      if (r.ok) e.target.reset();
    } catch (_) {
      setText(status, "Network Error.");
    }
  }

  function updateContext(view, val) {
    if (!val) {
      if (view === "convert") val = "word-to-pdf";
      if (view === "compress") val = "comp-pdf";
      if (view === "resize") val = "resize-img";
      if (view === "merge") val = "merge-pdf";
    }
    appState.subTool = val;

    let accept = "*";
    let limitText = "Files";

    if (view === "convert") {
      switch (val) {
        case "word-to-pdf":
          accept =
            ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          limitText = "Word Docs";
          break;
        case "pdf-to-word":
          accept = ".pdf";
          limitText = "PDF Files";
          break;
        case "excel-to-pdf":
          accept = ".xls,.xlsx";
          limitText = "Excel Sheets";
          break;
        case "pdf-to-excel":
          accept = ".pdf";
          limitText = "PDF Files";
          break;
        case "jpg-to-png":
          accept = "image/jpeg,image/jpg";
          limitText = "JPG Images";
          break;
        case "png-to-jpg":
          accept = "image/png";
          limitText = "PNG Images";
          break;
        default:
          accept = "*";
          limitText = "Files";
      }
    } else if (view === "compress") {
      if (val === "comp-pdf") {
        accept = ".pdf";
        limitText = "PDF Files";
      } else {
        accept = "image/jpeg,image/png,image/webp,image/bmp,image/tiff";
        limitText = "Images";
      }
    } else if (view === "resize") {
      accept = "image/jpeg,image/png,image/webp,image/bmp,image/tiff";
      limitText = "Images";
    } else if (view === "merge") {
      accept = ".pdf";
      limitText = "PDF Files";
    }

    if (fileInput) fileInput.setAttribute("accept", accept);
    if (fileLimits)
      fileLimits.innerText = `Supported: ${limitText} • Max ${MAX_UPLOAD_MB}MB`;
    dropError?.classList.add("hidden");
    if (dropError) dropError.textContent = "";
  }

  function initFileInputs() {
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const chosen = Array.from(fileInput.files || []);
        if (!chosen.length) return;
        const { supported, rejected } = filterSupportedFiles(chosen);
        if (rejected.length) {
          showInlineDropError(
            `Not supported: ${rejected.map((f) => f.name).join(", ")}`,
          );
          escalateIfNeeded(rejected.length);
          fileInput.value = "";
          return;
        }
        handleFiles(supported, { source: "choose" });
      });
    }
    if (dropZone) {
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--primary)";
        dropZone.style.background = "#e0e7ff";
      });
      dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#cbd5e1";
        dropZone.style.background = "rgba(255,255,255,0.6)";
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#cbd5e1";
        dropZone.style.background = "rgba(255,255,255,0.6)";
        const dropped = Array.from(e.dataTransfer?.files || []);
        if (!dropped.length) return;
        const { supported, rejected } = filterSupportedFiles(dropped);
        if (rejected.length) {
          showInlineDropError(
            `Not supported: ${rejected.map((f) => f.name).join(", ")}`,
          );
          escalateIfNeeded(rejected.length);
        }
        if (!supported.length) return;
        handleFiles(supported, { source: "drop" });
      });
    }
  }

  function handleFiles(files) {
    if (!files.length) return;
    if (!clampFileSize(files)) {
      if (fileInput) fileInput.value = "";
      escalateIfNeeded(1);
      return;
    }
    appState.files = appState.view === "merge" ? files : [files[0]];
    appState.rejectCount = 0;

    dropZone?.classList.add("hidden");
    uploadUI?.classList.remove("hidden");

    let w = 0;
    const timer = setInterval(() => {
      w += 5;
      if (uploadBar) uploadBar.style.width = `${w}%`;
      if (uploadPercent) uploadPercent.innerText = `${w}%`;
      if (w >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          uploadUI?.classList.add("hidden");
          showReadyScreen();
        }, 250);
      }
    }, 15);
  }

  function showReadyScreen() {
    readyUI?.classList.remove("hidden");
    if (fileNameDisplay) {
      const f = appState.files[0];
      let infoText = "";

      if (f) {
        if (appState.view === "compress") {
          infoText = ` (${formatBytes(f.size)})`;
        } else if (appState.view === "resize") {
          // Calculate dims immediately for display
          getImageDimensions(f)
            .then(({ w, h }) => {
              if (appState.view === "resize" && appState.files[0] === f) {
                fileNameDisplay.innerText = f.name + ` (${w} x ${h} px)`;
              }
            })
            .catch(() => {});
        }
      }

      fileNameDisplay.innerText =
        appState.files.length === 1
          ? appState.files[0].name + infoText
          : `${appState.files.length} files selected`;
    }
    let actionText = "Start";
    if (appState.view === "convert") actionText = "Convert Now";
    if (appState.view === "compress") actionText = "Compress Now";
    if (appState.view === "resize") actionText = "Resize Now";
    if (appState.view === "merge") actionText = "Merge PDFs";
    if (startBtn) startBtn.innerText = actionText;
  }

  function resetApp() {
    uploadUI?.classList.add("hidden");
    readyUI?.classList.add("hidden");
    processUI?.classList.add("hidden");
    successUI?.classList.add("hidden");
    dropZone?.classList.remove("hidden");
    appState.files = [];
    appState.resultUrl = null;
    if (fileInput) fileInput.value = "";
    if (uploadBar) uploadBar.style.width = "0%";
    if (uploadPercent) uploadPercent.innerText = "0%";
    if (processBar) processBar.style.width = "0%";
    if (processPercent) processPercent.innerText = "0%";
    dropError?.classList.add("hidden");
    if (dropError) dropError.textContent = "";
    const wrapper = qs("#preview-wrapper");
    if (wrapper) wrapper.classList.add("hidden");
    const legal = qs("#legal-check");
    if (legal) legal.checked = false;
    toggleStartButton();
  }

  function toggleCompMode() {
    const mode = qs('input[name="comp-mode"]:checked')?.value;
    const autoBox = qs("#comp-auto-settings");
    const targetBox = qs("#comp-target-settings");
    if (!mode || !autoBox || !targetBox) return;
    if (mode === "auto") {
      autoBox.classList.remove("hidden");
      targetBox.classList.add("hidden");
    } else {
      autoBox.classList.add("hidden");
      targetBox.classList.remove("hidden");
    }
  }

  function updateRangeLabel() {
    const labels = [
      "Smallest",
      "Small",
      "Compact",
      "Balanced",
      "Balanced",
      "Better",
      "Good",
      "Great",
      "Best Quality",
    ];
    const v = Number(qs("#compression-range")?.value || 5);
    const out = qs("#compression-text");
    if (out) out.innerText = labels[v - 1] || "Balanced";
  }

  async function executeProcess() {
    if (!checkDailyLimit()) return;
    readyUI?.classList.add("hidden");
    processUI?.classList.remove("hidden");
    const title = qs("#process-title");
    if (title) title.innerText = "Processing...";

    appState.originalStats = {
      size: appState.files[0]?.size || 0,
      width: 0,
      height: 0,
    };

    if (appState.view === "resize" && appState.files[0]) {
      try {
        const dims = await getImageDimensions(appState.files[0]);
        appState.originalStats.width = dims.w;
        appState.originalStats.height = dims.h;
      } catch (e) {
        console.log("Dims error", e);
      }
    }

    try {
      await processFilesWithProxy();
    } catch (e) {
      console.error(e);
      alert("Processing failed. Please try again.");
      resetApp();
    }
  }

  function showSuccess(fileData) {
    processUI?.classList.add("hidden");
    successUI?.classList.remove("hidden");

    const filename = fileData.FileName;
    const newSize = fileData.FileSize;
    const url = appState.resultUrl;

    const oldBtn = qs(".download-btn");
    if (oldBtn && oldBtn.parentNode) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(newBtn, oldBtn);

      newBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename || "documorph-output";
        link.target = "_blank";
        link.click();
      };
    }

    const wrapper = qs("#preview-wrapper");
    const fnameEl = qs("#stats-filename");
    const compBox = qs("#stats-compression");
    const resizeBox = qs("#stats-resize");

    wrapper.classList.remove("hidden");
    compBox.classList.add("hidden");
    resizeBox.classList.add("hidden");

    const imgEl = qs("#preview-img");
    const pdfEl = qs("#preview-pdf");
    if (imgEl) imgEl.classList.add("hidden");
    if (pdfEl) pdfEl.classList.add("hidden");

    if (fnameEl) fnameEl.textContent = filename;

    const ext = String(filename).split(".").pop().toLowerCase();
    const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);

    // FIXED: Show stats box immediately with "Original" data, load "New" async
    if (isImg && appState.view === "resize") {
      resizeBox.classList.remove("hidden");
      const loading = qs("#resize-loading");
      const dataRow = qs("#resize-data");

      // Setup initial display with known Original
      loading.classList.remove("hidden"); // Shows "Calculating..."
      dataRow.classList.add("hidden");

      // Fill original immediately
      qs("#resize-old").textContent =
        `${appState.originalStats.width} x ${appState.originalStats.height} px`;

      fetch(url)
        .then((res) => res.blob())
        .then((blob) => {
          const tempImg = new Image();
          const objectUrl = URL.createObjectURL(blob);
          tempImg.onload = () => {
            loading.classList.add("hidden");
            dataRow.classList.remove("hidden");
            qs("#resize-new").textContent =
              `${tempImg.naturalWidth} x ${tempImg.naturalHeight} px`;
            URL.revokeObjectURL(objectUrl);
          };
          tempImg.src = objectUrl;
        })
        .catch((e) => {
          console.log("Stats load failed", e);
          loading.textContent = "See download for new size";
        });
    }

    if (appState.view === "compress") {
      compBox.classList.remove("hidden");
      const oldS = appState.originalStats.size;
      const saved = oldS - newSize;
      const savedPct = Math.round((saved / oldS) * 100);
      qs("#comp-old").textContent = formatBytes(oldS);
      qs("#comp-new").textContent = formatBytes(newSize);
      const msg =
        saved > 0
          ? `Saved ${formatBytes(saved)} (${savedPct}%)!`
          : "Already optimized!";
      qs("#comp-saved").textContent = msg;
    }
  }

  // =========================================================
  // LOGIC
  // =========================================================
  async function buildConvertTypeAndParams(file) {
    const ext = getFileExt(file);
    let type = "";
    const params = {};

    if (appState.view === "convert") {
      if (appState.subTool === "word-to-pdf")
        type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
      else if (appState.subTool === "pdf-to-word") type = "pdf/to/docx";
      else if (appState.subTool === "excel-to-pdf")
        type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
      else if (appState.subTool === "pdf-to-excel") type = "pdf/to/xlsx";
      else if (appState.subTool === "jpg-to-png") type = "jpg/to/png";
      else if (appState.subTool === "png-to-jpg") type = "png/to/jpg";
    }

    if (appState.view === "compress") {
      const mode = qs('input[name="comp-mode"]:checked')?.value || "auto";
      if (appState.subTool === "comp-pdf") {
        type = "pdf/to/compress";
        if (mode === "auto") {
          const s = Number(qs("#compression-range")?.value || 5);
          if (s <= 3) params.Preset = "screen";
          else if (s <= 6) params.Preset = "ebook";
          else params.Preset = "printer";
        } else {
          params.Preset = "ebook";
        }
      } else {
        const imgExt = normalizeImageExt(ext);
        type = `${imgExt}/to/compress`;
        if (mode === "auto") {
          const s = Number(qs("#compression-range")?.value || 5);
          if (imgExt === "jpg")
            params.Quality = String(Math.max(10, Math.min(95, s * 10)));
          if (s <= 3) params.Preset = "screen";
          else if (s <= 6) params.Preset = "ebook";
          else params.Preset = "printer";
        } else {
          const sizeVal = Number(qs("#target-size-input")?.value || 0);
          const unit = (
            qs("#size-unit-dropdown .trigger-text")?.textContent || "MB"
          )
            .trim()
            .toUpperCase();
          if (sizeVal > 0) {
            const sizeKb =
              unit === "MB" ? Math.round(sizeVal * 1024) : Math.round(sizeVal);
            params.CompressionFileSize = String(sizeKb);
          }
          params.Preset = "screen";
        }
      }
    }

    if (appState.view === "resize") {
      const imgExt = normalizeImageExt(ext);
      type = `${imgExt}/to/${imgExt}`;
      const wRaw = (qs("#resize-w")?.value || "").trim();
      const hRaw = (qs("#resize-h")?.value || "").trim();
      if (wRaw || hRaw) {
        if (wRaw) params.ImageWidth = wRaw;
        if (hRaw) params.ImageHeight = hRaw;
      } else {
        const pct = getSelectedScalePercent();
        if (pct !== 100) {
          const { w, h } = await getImageDimensions(file);
          const newW = Math.max(1, Math.round((w * pct) / 100));
          const newH = Math.max(1, Math.round((h * pct) / 100));
          params.ImageWidth = String(newW);
          params.ImageHeight = String(newH);
        }
      }
    }

    if (appState.view === "merge") type = "pdf/to/merge";
    return { type, params };
  }

  function setProcessProgress(pct) {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    if (processBar) processBar.style.width = `${p}%`;
    if (processPercent) processPercent.innerText = `${p}%`;
  }

  function isIOSDevice() {
    return (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function guessMimeFromName(name = "") {
    const ext = String(name).split(".").pop()?.toLowerCase() || "";
    const map = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    return map[ext] || "application/octet-stream";
  }

  function withTimeout(promise, ms, label = "Operation") {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    });
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
  }

  // iOS Native Upload - Uses XMLHttpRequest for maximum compatibility
  async function uploadToServerDirect(
    file,
    progressOffset = 0,
    progressSpan = 70,
  ) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      const safeName = String(file?.name || "upload.bin").replace(
        /[^a-z0-9_.-]/gi,
        "_",
      );
      const mime = file?.type || guessMimeFromName(safeName);

      // Create a proper File object for iOS
      let uploadFile;
      try {
        uploadFile = new File([file], safeName, { type: mime });
      } catch (e) {
        // Fallback for older iOS that doesn't support File constructor
        uploadFile = file;
      }

      formData.append("file", uploadFile, safeName);

      xhr.open("POST", "/api/native-upload", true);

      // Progress tracking
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = (e.loaded / e.total) * 100;
          const scaled = progressOffset + (pct * progressSpan) / 100;
          setProcessProgress(scaled);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.url) {
              setProcessProgress(progressOffset + progressSpan);
              resolve({ url: response.url, raw: response });
            } else {
              reject(
                new Error(response.error || "Upload failed - no URL returned"),
              );
            }
          } catch (e) {
            reject(new Error("Invalid server response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.timeout = 180000; // 3 minutes

      xhr.send(formData);
    });
  }

  async function uploadToBlob(file, progressOffset = 0, progressSpan = 70) {
    const ios = isIOSDevice();

    // iOS: Use native XMLHttpRequest upload (bypasses @vercel/blob issues)
    if (ios) {
      console.log("[Upload] iOS detected - using native upload");
      return uploadToServerDirect(file, progressOffset, progressSpan);
    }

    // Non-iOS: Use standard Vercel Blob client
    const { upload } = await import("https://esm.sh/@vercel/blob/client");

    const safeName = String(file?.name || "upload.bin").replace(
      /[^a-z0-9_.-]/gi,
      "_",
    );
    const pathname = `uploads/${Date.now()}-${safeName}`;
    const multipartDecision = file.size > 4.5 * 1024 * 1024;

    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const uploadPromise = upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          multipart: multipartDecision,
          onUploadProgress: ({ percentage } = {}) => {
            const pct = Number(percentage);
            if (!Number.isFinite(pct)) return;
            const scaled = progressOffset + (pct * progressSpan) / 100;
            setProcessProgress(scaled);
          },
        });
        const result = await withTimeout(uploadPromise, 180000, "BlobUpload");
        if (!result || !(result.url || result?.blob?.url))
          throw new Error("Invalid upload result");
        const url = result.url || result?.blob?.url;
        setProcessProgress(progressOffset + progressSpan);
        return { url, raw: result };
      } catch (err) {
        console.error(`[uploadToBlob] attempt ${attempt} failed:`, err);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`Blob upload failed: ${err?.message || err}`);
      }
    }
  }

  async function processFilesWithProxy() {
    try {
      const first = appState.files[0];
      if (!first) throw new Error("No file selected");
      setProcessProgress(0);

      let fileUrls = [];
      if (appState.view === "merge") {
        const step = appState.files.length ? 70 / appState.files.length : 70;
        for (let i = 0; i < appState.files.length; i++) {
          const blob = await uploadToBlob(appState.files[i], i * step, step);
          fileUrls.push(blob.url);
        }
      } else {
        const blob = await uploadToBlob(first, 0, 70);
        fileUrls = [blob.url];
      }

      const { type, params } = await buildConvertTypeAndParams(first);
      if (!type) throw new Error("Tool type not recognized");

      setProcessProgress(75);
      const ramp = setInterval(() => {
        const current =
          Number(processPercent?.innerText?.replace("%", "")) || 75;
        if (current < 92) setProcessProgress(current + 1);
      }, 180);

      const convertTimeout = isIOSDevice() ? 300000 : 180000;
      const convertBody = {
        fileUrl: appState.view === "merge" ? null : fileUrls[0],
        files: appState.view === "merge" ? fileUrls : null,
        params,
        storeFile: true,
      };

      const convertPromise = fetch(
        `/api/convert?type=${encodeURIComponent(type)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(convertBody),
        },
      );

      const resp = await withTimeout(convertPromise, convertTimeout, "Convert");
      clearInterval(ramp);

      const rawText = await resp.text().catch(() => null);
      if (!resp.ok) {
        let parsed;
        try {
          parsed = rawText ? JSON.parse(rawText) : null;
        } catch (e) {}
        alert(
          `Conversion failed (HTTP ${resp.status}).\n\n${parsed?.error || "Error"}`,
        );
        resetApp();
        throw new Error("Convert failed");
      }

      const d = JSON.parse(rawText || "{}");
      if (d?.Files?.length) {
        setProcessProgress(100);
        appState.resultUrl = d.Files[0].Url;
        incrementUsage();
        showSuccess(d.Files[0]);
        return d;
      }
      throw new Error("No file in response");
    } catch (err) {
      alert(err.message || "Processing failed. Please try again.");
      resetApp();
      throw err;
    }
  }

  // =========================================================
  // DROPDOWNS & WALLETS (Unchanged Logic)
  // =========================================================
  function initCustomDropdowns() {
    const dropdowns = qsa(".custom-select");
    dropdowns.forEach((dd) => {
      const trigger = dd.querySelector(".select-trigger");
      const triggerText = dd.querySelector(".trigger-text");
      const options = dd.querySelectorAll(".option");
      const toggle = () => {
        const isOpen = dd.classList.contains("open");
        dropdowns.forEach((d) => d.classList.remove("open"));
        if (!isOpen) dd.classList.add("open");
      };
      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });
      dd.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });
      options.forEach((opt) => {
        opt.setAttribute("tabindex", "0");
        const select = () => {
          const val = opt.getAttribute("data-value");
          if (!val) return;
          if (dd.id === "crypto-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            const usdtGroup = qs("#usdt-network-group");
            if (val === "usdt") {
              usdtGroup?.classList.remove("hidden");
              updateWalletDisplay("usdt-eth");
            } else {
              usdtGroup?.classList.add("hidden");
              updateWalletDisplay(val);
            }
            dd.classList.remove("open");
            dd.focus();
            return;
          }
          if (dd.id === "network-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateWalletDisplay(val);
            dd.classList.remove("open");
            dd.focus();
            return;
          }
          if (dd.id === "size-unit-dropdown") {
            if (triggerText) triggerText.textContent = val;
            dd.classList.remove("open");
            dd.focus();
            return;
          }
          if (dd.id === "resize-scale-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            dd.classList.remove("open");
            dd.focus();
            return;
          }
          if (dd.id === "feedback-category-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            const hidden = qs("#feedback-category");
            if (hidden) hidden.value = val;
            dd.classList.remove("open");
            dd.focus();
            return;
          }
          if (triggerText) triggerText.innerHTML = opt.innerHTML;
          updateContext(appState.view, val);
          dd.classList.remove("open");
          dd.focus();
          if (appState.view === "compress") {
            toggleCompMode();
            updateRangeLabel();
          }
        };
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          select();
        });
        opt.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            select();
          }
        });
      });
    });
    window.addEventListener("click", () => {
      qsa(".custom-select").forEach((d) => d.classList.remove("open"));
    });
  }

  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets", { cache: "no-store" });
      if (!response.ok) return;
      CRYPTO_WALLETS = await response.json();
      updateWalletDisplay("btc");
    } catch (e) {}
  }

  function mapWalletAddressForKey(key) {
    if (key === "btc") return CRYPTO_WALLETS.btc;
    if (key === "eth") return CRYPTO_WALLETS.eth;
    if (key === "bnb") return CRYPTO_WALLETS.bnb;
    if (key === "sol") return CRYPTO_WALLETS.sol;
    if (key === "ton") return CRYPTO_WALLETS.ton;
    if (key === "tron") return CRYPTO_WALLETS.tron;
    if (key === "usdt-eth") return CRYPTO_WALLETS.usdt_eth;
    if (key === "usdt-bnb") return CRYPTO_WALLETS.usdt_bnb;
    if (key === "usdt-trc") return CRYPTO_WALLETS.usdt_trc;
    if (key === "usdt-sol") return CRYPTO_WALLETS.usdt_sol;
    if (key === "usdt-ton") return CRYPTO_WALLETS.usdt_ton;
    if (key === "usdt-arb") return CRYPTO_WALLETS.usdt_arb;
    return "Address Not Set";
  }

  function updateWalletDisplay(key) {
    donationState.selectedKey = key;
    const address = mapWalletAddressForKey(key) || "Address Not Set";
    if (walletInput) walletInput.value = address;
    if (
      qrBox &&
      qrImg &&
      address !== "Address Not Set" &&
      address !== "Loading..."
    ) {
      qrBox.classList.remove("hidden");
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}`;
    } else {
      qrBox?.classList.add("hidden");
    }
    if (connectBtn) {
      connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
      connectBtn.onclick = copyWallet;
    }
  }

  function copyWallet() {
    if (!walletInput) return;
    const value = walletInput.value;
    if (!value || value === "Loading...") return;
    navigator.clipboard?.writeText(value).catch(() => {
      walletInput.select();
      walletInput.setSelectionRange(0, 99999);
      document.execCommand("copy");
    });
    if (copyFeedback) {
      copyFeedback.classList.add("visible");
      setTimeout(() => copyFeedback.classList.remove("visible"), 2000);
    }
  }
})();
