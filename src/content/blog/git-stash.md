---
title: "git stash로 작업 임시 저장하기"
description: "커밋하기 애매한 작업을 임시 저장하는 git stash 의 개념과 save/list/apply/pop/drop/clear 사용법, 잘못된 브랜치에서 한 작업을 옮기는 방법까지 정리합니다."
pubDate: "2026-06-18T09:18:00+09:00"
category: "ETC"
tags: ["git", "stash", "branch", "version-control"]
---

# Git stash 명령어.

- 회사에서 작업하다보면 (나처럼) 바보같이 공용으로 사용하는 branch에 개발을 바로 하는 경우가 있다.
- 이럴 때 욕 안 먹기 위한 stash 명령어를 이용하자!


- git stash 란? 
   - 작업 도중 커밋을 할 수는 없는 상태지만, 브랜치 전환을 하거나 커밋 변경을 해야할때 임시적으로 저장할 수 있는 명령어
   - Stash 명령을 사용하면 워킹 디렉토리에서 수정한 파일들만 저장한다
   - 아직 끝내지 않은 수정사항을 스택에 잠시 저장했다가 나중에 다시 적용할 수 있다


- git stash 사용하기 
    - stash 저장 -> 기존 작업하던 워킹 디렉토리(branch) 는 텅 비게 된다. 
    ```bash
    git stash save
    Saved working directory and index state WIP on develop: a88014b Merge remote-tracking branch 'origin/develop' into develop
  
    git status
    nothing to commit, working directory clean
    ```
    - 저장된 stash 목록 보기
    ```bash
    git stash list
    stash@{0}: WIP on master: 049d078 added the index file   
    ```
    - 저장한 stash 새로운 브렌치에 바로 적용 후 checkout 하기. ( 사실 apply 등 다른 기능이 있는데 이건 추후에 리뷰...)
      아래 처럼. git stash branch "stash Name" 을 하게 되면 자동으로 사용한 stash 는 디렉토리에서 삭제된다.
      이후, 자동으로 새롭게 만든 origin/feature/LM-407 브랜치에 체크아웃 한다.
    ```bash
    git stash branch origin/feature/LM-407 stash@{0}
      새로 만든 'origin/feature/LM-407' 브랜치로 전환합니다
      현재 브랜치 origin/feature/LM-407
      커밋하도록 정하지 않은 변경 사항:
        (무엇을 커밋할지 바꾸려면 "git add <파일>..."을 사용하십시오)
        (작업 폴더의 변경 사항을 버리려면 "git checkout -- <파일>..."을 사용하십시오)
      
              수정함:        build.gradle
      
      커밋할 변경 사항을 추가하지 않았습니다 ("git add" 및/또는 "git commit -a"를
      사용하십시오)
      Dropped stash@{0} (a42ce1dbba5815f3f3b4c4bd90a8cd39242cddba)
    ```
   
   - 이후 해당 branch 에서 push 하게되면 깔-꼼 하게 해결.

- git stash 내역 지우기
    - 특정 stash 지우기 ex -> git stash drop 'stash ID'  
    ```bash
    git stash drop stash@{0}
    ```
    
    - stash list 전체 삭제
    ```bash
    git stash clear
    ```  
   
- git stash 저장 후 브랜치 변경해서 적용하기.
    - git stash list 확인 (브랜치 변경 후)
    ```bash
    git stash list
    stash@{0}: WIP on master: 049d078 added the index file
    git stash apply stash@{0} 
    ```
    
    - git stash 현재 브랜치에 저장 후 stash list 에서 삭제시키기. (apply 후 drop 처리.)
    ```bash
    git stash pop
    ```

   
참조자료 : <https://git-scm.com/book/ko/v2/Git-%EB%8F%84%EA%B5%AC-Stashing%EA%B3%BC-Cleaning>
