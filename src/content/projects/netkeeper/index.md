---
title: "NetKeeper"
summary: "인터넷이 끊기면 다음 Wi-Fi 나 iPhone 핫스팟으로 자동 전환하는 macOS 메뉴바 앱. 연결 여부가 아니라 실제 인터넷이 되는지를 확인한다."
role: "1인 개발"
pubDate: "2026-11-24T00:00:00+09:00"
techStack: ["Swift", "SwiftUI", "CoreWLAN", "Accessibility API", "Keychain"]
projectType: "personal"
status: "wip"
featured: true
order: 2
teamSize: "1인"
repoUrl: "https://github.com/zzaisang/netkeeper"
heroImage: "./img-1.png"
---

## 왜 만들었나

Wi-Fi 에는 붙어 있는데 인터넷이 안 되는 경우가 있다. macOS 는 이때 다른 네트워크로 넘어가 주지 않는다. 결국 손으로 Wi-Fi 메뉴를 열고 iPhone 핫스팟을 눌러야 한다. **NetKeeper 는 이 전환을 대신 해 주는 메뉴바 앱**이다.

## 내가 한 일

혼자 설계·구현했고, Mac App Store 제출까지 준비했다. 소스는 MIT 라이선스로 공개했다.

## 주요 기능

- **우선순위 자동 전환**: Wi-Fi 와 iPhone 핫스팟을 하나의 우선순위 목록으로 관리한다. 인터넷이 끊기면 다음 순위로 넘어가고, 상위 네트워크가 다시 잡히면 돌아간다.
- **실제 인터넷 확인**: 몇 초마다 `captive.apple.com` 에 요청해 실제로 인터넷이 되는지 본다.
- **iPhone 핫스팟 깨우기**: 대기 중인 iPhone 도 macOS Wi-Fi 메뉴처럼 깨워서 연결한다.
- **최근 60분 기록**: Wi-Fi·셀룰러·끊김 구간과 전환 횟수를 보여준다.
- 한국어·영어 지원.

## 기술 선택과 이유

- **전환 판단은 순수 함수로 분리했다.** 현재 연결, 인터넷 상태, 보이는 네트워크, 우선순위, 잠시 제외된 네트워크를 받아 "그대로 / 이 네트워크로 연결" 만 돌려준다. 그래서 단위 테스트로 검증할 수 있다.
- **불통 네트워크는 잠시 후보에서 뺀다.** 연속 실패가 기준을 넘으면 일정 시간 제외해, 같은 네트워크를 계속 오가지 않게 했다.
- **Instant Hotspot 은 접근성 API 로 눌렀다.** 공개 API 가 없어서 Control Center 의 Wi-Fi 메뉴 항목을 접근성으로 찾는다. macOS 가 바뀌면 깨질 수 있는 부분이라 한 파일에 모아 두었다.
- **배포판별 기능 플래그.** App Store 판은 샌드박스 때문에 접근성 조작과 시스템 키체인 읽기가 막힌다. 빌드 플래그 하나로 두 기능을 끄고, 나머지 코드는 같게 유지했다.
- **암호는 키체인에만 저장한다.** 데이터 수집은 없다.

## 배운 점과 다음 계획

OS 가 공개하지 않은 동작을 다룰 때는 **실패하는 조건을 먼저 정리**해야 했다. 예를 들어 화면이 잠겨 있으면 macOS 가 Instant Hotspot 을 막는다. 이때는 바로 일반 Wi-Fi 연결로 넘어가도록 고쳤다.

Mac App Store 심사 제출은 계정 정리 때문에 잠시 보류한 상태다. 지금은 소스에서 빌드해 쓸 수 있다.
