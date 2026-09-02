import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthenticationError } from "@/server/core/errors";
import { getEnv } from "@/server/config/env";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export async function setMerchantSessionCookie(token: string, expiresAt: Date) {
  const env = getEnv();
  const store = await cookies();
  store.set(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearMerchantSessionCookie() {
  const env = getEnv();
  const store = await cookies();
  store.set(env.AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getMerchantSessionToken() {
  const env = getEnv();
  return (await cookies()).get(env.AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getOptionalMerchantIdentity() {
  const token = await getMerchantSessionToken();
  if (!token) return null;
  try {
    return await getMerchantService().getIdentity(token);
  } catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}

export async function requireMerchantIdentity() {
  const identity = await getOptionalMerchantIdentity();
  if (!identity) redirect("/login");
  return identity;
}

export async function requireMerchantApiIdentity() {
  const token = await getMerchantSessionToken();
  if (!token) throw new AuthenticationError();
  const identity = await getMerchantService().getIdentity(token);
  return { token, identity };
}
