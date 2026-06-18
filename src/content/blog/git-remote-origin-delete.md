---
title: "Git remote origin 삭제하기"
description: "remote origin already exists 에러가 날 때 git remote rm origin 으로 원격 저장소 연결을 삭제하고 git remote -v 로 확인하는 방법을 정리합니다."
pubDate: "2026-06-18T09:19:00+09:00"
category: "ETC"
tags: ["git", "remote", "origin", "version-control"]
---

# Git remote origin 삭제

Git을 사용하는 외부 원격 저장소를 이용시, 계정이나 사용자, 원격 저장소 경로를 변경하고자 할때 remote origin 브랜치 그룹을 삭제해야할 때가 있습니다.
그러나 이미 remote  origin 이 있어서 하위와 같은 문구가 뜰 때 remote origin 삭제 방법 
```bash
fatal: remote origin already exists.
```

- remote origin 삭제하기
```bash
$ git remote rm origin
```
- 삭제 후 원격 브랜치 정보 확인 (브랜치 그룹과 원격 저장소 정보)
```bash
$ git remote -v 
```

---
출처 : https://git-scm.com/docs/git-remote, https://0urtrees.tistory.com/41
