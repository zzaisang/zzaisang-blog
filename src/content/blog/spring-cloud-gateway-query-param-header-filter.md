---
title: "Spring Cloud Gateway) Query Param 값을 Header 로 주입하는 Filter 만들기"
description: "MSA 환경에서 SCG(Spring Cloud Gateway) 를 이용해서 서비스별 Endpoint 로 라우팅을 주로 사용합니다. 여기에 있어 특정 Endpoint 에 대해서 HTTP 요청을 조작하고 싶을때, AbstractGatewayFilterFactory 를 상속 받은…"
pubDate: "2024-02-13T09:16:03+09:00"
updatedDate: "2024-02-16T08:19:01+09:00"
category: "Spring"
tags: ["customfilter", "kotlin", "Spring", "Spring Cloud", "spring cloud gateway"]
---
MSA 환경에서 SCG(Spring Cloud Gateway) 를 이용해서 서비스별 Endpoint 로 라우팅을 주로 사용합니다.

여기에 있어 특정 Endpoint 에 대해서 HTTP 요청을 조작하고 싶을때, AbstractGatewayFilterFactory 를 상속 받은 CustomFilter 를 등록해서 사용할 수 있습니다.   
  

아래 예제는 이메일 인증을 할때, 브라우저를 통해서 소유한 서버를 통해서 요청오는 경우입니다. 

\- Gateway 서버 : http://localhost:8000

\- 회원 서버 : http://localhost:8080  
브라우저에서 접근하기 때문에 HTTP Method 가 GET 으로 제한됩니다.   
이때문에, 인증에 필요한 정보들을 Token 정보로 담아서 Query Param 으로 추가됩니다.   
eg) 이메일 링크 주소(Gateway로 오는 주소) : GET http://localhost:8000/user/verify?token=blahblah  
Endpoint 주소 (Gateway에서 회원 서버로 보내는 주소) : POST http://localhost:8080/user/verify (Header 에 Authorization Bearer 로 Token 정보 추가) 

어떤 QueryParam 의 변수를 가져올지에 대한 paramName 과

추후에 Authorization 이라는 이름이 아닌 다른 이름으로도 Header 정보를 추가할 수 있도록 headerName  
그리고 'Bearer ' 와 같인 header Value 의 Prefix 가 존재해야할 수도 있기 때문에, nullalbe 한 값으로 headerValuePrefix 를 Config 파일의 변수들로 지정합니다.

```kotlin
import com.kotlinplayground.gateway.filter.QueryParamToHeaderGatewayFilterFactory.ParamHeaderConfig
import org.springframework.cloud.gateway.filter.GatewayFilter
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory
import org.springframework.stereotype.Component

@Component
class QueryParamToHeaderGatewayFilterFactory :
    AbstractGatewayFilterFactory<ParamHeaderConfig>(ParamHeaderConfig::class.java) {

    override fun apply(config: ParamHeaderConfig): GatewayFilter {
        return GatewayFilter { exchange, chain ->
            if (config.hasAll()) {
                val request = exchange.request

                with(request.queryParams.getFirst(config.paramName)) {
                    if(!this.isNullOrBlank()){
                        return@GatewayFilter chain.filter(
                            exchange.mutate().request(
                                request.mutate()
                                    .header(config.headerName, config.getHeaderValueWithPrefix(this))
                                    .build()
                            ).build())
                    }
                }

                chain.filter(exchange.mutate().request(request).build())
            } else {
                chain.filter(exchange)
            }
        }
    }

    data class ParamHeaderConfig(
        var paramName: String,
        var headerName: String,
        var headerValuePrefix: String? = null,
    ) {

        fun hasAll() = paramName.isNotEmpty() && headerName.isNotEmpty()

        fun getHeaderValueWithPrefix(paramValue: String): String {
            return if (headerValuePrefix?.isNotEmpty() == true) {
                "$headerValuePrefix$paramValue"
            } else {
                paramValue
            }
        }
    }
}
```

위와 같이 Custom Filter 를 추가하고 아래 처럼 yaml 파일에서 Filter 에 대해서  정의해주면 됩니다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: user-email-verify
          uri: http://localhost:8080
          predicates:
            - Path=/user/verify
            - Method=GET
            - Query=token
          filters:
            - name: QueryParamToHeader
              args:
                paramName: token
                headerName: Authorization
                headerValuePrefix: 'Bearer '
            - RemoveRequestParameter=token
            - RewritePath=/user/(?<segment>.*), /$\{segment}
```

잘못된 내용이 있거나, 질문 등 편하게 댓글 부탁드립니다.

출처 : [https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/](https://docs.spring.io/spring-cloud-gateway/docs/current/reference/html/)
