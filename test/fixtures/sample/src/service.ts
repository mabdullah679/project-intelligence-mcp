import { formatMessage } from "./util.js";

export class UserService {
  greet(name: string): string {
    return formatMessage(name);
  }
}
