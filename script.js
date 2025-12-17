let currentSlide = 0;
const totalSlides = 4;
const track = document.getElementById("track");

/* =========================
   PROGRESSION
========================= */

const stepPositions = [-120, 1060, 2250, 3440];
const stepColors = [
  "var(--orange)",
  "var(--green)",
  "var(--pink)",
  "var(--blue)"
];

function updateProgress() {
  document.querySelectorAll(".step-dot").forEach(dot => {
    dot.style.transform = `translate(${stepPositions[currentSlide]}%, -50%)`;
    dot.style.backgroundColor = stepColors[currentSlide];
  });
}

/* =========================
   LOTTIE
========================= */

const animDuration = 800;
const extraDelay = 200;

/* JAUNE — slide 1 */
const lottieJaune = lottie.loadAnimation({
  container: document.getElementById("lottie-jaune"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "asset/jaune1.json"
});

/* VERT — slide 2 */
const lottieVert = lottie.loadAnimation({
  container: document.getElementById("lottie-vert"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "asset/vert1.json"
});

/* ROSE — slide 3 */
const lottieRose = lottie.loadAnimation({
  container: document.getElementById("lottie-rose"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "asset/rose2.json"
});

/* BLEU — slide 4 */
const lottieBleu = lottie.loadAnimation({
  container: document.querySelector(".lottie-bleu"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "asset/bleu1.json"
});

/* =========================
   SLIDES
========================= */

let isTransitioning = false;

function changeSlide(index) {
  currentSlide = index;
  track.style.transform = `translateX(-${currentSlide * 25}%)`;
  updateProgress();

  /* 🟡 JAUNE — entrée */
  if (currentSlide === 0) {
    lottieJaune.setDirection(1);
    lottieJaune.goToAndPlay(0, true);
  }

  /* 🟢 VERT — entrée */
  if (currentSlide === 1) {
    lottieVert.setDirection(1);
    lottieVert.goToAndPlay(0, true);
  }

  /* 🌸 ROSE — entrée = disparition */
  if (currentSlide === 2) {
    lottieRose.setDirection(-1);
    lottieRose.goToAndPlay(lottieRose.totalFrames, true);
  }

  /* 🔵 BLEU — entrée */
  if (currentSlide === 3) {
    lottieBleu.setDirection(1);
    lottieBleu.goToAndPlay(0, true);
  }

  isTransitioning = false;
}

function nextSlide() {
  if (currentSlide >= totalSlides - 1 || isTransitioning) return;

  /* 🟡 JAUNE — sortie */
  if (currentSlide === 0) {
    isTransitioning = true;
    lottieJaune.setDirection(-1);
    lottieJaune.goToAndPlay(lottieJaune.totalFrames, true);

    setTimeout(() => changeSlide(1), animDuration + extraDelay);
    return;
  }

  /* 🟢 VERT — sortie */
  if (currentSlide === 1) {
    isTransitioning = true;
    lottieVert.setDirection(-1);
    lottieVert.goToAndPlay(lottieVert.totalFrames, true);

    setTimeout(() => changeSlide(2), animDuration + extraDelay);
    return;
  }

  /* 🌸 ROSE — sortie */
  if (currentSlide === 2) {
    isTransitioning = true;
    lottieRose.setDirection(1);
    lottieRose.goToAndPlay(0, true);

    setTimeout(() => changeSlide(3), animDuration + extraDelay);
    return;
  }

  /* 🔵 BLEU — sortie */
  if (currentSlide === 3) {
    isTransitioning = true;
    lottieBleu.setDirection(-1);
    lottieBleu.goToAndPlay(lottieBleu.totalFrames, true);

    setTimeout(() => changeSlide(4), animDuration + extraDelay);
    return;
  }

  changeSlide(currentSlide + 1);
}

function prevSlide() {
  if (currentSlide <= 0 || isTransitioning) return;

  /* 🔵 BLEU — sortie arrière */
  if (currentSlide === 3) {
    isTransitioning = true;
    lottieBleu.setDirection(-1);
    lottieBleu.goToAndPlay(lottieBleu.totalFrames, true);

    setTimeout(() => changeSlide(2), animDuration + extraDelay);
    return;
  }

  /* 🌸 ROSE — sortie arrière */
  if (currentSlide === 2) {
    isTransitioning = true;
    lottieRose.setDirection(1);
    lottieRose.goToAndPlay(0, true);

    setTimeout(() => changeSlide(1), animDuration + extraDelay);
    return;
  }

  /* 🟢 VERT — sortie arrière */
  if (currentSlide === 1) {
    isTransitioning = true;
    lottieVert.setDirection(-1);
    lottieVert.goToAndPlay(lottieVert.totalFrames, true);

    setTimeout(() => changeSlide(0), animDuration + extraDelay);
    return;
  }

  changeSlide(currentSlide - 1);
}

/* =========================
   INIT
========================= */

updateProgress();
