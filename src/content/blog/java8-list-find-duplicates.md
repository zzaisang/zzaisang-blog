---
title: "Java8 List 중복값만 골라내기"
description: "List의 값들을 key/value 쌍인 Map으로 변환한다. Map 에서 value가 1개 이상인 Key값들을 Set에다가 저장. 결과"
pubDate: "2020-08-09T11:00:39+09:00"
category: "Java/Kotlin"
tags: ["Java", "java8"]
---
---

-   List의 값들을 key/value 쌍인 Map으로 변환한다.
-   Map 에서 value가 1개 이상인 Key값들을 Set에다가 저장.

```java
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * @author zzai_sang
 * @version 0.1.0
 * @since 2020/07/14
 */
public class DuplicateElement {

    public static void main(String[] args) {

        final List<String> nameList = Arrays.asList("김상재", "김상재", "김상재", "짜이상", "상짜이", "짜이상");

        final Set<String> dupRemoveSet = nameList
                .stream()
                .collect(
                        Collectors.groupingBy(Function.identity(), Collectors.counting())
                ).entrySet().stream()
                .filter(v -> v.getValue() > 1)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        System.out.println(nameList);
        System.out.println(dupRemoveSet);

    }
}
```

-   결과

```java
[김상재, 김상재, 김상재, 짜이상, 상짜이, 짜이상]
[짜이상, 김상재]
```
