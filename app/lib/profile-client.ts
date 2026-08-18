export async function getMyProfile() {
  const response = await fetch("/api/profile", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.profile ?? null;
}

export async function updateMyProfile(updates: Record<string, string>) {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "تعذر تحديث الملف الشخصي");
  }
  return {
    profile: result.profile,
    warnings: result.warnings || [],
  };
}
