---
title: "Linux TimeZone 확인 및 변경 방법"
description: "Linux 에서 date 와 timedatectl 로 현재 시간/타임존을 확인하고, set-timezone 으로 UTC 에서 Asia/Seoul(KST)로 변경하는 방법을 정리합니다."
pubDate: "2026-06-18T09:24:00+09:00"
category: "ETC"
tags: ["linux", "timezone", "timedatectl", "date", "terminal"]
---

# Linux TimeZone 확인 및 변경 방법

## 시간 확인 방법

1. date 명령어
```bash
$ date

Mon May  2 09:06:39 UTC 2022
```

2. timedatectl
```bash
$ timedatectl

      Local time: 월 2022-05-02 09:02:20 UTC
  Universal time: 월 2022-05-02 09:02:20 UTC
        RTC time: 월 2022-05-02 09:02:21
       Time zone: n/a (UTC, +0000)
     NTP enabled: yes
NTP synchronized: yes
 RTC in local TZ: no
      DST active: n/a
```

기본값으로 리눅스를 설치하는 경우 UTC 타임존으로 설정되어 있습니다.

## TimeZone 변경 방법

- 아래와같이 timedatectl 명령어를 통해서 TimeZone 을 쉽게 변경할 수 있습니다.
    - 해당 정보는 재부팅 이후에도 유지됩니다.
```bash
$ timedatectl list-timezones | grep Seoul

Asia/Seoul //Seoul 에 대한 timezone FullName 정보

$ sudo timedatectl set-timezone Asia/Seoul

      Local time: 월 2022-05-02 18:03:29 KST
  Universal time: 월 2022-05-02 09:03:29 UTC
        RTC time: 월 2022-05-02 09:03:30
       Time zone: Asia/Seoul (KST, +0900)
     NTP enabled: yes
NTP synchronized: yes
 RTC in local TZ: no
      DST active: n/a
```

-----
출처 : https://psychoria.tistory.com/750