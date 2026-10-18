/** SIP-010 amount conversion. Decimals come from the token contract. */

export function toBaseUnits(displayAmount: number | string, decimals: number): bigint {
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid token decimals.");
  }

  const raw = String(displayAmount).trim();
  if (!raw || raw === ".") {
    throw new Error("Amount is required.");
  }

  const negative = raw.startsWith("-");
  if (negative) {
    throw new Error("Amount must be positive.");
  }

  const [wholePart, fracPart = ""] = raw.split(".");
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fracPart)) {
    throw new Error("Amount must be a number.");
  }

  if (fracPart.length > decimals) {
    throw new Error(`Amount cannot have more than ${decimals} decimal places.`);
  }

  const frac = fracPart.padEnd(decimals, "0");
  const combined = `${wholePart || "0"}${frac}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(combined);
}

export function fromBaseUnits(amount: bigint | number | string, decimals: number): string {
  const value = BigInt(amount);
  if (decimals === 0) return value.toString();

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const padded = abs.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  const rendered = frac ? `${whole}.${frac}` : whole;
  return negative ? `-${rendered}` : rendered;
}

export function formatDisplayAmount(amount: bigint | number | string, decimals: number): string {
  const asNumber = Number(fromBaseUnits(amount, decimals));
  if (!Number.isFinite(asNumber)) {
    return fromBaseUnits(amount, decimals);
  }
  return asNumber.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
