// Apply the saved theme before first paint without requiring inline-script CSP.
// Default is the light "editorial" theme; dark is opt-in via the toggle.
try {
  var theme = localStorage.getItem("bibleai-theme");
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
} catch (e) {
  document.documentElement.setAttribute("data-theme", "light");
}
