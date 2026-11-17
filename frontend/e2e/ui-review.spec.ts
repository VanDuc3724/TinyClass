import { registerUiStateFlows } from "./ui-state.flows";
import { registerUiNavigationFlows } from "./ui-navigation.flows";

// classes.spec.ts creates the shared synthetic class, family and game fixtures first.
const email = "ui-teacher@example.test";
const password = "E2e-synthetic-password-2026";
registerUiStateFlows(email, password);
registerUiNavigationFlows(email, password);
