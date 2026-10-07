(() => {
  const domain = "nikitavorontsov.com";
  if (![domain, `www.${domain}`].includes(window.location.hostname)) return;
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
})();
