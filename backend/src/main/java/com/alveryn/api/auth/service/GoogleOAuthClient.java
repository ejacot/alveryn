package com.alveryn.api.auth.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.alveryn.api.auth.config.GoogleOAuthProperties;
import com.alveryn.api.auth.dto.GoogleOAuthUserInfo;
import com.alveryn.api.common.exception.ValidationException;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

@Component
@RequiredArgsConstructor
public class GoogleOAuthClient {
  private final GoogleOAuthProperties properties;
  private final RestClient restClient = RestClient.create();

  public GoogleOAuthUserInfo exchangeCodeForUserInfo(String code) {
    GoogleTokenResponse token =
        restClient
            .post()
            .uri("https://oauth2.googleapis.com/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(tokenRequest(code))
            .retrieve()
            .body(GoogleTokenResponse.class);
    if (token == null || token.accessToken() == null || token.accessToken().isBlank()) {
      throw new ValidationException("Google authentication failed", "GOOGLE_OAUTH_FAILED");
    }

    GoogleUserInfoResponse user =
        restClient
            .get()
            .uri("https://openidconnect.googleapis.com/v1/userinfo")
            .headers(headers -> headers.setBearerAuth(token.accessToken()))
            .retrieve()
            .body(GoogleUserInfoResponse.class);
    if (user == null || user.sub() == null || user.email() == null) {
      throw new ValidationException("Google account details are incomplete", "GOOGLE_OAUTH_FAILED");
    }
    return new GoogleOAuthUserInfo(
        user.sub(),
        user.email(),
        Boolean.TRUE.equals(user.emailVerified()),
        user.name(),
        user.givenName(),
        user.familyName(),
        user.picture());
  }

  private LinkedMultiValueMap<String, String> tokenRequest(String code) {
    LinkedMultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("client_id", Objects.requireNonNull(properties.clientId()));
    body.add("client_secret", Objects.requireNonNull(properties.clientSecret()));
    body.add("code", code);
    body.add("grant_type", "authorization_code");
    body.add("redirect_uri", properties.redirectUri());
    return body;
  }

  private record GoogleTokenResponse(@JsonProperty("access_token") String accessToken) {}

  private record GoogleUserInfoResponse(
      String sub,
      String email,
      @JsonProperty("email_verified") Boolean emailVerified,
      String name,
      @JsonProperty("given_name") String givenName,
      @JsonProperty("family_name") String familyName,
      String picture) {}
}
