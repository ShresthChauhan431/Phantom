(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const startButtons = [...document.querySelectorAll('[data-start-story]')];
  const startStory = () => {
    document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => (window.triggerDishaStory || window.triggerSmritiStory)?.(), 250);
  };
  $('btnNavStart')?.addEventListener('click', startStory);
  $('btnFooterStart')?.addEventListener('click', startStory);
  startButtons.forEach((button) => button.addEventListener('click', startStory));

  $('btnFindGlasses')?.addEventListener('click', () => {
    document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => (window.dishaApp || window.smritiApp)?.findGlasses(), 250);
  });

  const slider = $('diffRangeSlider');
  const progress = $('diffTrackProgress');
  const thumb = document.querySelector('.diff-thumb');
  const readout = $('scrubCenterText');
  const ghost = $('zoneGhostGlasses');
  const updateDiff = () => {
    if (!slider) return;
    const value = Number(slider.value);
    if (progress) progress.style.width = `${value}%`;
    if (thumb) thumb.style.left = `${value}%`;
    if (readout) readout.textContent = value < 48 ? 'The glasses begin on the side table.' : value < 88 ? 'One meaningful change detected.' : 'The glasses are now on the bookshelf.';
    ghost?.classList.toggle('visible', value > 68);
    (window.dishaApp || window.smritiApp)?.scrubRealityDiff(value / 100);
  };
  slider?.addEventListener('input', updateDiff);
  updateDiff();

  const header = $('siteHeader');
  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 22);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // Mobile Navigation Toggle
  const navToggle = $('navToggle');
  const siteNav = $('siteNav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = siteNav.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    siteNav.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', (e) => {
      if (siteNav.classList.contains('open') && !siteNav.contains(e.target) && !navToggle.contains(e.target)) {
        siteNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && siteNav.classList.contains('open')) {
        siteNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Active Navigation Indicator
  const navLinks = [...document.querySelectorAll('.site-nav .nav-link')];
  const trackedSections = ['moments', 'phantom', 'reality-diff-compare', 'memory-receipt-section', 'trust']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const updateActiveNav = () => {
    const scrollPos = window.scrollY + 140;
    let currentId = '';
    for (const section of trackedSections) {
      if (section.offsetTop <= scrollPos) {
        currentId = section.id;
      }
    }
    navLinks.forEach((link) => {
      const href = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('active', href === currentId);
    });
  };
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  if (window.location.search.includes('story=true') || window.location.hash === '#story') {
    window.setTimeout(() => startStory(), 1200);
  }

  const qaMatch = window.location.search.match(/[?&]qa_scroll=([^&]+)/);
  if (qaMatch && qaMatch[1]) {
    const doQaScroll = () => {
      const targetEl = document.getElementById(decodeURIComponent(qaMatch[1]));
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
        targetEl.classList.add('revealed');
      }
    };
    doQaScroll();
    window.addEventListener('load', () => setTimeout(doQaScroll, 50));
    setTimeout(doQaScroll, 200);
    setTimeout(doQaScroll, 600);
  }
})();
