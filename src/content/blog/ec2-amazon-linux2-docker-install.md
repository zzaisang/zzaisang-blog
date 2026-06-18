---
title: "EC2 (Amazon Linux2) 에 docker & docker-compose 설치"
description: "EC2 (Amazon Linux 2) 에 Docker 설치 1. 인스턴스에 설치한 패키지 및 패키지 캐시 업데이트 2. 최신 Docker Engine 패키지를 설치 3. Docker 서비스 시작 (선택사항) 시스템이 재부팅될 때마다 Docker 데몬이 시작되도록 하기 4.…"
pubDate: "2022-05-12T11:38:26+09:00"
category: "DevOps"
---
# EC2 (Amazon Linux 2) 에 Docker 설치

## 1\. 인스턴스에 설치한 패키지 및 패키지 캐시 업데이트

```bash
$ sudo yum update -y
```

## 2\. 최신 Docker Engine 패키지를 설치

```bash
$ sudo amazon-linux-extras install docker
```

## 3\. Docker 서비스 시작

```bash
$ sudo service docker start
```

## (선택사항) 시스템이 재부팅될 때마다 Docker 데몬이 시작되도록 하기

```bash
$ sudo systemctl enable docker
```

## 4\. sudo 없이 docker 명령어 실행할 수 있는지 확인

```bash
$ docker info 
```

---

# EC2 에 docker-compose 설치

## 1\. docker-compose latest (최신) 버전 설치

```bash
$ sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
```

## 2\. docker-compose 명령어 실행 권한 부여

```bash
$ sudo chmod +x /usr/local/bin/docker-compose
```

---

출처 : [https://docs.aws.amazon.com/ko\_kr/AmazonECS/latest/developerguide/create-container-image.html](https://docs.aws.amazon.com/ko_kr/AmazonECS/latest/developerguide/create-container-image.html), [https://github.com/docker/compose](https://github.com/docker/compose)
