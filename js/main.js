document.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll('.card');
  const sketchFrame = document.getElementById('sketchFrame');
  const header = document.getElementById('header');
  const loader = document.getElementById('loader');

  cards.forEach(card => {
    card.addEventListener('click', function() {
      const folder = card.getAttribute('data-folder');
      // Start fade-out effect
      sketchFrame.classList.add('fade-out');
      header.textContent = card.textContent;
      setTimeout(function() {
        sketchFrame.src = folder + '/index.html';
      }, 1000);
    });
  });

  sketchFrame.addEventListener('load', function() {
    // Remove fade-out to fade in the new sketch
    sketchFrame.classList.remove('fade-out');
  });
}); 