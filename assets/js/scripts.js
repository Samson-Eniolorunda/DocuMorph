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
     4) Wallet flows:
        - MetaMask (Desktop extension + Mobile deep-link)
        - TON / Tonkeeper (Tonkeeper deep-link + TonConnect UI when available)

   Notes:
   - Mobile MetaMask: window.ethereum only exists inside MetaMask in-app browser.
     So when users are on normal Chrome/Safari mobile, we deep-link them into MetaMask.
   - TON: TonConnect can work, but Tonkeeper deep-link is the most reliable fallback.
   ========================================================= */
   
(() => {
  "use strict";

  // =========================================================
  // 1) CONFIG
  // =========================================================
  const DAILY_LIMIT = 5;

  // Default donation amounts (adjust anytime)
  const DONATION_DEFAULTS = {
    eth: "0.005",
    arb: "0.005", // Arbitrum native is ETH
    bnb: "0.01",
    ton: "0.5",
    usdt: "5",
  };

  // USDT contracts (EVM only)
  const USDT_CONTRACTS = {
    "usdt-eth": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "usdt-bnb": "0x55d398326f99059fF775485246999027B3197955",
    "usdt-arb": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  };

  // Chains for MetaMask switching
  const EVM_CHAINS = {
    eth: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [],
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

  // Wallets loaded from your backend (/api/wallets)
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

  // Current donation selection
  const donationState = { selectedKey: "btc" };

  // =========================================================
  // 2) OPTIONAL TON CONNECT (kept quiet, no button shown)
  // =========================================================
  let tonConnectUI = null;

  try {
    if (window.TON_CONNECT_UI?.TonConnectUI) {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: "https://docu-morph.vercel.app/tonconnect-manifest.json",
        buttonRootId: "ton-connect-btn", // hidden by CSS
      });
    }
  } catch (_) {
    tonConnectUI = null;
  }

  // =========================================================
  // 3) DOM + APP STATE
  // =========================================================
  const appState = { view: "convert", subTool: "word-to-pdf", files: [], resultUrl: null };

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

  // =========================================================
  // 4) INIT
  // =========================================================
  initCustomDropdowns();
  updateContext("convert", "word-to-pdf");
  fetchSecureWallets();

  try {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  } catch (_) {}

  // =========================================================
  // 5) HELPERS
  // =========================================================
  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function setText(el, text) {
    if (el) el.innerText = text;
  }

  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return document.querySelectorAll(sel);
  }

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
  // 7) LOAD WALLETS
  // =========================================================
  async function fetchSecureWallets() {
    try {
      const response = await fetch("/api/wallets");
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

    return CRYPTO_WALLETS.eth || "Address Not Set";
  }

  // This controls what the single connect button does
  function updateWalletDisplay(key) {
    donationState.selectedKey = key;

    if (!walletInput || !connectBtn) return;

    const address = mapWalletAddressForKey(key) || "Address Not Set";
    walletInput.value = address;

    // QR
    if (qrBox && qrImg && address !== "Address Not Set" && address !== "Loading...") {
      qrBox.classList.remove("hidden");
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}`;
    } else if (qrBox) {
      qrBox.classList.add("hidden");
    }

    // Decide action per selection (ONE BUTTON ONLY)
    const isTon = key === "ton" || key === "usdt-ton";
    const isEvm = ["eth", "bnb", "arb", "usdt-eth", "usdt-bnb", "usdt-arb"].includes(key);
    const isCopyOnly = ["btc", "sol", "tron", "usdt-trc", "usdt-sol"].includes(key);

    connectBtn.style.display = "block";

    if (isTon) {
      connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
      connectBtn.onclick = connectTonkeeper;
      return;
    }

    if (isEvm) {
      connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Connect Wallet';
      connectBtn.onclick = connectAndDonate;
      return;
    }

    if (isCopyOnly) {
      connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
      connectBtn.onclick = copyWallet;
      return;
    }

    // Fallback
    connectBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Address';
    connectBtn.onclick = copyWallet;
  }

  // =========================================================
  // 8) METAMASK (desktop + mobile deep-link) + AUTO CHAIN + SEND
  // =========================================================

  function openInMetaMask() {
    // Opens your site in MetaMask mobile browser
    const dapp = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `https://metamask.app.link/dapp/${dapp}`;
  }

  function redirectToMetaMaskInstall() {
    window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
  }

  function getEvmChainForDonateKey(key) {
    if (key === "bnb" || key === "usdt-bnb") return "bnb";
    if (key === "arb" || key === "usdt-arb") return "arb";
    return "eth";
  }

  function isUsdtKey(key) {
    return key === "usdt-eth" || key === "usdt-bnb" || key === "usdt-arb";
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
      // 4902 = chain not added
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

  async function sendNativeDonation(signer, toAddress, donateKey) {
    const chain = getEvmChainForDonateKey(donateKey);
    const amount = chain === "bnb" ? DONATION_DEFAULTS.bnb : DONATION_DEFAULTS.eth;

    const tx = await signer.sendTransaction({
      to: toAddress,
      value: ethers.utils.parseEther(amount),
    });

    return tx.hash;
  }

  async function sendUsdtDonation(signer, toAddress, donateKey) {
    const contractAddr = USDT_CONTRACTS[donateKey];
    if (!contractAddr) throw new Error("USDT contract missing for " + donateKey);

    const ERC20_ABI = [
      "function decimals() view returns (uint8)",
      "function transfer(address to, uint256 amount) returns (bool)",
    ];

    const token = new ethers.Contract(contractAddr, ERC20_ABI, signer);
    const decimals = await token.decimals();
    const amount = ethers.utils.parseUnits(DONATION_DEFAULTS.usdt, decimals);

    const tx = await token.transfer(toAddress, amount);
    return tx.hash;
  }

  async function connectAndDonate() {
    const donateKey = donationState.selectedKey || "eth";
    const toAddress = mapWalletAddressForKey(donateKey);

    if (!toAddress || toAddress === "Loading..." || toAddress === "Address Not Set") {
      alert("Wallet address not ready yet. Please try again in a moment.");
      return;
    }

    // Not in MetaMask environment
    if (typeof window.ethereum === "undefined") {
      if (isMobile()) {
        alert("Opening MetaMask… complete payment inside MetaMask.");
        openInMetaMask();
      } else {
        alert("MetaMask extension not detected. Opening MetaMask download…");
        redirectToMetaMaskInstall();
        copyWallet();
      }
      return;
    }

    try {
      // Switch to correct chain first (bnb/arb/eth)
      const chainKey = getEvmChainForDonateKey(donateKey);
      await ensureEvmChain(chainKey);

      // Connect wallet
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Send correct asset
      let txHash = "";
      if (isUsdtKey(donateKey)) txHash = await sendUsdtDonation(signer, toAddress, donateKey);
      else txHash = await sendNativeDonation(signer, toAddress, donateKey);

      alert("Payment sent! Tx Hash: " + txHash);
    } catch (err) {
      console.error(err);
      alert("Payment cancelled/failed. You can copy the address instead.");
      copyWallet();
    }
  }

  // =========================================================
  // 9) TONKEEPER (single button)
  // =========================================================

  function redirectToTonkeeperInstall() {
    window.open("https://tonkeeper.com/", "_blank", "noopener,noreferrer");
  }

  function tonkeeperTransferLink(to, tonAmount, memoText) {
    const nano = Math.floor(Number(tonAmount) * 1e9);
    const text = encodeURIComponent(memoText || "DocuMorph Support");
    return `https://app.tonkeeper.com/transfer/${encodeURIComponent(to)}?amount=${nano}&text=${text}`;
  }

  async function connectTonkeeper() {
    const donateKey = donationState.selectedKey || "ton";
    const address = mapWalletAddressForKey(donateKey);

    if (!address || address === "Loading..." || address === "Address Not Set") {
      alert("TON wallet address not ready yet. Please try again in a moment.");
      return;
    }

    // USDT-TON is Jetton → we keep it simple: open Tonkeeper site and copy address
    if (donateKey === "usdt-ton") {
      alert("USDT on TON (Jetton) is best sent manually in Tonkeeper. I’ll open Tonkeeper and you can paste the address.");
      redirectToTonkeeperInstall();
      copyWallet();
      return;
    }

    // If TonConnect exists, you can optionally open its modal (still hidden UI)
    // but we keep the experience consistent: direct Tonkeeper transfer link
    const link = tonkeeperTransferLink(address, DONATION_DEFAULTS.ton, "DocuMorph Support");

    // On mobile this will open Tonkeeper app; on desktop it opens Tonkeeper web
    window.open(link, "_blank", "noopener,noreferrer");
  }

  // =========================================================
  // 10) COPY WALLET
  // =========================================================
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
  // 11) DROPDOWNS
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

      if (trigger) trigger.addEventListener("click", toggle);

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
          } else if (dd.id === "network-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateWalletDisplay(val);
          } else if (dd.id !== "resize-scale-dropdown") {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
            updateContext(appState.view, val);
          } else {
            if (triggerText) triggerText.innerHTML = opt.innerHTML;
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

    window.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-select")) dropdowns.forEach((d) => d.classList.remove("open"));
    });
  }

  // =========================================================
  // 12) FORM (POST -> /api/form)
  // =========================================================
  window.submitToFormspree = async function (e) {
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
  };

  // =========================================================
  // 13) MODALS + TABS
  // =========================================================
  window.switchSupportTab = function (n) {
    qsa(".tab-btn").forEach((b) => b.classList.remove("active"));
    qsa(".tab-content").forEach((c) => c.classList.add("hidden"));
    if (window.event?.currentTarget) window.event.currentTarget.classList.add("active");
    const target = document.getElementById(`tab-${n}`);
    if (target) target.classList.remove("hidden");
  };

  window.openModal = function (t) {
    const container = document.getElementById("modal-container");
    qsa(".modal-body").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`modal-${t}`);
    if (target) target.classList.remove("hidden");
    if (container) container.classList.remove("hidden");
  };

  window.closeModal = function () {
    const c = document.getElementById("modal-container");
    if (c) c.classList.add("hidden");
  };

  // =========================================================
  // 14) DAILY LIMIT
  // =========================================================
  function checkDailyLimit() {
    try {
      const today = new Date().toLocaleDateString();
      let d = JSON.parse(localStorage.getItem("documorph_usage")) || { date: today, count: 0 };
      if (d.date !== today) d = { date: today, count: 0 };
      if (d.count >= DAILY_LIMIT) {
        alert("Daily limit reached! Please try again tomorrow.");
        return false;
      }
      return true;
    } catch (_) {
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
  // 15) NAV + MENU
  // =========================================================
  window.switchView = function (n) {
    appState.view = n;

    qsa(".nav-btn").forEach((b) => b.classList.toggle("active", b.innerText.toLowerCase() === n));

    Object.values(views).forEach((v) => v && v.classList.add("hidden"));
    if (views[n]) views[n].classList.remove("hidden");

    window.resetApp();

    const firstOption = views[n] ? views[n].querySelector(".option") : null;
    updateContext(n, firstOption ? firstOption.getAttribute("data-value") : null);
  };

  window.toggleMenu = function () {
    if (menuToggle) menuToggle.classList.toggle("open");
    if (mobileMenu) mobileMenu.classList.toggle("active");
  };

  // =========================================================
  // 16) RESET + START PROCESS
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

    const legal = document.getElementById("legal-check");
    if (legal) legal.checked = false;
    window.toggleStartButton();
  };

  window.executeProcess = function () {
    if (!checkDailyLimit()) return;

    if (readyUI) readyUI.classList.add("hidden");
    if (processUI) processUI.classList.remove("hidden");

    const title = document.getElementById("process-title");
    if (title) title.innerText = "Processing...";

    processFilesWithProxy();
  };

  window.toggleCompMode = function () {
    const m = document.querySelector('input[name="comp-mode"]:checked')?.value;
    const a = document.getElementById("comp-auto-settings");
    const t = document.getElementById("comp-target-settings");
    if (!m || !a || !t) return;

    if (m === "auto") {
      a.classList.remove("hidden");
      t.classList.add("hidden");
    } else {
      a.classList.add("hidden");
      t.classList.remove("hidden");
    }
  };

  window.updateRangeLabel = function () {
    const labels = ["Smallest", "Small", "Compact", "Balanced", "Balanced", "Better", "Good", "Great", "Best Quality"];
    const v = Number(document.getElementById("compression-range")?.value || 4);
    const out = document.getElementById("compression-text");
    if (out) out.innerText = labels[v - 1] || "Balanced";
  };

  // =========================================================
  // 17) TOOL CONTEXT
  // =========================================================
  function updateContext(view, val) {
    appState.subTool = val;

    let accept = "*";
    let limitText = "Files";

    if (view === "convert") {
      switch (val) {
        case "word-to-pdf": accept = ".doc,.docx"; limitText = "Word Docs"; break;
        case "pdf-to-word": accept = ".pdf"; limitText = "PDF Files"; break;
        case "excel-to-pdf": accept = ".xls,.xlsx"; limitText = "Excel Sheets"; break;
        case "pdf-to-excel": accept = ".pdf"; limitText = "PDF Files"; break;
        case "jpg-to-png": accept = "image/jpeg,image/jpg"; limitText = "JPG Images"; break;
        case "png-to-jpg": accept = "image/png"; limitText = "PNG Images"; break;
      }
    } else if (view === "compress") {
      if (val === "comp-pdf") { accept = ".pdf"; limitText = "PDF Files"; }
      else { accept = "image/*"; limitText = "Images"; }
    } else if (view === "resize") {
      accept = "image/*"; limitText = "Images";
    } else if (view === "merge") {
      accept = ".pdf"; limitText = "PDF Files";
    }

    if (fileInput) fileInput.setAttribute("accept", accept);
    if (fileLimits) fileLimits.innerText = `Supported: ${limitText} • Max 50MB`;
  }

  // =========================================================
  // 18) FILE INPUT + DRAG & DROP
  // =========================================================
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) handleFiles(fileInput.files);
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
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
  }

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

  // =========================================================
  // 19) SUCCESS UI
  // =========================================================
  function showSuccess(filename) {
    if (processUI) processUI.classList.add("hidden");
    if (successUI) successUI.classList.remove("hidden");

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = appState.resultUrl;
        link.download = filename;
        link.target = "_blank";
        link.click();
      };
    }

    // Auto-open support modal
    setTimeout(() => {
      window.openModal("support");
      // If donate tab exists, keep it on donate.
      // (Your existing HTML may already default here)
    }, 1500);
  }

  // =========================================================
  // 20) CONVERSION PIPELINE
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

    formData.append("File", file);
    formData.append("StoreFile", "true");

    let type = "";

    if (appState.subTool === "word-to-pdf") type = ext === "doc" ? "doc/to/pdf" : "docx/to/pdf";
    else if (appState.subTool === "pdf-to-word") type = "pdf/to/docx";
    else if (appState.subTool === "excel-to-pdf") type = ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf";
    else if (appState.subTool === "pdf-to-excel") type = "pdf/to/xlsx";
    else if (appState.subTool === "jpg-to-png") type = "jpg/to/png";
    else if (appState.subTool === "png-to-jpg") type = "png/to/jpg";
    else if (appState.view === "compress") {
      type = appState.subTool === "comp-pdf" ? "pdf/to/compress" : "jpg/to/compress";
      const mode = document.querySelector('input[name="comp-mode"]:checked')?.value || "auto";

      if (mode === "auto") {
        const s = Number(document.getElementById("compression-range")?.value || 4);
        if (s <= 3) formData.append("Preset", "screen");
        else if (s <= 6) formData.append("Preset", "ebook");
        else formData.append("Preset", "printer");
        if (type === "jpg/to/compress") formData.append("Quality", s * 10);
      } else {
        formData.append("Preset", "screen");
      }
    } else if (appState.view === "resize") {
      type = "jpg/to/jpg";
      const w = document.getElementById("resize-w")?.value;
      const h = document.getElementById("resize-h")?.value;
      if (w) formData.append("ImageWidth", w);
      if (h) formData.append("ImageHeight", h);
    } else if (appState.view === "merge") {
      type = "pdf/to/merge";
      formData.delete("File");
      appState.files.forEach((f, i) => formData.append(`Files[${i}]`, f));
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/convert?type=${encodeURIComponent(type)}`, true);

    xhr.upload.onprogress = function (e) {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);
      if (processBar) processBar.style.width = p + "%";
      if (processPercent) processPercent.innerText = p + "%";
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          const d = JSON.parse(xhr.responseText);
          if (d.Files && d.Files.length > 0) {
            appState.resultUrl = d.Files[0].Url;
            incrementUsage();
            showSuccess(d.Files[0].FileName);
            return;
          }
          throw new Error("ConvertAPI error");
        } catch (_) {
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

  // =========================================================
  // 21) FILE PROCESS START
  // =========================================================
  window.executeProcess = function () {
    if (!checkDailyLimit()) return;

    if (readyUI) readyUI.classList.add("hidden");
    if (processUI) processUI.classList.remove("hidden");

    const title = document.getElementById("process-title");
    if (title) title.innerText = "Processing...";

    processFilesWithProxy();
  };

  // Expose if you need it elsewhere
  window.updateWalletDisplay = updateWalletDisplay;
})();
