import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Masker, aliasAppendix, resultToMarkdown } from "./mask";
import { parseNmapXml, summarize } from "./parse";
import { buildNmapArgs } from "./profiles";
import { parseTargets, targetContains, validateTarget } from "./targets";

const xml = readFileSync(join(__dirname, "__fixtures__", "sample.xml"), "utf8");

describe("허용 대상 검증", () => {
  it("IPv4·/24 이상 대역·호스트 이름만 허용한다", () => {
    expect(validateTarget("10.0.0.5")).toBeNull();
    expect(validateTarget("10.0.0.0/24")).toBeNull();
    expect(validateTarget("web.corp.local")).toBeNull();
    expect(validateTarget("10.0.0.0/16")).toMatch("/24");
    expect(validateTarget("-sV")).toMatch("-로 시작");
    expect(validateTarget("10.0.0.1-50")).not.toBeNull(); // nmap 범위 표기
    expect(validateTarget("10.0.0.*")).not.toBeNull();
    expect(validateTarget("10.0.0.1,2,3")).not.toBeNull();
    expect(validateTarget("localhost")).toBeNull();
    expect(validateTarget("a.com; rm -rf /")).not.toBeNull();
    expect(validateTarget("300.1.1.1")).not.toBeNull();
  });

  it("목록 JSON에서 잘못된 항목·중복 이름을 골라낸다", () => {
    const { targets, errors } = parseTargets({
      targets: [
        { name: "웹", target: "10.0.0.5" },
        { name: "웹", target: "10.0.0.6" },
        { name: "넓은 대역", target: "10.0.0.0/8" },
        { name: "", target: "10.0.0.7" },
      ],
    });
    expect(targets).toEqual([{ name: "웹", target: "10.0.0.5" }]);
    expect(errors).toHaveLength(3);
    expect(parseTargets({}).errors[0]).toMatch("targets");
  });

  it("대역 포함 여부를 계산한다", () => {
    expect(targetContains("10.10.0.0/24", "10.10.0.200")).toBe(true);
    expect(targetContains("10.10.0.0/24", "10.10.1.1")).toBe(false);
    expect(targetContains("10.10.0.5", "10.10.0.5")).toBe(true);
  });
});

describe("nmap 인자", () => {
  it("고정 옵션 + 안전 옵션 + 대상 순서로 만든다 (관리자 권한 스캔·스크립트 없음)", () => {
    const args = buildNmapArgs("service", ["10.0.0.5"]);
    expect(args).toEqual([
      "-sT", "-Pn", "--top-ports", "100", "-sV", "--version-light",
      "-T3", "--max-rate", "50", "--host-timeout", "5m", "-oX", "-",
      "10.0.0.5",
    ]);
    expect(args.join(" ")).not.toMatch(/-sS|--script|-O\b|-A\b/);
  });
});

describe("nmap XML 해석", () => {
  it("호스트·포트·서비스·생략 포트를 읽는다", () => {
    const r = parseNmapXml(xml);
    expect(r.hosts).toHaveLength(2);
    expect(r.hosts[0]).toMatchObject({ address: "10.10.0.1", hostname: "gw.corp.local", status: "up", omitted: { closed: 97 } });
    expect(r.hosts[0].ports[0]).toEqual({
      protocol: "tcp", port: 22, state: "open", service: "ssh", product: "OpenSSH", version: "8.9p1 Ubuntu",
    });
    expect(summarize(r)).toEqual({ hostsUp: 2, openPorts: 2 });
  });

  it("nmap 결과가 아니면 거부한다", () => {
    expect(() => parseNmapXml("<html><body>hi</body></html>")).toThrow("nmap");
    expect(() => parseNmapXml("<<<")).toThrow();
  });
});

describe("별칭 처리 (AI로 실제 IP를 보내지 않음)", () => {
  const targets = [
    { name: "테스트망", target: "10.10.0.0/24" },
    { name: "웹서버", target: "10.10.9.9" },
  ];

  it("AI용 요약에는 실제 IP·호스트 이름이 없다", () => {
    const masker = new Masker(targets);
    const md = resultToMarkdown(parseNmapXml(xml), masker);
    expect(md).toContain("### 테스트망 #1");
    expect(md).toContain("### 테스트망 #2");
    expect(md).toContain("| 22/tcp | open | ssh | OpenSSH 8.9p1 Ubuntu |");
    expect(md).toContain("| 3389/tcp | filtered |");
    expect(md).toContain("닫힌 포트 97개");
    expect(md).not.toMatch(/10\.10\.0\.\d|gw\.corp\.local/);
  });

  it("지시문 속 등록 대상과 IP를 별칭으로 바꾸고, 대응표는 따로 만든다", () => {
    const masker = new Masker(targets);
    expect(masker.maskText("10.10.9.9 와 10.10.0.7, 8.8.8.8 점검")).toBe("웹서버 와 테스트망 #1, 호스트 #1 점검");
    const appendix = aliasAppendix(masker)!;
    expect(appendix).toContain("| 테스트망 #1 | 10.10.0.7 |");
    expect(appendix).toContain("| 웹서버 | 10.10.9.9 |");
  });

  it("등록 대상은 대소문자를 가리지 않고, 더 긴 주소 일부는 바꾸지 않는다", () => {
    const masker = new Masker([{ name: "그룹웨어", target: "gw.corp.local" }, ...targets]);
    expect(masker.maskText("GW.Corp.Local 점검")).toBe("그룹웨어 점검");
    expect(masker.maskText("10.10.9.99")).toBe("호스트 #1");
  });

  it("IPv6 주소를 가리고, 시각(10:30:00)은 그대로 둔다", () => {
    const masker = new Masker(targets);
    expect(masker.maskText("fe80::1 과 2001:db8:0:0:0:0:0:7 를 10:30:00에 점검")).toBe("호스트 #1 과 호스트 #2 를 10:30:00에 점검");
  });

  it("내부 도메인 호스트 이름을 가린다 (기본 끝말 + 설정한 사내 도메인)", () => {
    const masker = new Masker(targets, ["mycorp.co.kr"]);
    expect(masker.maskText("db01.corp.local, erp.mycorp.co.kr, www.kisa.or.kr 확인")).toBe("호스트 #1, 호스트 #2, www.kisa.or.kr 확인");
    expect(aliasAppendix(masker)).toContain("| 호스트 #2 | erp.mycorp.co.kr |");
  });

  it("허용 목록 JSON에서 사내 도메인을 읽는다", () => {
    expect(parseTargets({ targets: [], internalDomains: ["mycorp.co.kr", 3, "bad domain"] }).internalDomains).toEqual(["mycorp.co.kr"]);
  });
});
