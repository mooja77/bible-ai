// Apply the saved theme before first paint without requiring inline-script CSP.
try {
  var theme = localStorage.getItem("bibleai-theme");
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
} catch (e) {
  document.documentElement.setAttribute("data-theme", "dark");
}
