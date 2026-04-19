export function initErrorBoundary(): void {
  const overlay = document.createElement('div');
  overlay.id = 'error-boundary-overlay';
  overlay.innerHTML = `
    <div class="error-modal" role="alert" aria-live="assertive">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">Service Interruption</h2>
      <p class="error-msg" id="error-boundary-msg">An unexpected error occurred.</p>
      <button class="error-btn" onclick="window.location.reload()">Reload Application</button>
    </div>
  `;
  // Start hidden
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  const showError = (msg: string) => {
    console.error("[ErrorBoundary] Caught:", msg);
    const msgEl = document.getElementById('error-boundary-msg');
    if (msgEl) msgEl.textContent = msg;
    overlay.style.display = 'flex';
  };

  // Catch unhandled promises (usually failed async API requests)
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    showError(event.reason?.message || "A network or API service failed.");
  });

  // Catch synchronous errors
  window.addEventListener('error', (event) => {
    event.preventDefault();
    showError(event.message || "An unexpected error occurred.");
  });
}
