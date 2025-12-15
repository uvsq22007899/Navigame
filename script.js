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
   LOTTIE (BLEU)
========================= */

let lottieBleu = lottie.loadAnimation({
  container: document.querySelector(".lottie-bleu"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "asset/bleu1.json"
});

/* =========================
   SLIDES
========================= */

function goToSlide(index) {
  currentSlide = index;
  track.style.transform = `translateX(-${currentSlide * 25}%)`;
  updateProgress();

  // ▶️ Joue Lottie uniquement sur la slide BLEUE (slide 4)
  if (currentSlide === 3) {
    lottieBleu.goToAndPlay(0, true);
  }
}

function nextSlide() {
  if (currentSlide < totalSlides - 1) {
    goToSlide(currentSlide + 1);
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    goToSlide(currentSlide - 1);
  }
}

/* =========================
   INIT
========================= */

updateProgress();
