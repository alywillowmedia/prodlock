import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  DEFAULT_SETTINGS,
  applyThemeIntegration,
  loadDashboardData,
  loadThemeName,
  loadThemeIntegrationData,
  parseWholesaleEmails,
  removeThemeIntegration,
  saveSettings,
  setResourceLock,
  testThemeIntegration,
} from "../prodlock.server";
import styles from "./_index/styles.module.css";

type ActionData = {
  error?: string;
  success?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const { admin } = await authenticate.admin(request);
  const [dashboard, themeData] = await Promise.all([
    loadDashboardData(admin, query),
    loadThemeIntegrationData(admin),
  ]);

  return {
    query,
    ...dashboard,
    ...themeData,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "save-settings") {
      const shopId = String(formData.get("shopId") ?? "");
      if (!shopId) {
        throw new Error("Missing shop id.");
      }

      await saveSettings(admin, shopId, {
        wholesaleEmails: parseWholesaleEmails(formData.get("wholesaleEmails")),
        loginRequiredMessage:
          String(formData.get("loginRequiredMessage") ?? "").trim() ||
          DEFAULT_SETTINGS.loginRequiredMessage,
        unauthorizedMessage:
          String(formData.get("unauthorizedMessage") ?? "").trim() ||
          DEFAULT_SETTINGS.unauthorizedMessage,
        hidePrices: formData.get("hidePrices") === "on",
      });

      return { success: "Settings saved." } satisfies ActionData;
    }

    if (intent === "toggle-lock") {
      const shopId = String(formData.get("shopId") ?? "");
      const resourceType = String(formData.get("resourceType") ?? "");
      const resourceId = String(formData.get("resourceId") ?? "");
      const resourceHandle = String(formData.get("resourceHandle") ?? "");
      const resourceTitle = String(formData.get("resourceTitle") ?? "");
      const nextLocked = formData.get("nextLocked") === "true";

      if (
        !shopId ||
        (resourceType !== "product" && resourceType !== "collection") ||
        !resourceId ||
        !resourceHandle ||
        !resourceTitle
      ) {
        throw new Error("Missing resource information.");
      }

      await setResourceLock(
        admin,
        shopId,
        resourceType,
        resourceId,
        resourceHandle,
        resourceTitle,
        nextLocked,
      );

      return {
        success: `${resourceType === "product" ? "Product" : "Collection"} ${
          nextLocked ? "locked" : "unlocked"
        }.`,
      } satisfies ActionData;
    }

    if (intent === "apply-theme-integration") {
      const shopId = String(formData.get("shopId") ?? "");
      const themeId = String(formData.get("themeId") ?? "");
      const themeName = await loadThemeName(admin, themeId);

      if (!shopId || !themeId) {
        throw new Error("Choose a theme before applying ProdLock.");
      }

      await applyThemeIntegration(admin, session, shopId, themeId, themeName);

      return {
        success: `ProdLock basic integration applied to ${themeName}.`,
      } satisfies ActionData;
    }

    if (intent === "remove-theme-integration") {
      const shopId = String(formData.get("shopId") ?? "");
      const themeId = String(formData.get("themeId") ?? "");
      const themeName = String(formData.get("themeName") ?? "");

      if (!shopId || !themeId || !themeName) {
        throw new Error("Missing theme information.");
      }

      await removeThemeIntegration(admin, session, shopId, themeId, themeName);

      return {
        success: `ProdLock integration removed from ${themeName}.`,
      } satisfies ActionData;
    }

    if (intent === "test-theme-integration") {
      const themeId = String(formData.get("themeId") ?? "");
      const themeName = await loadThemeName(admin, themeId);

      if (!themeId) {
        throw new Error("Choose a theme before running a code status test.");
      }

      const installed = await testThemeIntegration(admin, themeId);

      return {
        success: installed
          ? `Basic integration code found in ${themeName}.`
          : `ProdLock integration code is missing from ${themeName}.`,
      } satisfies ActionData;
    }

    throw new Error("Unknown action.");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong.",
    } satisfies ActionData;
  }
};

type ResourceListProps = {
  heading: string;
  emptyLabel: string;
  resources: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
    locked: boolean;
  }>;
  resourceType: "product" | "collection";
  shopId: string;
  submitting: boolean;
};

function ResourceList({
  heading,
  emptyLabel,
  resources,
  resourceType,
  shopId,
  submitting,
}: ResourceListProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{heading}</h2>
          <p className={styles.panelHint}>
            Toggle access on the items you want hidden from retail customers.
          </p>
        </div>
        <span className={styles.countBadge}>{resources.length}</span>
      </div>

      {resources.length === 0 ? (
        <p className={styles.emptyState}>{emptyLabel}</p>
      ) : (
        <div className={styles.resourceList}>
          {resources.map((resource) => (
            <Form method="post" key={resource.id} className={styles.resourceRow}>
              <input type="hidden" name="intent" value="toggle-lock" />
              <input type="hidden" name="shopId" value={shopId} />
              <input type="hidden" name="resourceType" value={resourceType} />
              <input type="hidden" name="resourceId" value={resource.id} />
              <input type="hidden" name="resourceHandle" value={resource.handle} />
              <input type="hidden" name="resourceTitle" value={resource.title} />
              <input
                type="hidden"
                name="nextLocked"
                value={resource.locked ? "false" : "true"}
              />

              <div className={styles.resourceMain}>
                <div className={styles.thumbnail} aria-hidden="true">
                  {resource.imageUrl ? (
                    <img
                      src={resource.imageUrl}
                      alt=""
                      className={styles.thumbnailImage}
                    />
                  ) : (
                    <span>{resourceType === "product" ? "P" : "C"}</span>
                  )}
                </div>

                <div className={styles.resourceText}>
                  <strong>{resource.title}</strong>
                  <span className={styles.handle}>/{resource.handle}</span>
                </div>
              </div>

              <div className={styles.resourceActions}>
                <span
                  className={
                    resource.locked ? styles.statusLocked : styles.statusOpen
                  }
                >
                  {resource.locked ? "Wholesale only" : "Open"}
                </span>
                <button
                  type="submit"
                  className={resource.locked ? styles.buttonGhost : styles.button}
                  disabled={submitting}
                >
                  {resource.locked ? "Unlock" : "Lock"}
                </button>
              </div>
            </Form>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Index() {
  const {
    shopId,
    settings,
    visibility,
    products,
    collections,
    query,
    themes,
    integration,
    themeAccessError,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const submitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show(actionData.success);
    }

    if (actionData?.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const lockedProducts = products.filter((product) => product.locked).length;
  const lockedCollections = collections.filter(
    (collection) => collection.locked,
  ).length;

  return (
    <s-page heading="ProdLock">
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Wholesale access control</p>
            <h1 className={styles.title}>
              Lock products and collections to approved customer emails.
            </h1>
            <p className={styles.lead}>
              Choose what stays wholesale-only, keep a manual allowlist, and
              decide whether to use a theme app embed or a basic theme code
              integration for storefront hiding.
            </p>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Allowed emails</span>
              <strong>{settings.wholesaleEmails.length}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Locked products</span>
              <strong>{lockedProducts}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Locked collections</span>
              <strong>{lockedCollections}</strong>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Theme Integration</h2>
              <p className={styles.panelHint}>
                This mirrors the basic install style used by older wholesale
                lock apps: ProdLock injects a single snippet reference into a
                selected theme&apos;s <code>layout/theme.liquid</code> file.
              </p>
            </div>
          </div>

          {themeAccessError ? (
            <div className={styles.noticeError}>
              {themeAccessError}
            </div>
          ) : (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Selected theme</span>
                  <strong className={styles.summaryText}>
                    {integration.themeName ?? "None"}
                  </strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Code status</span>
                  <strong className={styles.summaryText}>
                    {integration.codeStatus === "installed"
                      ? "Installed"
                      : integration.codeStatus === "missing"
                        ? "Missing"
                        : "Unknown"}
                  </strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Hidden handles</span>
                  <strong>
                    {visibility.products.length + visibility.collections.length}
                  </strong>
                </div>
              </div>

              <Form method="post" className={styles.stack}>
                <input type="hidden" name="shopId" value={shopId} />
                <label className={styles.field}>
                  <span className={styles.label}>Theme for applying locks</span>
                  <select
                    name="themeId"
                    className={styles.select}
                    defaultValue={integration.themeId ?? ""}
                  >
                    <option value="">Select a theme</option>
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name} ({theme.role.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.inlineActions}>
                  <button
                    type="submit"
                    name="intent"
                    value="apply-theme-integration"
                    className={styles.button}
                    disabled={submitting}
                  >
                    Apply basic integration
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value="test-theme-integration"
                    className={styles.buttonSecondary}
                    disabled={submitting}
                  >
                    Run code status test
                  </button>
                </div>
              </Form>

              {integration.themeId && integration.themeName ? (
                <Form method="post" className={styles.inlineActions}>
                  <input type="hidden" name="shopId" value={shopId} />
                  <input type="hidden" name="themeId" value={integration.themeId} />
                  <input
                    type="hidden"
                    name="themeName"
                    value={integration.themeName}
                  />
                  <button
                    type="submit"
                    name="intent"
                    value="remove-theme-integration"
                    className={styles.buttonGhost}
                    disabled={submitting}
                  >
                    Remove from theme
                  </button>
                </Form>
              ) : null}

              <div className={styles.notice}>
                Shopify&apos;s current theme file write APIs require
                <code>read_themes</code> and <code>write_themes</code>, and
                Shopify documents theme file editing as an exempted capability.
                If Shopify blocks this for your app, ProdLock will show the API
                error directly here.
              </div>
            </>
          )}
        </section>

        <Form method="post" className={styles.panel}>
          <input type="hidden" name="intent" value="save-settings" />
          <input type="hidden" name="shopId" value={shopId} />

          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Wholesale Settings</h2>
              <p className={styles.panelHint}>
                Enter one email per line or separate them with commas.
              </p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Approved wholesale emails</span>
              <textarea
                name="wholesaleEmails"
                defaultValue={settings.wholesaleEmails.join("\n")}
                className={styles.textarea}
                rows={10}
                placeholder="buyer@company.com"
              />
            </label>

            <div className={styles.stack}>
              <label className={styles.field}>
                <span className={styles.label}>Guest message</span>
                <input
                  name="loginRequiredMessage"
                  defaultValue={settings.loginRequiredMessage}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Non-wholesale message</span>
                <input
                  name="unauthorizedMessage"
                  defaultValue={settings.unauthorizedMessage}
                  className={styles.input}
                />
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  name="hidePrices"
                  defaultChecked={settings.hidePrices}
                />
                <span>Hide prices and purchase controls on locked items</span>
              </label>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.button} disabled={submitting}>
              Save settings
            </button>
          </div>
        </Form>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Protected Resources</h2>
              <p className={styles.panelHint}>
                Search by title and toggle access directly from the list below.
              </p>
            </div>
          </div>

          <Form method="get" className={styles.searchRow}>
            <input
              type="search"
              name="q"
              defaultValue={query}
              className={styles.searchInput}
              placeholder="Search products and collections"
            />
            <button type="submit" className={styles.buttonSecondary}>
              Search
            </button>
          </Form>
        </section>

        <div className={styles.dualColumn}>
          <ResourceList
            heading="Products"
            emptyLabel="No products matched this search."
            resources={products}
            resourceType="product"
            submitting={submitting}
            shopId={shopId}
          />
          <ResourceList
            heading="Collections"
            emptyLabel="No collections matched this search."
            resources={collections}
            resourceType="collection"
            submitting={submitting}
            shopId={shopId}
          />
        </div>
      </div>
    </s-page>
  );
}
