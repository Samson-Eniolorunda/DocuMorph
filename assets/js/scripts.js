/* =========================================================
   DocuMorph — scripts.js
   Purpose: Client-side UI logic (views, dropdowns, upload flow)
   Notes:
   - This is a front-end UI simulation (no real file processing yet).
   - Replace the "process simulation" with real API calls when ready.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     1) App State (single source of truth for UI context)
     --------------------------------------------------------- */
  const appState = {
    view: 'convert',          // current top-level tool: convert | compress | resize | merge
    subTool: 'word-to-pdf',   // current tool option inside the view (dropdown selection)
    files: []                // selected files (for future real processing)
  };

  /* ---------------------------------------------------------
     2) DOM Cache (query once, reuse everywhere)
     --------------------------------------------------------- */
  const views = {
    convert: document.getElementById('view-convert'),
    compress: document.getElementById('view-compress'),
    resize: document.getElementById('view-resize'),
    merge: document.getElementById('view-merge')
  };

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileLimits = document.getElementById('file-limits');

  const processUI = document.getElementById('process-ui');
  const successUI = document.getElementById('success-ui');
  const progressBar = document.getElementById('progress-bar');

  const mobileMenu = document.getElementById('mobile-menu');
  const menuToggleBtn = document.querySelector('.menu-toggle');

  /* ---------------------------------------------------------
     3) Boot
     --------------------------------------------------------- */
  initCustomDropdowns();
  // Ensure initial "accept" and UI label match the default tool
  updateContext(appState.view, appState.subTool);

  /* =========================================================
     PUBLIC FUNCTIONS
     These are referenced directly from HTML onclick attributes.
     Keep them on window for compatibility.
     ========================================================= */

  /**
   * Switch between primary tools: convert, compress, resize, merge
   * - Updates button active state
   * - Shows relevant view section
   * - Resets upload/progress UI
   */
  window.switchView = function switchView(viewName) {
    appState.view = viewName;

    // 1) Update top nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.innerText.toLowerCase() === viewName);
    });

    // 2) Show the selected view section, hide others
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    // 3) Reset process UI
    resetApp();

    // 4) Auto-set context using the first dropdown option in the view (if any)
    const firstOption = views[viewName].querySelector('.option');
    if (firstOption) {
      updateContext(viewName, firstOption.getAttribute('data-value'));
    } else {
      // Resize view has no "subtool" required to accept images
      updateContext(viewName, null);
    }
  };

  /**
   * Toggle the mobile menu overlay
   * - Also animates the hamburger icon
   */
  window.toggleMenu = function toggleMenu() {
    menuToggleBtn.classList.toggle('open');
    mobileMenu.classList.toggle('active');

    // Keep aria-expanded correct for accessibility
    const expanded = menuToggleBtn.classList.contains('open');
    menuToggleBtn.setAttribute('aria-expanded', String(expanded));
  };

  /**
   * Switch between "auto slider" and "target size" compression modes.
   */
  window.toggleCompMode = function toggleCompMode() {
    const mode = document.querySelector('input[name="comp-mode"]:checked').value;
    const autoSettings = document.getElementById('comp-auto-settings');
    const targetSettings = document.getElementById('comp-target-settings');

    if (mode === 'auto') {
      autoSettings.classList.remove('hidden');
      targetSettings.classList.add('hidden');
    } else {
      autoSettings.classList.add('hidden');
      targetSettings.classList.remove('hidden');
    }
  };

  /**
   * Update helper text for compression slider.
   */
  window.updateRangeLabel = function updateRangeLabel() {
    const val = Number(document.getElementById('compression-range').value);
    const txt = document.getElementById('compression-text');
    const labels = ['High Quality', 'Balanced', 'Smallest Size'];

    txt.innerText = labels[val - 1] ?? 'Balanced';
  };

  /**
   * Reset UI back to the upload state.
   */
  window.resetApp = function resetApp() {
    successUI.classList.add('hidden');
    processUI.classList.add('hidden');
    dropZone.classList.remove('hidden');
    progressBar.style.width = '0%';
    fileInput.value = '';
    appState.files = [];
  };

  /* ---------------------------------------------------------
     4) Custom Dropdowns
     - Handles open/close
     - Writes selection into the trigger
     - Calls updateContext(...) so accept/limits update automatically
     --------------------------------------------------------- */
  function initCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-select');

    dropdowns.forEach(dd => {
      const trigger = dd.querySelector('.select-trigger');
      const triggerText = dd.querySelector('.trigger-text');
      const options = dd.querySelectorAll('.option');

      // Toggle current dropdown
      trigger.addEventListener('click', () => {
        dropdowns.forEach(other => { if (other !== dd) other.classList.remove('open'); });
        dd.classList.toggle('open');
      });

      // Option select
      options.forEach(opt => {
        opt.addEventListener('click', () => {
          const val = opt.getAttribute('data-value');

          // Update visible selected label (keeps icon + text)
          triggerText.innerHTML = opt.innerHTML;

          // Close dropdown
          dd.classList.remove('open');

          // Update app context (accept types + label)
          updateContext(appState.view, val);
        });
      });
    });

    // Close dropdowns when clicking outside
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select')) {
        dropdowns.forEach(dd => dd.classList.remove('open'));
      }
    });
  }

  /* ---------------------------------------------------------
     5) Context Update (accept attribute + UI copy)
     This controls what file types are allowed per tool.
     --------------------------------------------------------- */
  function updateContext(view, val) {
    appState.subTool = val;

    let accept = '*';
    let text = 'Files';

    // Convert tools: use explicit matches to avoid "includes" collisions
    if (view === 'convert') {
      switch (val) {
        case 'word-to-pdf':
          accept = '.doc,.docx';
          text = 'Word Docs';
          break;
        case 'pdf-to-word':
          accept = '.pdf';
          text = 'PDFs';
          break;
        case 'jpg-to-pdf':
          accept = 'image/jpeg,image/jpg';
          text = 'JPG Images';
          break;
        case 'png-to-jpg':
          accept = 'image/png';
          text = 'PNG Images';
          break;
        case 'excel-to-pdf':
          accept = '.xls,.xlsx';
          text = 'Excel Files';
          break;
        default:
          accept = '*';
          text = 'Files';
      }
    }

    // Compress tools
    else if (view === 'compress') {
      if (val === 'comp-pdf') { accept = '.pdf'; text = 'PDF Files'; }
      else if (val === 'comp-img') { accept = 'image/*'; text = 'Images'; }
    }

    // Resize tools
    else if (view === 'resize') {
      accept = 'image/*';
      text = 'Images';
    }

    // Merge tools
    else if (view === 'merge') {
      if (val === 'merge-pdf') { accept = '.pdf'; text = 'PDFs'; }
      else if (val === 'merge-img') { accept = 'image/*'; text = 'Images'; }
      else { accept = '.pdf,image/*'; text = 'PDFs or Images'; }
    }

    fileInput.setAttribute('accept', accept);
    fileLimits.innerText = `Supported: ${text} • Max 50MB`;
  }

  /* ---------------------------------------------------------
     6) Upload Handling
     - Change event (file picker)
     - Drag & drop interactions
     --------------------------------------------------------- */
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      setSelectedFiles(fileInput.files);
      startProcess();
    }
  });

  // Drag & Drop: visual feedback + file capture
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'rgba(99, 102, 241, 0.1)';
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.background = 'rgba(255,255,255,0.6)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.background = 'rgba(255,255,255,0.6)';

    if (e.dataTransfer?.files?.length) {
      setSelectedFiles(e.dataTransfer.files);
      startProcess();
    }
  });

  /**
   * Store selected files in state (future: validate size/types here).
   */
  function setSelectedFiles(fileList) {
    appState.files = Array.from(fileList);
  }

  /* ---------------------------------------------------------
     7) Process Simulation
     Replace with real processing when you connect backend/APIs.
     --------------------------------------------------------- */
  function startProcess() {
    dropZone.classList.add('hidden');
    processUI.classList.remove('hidden');

    // Update title based on current view
    let title = 'Processing...';
    if (appState.view === 'convert') title = 'Converting...';
    if (appState.view === 'compress') title = 'Compressing...';
    if (appState.view === 'resize') title = 'Resizing...';
    if (appState.view === 'merge') title = 'Merging...';

    document.getElementById('process-title').innerText = title;

    // Fake progress bar animation
    let width = 0;

    const interval = setInterval(() => {
      width += Math.random() * 10;
      if (width > 100) width = 100;

      progressBar.style.width = width + '%';

      if (width === 100) {
        clearInterval(interval);
        setTimeout(showSuccess, 500);
      }
    }, 150);
  }

  /**
   * Show success state and contextual message.
   */
  function showSuccess() {
    processUI.classList.add('hidden');
    successUI.classList.remove('hidden');

    const msg = document.getElementById('success-msg');

    if (appState.view === 'compress') {
      const mode = document.querySelector('input[name="comp-mode"]:checked').value;

      if (mode === 'target') {
        const size = document.getElementById('target-size-input').value || 2;
        const unit = document.querySelector('.unit-select').value;
        msg.innerText = `Compressed to under ${size} ${unit}!`;
      } else {
        msg.innerText = 'File size reduced by 45%!';
      }
    } else {
      msg.innerText = 'Operation successful.';
    }
  }
})();
