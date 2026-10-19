/** Origins die de keuzehulp mogen embedden (Webflow-site + staging). Komma-gescheiden. */
export function toegestaneParents(): string[] {
  return (process.env.ALLOWED_PARENT_ORIGINS ?? "https://www.goldfizh.nl,https://goldfizh.webflow.io")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function veiligeParent(origin: string | undefined, url: string | undefined) {
  if (!origin || !toegestaneParents().includes(origin)) return null;
  let deelUrl: string | null = null;
  try {
    if (url && new URL(url).origin === origin) deelUrl = url;
  } catch {}
  return { origin, deelUrl };
}
