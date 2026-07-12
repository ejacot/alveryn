CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_token_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
            REFERENCES user_accounts (id)
            ON DELETE CASCADE,

    CONSTRAINT fk_refresh_tokens_replacement
        FOREIGN KEY (replaced_by_token_id)
            REFERENCES refresh_tokens (id)
            ON DELETE SET NULL,

    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),

    CONSTRAINT ck_refresh_tokens_expiry
        CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);

CREATE INDEX idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id)
            REFERENCES user_accounts (id)
            ON DELETE CASCADE,

    CONSTRAINT ck_password_reset_tokens_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT ck_password_reset_tokens_used_at
        CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE INDEX idx_password_reset_tokens_user_id
    ON password_reset_tokens (user_id);

CREATE INDEX idx_password_reset_tokens_expires_at
    ON password_reset_tokens (expires_at);
