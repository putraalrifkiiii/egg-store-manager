import { describe, expect, it } from "vitest";
import { addToCart, cartTotal, changeDue, setQuantity } from "./cart";

const ras = { id: "a", name: "Telur Ayam Ras", unit: "kg", price: 29000, stock: 10 };
const bebek = { id: "b", name: "Telur Bebek", unit: "butir", price: 3000, stock: 5 };

describe("cart", () => {
  it("adds half a kilo for eggs sold by weight", () => {
    expect(addToCart([], ras)[0]?.quantity).toBe(0.5);
  });

  it("never exceeds the available stock", () => {
    let cart = addToCart([], bebek, 4);
    cart = addToCart(cart, bebek, 4);
    expect(cart[0]?.quantity).toBe(5);
  });

  it("totals 1.5 kg of Telur Ayam Ras plus 3 duck eggs as 52,500", () => {
    const cart = [
      { ...ras, quantity: 1.5 },
      { ...bebek, quantity: 3 },
    ];
    expect(cartTotal(cart)).toBe(52500);
  });

  it("removes a line when quantity is set to zero", () => {
    const cart = setQuantity([{ ...bebek, quantity: 2 }], "b", 0);
    expect(cart).toHaveLength(0);
  });

  it("returns change of 47,500 when paying 100,000 for 52,500", () => {
    expect(changeDue(52500, 100000)).toBe(47500);
  });

  it("refuses payment below the total", () => {
    expect(changeDue(52500, 50000)).toBeNull();
  });
});
