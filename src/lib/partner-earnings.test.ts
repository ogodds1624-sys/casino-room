import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { netPartnerEarnings } from "./partner-earnings.ts";

describe("netPartnerEarnings", () => {
  it("deducts a 20% commission from 1,000 to return 800", () => {
    assert.equal(netPartnerEarnings(1000, 20), 800);
  });

  it("uses each partner's commission and recalculates when the rate changes", () => {
    for (const [commission, expected] of [[0, 1000], [10, 900], [20, 800], [75, 250], [100, 0]]) {
      assert.equal(netPartnerEarnings(1000, commission), expected);
    }
  });

  it("returns zero when there are no confirmed earnings", () => {
    assert.equal(netPartnerEarnings(0, 20), 0);
    assert.equal(netPartnerEarnings(0, 100), 0);
  });

  it("preserves fractional currency amounts to two decimal places", () => {
    assert.equal(netPartnerEarnings(1, 20), 0.8);
    assert.equal(netPartnerEarnings(123, 17), 102.09);
    assert.equal(netPartnerEarnings(10.01, 20), 8.01);
  });

  it("applies the same deduction to daily and total earnings in either currency", () => {
    assert.equal(netPartnerEarnings(250, 20), 200);
    assert.equal(netPartnerEarnings(1000, 20), 800);
    assert.equal(netPartnerEarnings(25000, 20), 20000);
    assert.equal(netPartnerEarnings(100000, 20), 80000);
  });
});
