/* =========================================================
   DocuMorph — Main Frontend Logic (scripts.js)
   Author: Samson Eniolorunda
   ---------------------------------------------------------
   Purpose:
   - Runs the DocuMorph UI (Convert / Compress / Resize / Merge).
   - Handles file selection + drag & drop, progress UI, and downloads.
   - Enforces a daily usage limit via localStorage.
   - Integrates:
     1) ConvertAPI via your secure Vercel proxy (/api/convert)
     2) Wallet addresses via secure endpoint (/api/wallets)
     3) Feature request form via secure endpoint (/api/form)
     4) Wallet connect flows (MetaMask via ethers, TON via TonConnect UI)

   Main Sections:
   - Configuration + app state
   - Wallet loading + donation UI logic
   - Dropdown UX (click + keyboard)
   - Modals + tabs
   - Daily limit tracking
   - File processing pipeline (build ConvertAPI "type" + upload -> result)
   ========================================================= */

(() => {
  "use strict";

  // =========================================================
  // 1) CONFIGURATION (limits + defaults)
  // =========================================================

  // Daily conversion limit (stored locally per device)
  const DAILY_LIMIT = 5;

  // NOTE:
  // You should NOT hard-code secrets like Formspree IDs in frontend code.
  // Keep them in Vercel env vars and call your /api/form endpoint instead.
  // This constant is kept only because it was in your snippet.
  const FORMSPREE_ID = "YOUR_FORMSPREE_ID"; // <--- PASTE ID (avoid in production)

  // Wallets are loaded from your secure backend (/api/wallets)
  // Default placeholder values are shown until fetch completes.
  let CRYPTO_WALLETS = {
    btc: "Loading...",
    eth: "Loading...",
    usdt: "Loading...",
    sol: "Loading...",
    ton: "Loading...",
    tron: "Loading...",
  };

  // =========================================================
  // 2) TON CONNECT (TON wallet integration)
  // =========================================================
  const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    // TonConnect manifest hosted on your domain
    manifestUrl: "https://documorph.vercel.app/tonconnect-manifest.json",
    // The element where TonConnect renders its button
    buttonRootId: "ton-connect-btn",
  });

  // =========================================================
  // 3) DOM REFERENCES + APP STATE
  // =========================================================

  // Global app state for selected tool + files + result URL
  const appState = {
    view: "convert",
    subTool: "word-to-pdf",
    files: [],
    resultUrl: null,
  };

  // View containers (each section is shown/hidden based on active tool)
  const views = {
    convert: document.getElementById("view-convert"),
    compress: document.getElementById("view-compress"),
    resize: document.getElementById("view-resize"),
    merge: document.getElementById("view-merge"),
  };

  // Core UI blocks
  const dropZone = document.getElementById("drop-zone");
  const uploadUI = document.getElementById("upload-ui");
  const readyUI = document.getElementById("ready-ui");
  const processUI = document.getElementById("process-ui");
  const successUI = document.getElementById("success-ui");

  // Progress bars + labels
  const uploadBar = document.getElementById("upload-bar");
  const uploadPercent = document.getElementById("upload-percent");
  const processBar = document.getElementById("process-bar");
  const processPercent = document.getElementById("process-percent");

  // File inputs + labels
  const fileInput = document.getElementById("file-input");
  const fileLimits = document.getElementById("file-limits");
  const fileNameDisplay = document.getElementById("file-name-display");

  // Action buttons
  const startBtn = document.getElementById("start-btn");
  const downloadBtn = document.querySelector(".download-btn");

  // Mobile menu controls
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  // =========================================================
  // 4) INITIALIZATION (runs once on load)
  // =========================================================

  // Enable custom dropdown behaviour (mouse + keyboard)
  initCustomDropdowns();

  // Set default tool context for file type accept + UI labels
  updateContext("convert", "word-to-pdf");

  // Load secure wallet addresses from backend
  fetchSecureWallets();

  // Update footer year (safe-guarded)
  try {
    document.getElementById("year").textContent = new Date().getFullYear();
  } catch (e) {}

  // =========================================================
  // 5) LEGAL CLICKWRAP (enable/disable Start button)
  // =========================================================
  window.toggleStartButton = function () {
    const checkbox = document.getElementById("legal-check");
    const btn = document.getElementById("start-btn");

    if (!checkbox || !btn) return;

    if (checkbox.checked) {
      btn.classList.remove("disabled");
      btn.removeAttribute("disabled");
      return;
    }

    btn.classList.add("disabled");
    btn.setAttribute("disabled", "true");
  };

  // =========================================================
  // 6) WALLETS (load + show address + donation UI)
  // =========================================================

  // Fetch wallet addresses from your Vercel API endpoint
  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) return;

      CRYPTO_WALLETS = await response.json();
      updateWalletDisplay("btc"); // Default coin view
    } catch (e) {
      console.error("Wallet load failed");
    }
  }

  // Update wallet address field + QR + connect button behaviour
  function updateWalletDisplay(key) {
    const walletInput = document.getElementById("wallet-address");
    const connectBtn = document.getElementById("connect-wallet-btn");
    const tonBtn = document.getElementById("ton-connect-btn");
    const qrBox = document.getElementById("qr-container");
    const qrImg = document.getElementById("crypto-qr");

    if (!walletInput) return;

    // Default fallback if a wallet is missing
    let address = "Address Not Set";

    // Standard coins
    if (key === "btc") address = CRYPTO_WALLETS["btc"];
    else if (key === "eth") address = CRYPTO_WALLETS["eth"];
    else if (key === "bnb") address = CRYPTO_WALLETS["bnb"];
    else if (key === "sol") address = CRYPTO_WALLETS["sol"];
    else if (key === "ton") address = CRYPTO_WALLETS["ton"];
    else if (key === "tron") address = CRYPTO_WALLETS["tron"];

    // USDT networks
    else if (key === "usdt-eth") address = CRYPTO_WALLETS["usdt_eth"];
    else if (key === "usdt-bnb") address = CRYPTO_WALLETS["usdt_bnb"];
    else if (key === "usdt-trc") address = CRYPTO_WALLETS["usdt_trc"];
    else if (key === "usdt-sol") address = CRYPTO_WALLETS["usdt_sol"];
    else if (key === "usdt-ton") address = CRYPTO_WALLETS["usdt_ton"];
    else if (key === "usdt-arb") address = CRYPTO_WALLETS["usdt_arb"];

    // Fallback (if something unknown is passed in)
    else address = CRYPTO_WALLETS["eth"];

    // Render wallet address
    walletInput.value = address;

    // Render QR only when an actual address exists
    if (qrBox && qrImg && address !== "Address Not Set" && address !== "Loading...") {
      qrBox.classList.remove("hidden");
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${address}`;
    }

    // Decide which connect option to show
    if (connectBtn && tonBtn) {
      connectBtn.style.display = "none";
      tonBtn.style.display = "none";

      // 1) TON network -> TonConnect button
      if (key === "ton" || key === "usdt-ton") {
        tonBtn.style.display = "flex";
      }
      // 2) EVM networks -> MetaMask connect
      else if (["eth", "bnb", "matic", "arb", "usdt-eth", "usdt-bnb", "usdt-arb"].includes(key)) {
        connectBtn.style.display = "block";
        connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
        connectBtn.onclick = connectAndDonate;
      }
      // 3) Non-EVM (BTC/SOL/TRON) -> copy only
      else {
        connectBtn.style.display = "block";
        connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
        connectBtn.onclick = copyWallet;
      }
    }
  }

  // =========================================================
  // 7) CONNECT + DONATE (EVM ONLY via MetaMask/ethers)
  // =========================================================
  window.connectAndDonate = async function () {
    if (typeof window.ethereum === "undefined") {
      alert("MetaMask not detected. Please copy the address.");
      copyWallet();
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = provider.getSigner();

      // NOTE:
      // You’re currently sending to the ETH wallet always.
      // If you want it to send to selected coin, you’ll need
      // to track the current key and choose address accordingly.
      const target = CRYPTO_WALLETS["eth"];

      // Fixed donation value (0.005 ETH) — change if needed
      const tx = await signer.sendTransaction({
        to: target,
        value: ethers.utils.parseEther("0.005"),
      });

      alert("Transaction Sent! Hash: " + tx.hash);
    } catch (err) {
      alert("Connection failed. Please copy the address manually.");
      copyWallet();
    }
  };

  // Copy wallet address to clipboard + show UI feedback
  window.copyWallet = function () {
    const input = document.getElementById("wallet-address");
    const feedback = document.getElementById("copy-feedback");

    if (!input || input.value === "Loading...") return;

    input.select();
    navigator.clipboard.writeText(input.value);

    if (feedback) {
      feedback.classList.add("visible");
      setTimeout(() => feedback.classList.remove("visible"), 2000);
    }
  };

  // =========================================================
  // 8) DROPDOWNS (custom-select: click + keyboard)
  // =========================================================
  function initCustomDropdowns() {
    const dropdowns = document.querySelectorAll(".custom-select");

    dropdowns.forEach((dd) => {
      const trigger = dd.querySelector(".select-trigger");
      const triggerText = dd.querySelector(".trigger-text");
      const options = dd.querySelectorAll(".option");

      // Toggle dropdown open/close and close others
      const toggle = () => {
        const isOpen = dd.classList.contains("open");
        dropdowns.forEach((d) => d.classList.remove("open"));
        if (!isOpen) dd.classList.add("open");
      };

      // Mouse open/close
      if (trigger) trigger.addEventListener("click", toggle);

      // Keyboard open/close (Enter/Space)
      dd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      // Selecting an option
      options.forEach((opt) => {
        opt.setAttribute("tabindex", "0");

        const select = () => {
          const val = opt.getAttribute("data-value");

          // Crypto dropdown (supports USDT network selector)
          if (dd.id === "crypto-dropdown") {
            triggerText.innerHTML = opt.innerHTML;

            const usdtGroup = document.getElementById("usdt-network-group");
            if (val === "usdt") {
              if (usdtGroup) usdtGroup.classList.remove("hidden");
              updateWalletDisplay("usdt-eth"); // default USDT network
            } else {
              if (usdtGroup) usdtGroup.classList.add("hidden");
              updateWalletDisplay(val);
            }
          }
          // USDT network dropdown
          else if (dd.id === "network-dropdown") {
            triggerText.innerHTML = opt.innerHTML;
            updateWalletDisplay(val);
          }
          // General tool dropdowns (convert/compress/merge)
          else if (dd.id !== "resize-scale-dropdown") {
            triggerText.innerHTML = opt.innerHTML;
            updateContext(appState.view, val);
          }
          // Resize scale dropdown (UI only, used later in processing)
          else {
            triggerText.innerHTML = opt.innerHTML;
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

    // Close dropdown if user clicks outside
    window.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-select")) {
        dropdowns.forEach((d) => d.classList.remove("open"));
      }
    });
  }

  // =========================================================
  // 9) SUCCESS UI + AUTO SUPPORT POPUP
  // =========================================================
  function showSuccess(filename) {
    if (processUI) processUI.classList.add("hidden");
    if (successUI) successUI.classList.remove("hidden");

    // Configure download button to open generated file URL
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = appState.resultUrl;
        link.download = filename;
        link.target = "_blank";
        link.click();
      };
    }

    // Auto-open Support modal after success
    setTimeout(() => {
      openModal("support");
      switchSupportTab("donate");
    }, 1500);
  }

  // =========================================================
  // 10) FEATURE REQUEST FORM (POST -> /api/form)
  // =========================================================
  window.submitToFormspree = async function (e) {
    e.preventDefault();

    const status = document.getElementById("form-status");
    const data = Object.fromEntries(new FormData(e.target).entries());

    if (status) status.innerText = "Sending...";

    try {
      const r = await fetch("/api/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (r.ok) {
        if (status) status.innerText = "Sent!";
        e.target.reset();
      } else {
        if (status) status.innerText = "Error.";
      }
    } catch (_) {
      if (status) status.innerText = "Network Error.";
    }
  };

  // =========================================================
  // 11) SUPPORT TABS + MODALS
  // =========================================================

  // Switch between support modal tabs
  window.switchSupportTab = function (n) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));

    // NOTE: "event" is used here from the inline onclick handler context
    event.currentTarget.classList.add("active");
    document.getElementById(`tab-${n}`).classList.remove("hidden");
  };

  // Open any modal section (terms/privacy/request/support)
  window.openModal = function (t) {
    const container = document.getElementById("modal-container");

    // Hide all modal bodies first
    document.querySelectorAll(".modal-body").forEach((el) => el.classList.add("hidden"));

    const target = document.getElementById(`modal-${t}`);
    if (target) target.classList.remove("hidden");
    if (container) container.classList.remove("hidden");
  };

  // Close modal container
  window.closeModal = function () {
    const c = document.getElementById("modal-container");
    if (c) c.classList.add("hidden");
  };

  // =========================================================
  // 12) DAILY LIMIT (localStorage counter)
  // =========================================================
  function checkDailyLimit() {
    try {
      const today = new Date().toLocaleDateString();
      let d = JSON.parse(localStorage.getItem("documorph_usage")) || { date: today, count: 0 };

      if (d.date !== today) d = { date: today, count: 0 };

      if (d.count >= DAILY_LIMIT) {
        alert("Daily limit reached.");
        return false;
      }

      return true;
    } catch (_) {
      // If storage fails, allow usage (fail-open)
      return true;
    }
  }

  function incrementUsage() {
    try {
      const today = new Date().toLocaleDateString();
      let d = JSON.parse(localStorage.getItem("documorph_usage")) || { date: today, count: 0 };

      if (d.date !== today) d = { date: today, count: 0 };

      d.count++;
      localStorage.setItem("documorph_usage", JSON.stringify(d));
    } catch (_) {}
  }

  // =========================================================
  // 13) NAV + MENU CONTROLS
  // =========================================================
  window.switchView = function (n) {
    appState.view = n;

    // Highlight active top nav button
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.innerText.toLowerCase() === n);
    });

    // Hide all view sections then show selected
    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    if (views[n]) views[n].classList.remove("hidden");

    // Reset UI state and update accept filters for the new view
    window.resetApp();

    const firstOption = views[n] ? views[n].querySelector(".option") : null;
    updateContext(n, firstOption ? firstOption.getAttribute("data-value") : null);
  };

  window.toggleMenu = function () {
    if (menuToggle) menuToggle.classList.toggle("open");
    if (mobileMenu) mobileMenu.classList.toggle("active");
  };

  // =========================================================
  // 14) RESET + START PROCESS
  // =========================================================
  window.resetApp = function () {
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

    // Reset legal checkbox + button state
    const legal = document.getElementById("legal-check");
    if (legal) legal.checked = false;
    window.toggleStartButton();
  };

  // Start processing (called after user agrees to Terms)
  window.executeProcess = function () {
    if (!checkDailyLimit()) return;

    if (readyUI) readyUI.classList.add("hidden");
    if (processUI) processUI.classList.remove("hidden");

    const title = document.getElementById("process-title");
    if (title) title.innerText = "Processing...";

    processFilesWithProxy();
  };

  // Toggle compress mode UI (auto vs target)
  window.toggleCompMode = function () {
    const m = document.querySelector('input[name="comp-mode"]:checked').value;
    const a = document.getElementById("comp-auto-settings");
    const t = document.getElementById("comp-target-settings");

    if (!a || !t) return;

    if (m === "auto") {
      a.classList.remove("hidden");
      t.classList.add("hidden");
      return;
    }

    a.classList.add("hidden");
    t.classList.remove("hidden");
  };

  // Update compress slider label text (Smallest -> Best Quality)
  window.updateRangeLabel = function () {
    const labels = ["Smallest", "Small", "Compact", "Balanced", "Balanced", "Better", "Good", "Great", "Best Quality"];
    const v = document.getElementById("compression-range").value;

    const out = document.getElementById("compression-text");
    if (out) out.innerText = labels[v - 1] || "Balanced";
  };

  // =========================================================
  // 15) TOOL CONTEXT (accept filters + “Supported” label)
  // =========================================================
  function updateContext(view, val) {
    // Update active sub-tool (e.g., word-to-pdf, comp-pdf, merge-pdf)
    appState.subTool = val;

    // Defaults (safe fallback)
    let accept = "*";
    let limitText = "Files";

    // Convert tools
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
      }
    }

    // Compress tools
    else if (view === "compress") {
      if (val === "comp-pdf") {
        accept = ".pdf";
        limitText = "PDF Files";
      } else {
        accept = "image/*";
        limitText = "Images";
      }
    }

    // Resize tools
    else if (view === "resize") {
      accept = "image/*";
      limitText = "Images";
    }

    // Merge tools
    else if (view === "merge") {
      accept = ".pdf";
      limitText = "PDF Files";
    }

    // Apply accept filter + UI label
    if (fileInput) fileInput.setAttribute("accept", accept);
    if (fileLimits) fileLimits.innerText = `Supported: ${limitText} • Max 50MB`;
  }

  // =========================================================
  // 16) FILE INPUT + DRAG & DROP
  // =========================================================

  // File picker
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) handleFiles(fileInput.files);
    });
  }

  // Drag and drop
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
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
  }

  // Simulate upload UI progress, then show ready screen
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

  // Update ready UI file label + start button text
  function showReadyScreen() {
    if (readyUI) readyUI.classList.remove("hidden");

    if (fileNameDisplay) {
      fileNameDisplay.innerText =
        appState.files.length === 1 ? appState.files[0].name : `${appState.files.length} files`;
    }

    let actionText = "Start";
    if (appState.view === "convert") actionText = "Convert Now";
    else if (appState.view === "compress") actionText = "Compress Now";
    else if (appState.view === "resize") actionText = "Resize Now";
    else if (appState.view === "merge") actionText = "Merge PDFs";

    if (startBtn) startBtn.innerText = actionText;
  }

  // =========================================================
  // 17) CONVERSION PIPELINE (POST -> /api/convert)
  // =========================================================
  function processFilesWithProxy() {
    const file = appState.files[0];
    if (!file) {
      alert("No file selected!");
      window.resetApp();
      return;
    }

    const formData = new FormData();
    const ext = file.name.split(".").pop().toLowerCase();

    // Default ConvertAPI expects "File" for single file tools
    formData.append("File", file);
    formData.append("StoreFile", "true");

    // ConvertAPI "type" route (example: docx/to/pdf)
    let type = "";

    // ----------------------------
    // Convert tools
    // ----------------------------
    if (appState.subTool === "word-to-pdf") type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
    else if (appState.subTool === "pdf-to-word") type = "pdf/to/docx";
    else if (appState.subTool === "excel-to-pdf") type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
    else if (appState.subTool === "pdf-to-excel") type = "pdf/to/xlsx";
    else if (appState.subTool === "jpg-to-png") type = "jpg/to/png";
    else if (appState.subTool === "png-to-jpg") type = "png/to/jpg";

    // ----------------------------
    // Compress tools
    // ----------------------------
    else if (appState.view === "compress") {
      type = appState.subTool === "comp-pdf" ? "pdf/to/compress" : "jpg/to/compress";

      const mode = document.querySelector('input[name="comp-mode"]:checked').value;

      // Auto preset based on slider
      if (mode === "auto") {
        const s = document.getElementById("compression-range").value;

        if (s <= 3) formData.append("Preset", "screen");
        else if (s <= 6) formData.append("Preset", "ebook");
        else formData.append("Preset", "printer");

        // If compressing image, also set quality
        if (type === "jpg/to/compress") formData.append("Quality", s * 10);
      } else {
        // Target-size logic placeholder (kept simple to avoid wrong output)
        formData.append("Preset", "screen");
      }
    }

    // ----------------------------
    // Resize tool
    // ----------------------------
    else if (appState.view === "resize") {
      type = "jpg/to/jpg";

      const w = document.getElementById("resize-w").value;
      const h = document.getElementById("resize-h").value;

      if (w) formData.append("ImageWidth", w);
      if (h) formData.append("ImageHeight", h);

      // If no width/height, try scale dropdown text
      if (!w && !h) {
        const label = document.querySelector("#resize-scale-dropdown .trigger-text")?.innerText || "";
        if (label.includes("75")) formData.append("ScaleImage", "75");
        if (label.includes("25")) formData.append("ScaleImage", "25");
      }
    }

    // ----------------------------
    // Merge tool
    // ----------------------------
    else if (appState.view === "merge") {
      type = "pdf/to/merge";
      formData.delete("File"); // ConvertAPI merge expects Files[] array
      appState.files.forEach((f, i) => formData.append(`Files[${i}]`, f));
    }

    // ----------------------------
    // Make request via XHR to show upload progress
    // ----------------------------
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/convert?type=${type}`, true);

    // Upload progress -> process bar
    xhr.upload.onprogress = function (e) {
      if (!e.lengthComputable) return;

      const p = Math.round((e.loaded / e.total) * 100);
      if (processBar) processBar.style.width = p + "%";
      if (processPercent) processPercent.innerText = p + "%";
    };

    // Response handling
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          const d = JSON.parse(xhr.responseText);

          // ConvertAPI returns Files array when StoreFile=true
          if (d.Files && d.Files.length > 0) {
            appState.resultUrl = d.Files[0].Url;
            incrementUsage();
            showSuccess(d.Files[0].FileName);
            return;
          }

          throw new Error("API error");
        } catch (e) {
          alert("Error parsing response");
          window.resetApp();
        }
      } else {
        alert("Failed: " + xhr.status);
        window.resetApp();
      }
    };

    xhr.onerror = function () {
      alert("Network Error");
      window.resetApp();
    };

    xhr.send(formData);
  }
})();
