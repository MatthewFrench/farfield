/**
 * Formats UNIX-second and ISO timestamp values as concise clock labels.
 * Locale/time-zone inputs are optional so tests can pin deterministic output.
 */
export interface DateValueFormatterConfiguration {
  locales?: Intl.LocalesArgument;
  timeZone?: string;
}

export class DateValueFormatter {
  private readonly locales: Intl.LocalesArgument;
  private readonly timeZone: string | undefined;

  public constructor(configuration: DateValueFormatterConfiguration = {}) {
    this.locales = configuration.locales ?? [];
    this.timeZone = configuration.timeZone;
  }

  public format(value: number | string | null | undefined): string {
    if (typeof value === "number") {
      return this.formatDateValue(new Date(value * 1000));
    }

    if (typeof value === "string") {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return this.formatDateValue(parsedDate);
      }
      return value;
    }

    return "";
  }

  private formatDateValue(dateValue: Date): string {
    if (typeof this.timeZone === "string" && this.timeZone.length > 0) {
      return dateValue.toLocaleTimeString(this.locales, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: this.timeZone
      });
    }

    return dateValue.toLocaleTimeString(this.locales, {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}
