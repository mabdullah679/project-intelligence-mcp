import { UserService } from "./service.js";

// A fixture test file to exercise test-file detection.
export function checkGreeting(): boolean {
  return new UserService().greet("x").includes("x");
}
