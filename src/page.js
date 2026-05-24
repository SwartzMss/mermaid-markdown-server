function buildHtml({ title }) {
  const safeTitle = escapeHtml(title || 'Markdown Preview');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="/assets/client.js"></script>
</head>
<body>
  <div class="preview-layout">
    <aside id="document-nav" class="document-nav" aria-label="Document navigation">
      <div class="document-nav__title">文档导航</div>
      <nav id="document-nav-list" class="document-nav__list"></nav>
    </aside>
    <main class="page-shell">
      <div id="status" class="status">Loading markdown...</div>
      <article id="markdown-root" class="markdown-body"></article>
    </main>
  </div>
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
