---
title: "Spring 트랜잭션 전파(Propagation) 옵션 정리"
description: "Spring @Transactional 의 전파 옵션(REQUIRED, SUPPORTS, REQUIRES_NEW, MANDATORY, NESTED 등)을 동작 방식과 예시로 정리합니다."
pubDate: "2026-06-18T09:04:00+09:00"
category: "Spring"
tags: ["spring", "transaction", "propagation", "transactional", "nested"]
---

# Spring Transaction Propagation

Spring 트랜잭션 Annotation 에는 여러가지 트랜잭션 전파 옵션이 있다.
- 트랜잭션 동작 도중 다른 트랜잭션을 호출(실행)하는 상황에서 선택할 수 있는 옵션

## REQUIRED
- 디폴트 속성, 부모 트랜잭션 내에서 실행하며 부모 트랜잭션이 없을 경우 새로운 트랜잭션을 생성한다.

## SUPPORTS
- 이미 시작된 트랜잭션이 있으면 참여하고 그렇지 않으면 트랜잭션 없이 진행하게 만든다.

## REQUIRES_NEW
- 부모 트랜잭션을 무시하고 무조건 새로운 트랜잭션이 생성

## MANDATORY
- REQUIRED와 비슷하게 이미 시작된 트랜잭션이 있으면 참여한다.
- 트랜잭션이 시작된 것이 없으면 새로 시작하는 대신 예외를 발생시킨다.
- 혼자서는 독립적으로 트랜잭션을 시작하면 안되는 경우에 사용한다.

## NOT_SUPPORTED
- 트랜잭션을 사용하지 않게 한다.
- 이미 진행 중인 트랜잭션이 있으면 보류시킨다.

## NEVER
- 트랜잭션을 사용하지 않도록 강제한다.
- 이미 진행중인 트랜잭션도 존재하면 안된다. 있다면 예외를 발생

## NESTED
- 이미 진행중인 트랜잭션이 있으면 중첩 트랜잭션을 시작한다.
- 중첩 트랜잭션은 트랜잭션 안에 다시 트랜잭션을 만드는 것이다.
- 하지만 독립적인 트랜잭션을 만드는 REQUIRES_NEW와는 다르다. 
  중첩된 트랜잭션은 먼저 시작된 부모 트랜잭션의 커밋과 롤백에는 영향을 받지만 자신의 커밋과 롤백은 부모 트랜잭션에게 영향을 주지 않는다.

---
ex) 어떤 작업을 진행하는 중 로그는 꼭 DB에 저장해야 할 때
- 이 로그를 저장하는 작업이 실패한다고 메인 작업의 트랜잭션까지는 롤백되버린다면 특히 쇼핑몰에서 고객 주문작업 등의 경우 매출 하락까지도 발생할 수 있는 중요한 문제이다.
- 반대로 로그를 남긴 후 메인 작업에서 예외가 발생한다면 이때는 저장한 로그도 롤백되어야 하는게 맞다.
- 이럴 때 로그 작업을 메인 트랜잭션에서 분리해서 중첩 트랜잭션으로 만들어 두면 유용하게 사용할 수 있다. 이렇기 때문에 더욱 더 비지니스 로직을 잘 짜줘야 할 것이다.

---
출처 : [https://goddaehee.tistory.com/167](https://goddaehee.tistory.com/167), [https://mangkyu.tistory.com/30](https://mangkyu.tistory.com/30)
