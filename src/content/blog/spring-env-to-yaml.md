---
title: "spring .env 에서 yaml 에 주입받기"
description: "spring 을 사용하면서 주로 application.yaml 파일에 DB 정보나 JWT ScretKey 또는 AWS 계정 관련 정보들을 기입하시는분들이 계십니다. 이런 경우에 소스가 탈취 될 경우 아주 곤란한 상황이 야기될 수 있습니다. 그래서 소스를 빌드 후 배포당시에…"
pubDate: "2023-09-14T10:31:23+09:00"
category: "Spring"
tags: [".env", "application.yaml", "K8S", "Kubernetes", "Property", "Spring"]
---
spring 을 사용하면서 주로 application.yaml 파일에 DB 정보나 JWT ScretKey 또는 AWS 계정 관련 정보들을 기입하시는분들이 계십니다. 

이런 경우에 소스가 탈취 될 경우 아주 곤란한 상황이 야기될 수 있습니다.

그래서 소스를 빌드 후 배포당시에 .env 파일을 주입받아서 사용할 수 있는 방식을 많이 사용합니다. 

작업 완료 후 아래처럼 변경해서 사용할 수 있습니다.

**before**

```yaml
spring:
  config:
    activate:
      on-profile: local
  datasource:
    driver-class-name: org.postgresql.Driver
    url: jdbc:postgresql://127.0.0.1:5432/mydb
    username: root
    password: password
```

**After**

```yaml
spring:
  config:
    activate:
      on-profile: local
  datasource:
    driver-class-name: org.postgresql.Driver
    url: ${POSTGRESQL_URL}
    username: ${POSTGRESQL_ID}
    password: ${POSTGRESQL_PASSWORD}
```

---

### Dependency 설정

-   [https://github.com/paulschwarz/spring-dotenv](https://github.com/paulschwarz/spring-dotenv "공식 GitHub") 
-   [https://mvnrepository.com/artifact/me.paulschwarz/spring-dotenv](https://mvnrepository.com/artifact/me.paulschwarz/spring-dotenv "MavenRepository") 

```kotlin
implementation("me.paulschwarz:spring-dotenv:3.0.0")
```

(build.gradle.kts 내 dependency 추가)

### GitIgonre 파일에서 추적 해제

.gitIgnore 파일에 \`.env\`파일을 추가해서 git 에서 추적하지 못하도록 합니다.

(로컬환경에서 개발할때를 위한 파일입니다.)

### .env 파일 추가

저는 하위 처럼 사용하고 있습니다. 변수안에 변수를 추가할 수 있습니다.

```bash
POSTGRESQL_DATABASE=mydb
POSTGRESQL_ID=root
POSTGRESQL_PASSWORD=password
POSTGRESQL_URL=jdbc:postgresql://127.0.0.1:5432/${POSTGRESQL_DATABASE}
```

### application.yaml 에 기존 변수 대체

아래 모습처럼 대체 할 수 있습니다.

```yaml
spring:
  config:
    activate:
      on-profile: local
  datasource:
    driver-class-name: org.postgresql.Driver
    url: ${POSTGRESQL_URL}
    username: ${POSTGRESQL_ID}
    password: ${POSTGRESQL_PASSWORD}
```
