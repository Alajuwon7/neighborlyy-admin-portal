export const TEST_USER = {
  email: "e2e-test@miyora-app.com",
  password: "TestPassword123!",
  full_name: "E2E Test Manager",
};

export const TEST_PROPERTY = {
  name: "Cypress Gardens",
  community_code: "CYPGRDNS",
  street_address: "456 Oak Avenue",
  city: "Austin",
  state: "TX",
  zip_code: "78701",
  unit_count: "200",
  property_type: "apartment" as const,
};

export const TEST_BRANDING = {
  primary_color: "#E65C4F",
  accent_color: "#78A6C8",
};

export const TEST_FACILITIES = ["Fitness Center", "Swimming Pool", "Clubhouse"];

export const TEST_ADMIN = {
  admin_code: "TEST1234",
};

export const TEST_TEAM_MEMBER = {
  email: "teammate@example.com",
  name: "Jane Doe",
  role: "manager",
};
