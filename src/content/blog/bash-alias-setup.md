---
title: "Bash Alias 설정하기"
description: "자주 쓰는 명령어를 bash alias 로 등록하는 방법을 ~/.bash_profile 에 nginx 로그 확인 alias 를 추가하는 예제로 설명합니다."
pubDate: "2026-06-18T09:22:00+09:00"
category: "ETC"
tags: ["linux", "shell", "bash", "alias", "terminal"]
---

# Bash Alias 설정하기

- terminal 을 사용하다보면 자주 사용하는 명령어들을 alias 해보자.

---
## 사용중인 쉘 확인

[사용 중인 쉘 보기](../terminal-using-shell/)

## ~/.bash_profile에 alias 추가

- nginx error / access log 보기
```bash
$ echo "alias nel='sudo tail -f /var/log/nginx/error.log'" >> ~/.bash_profile
$ echo "alias nal='sudo tail -f /var/log/nginx/access.log'" >> ~/.bash_profile
```