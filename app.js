function finishOnboarding() {
  document.getElementById("onboarding").classList.add("hidden");
  document.getElementById("home").classList.remove("hidden");
  initHomeMapOnce();
}

window.finishOnboarding = finishOnboarding;
