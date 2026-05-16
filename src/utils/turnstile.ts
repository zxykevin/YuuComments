interface TurnstileResponse {
  success: boolean;
}

export async function verifyTurnstileToken(
  token: string,
  secret: string | undefined,
  ip: string | null,
  allowDevBypass: boolean,
): Promise<boolean> {
  if (!secret) {
    // Development fallback only. Configure TURNSTILE_SECRET_KEY in production.
    return allowDevBypass;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: ip ?? undefined,
        }),
      },
    );
    const result = (await response.json()) as TurnstileResponse;
    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}
