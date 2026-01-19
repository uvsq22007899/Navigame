window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ match.js loaded");

  const page1 = document.getElementById("matchmakingPage");
  const logo = document.querySelector(".mm-logo");

  console.log("page1:", page1, "logo:", logo);

  if (!page1) {
    console.error("❌ #matchmakingPage introuvable");
    return;
  }

  page1.addEventListener("click", () => {
    console.log("🖱️ click page1 => is-found ON");
    if (logo) logo.classList.add("is-leaving");
    setTimeout(() => document.body.classList.add("is-found"), 360);
  });
});
