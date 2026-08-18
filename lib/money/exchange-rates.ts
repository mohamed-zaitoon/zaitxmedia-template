export async function getSarToEgpCustomerRate(): Promise<number> {
  const fallback = 12.75;
  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/SAR", {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const marketRate = Number(data?.rates?.EGP);
    if (!Number.isFinite(marketRate) || marketRate <= 0.75) return fallback;
    return Number((marketRate - 0.75).toFixed(4));
  } catch {
    return fallback;
  }
}
