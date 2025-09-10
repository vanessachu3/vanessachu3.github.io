const canvas = document.getElementById("hover_canvas");
const ctx = canvas.getContext("2d");
const title = document.getElementById("name");

// Match canvas size to the heading’s bounding box
function resizeCanvas() {
  const rect = title.getBoundingClientRect();
  const newHeight = rect.height * 2;
  canvas.width = rect.width;
  canvas.height = newHeight;
  canvas.style.width = rect.width + "px";
  canvas.style.height = newHeight + "px";
  //canvas.style.left = rect.left + "px";
  canvas.top = rect.top + rect.height/2 - canvas.height/2
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Load images
const images = {
  gundam: new Image()
  // dog: new Image(),
};
images.gundam.src = "/assets/Perfect Strike Freedom Rouge.png";
//images.dog.src = "dog.png";

// Define anchor points relative to the heading box
// Adjust x,y manually so they sit “behind” specific letters
let anchors = [
  { x: 200, y: 0, img: images.gundam } // Gundam near "V"
  // { x: 120, y: 40, img: images.dog } // Dog near "A"
];

let mouse = { x: -9999, y: -9999 }; // start offscreen
let hoverRect = null;

// Track mouse position relative to heading
title.addEventListener("mousemove", (e) => {
  const rect = title.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

title.addEventListener("mouseleave", () => {
  mouse.x = -9999; // hide when leaving
  mouse.y = -9999;
});

// Animation loop
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  anchors.forEach((anchor) => {
    if (!anchor.img.complete) return; // wait until loaded

    const dx = mouse.x - anchor.x;
    const dy = mouse.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Compute opacity: closer = more visible
    let opacity = 0;
    const maxDist = 200; // radius where image fully disappears
    if (dist < maxDist) {
      opacity = 1.2 - dist / maxDist; // fade out with distance
    }

    if (opacity > 0) {
      ctx.globalAlpha = opacity;
      ctx.drawImage(anchor.img, anchor.x - 20, anchor.y - 20, 250, 250); // center image
      ctx.globalAlpha = 1.0; // reset
    }
  });

  requestAnimationFrame(draw);
}

draw();
