package com.alveryn.api.imports.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ExcelImportProperties.class)
public class ExcelImportConfiguration {}
