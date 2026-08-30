export const EVENTHUB_BASE = "https://eventhubcc.vit.ac.in";

/** Build the public poster image URL for an EventHub event from its EventHub ID. */
export function eventhubImageUrl(eid: string): string {
  if (!eid) return "";
  return `${EVENTHUB_BASE}/EventHub/image/?id=${encodeURIComponent(eid)}`;
}

/**
 * HTML document that auto-logs into Event Hub (via a hidden form POST to
 * mainDashboard) inside the current window. Used to set the JSESSIONID cookie
 * on the eventhubcc origin so the browser can then hit authenticated URLs
 * (certificates, receipts, payment pages) directly — no backend proxying.
 */
export function eventHubLoginHtml(username: string, password: string): string {
  const u = username.replace(/"/g, "&quot;");
  const p = password.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to Event Hub...</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
        .loader { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .container { display: flex; align-items: center; background: white; padding: 20px 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="loader"></div>
        <p>Opening Event Hub securely...</p>
    </div>
    <form id="loginForm" action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST">
        <input type="hidden" name="username" value="${u}" />
        <input type="hidden" name="password" value="${p}" />
        <input type="hidden" name="validateVitian" value="1" />
    </form>
    <script>
        document.getElementById("loginForm").submit();
    </script>
</body>
</html>`;
}

