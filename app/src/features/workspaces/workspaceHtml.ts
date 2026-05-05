export function renderWorkspaceHtml(title: string, markdown: string): string {
  const safeTitle = escapeHtml(title.trim() || "Bible AI Workspace");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root {
      color: #171717;
      background: #ffffff;
      font-family: "Segoe UI", system-ui, sans-serif;
      line-height: 1.55;
    }
    body {
      margin: 0;
      padding: 40px;
    }
    main {
      max-width: 880px;
      margin: 0 auto;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font: inherit;
    }
    @media print {
      body {
        padding: 24px;
      }
    }
  </style>
</head>
<body>
  <main>
    <pre>${escapeHtml(markdown)}</pre>
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
