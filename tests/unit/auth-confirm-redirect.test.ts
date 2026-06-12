import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_CONFIRMED_PATH,
  confirmRedirectPath,
  sanitizeNextPath,
} from "../../lib/auth-confirm";

const pmUser = {
  id: "pm-1",
  user_metadata: { account_type: "property_manager", full_name: "Pat Manager" },
};
// Mobile-app signups call signUp({ email, password }) with no metadata.
const mobileUser = { id: "res-1", user_metadata: {} };

test("PM signup confirmation continues into the portal", () => {
  assert.equal(confirmRedirectPath(pmUser, true, "email", "/dashboard"), "/dashboard");
  assert.equal(confirmRedirectPath(pmUser, true, "signup", "/dashboard"), "/dashboard");
});

test("PM row alone is enough — pre-marker PMs without metadata stay in the portal", () => {
  assert.equal(
    confirmRedirectPath(mobileUser, true, "email", "/dashboard"),
    "/dashboard"
  );
});

test("metadata alone is enough — PM row lookup failure doesn't bounce a PM", () => {
  assert.equal(
    confirmRedirectPath(pmUser, false, "email", "/dashboard"),
    "/dashboard"
  );
});

test("mobile signup confirmation is sent to the return-to-app page", () => {
  assert.equal(
    confirmRedirectPath(mobileUser, false, "email", "/dashboard/account"),
    MOBILE_CONFIRMED_PATH
  );
  assert.equal(
    confirmRedirectPath(mobileUser, false, "signup", "/dashboard"),
    MOBILE_CONFIRMED_PATH
  );
});

test("recovery links keep the requested next path for everyone", () => {
  assert.equal(
    confirmRedirectPath(pmUser, true, "recovery", "/dashboard/account"),
    "/dashboard/account"
  );
  assert.equal(
    confirmRedirectPath(mobileUser, false, "recovery", "/dashboard/account"),
    "/dashboard/account"
  );
});

test("missing user keeps existing portal behavior", () => {
  assert.equal(confirmRedirectPath(null, false, "email", "/dashboard"), "/dashboard");
});

test("non-PM email_change and magiclink confirmations also return to the app", () => {
  assert.equal(
    confirmRedirectPath(mobileUser, false, "email_change", "/dashboard/account"),
    MOBILE_CONFIRMED_PATH
  );
  assert.equal(
    confirmRedirectPath(mobileUser, false, "magiclink", "/dashboard"),
    MOBILE_CONFIRMED_PATH
  );
});

test("sanitizeNextPath accepts same-origin absolute paths", () => {
  assert.equal(sanitizeNextPath("/dashboard", "/d"), "/dashboard");
  assert.equal(
    sanitizeNextPath("/dashboard/account?tab=billing", "/d"),
    "/dashboard/account?tab=billing"
  );
});

test("sanitizeNextPath rejects open-redirect shapes", () => {
  // userinfo trick: `${origin}@evil.com` → host evil.com
  assert.equal(sanitizeNextPath("@evil.com", "/d"), "/d");
  // protocol-relative
  assert.equal(sanitizeNextPath("//evil.com/phish", "/d"), "/d");
  // backslash variant some browsers normalize to //
  assert.equal(sanitizeNextPath("/\\evil.com", "/d"), "/d");
  // absolute URL
  assert.equal(sanitizeNextPath("https://evil.com", "/d"), "/d");
  assert.equal(sanitizeNextPath(null, "/d"), "/d");
  assert.equal(sanitizeNextPath("", "/d"), "/d");
});
