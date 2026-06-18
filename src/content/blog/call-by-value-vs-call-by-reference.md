---
title: "call by value vs call by reference"
description: "프로그래밍 언어들의 메소드 매개변수 호출 방식에는 여러 가지가 있으며 호출 방식은 언어마다 다르게 되어 있습니다. 대표적으로 C++ 은 call by refernce를 사용합니다. (매개변수를 넘겨주는 행위이기 때문에 pass by value, pass by…"
pubDate: "2022-04-17T23:57:28+09:00"
category: "CS"
---
프로그래밍 언어들의 메소드 매개변수 호출 방식에는 여러 가지가 있으며 호출 방식은 언어마다 다르게 되어 있습니다.

대표적으로 C++ 은 call by refernce를 사용합니다.

(매개변수를 넘겨주는 행위이기 때문에 pass by value, pass by reference라고도 합니다)

**call by value : 함수의 인자를 전달할 때 '값을 전달하는 방식'**

**call by reference : '주소를 전달하는 방식'**

**Java 는 call by value 방식!**

더보기

Call by Value, Call by Reference 방식은 굉장히 헷갈리는 부분입니다.  
하지만 자바가 탄생하던 시기의 C, C++와 비교하여 어째서 Call by Value 방식을  
채택하였는지 감히 예상해 보자면 두 언어에 공통으로 존재하는 **개발자의 주소 제어 권한을  
제약**하고, JVM을 사용하기 때문에 좀 더 Safety한 작동 방식이 필요했기 때문에 이런  
Call by Value 방식을 사용하지 않았나 감히 추측해 봅니다 !

---

출처

-   [https://velog.io/@ahnick/Java-Call-by-Value-Call-by-Reference](https://velog.io/@ahnick/Java-Call-by-Value-Call-by-Reference)
