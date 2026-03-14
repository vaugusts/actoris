import { ResultSink, TestExecutionResult } from "../../core/contracts";

export class SmtpResultSink implements ResultSink {
  readonly name = "smtp-results";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async publish(
    result: TestExecutionResult,
    options?: Record<string, unknown>
  ): Promise<void> {
    const host = String(options?.host ?? this.defaults.host ?? "");
    const from = String(options?.from ?? this.defaults.from ?? "");
    const to = String(options?.to ?? this.defaults.to ?? "");

    if (!host || !from || !to) {
      throw new Error("smtp-results sink requires host, from, and to");
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(options?.port ?? this.defaults.port ?? 587),
      secure: Boolean(options?.secure ?? this.defaults.secure ?? false),
      auth: options?.auth ?? this.defaults.auth
    });

    await transporter.sendMail({
      from,
      to,
      subject: `Automation result: ${result.name}`,
      text: JSON.stringify(result, null, 2)
    });
  }
}
