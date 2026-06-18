---
title: "Mac에서 현재 사용 중인 포트 확인하기"
description: "macOS 터미널에서 lsof 명령어로 특정 포트 번호를 점유하고 있는 프로세스를 확인하는 방법을 정리합니다."
pubDate: "2026-06-18T09:26:00+09:00"
category: "ETC"
tags: ["macos", "shell", "lsof", "port", "terminal"]
---

# Mac 에서 현재 사용중인 포트 확인하기.

### 터미널 open

```bash
  sudo lsof -i :"포트번호"
```

![](./macos-check-port-usage/img-1.png)