---
title: "AI 에이전트에 GitHub 토큰을 안전하게 물리기: macOS 키체인 + 환경변수 주입"
description: "평문 설정 파일에 PAT를 두지 않고, macOS 키체인에 저장한 fine-grained 토큰을 환경변수로 주입해 Claude Code의 MCP 인증에 쓰는 패턴을 정리합니다."
pubDate: "2026-07-15T09:44:21+09:00"
category: "ETC"
tags: ["macos", "keychain", "github", "mcp", "security"]
---

AI 코딩 에이전트(예: Claude Code)가 GitHub에 접근하려면 결국 어떤 형태로든 토큰이 필요하다. 문제는 많은 도구가 이 토큰을 **설정 파일에 평문으로** 저장한다는 것이다. `~/.config/gh/hosts.yml`이나 MCP 설정 파일(`.mcp.json`) 안에 `ghp_...`가 그대로 박혀 있는 식이다. 평소엔 편하지만, 정보 탈취형 악성코드(인포스틸러) 관점에서는 가장 먼저 긁어가는 표적이 된다. 이 글은 토큰을 **평문 파일에 두지 않고 macOS 키체인에 보관한 뒤, 셸 환경변수로만 주입**해서 에이전트 인증에 쓰는 패턴을 정리한다.

## 왜 평문 토큰 저장이 위험한가

GitHub PAT는 **bearer 토큰**이다. 그 문자열을 가진 쪽이 곧 나로 인증되며, 비밀번호나 2FA를 다시 묻지 않는다. 즉 토큰 하나가 유출되면 2FA를 켜놨어도 소용이 없다.

게다가 인포스틸러는 자격증명이 있을 법한 **알려진 경로(known paths)**를 콕 집어 훑는다. 대표적으로:

- `~/.config/gh/hosts.yml` — `gh` CLI 토큰
- `~/.git-credentials` — git HTTPS 자격증명
- 각종 도구의 설정 파일(`.mcp.json` 등)에 하드코딩된 `Authorization` 헤더
- `~/.aws/credentials`, `.npmrc`, `.netrc` …

여기에 토큰이 평문으로 있으면, PC가 한 번 감염되는 순간 그대로 넘어간다. 특히 classic PAT은 스코프가 넓고 만료가 없는 경우가 많아 피해 반경이 크다. 그래서 원칙은 두 가지다. **(1) 토큰을 평문 파일에 두지 않는다. (2) 두더라도 스코프를 좁히고 만료를 짧게 한다.**

## GitHub 원격 MCP는 왜 OAuth가 아니라 PAT인가

"그냥 OAuth로 붙이면 토큰을 안 둬도 되지 않나?"가 자연스러운 질문이다. 결론부터 말하면, **GitHub 원격 MCP 서버를 일부 에이전트에서 OAuth로 붙이는 건 현재 막혀 있다.**

- GitHub의 OAuth 서버는 **동적 클라이언트 등록(DCR, RFC 7591)을 지원하지 않는다.**
- 에이전트(호스트)의 자동 OAuth는 대개 DCR에 의존하므로, DCR이 없으면 `does not support dynamic client registration` 류의 에러로 실패한다.
- GitHub 원격 MCP의 OAuth는 **GitHub가 인정한 호스트(예: VS Code 계열)에 한해** 동작하고, 그 외 다수 호스트는 **PAT를 헤더로** 넣는 것이 공식 안내다.

그래서 이런 호스트에서는 "OAuth를 쓰자"가 아니라 **"PAT를 쓰되 평문으로 두지 말자"**가 현실적인 목표가 된다. 그 목표를 키체인 + 환경변수로 달성한다.

## 패턴: 키체인 저장 → 환경변수 주입 → 설정엔 자리표시자만

### 1) fine-grained PAT 발급 (최소 권한·짧은 만료)

classic PAT 대신 **fine-grained PAT**을 쓴다. 접근 레포와 권한을 콕 집어 제한할 수 있어 유출 시 피해가 작다.

- Expiration: 30일 이하(짧을수록 좋다 — 만료가 곧 자동 로테이션)
- Repository access: 실제로 쓸 레포만 (`<org>/<repo>`)
- Permissions: 최소만 — 예를 들어 Contents(R/W), Pull requests(R/W), Metadata(R). 필요 없는 권한은 끈다.

> 조직 레포에 대해서는 fine-grained PAT을 조직이 **허용/승인**해야 닿는 경우가 있다. 막히면 조직 관리자에게 승인을 요청한다.

### 2) 토큰을 macOS 키체인에 저장

발급한 토큰을 파일이 아니라 키체인에 넣는다. `-w`를 값 없이 주면 화면에 안 남기고 **숨김 입력 프롬프트**로 받는다.

```bash
security add-generic-password -U -a "$USER" -s github_mcp_pat -w
# 프롬프트가 뜨면 발급한 PAT을 붙여넣는다 (값이 셸 히스토리에 남지 않는다)
```

- `-s github_mcp_pat` : 서비스 이름(원하는 식별자)
- `-a "$USER"` : 계정
- `-U` : 이미 있으면 갱신(로테이션 시 그대로 재사용)

### 3) 셸 시작 시 키체인에서 환경변수로 주입

`~/.zshrc`(bash면 `~/.bashrc`)에 한 줄을 추가해, 셸이 뜰 때 키체인에서 값을 읽어 환경변수로 노출한다. 토큰은 **디스크 설정 파일이 아니라 키체인에만** 있고, 필요한 셸의 메모리에만 잠깐 올라온다.

```bash
echo 'export GITHUB_MCP_PAT="$(security find-generic-password -a "$USER" -s github_mcp_pat -w 2>/dev/null)"' >> ~/.zshrc
```

### 4) MCP 설정에는 토큰이 아니라 `${VAR}` 자리표시자만

이제 에이전트의 MCP 설정 헤더에 **실제 토큰 대신 환경변수 참조**를 넣는다. Claude Code 기준 `.mcp.json`은 `url`·`headers`·`env` 값에서 `${VAR}` 확장을 지원한다.

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_MCP_PAT}"
      }
    }
  }
}
```

CLI로 등록한다면, 셸이 값을 미리 확장하지 않도록 **작은따옴표**로 감싸 리터럴 `${GITHUB_MCP_PAT}`가 설정에 저장되게 한다.

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header 'Authorization: Bearer ${GITHUB_MCP_PAT}'
```

이러면 설정 파일에는 다음처럼 **자리표시자만** 남는다. 파일이 유출돼도 토큰 값 자체는 없다.

```text
Authorization = Bearer ${GITHUB_MCP_PAT}
```

## 동작 원리 한 줄 요약

호스트(에이전트)가 MCP 설정을 로드할 때 `${GITHUB_MCP_PAT}`를 **프로세스 환경변수**에서 확장한다. 그 환경변수는 셸이 뜰 때 키체인에서 읽어온 값이다. 정리하면 **키체인(암호화 저장) → 셸 환경변수(휘발성) → MCP 헤더(런타임 확장)** 흐름이고, **디스크의 설정 파일에는 토큰이 존재하지 않는다.**

## 주의점

- **GUI로 앱을 실행하면 `.zshrc`의 env가 안 실린다.** macOS에서 앱 아이콘으로 띄운 프로세스는 로그인 셸의 환경을 상속하지 않는다. 반드시 환경변수가 있는 **터미널에서 에이전트를 실행**해야 헤더 확장이 된다.
- **필수 변수가 비어 있으면 파싱이 실패할 수 있다.** 값이 없을 때 조용히 빈 토큰으로 붙지 않게, 확장이 안 되면 연결 자체가 실패하도록 두는 편이 안전하다(빈 Bearer로 401을 맞느니 명확히 실패하는 게 낫다).
- **로테이션.** 토큰이 만료되면 `security add-generic-password -U ...`로 키체인 값만 갱신하면 된다. 설정 파일은 손댈 필요가 없다.
- **키체인도 만능은 아니다.** 잠금 해제된 상태에서 PC가 감염되면 키체인 항목도 탈취될 수 있다. 다만 인포스틸러가 **정적으로 훑는 평문 파일 경로**에서는 벗어나므로, 최소한 "손쉬운 한탕"의 표적에서는 빠진다. 근본 방어는 감염 예방과 최소권한·짧은 만료다.
- **더 강한 대안.** 환경변수조차 남기고 싶지 않다면, 연결 시점에 헤더를 생성하는 헬퍼(예: 호스트가 지원하는 `headersHelper`류)로 키체인에서 직접 읽게 할 수 있다. 토큰이 env에도 뜨지 않는다.

## 마치며

핵심은 단순하다. **"토큰을 안 쓸 수 없다면, 최소한 평문 파일에는 두지 말자."** fine-grained PAT으로 권한과 수명을 좁히고, 값은 키체인에 넣고, 설정에는 `${VAR}` 자리표시자만 남긴다. OAuth가 막힌 환경에서도 이 패턴이면 인포스틸러가 노리는 정적 경로에서 토큰을 빼낼 수 있다. 도구가 바뀌어도 원칙은 그대로다 — 비밀은 코드·설정이 아니라 보안 저장소에 둔다.
