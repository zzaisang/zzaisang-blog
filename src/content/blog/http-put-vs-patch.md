---
title: "HTTP PUT과 PATCH의 차이"
description: "자원 전체를 교체하는 PUT 과 일부 필드만 수정하는 PATCH 의 차이를, 일부 필드만 보낼 때의 null 처리 동작과 예시 데이터로 비교해 설명합니다."
pubDate: "2026-06-18T09:08:00+09:00"
category: "CS"
tags: ["http", "rest", "put", "patch", "api"]
---

# HTTP Method 중 PUT 과 PATCH 의 차이

- PUT : 자원의 전체 교체, 자원내 모든 필드영역 필요 (만약 일부만 전달 할 경우, 그 외의 필드 모두 null or 초기값 처리)

- PATCH : 자원의 부분 교체, 자원 내 일부 필드영역 필요


```json
{ //기존 데이터
  "name" : "김철수", // 이름
  "age": 18 // 나이
}
```

![](./http-put-vs-patch/img-1.jpg)


참조 사이트 : https://papababo.tistory.com/269
