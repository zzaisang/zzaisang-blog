---
title: "String vs StringBuilder vs StringBuffer"
description: "String 의 불변성과 StringBuilder·StringBuffer 의 가변성, Thread-safe 여부 및 동기화 유무에 따른 성능 차이를 비교해 정리합니다."
pubDate: "2026-06-18T09:14:00+09:00"
category: "Java/Kotlin"
tags: ["java", "string", "stringbuilder", "stringbuffer", "immutable", "thread-safe"]
---

# String

- String 은 immutable하다.
- String으로 문자열을 조합하면 새로운 객체를 계속 생성하게 되어 메모리 낭비다.
- 불변객체(immutable)이기 때문에 문자열 연산이 많은 프로그래밍을 할때 인스턴스를 계속 생성하므로 성능이 떨어지지만 조회가 많은 환경, MultiThread환경에서 성능적으로 유리하다.

# StringBuilder
- StringBuilder는 mutable하다.
- Thread Safe하지 않다.
- jdk1.5부터는 String 에서 연산해도 StringBuilder로 컴파일 하게 만들어놨다.

# StringBuffer
- mutable하다.
- ThreadSafe하다.
- MultiThread 환경에서 synchronized 키워드가 가능하여 동기화가 가능하다.

# StringBuffer & StringBuilder 공통,차이점
## 공통점 
- 문자열 연산이 자주 발생할 때 변경가능한 객체이기 때문에 성능적으로 유리하다.

## 차이점
- 동기화 지원의 유무, 동기화를 고려하지 않는 환경에서는 StringBuilder가 성능이 더 좋다.
