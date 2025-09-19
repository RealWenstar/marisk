// main.js

document.addEventListener('DOMContentLoaded', () => {
  // Mobile navigation toggle
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  burger.addEventListener('click', () => {
    nav.classList.toggle('active');
  });

  // Auto update footer year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Reveal on scroll using Intersection Observer
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });
  revealEls.forEach(el => observer.observe(el));

  // Before/After sliders
  // Initialise dynamic gallery by fetching data from the server
  loadGallery();

  // Falling leaves animation
  initLeaves();
});

/**
 * Initialise the falling leaves animation on the canvas.
 */
function initLeaves() {
  const canvas = document.getElementById('leaf-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  // On resize, update canvas dimensions
  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  });

  const leafCount = 40;
  const leaves = [];
  const colors = ['#74c365', '#88d977', '#6ab755'];

  for (let i = 0; i < leafCount; i++) {
    leaves.push(createLeaf());
  }

  function createLeaf() {
    const size = 10 + Math.random() * 20;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: size,
      speedY: 1 + Math.random() * 2,
      speedX: -1 + Math.random() * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (-0.005 + Math.random() * 0.01),
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  function drawLeaf(leaf) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rotation);
    // draw simple elliptical leaf
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size * 0.6, leaf.size, 0, 0, Math.PI * 2);
    // Set semi‑transparent fill so the animation remains subtle over content
    ctx.fillStyle = leaf.color;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  function update() {
    ctx.clearRect(0, 0, width, height);
    for (const leaf of leaves) {
      leaf.y += leaf.speedY;
      leaf.x += leaf.speedX;
      leaf.rotation += leaf.rotationSpeed;
      // Reset leaf to top if it goes out of view
      if (leaf.y > height + leaf.size) {
        leaf.y = -leaf.size;
        leaf.x = Math.random() * width;
      }
      // Wrap horizontally
      if (leaf.x > width + leaf.size) leaf.x = -leaf.size;
      if (leaf.x < -leaf.size) leaf.x = width + leaf.size;
      drawLeaf(leaf);
    }
    requestAnimationFrame(update);
  }
  update();
}

/**
 * Loads before/after gallery data from the server and creates slider elements dynamically.
 */
async function loadGallery() {
  const wrapper = document.getElementById('ba-wrapper');
  if (!wrapper) return;
  try {
    const res = await fetch('data/gallery.json');
    if (!res.ok) throw new Error('Failed to load gallery');
    const gallery = await res.json();
    // Clear existing content
    wrapper.innerHTML = '';
    gallery.forEach(item => {
      const container = document.createElement('div');
      container.classList.add('ba-container');
      // before image
      const beforeImg = document.createElement('img');
      beforeImg.classList.add('ba-before');
      beforeImg.src = item.before;
      beforeImg.alt = 'Before project';
      // after image
      const afterImg = document.createElement('img');
      afterImg.classList.add('ba-after');
      afterImg.src = item.after;
      afterImg.alt = 'After project';
      // slider
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 100;
      slider.value = 50;
      slider.classList.add('ba-slider');
      container.appendChild(beforeImg);
      container.appendChild(afterImg);
      container.appendChild(slider);
      wrapper.appendChild(container);
      // Setup slider event to update clip on after image
      const updateClip = () => {
        const val = slider.value;
        afterImg.style.clipPath = `polygon(0 0, ${val}% 0, ${val}% 100%, 0 100%)`;
      };
      slider.addEventListener('input', updateClip);
      updateClip();
    });
  } catch (err) {
    console.error('Gallery load error:', err);
  }
}