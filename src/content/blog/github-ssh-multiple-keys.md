---
title: "GitHub \"Key is already in use\" 에러 방지 : SSH public Key 2개 등록하기"
description: "GitHub \"Key is already in use\" 에러 방지 : SSH public Key 2개 등록하기 GitHub에서는 동일한 ssh Key 를 등록할 수 없습니다. 그래서 회사와 집에서 사용하는 장비가 다를때 각각의 ssh키를 등록 해줘야합니다. 동일한 Key 등록시…"
pubDate: "2022-04-21T15:43:31+09:00"
category: "ETC"
tags: ["Git", "GitHub", "sshkey"]
---
# GitHub "Key is already in use" 에러 방지 : SSH public Key 2개 등록하기

GitHub에서는 동일한 ssh Key 를 등록할 수 없습니다.  
그래서 회사와 집에서 사용하는 장비가 다를때 각각의 ssh키를 등록 해줘야합니다.

---

-   동일한 Key 등록시 'Key is already in use' 라는 문구의 에러 발생

# 새로운 GitHub 전용 ssh key 생성

```bash
cd ~/.ssh
ssh-keygen

#생성시 기존의 id_rsa, id_rsa.pub 과 이름이 다르게 하기 위해 이름을 변경한다.
# 'Enter file in which to save the key' 문구가 뜨면 /Users/zzaisang/.ssh/id_rsa_github 처럼 다른 이름을 지정한다. 
Enter file in which to save the key (/Users/zzaisang/.ssh/id_rsa): /Users/zzaisang/.ssh/id_rsa_github
#추후 모두 Enter 진행
...
#생성 완료
```

# 새로 생성한 pub-Key를 GitHub 에 등록

1.  pub-key 복사
    
    ```bash
    cat ~/.ssh/id_rsa_github.pub
    #하위 값들 전체 복사
    ```
    
2.  GitHub에 ssh key 추가
    
    -   우측 상단 프로필 -> settings -> SSH and GPG keys
    -   New SSH Key 클릭
    -   방금 복사한 pub 키 등록 및 이름(구분할 수 있는 아무거나) 등록

# SSH config 에 GitHub.com-{github-id}반영

1.  config 파일 접근 (없으면 생성)  
    `vi ~/.ssh/config`
    
2.  하위 내용 추가
    
    ```
    Host github.com-zzaisang # zzaisang -> 사용하는 GitHub ID
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_github
    ```
    
3.  권한 추가
    
    ```bash
    chmod 440 ~/.ssh/config 
    ```
    

# Git clone 사용 시 URL 에 계정 정보 추가 후 복사

Git clone 명령어를 사용해서 Git을 로컬에 복사하는 과정입니다.  
GitHub의 Repository에서 Clone 명령어에서 "SSH"를 선택하면 clone 할 URL을 표시해줍니다.  
Git Repository URL을 [git@github.co](mailto:git@github.co)m-{your\_id}:{your\_id}/{repo\_name}.git 와 같이 입력합니다.

GitHub에서 복사한 URL: [git@github.com](mailto:git@github.com):{your\_id}/{repo\_name}.git  
수정해야 하는 URL: [git@github.co](mailto:git@github.co)m-{your\_id}:{your\_id}/{repo\_name}.git  
수정 예: [git@github.com-zzaisang](mailto:git@github.com-zzaisang):zzaisang/test.git

-   clone 시 url를 config에 지정한 Host정보로 변경
    
    ```bash
    git clone git@github.com:zzaisang/study_zzaisang.git ## AS-IS 방식
    git clone git@github.com-zzaisang:zzaisang/study_zzaisang.git ## To-BE 방식
    ```
    

---

출처 : [https://kibua20.tistory.com/190](https://kibua20.tistory.com/190)
