package com.ubs.testmanagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/app/EO7/api/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*");

                registry.addMapping("/api/v1/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*");

                registry.addMapping("/summary")
                    .allowedOrigins("*")
                    .allowedMethods("GET", "OPTIONS")
                    .allowedHeaders("*");

                registry.addMapping("/trends/**")
                    .allowedOrigins("*")
                    .allowedMethods("GET", "OPTIONS")
                    .allowedHeaders("*");
            }
        };
    }
}
