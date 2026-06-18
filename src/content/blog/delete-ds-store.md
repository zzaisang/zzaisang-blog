---
title: ".DS_Store 파일 삭제 방법"
description: ".DS_Store 파일이란? DS_STORE 파일이란 Desktop Services Store의 약자로, 애플에서 정의한 파일 포맷이다. 애플의 맥 OS X 시스템이 finder로 폴더에 접근할 때 자동으로 생기는 파일로써, 해당 폴더에 대한 메타데이터를 저장하는 파일이다.…"
pubDate: "2022-01-05T00:58:01+09:00"
category: "ETC"
tags: [".ds_stroe", "Git"]
---
### .DS\_Store 파일이란?

-   DS\_STORE 파일이란 Desktop Services Store의 약자로, 애플에서 정의한 파일 포맷이다.
-   애플의 맥 OS X 시스템이 finder로 폴더에 접근할 때 자동으로 생기는 파일로써, 해당 폴더에 대한 메타데이터를 저장하는 파일이다.
    -   윈도우의 thumb.db 파일과 비슷하다.
    -   분석해보면 해당 디렉토리 크기, 아이콘의 위치, 폴더의 배경에 대한 정보들을 얻을 수 있다.
-   맥 OS 환경에서만 생성 및 사용되지만, 파일을 공유하는 과정에서 이 파일도 같이 공유되는 경우가 있다.
-   DS\_store 파일은 프로젝트와 관련없는 파일이며, git status를 사용했을 때 발견되는 파일이니, github로 넘기지말고 삭제해도 된다.

### .DS\_Store 삭제 방법

-   저장소 상위 디렉토리 기준 .DS\_Store 파일 제거 (현재 디렉토리 아래의 모든 파일)
    -   (추가) 앞으로 .DS\_Store 파일을 업로드 안하고 싶다면
        -   저장소 상위 디렉토리에 .gitignore 파일 생성 및 .DS\_Store 파일 추가
        -   ```bash
            echo .DS_Store >> .gitignore
            ```
            

```shell
find . -name .DS_Store -print0 | xargs -0 git rm -f --ignore-unmatch
```

-   변경 사항을 원격 저장소에 push

```bash
git add --all git commit -m '.DS_Store removed' git push origin main
```

---

출처 : [https://wooono.tistory.com/251](https://wooono.tistory.com/251)
