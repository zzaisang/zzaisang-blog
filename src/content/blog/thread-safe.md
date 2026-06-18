---
title: "Thread-safe 와 재진입성(Reentrant)"
description: "멀티스레드 환경에서 Thread-safe 의 의미와 임계영역 동기화로 구현하는 방법, 재진입성(Reentrant)과 Thread-safe 의 관계를 정리합니다."
pubDate: "2026-06-18T09:12:00+09:00"
category: "CS"
tags: ["thread-safe", "reentrant", "synchronization", "critical-section", "concurrency"]
---

# Thread-safe

- Thread-safe란?
  - 직역하면 스레드 안전.
  - 멀티스레드 환경에서 여러 스레드가 동시에 하나의 객체 및 변수(공유 자원)에 접근할 때, 의도한 대로 동작하는 것을 말한다.
  - 이러한 상황을 "Thread safe하다" 라고 표현한다.
- Thread-safe하게 구현하기
  - Thread-safe하기 위해서는 공유 자원에 접근하는 임계영역(critical section)을 동기화 기법으로 제어해줘야 한다.
    - 이를 '상호배제'라고 한다.
  - 동기화 기법으로는 Mutex나 Semaphore등이 있다.
- Reentrant 
  - Reentrant는 재진입성이라는 의미로, 어떤 함수가 Reentrant하다는 것은 여러 스레드가 동시에 접근해도 언제나 같은 실행 결과를 보장한다는 의미이다.
  - 이를 만족하기 위해서 해당 서브루틴에서는 공유자원을 사용하지 않으면 된다.
    - 예를들어 정적(전역)변수를 사용하거나 반환하면 안되고 호출 시 제공된 매개변수만으로 동작해야한다.
  - 따라서, Reentrant하다면 Thread-safe 하지만 그 역은 성립하지 않는다.

---
출처 : https://github.com/WeareSoft/tech-interview/blob/master/contents/os.md#%EB%A9%80%ED%8B%B0-%ED%94%84%EB%A1%9C%EC%84%B8%EC%8A%A4-%EB%8C%80%EC%8B%A0-%EB%A9%80%ED%8B%B0-%EC%8A%A4%EB%A0%88%EB%93%9C%EB%A5%BC-%EC%82%AC%EC%9A%A9%ED%95%98%EB%8A%94-%EC%9D%B4%EC%9C%A0
