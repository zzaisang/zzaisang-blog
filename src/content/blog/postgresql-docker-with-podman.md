---
title: "PostgreSQL Docker 로 실행하기 (with. Podman)"
description: "로컬에서 개발을 하다보면 DB 를 Docker 로 띄워서 테스트를 할 일이 많습니다.PostgreSQL 을 Podman 을 통해서 컨테이너를 띄우는 설명입니다. 공식 사이트 :…"
pubDate: "2023-12-05T08:33:37+09:00"
category: "Database"
tags: ["docker", "Podman", "PostgreSQL"]
---
로컬에서 개발을 하다보면 DB 를 Docker 로 띄워서 테스트를 할 일이 많습니다.  
PostgreSQL 을 Podman 을 통해서 컨테이너를 띄우는 설명입니다.

-   공식 사이트 : \[PostgresDockerHub\]([https://hub.docker.com/\_/postgres/tags)](https://hub.docker.com/_/postgres/tags))
-   CLI

```bash
$ podman run --name base \\ #컨테이너 명  
\-e POSTGRES\_USER=base \\ #Root 권한의 id  
\-e POSTGRES\_PASSWORD=base \\ #Root 권한의 pw  
\-e POSTGRES\_HOST\_AUTH\_METHOD=trust \\ # 모든 host & 사용자 & Database 에 대한 접근 허용  
\-p 5432:5432" \\  
postgres  
```
