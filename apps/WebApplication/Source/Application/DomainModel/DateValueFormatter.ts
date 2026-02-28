/**
 * Formats UNIX-second and ISO timestamp values for thread-list recency labels.
 * Same-calendar-day values render as clock time; older values render as day age.
 */
export interface DateValueFormatterConfiguration {
  locales?: Intl.LocalesArgument;
  timeZone?: string;
  readCurrentDate?: () => Date;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export class DateValueFormatter {
  private readonly locales: Intl.LocalesArgument;
  private readonly timeZone: string | undefined;
  private readonly readCurrentDate: () => Date;
  private readonly clockTimeFormatter: Intl.DateTimeFormat;
  private readonly calendarDayPartsFormatter: Intl.DateTimeFormat;

  public constructor(configuration: DateValueFormatterConfiguration = {}) {
    this.locales = configuration.locales ?? [];
    this.timeZone = configuration.timeZone;
    this.readCurrentDate = configuration.readCurrentDate ?? (() => new Date());

    const formatterOptionsWithTimeZone = this.buildFormatterOptionsWithTimeZone();
    this.clockTimeFormatter = new Intl.DateTimeFormat(this.locales, {
      hour: "2-digit",
      minute: "2-digit",
      ...formatterOptionsWithTimeZone,
    });

    // `en-CA` keeps numeric parts predictable for deterministic day-difference math.
    this.calendarDayPartsFormatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...formatterOptionsWithTimeZone,
    });
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
    const currentDate = this.readCurrentDate();
    const currentDayTimestamp = this.readCalendarDayTimestamp(currentDate);
    const valueDayTimestamp = this.readCalendarDayTimestamp(dateValue);

    if (currentDayTimestamp === valueDayTimestamp || valueDayTimestamp > currentDayTimestamp) {
      return this.clockTimeFormatter.format(dateValue);
    }

    const dayDifference = Math.round(
      (currentDayTimestamp - valueDayTimestamp) / MILLISECONDS_PER_DAY,
    );

    return `${String(dayDifference)}d ago`;
  }

  private readCalendarDayTimestamp(dateValue: Date): number {
    const dateParts = this.calendarDayPartsFormatter.formatToParts(dateValue);
    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;

    for (const datePart of dateParts) {
      if (datePart.type === "year") {
        year = Number(datePart.value);
        continue;
      }

      if (datePart.type === "month") {
        month = Number(datePart.value);
        continue;
      }

      if (datePart.type === "day") {
        day = Number(datePart.value);
      }
    }

    if (year === null || month === null || day === null) {
      throw new Error("Date formatter did not produce year/month/day parts.");
    }

    return Date.UTC(year, month - 1, day);
  }

  private buildFormatterOptionsWithTimeZone(): Intl.DateTimeFormatOptions {
    if (typeof this.timeZone === "string" && this.timeZone.length > 0) {
      return { timeZone: this.timeZone };
    }
    return {};
  }
}
