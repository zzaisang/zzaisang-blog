---
title: "Spring singleton vs Java static"
description: "큰 차이점은 Scope와 Thread Safe 여부이다. Java의 static은 ClassLoader 기준이고, Spring singleton은 ApllicationContext 기준이다. Tomcat을 was로 사용한다고 했을때, WebApplication별로 별도…"
pubDate: "2022-04-17T16:26:50+09:00"
category: "Spring"
tags: ["Java", "Singleton", "Spring", "static"]
---
큰 차이점은 **Scope**와 **Thread Safe** 여부이다.

Java의 static은 ClassLoader 기준이고, Spring singleton은 ApllicationContext 기준이다.

Tomcat을 was로 사용한다고 했을때, WebApplication별로 별도 클래스로더를 사용하여 동일 WebApplication끼리 공유할 수 있게 한다.

스프링 싱글톤은 DispatcherServlet 위에 등록된 ApllicationContext별로 공유하며 Spring IoC컨테이너에서 공유가 가능하다.

스프링 싱글톤은 IoC Container에 의해 Thread Safe를 자동으로 보장하게 되어 있다.
