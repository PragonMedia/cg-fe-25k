window.STATE_ABBR_TO_NAME = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

window.HEADLINE_WITH_STATE =
  "{state} Residents Can Get Up To $25,000 To Cover Funeral Expenses And Unpaid Bills With This Discounted Burial Insurance Benefit";
window.HEADLINE_FALLBACK =
  "Get Up To $25,000 To Cover Funeral Expenses And Unpaid Bills With This Discounted Burial Insurance Benefit";
window.SITE_LOADER_MAX_MS = 2000;
window.HEADLINE_STATE_CACHE_KEY = "headline_state_name";

function resolveStateName(value) {
  if (!value) return null;
  var v = String(value).trim();
  var upper = v.toUpperCase();
  if (window.STATE_ABBR_TO_NAME[upper]) return window.STATE_ABBR_TO_NAME[upper];
  if (v.length > 2) return v;
  return null;
}

function normalizeGeoPayload(data) {
  if (!data || typeof data !== "object") return null;

  var country =
    data.country_code ||
    data.countryCode ||
    data.country ||
    "";
  country = String(country).toUpperCase();
  if (country === "UNITED STATES") country = "US";
  if (country.length > 2) country = country.slice(0, 2);

  var region = data.region || data.regionName || data.state || "";
  var regionCode = data.region_code || data.regionCode || "";

  if (country !== "US") return null;

  return (
    resolveStateName(region) ||
    resolveStateName(regionCode) ||
    (region ? String(region).trim() : null)
  );
}

function fetchGeoJson(url) {
  return fetch(url, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("geo http " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (data && data.success === false) throw new Error("geo failed");
      return normalizeGeoPayload(data);
    });
}

// Try multiple providers in parallel — first US state wins
window.fetchHeadlineState = function () {
  var providers = [
    "https://ipwho.is/",
    "https://get.geojs.io/v1/ip/geo.json",
    "https://ipinfo.io/json",
  ];

  return new Promise(function (resolve) {
    var settled = false;
    var pending = providers.length;

    providers.forEach(function (url) {
      fetchGeoJson(url)
        .then(function (stateName) {
          if (settled) return;
          if (stateName) {
            settled = true;
            resolve(stateName);
            return;
          }
          pending -= 1;
          if (pending === 0) resolve(null);
        })
        .catch(function () {
          if (settled) return;
          pending -= 1;
          if (pending === 0) resolve(null);
        });
    });
  });
};

window.showSite = function () {
  if (document.documentElement.classList.contains("site-ready")) return;
  document.documentElement.classList.add("site-ready");
  var loader = document.getElementById("site-loader");
  if (loader) loader.setAttribute("aria-busy", "false");
  window.dispatchEvent(new Event("site-ready"));
};

window.initHeadline = function () {
  var el = document.getElementById("headline-title");
  if (!el) {
    window.showSite();
    return;
  }

  var locked = false;

  function finalize(stateName) {
    if (locked) return;
    locked = true;

    if (stateName) {
      el.textContent = window.HEADLINE_WITH_STATE.replace("{state}", stateName);
      try {
        sessionStorage.setItem(window.HEADLINE_STATE_CACHE_KEY, stateName);
      } catch (e) {}
    } else {
      el.textContent = window.HEADLINE_FALLBACK;
    }

    window.showSite();
  }

  try {
    try {
      var cached = sessionStorage.getItem(window.HEADLINE_STATE_CACHE_KEY);
      if (cached) {
        finalize(cached);
        return;
      }
    } catch (e) {}

    var geoPromise =
      window.geoHeadlinePromise || window.fetchHeadlineState();

    var timeoutPromise = new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, window.SITE_LOADER_MAX_MS);
    });

    Promise.race([geoPromise, timeoutPromise])
      .then(function (stateName) {
        if (stateName && typeof stateName === "object") {
          stateName = normalizeGeoPayload(stateName);
        }
        finalize(stateName || null);
      })
      .catch(function () {
        finalize(null);
      });

    // Absolute safety — never hang past 2.1s
    setTimeout(function () {
      finalize(null);
    }, window.SITE_LOADER_MAX_MS + 100);
  } catch (e) {
    finalize(null);
  }
};
