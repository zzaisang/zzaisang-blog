---
title: "객체 지향 설계 5가지 원칙 (SOLID)"
description: "SOLID 클린코드로 유명한 로버트 마틴이 좋은 객체 지향 설계의 5가지 원칙을 정리 SRP : 단일 책임 원칙 (single responsibility principle) OCP : 개방-폐쇠 원칙 (open/ closed principle) LSP : 리스코프 치환 원칙…"
pubDate: "2021-12-26T02:08:29+09:00"
updatedDate: "2022-04-16T17:22:46+09:00"
category: "CS"
tags: ["Java", "OOP", "solid", "객체지향"]
---
## SOLID

-   클린코드로 유명한 로버트 마틴이 좋은 객체 지향 설계의 5가지 원칙을 정리

---

-   SRP : 단일 책임 원칙 (single responsibility principle)
-   OCP : 개방-폐쇠 원칙 (open/ closed principle)
-   LSP : 리스코프 치환 원칙 (Liskov substitution principle)
-   ISP : 인터페이스 분리 원칙 (interface segregation principle)
-   DIP : 의존관계 역전 원칙 (dependency inversion principle)

---

### SRP(단일 책임 원칙)

-   한 클래스는 하나의 책임만 가져야 한다.
-   하나의 책임이라는 것음 모호하다.  
    \- 클 수 있고, 작을 수 있다.  
    \- 문맥과 상황에 따라 다르다.
-   **중요한 기준은 변경**이다. 변경이 있을 때 파급 효과가 적으면 단일 책임 원칙을 잘 따른 것
-   예) UI 변경, 객체의 생성과 사용을 분리

### OCP(개방-폐쇄 원칙)

-   소프트웨어 요소는 **확장에는 열려** 있으나 **변경에는 닫혀** 있어야한다.
-   OCP는 관리 가능하고 재사용 가능한 코드를 만드는 기반이며, OCP를 가능케 하는 중요 매커니즘은 추상화와 다형성이라고 설명할 수 있다.

적용방법

1.  변경(확장)될 것과 변하지 않을 것을 엄격히 구분한다.
2.  이 두 모듈이 만나는 지점에 인터페이스를 정의한다.
3.  구현에 의존하기보다 정의한 인터페이스에 의존하도록 코드를 작성한다.  
    \_ 확장되는 것과 볍ㄴ경되지 않는 모듈을 분리하는 과정에서 크기 조절에 실패하면 오히려 관계가 더 복잡해 질 수 있다.  
    \_ 인터페이스는 가능한 변경되면 안된다. 적절한 수준의 예측으로 적절한 작업량을 만들어야 한다.  
    \_ 적당한 추상화 레벨을 선택해야한다. 추상화란 다른 모든 종류의 객체로부터 식별될 수 있는 객체의 본질적인 특징이다.

### LSP(리스코프 치환 원칙)

-   프로그램의 객체는 프로그램의 정확성을 깨뜨리지 않으면서 하위 타입의 인스턴스로 바꿀 수 있어야 한다.
-   다형성에서 하위 클래스는 인터페이스 규약을 다 지켜야 한다는 것, 다형성을 지원하기 위한 원칙, 인터페이스를 구현한 구현체는 믿고 사용하려면, 이 원칙이 필요하다.
-   예) 자동차 인터페이스의 엑셀은 앞으로 가는 기능, 뒤로 가도록 구현하면 LSP 위반(인터페이스를 믿고 사용할 수 없다.)
-   서브 타입은 언제나 기반 타입으로 교체할 수 있어야 한다.
-   바꿔 말하면, 서브 타입은 기반 타입이 약속한 규약을 지켜야 한다.
-   상속은 구현 상속(extends)이던 인터페이스 상속(implements)이든 궁극적으로는 다형성과 확장성 획들을 목표로 한다. LSP 원리도 역시 서브클래스가 확장에 대한 인터페이스를 준수해야 함을 의미한다.
-   다형성과 확장성을 극대화하려면 하위 클래스를 사용하는 것보다는 상위의 클래스(인터페이스)를 사용하는 것이 더 좋다. 일반적으로 선언은 기반 클래스로 생성은 구현 클래스로 대입하는 방법을 사용한다.
-   생성 시점에서 구체 클래스를 노출시키기 꺼려지는 경우 생성 부분을 AbstrctFactory 등의 패턴을 사용하여 유연성을 높일 수 있다.
-   상속을 통한 재사용은 기반 클래스와 서브 클래스 사이에 IS-A 관계가 있을 경우로만 제한한다.
-   그 외의 경우에는 합성(composition)을 이용한 재사용을 해야 한다.
-   상속은 다형성과 따로 생각할 수 없다. 다형성으로 인한 효과를 얻기 위해서는 서브 클래스가 기반 클래스와 클라이언트 간의 규약(인터페이스)을 어겨서는 안 된다. 결국 이 구조는 다형성을 통한 확장의 원리인 OCP를 제공하게 된다. 따라서 LSP는 OCP를 구성하는 구조가 된다.
-   객체 지향 성계 원리는 이렇게 서로가 서로를 이용하기도 하고 포함하기도 하는 특징이 있다.
-   LSP는 규약을 준수하는 상속 구조를 제공하고, 이를 바탕으로 OCP는 확장하는 부분에 다형성을 제공해 변화에 열려있는 프로그램을 만들 수 있도록 한다.

#### 적용 사례

-   컬렉션 프레임워크

예시 코드

```cpp
void funciton(){
    LinkedList list = new LikedList();    //...
    modify(list);
}

void modify(LinkedList list){
    list.add(...);
    doSomethingWith(list);
}
```

List만 사용한다면 위의 코드도 문제는 없다. 하지만 만약 속도 개선을 위해 HashSet을 써야 한다면?  
LinkedList를 다시 HashSet으로 바꿔야 한다면? 둘 다 Collection 인터페이스를 상속하므로 다음처럼 작성하는 게 좋다.

```cpp
void funciton(){
    Collection list = new HashSet();    //...
    modify(list);
}
void modify(Collection collection){
    collection.add(...);
    doSomethingWith(collection);
}
```

이제 Collection 생성 부분만 고치면 어떤 Collection 구현 클래스든 사용할 수 있다. 이 프로그램에서 LSPdhk OCP를 모두 찾아볼 수 있다. 우션 Collection 프레임워크가 LSP를 준수하지 않았다면 Collection 인터페이스를 통해 수행하는 범용 작업이 제대로 수행될 수 없다. 하지만 모두 LSP를 준수하기 때문에 모든 Collection 연산에서는 modify() 메서드가 정상 작동한다.

그리고 이를 통해 modifiy()는 변화에 닫혀 있으면서, Collection의 변경과 확장에는 열려있는 구조(OCP)가 된다.  
물론 Collection이 지원하지 않는 연상을 사용한다면 한 단계 계층 구조를 내려가야 한다. 그러한 경우에도 ArrayList, LinkedList, Vector 대신 이들이 구현하고 있는 List를 사용하는 게 더 현명하다.

#### 적용 이슈

1.  혼동될 여지가 없고 트레이드오프를 고려해 선택한 것이라면 그대로 둔다.
2.  다형성을 위한 상속 관계가 필요 없다면 Replace with Delegation(상속 대신 위임)을 한다. 상속은 깨지기 쉬운 기반 클래스 등을 지니고 있으므로 Is-A 관계가 성립되지 않는다.
3.  상속 구조가 필요하다면 Extract Subclass, Push Down Field, Push down Method 등의 리팩터링 기법을 사용하여 LSP를 준수하는 상속 계층 구조를 구성한다.
4.  IS-A 관계가 성립한다고 프로그램에서 까지 그런 것은 아니다. 이들 간의 관계 맺음은 이들의 역할과 이들 사이에 공유하는 연산이 있는지, 그리고 이들 연산이 어떻게 다른지 등등을 종합적으로 검토해 봐야 한다.
5.  Desing by Contract("서브 클래스에서는 기반 클래스의 사전 조건과 같거나 더 약한 수준에서 사전 조건을 대체할 수 있고, 기반 클래스의 사후 조건과 같거나 더 강한 수준에서 사후 조건을 대체할 수 있다.") 적용: 기반 클래스를 서브 클래스로 치환 가능하게 하려면 받아들이는 선 조건에서 서브 클래스의 제약사항이 기반 클래스의 제약 사항보다 느슨하거나 같아야 한다. 만약 제약조건이 더 강하다면 기반 클래스에서 실행되던 것이 서브 클래스의 강 조건으로 인해 실행되지 않을 수도 있기 때문이다. 반면 서브 클래스의 후 조건은 같거나 더 강해야 하는데, 약하다면 기반 클래스의 후 조건이 통과시키지 않는 상태를 통과시킬 수도 있기 때문이다.

### ISP(인터페이스 분리 원칙)

-   특정 클라이언트를 위한 인터페이스 여러 개가 범용 인터페이스 하나보다 낫다.
-   예)  
    \_ 자동차 인터페이스 -> 운전 인터페이스, 정비 인터페이스로 분리  
    \_ 사용자 클라이언트 -> 운전자 클라이언트, 정비사 클라이언트로 분리  
    \_ 분리하면 정비 인터페이스 자체가 변해도 운전자 클라이언트에 영향을 주지 않는다.  
    \_ 인터페이스가 명확해지고, 대체 가능성이 높아진다.

### DIP(의존관계 역전 원칙)

-   프로그래머는 "추상화에 의존해야지, 구체화에 의존하면 안 된다." 의존성 주인은 이 원칙을 따르는 방법 중 하나다.
-   쉽게 이야기해서 구현 클래스에 의존하지 말고, 인터페이스에 의존하라는 뜻이다.
-   상위 모듈은 하위 모듈에 의존해서는 안된다.
-   추상화는 세부사항에 의존해서는 안된다.

#### 적용 예시

-   의존 관계를 맺을 때 변화하기 쉬운 것에 의존하기보다는, 변화하지 않는 것에 의존하라는 원칙이다.
-   PayService를 개발해야 한다.
-   Pay의 수단이 여러 가지 있다.(SamsungPay, KaKaoPay, NaverPay ... 등)
-   초기 삼성페이만 사용한다고 하였다가 다른 Pay 수단들도 추가해달라고 하였을 때 확장이 어렵다.
-   확장하기 편하게 공통부분을 묶어서 변화하지 않게 설정
-   DIP 가 중요한 이유는 확장성이 용이하고 객체 간의 관계를 최대한 느슨하게 해주는 효과가 있다.

AS-IS 잘못된 설계 - 다른 결제 수단이 필요하면 메서드를 하나씩 생성해야 한다.

```java
public class SamsungPay {
    String payment(){
        return "samsung";
    }
}
```

```java
public class PayService {
    private SamsungPay pay;

    public void setPay(final SamsungPay pay) {
        this.pay = pay;
    }

    public String payment() {
        return pay.payment();
    }
}
```

TO-BE 리팩터링!

공통부분 추상화 한 interface

```java
public interface Pay {
    String Payment();
}
```

SamsungPay.class 리팩터링

```java
public class SamsungPay implements Pay{
    @Override
    String payment(){
        return "samsung";
    }
}
```

추가된 KakaoPay

```java
public class KakaoPay implements Pay {
    @Override
    public String payment() {
        return "kakao";
    }
}
```

PayService.class 리팩터링

```java
public class PayService {
    private Pay pay;

    public void setPay(final Pay pay) {
        this.pay = pay;
    }

    public String payment() {
        return pay.payment();
    }
}
```

---

참고 

\- [https://www.nextree.co.kr/p6960/](https://www.nextree.co.kr/p6960/)

\- [https://dev-momo.tistory.com/entry/SOLID-%EC%9B%90%EC%B9%99](https://dev-momo.tistory.com/entry/SOLID-%EC%9B%90%EC%B9%99)

\- [https://johngrib.github.io/wiki/SOLID/](https://johngrib.github.io/wiki/SOLID/)

\- [https://huisam.tistory.com/entry/DIP](https://huisam.tistory.com/entry/DIP)

\- 인프런 - (스프링 핵심원리 - 기본 편 )김영한님
