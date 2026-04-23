
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (error) {
    logAuthFailure("auth-catchall", request, error);
    throw error;
  }

  return null;
};

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
