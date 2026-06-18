---
title: "Spring 프로젝트 DataSource 없이 실행"
description: "현재 버전 : Spring Boot 2.1.7.RELEASE 현재 Spring-Data-JPA Dependency 받은 상황. 여러가지로 설정할 수 있지만. 저는 Application.java(메인클레스) 에서 Annotation으로 설정하는 방법으로 진행하겠습니다."
pubDate: "2023-02-06T15:09:58+09:00"
category: "Spring"
---
-   현재 버전 : Spring Boot 2.1.7.RELEASE
-   현재 Spring-Data-JPA Dependency 받은 상황.
-   여러가지로 설정할 수 있지만. 저는 Application.java(메인클레스) 에서 Annotation으로 설정하는 방법으로 진행하겠습니다.

```java
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class, SecurityAutoConfiguration.class})
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(FarmApplication.class, args);
    }

}
```
