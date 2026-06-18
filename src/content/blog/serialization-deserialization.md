---
title: "직렬화(Serialization)와 역직렬화(Deserialization)"
description: "클래스를 만들 때, 해당 특정 클래스에서 사용될 객체를 만들 수 있으며 프로그램을 실행 / 종료하면 가비지 수집기 스레드를 통해 객체가 자체적으로 수거됩니다. 객체를 다시만들지 않고 해당 클래스를 호출하려는 경우 어떻게 될까요?? 이럴때 데이터를 바이트 스트림으로 변환하여 직렬화…"
pubDate: "2022-04-18T00:05:26+09:00"
category: "Java/Kotlin"
tags: ["deserialization", "Java", "serialization"]
---
클래스를 만들 때, 해당 특정 클래스에서 사용될 객체를 만들 수 있으며 프로그램을 실행 / 종료하면 가비지 수집기 스레드를 통해 객체가 자체적으로 수거됩니다. 객체를 다시만들지 않고 해당 클래스를 호출하려는 경우 어떻게 될까요?? 이럴때 데이터를 바이트 스트림으로 변환하여 직렬화 개념을 사용합니다.

객체 **직렬화**는 객체의 상태를 바이트 스트림으로 변환하는데 사용되는 프로세스로, 디스크 / 파일로 유지되거나 네트워크 통신을 통해 실행중인 다른 Java 가상머신으로 전송될 수 있습니다. **역직렬화**란 이러한 바이트 스트림을 다시 객체형태로 변환하는 작업을 말합니다. 생성된 바이트는 플랫폼에 독립적입니다. 그래서 한 플랫폼에서 직렬화된 객체는 다른 플랫폼에서 역직렬화를 통해 데이터를 받아올 수 있습니다.

### 자바클래스 직렬화 가능하게 하는 방법

직렬화는 생성한 클래스를 Serializable 인터페이스를 구현하는 클래스로 만듦으로써 가능합니다.

Serializable 인터페이스는 메소드도 필드도 없는 마킹역할을 하는 인터페이스입니다.

#### serialVersionUID란?

serialVersionUID는 객체의 해시코드로 직렬화될 때 객체에 표시되는 **식별자** 역할을 합니다. 예컨데 serialver와 같은 툴로 객체의 serialVersionUID를 알아낼 수 있습니다.

serialVersionUID는 객체의 버전관리에 사용됩니다. serialVersionUID를 지정하지 않으면 클래스에서 필드를 추가하거나 수정할 때 serialVersionUID가 새 클래스에 대해 생성되고 이전 직렬화된 객체가 다르기 때문에 이미 직렬화된 객체를 복구할 수 없습니다. Java 직렬화 프로세스는 직렬화된 객체의 상태를 복구하기 위해 올바른 serialVersionUID를 사용하고 serialVersionUID가 일치하지 않는 경우 java.io.InvalidClassException을 발생시킵니다. 

---

출처 

-   [https://sas-study.tistory.com/345](https://sas-study.tistory.com/345)
