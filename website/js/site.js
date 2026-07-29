// Shared nav + footer, injected on every page so there's one copy to edit.
const NAV_LINKS = [
  ['story.html',       'Story'],
  ['genres.html',      'Genres'],
  ['businesses.html',  'Businesses'],
  ['walkthrough.html', 'Walkthrough'],
  ['map.html',         'Route Map'],
  ['leaderboard.html', 'Leaderboard'],
  ['faq.html',         'FAQ'],
];

function buildNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="nav-logo" href="index.html">ROAD TRIP <span class="dice">ROULETTE</span></a>
      <button class="nav-burger" aria-label="Menu">☰</button>
      <div class="nav-links">
        ${NAV_LINKS.map(([href, label]) =>
          `<a class="nav-link${here === href ? ' active' : ''}" href="${href}">${label}</a>`).join('')}
        <a class="nav-cta" href="demo.html">Play Demo</a>
      </div>
    </div>`;
  document.body.prepend(nav);
  nav.querySelector('.nav-burger').addEventListener('click', () =>
    nav.querySelector('.nav-links').classList.toggle('open'));
  // Publish the real nav height so sticky page elements (story scenes)
  // can pin BELOW it instead of sliding underneath.
  const setNavH = () =>
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  setNavH();
  addEventListener('resize', setNavH);
}

function buildFooter() {
  const f = document.createElement('footer');
  f.className = 'footer';
  f.innerHTML = `
    <div class="wrap">
      <div>© 2026 Road Trip Roulette. 293 miles. No promises.</div>
      <div>
        <a href="demo.html">Demo</a> ·
        <a href="leaderboard.html">Leaderboard</a> ·
        <a href="faq.html">FAQ</a>
      </div>
    </div>`;
  document.body.append(f);
}

buildNav();
buildFooter();
