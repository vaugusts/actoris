import { BasePage } from "./BasePage";

export class DashboardPage extends BasePage {
  async greeting(): Promise<string> {
    return this.driver.text('[data-testid="dashboard-greeting"]');
  }
}
