/**
 * Test helpers สำหรับ integration tests
 */
import { app } from "../src/app";
import { prisma } from "../src/cores/prisma";

// ── HTTP Client ───────────────────────────────────────────────────────────────

export class TestClient {
    private cookies = new Map<string, string>();
    private _csrfToken = "";

    async request(
        method: string,
        path: string,
        options: {
            body?: unknown;
            headers?: Record<string, string>;
            ip?: string;
        } = {},
    ) {
        const cookieHeader = Array.from(this.cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

        const response = await app.handle(
            new Request(`http://localhost${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(cookieHeader && { Cookie: cookieHeader }),
                    ...(options.ip && { "X-Forwarded-For": options.ip }),
                    ...options.headers,
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
            }),
        );

        // Persist cookies
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) {
            for (const pair of setCookie.split(/,(?=\s*\w+=)/)) {
                const nameVal = pair.split(";")[0] ?? "";
                const eqIdx = nameVal.indexOf("=");
                if (eqIdx < 0) continue;
                const name = nameVal.slice(0, eqIdx).trim();
                const val  = nameVal.slice(eqIdx + 1).trim();
                if (val.toLowerCase() === "deleted" || val === "") {
                    this.cookies.delete(name);
                } else {
                    this.cookies.set(name, val);
                }
            }
        }

        // Capture CSRF from header
        const csrfHeader = response.headers.get("x-csrf-token");
        if (csrfHeader) this._csrfToken = csrfHeader;

        const contentType = response.headers.get("content-type") ?? "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: Record<string, any> | null = contentType.includes("application/json")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? await response.json().then((v: any) => v as Record<string, any>).catch(() => null)
            : null;

        return { status: response.status, data, headers: response.headers };
    }

    // POST/PATCH/DELETE — auto-fetch CSRF if missing
    async mutate(method: string, path: string, body?: unknown, ip?: string) {
        if (!this._csrfToken) {
            const r = await this.request("GET", "/api/csrf-token", { ip });
            this._csrfToken = r.headers.get("x-csrf-token") ?? (r.data as Record<string, Record<string, string>>)?.data?.csrf_token ?? "";
        }
        return this.request(method, path, {
            body,
            ip,
            headers: { "X-CSRF-Token": this._csrfToken },
        });
    }

    get csrfToken() { return this._csrfToken; }
    get sid() { return this.cookies.get("sid"); }
    clearSession() { this.cookies.clear(); this._csrfToken = ""; }
}

// ── DB Helpers ────────────────────────────────────────────────────────────────

const TEST_PREFIX = "__test__";

export async function createTestAccount(overrides: {
    username: string;
    role_id: number;
    active?: boolean;
    deleted?: boolean;
    password?: string;
}) {
    const password = overrides.password ?? "TestPass@123";
    const hash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 4 }); // cost=4 for speed in tests
    return prisma.accounts.create({
        data: {
            username: TEST_PREFIX + overrides.username,
            password_hash: hash,
            full_name: `Test ${overrides.username}`,
            title: "นาย",
            role_id: overrides.role_id,
            active: overrides.active ?? true,
            active_unique_key: overrides.active === false ? null : 1,
            deleted_at: overrides.deleted ? new Date() : null,
        },
    });
}

export async function cleanTestAccounts() {
    await prisma.auth_sessions.deleteMany({
        where: { accounts: { username: { startsWith: TEST_PREFIX } } },
    });
    await prisma.accounts.deleteMany({
        where: { username: { startsWith: TEST_PREFIX } },
    });
}

export async function createTestOutboxEvent(
    eventType: string,
    payload: object = {},
    maxAttempts = 3,
) {
    return prisma.service_outbox_events.create({
        data: {
            event_type: eventType,
            payload,
            status: "PENDING",
            attempts: 0,
            max_attempts: maxAttempts,
            available_at: new Date(),
        },
    });
}

export async function cleanTestOutboxEvents(ids: number[]) {
    if (ids.length === 0) return;
    await prisma.service_outbox_events.deleteMany({ where: { id: { in: ids } } });
}
