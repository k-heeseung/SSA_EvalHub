package com.example.evalhub.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI evalHubOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("EvalHub API")
                        .version("v1")
                        .description("Program screening, hackathon evaluation, evaluator assignment, PDF attachment, and scoring APIs.")
                        .license(new License().name("Internal Use")));
    }
}
