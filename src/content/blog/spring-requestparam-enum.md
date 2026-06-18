---
title: "스프링 @RequestParam 에서 Enum 으로 받기"
description: "스프링 RestController 구현 시 @RequestParam 에서 파라미터를 받을 때, Enum 클래스로 받고 싶을 경우가 있다. 1. enum 구현 (boolean 과 비슷한 enum 클래스) enum클래스는 기본 Ordinal로 순번이 매겨진다. 고로 0 : NO &…"
pubDate: "2021-02-16T02:07:20+09:00"
category: "Spring"
tags: ["Java", "RequestParam", "Spring", "SpringFramework"]
---
스프링 RestController 구현 시 @RequestParam 에서 파라미터를 받을 때, Enum 클래스로 받고 싶을 경우가 있다.

1\. enum 구현 (boolean 과 비슷한 enum 클래스)

-   enum클래스는 기본 Ordinal로 순번이 매겨진다.
-   고로 0 : NO & 1 : YES 로 구성되어있다.
-   컨트롤러에서는 NO/YES or 0/1 로 받더라도 YesNo Enum클래스로 변환해서 받고 싶은 경우, 아래 create 메서드에서 정규식 체크를 해서 정수가 들어올 때는 정수를 변환, 반대 경우에는 String을 대문자로 바꾼 후 변환한다.

```java
@Getter
public enum YesNo {

    NO("아니오"),
    YES("예");

    private final String name;

    YesNo(String name) {
        this.name = name;
    }

    public boolean isYes() {
        return YES == this;
    }

    public boolean isNo() {
        return NO == this;
    }

    @JsonCreator
    public static YesNo create(String value) {
        boolean matches = value.matches("-?\\d+");
        if (matches) {
            return Integer.parseInt(value) == 1 ? YES : NO;
        } else {
            return valueOf(value.toUpperCase());
        }
    }
}
```

2\. Converter 구현

```java
public class YesNoConverter implements Converter<String, YesNo> {

    @Override
    public YesNo convert(String source) {
        return YesNo.create(source);
    }
}
```

3\. WebMvcConfigurer 을 implements 받는 WebConfig라는 클래스 생성 후, 기존에 만든 YesNoConverter를 추가한다.

```java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new YesNoConverter());
    }
}
```

4\. 테스트용 Controller 구현

```java
@RestController
@RequestMapping("/test")
public class TestController {

    @GetMapping
    public ResponseEntity test(@RequestParam(name = "yn", required = false, defaultValue = "NO")YesNo yesNo) {
        System.out.println("result : "yesNo);

        return ResponseEntity.ok().build();
    }
}
```

5\. 테스트

```groovy
GET http://localhost:8080/test?yn=1
Accept: application/json
result : YES

GET http://localhost:8080/test?yn=NO
Accept: application/json
result : NO
```
