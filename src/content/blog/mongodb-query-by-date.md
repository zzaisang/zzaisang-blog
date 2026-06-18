---
title: "MongoDB Query 날짜 조건으로 조회하기"
description: "MongoDB 에서 날짜 조건으로 검색하는 경우가 많습니다. 한방에 정리 했습니다. 데이터 적재 적재된 데이터 특정 날짜 >= 조건으로 조회 ($gte) '2022-05-25 00:00:00' 보다 크거나 같은 대상 조회 특정 날짜 > 조건으로 조회 ($gt)…"
pubDate: "2022-05-26T17:40:34+09:00"
category: "Database"
tags: ["mongoDB", "NoSQL"]
---
-   MongoDB 에서 날짜 조건으로 검색하는 경우가 많습니다. 한방에 정리 했습니다.

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

## 특정 날짜 >= 조건으로 조회 ($gte)

-   '2022-05-25 00:00:00' 보다 크거나 같은 대상 조회

```javascript
//query
db.items.find({
    createdAt : {
        $gte : new ISODate('2022-05-25T00:00:00.000Z')
    }
});

//result
[
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50a"},
    "createdAt": {"$date": "2022-05-26T00:00:00.000Z"},
    "name": "zzai_sang"
  },
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50d"},
    "createdAt": {"$date": "2022-05-28T00:00:00.000Z"},
    "name": "kim_sangjae"
  }
]
```

## 특정 날짜 > 조건으로 조회 ($gt)

-   '2022-05-26 00:00:00' 보다 큰 대상 조회

```javascript
//query
db.items.find({
    createdAt : {
        $gt : new ISODate('2022-05-26T00:00:00.000Z')
    }
});

//result
[
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50d"},
    "createdAt": {"$date": "2022-05-28T00:00:00.000Z"},
    "name": "kim_sangjae"
  }
]
```

## 특정 날짜 <= 조건으로 조회 ($lte)

-    '2022-05-24 10:55:00' 보다 작거나 같은 대상 조회

```javascript
//query
db.items.find({
    createdAt : {
        $lte : new ISODate('2022-05-24T10:55:00.000Z')
    }
});

//result
[
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50b"},
    "createdAt": {"$date": "2022-05-23T15:23:00.000Z"},
    "name": "sang_zzai"
  },
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50c"},
    "createdAt": {"$date": "2022-05-24T10:55:00.000Z"},
    "name": "sangjae_kim"
  }
]
```

## 특정 날짜 < 조건으로 조회 ($lt)

-    '2022-05-24 10:55:00' 보다 작은 대상 조회

```javascript
//query
db.items.find({
    createdAt : {
        $lt : new ISODate('2022-05-24T10:55:00.000Z')
    }
});

//result
[
  {
    "_id": {"$oid": "628f310a2ea7f34329a2b50b"},
    "createdAt": {"$date": "2022-05-23T15:23:00.000Z"},
    "name": "sang_zzai"
  }
]
```
