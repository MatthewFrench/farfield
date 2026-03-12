import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LocalTemplatePath = path.resolve(
  process.cwd(),
  "operations",
  "caddy",
  "Caddyfile.local.template",
);
const DomainTemplatePath = path.resolve(
  process.cwd(),
  "operations",
  "caddy",
  "Caddyfile.domain.template",
);

function readTemplate(templatePath: string): string {
  return fs.readFileSync(templatePath, "utf8");
}

describe("CaddyTemplateTrustPolicy", () => {
  it("trusts the local template only for the explicit configured site origin", () => {
    const template = readTemplate(LocalTemplatePath);

    expect(template).toContain("header Origin {{SITE_ADDRESS}}");
    expect(template).not.toContain("{http.request.host}");
    expect(template).not.toContain('{http.request.header.Origin} == ""');
  });

  it("trusts the domain template only for the explicit configured domain origin", () => {
    const template = readTemplate(DomainTemplatePath);

    expect(template).toContain('{header.Origin} == "https://{{DOMAIN_HOST}}"');
    expect(template).toContain('{header.Origin} == "" && ({method} == "GET" || {method} == "HEAD")');
    expect(template).not.toContain("{http.request.host}");
  });
});
