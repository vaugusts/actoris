import { LoginPage } from "../pom/LoginPage";

export class LoginWorkflow {
  constructor(private readonly page: LoginPage) {}

  async signIn(username: string, password: string): Promise<string> {
    await this.page.open();
    await this.page.login(username, password);
    return this.page.welcomeMessage();
  }
}
