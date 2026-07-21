package com.alveryn.api.admin.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(FounderProperties.class)
public class FounderConfiguration {}
