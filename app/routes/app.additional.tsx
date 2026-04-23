export default function AdditionalPage() {
  return (
    <s-page heading="ProdLock Notes">
      <s-section heading="Next build step">
        <s-paragraph>
          This app is set up to manage protected products and collections plus a
          manual wholesale email allowlist. The remaining storefront work is a
          theme app extension that checks the logged-in customer and hides or
          replaces protected content.
        </s-paragraph>
        <s-paragraph>
          After that, the hard-stop layer should be a Shopify validation
          function so protected items cannot slip into cart or checkout by URL
          tricks or direct variant posts.
        </s-paragraph>
      </s-section>
      <s-section slot="aside" heading="References">
        <s-unordered-list>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/online-store/theme-app-extensions"
              target="_blank"
            >
              Theme app extensions
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/api/functions/2024-04/cart-and-checkout-validation"
              target="_blank"
            >
              Cart and checkout validation
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
