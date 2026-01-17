// js/decor-curves.js
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lottie === "undefined") {
    console.warn("[decor-curves] lottie non chargé (script lottie manquant ?)");
    return;
  }

  const items = [
    { id: "curve-yellow", path: "asset/jaune1.json" },
    { id: "curve-green",  path: "asset/vert1.json"  },
    { id: "curve-pink",   path: "asset/rose2.json"  },
    { id: "curve-blue",   path: "asset/bleu1.json"  },
  ];

  const anims = items
    .map(it => {
      const el = document.getElementById(it.id);
      if (!el) return null;

      const a = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: false,
        autoplay: false,
        path: it.path,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" }
      });
      a.setSpeed(0.7);

      const obj = {
        el,
        a,
        ready: false,
        running: false,
        onComplete: null,
        stopTimer: null
      };

      // ✅ IMPORTANT : attendre data_ready (sinon totalFrames peut rester à 0)
      a.addEventListener("data_ready", () => {
        obj.ready = true;

        // visible (fondu CSS)
        el.classList.add("is-ready");

        // état stable
        a.goToAndStop(0, true);

        // (option) debug
        // console.log("READY", it.id, "totalFrames:", a.totalFrames);
      });

      a.addEventListener("data_failed", () => {
        console.error("[decor-curves] data_failed:", it.path);
      });

      return obj;
    })
    .filter(Boolean);

  function clearComplete(obj) {
    if (obj.onComplete) {
      obj.a.removeEventListener("complete", obj.onComplete);
      obj.onComplete = null;
    }
  }

  function startPingPong(obj, durationMs = 4200) {
    if (!obj.ready || obj.running) return;
    obj.running = true;

    // visible (au cas où)
    obj.el.classList.add("is-ready");

    // reset listener propre
    clearComplete(obj);

    // démarre en "draw" (0 -> end)
    obj.a.stop();
    obj.a.setDirection(1);
    obj.a.goToAndPlay(0, true);

    // ping-pong : à chaque complete on inverse, SANS jump
    obj.onComplete = () => {
      const dir = obj.a.playDirection; // 1 ou -1
      obj.a.setDirection(dir === 1 ? -1 : 1);
      obj.a.play(); // repart depuis le frame actuel
    };
    obj.a.addEventListener("complete", obj.onComplete);

    // stop après X ms
    if (obj.stopTimer) clearTimeout(obj.stopTimer);
    obj.stopTimer = setTimeout(() => stopPingPong(obj), durationMs);
  }

  function stopPingPong(obj) {
    if (!obj.running) return;
    obj.running = false;

    if (obj.stopTimer) {
      clearTimeout(obj.stopTimer);
      obj.stopTimer = null;
    }

    // on stoppe le ping-pong (sinon ça ré-inverse)
    clearComplete(obj);

    // "fin propre" : revenir vers 0 (effacé), puis fade out
    obj.a.stop();
    obj.a.setDirection(-1);
    obj.a.play();

    const onDoneToZero = () => {
      obj.a.removeEventListener("complete", onDoneToZero);

      // cache en fondu
      obj.el.classList.remove("is-ready");

      // garantit frame 0
      obj.a.goToAndStop(0, true);
    };

    obj.a.addEventListener("complete", onDoneToZero);
  }

  // toutes les 2.6s : une courbe au hasard fait un ping-pong quelques secondes
  setInterval(() => {
    if (!anims.length) return;
    const candidates = anims.filter(o => o.ready && !o.running);
    if (!candidates.length) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    startPingPong(pick, 4200);
  }, 2850);
});
