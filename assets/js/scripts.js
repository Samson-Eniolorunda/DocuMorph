/* =========================================================
   DocuMorph — Main Frontend Logic (scripts.js)
   Author: Samson Eniolorunda
   ---------------------------------------------------------
   Updated:
   - Feedback menu label + modal title: "Feedback" / "Feedback & Requests"
   - Strict "supported file only" validation for BOTH choose-file + drag-drop
   - Inline drop-zone error text + escalation modal on repeated mistakes
   - Resize Scale % fixed (no 404): reads original size in browser and sends px
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIG
  // =========================================================
  const DAILY_LIMIT = 5;
  const MAX_UPLOAD_MB = 50;

  // Error escalation
  const REJECT_ESCALATE_COUNT = 3;     // show modal after repeated invalid attempts
  const MULTI_REJECT_ESCALATE = 2;     // show modal when multiple files rejected at once

  // =========================================================
  // 2) APP STATE
  // =========================================================
  const appState = {
    view: "convert", // convert | compress | resize | merge
    subTool: "word-to-pdf",
    files: [],
    resultUrl: null,

    rejectCount: 0, // repeated invalid attempts
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

  function getFileExt(file) {
    const name = file?.name || "";
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
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
      showInlineDropError(`"${tooBig.name}" is above ${MAX_UPLOAD_MB}MB. Please upload a smaller file.`);
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
    const label = (qs("#resize-scale-dropdown .trigger-text")?.innerText || "").trim();
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

    if (rejectedCount >= MULTI_REJECT_ESCALATE || appState.rejectCount >= REJECT_ESCALATE_COUNT) {
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
    updateContext(viewName, firstOption ? firstOption.getAttribute("data-value") : null);

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
        accept = "image/*";
        limitText = "Images";
      }
    } else if (view === "resize") {
      accept = "image/*";
      limitText = "Images";
    } else if (view === "merge") {
      accept = ".pdf";
      limitText = "PDF Files";
    }

    if (fileInput) fileInput.setAttribute("accept", accept);
    if (fileLimits) fileLimits.innerText = `Supported: ${limitText} • Max ${MAX_UPLOAD_MB}MB`;

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
          showInlineDropError(`Not supported: ${rejected.map((f) => f.name).join(", ")}`);
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
          showInlineDropError(`Not supported: ${rejected.map((f) => f.name).join(", ")}`);
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
      fileNameDisplay.innerText =
        appState.files.length === 1 ? appState.files[0].name : `${appState.files.length} files selected`;
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
    const labels = ["Smallest", "Small", "Compact", "Balanced", "Balanced", "Better", "Good", "Great", "Best Quality"];
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

    try {
      await processFilesWithProxy();
    } catch (e) {
      console.error(e);
      alert("Processing failed. Please try again.");
      resetApp();
    }
  }

  // =========================================================
  // 16) SUCCESS UI
  // =========================================================
  function showSuccess(filename) {
    processUI?.classList.add("hidden");
    successUI?.classList.remove("hidden");

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = appState.resultUrl;
        link.download = filename || "documorph-output";
        link.target = "_blank";
        link.click();
      };
    }
  }

  // =========================================================
  // 17) CONVERT/COMPRESS/RESIZE/MERGE PIPELINE (POST -> /api/convert)
  // =========================================================
  async function buildConvertTypeAndParams(formData, file) {
    const ext = getFileExt(file);
    let type = "";

    // Convert
    if (appState.view === "convert") {
      if (appState.subTool === "word-to-pdf") type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
      else if (appState.subTool === "pdf-to-word") type = "pdf/to/docx";
      else if (appState.subTool === "excel-to-pdf") type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
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
          if (s <= 3) formData.append("Preset", "screen");
          else if (s <= 6) formData.append("Preset", "ebook");
          else formData.append("Preset", "printer");
        } else {
          formData.append("Preset", "ebook");
        }
      } else {
        const imgExt = normalizeImageExt(ext);
        type = `${imgExt}/to/compress`;

        if (mode === "auto") {
          const s = Number(qs("#compression-range")?.value || 5);

          if (imgExt === "jpg") {
            formData.append("Quality", String(Math.max(10, Math.min(95, s * 10))));
          }

          if (s <= 3) formData.append("Preset", "screen");
          else if (s <= 6) formData.append("Preset", "ebook");
          else formData.append("Preset", "printer");
        } else {
          const sizeVal = Number(qs("#target-size-input")?.value || 0);
          const unit = (qs("#size-unit-dropdown .trigger-text")?.textContent || "MB").trim().toUpperCase();

          if (sizeVal > 0) {
            const sizeKb = unit === "MB" ? Math.round(sizeVal * 1024) : Math.round(sizeVal);
            formData.append("CompressionFileSize", String(sizeKb));
          }

          formData.append("Preset", "screen");
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
        if (wRaw) formData.append("ImageWidth", wRaw);
        if (hRaw) formData.append("ImageHeight", hRaw);
      } else {
        const pct = getSelectedScalePercent();
        if (pct !== 100) {
          const { w, h } = await getImageDimensions(file);
          const newW = Math.max(1, Math.round((w * pct) / 100));
          const newH = Math.max(1, Math.round((h * pct) / 100));
          formData.append("ImageWidth", String(newW));
          formData.append("ImageHeight", String(newH));
        }
      }
    }

    // Merge
    if (appState.view === "merge") type = "pdf/to/merge";

    return type;
  }

  async function processFilesWithProxy() {
    const first = appState.files[0];
    if (!first) throw new Error("No file selected");

    const formData = new FormData();
    formData.append("StoreFile", "true");

    if (appState.view === "merge") {
      appState.files.forEach((f, i) => formData.append(`Files[${i}]`, f));
    } else {
      formData.append("File", first);
    }

    const type = await buildConvertTypeAndParams(formData, first);
    if (!type) throw new Error("Tool type not recognized");

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/convert?type=${encodeURIComponent(type)}`, true);

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const p = Math.round((e.loaded / e.total) * 100);
        if (processBar) processBar.style.width = `${p}%`;
        if (processPercent) processPercent.innerText = `${p}%`;
      };

      xhr.onload = () => {
        if (xhr.status !== 200) {
          alert("Failed: " + xhr.status);
          resetApp();
          return reject(new Error("HTTP " + xhr.status));
        }

        try {
          const d = JSON.parse(xhr.responseText);

          if (d?.Files?.length) {
            appState.resultUrl = d.Files[0].Url;
            incrementUsage();
            showSuccess(d.Files[0].FileName);
            return resolve(d);
          }

          alert("Conversion returned no file.");
          resetApp();
          reject(new Error("No file in response"));
        } catch (e) {
          alert("Error parsing response.");
          resetApp();
          reject(e);
        }
      };

      xhr.onerror = () => {
        alert("Network Error");
        resetApp();
        reject(new Error("Network Error"));
      };

      xhr.send(formData);
    });
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

    if (qrBox && qrImg && address !== "Address Not Set" && address !== "Loading...") {
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
