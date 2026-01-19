// js/match.js
window.addEventListener("load", () => {
  const app = document.querySelector(".app");

  // après 5s : slide vers la page 2
  setTimeout(() => {
    app?.classList.add("is-next");

    // après la fin du slide : déclenche anim avatars + VS
    setTimeout(() => {
      app?.classList.add("is-found");
    }, 560);
  }, 5000);
});
