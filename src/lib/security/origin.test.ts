import { describe, expect, it } from "vitest";
import { allowedHosts, checkRequest, hostnameOf } from "./origin";

const hosts = allowedHosts("");
const req = (over: Partial<Parameters<typeof checkRequest>[0]>) =>
  checkRequest({ method: "POST", host: "localhost:3000", origin: "http://localhost:3000", fetchSite: "same-origin", ...over }, hosts);

describe("hostnameOf", () => {
  it("포트를 떼어 냅니다", () => {
    expect(hostnameOf("localhost:3000")).toBe("localhost");
    expect(hostnameOf("[::1]:3000")).toBe("[::1]");
    expect(hostnameOf("127.0.0.1")).toBe("127.0.0.1");
  });
});

describe("checkRequest", () => {
  it("같은 출처의 POST는 통과", () => {
    expect(req({})).toBeNull();
    expect(req({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })).toBeNull();
  });

  it("다른 사이트의 POST는 거부 (CSRF)", () => {
    expect(req({ origin: "https://evil.example", fetchSite: "cross-site" })).not.toBeNull();
    expect(req({ origin: "http://localhost:4000" })).not.toBeNull();
  });

  it("Origin 없이 cross-site 표시가 있으면 거부", () => {
    expect(req({ origin: null, fetchSite: "cross-site" })).not.toBeNull();
  });

  it("Origin·Sec-Fetch-Site가 모두 없으면(curl 등 로컬 도구) 통과", () => {
    expect(req({ origin: null, fetchSite: null })).toBeNull();
  });

  it("localhost가 아닌 Host는 GET도 거부 (DNS 리바인딩·사내망 접속)", () => {
    expect(req({ method: "GET", host: "evil.example:3000", origin: null })).not.toBeNull();
    expect(req({ method: "GET", host: "10.0.0.5:3000", origin: null })).not.toBeNull();
    expect(req({ method: "GET", host: null, origin: null })).not.toBeNull();
  });

  it("ALLOWED_HOSTS로 추가한 이름은 허용", () => {
    const extra = allowedHosts("office-pc.local");
    expect(checkRequest({ method: "GET", host: "office-pc.local:3000", origin: null, fetchSite: null }, extra)).toBeNull();
  });

  it("GET은 Origin을 보지 않음", () => {
    expect(req({ method: "GET", origin: "https://evil.example" })).toBeNull();
  });
});
