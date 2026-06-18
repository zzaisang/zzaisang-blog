---
title: "Kotlin Sequential UUID 생성"
description: "RDB 환경에서 개발을 하다보면 무의식 적으로 PK 를 Sequence 값으로 지정할 때가 있습니다.이번에 개발하면서 외부에 노출이 필요한 정보가 필요했습니다.그런데 Sequence 정보를 사용하게되면 보안에 취약하고 다른 회원의 정보가 탈취당하기 쉽다. 저희의 요구사항은…"
pubDate: "2023-12-05T11:42:27+09:00"
updatedDate: "2023-12-06T20:34:13+09:00"
category: "Java/Kotlin"
---
RDB 환경에서 개발을 하다보면 무의식 적으로 PK 를 Sequence 값으로 지정할 때가 있습니다.  
이번에 개발하면서 외부에 노출이 필요한 `Unique` 정보가 필요했습니다.  
그런데 Sequence 정보를 사용하게되면 보안에 취약하고 다른 회원의 정보가 탈취당하기 쉽다.

저희의 요구사항은 이랬습니다.

1.  Sequential 한 값이어야 한다.(PK 기본 clursted Index 이기 때문)
2.  값이 서로 비교가 되어야 한다. (1번의 확장)
3.  육안으로 값을 유추할 수 없어야 한다.

위 요구사항을 생각 했을때, UUID 와 MongoDB 의 ObjectId 가 후보로 올라왔습니다.  
그런데 여러가지의 DB 를 사용하는건 상관없지만 ObjectId 때문에 MongoDB 의 의존성을 주입 받는게 추후 관리적으로 힘들어 보여서 Sequential 한 UUID 를 만들기로 결정했습니다.  
  

---

  
우선 Sequential 한 UUID 를 만들려면 UUID v1 인 TimeBasedUUID 를 만들어야 합니다. UUID v1 을 만들기 위해서는 어쩔수 없이 라이브러리를 추가 했습니다. (왜 v4 만 지원하나요...)

UUID 는 총 36 길이의 문자열입니다.  
하이픈(`-`) 으로 구분 하면 5개의 배열로 나옵니다.

10 개의 uuid v1 을 생성

```kotlin
val uuidList = (1..10).map {    
    Generators.timeBasedGenerator().generate().apply {    
        println("$this")    
    }    
}.toList()  
\*  
bfcdd24d-9314-11ee-856f-030ee4c158c2  
bfcdd24e-9314-11ee-856f-879fcc8b4cb9  
bfcdd24f-9314-11ee-856f-7d3e568b9e5f  
bfcdd250-9314-11ee-856f-b1b2e482a70b  
bfcdf961-9314-11ee-856f-fd11c9b83c88  
bfcdf962-9314-11ee-856f-759455109f25  
bfcdf963-9314-11ee-856f-1b7fadb69cc7  
bfcdf964-9314-11ee-856f-f9ab80a85994  
bfcdf965-9314-11ee-856f-252a436ed822  
bfcdf966-9314-11ee-856f-2b612f0361fc  
*/
```

UUID 는 Timestamp(타임스탬프) / Clock Sequence(클락시퀀스) / Node Identifier (노드 식별자) 로 구성되며  
1 ~ 3 은 Timestamp 4 는 Clock Sequence 5는 Node Identifier 로 구성되어 있습니다.  
(1 은 100 나노초 단위로 측정된 현재 시간을 16진수로 변환한 값)  
따라서 `3 - 2 - 1 - 4 - 5` 순서로 배열하면 순차적인 값을 가질 수 있습니다.  
하이픈 (`-`) 은 딱히 사용하지 않아도 되서 제거합니다.  
  
  
추가적인 테스트 코드는 [GitHubLink](https://github.com/zzaisang/kotline-playground/blob/main/src/test/kotlin/com/example/kotlinplayground/UUIDTest.kt) 에 기입되어 있습니다!  
  

---

출처

-   [https://chanos.tistory.com/entry/MySQL-UUID를-효율적으로-활용하기-위한-노력과-한계](https://chanos.tistory.com/entry/MySQL-UUID%EB%A5%BC-%ED%9A%A8%EC%9C%A8%EC%A0%81%EC%9C%BC%EB%A1%9C-%ED%99%9C%EC%9A%A9%ED%95%98%EA%B8%B0-%EC%9C%84%ED%95%9C-%EB%85%B8%EB%A0%A5%EA%B3%BC-%ED%95%9C%EA%B3%84)
-   [https://www.2ndquadrant.com/en/blog/sequential-uuid-generators/](https://www.2ndquadrant.com/en/blog/sequential-uuid-generators/)
-   [https://www.percona.com/blog/store-uuid-optimized-way/#crayon-60fa2fbab27f7557869434](https://www.percona.com/blog/store-uuid-optimized-way/#crayon-60fa2fbab27f7557869434)
