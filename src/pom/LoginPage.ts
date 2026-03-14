import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  async open(): Promise<void> {
    await this.driver.goto(this.buildUrl("/app/login"));
  }

  async login(username: string, password: string): Promise<void> {
    await this.driver.fill('[data-testid="username"]', username);
    await this.driver.fill('[data-testid="password"]', password);
    await this.driver.click('[data-testid="login-button"]');
  }

  async welcomeMessage(): Promise<string> {
    return this.driver.text('[data-testid="welcome"]');
  }

  async errorMessage(): Promise<string> {
    return this.driver.text('[data-testid="error"]');
  }
}
