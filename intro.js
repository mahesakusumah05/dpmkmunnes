try {
  if (window.sessionStorage.getItem("dpm-km-unnes-intro-seen") === "1") {
    document.documentElement.classList.add("intro-splash-seen");
  }
} catch (error) {
  console.warn("Status layar pembuka tidak dapat dibaca dari sesi ini.", error);
}
