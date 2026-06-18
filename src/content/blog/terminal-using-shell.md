---
title: "AWS EC2 Linux에서 사용 중인 쉘 확인하기"
description: "리눅스에서 사용 중인 쉘을 /etc/passwd 로 확인하고 /etc/shells 로 설치된 쉘 목록을 조회하는 방법을 Amazon Linux2 기준으로 정리합니다."
pubDate: "2026-06-18T09:25:00+09:00"
category: "ETC"
tags: ["linux", "shell", "bash", "ec2", "amazon-linux2"]
---

# AWS EC2 Linux 쉘(shell) 확인 및 변경하는법

리눅스에서 쉘은 사용자와 리눅스 커널 사이에서 중간자 역할을 수행합니다. 우리가 쉘이라고 부르는 특별한 프로그램은 한가지만 있는것이 아니라 여러가지가 있습니다. 리눅스에서는 대표적으로 배시쉘이라는 쉘을 사용합니다. 여러가지 쉘은 기본적인 기능은 비슷하지만 편리기능이나 사용자 환경설정 등에 약간씩 차이를 보입니다. 쉘이 제공하는 기능은 크게 명령어 해석기능, 프로그래밍 기능, 사용자 환경설정 기능으로 구분할 수 있습니다.

## 현재 사용하고 있는 쉘 확인하기 (Amazon Linux2 기준)
```bash
$ grep ec2-user /etc/passwd
ec2-user:x:1000:1000:EC2 Default User:/home/ec2-user:/bin/bash
```
현재 사용중인 쉘의 종류를 알아보는 가장 간편한 방법은 프로세스 정보를 보는 방법입니다.
grep [사용자 이름] /etc/passwd 라는 명령어를 입력하면 현재 사용하고 있는 쉘을 볼 수 있습니다.
가장 마지막에나온 /bin/bash가 현재 사용하고 있는 쉘입니다.

## 현재 설치 되어 있는 쉘 확인하기
```bash
$ cat /etc/shells
/bin/sh
/bin/bash
/usr/bin/sh
/usr/bin/bash
/bin/tcsh
/bin/csh
```
설치 된 쉘은 /etc/shells 경로에 있습니다.

---
출처 : https://coding-factory.tistory.com/507