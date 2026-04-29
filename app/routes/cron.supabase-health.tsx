import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const unauthorized = authorizeCronRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const sessionCheck = await checkSessions();
  const migrationCheck = await checkMigrations();
  const ok = sessionCheck.ok && migrationCheck.ok;
  const error = [sessionCheck.error, migrationCheck.error]
    .filter(Boolean)
    .join(" | ");

  try {
    const healthCheck = await db.supabaseHealthCheck.create({
      data: {
        overallStatus: ok ? "ok" : "not ok",
        sessionStatus: sessionCheck.ok ? "ok" : "not ok",
        migrationStatus: migrationCheck.ok ? "ok" : "not ok",
        sessionCount: sessionCheck.count,
        migrationErrors: migrationCheck.errors,
        error: error || null,
      },
    });

    const status = ok ? 200 : 503;
    return Response.json(
      {
        ok,
        checkedAt: healthCheck.checkedAt.toISOString(),
        status: {
          overall: healthCheck.overallStatus,
          sessions: healthCheck.sessionStatus,
          migrations: healthCheck.migrationStatus,
        },
        counts: {
          sessions: healthCheck.sessionCount,
          migrationErrors: healthCheck.migrationErrors,
        },
        error: healthCheck.error,
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Supabase cron health check failed", error);

    return Response.json(
      {
        ok: false,
        error: "Unable to write Supabase health check.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
};

async function checkSessions() {
  try {
    const count = await db.session.count();

    return {
      ok: true,
      count,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      error: errorMessage(error),
    };
  }
}

async function checkMigrations() {
  try {
    const rows = await db.$queryRaw<Array<{ errors: number }>>`
      select count(*)::int as errors
      from "_prisma_migrations"
      where logs is not null
        or rolled_back_at is not null
        or finished_at is null
    `;
    const errors = rows[0]?.errors ?? 0;

    return {
      ok: errors === 0,
      errors,
      error: errors === 0 ? null : `${errors} Prisma migration issue(s) found.`,
    };
  } catch (error) {
    return {
      ok: false,
      errors: 1,
      error: errorMessage(error),
    };
  }
}

function authorizeCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return null;
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader === `Bearer ${secret}`) {
    return null;
  }

  return Response.json(
    {
      ok: false,
      error: "Unauthorized.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}
