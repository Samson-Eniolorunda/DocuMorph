/* =========================================================
   DocuMorph — Main Frontend Logic (scripts.js)
   Author: Samson Eniolorunda
   ---------------------------------------------------------
   Updated:
   - Feedback menu label + modal title: "Feedback" / "Feedback & Requests"
   - Strict "supported file only" validation for BOTH choose-file + drag-drop
   - Inline drop-zone error text + escalation modal on repeated mistakes
   - Resize Scale % fixed (no 404): reads original size in browser and sends px
   
   NEW UPDATES:
   - iOS Fix: Pinned @vercel/blob version + slice() fix for Safari
   - Early Stats: Show file size on "Ready" screen (Compress/Resize only)
   - Preview/Stats: Show Before/After + Preview on "Success" screen
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIG
  // =========================================================
  const DAILY_LIMIT = 5;
  const MAX_UPLOAD_MB = 50;

  // Error escalation
  const REJECT_ESCALATE_COUNT = 3; // show modal after repeated invalid attempts
  const MULTI_REJECT_ESCALATE = 2; // show modal when multiple files rejected at once

  // =========================================================
  // 2) APP STATE
  // =========================================================
  const appState = {
    view: "convert", // convert | compress | resize | merge
    subTool: "word-to-pdf",
    files: [],
    resultUrl: null,

    rejectCount: 0, // repeated invalid attempts

    // NEW: Capture stats before upload for comparison
    originalStats: { size: 0, width: 0, height: 0 },
  };

  // Wallet addresses returned from /api/wallets
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

  // File UI
  const dropZone = qs("#drop-zone");
  const fileInput = qs("#file-input");
  const fileLimits = qs("#file-limits");
  const fileNameDisplay = qs("#file-name-display");
  const dropError = qs("#drop-error"); // inline message inside drop zone

  const uploadUI = qs("#upload-ui");
  const readyUI = qs("#ready-ui");
  const processUI = qs("#process-ui");
  const successUI = qs("#success-ui");

  const uploadBar = qs("#upload-bar");
  const uploadPercent = qs("#upload-percent");
  const processBar = qs("#process-bar");
  const processPercent = qs("#process-percent");

  const startBtn = qs("#start-btn");
  const downloadBtn = qs(".download-btn");

  // Menu
  const menuToggle = qs(".menu-toggle");
  const mobileMenu = qs("#mobile-menu");

  // Modals
  const modalContainer = qs("#modal-container");

  // Wallet UI (COPY-ONLY)
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
  // 5) EXPOSED HANDLERS (inline onclick in HTML)
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

  // NEW: Helper to format bytes to readable text
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
      "image/bmp": "bmp",
      "image/tiff": "tiff",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/vnd.ms-excel": "xls",
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
      showInlineDropError(
        `"${tooBig.name}" is above ${MAX_UPLOAD_MB}MB. Please upload a smaller file.`
      );
      return false;
    }
    return true;
  }

  // read original image dimensions locally in browser (you asked who reads it: the website/browser does)
  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          URL.revokeObjectURL(url);
          if (!w || !h) return reject(new Error("Could not read image size"));
          resolve({ w, h });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read image size"));
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
    if (label.includes("100")) return 100;
    return 100;
  }

  function showInlineDropError(message) {
    if (!dropZone) return;

    if (dropError) {
      dropError.classList.remove("hidden");
      dropError.textContent = message;
    }

    // shake feedback
    dropZone.classList.remove("shake");
    // force reflow so animation restarts
    // eslint-disable-next-line no-unused-expressions
    dropZone.offsetHeight;
    dropZone.classList.add("shake");

    // auto-hide after a bit
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
      // Use your existing modal system - show Feedback modal to report/learn
      openModal("feedback");
    }
  }

  function isTypeAllowed(file) {
    if (!file) return false;

    // accept attribute is our single source of truth
    const accept = (fileInput?.getAttribute("accept") || "*").trim();
    if (!accept || accept === "*") return true;

    const ext = getFileExt(file);
    const mime = (file.type || "").toLowerCase();

    const rules = accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // handle patterns: ".pdf", "image/*", "image/png", "image/jpeg"
    return rules.some((r) => {
      if (r === "image/*") return mime.startsWith("image/");
      if (r.startsWith(".")) return `.${ext}` === r;
      // mime exact
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
  // 7) LEGAL CLICKWRAP
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

  // =========================================================
  // 8) DAILY LIMIT
  // =========================================================
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

  // =========================================================
  // 9) NAV + MENU
  // =========================================================
  function toggleMenu() {
    if (menuToggle) menuToggle.classList.toggle("open");
    if (mobileMenu) mobileMenu.classList.toggle("active");
  }

  function switchView(viewName) {
    appState.view = viewName;

    qsa(".nav-btn").forEach((b) => {
      b.classList.toggle("active", safeLowerText(b) === viewName);
    });

    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    if (views[viewName]) views[viewName].classList.remove("hidden");

    resetApp();

    const firstOption = views[viewName]?.querySelector(".option");
    updateContext(
      viewName,
      firstOption ? firstOption.getAttribute("data-value") : null
    );

    if (viewName === "compress") {
      toggleCompMode();
      updateRangeLabel();
    }
  }

  // =========================================================
  // 10) MODALS
  // =========================================================
  function openModal(type) {
    qsa(".modal-body").forEach((el) => el.classList.add("hidden"));
    const target = qs(`#modal-${type}`);
    if (target) target.classList.remove("hidden");
    if (modalContainer) modalContainer.classList.remove("hidden");
  }

  function closeModal() {
    if (modalContainer) modalContainer.classList.add("hidden");
  }

  // =========================================================
  // 11) FORM (POST -> /api/form)
  // =========================================================
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

      if (r.ok) {
        setText(status, "Thanks! Message sent.");
        e.target.reset();
      } else {
        setText(status, "Oops! Server error.");
      }
    } catch (_) {
      setText(status, "Network Error.");
    }
  }

  // =========================================================
  // 12) TOOL CONTEXT (accept + label)
  // =========================================================
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
          accept = ".doc,.docx";
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
        limitText = "JPG/PNG/WebP Images";
      }
    } else if (view === "resize") {
      accept = "image/jpeg,image/png,image/webp,image/bmp,image/tiff";
      limitText = "JPG/PNG/WebP Images";
    } else if (view === "merge") {
      accept = ".pdf";
      limitText = "PDF Files";
    }

    if (fileInput) fileInput.setAttribute("accept", accept);
    if (fileLimits)
      fileLimits.innerText = `Supported: ${limitText} • Max ${MAX_UPLOAD_MB}MB`;

    // clear old error
    dropError?.classList.add("hidden");
    if (dropError) dropError.textContent = "";
  }

  // =========================================================
  // 13) FILE INPUT + DRAG & DROP
  // =========================================================
  function initFileInputs() {
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const chosen = Array.from(fileInput.files || []);
        if (!chosen.length) return;

        // CHOOSE FILE: strictly enforce supported ONLY
        const { supported, rejected } = filterSupportedFiles(chosen);

        if (rejected.length) {
          // On choose-file, browsers may still allow; we hard-reject and reset input
          showInlineDropError(
            `Not supported: ${rejected.map((f) => f.name).join(", ")}`
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

        // DRAG & DROP: show inline "not supported" for rejected; keep supported (if any)
        const { supported, rejected } = filterSupportedFiles(dropped);

        if (rejected.length) {
          showInlineDropError(
            `Not supported: ${rejected.map((f) => f.name).join(", ")}`
          );
          escalateIfNeeded(rejected.length);
        }

        if (!supported.length) return;

        handleFiles(supported, { source: "drop" });
      });
    }
  }

  function handleFiles(files, meta = { source: "drop" }) {
    if (!files.length) return;

    if (!clampFileSize(files)) {
      if (fileInput) fileInput.value = "";
      escalateIfNeeded(1);
      return;
    }

    // Merge allows multiple; others use first only
    appState.files = appState.view === "merge" ? files : [files[0]];
    appState.rejectCount = 0; // reset after successful selection

    dropZone?.classList.add("hidden");
    uploadUI?.classList.remove("hidden");

    // Fake upload animation (UI only)
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
      // NEW UPDATE: Show file size early only for compress/resize
      const f = appState.files[0];
      let sizeText = "";

      if (["compress", "resize"].includes(appState.view) && f) {
        sizeText = ` (${formatBytes(f.size)})`;
      }

      fileNameDisplay.innerText =
        appState.files.length === 1
          ? appState.files[0].name + sizeText
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

    // Clear Preview/Stats UI
    const wrapper = qs("#preview-wrapper");
    if (wrapper) wrapper.classList.add("hidden");

    const legal = qs("#legal-check");
    if (legal) legal.checked = false;
    toggleStartButton();
  }

  // =========================================================
  // 14) COMPRESS SETTINGS
  // =========================================================
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

  // =========================================================
  // 15) START PROCESS
  // =========================================================
  async function executeProcess() {
    if (!checkDailyLimit()) return;

    readyUI?.classList.add("hidden");
    processUI?.classList.remove("hidden");

    const title = qs("#process-title");
    if (title) title.innerText = "Processing...";

    // NEW: Capture Original Stats before processing starts
    appState.originalStats = {
      size: appState.files[0]?.size || 0,
      width: 0,
      height: 0,
    };

    // If resizing, try to read original dimensions
    if (appState.view === "resize" && appState.files[0]) {
      try {
        const dims = await getImageDimensions(appState.files[0]);
        appState.originalStats.width = dims.w;
        appState.originalStats.height = dims.h;
      } catch (e) {
        console.log("Could not read original dimensions", e);
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

  // =========================================================
  // 16) SUCCESS UI (Clean: Logic Only)
  // =========================================================
  function showSuccess(fileData) {
    processUI?.classList.add("hidden");
    successUI?.classList.remove("hidden");

    const filename = fileData.FileName;
    const newSize = fileData.FileSize;
    const url = appState.resultUrl;

    // 1. Setup Download Button (Logic preserved)
    if (downloadBtn) {
      const newBtn = downloadBtn.cloneNode(true);
      downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
      const currentDownloadBtn = qs(".download-btn");

      currentDownloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename || "documorph-output";
        link.target = "_blank";
        link.click();
      };
    }

    // 2. DOM Elements for Preview/Stats
    const wrapper = qs("#preview-wrapper");
    const imgEl = qs("#preview-img");
    const pdfEl = qs("#preview-pdf");
    const fnameEl = qs("#stats-filename");
    const compBox = qs("#stats-compression");
    const resizeBox = qs("#stats-resize");

    // Reset UI state
    wrapper.classList.remove("hidden");
    imgEl.classList.add("hidden");
    pdfEl.classList.add("hidden");
    compBox.classList.add("hidden");
    resizeBox.classList.add("hidden");

    // 3. Set Filename
    if (fnameEl) fnameEl.textContent = filename;

    // 4. Handle Media Preview
    const ext = String(filename).split(".").pop().toLowerCase();
    const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    const isPdf = ["pdf"].includes(ext);

    if (isImg) {
      imgEl.src = url;
      imgEl.classList.remove("hidden");
    } else if (isPdf) {
      pdfEl.src = url + "#toolbar=0&navpanes=0&scrollbar=0";
      pdfEl.classList.remove("hidden");
    }

    // 5. Handle Compression Stats (Only show for compress view)
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

    // 6. Handle Resize Stats (Only show for resize view & images)
    if (appState.view === "resize" && isImg) {
      resizeBox.classList.remove("hidden");
      const loading = qs("#resize-loading");
      const dataRow = qs("#resize-data");

      // Show loading initially
      loading.classList.remove("hidden");
      dataRow.classList.add("hidden");

      // Wait for preview image to load to read true dimensions
      imgEl.onload = () => {
        loading.classList.add("hidden");
        dataRow.classList.remove("hidden");

        qs(
          "#resize-old"
        ).textContent = `${appState.originalStats.width} x ${appState.originalStats.height} px`;
        qs(
          "#resize-new"
        ).textContent = `${imgEl.naturalWidth} x ${imgEl.naturalHeight} px`;
      };
    }
  }

  // =========================================================
  // 17) BUILD CONVERT TYPE + PARAMS (for URL-based ConvertAPI calls)
  // =========================================================
  async function buildConvertTypeAndParams(file) {
    const ext = getFileExt(file);
    let type = "";
    const params = {};

    // Convert
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

    // Compress
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

          if (imgExt === "jpg") {
            params.Quality = String(Math.max(10, Math.min(95, s * 10)));
          }

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

    // Resize
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

    // Merge
    if (appState.view === "merge") type = "pdf/to/merge";

    return { type, params };
  }

  // =========================================================
  // 17b) BLOB UPLOAD + CONVERTAPI (URL-based) — iOS-safe
  // =========================================================

  function setProcessProgress(pct) {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    if (processBar) processBar.style.width = `${p}%`;
    if (processPercent) processPercent.innerText = `${p}%`;
  }

  function isIOSDevice() {
    // Covers iPhone/iPad + iPadOS that presents as Mac
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
      heic: "image/heic",
      heif: "image/heif",
      tif: "image/tiff",
      tiff: "image/tiff",
    };
    return map[ext] || "application/octet-stream";
  }

  function withTimeout(promise, ms, label = "Operation") {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      );
    });
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
  }

  async function uploadToBlob(file, progressOffset = 0, progressSpan = 70) {
    // NEW UPDATE: Pin version to v0.22.1 for iOS stability
    const { upload } = await import(
      "https://esm.sh/@vercel/blob@0.22.1/client"
    );

    const ios = isIOSDevice();
    let normalized = file;

    // NEW UPDATE: iOS "File Object" Fix
    // If iOS, ensure we are sending a Blob via slice(), not a potentially broken File ref
    if (ios) {
      const safeName = String(file?.name || "upload.bin").replace(
        /[^a-z0-9_.-]/gi,
        "_"
      );
      const mime = file?.type || guessMimeFromName(safeName);
      // Slicing the file into a Blob often fixes the Safari "stuck" upload bug
      normalized = file.slice(0, file.size, mime);
      // Re-attach name property for the uploader
      normalized.name = safeName;
    }

    const safeName = String(file?.name || "upload.bin").replace(
      /[^a-z0-9_.-]/gi,
      "_"
    );
    const pathname = `uploads/${Date.now()}-${safeName}`;

    // iOS Safari typically works best with multipart: false for smaller files,
    let multipartDecision = ios ? false : normalized.size > 4.5 * 1024 * 1024;

    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const uploadPromise = upload(pathname, normalized, {
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

        if (!result || !(result.url || result?.blob?.url)) {
          throw new Error("Invalid upload result");
        }

        const url = result.url || result?.blob?.url;
        setProcessProgress(progressOffset + progressSpan);
        return { url, raw: result };
      } catch (err) {
        console.error(
          `[uploadToBlob] attempt ${attempt} failed:`,
          err && (err.message || err)
        );
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000));
          // On retry, force simple upload (no multipart)
          multipartDecision = false;
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

      // 1) Upload to Vercel Blob (URL-mode)
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

      // 2) Build ConvertAPI type + params
      const { type, params } = await buildConvertTypeAndParams(first);
      if (!type) throw new Error("Tool type not recognized");

      // 3) Call convert proxy (URL mode)
      setProcessProgress(75);

      // Ramp progress while server side processing occurs
      const ramp = setInterval(() => {
        const current =
          Number(processPercent?.innerText?.replace("%", "")) || 75;
        if (current < 92) setProcessProgress(current + 1);
      }, 180);

      // Increase convert timeout on iOS (ConvertAPI sometimes slow). 300s = 5 minutes
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
        }
      );

      const resp = await withTimeout(convertPromise, convertTimeout, "Convert");

      clearInterval(ramp);

      // If the proxy returned non-JSON body or non-OK, read text to surface server error
      const contentType = resp.headers.get("content-type") || "";
      const rawText = await resp.text().catch(() => null);

      if (!resp.ok) {
        // try parse JSON message from body if possible
        let parsed;
        try {
          parsed = rawText ? JSON.parse(rawText) : null;
        } catch (e) {
          parsed = null;
        }
        console.error(
          "[processFilesWithProxy] convert proxy non-ok:",
          resp.status,
          parsed || rawText
        );
        alert(
          `Conversion failed (HTTP ${resp.status}).\n\n${
            parsed?.error ||
            parsed?.message ||
            rawText ||
            "See console/network tab."
          }`
        );
        resetApp();
        throw new Error("Convert proxy HTTP " + resp.status);
      }

      // parse JSON response
      let d;
      try {
        d = contentType.includes("application/json")
          ? JSON.parse(rawText || "{}")
          : null;
      } catch (err) {
        console.error(
          "[processFilesWithProxy] Invalid JSON from convert proxy:",
          rawText
        );
        resetApp();
        throw new Error("Invalid response from convert proxy");
      }

      if (d?.Files?.length) {
        setProcessProgress(100);
        appState.resultUrl = d.Files[0].Url;
        incrementUsage();
        // UPDATE: Pass full file object to showSuccess (not just name) for stats
        showSuccess(d.Files[0]);
        return d;
      }

      // Not ok: show server-returned message if present
      console.error(
        "[processFilesWithProxy] convert returned no file:",
        d || rawText
      );
      alert(`Conversion returned no file. ${d?.error || d?.message || ""}`);
      resetApp();
      throw new Error("No file in response");
    } catch (err) {
      // Present friendly message to the user and log details to console
      console.error("[processFilesWithProxy] error:", err);
      // if err.message contains "timed out" show specific message
      if (/timed out/i.test(err.message || "")) {
        alert(
          "Operation timed out. Try again on a stronger connection or use a smaller file."
        );
      } else {
        alert(err.message || "Processing failed. Please try again.");
      }
      resetApp();
      throw err;
    }
  }

  // =========================================================
  // 18) DROPDOWNS (custom-select)
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
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      options.forEach((opt) => {
        opt.setAttribute("tabindex", "0");

        const select = () => {
          const val = opt.getAttribute("data-value");
          if (!val) return;

          // SUPPORT DROPDOWNS
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

          // Unit dropdown (MB/KB)
          if (dd.id === "size-unit-dropdown") {
            if (triggerText) triggerText.textContent = val;
            dd.classList.remove("open");
            dd.focus();
            return;
          }

          // Resize scale dropdown (UI only)
          if (dd.id === "resize-scale-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            dd.classList.remove("open");
            dd.focus();
            return;
          }

          // Feedback modal category dropdown
          if (dd.id === "feedback-category-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;

            const hidden = qs("#feedback-category");
            if (hidden) hidden.value = val;

            dd.classList.remove("open");
            dd.focus();
            return;
          }

          // Tool dropdowns
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

  // =========================================================
  // 19) WALLETS (GET /api/wallets)
  // =========================================================
  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets", { cache: "no-store" });
      if (!response.ok) return;

      CRYPTO_WALLETS = await response.json();
      updateWalletDisplay("btc");
    } catch (e) {
      console.error("Wallet load failed", e);
    }
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
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
        address
      )}`;
    } else {
      qrBox?.classList.add("hidden");
    }

    if (connectBtn) {
      connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
      connectBtn.onclick = copyWallet;
    }
  }

  // =========================================================
  // 20) COPY WALLET
  // =========================================================
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
