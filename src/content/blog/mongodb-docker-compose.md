---
title: "[MongoDB] Docker-compose로 세팅하기"
description: "MongoDB_docker-compose 세팅 사용할 이미지는 docker-hub에서 찾으셔서 맞는 버전 사용하시면 됩니다. https://hub.docker.com/_/mongo docker-compose.yml 설정"
pubDate: "2022-04-21T15:14:13+09:00"
category: "Database"
tags: ["docker", "docker-compose", "mongoDB"]
---
# MongoDB\_docker-compose 세팅

## 사용할 이미지는 docker-hub에서 찾으셔서 맞는 버전 사용하시면 됩니다.

-   [https://hub.docker.com/\_/mongo](https://hub.docker.com/_/mongo)

## docker-compose.yml 설정

```yaml
version: '3.7'

services:
  mongodb:
    image: mongo:5.0.5 #사용할 mongoDB version
    container_name: mongodb #컨테이너 이름
    restart: always #컨테이너 실핼 시 재시작
    environment:
      #MongoDB 계졍 및 패스워드 설정
      - MONGO_INITDB_ROOT_USERNAME=root 
      - MONGO_INITDB_ROOT_PASSWORD=root1234!
    ports:
      - 26017:27017 #port 설정 <접근 포트 : fowarding 대상 포트>
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d #볼륨설정 (container 내부와 mount 할 경로)
```
