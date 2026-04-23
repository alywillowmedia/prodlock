type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type AdminSession = {
  accessToken?: string | null;
  shop: string;
};

export const SETTINGS_NAMESPACE = "prodlock";
export const SETTINGS_KEY = "settings";
export const VISIBILITY_KEY = "visibility";
export const INTEGRATION_KEY = "integration";
export const LOCK_NAMESPACE = "$app";
export const LOCK_KEY = "locked";

const THEME_LAYOUT_FILENAME = "layout/theme.liquid";
const THEME_SNIPPET_FILENAME = "snippets/prodlock-integration.liquid";
const INTEGRATION_START_MARKER = "{% comment %} ProdLock integration start {% endcomment %}";
const INTEGRATION_END_MARKER = "{% comment %} ProdLock integration end {% endcomment %}";
const INTEGRATION_RENDER_TAG = "{% render 'prodlock-integration' %}";
const INTEGRATION_BLOCK = `${INTEGRATION_START_MARKER}\n${INTEGRATION_RENDER_TAG}\n${INTEGRATION_END_MARKER}`;

const PRODLOCK_THEME_SNIPPET = `{% liquid
  assign prodlock_settings = shop.metafields.prodlock.settings.value | default: '{}' | parse_json
  assign prodlock_visibility = shop.metafields.prodlock.visibility.value | default: '{}' | parse_json
  assign prodlock_wholesale_emails = prodlock_settings.wholesaleEmails | default: blank
  assign prodlock_hide_prices = prodlock_settings.hidePrices
  assign prodlock_login_required_message = prodlock_settings.loginRequiredMessage | default: 'Please sign in to view this wholesale product.'
  assign prodlock_unauthorized_message = prodlock_settings.unauthorizedMessage | default: 'Your account is not approved for wholesale access yet.'

  assign prodlock_locked = false
  assign prodlock_resource_type = blank
  assign prodlock_resource_title = blank
  assign prodlock_locked_product_handles = prodlock_visibility.products | default: blank
  assign prodlock_locked_collection_handles = prodlock_visibility.collections | default: blank

  if template.name == 'product' and product
    assign prodlock_resource_type = 'product'
    assign prodlock_resource_title = product.title
    if product.metafields["$app"].locked.value
      assign prodlock_locked = true
    endif
  endif

  if template.name == 'collection' and collection
    assign prodlock_resource_type = 'collection'
    assign prodlock_resource_title = collection.title
    if collection.metafields["$app"].locked.value
      assign prodlock_locked = true
    endif
  endif

  assign prodlock_customer_email = blank
  assign prodlock_customer_approved = false
  if customer and customer.email
    assign prodlock_customer_email = customer.email | downcase
    if prodlock_wholesale_emails contains prodlock_customer_email
      assign prodlock_customer_approved = true
    endif
  endif

  assign prodlock_block_page = false
  assign prodlock_gate_message = blank

  if prodlock_locked
    if customer == blank
      assign prodlock_block_page = true
      assign prodlock_gate_message = prodlock_login_required_message
    elsif prodlock_customer_approved == false
      assign prodlock_block_page = true
      assign prodlock_gate_message = prodlock_unauthorized_message
    endif
  endif
%}
<style>
  .prodlock-hidden-resource {
    display: none !important;
  }

  .prodlock-locked,
  .prodlock-locked body {
    overflow: hidden;
  }

  .prodlock-locked main,
  .prodlock-locked [role="main"] {
    filter: blur(10px);
    pointer-events: none;
    user-select: none;
  }

  .prodlock-gate {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .prodlock-gate__scrim {
    position: absolute;
    inset: 0;
    background: rgba(17, 24, 28, 0.58);
    backdrop-filter: blur(6px);
  }

  .prodlock-gate__card {
    position: relative;
    width: min(100%, 520px);
    padding: 28px;
    border-radius: 8px;
    background: #ffffff;
    color: #202223;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
  }

  .prodlock-gate__eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 700;
    text-transform: uppercase;
    color: #616b75;
  }

  .prodlock-gate__title {
    margin: 0;
    font-size: 28px;
    line-height: 1.1;
  }

  .prodlock-gate__message,
  .prodlock-gate__meta {
    margin: 14px 0 0;
    font-size: 16px;
    line-height: 1.5;
    color: #4a4f55;
  }

  .prodlock-gate__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
  }

  .prodlock-gate__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 8px;
    background: #111213;
    color: #ffffff;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
  }

  .prodlock-gate__button--secondary {
    background: #eef1f3;
    color: #202223;
  }

  @media (max-width: 749px) {
    .prodlock-gate {
      padding: 16px;
    }

    .prodlock-gate__card {
      padding: 22px;
    }

    .prodlock-gate__title {
      font-size: 24px;
    }

    .prodlock-gate__actions {
      display: grid;
    }
  }
</style>
{% if prodlock_block_page %}
  <div class="prodlock-gate" data-prodlock-gate>
    <div class="prodlock-gate__scrim"></div>
    <div class="prodlock-gate__card" role="dialog" aria-modal="true" aria-labelledby="prodlock-gate-title">
      <p class="prodlock-gate__eyebrow">ProdLock</p>
      <h2 id="prodlock-gate-title" class="prodlock-gate__title">Wholesale access required</h2>
      <p class="prodlock-gate__message">{{ prodlock_gate_message }}</p>
      <p class="prodlock-gate__meta">
        {{ prodlock_resource_type | capitalize }}:
        <strong>{{ prodlock_resource_title }}</strong>
      </p>
      <div class="prodlock-gate__actions">
        {% if customer == blank %}
          <a class="prodlock-gate__button" href="{{ routes.account_login_url }}">Sign in</a>
        {% endif %}
        <a class="prodlock-gate__button prodlock-gate__button--secondary" href="{{ routes.root_url }}">
          Continue shopping
        </a>
      </div>
    </div>
  </div>
{% endif %}
<script type="application/json" id="prodlock-state">
  {
    "approved": {{ prodlock_customer_approved | json }},
    "lockedProducts": {{ prodlock_locked_product_handles | json }},
    "lockedCollections": {{ prodlock_locked_collection_handles | json }}
  }
</script>
<script>
  (function () {
    var stateNode = document.getElementById("prodlock-state");
    if (!stateNode) return;

    var state = {};
    try {
      state = JSON.parse(stateNode.textContent || "{}");
    } catch (error) {
      state = {};
    }

    var approved = state.approved === true;
    var lockedProducts = new Set(
      Array.isArray(state.lockedProducts)
        ? state.lockedProducts
            .map(function (entry) {
              return entry && entry.handle;
            })
            .filter(Boolean)
        : [],
    );
    var lockedCollections = new Set(
      Array.isArray(state.lockedCollections)
        ? state.lockedCollections
            .map(function (entry) {
              return entry && entry.handle;
            })
            .filter(Boolean)
        : [],
    );

    function matchLockedResource(pathname) {
      var productMatch = pathname.match(/^\\/products\\/([^/]+)/);
      if (productMatch && lockedProducts.has(productMatch[1])) return "product";

      var collectionMatch = pathname.match(/^\\/collections\\/([^/]+)/);
      if (collectionMatch && lockedCollections.has(collectionMatch[1])) {
        return "collection";
      }

      return null;
    }

    function hideAnchor(anchor) {
      if (!(anchor instanceof HTMLAnchorElement)) return;

      var parsedUrl;
      try {
        parsedUrl = new URL(anchor.href, window.location.origin);
      } catch (error) {
        return;
      }

      if (parsedUrl.origin !== window.location.origin) return;

      var resourceType = matchLockedResource(parsedUrl.pathname);
      if (!resourceType) return;

      var selectors = [
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

      var container = selectors
        .map(function (selector) {
          return anchor.closest(selector);
        })
        .find(function (element) {
          return element && element !== document.body;
        });

      (container || anchor).classList.add("prodlock-hidden-resource");
    }

    function hideLockedLinks(root) {
      if (!(root instanceof Element || root instanceof Document)) return;
      root.querySelectorAll("a[href]").forEach(hideAnchor);
    }

    if (!approved) {
      hideLockedLinks(document);

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node instanceof Element) {
              if (node.matches("a[href]")) hideAnchor(node);
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

    var gate = document.querySelector("[data-prodlock-gate]");
    if (!gate) return;

    document.documentElement.classList.add("prodlock-locked");
    document.body.classList.add("prodlock-locked");

    var primaryAction = gate.querySelector(".prodlock-gate__button");
    if (primaryAction instanceof HTMLElement) {
      window.requestAnimationFrame(function () {
        primaryAction.focus();
      });
    }
  })();
</script>
`;

type ResourceType = "product" | "collection";

export type ProdLockSettings = {
  wholesaleEmails: string[];
  loginRequiredMessage: string;
  unauthorizedMessage: string;
  hidePrices: boolean;
};

type VisibilityResource = {
  id: string;
  handle: string;
  title: string;
};

export type ProdLockVisibility = {
  products: VisibilityResource[];
  collections: VisibilityResource[];
};

export type ProdLockThemeInfo = {
  id: string;
  name: string;
  role: string;
};

export type ProdLockThemeIntegration = {
  codeStatus: "installed" | "missing" | "unknown";
  lastAppliedAt: string | null;
  lastError: string | null;
  lastRemovedAt: string | null;
  themeId: string | null;
  themeName: string | null;
};

export type LockableResource = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  locked: boolean;
};

export const DEFAULT_SETTINGS: ProdLockSettings = {
  wholesaleEmails: [],
  loginRequiredMessage: "Please sign in to view this wholesale product.",
  unauthorizedMessage:
    "Your account is not approved for wholesale access yet.",
  hidePrices: true,
};

const DEFAULT_VISIBILITY: ProdLockVisibility = {
  products: [],
  collections: [],
};

const DEFAULT_THEME_INTEGRATION: ProdLockThemeIntegration = {
  codeStatus: "unknown",
  lastAppliedAt: null,
  lastError: null,
  lastRemovedAt: null,
  themeId: null,
  themeName: null,
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type SettingsQueryResponse = {
  shop: {
    id: string;
    metafield: { jsonValue: ProdLockSettings | null } | null;
    visibilityMetafield: { jsonValue: ProdLockVisibility | null } | null;
  };
  products: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      featuredImage: { url: string | null } | null;
      metafield: { value: string | null } | null;
    }>;
  };
  collections: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      image: { url: string | null } | null;
      metafield: { value: string | null } | null;
    }>;
  };
};

type ThemesQueryResponse = {
  shop: {
    metafield: { jsonValue: ProdLockThemeIntegration | null } | null;
  };
  themes: {
    nodes: Array<{
      id: string;
      name: string;
      role: string;
    }>;
  };
};

type ThemeFilesQueryResponse = {
  theme: {
    id: string;
    name: string;
    files: {
      nodes: Array<{
        filename: string;
        body:
          | { content: string }
          | null;
      }>;
      userErrors?: Array<{
        code?: string | null;
        filename?: string | null;
      }>;
    };
  } | null;
};

type MutationError = {
  field?: string[] | null;
  message: string;
};

function normalizeSettings(input: unknown): ProdLockSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS;
  }

  const candidate = input as Partial<ProdLockSettings>;

  return {
    wholesaleEmails: Array.isArray(candidate.wholesaleEmails)
      ? candidate.wholesaleEmails
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : DEFAULT_SETTINGS.wholesaleEmails,
    loginRequiredMessage:
      typeof candidate.loginRequiredMessage === "string" &&
      candidate.loginRequiredMessage.trim()
        ? candidate.loginRequiredMessage.trim()
        : DEFAULT_SETTINGS.loginRequiredMessage,
    unauthorizedMessage:
      typeof candidate.unauthorizedMessage === "string" &&
      candidate.unauthorizedMessage.trim()
        ? candidate.unauthorizedMessage.trim()
        : DEFAULT_SETTINGS.unauthorizedMessage,
    hidePrices:
      typeof candidate.hidePrices === "boolean"
        ? candidate.hidePrices
        : DEFAULT_SETTINGS.hidePrices,
  };
}

function normalizeVisibility(input: unknown): ProdLockVisibility {
  if (!input || typeof input !== "object") {
    return DEFAULT_VISIBILITY;
  }

  const candidate = input as Partial<ProdLockVisibility>;

  const normalizeList = (value: unknown): VisibilityResource[] =>
    Array.isArray(value)
      ? value
          .filter(
            (item): item is VisibilityResource =>
              !!item &&
              typeof item === "object" &&
              typeof (item as VisibilityResource).id === "string" &&
              typeof (item as VisibilityResource).handle === "string" &&
              typeof (item as VisibilityResource).title === "string",
          )
          .map((item) => ({
            id: item.id,
            handle: item.handle.trim(),
            title: item.title.trim(),
          }))
          .filter((item) => item.handle && item.title)
      : [];

  return {
    products: normalizeList(candidate.products),
    collections: normalizeList(candidate.collections),
  };
}

function normalizeThemeIntegration(input: unknown): ProdLockThemeIntegration {
  if (!input || typeof input !== "object") {
    return DEFAULT_THEME_INTEGRATION;
  }

  const candidate = input as Partial<ProdLockThemeIntegration>;

  return {
    codeStatus:
      candidate.codeStatus === "installed" ||
      candidate.codeStatus === "missing" ||
      candidate.codeStatus === "unknown"
        ? candidate.codeStatus
        : DEFAULT_THEME_INTEGRATION.codeStatus,
    lastAppliedAt:
      typeof candidate.lastAppliedAt === "string"
        ? candidate.lastAppliedAt
        : null,
    lastError:
      typeof candidate.lastError === "string" ? candidate.lastError : null,
    lastRemovedAt:
      typeof candidate.lastRemovedAt === "string"
        ? candidate.lastRemovedAt
        : null,
    themeId: typeof candidate.themeId === "string" ? candidate.themeId : null,
    themeName:
      typeof candidate.themeName === "string" ? candidate.themeName : null,
  };
}

function formatResource(resource: LockableResource): LockableResource {
  return resource;
}

async function parseGraphql<T>(
  responsePromise: Promise<Response>,
): Promise<GraphqlResponse<T>> {
  const response = await responsePromise;
  return (await response.json()) as GraphqlResponse<T>;
}

function ensureNoTopLevelErrors<T>(payload: GraphqlResponse<T>) {
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }
}

async function unstableThemeGraphql<T>(
  session: AdminSession,
  query: string,
  variables?: Record<string, unknown>,
) {
  if (!session.accessToken) {
    throw new Error("Missing Shopify access token for theme operation.");
  }

  const response = await fetch(
    `https://${session.shop}/admin/api/unstable/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    throw new Error(`Theme API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as GraphqlResponse<T>;
  ensureNoTopLevelErrors(payload);
  return payload;
}

function injectIntegrationBlock(layoutContent: string) {
  if (layoutContent.includes(INTEGRATION_RENDER_TAG)) {
    return layoutContent;
  }

  if (layoutContent.includes("</body>")) {
    return layoutContent.replace("</body>", `${INTEGRATION_BLOCK}\n</body>`);
  }

  return `${layoutContent}\n${INTEGRATION_BLOCK}\n`;
}

function removeIntegrationBlock(layoutContent: string) {
  const markedBlock = `${INTEGRATION_START_MARKER}\n${INTEGRATION_RENDER_TAG}\n${INTEGRATION_END_MARKER}`;
  if (layoutContent.includes(markedBlock)) {
    return layoutContent.replace(`${markedBlock}\n`, "").replace(markedBlock, "");
  }

  return layoutContent
    .replace(`${INTEGRATION_RENDER_TAG}\n`, "")
    .replace(INTEGRATION_RENDER_TAG, "");
}

async function getThemeFileContents(
  admin: AdminGraphqlClient,
  themeId: string,
  filenames: string[],
) {
  const payload = await parseGraphql<ThemeFilesQueryResponse>(
    admin.graphql(
      `#graphql
      query ProdLockThemeFiles($themeId: ID!, $filenames: [String!]!) {
        theme(id: $themeId) {
          id
          name
          files(filenames: $filenames) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
            userErrors {
              code
              filename
            }
          }
        }
      }`,
      {
        variables: { themeId, filenames },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  if (!payload.data?.theme) {
    throw new Error("Selected theme could not be found.");
  }

  return payload.data.theme;
}

async function saveThemeIntegrationState(
  admin: AdminGraphqlClient,
  shopId: string,
  integration: ProdLockThemeIntegration,
) {
  const payload = await parseGraphql<{
    metafieldsSet: {
      userErrors: MutationError[];
    };
  }>(
    admin.graphql(
      `#graphql
      mutation SaveProdLockIntegration($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: SETTINGS_NAMESPACE,
              key: INTEGRATION_KEY,
              type: "json",
              value: JSON.stringify(integration),
            },
          ],
        },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  const errors = payload.data?.metafieldsSet.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }
}

async function readThemeInstallationStatus(
  admin: AdminGraphqlClient,
  themeId: string | null,
) {
  if (!themeId) {
    return {
      codeStatus: "unknown" as const,
      installed: false,
    };
  }

  const theme = await getThemeFileContents(admin, themeId, [
    THEME_LAYOUT_FILENAME,
    THEME_SNIPPET_FILENAME,
  ]);

  const layoutFile = theme.files.nodes.find(
    (file) => file.filename === THEME_LAYOUT_FILENAME,
  );
  const snippetFile = theme.files.nodes.find(
    (file) => file.filename === THEME_SNIPPET_FILENAME,
  );

  const layoutContent =
    layoutFile?.body && "content" in layoutFile.body
      ? layoutFile.body.content
      : "";

  return {
    codeStatus:
      layoutContent.includes(INTEGRATION_RENDER_TAG) && !!snippetFile
        ? ("installed" as const)
        : ("missing" as const),
    installed: layoutContent.includes(INTEGRATION_RENDER_TAG) && !!snippetFile,
  };
}

export async function loadDashboardData(
  admin: AdminGraphqlClient,
  query: string,
) {
  const search = query.trim();
  const productQuery = search ? `title:*${search}*` : "";
  const collectionQuery = search ? `title:*${search}*` : "";

  const payload = await parseGraphql<SettingsQueryResponse>(
    admin.graphql(
      `#graphql
      query ProdLockDashboard($productQuery: String!, $collectionQuery: String!) {
        shop {
          id
          metafield(namespace: "prodlock", key: "settings") {
            jsonValue
          }
          visibilityMetafield: metafield(namespace: "prodlock", key: "visibility") {
            jsonValue
          }
        }
        products(first: 30, sortKey: TITLE, query: $productQuery) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
            }
            metafield(namespace: "$app", key: "locked") {
              value
            }
          }
        }
        collections(first: 30, sortKey: TITLE, query: $collectionQuery) {
          nodes {
            id
            title
            handle
            image {
              url
            }
            metafield(namespace: "$app", key: "locked") {
              value
            }
          }
        }
      }`,
      {
        variables: { productQuery, collectionQuery },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  const data = payload.data;

  if (!data?.shop) {
    throw new Error("Unable to load the current shop.");
  }

  return {
    shopId: data.shop.id,
    settings: normalizeSettings(data.shop.metafield?.jsonValue),
    visibility: normalizeVisibility(data.shop.visibilityMetafield?.jsonValue),
    products: data.products.nodes.map((product) =>
      formatResource({
        id: product.id,
        title: product.title,
        handle: product.handle,
        imageUrl: product.featuredImage?.url ?? null,
        locked: product.metafield?.value === "true",
      }),
    ),
    collections: data.collections.nodes.map((collection) =>
      formatResource({
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        imageUrl: collection.image?.url ?? null,
        locked: collection.metafield?.value === "true",
      }),
    ),
  };
}

export async function loadThemeIntegrationData(admin: AdminGraphqlClient) {
  try {
    const payload = await parseGraphql<ThemesQueryResponse>(
      admin.graphql(
        `#graphql
        query ProdLockThemes {
          shop {
            metafield(namespace: "prodlock", key: "integration") {
              jsonValue
            }
          }
          themes(first: 25) {
            nodes {
              id
              name
              role
            }
          }
        }`,
      ),
    );

    ensureNoTopLevelErrors(payload);

    const themes =
      payload.data?.themes.nodes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        role: theme.role,
      })) ?? [];

    const savedIntegration = normalizeThemeIntegration(
      payload.data?.shop.metafield?.jsonValue,
    );

    const themeMatch = themes.find((theme) => theme.id === savedIntegration.themeId);
    const status = await readThemeInstallationStatus(admin, savedIntegration.themeId);

    return {
      integration: {
        ...savedIntegration,
        codeStatus: status.codeStatus,
        themeName: themeMatch?.name ?? savedIntegration.themeName,
      },
      themeAccessError: null,
      themes,
    };
  } catch (error) {
    return {
      integration: DEFAULT_THEME_INTEGRATION,
      themeAccessError:
        error instanceof Error ? error.message : "Unable to load theme data.",
      themes: [] as ProdLockThemeInfo[],
    };
  }
}

export function parseWholesaleEmails(rawValue: FormDataEntryValue | null) {
  return [
    ...new Set(
      String(rawValue ?? "")
        .split(/[\n,]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function saveSettings(
  admin: AdminGraphqlClient,
  shopId: string,
  settings: ProdLockSettings,
) {
  const payload = await parseGraphql<{
    metafieldsSet: {
      userErrors: MutationError[];
    };
  }>(
    admin.graphql(
      `#graphql
      mutation SaveProdLockSettings($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: SETTINGS_NAMESPACE,
              key: SETTINGS_KEY,
              type: "json",
              value: JSON.stringify(settings),
            },
          ],
        },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  const errors = payload.data?.metafieldsSet.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }
}

async function loadVisibility(admin: AdminGraphqlClient) {
  const payload = await parseGraphql<{
    shop: {
      metafield: { jsonValue: ProdLockVisibility | null } | null;
    };
  }>(
    admin.graphql(
      `#graphql
      query ProdLockVisibility {
        shop {
          metafield(namespace: "prodlock", key: "visibility") {
            jsonValue
          }
        }
      }`,
    ),
  );

  ensureNoTopLevelErrors(payload);

  return normalizeVisibility(payload.data?.shop.metafield?.jsonValue);
}

async function saveVisibility(
  admin: AdminGraphqlClient,
  shopId: string,
  visibility: ProdLockVisibility,
) {
  const payload = await parseGraphql<{
    metafieldsSet: {
      userErrors: MutationError[];
    };
  }>(
    admin.graphql(
      `#graphql
      mutation SaveProdLockVisibility($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: SETTINGS_NAMESPACE,
              key: VISIBILITY_KEY,
              type: "json",
              value: JSON.stringify(visibility),
            },
          ],
        },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  const errors = payload.data?.metafieldsSet.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }
}

export async function setResourceLock(
  admin: AdminGraphqlClient,
  shopId: string,
  resourceType: ResourceType,
  resourceId: string,
  resourceHandle: string,
  resourceTitle: string,
  locked: boolean,
) {
  const payload = await parseGraphql<{
    metafieldsSet: {
      userErrors: MutationError[];
    };
  }>(
    admin.graphql(
      `#graphql
      mutation SetProdLockResourceLock($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: resourceId,
              namespace: LOCK_NAMESPACE,
              key: LOCK_KEY,
              type: "boolean",
              value: locked ? "true" : "false",
            },
          ],
        },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  const errors = payload.data?.metafieldsSet.userErrors ?? [];
  if (errors.length) {
    throw new Error(
      `${resourceType} update failed: ${errors.map((error) => error.message).join(", ")}`,
    );
  }

  const visibility = await loadVisibility(admin);
  const key = resourceType === "product" ? "products" : "collections";
  const nextEntries = visibility[key].filter((entry) => entry.id !== resourceId);

  if (locked) {
    nextEntries.push({
      id: resourceId,
      handle: resourceHandle,
      title: resourceTitle,
    });
  }

  nextEntries.sort((left, right) => left.title.localeCompare(right.title));

  await saveVisibility(admin, shopId, {
    ...visibility,
    [key]: nextEntries,
  });
}

export async function applyThemeIntegration(
  admin: AdminGraphqlClient,
  session: AdminSession,
  shopId: string,
  themeId: string,
  themeName: string,
) {
  const theme = await getThemeFileContents(admin, themeId, [THEME_LAYOUT_FILENAME]);
  const layoutFile = theme.files.nodes.find(
    (file) => file.filename === THEME_LAYOUT_FILENAME,
  );

  const layoutContent =
    layoutFile?.body && "content" in layoutFile.body ? layoutFile.body.content : null;

  if (!layoutContent) {
    throw new Error("Could not read layout/theme.liquid from the selected theme.");
  }

  const nextLayout = injectIntegrationBlock(layoutContent);

  const payload = await unstableThemeGraphql<{
    themeFilesUpsert: {
      userErrors: MutationError[];
    };
  }>(
    session,
    `mutation ThemeFilesUpsert($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
      themeFilesUpsert(files: $files, themeId: $themeId) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      files: [
        {
          filename: THEME_LAYOUT_FILENAME,
          body: {
            type: "TEXT",
            value: nextLayout,
          },
        },
        {
          filename: THEME_SNIPPET_FILENAME,
          body: {
            type: "TEXT",
            value: PRODLOCK_THEME_SNIPPET,
          },
        },
      ],
      themeId,
    },
  );

  const errors = payload.data?.themeFilesUpsert.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  await saveThemeIntegrationState(admin, shopId, {
    codeStatus: "installed",
    lastAppliedAt: new Date().toISOString(),
    lastError: null,
    lastRemovedAt: null,
    themeId,
    themeName,
  });
}

export async function removeThemeIntegration(
  admin: AdminGraphqlClient,
  session: AdminSession,
  shopId: string,
  themeId: string,
  themeName: string,
) {
  const theme = await getThemeFileContents(admin, themeId, [THEME_LAYOUT_FILENAME]);
  const layoutFile = theme.files.nodes.find(
    (file) => file.filename === THEME_LAYOUT_FILENAME,
  );

  const layoutContent =
    layoutFile?.body && "content" in layoutFile.body ? layoutFile.body.content : null;

  if (!layoutContent) {
    throw new Error("Could not read layout/theme.liquid from the selected theme.");
  }

  const nextLayout = removeIntegrationBlock(layoutContent);

  const upsertPayload = await unstableThemeGraphql<{
    themeFilesUpsert: {
      userErrors: MutationError[];
    };
  }>(
    session,
    `mutation ThemeFilesUpsert($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
      themeFilesUpsert(files: $files, themeId: $themeId) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      files: [
        {
          filename: THEME_LAYOUT_FILENAME,
          body: {
            type: "TEXT",
            value: nextLayout,
          },
        },
      ],
      themeId,
    },
  );

  const upsertErrors = upsertPayload.data?.themeFilesUpsert.userErrors ?? [];
  if (upsertErrors.length) {
    throw new Error(upsertErrors.map((error) => error.message).join(", "));
  }

  await unstableThemeGraphql<{
    themeFilesDelete: {
      userErrors: MutationError[];
    };
  }>(
    session,
    `mutation ThemeFilesDelete($files: [String!]!, $themeId: ID!) {
      themeFilesDelete(files: $files, themeId: $themeId) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      files: [THEME_SNIPPET_FILENAME],
      themeId,
    },
  );

  await saveThemeIntegrationState(admin, shopId, {
    codeStatus: "missing",
    lastAppliedAt: null,
    lastError: null,
    lastRemovedAt: new Date().toISOString(),
    themeId,
    themeName,
  });
}

export async function testThemeIntegration(
  admin: AdminGraphqlClient,
  themeId: string,
) {
  const status = await readThemeInstallationStatus(admin, themeId);
  return status.installed;
}

export async function loadThemeName(
  admin: AdminGraphqlClient,
  themeId: string,
) {
  const payload = await parseGraphql<{
    theme: {
      name: string;
    } | null;
  }>(
    admin.graphql(
      `#graphql
      query ProdLockThemeName($themeId: ID!) {
        theme(id: $themeId) {
          name
        }
      }`,
      {
        variables: { themeId },
      },
    ),
  );

  ensureNoTopLevelErrors(payload);

  return payload.data?.theme?.name ?? themeId;
}
