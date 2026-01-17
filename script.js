// js/decor-curves.js
document.addEventListener("DOMContentLoaded", () => {
  const items = [
    { id: "curve-yellow", path: "asset/jaune1.json" },
    { id: "curve-green",  path: "asset/vert1.json"  },
    { id: "curve-pink",   path: "asset/rose2.json"  },
    { id: "curve-blue",   path: "asset/bleu1.json"  },
  ];

  const anims = [];

  items.forEach((it) => {
    const el = document.getElementById(it.id);
    if (!el) return;

    // caché tant que pas prêt
    el.classList.remove("is-ready");

    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop: false,
      autoplay: false,
      path: it.path
    });

    anim.__ready = false;

    anim.addEventListener("DOMLoaded", () => {
      anim.__ready = true;
      el.classList.add("is-ready");
      anim.goToAndStop(0, true); // frame clean
    });

    anims.push(anim);
  });

  const playOne = (a, dir = 1) => {
    if (!a.__ready) return;      // ✅ pas prêt => rien (évite pop)
    if (a.isPaused === false) a.stop(); // reset net
    a.setDirection(dir);
    a.goToAndPlay(dir === 1 ? 0 : a.totalFrames, true);
  };

  setInterval(() => {
    if (!anims.length) return;
    const a = anims[Math.floor(Math.random() * anims.length)];
    const dir = Math.random() > 0.5 ? 1 : -1;
    playOne(a, dir);
  }, 2500);
});
