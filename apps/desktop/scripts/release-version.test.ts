import assert from "node:assert/strict";
import { test } from "node:test";
import { bumpVersion, commitBump, releaseBump } from "./release-version";

test("conventional commit types pick the version bump", () => {
  assert.equal(commitBump("feat(browser): clear the cache"), "minor");
  assert.equal(commitBump("feat: add tabs"), "minor");
  assert.equal(commitBump("fix(release): target macOS 10.15"), "patch");
  assert.equal(commitBump("perf: compress faster"), "patch");
  assert.equal(commitBump("docs: explain releases"), null);
  assert.equal(commitBump("chore(release): v1.1.0"), null);
  assert.equal(commitBump("Merge pull request #2 from dtr00/branch"), null);
});

test("breaking changes bump the major version", () => {
  assert.equal(commitBump("feat(notes)!: store titles apart"), "major");
  assert.equal(commitBump("refactor!: drop old note bodies"), "major");
  assert.equal(commitBump("fix: new database\n\nBREAKING CHANGE: notes must be exported first"), "major");
  assert.equal(commitBump("fix: new database\n\nBREAKING-CHANGE: notes must be exported first"), "major");
  assert.equal(commitBump("docs: mention BREAKING CHANGE: in the guide"), null);
});

test("a release takes the largest bump of its commits", () => {
  assert.equal(releaseBump(["fix: a", "feat: b", "docs: c"]), "minor");
  assert.equal(releaseBump(["fix: a", "feat!: b"]), "major");
  assert.equal(releaseBump(["docs: a", "chore: b", ""]), null);
  assert.equal(releaseBump([]), null);
});

test("versions bump and reset the lower parts", () => {
  assert.equal(bumpVersion("1.4.2", "patch"), "1.4.3");
  assert.equal(bumpVersion("1.4.2", "minor"), "1.5.0");
  assert.equal(bumpVersion("1.4.2", "major"), "2.0.0");
  assert.throws(() => bumpVersion("1.4", "patch"));
});
