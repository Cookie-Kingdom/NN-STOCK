import { cookies } from "next/headers";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import { seed, sevenDayRoleplay } from "@/lib/store";
import { stripSaleMoney } from "@/lib/sale-money";
import { LOCAL_ACCOUNT_COOKIE, LOCAL_DB } from "@/lib/local-db";

// Test-only stand-in for the app_state table and save_app_state RPC. Never served
// from a production build, and node:sqlite is only loaded when enabled.
const enabled = LOCAL_DB && process.env.NODE_ENV !== "production";
let local:
  | Promise<
      {
        db: import("node:sqlite").DatabaseSync;
      } & typeof import("@/lib/local-db.server")
    >
  | undefined;
const open = () =>
  (local ??= import("@/lib/local-db.server").then((mod) => ({
    ...mod,
    db: mod.openLocalDb(process.env.LOCAL_DB_FILE || ".local/app.db"),
  })));

const signedIn = async () =>
  accountById((await cookies()).get(LOCAL_ACCOUNT_COOKIE)?.value);

/** Like load_app_state: the Account Manager's copy has no sale money in it (C4). */
export async function GET() {
  if (!enabled) return new Response(null, { status: 404 });
  const { db, readState } = await open();
  const row = readState(db);
  return Response.json(
    (await signedIn())?.hidesSales
      ? { ...row, payload: stripSaleMoney(row.payload) }
      : row,
  );
}

/** e2e setup: `?state=seed` resets to the seed (startFresh), `?state=sample` loads
 * the seven-day sample set (loadSampleData). */
export async function PUT(request: Request) {
  if (!enabled) return new Response(null, { status: 404 });
  const state = new URL(request.url).searchParams.get("state");
  const payload =
    state === "seed"
      ? structuredClone(seed)
      : state === "sample"
        ? sevenDayRoleplay(today())
        : null;
  if (!payload)
    return Response.json(
      { message: "state must be seed or sample" },
      { status: 400 },
    );
  const { db, replaceState } = await open();
  return Response.json(replaceState(db, payload));
}

export async function POST(request: Request) {
  if (!enabled) return new Response(null, { status: 404 });
  const { db, saveState } = await open();
  const account = await signedIn();
  const { payload, expectedRevision } = await request.json();
  try {
    // Like save_app_state, only the new revision goes back: never the payload.
    const { revision } = saveState(db, account, payload, expectedRevision);
    return Response.json({ revision });
  } catch (error) {
    return Response.json(
      { message: (error as Error).message },
      { status: 409 },
    );
  }
}
