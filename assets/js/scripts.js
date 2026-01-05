/* =========================================================
   DocuMorph — Main Frontend Logic (scripts.js)
   Author: Samson Eniolorunda
   ---------------------------------------------------------
   Purpose:
   - Runs the DocuMorph UI (Convert / Compress / Resize / Merge).
   - Handles file selection + drag & drop, progress UI, and downloads.
   - Enforces a daily usage limit via localStorage.
   - Integrates:
     1) ConvertAPI via your Vercel proxy (/api/convert)
     2) Wallet addresses via (/api/wallets)
     3) Feature request form via (/api/form)
   - Wallet flows:
     - MetaMask for EVM coins (ETH/BNB/USDT-EVM) with mobile “direct pay” link fallback
     - TON via Tonkeeper deep-link (button label stays “Connect Wallet”)
     - BTC/SOL/TRON remain copy-only
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIG
  // =========================================================
  const DAILY_LIMIT = 5;

  const DONATION_DEFAULTS = {
    eth: "0.005",
    bnb: "0.01",
    arb: "0.005", // native on arb is ETH
    ton: "0.5",
    usdt: "5",
  };

  // USDT contracts (EVM only)
  const USDT_CONTRACTS = {
    "usdt-eth": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "usdt-bnb": "0x55d398326f99059fF775485246999027B3197955",
    "usdt-arb": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  };

  // Common USDT decimals (BSC-USDT commonly 18, ETH/ARB are 6)
  const USDT_DECIMALS = {
    "usdt-eth": 6,
    "usdt-arb": 6,
    "usdt-bnb": 18,
  };

  // MetaMask chain configs (switching on desktop/injected provider)
  const EVM_CHAINS = {
    eth: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [], // MetaMask has defaults; you can add one if you want
      blockExplorerUrls: ["https://etherscan.io"],
    },
    bnb: {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      rpcUrls: ["https://bsc-dataseed.binance.org"],
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      blockExplorerUrls: ["https://bscscan.com"],
    },
    arb: {
      chainId: "0xA4B1",
      chainName: "Arbitrum One",
      rpcUrls: ["https://arb1.arbitrum.io/rpc"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      blockExplorerUrls: ["https://arbiscan.io"],
    },
  };

  // Chain IDs for payment links
  const EVM_CHAIN_IDS = { eth: 1, bnb: 56, arb: 42161 };

  // Wallets loaded from backend (/api/wallets)
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

  // Donation UI state
  const donationState = { selectedKey: "btc" };

  // =========================================================
  // 2) OPTIONAL TON CONNECT (kept quiet)
  // =========================================================
  let tonConnectUI = null;
  try {
    if (window.TON_CONNECT_UI?.TonConnectUI) {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: "https://docu-morph.vercel.app/tonconnect-manifest.json",
        buttonRootId: "ton-connect-btn",
      });
    }
  } catch (_) {
    tonConnectUI = null;
  }

  // =========================================================
  // 3) DOM + APP STATE
  // =========================================================
  const appState = {
    view: "convert",
    subTool: "word-to-pdf",
    files: [],
    resultUrl: null,
  };

  const views = {
    convert: document.getElementById("view-convert"),
    compress: document.getElementById("view-compress"),
    resize: document.getElementById("view-resize"),
    merge: document.getElementById("view-merge"),
  };

  const dropZone = document.getElementById("drop-zone");
  const uploadUI = document.getElementById("upload-ui");
  const readyUI = document.getElementById("ready-ui");
  const processUI = document.getElementById("process-ui");
  const successUI = document.getElementById("success-ui");

  const uploadBar = document.getElementById("upload-bar");
  const uploadPercent = document.getElementById("upload-percent");
  const processBar = document.getElementById("process-bar");
  const processPercent = document.getElementById("process-percent");

  const fileInput = document.getElementById("file-input");
  const fileLimits = document.getElementById("file-limits");
  const fileNameDisplay = document.getElementById("file-name-display");

  const startBtn = document.getElementById("start-btn");
  const downloadBtn = document.querySelector(".download-btn");

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  // Wallet UI
  const walletInput = document.getElementById("wallet-address");
  const connectBtn = document.getElementById("connect-wallet-btn");
  const qrBox = document.getElementById("qr-container");
  const qrImg = document.getElementById("crypto-qr");
  const tonBtnRoot = document.getElementById("ton-connect-btn");

  // =========================================================
  // 4) HELPERS
  // =========================================================
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function setText(el, text) {
    if (el) el.innerText = text;
  }

  function safeLowerText(el) {
    return (el?.innerText || "").trim().toLowerCase();
  }

  // BigInt helpers for payment-link amounts (no ethers needed for links)
  function toUnitsBigInt(amountStr, decimals) {
    // "5" or "0.005" => bigint in token units
    const s = String(amountStr || "0").trim();
    if (!s) return 0n;

    const parts = s.split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").slice(0, decimals);

    const fracPadded = frac.padEnd(decimals, "0");
    const wholeBI = BigInt(whole.replace(/[^\d]/g, "") || "0");
    const fracBI = BigInt(fracPadded.replace(/[^\d]/g, "") || "0");
    const base = 10n ** BigInt(decimals);

    return wholeBI * base + fracBI;
  }

  // =========================================================
  // 5) INIT
  // =========================================================
  initCustomDropdowns();
  updateContext("convert", "word-to-pdf");
  initFileInputs();
  fetchSecureWallets();

  try {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  } catch (_) {}

  // Expose handlers used by HTML inline onclick
  window.toggleMenu = toggleMenu;
  window.switchView = switchView;
  window.resetApp = resetApp;
  window.executeProcess = executeProcess;
  window.toggleCompMode = toggleCompMode;
  window.updateRangeLabel = updateRangeLabel;
  window.openModal = openModal;
  window.closeModal = closeModal;

  window.copyWallet = copyWallet;
  window.connectAndDonate = connectAndDonate; // used by button in HTML
  window.submitToFormspree = submitToFormspree;
  window.updateWalletDisplay = updateWalletDisplay; // optional

  // =========================================================
  // 6) LEGAL CLICKWRAP
  // =========================================================
  window.toggleStartButton = function () {
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

  // =========================================================
  // 7) DAILY LIMIT
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
    d.count++;
    try {
      localStorage.setItem("documorph_usage", JSON.stringify(d));
    } catch (_) {}
  }

  // =========================================================
  // 8) NAV + MENU
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
  }

  // =========================================================
  // 9) MODALS
  // =========================================================
  function openModal(type) {
    const container = document.getElementById("modal-container");
    qsa(".modal-body").forEach((el) => el.classList.add("hidden"));

    const target = document.getElementById(`modal-${type}`);
    if (target) target.classList.remove("hidden");

    if (container) container.classList.remove("hidden");
  }

  function closeModal() {
    const c = document.getElementById("modal-container");
    if (c) c.classList.add("hidden");
  }

  // =========================================================
  // 10) FORM (POST -> /api/form)
  // =========================================================
  async function submitToFormspree(e) {
    e.preventDefault();

    const status = document.getElementById("form-status");
    const data = Object.fromEntries(new FormData(e.target).entries());
    setText(status, "Sending...");

    try {
      const r = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (r.ok) {
        setText(status, "Thanks! Request sent.");
        e.target.reset();
      } else {
        setText(status, "Oops! Server error.");
      }
    } catch (_) {
      setText(status, "Network Error.");
    }
  }

  // =========================================================
  // 11) TOOL CONTEXT (input accept + label)
  // =========================================================
  function updateContext(view, val) {
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
          break;
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
    if (fileLimits) fileLimits.innerText = `Supported: ${limitText} • Max 50MB`;
  }

  // =========================================================
  // 12) FILE INPUT + DRAG & DROP
  // =========================================================
  function initFileInputs() {
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        if (fileInput.files?.length) handleFiles(fileInput.files);
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
        if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
      });
    }
  }

  function handleFiles(fileList) {
    appState.files = Array.from(fileList || []);
    if (!appState.files.length) return;

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
        }, 300);
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
    else if (appState.view === "compress") actionText = "Compress Now";
    else if (appState.view === "resize") actionText = "Resize Now";
    else if (appState.view === "merge") actionText = "Merge PDFs";

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

    const legal = document.getElementById("legal-check");
    if (legal) legal.checked = false;
    window.toggleStartButton?.();
  }

  // =========================================================
  // 13) COMPRESS SETTINGS
  // =========================================================
  function toggleCompMode() {
    const mode = qs('input[name="comp-mode"]:checked')?.value;
    const autoBox = document.getElementById("comp-auto-settings");
    const targetBox = document.getElementById("comp-target-settings");
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
    const v = Number(document.getElementById("compression-range")?.value || 4);
    const out = document.getElementById("compression-text");
    if (out) out.innerText = labels[v - 1] || "Balanced";
  }

  // =========================================================
  // 14) START PROCESS
  // =========================================================
  function executeProcess() {
    if (!checkDailyLimit()) return;

    readyUI?.classList.add("hidden");
    processUI?.classList.remove("hidden");

    const title = document.getElementById("process-title");
    if (title) title.innerText = "Processing...";

    processFilesWithProxy();
  }

  // =========================================================
  // 15) SUCCESS UI
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

    setTimeout(() => openModal("support"), 1500);
  }

  // =========================================================
  // 16) CONVERSION PIPELINE (POST -> /api/convert)
  // =========================================================
  function resolveConvertTypeAndParams(formData, file) {
    const ext = file.name.split(".").pop().toLowerCase();
    let type = "";

    if (appState.view === "convert") {
      if (appState.subTool === "word-to-pdf") type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
      else if (appState.subTool === "pdf-to-word") type = "pdf/to/docx";
      else if (appState.subTool === "excel-to-pdf") type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
      else if (appState.subTool === "pdf-to-excel") type = "pdf/to/xlsx";
      else if (appState.subTool === "jpg-to-png") type = "jpg/to/png";
      else if (appState.subTool === "png-to-jpg") type = "png/to/jpg";
    }

    if (appState.view === "compress") {
      type = appState.subTool === "comp-pdf" ? "pdf/to/compress" : "jpg/to/compress";

      const mode = qs('input[name="comp-mode"]:checked')?.value || "auto";
      if (mode === "auto") {
        const s = Number(document.getElementById("compression-range")?.value || 4);

        if (s <= 3) formData.append("Preset", "screen");
        else if (s <= 6) formData.append("Preset", "ebook");
        else formData.append("Preset", "printer");

        if (type === "jpg/to/compress") formData.append("Quality", String(s * 10));
      } else {
        formData.append("Preset", "screen");
      }
    }

    if (appState.view === "resize") {
      type = "jpg/to/jpg";

      const w = document.getElementById("resize-w")?.value;
      const h = document.getElementById("resize-h")?.value;

      if (w) formData.append("ImageWidth", w);
      if (h) formData.append("ImageHeight", h);
    }

    if (appState.view === "merge") {
      type = "pdf/to/merge";
    }

    return type;
  }

  function processFilesWithProxy() {
    const first = appState.files[0];
    if (!first) {
      alert("No file selected!");
      resetApp();
      return;
    }

    const formData = new FormData();
    formData.append("StoreFile", "true");

    if (appState.view === "merge") {
      appState.files.forEach((f, i) => formData.append(`Files[${i}]`, f));
    } else {
      formData.append("File", first);
    }

    const type = resolveConvertTypeAndParams(formData, first);
    if (!type) {
      alert("Tool type not recognized. Please reselect your tool.");
      resetApp();
      return;
    }

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
        return;
      }

      try {
        const d = JSON.parse(xhr.responseText);
        if (d?.Files?.length) {
          appState.resultUrl = d.Files[0].Url;
          incrementUsage();
          showSuccess(d.Files[0].FileName);
          return;
        }
        alert("Conversion returned no file.");
        resetApp();
      } catch (_) {
        alert("Error parsing response.");
        resetApp();
      }
    };

    xhr.onerror = () => {
      alert("Network Error");
      resetApp();
    };

    xhr.send(formData);
  }

  // =========================================================
  // 17) DROPDOWNS
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
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });

      options.forEach((opt) => {
        opt.setAttribute("tabindex", "0");

        const select = (e) => {
          e?.preventDefault?.();
          e?.stopPropagation?.();

          const val = opt.getAttribute("data-value");
          if (!val) return;

          // Donation coin dropdown
          if (dd.id === "crypto-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;

            const usdtGroup = document.getElementById("usdt-network-group");
            if (val === "usdt") {
              usdtGroup?.classList.remove("hidden");
              updateWalletDisplay("usdt-eth"); // default USDT network
            } else {
              usdtGroup?.classList.add("hidden");
              updateWalletDisplay(val); // btc/eth/bnb/sol/ton/tron
            }
          }
          // USDT network dropdown
          else if (dd.id === "network-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateWalletDisplay(val); // usdt-eth/usdt-bnb/usdt-trc/usdt-sol/usdt-ton/usdt-arb
          }
          // Tool dropdowns
          else if (dd.id !== "resize-scale-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateContext(appState.view, val);
          }
          // Resize scale dropdown is UI-only
          else {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
          }

          dd.classList.remove("open");
          dd.focus();
        };

        opt.addEventListener("click", select);
        opt.addEventListener("keydown", (e) => {
          if (e.key === "Enter") select(e);
        });
      });
    });

    window.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-select")) dropdowns.forEach((d) => d.classList.remove("open"));
    });
  }

  // =========================================================
  // 18) LOAD WALLETS (GET /api/wallets)
  // =========================================================
  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) return;

      CRYPTO_WALLETS = await response.json();
      updateWalletDisplay(donationState.selectedKey || "btc");
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

    return CRYPTO_WALLETS.eth || "Address Not Set";
  }

  // =========================================================
  // 19) WALLET UI (ONE BUTTON) — TON STAYS “CONNECT WALLET”
  // =========================================================
  function isUsdtKey(k) {
    return k === "usdt-eth" || k === "usdt-bnb" || k === "usdt-arb";
  }

  function getChainKeyForDonateKey(k) {
    if (k === "bnb" || k === "usdt-bnb") return "bnb";
    if (k === "usdt-arb") return "arb";
    return "eth";
  }

  // ERC-681 link builder (mobile “direct pay”)
  function buildPaymentLink(donateKey, toAddress) {
    const chainKey = getChainKeyForDonateKey(donateKey);
    const chainId = EVM_CHAIN_IDS[chainKey] || 1;

    // Native (ETH/BNB)
    if (donateKey === "eth" || donateKey === "bnb") {
      const amount = donateKey === "bnb" ? DONATION_DEFAULTS.bnb : DONATION_DEFAULTS.eth;
      const valueWei = toUnitsBigInt(amount, 18).toString();
      // MetaMask-friendly
      return `ethereum:pay-${toAddress}@${chainId}?value=${valueWei}`;
    }

    // USDT (EVM)
    if (isUsdtKey(donateKey)) {
      const token = USDT_CONTRACTS[donateKey];
      const decimals = USDT_DECIMALS[donateKey];
      if (!token || typeof decimals !== "number") return null;

      const unitAmount = toUnitsBigInt(DONATION_DEFAULTS.usdt, decimals).toString();
      return `ethereum:${token}@${chainId}/transfer?address=${toAddress}&uint256=${unitAmount}`;
    }

    return null;
  }

  function updateWalletDisplay(key) {
    donationState.selectedKey = key;

    if (!walletInput || !connectBtn) return;

    const address = mapWalletAddressForKey(key) || "Address Not Set";
    walletInput.value = address;

    // Hide TonConnect UI root by default (you can still keep it in DOM)
    if (tonBtnRoot) tonBtnRoot.style.display = "none";

    // QR: for EVM show payment link QR, otherwise address QR
    const isEvm = ["eth", "bnb", "usdt-eth", "usdt-bnb", "usdt-arb"].includes(key);
    const payLink = isEvm ? buildPaymentLink(key, address) : null;

    if (qrBox && qrImg && address !== "Address Not Set" && address !== "Loading...") {
      qrBox.classList.remove("hidden");
      const data = payLink || address;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
    } else if (qrBox) {
      qrBox.classList.add("hidden");
    }

    const isTon = key === "ton" || key === "usdt-ton";
    const isCopyOnly = ["btc", "sol", "tron", "usdt-trc", "usdt-sol"].includes(key);

    connectBtn.style.display = "block";

    // TON: keep the label as “Connect Wallet” (your request)
    if (isTon) {
      connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
      connectBtn.onclick = connectTonkeeper;
      return;
    }

    // EVM: also keep “Connect Wallet”
    if (isEvm) {
      connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
      connectBtn.onclick = connectAndDonate;
      return;
    }

    // Copy-only coins
    if (isCopyOnly) {
      connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
      connectBtn.onclick = copyWallet;
      return;
    }

    // fallback
    connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
    connectBtn.onclick = copyWallet;
  }

  function copyWallet() {
    const input = document.getElementById("wallet-address");
    const feedback = document.getElementById("copy-feedback");

    if (!input || input.value === "Loading...") return;

    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);

    if (feedback) {
      feedback.classList.add("visible");
      setTimeout(() => feedback.classList.remove("visible"), 2000);
    }
  }

  // =========================================================
  // 20) TONKEEPER
  // =========================================================
  function redirectToTonkeeperInstall() {
    window.open("https://tonkeeper.com/", "_blank", "noopener,noreferrer");
  }

  function tonkeeperTransferLink(to, tonAmount, memoText) {
    const nano = Math.floor(Number(tonAmount) * 1e9);
    const text = encodeURIComponent(memoText || "DocuMorph Support");
    return `https://app.tonkeeper.com/transfer/${encodeURIComponent(to)}?amount=${nano}&text=${text}`;
  }

  function connectTonkeeper() {
    const donateKey = donationState.selectedKey || "ton";
    const address = mapWalletAddressForKey(donateKey);

    if (!address || address === "Loading..." || address === "Address Not Set") {
      alert("TON wallet address not ready yet. Please try again in a moment.");
      return;
    }

    // USDT-TON is Jetton → manual
    if (donateKey === "usdt-ton") {
      alert("USDT on TON is best sent manually in Tonkeeper. I’ll open Tonkeeper and you can paste the address.");
      redirectToTonkeeperInstall();
      copyWallet();
      return;
    }

    // Keep your original reliable Tonkeeper flow
    const link = tonkeeperTransferLink(address, DONATION_DEFAULTS.ton, "DocuMorph Support");
    window.open(link, "_blank", "noopener,noreferrer");

    // TonConnect stays optional/quiet (no UI change required)
    try {
      if (tonConnectUI && tonBtnRoot) {
        // you can later show tonBtnRoot if you want, but we keep it hidden
      }
    } catch (_) {}
  }

  // =========================================================
  // 21) METAMASK (Mobile direct-pay link + Desktop injected provider)
  // =========================================================
  function redirectToMetaMaskInstall() {
    window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
  }

  function openInMetaMaskDappBrowser() {
    const dapp = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `https://metamask.app.link/dapp/${dapp}`;
  }

  async function ensureEvmChain(chainKey) {
    const cfg = EVM_CHAINS[chainKey];
    if (!cfg) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: cfg.chainId }],
      });
    } catch (err) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: cfg.chainId,
              chainName: cfg.chainName,
              rpcUrls: cfg.rpcUrls,
              nativeCurrency: cfg.nativeCurrency,
              blockExplorerUrls: cfg.blockExplorerUrls,
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }

  async function connectAndDonate() {
    const donateKey = donationState.selectedKey || "eth";
    const toAddress = mapWalletAddressForKey(donateKey);

    if (!toAddress || toAddress === "Loading..." || toAddress === "Address Not Set") {
      alert("Wallet address not ready yet. Please try again in a moment.");
      return;
    }

    const chainKey = getChainKeyForDonateKey(donateKey);

    // MOBILE / NO INJECTED PROVIDER:
    // behave like TON: open a direct payment link first
    if (typeof window.ethereum === "undefined") {
      if (isMobile()) {
        const link = buildPaymentLink(donateKey, toAddress);
        if (link) {
          // tries to open MetaMask (or any EVM wallet that supports EIP-681)
          window.location.href = link;
          return;
        }

        // fallback to MetaMask in-app browser
        alert("Opening MetaMask… If it doesn’t auto-fill, you can pay by copying the address.");
        openInMetaMaskDappBrowser();
        return;
      }

      alert("MetaMask extension not detected. Opening MetaMask download…");
      redirectToMetaMaskInstall();
      copyWallet();
      return;
    }

    // DESKTOP / INJECTED PROVIDER FLOW (uses ethers)
    if (!window.ethers) {
      alert("Ethers library not loaded. Please refresh the page and try again.");
      copyWallet();
      return;
    }

    try {
      await ensureEvmChain(chainKey);

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      let txHash = "";

      if (isUsdtKey(donateKey)) {
        const contractAddr = USDT_CONTRACTS[donateKey];
        if (!contractAddr) throw new Error("USDT contract missing");

        const ERC20_ABI = [
          "function decimals() view returns (uint8)",
          "function transfer(address to, uint256 amount) returns (bool)",
        ];

        const token = new window.ethers.Contract(contractAddr, ERC20_ABI, signer);
        const decimals = await token.decimals();
        const amount = window.ethers.utils.parseUnits(String(DONATION_DEFAULTS.usdt), decimals);

        const tx = await token.transfer(toAddress, amount);
        txHash = tx.hash;
      } else {
        const amount = donateKey === "bnb" ? DONATION_DEFAULTS.bnb : DONATION_DEFAULTS.eth;

        const tx = await signer.sendTransaction({
          to: toAddress,
          value: window.ethers.utils.parseEther(String(amount)),
        });

        txHash = tx.hash;
      }

      alert("Payment sent! Tx Hash: " + txHash);
    } catch (err) {
      console.error(err);
      alert("Payment cancelled/failed. You can copy the address instead.");
      copyWallet();
    }
  }

  // =========================================================
  // 22) DROPDOWN DEFAULTS
  // =========================================================
  // Ensure wallet UI is usable even before /api/wallets returns
  updateWalletDisplay("btc");
})();
