---
title: "Claude Gauge"
summary: "Claude 구독 한도(5시간·7일)와 Claude Code·Anthropic API 사용량을 키보드만으로 확인하는 Raycast 확장."
role: "1인 개발"
pubDate: "2026-06-30T00:00:00+09:00"
techStack: ["TypeScript", "React", "Raycast API", "ccusage", "Anthropic Admin API"]
projectType: "personal"
status: "wip"
featured: false
order: 4
teamSize: "1인"
repoUrl: "https://github.com/zzaisang/claude-gauge"
heroImage: "./img-1.png"
---

## 왜 만들었나

Claude Code 를 오래 쓰면 남은 한도가 늘 궁금하다. 5시간 한도와 주간 한도가 언제 리셋되는지, 이번 달에 얼마를 썼는지를 한눈에 보고 싶었다. **Claude Gauge 는 이 숫자를 Raycast 단축키 하나로 모아 보여주는 확장**이다.

## 내가 한 일

혼자 설계·구현했다. 두 개의 Raycast 명령, 상태줄 설치기, Admin API 클라이언트를 만들고 MIT 라이선스로 공개했다.

## 주요 기능

- **Claude Session**: 구독 사용량. 5시간·7일 한도와 리셋까지 남은 시간, 활성 블록의 소모 속도, 이번 주 토큰을 보여준다.
- **Claude API Usage**: 키에 따라 화면이 달라진다.
  - 키가 없으면 로컬 Claude Code 비용 추정치.
  - 표준 키면 레이트리밋 여유를 확인한다.
  - Admin 키면 조직의 실제 청구 사용량과 비용.
- 월 예산 게이지, 원화 환산, 모든 화면 ⌘R 새로고침.

## 기술 선택과 이유

- **한도는 Claude Code 상태줄이 남긴 캐시에서 읽는다.** 상태줄이 받는 한도 정보를 작은 JSON 파일로 남기게 하고, 확장은 그 파일만 읽는다. 그래서 세션 화면은 네트워크 요청이 없다.
- **상태줄 설치는 기존 설정을 깨지 않게 했다.** 사용자의 상태줄 스크립트를 `.bak` 으로 백업한 뒤, 표시된 블록만 덧붙인다. 제거 액션은 그 블록만 지운다.
- **캐시 필드는 방어적으로 파싱한다.** 필드 이름이 보장되지 않아 여러 표기를 받아들이고, 원본은 디버그용으로 남긴다.
- **비용 추정은 `ccusage` 에 맡겼다.** 로컬 로그 집계를 직접 만들지 않고 검증된 CLI 를 호출한다. 실제 청구액이 아니라 추정치라고 화면에 밝힌다.
- **API 키는 macOS 키체인에 저장한다.**

## 배운 점과 다음 계획

데이터 출처가 여러 개면 **하나가 늦어도 나머지는 먼저 그리는 것**이 체감에 크다. 세션 화면의 출처를 따로 불러오도록 바꿔 게이지가 바로 뜨게 했다.

Raycast 스토어 등록은 아직 되지 않았다. 지금은 소스에서 `npm run dev` 로 실행한다.
