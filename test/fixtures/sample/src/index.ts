import { UserService } from "./service.js";
import { GREETING } from "./util.js";

export function main(): void {
  const svc = new UserService();
  console.log(GREETING, svc.greet("world"));
}

main();
