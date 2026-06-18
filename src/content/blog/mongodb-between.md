---
title: "MongoDB Between 조건으로 조회하기"
description: "MongoDB Between 조건으로 조회하는법을 정리했습니다. 데이터 적재 적재된 데이터 '2022-05-24 10:55:00' <= result < '2022-05-28 00:00:00' 쿼리 결과 이런식으로 응용하시면 됩니다! 출처 :…"
pubDate: "2022-05-27T18:59:54+09:00"
category: "Database"
tags: ["Between", "mongoDB", "query"]
---
-   MongoDB Between 조건으로 조회하는법을 정리했습니다.

---

-   데이터 적재
    
    ```javascript
    db.items.insertMany([
    {
      'name' : 'zzai_sang',
      'createdAt' : new ISODate('2022-05-26T00:00:00.000Z')
    },
    {
      'name' : 'sang_zzai',
      'createdAt' : new ISODate('2022-05-23T15:23:00.000Z')
    },
    {
      'name' : 'sangjae_kim',
      'createdAt' : new ISODate('2022-05-24T10:55:00.000Z')
    },
    {
      'name' : 'kim_sangjae',
      'createdAt' : new ISODate('2022-05-28T00:00:00.000Z')
    },
    ]);
    ```
    
-   적재된 데이터
    
    ```json
    [
      {
          "_id": {"$oid": "628f310a2ea7f34329a2b50a"},
          "createdAt": {"$date": "2022-05-26T00:00:00.000Z"},
          "name": "zzai_sang"
      },
      {
          "_id": {"$oid": "628f310a2ea7f34329a2b50b"},
          "createdAt": {"$date": "2022-05-23T15:23:00.000Z"},
          "name": "sang_zzai"
      },
      {
          "_id": {"$oid": "628f310a2ea7f34329a2b50c"},
          "createdAt": {"$date": "2022-05-24T10:55:00.000Z"},
          "name": "sangjae_kim"
      },
      {
          "_id": {"$oid": "628f310a2ea7f34329a2b50d"},
          "createdAt": {"$date": "2022-05-28T00:00:00.000Z"},
          "name": "kim_sangjae"
      }
    ]
    ```
    

## '2022-05-24 10:55:00' <= result < '2022-05-28 00:00:00'

-   쿼리
    
    ```javascript
    db.items.find({
      createdAt : {
          $gte : new ISODate('2022-05-24T10:55:00.000Z'),
          $lt : new ISODate('2022-05-28T00:00:00.000Z')
      }
    });
    ```
    
-   결과
    
    ```json
    [
    {
      "_id": {"$oid": "628f40832ea7f34329a2b511"},
      "createdAt": {"$date": "2022-05-26T00:00:00.000Z"},
      "name": "zzai_sang"
    },
    {
      "_id": {"$oid": "628f40832ea7f34329a2b513"},
      "createdAt": {"$date": "2022-05-24T10:55:00.000Z"},
      "name": "sangjae_kim"
    }
    ]
    ```
    

이런식으로 응용하시면 됩니다!

---

출처 : [https://stackoverflow.com/questions/2943222/find-objects-between-two-dates-mongodb](https://stackoverflow.com/questions/2943222/find-objects-between-two-dates-mongodb)
