export type CartProduct = {
  id: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
};

export type CartLine = CartProduct & { quantity: number };

/** Units that are sold by weight may use decimals (e.g. 1.5 kg); others are whole numbers. */
export function stepFor(unit: string): number {
  return unit === "kg" ? 0.5 : 1;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function addToCart(cart: CartLine[], product: CartProduct, qty = stepFor(product.unit)): CartLine[] {
  const existing = cart.find((l) => l.id === product.id);
  const current = existing?.quantity ?? 0;
  const next = Math.min(round2(current + qty), product.stock);
  if (next <= 0) return cart;
  if (existing) return cart.map((l) => (l.id === product.id ? { ...l, quantity: next } : l));
  return [...cart, { ...product, quantity: next }];
}

export function setQuantity(cart: CartLine[], id: string, qty: number): CartLine[] {
  return cart
    .map((l) => (l.id === id ? { ...l, quantity: Math.max(0, Math.min(round2(qty), l.stock)) } : l))
    .filter((l) => l.quantity > 0);
}

export function lineSubtotal(line: CartLine): number {
  return Math.round(line.price * line.quantity);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + lineSubtotal(l), 0);
}

/** Change to return to the customer, or null when the amount paid is not enough. */
export function changeDue(total: number, paid: number): number | null {
  if (paid < total) return null;
  return paid - total;
}
