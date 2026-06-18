---
title: "Java8 객체 List 에서 중복값 제거"
description: "Java에서 List 를 사용할때 중복된 값들을 제거하는 방법입니다. 비교할 대상(Hello의 name)을 지정해서 비교 후 중복 제거된 List 사용하면 된다. 결과값 모든 코드는 아래 경로에서 확인 가능합니다.…"
pubDate: "2020-07-31T17:21:09+09:00"
category: "Java/Kotlin"
---
Java에서 List 를 사용할때 중복된 값들을 제거하는 방법입니다.

```java
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.ToString;

import java.util.Arrays;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * @author zzai_sang
 * @version 0.1.0
 * @since 2020/07/15
 */
public class ObjectDupRemove {

    public static void main(String[] args) {

        final List<Hello> helloList = Arrays.asList(
                new Hello("김상재", "zzaisang@gmail.com"),
                new Hello("짜이상", "zzaisang@gmail.com"),
                new Hello("상자이", "zzaisang@gmail.com"),
                new Hello("상짜이", "zzaisang@gmail.com"),
                new Hello("짜이상", "zzaisang@gmail.com")
        );

        final List<Hello> collect = helloList
                .stream()
                .collect(Collectors.toConcurrentMap(Hello::getName, Function.identity(), (p, g) -> p)).values()
                .stream()
                .collect(Collectors.toList());

        System.out.println(helloList);
        System.out.println(collect);
    }
}

@ToString
@AllArgsConstructor
@Getter
class Hello{
    String name;
    String email;
}
```

-   비교할 대상(Hello의 name)을 지정해서 비교 후 중복 제거된 List 사용하면 된다.
    
-   결과값
    
    ```
    [Hello(name=김상재, email=zzaisang@gmail.com), Hello(name=짜이상, email=zzaisang@gmail.com), Hello(name=상자이, email=zzaisang@gmail.com), Hello(name=상짜이, email=zzaisang@gmail.com), Hello(name=짜이상, email=zzaisang@gmail.com)]
    [Hello(name=상짜이, email=zzaisang@gmail.com), Hello(name=짜이상, email=zzaisang@gmail.com), Hello(name=상자이, email=zzaisang@gmail.com), Hello(name=김상재, email=zzaisang@gmail.com)]
    ```
    

모든 코드는 아래 경로에서 확인 가능합니다.

\[[https://github.com/zzaisang/algorithm/blob/master/src/main/java/other/study/ObjectDupRemove.java\]](https://github.com/zzaisang/algorithm/blob/master/src/main/java/other/study/ObjectDupRemove.java%5D)  
(GIT 주소)
