import confetti from "canvas-confetti";

export function celebrateOnboarding() {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#E65C4F", "#78A6C8", "#10B981", "#F59E0B"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}
