/* global BigInt */
const assert = require("assert");
const Scalar = require("./scalar");
const futils = require("./futils");

function getRandomByte() {
  if (typeof window !== "undefined") {
    // Browser
    if (typeof window.crypto !== "undefined") {
      // Supported
      let array = new Uint8Array(1);
      window.crypto.getRandomValues(array);
      return array[0];
    } else {
      // fallback
      return Math.floor(Math.random() * 256);
    }
  } else {
    // NodeJS
    return module.require("crypto").randomBytes(1)[0];
  }
}

module.exports = class ZqField {
  constructor(p) {
    this.one = BigInt(1);
    this.zero = BigInt(0);
    this.p = BigInt(p);
    this.minusone = this.p - BigInt(1);
    this.two = BigInt(2);
    this.half = this.p >> BigInt(1);
    this.bitLength = Scalar.bitLength(this.p);
    this.mask = (BigInt(1) << BigInt(this.bitLength)) - BigInt(1);

    this.n64 = Math.floor((this.bitLength - 1) / 64) + 1;
    this.R = this.e(BigInt(1) << BigInt(this.n64 * 64));

    const e = this.minusone >> BigInt(1);
    this.nqr = this.two;
    let r = this.pow(this.nqr, e);
    while (!this.eq(r, this.minusone)) {
      this.nqr = this.nqr + BigInt(1);
      r = this.pow(this.nqr, e);
    }

    this.s = 0;
    this.t = this.minusone;

    while ((this.t & BigInt(1)) == BigInt(0)) {
      this.s = this.s + 1;
      this.t = this.t >> BigInt(1);
    }

    this.nqr_to_t = this.pow(this.nqr, this.t);
  }

  e(a, b) {
    let res;
    if (!b) {
      res = BigInt(a);
    } else if (b == 16) {
      res = BigInt("0x" + a);
    }
    if (res < 0) {
      let nres = -res;
      if (nres >= this.p) nres = nres % this.p;
      return this.p - nres;
    } else {
      return res >= this.p ? res % this.p : res;
    }
  }

  add(a, b) {
    const res = a + b;
    return res >= this.p ? res - this.p : res;
  }

  sub(a, b) {
    return a >= b ? a - b : this.p - b + a;
  }

  neg(a) {
    return a ? this.p - a : a;
  }

  mul(a, b) {
    return (a * b) % this.p;
  }

  mulScalar(base, s) {
    return (base * this.e(s)) % this.p;
  }

  square(a) {
    return (a * a) % this.p;
  }

  eq(a, b) {
    return a == b;
  }

  neq(a, b) {
    return a != b;
  }

  lt(a, b) {
    const aa = a > this.half ? a - this.p : a;
    const bb = b > this.half ? b - this.p : b;
    return aa < bb;
  }

  gt(a, b) {
    const aa = a > this.half ? a - this.p : a;
    const bb = b > this.half ? b - this.p : b;
    return aa > bb;
  }

  leq(a, b) {
    const aa = a > this.half ? a - this.p : a;
    const bb = b > this.half ? b - this.p : b;
    return aa <= bb;
  }

  geq(a, b) {
    const aa = a > this.half ? a - this.p : a;
    const bb = b > this.half ? b - this.p : b;
    return aa >= bb;
  }

  div(a, b) {
    return this.mul(a, this.inv(b));
  }

  idiv(a, b) {
    assert(b, "Division by zero");
    return a / b;
  }

  inv(a) {
    assert(a, "Division by zero");

    let t = BigInt(0);
    let r = this.p;
    let newt = BigInt(1);
    let newr = a % this.p;
    while (newr) {
      let q = r / newr;
      [t, newt] = [newt, t - q * newt];
      [r, newr] = [newr, r - q * newr];
    }
    if (t < BigInt(0)) t += this.p;
    return t;
  }

  mod(a, b) {
    return a % b;
  }

  pow(b, e) {
    return futils.exp(this, b, e);
  }

  band(a, b) {
    const res = a & b & this.mask;
    return res >= this.p ? res - this.p : res;
  }

  bor(a, b) {
    const res = (a | b) & this.mask;
    return res >= this.p ? res - this.p : res;
  }

  bxor(a, b) {
    const res = (a ^ b) & this.mask;
    return res >= this.p ? res - this.p : res;
  }

  bnot(a) {
    const res = a ^ this.mask;
    return res >= this.p ? res - this.p : res;
  }

  shl(a, b) {
    if (Number(b) < this.bitLength) {
      const res = (a << b) & this.mask;
      return res >= this.p ? res - this.p : res;
    } else {
      const nb = this.p - b;
      if (Number(nb) < this.bitLength) {
        return a >> nb;
      } else {
        return BigInt(0);
      }
    }
  }

  shr(a, b) {
    if (Number(b) < this.bitLength) {
      return a >> b;
    } else {
      const nb = this.p - b;
      if (Number(nb) < this.bitLength) {
        const res = (a << nb) & this.mask;
        return res >= this.p ? res - this.p : res;
      } else {
        return 0;
      }
    }
  }

  land(a, b) {
    return a && b ? BigInt(1) : BigInt(0);
  }

  lor(a, b) {
    return a || b ? BigInt(1) : BigInt(0);
  }

  lnot(a) {
    return a ? BigInt(0) : BigInt(1);
  }

  sqrt(n) {
    if (n == BigInt(0)) return this.zero;

    // Test that have solution
    const res = this.pow(n, this.minusone >> this.one);
    if (res != BigInt(1)) return null;

    let m = this.s;
    let c = this.nqr_to_t;
    let t = this.pow(n, this.t);
    let r = this.pow(n, this.add(this.t, this.one) >> BigInt(1));

    while (t != BigInt(1)) {
      let sq = this.square(t);
      let i = 1;
      while (sq != BigInt(1)) {
        i++;
        sq = this.square(sq);
      }

      // b = c ^ m-i-1
      let b = c;
      for (let j = 0; j < m - i - 1; j++) b = this.square(b);

      m = i;
      c = this.square(b);
      t = this.mul(t, c);
      r = this.mul(r, b);
    }

    if (r > this.p >> BigInt(1)) {
      r = this.neg(r);
    }

    return r;
  }

  normalize(a, b) {
    a = BigInt(a, b);
    if (a < 0) {
      let na = -a;
      if (na >= this.p) na = na % this.p;
      return this.p - na;
    } else {
      return a >= this.p ? a % this.p : a;
    }
  }

  random() {
    const nBytes = (this.bitLength * 2) / 8;
    let res = BigInt(0);
    for (let i = 0; i < nBytes; i++) {
      res = (res << BigInt(8)) + BigInt(getRandomByte());
    }
    return res % this.p;
  }

  toString(a, base) {
    let vs;
    if (a > this.half) {
      const v = this.p - a;
      vs = "-" + v.toString(base);
    } else {
      vs = a.toString(base);
    }
    return vs;
  }

  isZero(a) {
    return a == BigInt(0);
  }
};
