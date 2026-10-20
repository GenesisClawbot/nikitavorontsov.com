(() => {
  const domain = "nikitavorontsov.com";
  if (![domain, `www.${domain}`].includes(window.location.hostname)) return;
  // Email fallbacks can contain credentials. Never track a books URL that failed to clear them.
  if (/^\/books(?:\/|$)/.test(window.location.pathname) &&
      (window.location.search || window.location.hash)) return;
  if (document.getElementById("site-plausible")) return;

  window.plausible = window.plausible || function () {
    window.plausible.q = window.plausible.q || [];
    if (window.plausible.q.length < 50) window.plausible.q.push(arguments);
  };

  // ZOOKWORKS already sends one pageview with its sanitised URL at startup.
  const manual = /^\/zookworks(?:\/|$)/.test(window.location.pathname);
  const script = document.createElement("script");
  script.id = "site-plausible";
  script.async = true;
  script.dataset.domain = domain;
  script.src = `https://plausible.io/js/script${manual ? ".manual" : ""}.js`;
  document.head.append(script);

  // Opt in only the public films. These labels are static, not visitor input.
  // Coverage measures the media timeline played, not attention or elapsed time.
  document.querySelectorAll("video[data-analytics-film]").forEach((video) => {
    const sent = new Set();
    function record(name) {
      if (sent.has(name)) return;
      sent.add(name);
      // Separate event names work on Growth without Business-only properties.
      window.plausible(`${name} - ${video.dataset.analyticsFilm}`);
    }
    function sample() {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      // played is a normalised union: repeats do not inflate coverage, and
      // a seek leaves a gap rather than counting the skipped section.
      const ranges = video.played;
      let seconds = 0;
      for (let i = 0; i < ranges.length; i++) {
        seconds += Math.max(0, Math.min(duration, ranges.end(i)) - Math.max(0, ranges.start(i)));
      }
      if (seconds > 0) record("Film started");
      if (seconds / duration >= 0.9) record("Film 90 percent played");
    }
    // pause/ended also sample the final range if no timeupdate arrives first.
    for (const event of ["timeupdate", "pause", "ended"]) video.addEventListener(event, sample);
  });
})();
