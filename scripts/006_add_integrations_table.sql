-- Integration configurations for external services
CREATE TABLE IF NOT EXISTS core.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('rooms_event_hub', 'lock_provider', 'pms', 'payment_gateway')),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted secrets
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(organisation_id, integration_type, name)
);

CREATE INDEX idx_integrations_org ON core.integrations(organisation_id);
CREATE INDEX idx_integrations_type ON core.integrations(integration_type);
CREATE INDEX idx_integrations_status ON core.integrations(status);

-- Integration call logs for monitoring and debugging
CREATE TABLE IF NOT EXISTS core.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES core.integrations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  http_status_code INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_logs_integration ON core.integration_logs(integration_id);
CREATE INDEX idx_integration_logs_status ON core.integration_logs(status);
CREATE INDEX idx_integration_logs_created ON core.integration_logs(created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON core.integrations TO authenticated;
GRANT SELECT, INSERT ON core.integration_logs TO authenticated;

COMMENT ON TABLE core.integrations IS 'Third-party integration configurations (Rooms, locks, PMS)';
COMMENT ON TABLE core.integration_logs IS 'Audit log of all integration API calls';

-- Example: Insert Rooms Event Hub configuration
-- INSERT INTO core.integrations (organisation_id, integration_type, name, config, credentials) VALUES (
--   'your-org-uuid',
--   'rooms_event_hub',
--   'Zezamii Pass Production',
--   '{"base_url": "https://sender.rooms.zezamii.com/v1/webhooks", "webhook_path": "zezamiiPass/reservation"}'::jsonb,
--   '{"reservation_id_prefix": "SAMPLE"}'::jsonb
-- );
