export class DateValueFormatter {
  public format(value: number | string | null | undefined): string {
    if (typeof value === "number") {
      return new Date(value * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (typeof value === "string") {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return value;
    }
    return "";
  }
}
