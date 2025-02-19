document.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll('.card');
  const sketchFrame = document.getElementById('sketchFrame');
  const header = document.getElementById('header');
  const loader = document.getElementById('loader');

  cards.forEach(card => {
    card.addEventListener('click', function() {
      const folder = card.getAttribute('data-folder');
      loader.style.display = 'block';
      header.textContent = card.textContent;
      sketchFrame.src = folder + '/index.html';
    });
  });

  sketchFrame.addEventListener('load', function() {
    loader.style.display = 'none';
  });
}); 