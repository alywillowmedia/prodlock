import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (error) {
    logAuthFailure("app-layout", request, error);
    throw error;
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">ProdLock</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

function logAuthFailure(scope: string, request: Request, error: unknown) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (error instanceof Response) {
    console.error("[ProdLock auth]", {
      scope,
      pathname: url.pathname,
      status: error.status,
      search: url.search,
      hasEmbedded: params.has("embedded"),
      hasHmac: params.has("hmac"),
      hasHost: params.has("host"),
      hasShop: params.has("shop"),
      location: error.headers.get("Location"),
    });
    return;
  }

  console.error("[ProdLock auth]", {
    scope,
    pathname: url.pathname,
    search: url.search,
    hasEmbedded: params.has("embedded"),
    hasHmac: params.has("hmac"),
    hasHost: params.has("host"),
    hasShop: params.has("shop"),
    error: error instanceof Error ? error.message : String(error),
  });
}
