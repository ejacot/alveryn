CREATE TABLE user_oauth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_oauth_identities_user
        FOREIGN KEY (user_id)
            REFERENCES user_accounts (id)
            ON DELETE CASCADE,

    CONSTRAINT ck_user_oauth_identities_provider
        CHECK (provider IN ('GOOGLE')),

    CONSTRAINT uk_user_oauth_identities_provider_subject
        UNIQUE (provider, provider_subject),

    CONSTRAINT uk_user_oauth_identities_user_provider
        UNIQUE (user_id, provider)
);

CREATE INDEX idx_user_oauth_identities_user_id
    ON user_oauth_identities (user_id);
