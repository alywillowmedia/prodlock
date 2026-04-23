(function () {
  const visibilityNode = document.querySelector("[data-prodlock-visibility]");
  let visibility = null;

  if (visibilityNode) {
    try {
      visibility = JSON.parse(visibilityNode.textContent || "{}");
    } catch (_error) {
      visibility = null;
    }
  }

  const approved = visibility?.approved === true;
  const lockedProducts = new Set(
    Array.isArray(visibility?.lockedProducts)
      ? visibility.lockedProducts
          .map((entry) => entry?.handle)
          .filter((value) => typeof value === "string" && value.length > 0)
      : [],
  );
  const lockedCollections = new Set(
    Array.isArray(visibility?.lockedCollections)
      ? visibility.lockedCollections
          .map((entry) => entry?.handle)
          .filter((value) => typeof value === "string" && value.length > 0)
      : [],
  );

  const selectors = [
    "li",
    "article",
    ".grid__item",
    ".card-wrapper",
    ".product-card-wrapper",
    ".product-item",
    ".card",
    ".predictive-search__list-item",
    ".search-results__item",
    ".collection-list__item",
  ];

  function matchLockedResource(pathname) {
    const productMatch = pathname.match(/^\/products\/([^/]+)/);
    if (productMatch && lockedProducts.has(productMatch[1])) {
      return "product";
    }

    const collectionMatch = pathname.match(/^\/collections\/([^/]+)/);
    if (collectionMatch && lockedCollections.has(collectionMatch[1])) {
      return "collection";
    }

    return null;
  }

  function hideAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(anchor.href, window.location.origin);
    } catch (_error) {
      return;
    }

    if (parsedUrl.origin !== window.location.origin) return;

    const resourceType = matchLockedResource(parsedUrl.pathname);
    if (!resourceType) return;

    const container =
      selectors
        .map((selector) => anchor.closest(selector))
        .find((element) => element && element !== document.body) || anchor;

    container.classList.add("prodlock-hidden-resource");
    container.setAttribute("data-prodlock-hidden", resourceType);
  }

  function hideLockedLinks(root) {
    if (!(root instanceof Element || root instanceof Document)) return;

    root.querySelectorAll("a[href]").forEach(hideAnchor);
  }

  if (!approved) {
    hideLockedLinks(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches("a[href]")) {
              hideAnchor(node);
            }
            hideLockedLinks(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  const gate = document.querySelector("[data-prodlock-gate]");
  if (!gate) return;

  document.documentElement.classList.add("prodlock-locked");
  document.body.classList.add("prodlock-locked");

  const primaryAction = gate.querySelector(".prodlock-gate__button");
  if (primaryAction instanceof HTMLElement) {
    window.requestAnimationFrame(() => primaryAction.focus());
  }
})();
