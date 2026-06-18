---
title: "상속(extends) vs 구현(implements)"
description: "상속(Extends) 사실 extends가 상속의 대표적인 형태다. 부모의 메소드를 그대로 사용할 수 있으며 오버라이딩 할 필요 없이 부모에 구현되있는 것을 직접 사용 가능하다. Car라는 클래스는 Vehicle을 상속 받았다. 그리고 getSpeed() 메소드로 speed를…"
pubDate: "2022-04-17T17:28:42+09:00"
category: "CS"
tags: ["extends", "implement", "Interface", "Java", "OOP"]
---
## 상속(Extends)

-   사실 extends가 상속의 대표적인 형태다.
-   부모의 메소드를 그대로 사용할 수 있으며 오버라이딩 할 필요 없이 부모에 구현되있는 것을 직접 사용 가능하다.

```java
class Vehicle {
  protected int speed = 3;
  
  public int getSpeed(){
    return speed;
  }
  public void setSpeed(int speed){
    this.speed = speed;
  }
}

class Car extends Vehicle{
  public void printspd(){
    System.out.println(speed);
  }
}

public class ExtendsSample {
  public static main (String[] args){
    Car A = new Car();
    System.out.println(A.getSpeed());
    A.printspd();
  }
}
```

Car라는 클래스는 Vehicle을 상속 받았다. 그리고 getSpeed() 메소드로 speed를 print 했다.  
그런데 vehicle의 getSpeed 메소드에서 speed를 직접 바로 사용했다. extends를 했으니 메소드 뿐만 아니라 변수까지 사용이 가능해 지는 것이다.

**자바는 "다중상속"을 지원하지 않는다**는 점이다.

다중상속이란 부모클래스가 두개 이상 존재할 수 있다는 것인데, 자바에서는 이를 지원하지 않는다. 즉 , public class Son extends Father, Mother{...} 이것이 지원하되지 않는다는 것이다.

자바는 다중상속을 지원하지 않는다. 대신 implements(인터페이스)가 등장했다.

-   클래스를 상속, 공통된 부모를 가지는 것들 끼리 묶음. is-a 관계

**장점**

-   상위 클래스에서 필드 및 공통 메서드를 상속하여 사용할 수 있다.
-   따라서 하위 클래스에서 소스코드의 양이 줄어들고 기능을 확장하기 용이하다.

**단점**

-   상속구조가 복잡해지면 상위클래스의 변화가 하위클래스에 주는 영향을 예측하기 힘들다.
-   적절하지 못한 상속을 사용하면 의도했던 것과 다르게 동작할 수 있다.

---

## 구현(implements)

```java
interface TestInterface{
  public static int num = 8;
  public void fun1();
  public void fun2();
}

class InterfaceExam implements TestInterface{
  @Override
  public void fun1(){
    System.out.println(num);
  }
  
  @Override
  public void fun2() {
    
  }
}

public class InterfaceSample{
  public static void main(String args[]){
    InterfaceExam exam = new InterfaceExam();
    exam.fun1();
  }
}
```

**implements의 가장 큰 특징은 이렇게 부모의 메소드를 반드시 오버라이딩(재정의)해야 한다.**

또한 이 implements는 다중상속을 대신해준다.

```java
public class Son implements Father, Mother{...}
```

-   interface를 구현함. 공통된 기능을 하는 것들 끼리 묶음. has-a 관계

**장점** : 다중구현이 가능하다.

**단점** : interface의 내용이 바뀌면 이를 구현하는 모든 클래스 소스가 변경되어야 한다.

## 정리

-   자바에서는 다중상속을 지원하지 않는다.
-   extends는 일반 클래스와 abstract 클래스 상속에 사용되고, implement는 interface 상속에 사용된다.
-   class가 class를 상속받을 땐 extends를 사용하고, interface가 interface를 상속 받을 땐 extends를 사용한다.
-   extends는 클래스 한 개만 상속 받을 수 있다.
-   extends 자신 클래스는 부모 클래스의 기능을 사용한다.
-   interface를 구현하는 코드에서는 interface의 모든 기능(메서드)를 구현해야한다.

---

출처

-   [https://defacto-standard.tistory.com/157](https://defacto-standard.tistory.com/157)
-   [https://velog.io/@hkoo9329/%EC%9E%90%EB%B0%94-extends-implements-%EC%B0%A8%EC%9D%B4](https://velog.io/@hkoo9329/%EC%9E%90%EB%B0%94-extends-implements-%EC%B0%A8%EC%9D%B4)​
