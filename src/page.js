function buildHtml({ title }) {
  const safeTitle = escapeHtml(title || 'Markdown Preview');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
  <script defer src="/assets/client.js"></script>
</head>
<body>
  <main class="page-shell">
    <div id="status" class="status">Loading markdown...</div>
    <article id="markdown-root" class="markdown-body"></article>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = { buildHtml, escapeHtml };
