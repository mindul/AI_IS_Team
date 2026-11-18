# AI 정보보안팀 (AI Office)

팀장이 한 줄로 지시하면 AI 직원들(비서실장, 위협정보 분석가, 취약점 점검·침해대응·컴플라이언스·보안교육 담당)이 나눠 일하고, 결과를 보고서로 올려 팀장 결재를 받는 가상 사무실입니다.

- **실제 AI 모드**: Claude Code CLI(구독) 또는 Anthropic API 키로 실제 조사·작성
- **시뮬레이션 모드**: AI 호출 없이 예시 흐름만 재생 (비용 없음)
- **시스템 점검**: 팀장이 허용한 대상만, 팀장 승인 후 고정된 nmap 옵션으로 스캔. AI에게는 실제 IP 대신 별칭만 전달

## 실행

필요한 것: Node.js 20 이상, (실제 AI 모드) Claude Code CLI 로그인 또는 API 키, (점검 기능) `nmap`

| 방법 | 설명 |
|---|---|
| `launch.command` 더블클릭 | 빌드 후 실행하고 브라우저를 엽니다 (평소 사용) |
| `DEV=1 ./launch.command` | 개발 모드 (코드를 고치는 중일 때) |
| `npm run dev` / `npm run build && npm start` | 터미널에서 직접 실행 |

서버는 **이 PC(127.0.0.1)에서만** 접속할 수 있습니다. 사내망의 다른 PC에서는 열리지 않습니다.

## 설정

`.env.local`에 넣습니다 (모두 선택).

| 변수 | 기본값 | 설명 |
|---|---|---|
| `AI_BACKEND` | `subscription` | `api`로 두면 API 키 방식 사용 |
| `ANTHROPIC_API_KEY` | – | `AI_BACKEND=api`일 때 필요. 구독 방식에서는 자동으로 빼고 실행합니다 |
| `CLAUDE_CLI_PATH` | `claude` | Claude Code CLI 경로 |
| `NMAP_PATH` | `nmap` | nmap 경로 |
| `SCAN_TARGETS_FILE` | `config/scan-targets.json` | 점검 허용 목록 |
| `REPORTS_DIR` | `data/reports` | 승인한 보고서 저장 폴더 |
| `SCAN_AUDIT_FILE` | `data/audit/scan-log.jsonl` | 점검 감사 기록 |
| `ALLOWED_HOSTS` | – | localhost 말고 접속을 허용할 호스트 이름 (쉼표 구분). 보통 필요 없음 |

### 점검 허용 목록

`config/scan-targets.example.json`을 `config/scan-targets.json`으로 복사해 고칩니다 (git에 올라가지 않음).

- `targets`: 이름·대상(IPv4, /24 이상 대역, 호스트 이름). AI는 **이름만** 압니다.
- `internalDomains`: 사내 도메인. 그 아래 호스트 이름도 AI에게 별칭으로만 보냅니다. `.local`·`.corp`·`.internal` 등은 따로 적지 않아도 가립니다.

## 데이터와 보안

- 보고서(`data/reports`)와 점검 감사 기록(`data/audit`)은 이 PC에만 저장되고 git에서 제외됩니다.
- 보고서 부록의 **별칭 ↔ 실제 주소 대응표**는 이 PC 저장본에만 붙고 AI에게는 보내지 않습니다.
- API는 localhost 접속만 받고, 데이터를 바꾸는 요청은 같은 출처(Origin)일 때만 처리합니다 (`src/proxy.ts`). 다른 웹사이트가 브라우저를 통해 미션을 실행하거나 보고서를 바꿀 수 없습니다.
- 지시문 속 IPv4·IPv6·내부 호스트 이름은 AI로 보내기 전에 별칭으로 바뀝니다. 다만 고객정보·비밀번호는 자동으로 걸러지지 않으니 입력하지 마세요.

## 개발

```bash
npm test        # vitest
npm run lint    # eslint
npx tsc --noEmit
```

주요 위치: `src/lib/ai`(오케스트레이터·백엔드), `src/lib/scan`(허용 목록·nmap·별칭), `src/lib/reports`(저장·HTML 내려받기), `src/components`(화면). 개발 계획은 `docs/DEVELOPMENT_PLAN.md`를 보세요.
