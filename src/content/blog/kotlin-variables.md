---
title: "Kotlin 변수 선언 (var vs val)"
description: "Kotlin 에서 var(가변)와 val(불변) 변수를 선언하는 방법, 타입 추론, 조건에 따른 지연 초기화 동작을 예제로 정리합니다."
pubDate: "2026-06-18T09:15:00+09:00"
category: "Java/Kotlin"
tags: ["kotlin", "var", "val", "variable", "immutable"]
---

# 코틀린에서 변수 선언 방법
```kotlin
var a: String = "initial"  // 1
val b: Int = 1             // 2
val c = 3                  // 3
```

1. 가변 변수를 선언하고 초기화합니다.
2. 불변 변수를 선언하고 초기화합니다.
3. 불변 변수를 선언하고 유형을 지정하지 않고 초기화합니다. 컴파일러는 유형을 유추합니다 Int.

- var : 가변 변수(mutable) - 변수초기화가 필요
- val : 불변 변수(Immutable)

```kotlin
var e: Int  // 1
println(e)  // 2
```

1. 초기화하지 않고 변수를 선언합니다.
2. 변수를 사용하려고 하면 컴파일러 오류가 발생합니다. ```Variable 'e' must be initialized.```

```kotlin
fun someCondition() = true

fun main() {
    val d: Int  // 1

    if (someCondition()) {
        d = 1   // 2
    } else {
        d = 2   // 2
    }

    println(d) // 3
}

//print : 1
```

1. 초기화하지 않고 변수를 선언합니다.
2. 일부 조건에 따라 다른 값으로 변수를 초기화합니다.
3. 변수는 이미 초기화되었기 때문에 읽을 수 있습니다.
