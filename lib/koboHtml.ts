// Gedeelde helpers voor de JS-loze /kobo-sectie. Deze pagina's worden als kale
// HTML door Route Handlers geserveerd (buiten React/Next-layout om), zodat de
// trage oude Kobo-browser niets hoeft te parsen of uit te voeren.

/** HTML-escape voor alle dynamische inhoud (boon-namen, notities, fouten). */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Minimale inline-CSS (~1 kB): hoog contrast, system-sans, naast-elkaar via
// flexbox + marges (geen grid/gap, niet ondersteund op oude WebKit), grote
// tap-targets, geen animaties.
const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.4}
.wrap{max-width:720px;margin:0 auto;padding:16px}
h1{font-size:24px;margin:0}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:0 0 8px}
section{margin-top:24px}
a{color:inherit;text-decoration:none}
.top{display:flex;align-items:center;justify-content:space-between}
.btn{display:inline-block;border:2px solid #111;background:#111;color:#fff;padding:10px 16px;border-radius:8px;font-weight:600;font-size:16px}
.btn-light{border:1px solid #bbb;background:#fff;color:#111;font-weight:400}
.btn-block{display:block;width:100%;text-align:center;padding:16px;font-size:18px}
.card{border:1px solid #ccc;border-radius:8px;background:#fff;padding:14px}
ul.list{list-style:none;margin:0;padding:0}
ul.list>li{border:1px solid #ccc;border-radius:8px;background:#fff;padding:14px;margin-bottom:10px}
ul.flat{list-style:none;margin:0;padding:0;border:1px solid #ccc;border-radius:8px;background:#fff}
ul.flat>li{padding:14px;border-top:1px solid #ddd}
ul.flat>li:first-child{border-top:0}
.row-between{display:flex;align-items:baseline;justify-content:space-between}
.name{font-size:18px;font-weight:600}
.muted{color:#666}
.small{font-size:14px}
.chip{display:inline-block;border:1px solid #ccc;border-radius:6px;padding:4px 10px;margin:0 6px 6px 0;font-size:15px}
.chip b{font-weight:600}
.err{border:1px solid #b8754f;border-radius:8px;background:#fff;padding:14px;color:#8e5535}
.pair{display:flex}
.pair>div{-webkit-box-flex:1;-webkit-flex:1;flex:1}
.pair>div:first-child{padding-right:8px}
.pair>div:last-child{padding-left:8px}
label.fld{display:block;margin-bottom:4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#555;font-weight:600}
input,select,textarea{width:100%;border:1px solid #bbb;border-radius:8px;background:#fff;padding:12px;font-size:18px;font-family:inherit;color:#111}
.field{margin-bottom:18px}
.check{display:flex;align-items:center;border:1px solid #bbb;border-radius:8px;padding:12px;font-size:18px}
.check input{width:22px;height:22px;margin-right:12px;flex:none}
.hint{margin:4px 0 0;font-size:13px;color:#777}
`;

/** Omhul een body met een minimaal HTML-document. Géén <script>, géén externe
 *  CSS/JS — alleen deze pagina. */
export function htmlPage(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
