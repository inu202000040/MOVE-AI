import assert from "node:assert/strict";
import test from "node:test";

import {
  lockBodyScroll,
  type BodyScrollTarget,
} from "../../app/components/shell";

type InlineStyleTarget = BodyScrollTarget["style"];

class InlineStyleFixture implements InlineStyleTarget {
  constructor(private readonly body: BodyFixture) {}

  get overflow(): string {
    return this.body.readOverflow();
  }

  set overflow(value: string) {
    this.body.writeOverflow(value);
  }

  get length(): number {
    return this.body.readOverflow() === "" ? 0 : 1;
  }
}

class BodyFixture implements BodyScrollTarget {
  private overflowValue: string;
  private styleAttributePresent: boolean;
  readonly removedAttributes: string[] = [];
  readonly style: BodyScrollTarget["style"];

  constructor(overflow: string, hasStyleAttribute: boolean) {
    this.overflowValue = overflow;
    this.styleAttributePresent = hasStyleAttribute;
    this.style = new InlineStyleFixture(this);
  }

  readOverflow(): string {
    return this.overflowValue;
  }

  writeOverflow(value: string): void {
    this.overflowValue = value;
    this.styleAttributePresent = true;
  }

  hasAttribute(name: "style"): boolean {
    assert.equal(name, "style");
    return this.styleAttributePresent;
  }

  removeAttribute(name: "style"): void {
    assert.equal(name, "style");
    this.styleAttributePresent = false;
    this.removedAttributes.push(name);
  }
}

test("locks overflow and restores an originally absent style attribute exactly", () => {
  const fixtureUnderTest = new BodyFixture("", false);
  const release = lockBodyScroll(fixtureUnderTest);

  assert.equal(fixtureUnderTest.style.overflow, "hidden");
  assert.equal(fixtureUnderTest.hasAttribute("style"), true);

  release();
  assert.equal(fixtureUnderTest.style.overflow, "");
  assert.equal(fixtureUnderTest.hasAttribute("style"), false);
  assert.deepEqual(fixtureUnderTest.removedAttributes, ["style"]);

  release();
  assert.deepEqual(fixtureUnderTest.removedAttributes, ["style"]);
});

test("restores the prior overflow and preserves a pre-existing style attribute", () => {
  const fixtureUnderTest = new BodyFixture("clip", true);
  const release = lockBodyScroll(fixtureUnderTest);

  assert.equal(fixtureUnderTest.style.overflow, "hidden");
  release();

  assert.equal(fixtureUnderTest.style.overflow, "clip");
  assert.equal(fixtureUnderTest.hasAttribute("style"), true);
  assert.deepEqual(fixtureUnderTest.removedAttributes, []);
});
