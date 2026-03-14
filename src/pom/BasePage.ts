import { UiDriver } from "../core/contracts";

export abstract class BasePage {
  constructor(
    protected readonly driver: UiDriver,
    protected readonly baseUrl: string
  ) {}

  protected buildUrl(pathname: string): string {
    return new URL(pathname, this.baseUrl).toString();
  }
}
