/* =========================================================
   DocuMorph — Main App Script (scripts.js)
   Author: Samson Eniolorunda

   Purpose:
   - Controls the DocuMorph UI (Convert / Compress / Resize / Merge)
   - Manages file selection + drag/drop + progress states
   - Enforces daily usage limit (localStorage)
   - Calls Vercel API routes (/api/convert, /api/form, /api/wallets)
   - Handles modals (Terms / Privacy / Feature Request / Support)
   - Handles Support (crypto wallets, QR display, MetaMask + TonConnect)

   Requirements:
   - HTML IDs/classes must match (this file targets them directly).
   - External libs must load before this script:
     - TON Connect UI (TON_CONNECT_UI)
     - Ethers (ethers)
   - Backend endpoints expected:
     - GET  /api/wallets
     - POST /api/form
     - POST /api/convert?type=...
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIGURATION
  // =========================================================
  const DAILY_LIMIT = 5;

  // Loaded dynamically from your backend (/api/wallets)
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

  // =========================================================
  // 2) TON CONNECT SETUP
  // =========================================================
  // Note: tonConnectUI is initialized so the TonConnect button can render in #ton-connect-btn
  const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: "https://docu-morph.vercel.app/tonconnect-manifest.json",
    buttonRootId: "ton-connect-btn",
  });

  // =========================================================
  // 3) APP STATE
  // =========================================================
  const appState = {
    view: "convert",         // convert | compress | resize | merge
    subTool: "word-to-pdf",  // tool key (dropdown data-value)
    files: [],               // selected files
    resultUrl: null,         // output url from ConvertAPI response
    resizeScale: 100,        // used for resize scale dropdown (optional)
  };

  // =========================================================
  // 4) DOM REFERENCES
  // =========================================================

  // View sections
  const views = {
    convert: document.getElementById("view-convert"),
    compress: document.getElementById("view-compress"),
    resize: document.getElementById("view-resize"),
    merge: document.getElementById("view-merge"),
  };

  // Upload flow containers
  const dropZone = document.getElementById("drop-zone");
  const uploadUI = document.getElementById("upload-ui");
  const readyUI = document.getElementById("ready-ui");
  const processUI = document.getElementById("process-ui");
  const successUI = document.getElementById("success-ui");

  // Progress bars + text
  const uploadBar = document.getElementById("upload-bar");
  const uploadPercent = document.getElementById("upload-percent");
  const processBar = document.getElementById("process-bar");
  const processPercent = document.getElementById("process-percent");

  // Inputs
  const fileInput = document.getElementById("file-input");
  const fileLimits = document.getElementById("file-limits");
  const fileNameDisplay = document.getElementById("file-name-display");

  // Resize inputs
  const resizeW = document.getElementById("resize-w");
  const resizeH = document.getElementById("resize-h");

  // Buttons / controls
  const startBtn = document.getElementById("start-btn");
  const downloadBtn = document.querySelector(".download-btn");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  // Footer year (safe)
  try {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  } catch (_) {}

  // =========================================================
  // 5) INITIALIZATION
  // =========================================================
  initCustomDropdowns();
  updateContext("convert", "word-to-pdf");
  fetchSecureWallets();
  bindFileHandlers();

  // =========================================================
  // 6) CONTEXT UPDATER (View + Tool -> state + input rules + UI labels)
  // =========================================================
  function updateContext(view, tool) {
    // Resolve next context (with safe fallbacks)
    const nextView = view || appState.view || "convert";
    let nextTool = tool || appState.subTool || "word-to-pdf";

    // If user enters resize view, there’s no tool dropdown selection used for processing;
    // keep an internal tool key for consistent rules.
    if (nextView === "resize") nextTool = "resize-img";

    // Save state
    appState.view = nextView;
    appState.subTool = nextTool;

    // Reset app UI to avoid mixed states when switching tools/views
    resetApp();

    // Helper: set file input accept/multiple
    const setInputRules = (accept, multiple) => {
      if (!fileInput) return;
      fileInput.accept = accept || "";
      fileInput.multiple = Boolean(multiple);
    };

    // Helper: set the "Supported..." message
    const setLimitsText = (text) => {
      if (fileLimits) fileLimits.textContent = text;
    };

    // Tool rules per view/tool
    const rules = {
      convert: {
        "word-to-pdf": {
          accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          multiple: false,
          label: "Supported: Word Docs (DOC/DOCX) • Max 50MB",
        },
        "pdf-to-word": {
          accept: ".pdf,application/pdf",
          multiple: false,
          label: "Supported: PDF • Max 50MB",
        },
        "excel-to-pdf": {
          accept: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          multiple: false,
          label: "Supported: Excel (XLS/XLSX) • Max 50MB",
        },
        "pdf-to-excel": {
          accept: ".pdf,application/pdf",
          multiple: false,
          label: "Supported: PDF • Max 50MB",
        },
        "jpg-to-png": {
          accept: ".jpg,.jpeg,image/jpeg",
          multiple: false,
          label: "Supported: JPG/JPEG • Max 50MB",
        },
        "png-to-jpg": {
          accept: ".png,image/png",
          multiple: false,
          label: "Supported: PNG • Max 50MB",
        },
      },

      compress: {
        "comp-pdf": {
          accept: ".pdf,application/pdf",
          multiple: false,
          label: "Supported: PDF • Max 50MB",
        },
        "comp-img": {
          accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
          multiple: false,
          label: "Supported: JPG/PNG • Max 50MB",
        },
      },

      resize: {
        "resize-img": {
          accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
          multiple: false,
          label: "Supported: JPG/PNG • Max 50MB",
        },
      },

      merge: {
        "merge-pdf": {
          accept: ".pdf,application/pdf",
          multiple: true,
          label: "Supported: PDFs (Select multiple) • Max 50MB each",
        },
      },
    };

    const viewRules = rules[nextView] || rules.convert;
    const toolRule = viewRules[nextTool] || Object.values(viewRules)[0];

    if (toolRule) {
      setInputRules(toolRule.accept, toolRule.multiple);
      setLimitsText(toolRule.label);
    } else {
      setInputRules("", false);
      setLimitsText("Supported: Files • Max 50MB");
    }

    // Optional: update Start button base label (final action label is set on ready screen)
    if (startBtn) {
      if (nextView === "convert") startBtn.textContent = "Start Conversion";
      if (nextView === "compress") startBtn.textContent = "Start Compression";
      if (nextView === "resize") startBtn.textContent = "Start Resize";
      if (nextView === "merge") startBtn.textContent = "Start Merge";
    }
  }

  // =========================================================
  // 7) SECURE WALLET LOGIC (Support modal)
  // =========================================================
  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) return;
      const json = await response.json();
      if (json && typeof json === "object") {
        CRYPTO_WALLETS = { ...CRYPTO_WALLETS, ...json };
        updateWalletDisplay("btc"); // default
      }
    } catch (e) {
      console.error("Wallet load failed");
    }
  }

  function updateWalletDisplay(key) {
    const walletInput = document.getElementById("wallet-address");
    const connectBtn = document.getElementById("connect-wallet-btn");
    const tonBtn = document.getElementById("ton-connect-btn");
    const qrBox = document.getElementById("qr-container");
    const qrImg = document.getElementById("crypto-qr");

    if (!walletInput) return;

    // Resolve selected key -> wallet address
    let address = "Address Not Set";

    if (key === "btc") address = CRYPTO_WALLETS.btc;
    else if (key === "eth") address = CRYPTO_WALLETS.eth;
    else if (key === "bnb") address = CRYPTO_WALLETS.bnb;
    else if (key === "sol") address = CRYPTO_WALLETS.sol;
    else if (key === "ton") address = CRYPTO_WALLETS.ton;
    else if (key === "tron") address = CRYPTO_WALLETS.tron;

    // USDT networks
    else if (key === "usdt-eth") address = CRYPTO_WALLETS.usdt_eth;
    else if (key === "usdt-bnb") address = CRYPTO_WALLETS.usdt_bnb;
    else if (key === "usdt-trc") address = CRYPTO_WALLETS.usdt_trc;
    else if (key === "usdt-sol") address = CRYPTO_WALLETS.usdt_sol;
    else if (key === "usdt-ton") address = CRYPTO_WALLETS.usdt_ton;
    else if (key === "usdt-arb") address = CRYPTO_WALLETS.usdt_arb;
    else if (key === "usdt") address = CRYPTO_WALLETS.usdt_eth;

    walletInput.value = address || "Address Not Set";

    // QR logic (only show if real address exists)
    const canShowQr =
      qrBox &&
      qrImg &&
      walletInput.value &&
      walletInput.value !== "Loading..." &&
      walletInput.value !== "Address Not Set";

    if (canShowQr) {
      qrBox.classList.remove("hidden");
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(walletInput.value)}`;
    } else if (qrBox) {
      qrBox.classList.add("hidden");
    }

    // Button logic (TonConnect vs MetaMask vs Copy only)
    if (!connectBtn || !tonBtn) return;

    connectBtn.style.display = "none";
    tonBtn.style.display = "none";

    // TON -> TonConnect UI button
    if (key === "ton" || key === "usdt-ton") {
      tonBtn.style.display = "flex";
      return;
    }

    // EVM -> MetaMask connect
    const isEvm = ["eth", "bnb", "matic", "arb", "usdt-eth", "usdt-bnb", "usdt-arb"].includes(key);

    if (isEvm) {
      connectBtn.style.display = "block";
      connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
      connectBtn.onclick = window.connectAndDonate;
      return;
    }

    // Non-EVM -> copy only
    connectBtn.style.display = "block";
    connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
    connectBtn.onclick = window.copyWallet;
  }

  // Connect wallet + send sample transaction (EVM only)
  window.connectAndDonate = async function connectAndDonate() {
    if (typeof window.ethereum === "undefined") {
      alert("MetaMask not detected. Please copy the address.");
      window.copyWallet();
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Default donation target (EVM)
      const target = CRYPTO_WALLETS.eth;

      const tx = await signer.sendTransaction({
        to: target,
        value: ethers.utils.parseEther("0.005"),
      });

      alert("Transaction Sent! Hash: " + tx.hash);
    } catch (err) {
      alert("Connection failed. Please copy the address manually.");
      window.copyWallet();
    }
  };

  // Copy wallet address to clipboard
  window.copyWallet = function copyWallet() {
    const input = document.getElementById("wallet-address");
    const feedback = document.getElementById("copy-feedback");

    if (!input || !input.value || input.value === "Loading...") return;

    input.select();
    input.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(input.value);

    if (feedback) {
      feedback.classList.add("visible");
      setTimeout(() => feedback.classList.remove("visible"), 2000);
    }
  };

  // =========================================================
  // 8) CUSTOM DROPDOWNS (Tools + Support)
  // =========================================================
  function initCustomDropdowns() {
    const dropdowns = document.querySelectorAll(".custom-select");

    dropdowns.forEach((dd) => {
      const trigger = dd.querySelector(".select-trigger");
      const triggerText = dd.querySelector(".trigger-text");
      const options = dd.querySelectorAll(".option");

      const closeAll = () => dropdowns.forEach((d) => d.classList.remove("open"));

      const toggle = () => {
        const isOpen = dd.classList.contains("open");
        closeAll();
        if (!isOpen) dd.classList.add("open");
      };

      if (trigger) trigger.addEventListener("click", toggle);

      // Keyboard open/close
      dd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
        if (e.key === "Escape") {
          dd.classList.remove("open");
          dd.blur();
        }
      });

      // Select option
      options.forEach((opt) => {
        opt.setAttribute("tabindex", "0");

        const select = () => {
          const val = opt.getAttribute("data-value");
          if (!val) return;

          // 1) Support: Coin dropdown
          if (dd.id === "crypto-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;

            const usdtGroup = document.getElementById("usdt-network-group");
            if (val === "usdt") {
              if (usdtGroup) usdtGroup.classList.remove("hidden");
              updateWalletDisplay("usdt-eth");
            } else {
              if (usdtGroup) usdtGroup.classList.add("hidden");
              updateWalletDisplay(val);
            }
          }

          // 2) Support: USDT network dropdown
          else if (dd.id === "network-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateWalletDisplay(val);
          }

          // 3) Resize scale dropdown (store percent for later use)
          else if (dd.id === "resize-scale-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            const pct = parseInt(val, 10);
            if (!Number.isNaN(pct)) appState.resizeScale = pct;
          }

          // 4) All other tool dropdowns (convert/compress/merge)
          else {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateContext(appState.view, val);
          }

          dd.classList.remove("open");
          dd.focus();
        };

        opt.addEventListener("click", select);
        opt.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            select();
          }
        });
      });
    });

    // Close dropdowns on outside click
    window.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-select")) {
        document.querySelectorAll(".custom-select").forEach((d) => d.classList.remove("open"));
      }
    });
  }

  // =========================================================
  // 9) FEATURE REQUEST FORM (Proxy to /api/form)
  // =========================================================
  window.submitToFormspree = async function submitToFormspree(e) {
    e.preventDefault();

    const status = document.getElementById("form-status");
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (status) status.innerText = "Sending...";

    try {
      const response = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        if (status) status.innerText = "Thanks! Request sent.";
        e.target.reset();
      } else {
        if (status) status.innerText = "Oops! Server error.";
      }
    } catch (_) {
      if (status) status.innerText = "Network Error.";
    }
  };

  // =========================================================
  // 10) DAILY LIMIT (Local Storage)
  // =========================================================
  function checkDailyLimit() {
    try {
      const today = new Date().toLocaleDateString();
      const storage = localStorage.getItem("documorph_usage");
      let data = storage ? JSON.parse(storage) : { date: today, count: 0 };

      if (data.date !== today) data = { date: today, count: 0 };

      if (data.count >= DAILY_LIMIT) {
        alert("Daily limit reached! Please try again tomorrow.");
        return false;
      }
      return true;
    } catch (_) {
      // If storage fails, don’t block user
      return true;
    }
  }

  function incrementUsage() {
    try {
      const today = new Date().toLocaleDateString();
      let d = JSON.parse(localStorage.getItem("documorph_usage")) || { date: today, count: 0 };

      if (d.date !== today) d = { date: today, count: 0 };
      d.count += 1;

      localStorage.setItem("documorph_usage", JSON.stringify(d));
    } catch (_) {}
  }

  // =========================================================
  // 11) PROCESS FLOW (called by Start button)
  // =========================================================
  window.executeProcess = function executeProcess() {
    if (!checkDailyLimit()) return;

    if (readyUI) readyUI.classList.add("hidden");
    if (processUI) processUI.classList.remove("hidden");

    const title = document.getElementById("process-title");
    if (title) title.innerText = "Processing...";

    processFilesWithProxy();
  };

  function processFilesWithProxy() {
    // Validate files
    if (!appState.files || appState.files.length === 0) {
      alert("No file selected!");
      resetApp();
      return;
    }

    // Build form data
    const formData = new FormData();

    // Decide ConvertAPI "type" path
    let type = "";

    // Single-file default
    const file = appState.files[0];
    const ext = file.name.split(".").pop().toLowerCase();

    // Default payload
    formData.append("File", file);
    formData.append("StoreFile", "true");

    // ---------------------------------------------------------
    // Convert tools
    // ---------------------------------------------------------
    if (appState.subTool === "word-to-pdf") {
      type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
    } else if (appState.subTool === "pdf-to-word") {
      type = "pdf/to/docx";
    } else if (appState.subTool === "excel-to-pdf") {
      type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
    } else if (appState.subTool === "pdf-to-excel") {
      type = "pdf/to/xlsx";
    } else if (appState.subTool === "jpg-to-png") {
      type = "jpg/to/png";
    } else if (appState.subTool === "png-to-jpg") {
      type = "png/to/jpg";
    }

    // ---------------------------------------------------------
    // Compress tools
    // ---------------------------------------------------------
    else if (appState.view === "compress") {
      type = appState.subTool === "comp-pdf" ? "pdf/to/compress" : "jpg/to/compress";

      const modeEl = document.querySelector('input[name="comp-mode"]:checked');
      const mode = modeEl ? modeEl.value : "auto";

      if (mode === "auto") {
        const slider = document.getElementById("compression-range");
        const s = slider ? Number(slider.value) : 5;

        if (s <= 3) formData.append("Preset", "screen");
        else if (s <= 6) formData.append("Preset", "ebook");
        else formData.append("Preset", "printer");

        if (type === "jpg/to/compress") formData.append("Quality", s * 10);
      } else {
        // Target size mode (placeholder — keep stable until backend supports it)
        formData.append("Preset", "screen");
      }
    }

    // ---------------------------------------------------------
    // Resize tool (placeholder type; backend can apply params)
    // ---------------------------------------------------------
    else if (appState.view === "resize") {
      type = "jpg/to/jpg";

      // Optional: send resize hints (backend can ignore if not implemented)
      // Width/Height override scale, if provided
      const w = resizeW && resizeW.value ? Number(resizeW.value) : null;
      const h = resizeH && resizeH.value ? Number(resizeH.value) : null;

      if (w) formData.append("Width", String(w));
      if (h) formData.append("Height", String(h));

      // Scale percent (stored from dropdown)
      if (!w && !h && appState.resizeScale && appState.resizeScale !== 100) {
        formData.append("Scale", String(appState.resizeScale));
      }
    }

    // ---------------------------------------------------------
    // Merge tool (multi-file payload)
    // ---------------------------------------------------------
    else if (appState.view === "merge") {
      type = "pdf/to/merge";
      formData.delete("File");
      appState.files.forEach((f, i) => formData.append(`Files[${i}]`, f));
    }

    // Safety: if type is still empty, fail gracefully
    if (!type) {
      alert("Tool not configured correctly.");
      resetApp();
      return;
    }

    // ---------------------------------------------------------
    // XHR request (progress events)
    // ---------------------------------------------------------
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/convert?type=${encodeURIComponent(type)}`, true);

    xhr.upload.onprogress = function (e) {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);

      if (processBar) processBar.style.width = p + "%";
      if (processPercent) processPercent.innerText = p + "%";
    };

    xhr.onload = function () {
      if (xhr.status !== 200) {
        alert("Failed: " + xhr.status);
        resetApp();
        return;
      }

      try {
        const d = JSON.parse(xhr.responseText);

        if (d && d.Files && d.Files.length > 0) {
          appState.resultUrl = d.Files[0].Url;
          incrementUsage();
          showSuccess(d.Files[0].FileName);
          return;
        }

        throw new Error("Unexpected API response");
      } catch (_) {
        alert("Error parsing response");
        resetApp();
      }
    };

    xhr.onerror = function () {
      alert("Network Error");
      resetApp();
    };

    xhr.send(formData);
  }

  function showSuccess(filename) {
    if (processUI) processUI.classList.add("hidden");
    if (successUI) successUI.classList.remove("hidden");

    // Download action
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        if (!appState.resultUrl) return;
        const link = document.createElement("a");
        link.href = appState.resultUrl;
        link.download = filename || "documorph-file";
        link.target = "_blank";
        link.click();
      };
    }

    // Auto-open Support modal after a short delay
    setTimeout(() => {
      window.openModal("support");
    }, 1500);
  }

  // =========================================================
  // 12) UI HELPERS (Checkbox, View Switch, Menu, Reset)
  // =========================================================

  // Enable Start button only after user accepts Terms/Privacy
  window.toggleStartButton = function toggleStartButton() {
    const checkbox = document.getElementById("legal-check");
    const btn = document.getElementById("start-btn");

    if (!checkbox || !btn) return;

    if (checkbox.checked) {
      btn.classList.remove("disabled");
      btn.removeAttribute("disabled");
    } else {
      btn.classList.add("disabled");
      btn.setAttribute("disabled", "true");
    }
  };

  // Switch Convert/Compress/Resize/Merge
  window.switchView = function switchView(next) {
    appState.view = next;

    // Update active state on nav buttons
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.innerText.toLowerCase() === next);
    });

    // Hide all views then show selected
    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    if (views[next]) views[next].classList.remove("hidden");

    // Determine default sub-tool for this view (first option)
    const firstOpt = views[next] ? views[next].querySelector(".option") : null;
    const defaultTool = firstOpt ? firstOpt.getAttribute("data-value") : null;

    updateContext(next, defaultTool);

    // Close mobile menu after switching (if open)
    if (menuToggle && menuToggle.classList.contains("open")) window.toggleMenu();
  };

  // Mobile hamburger toggle
  window.toggleMenu = function toggleMenu() {
    if (menuToggle) menuToggle.classList.toggle("open");
    if (mobileMenu) mobileMenu.classList.toggle("active");
  };

  // Reset app UI state to initial (keeps current view/tool)
  function resetApp() {
    if (uploadUI) uploadUI.classList.add("hidden");
    if (readyUI) readyUI.classList.add("hidden");
    if (processUI) processUI.classList.add("hidden");
    if (successUI) successUI.classList.add("hidden");
    if (dropZone) dropZone.classList.remove("hidden");

    appState.files = [];
    appState.resultUrl = null;

    if (fileInput) fileInput.value = "";
    if (uploadBar) uploadBar.style.width = "0%";
    if (uploadPercent) uploadPercent.innerText = "0%";
    if (processBar) processBar.style.width = "0%";
    if (processPercent) processPercent.innerText = "0%";

    // Reset consent checkbox
    const checkbox = document.getElementById("legal-check");
    if (checkbox) {
      checkbox.checked = false;
      window.toggleStartButton();
    }

    // Reset dropzone inline highlight (if any)
    if (dropZone) {
      dropZone.style.borderColor = "";
      dropZone.style.background = "";
    }
  }

  // Expose resetApp to window (used by HTML buttons)
  window.resetApp = resetApp;

  // Compress mode toggle (auto vs target)
  window.toggleCompMode = function toggleCompMode() {
    const modeEl = document.querySelector('input[name="comp-mode"]:checked');
    const mode = modeEl ? modeEl.value : "auto";

    const autoBox = document.getElementById("comp-auto-settings");
    const targetBox = document.getElementById("comp-target-settings");

    if (!autoBox || !targetBox) return;

    if (mode === "auto") {
      autoBox.classList.remove("hidden");
      targetBox.classList.add("hidden");
    } else {
      autoBox.classList.add("hidden");
      targetBox.classList.remove("hidden");
    }
  };

  // Compression slider label update
  window.updateRangeLabel = function updateRangeLabel() {
    const labels = ["Smallest", "Small", "Compact", "Balanced", "Balanced", "Better", "Good", "Great", "Best Quality"];
    const slider = document.getElementById("compression-range");
    const text = document.getElementById("compression-text");
    if (!slider || !text) return;

    const v = Number(slider.value);
    text.innerText = labels[v - 1] || "Balanced";
  };

  // Support modal tab switcher (keeps compatibility with onclick usage)
  window.switchSupportTab = function switchSupportTab(n, ev) {
    const e = ev || window.event;

    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));

    if (e && e.currentTarget) e.currentTarget.classList.add("active");

    const target = document.getElementById(`tab-${n}`);
    if (target) target.classList.remove("hidden");
  };

  // =========================================================
  // 13) MODAL CONTROLS
  // =========================================================
  window.openModal = function openModal(type) {
    const container = document.getElementById("modal-container");
    if (!container) return;

    // Hide all modal bodies then show the target
    document.querySelectorAll(".modal-body").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`modal-${type}`);

    if (target) {
      target.classList.remove("hidden");
      container.classList.remove("hidden");
    }
  };

  window.closeModal = function closeModal() {
    const container = document.getElementById("modal-container");
    if (container) container.classList.add("hidden");
  };

  // =========================================================
  // 14) FILE PICKER + DRAG/DROP HANDLERS
  // =========================================================
  function bindFileHandlers() {
    // File picker change
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files.length > 0) handleFiles(fileInput.files);
      });
    }

    // Drag/drop zone events
    if (dropZone) {
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--primary)";
        dropZone.style.background = "#e0e7ff";
      });

      dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "";
        dropZone.style.background = "";
      });

      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "";
        dropZone.style.background = "";

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFiles(e.dataTransfer.files);
        }
      });
    }
  }

  // Simulate upload progress then show ready UI
  function handleFiles(fileList) {
    appState.files = Array.from(fileList);

    if (dropZone) dropZone.classList.add("hidden");
    if (uploadUI) uploadUI.classList.remove("hidden");

    let w = 0;
    const timer = setInterval(() => {
      w += 5;

      if (uploadBar) uploadBar.style.width = w + "%";
      if (uploadPercent) uploadPercent.innerText = w + "%";

      if (w >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          if (uploadUI) uploadUI.classList.add("hidden");
          showReadyScreen();
        }, 300);
      }
    }, 15);
  }

  function showReadyScreen() {
    if (readyUI) readyUI.classList.remove("hidden");

    // File name display
    if (fileNameDisplay) {
      if (appState.files.length === 1) fileNameDisplay.innerText = appState.files[0].name;
      else fileNameDisplay.innerText = `${appState.files.length} files selected`;
    }

    // Set action label (nice UX)
    let action = "Start";
    if (appState.view === "convert") action = "Convert Now";
    else if (appState.view === "compress") action = "Compress Now";
    else if (appState.view === "resize") action = "Resize Now";
    else if (appState.view === "merge") action = "Merge PDFs";

    if (startBtn) startBtn.innerText = action;
  }

})();
