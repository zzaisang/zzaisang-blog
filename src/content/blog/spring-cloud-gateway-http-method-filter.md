---
title: "Spring Cloud Gateway) Http Method 변경하는 Filter 만들기"
description: "이전글 에 이어서 이메일 인증과 같은 경우에 내부 API 에는 POST 요청으로 구성하고, 외부 Gateway 에서는 브라우저를 통해서 들어오기 때문에 GET 요청으로 받아야 하는 경우가 있습니다. (물론 내부 API 를 GET 으로 구성하고 by-pass 하는 경우도 있으나,…"
pubDate: "2024-02-16T08:18:28+09:00"
category: "Spring"
tags: ["customfilter", "kotlin", "Spring", "spring cloud gateway", "SpringCloud"]
---
[이전글](../spring-cloud-gateway-query-param-header-filter/) 에 이어서 이메일 인증과 같은 경우에   
내부 API 에는 POST 요청으로 구성하고, 외부 Gateway 에서는 브라우저를 통해서 들어오기 때문에 GET 요청으로 받아야 하는 경우가 있습니다. (물론 내부 API 를 GET 으로 구성하고 by-pass 하는 경우도 있으나, 성격이 맞지 않는다고 판단해서 변경한 경우입니다.)  
  

아래처럼 Filter 를 만들어 줍니다.   
해당 Filter 의 변수(ChangeMethodConfing) 의 값을 통해서 어떤 HTTP Method 로 변경할지 결정합니다.

```kotlin
package com.kotlinplayground.gateway.filter

import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component
import com.kotlinplayground.gateway.filter.ChangeHttpMethodGatewayFilterFactory.ChangeMethodConfig

@Component
class ChangeHttpMethodGatewayFilterFactory :
    AbstractGatewayFilterFactory<ChangeMethodConfig>(ChangeMethodConfig::class.java) {

    override fun apply(changeMethodConfig: ChangeMethodConfig): GatewayFilter {
        return GatewayFilter { exchange, chain ->
            val method = changeMethodConfig.getHttpMethod()
            chain.filter(exchange.mutate().request(exchange.request.mutate().method(method).build()).build())
        }
    }

    data class ChangeMethodConfig(
        var changeMethod: String,
    ) {

        fun getHttpMethod() = HttpMethod.valueOf(changeMethod)
    }
}
```

아래는 해당 Filter 를 설정하는 yaml 파일입니다. (이전글과 이어서 설정을 추가합니다.)

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-email-verify
          uri: http://localhost:8080
          order: 0
          predicates:
            - Path=/user/verify
            - Method=GET
            - Query=token
          filters:
            - name: ChangeHttpMethod
              args:
                changeMethod: POST
            - name: QueryParamToHeader
              args:
                paramName: token
                headerName: Authorization
                headerValuePrefix: 'Bearer '
            - RemoveRequestParameter=token
            - RewritePath=/user/(?<segment>.*), /$\{segment}
```

위처럼 Filter 들을 설정하게 되면

1.  \`ChangeHttpMethod\` Filter 를 통해서 argument 로 지정한 POST 로 요청을 변경합니다.
2.  \`QueryParamToHeader\`Filter 를 통해서 token 이라는 이름의 QueryParam 의 Value 를 추출해서 Authorization 이라는 HeaderName 으로 Vlaue를 추가합니다. 그 Value 앞에 'Bearer ' 라는 값을 Prefix 로 지정합니다.
3.  \`RemoveRequestParameter\`(기본제공) Filter 를 통해서  token 이라는 Request Param 값을 라우팅할 요청에서 제외시킵니다. (이전에 값을 추출해서 사용해서 필요가 없음)
4.  내부적인 규칙입니다. \`/user/\*\*\` 로 들어온 요청에 대한건 앞에 \`/user\` 라는 prefix Path 를 제거하고 uri(localhost:8080) 으로 전달합니다.

잘못된 내용이 있거나, 질문 등 편하게 댓글 부탁드립니다.

출처 : [https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/](https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/)
