/**
 * Supabase Database Types
 * Auto-generated from database schema
 *
 * Usage:
 * @typedef {import('./database.types').Database} Database
 * @typedef {import('./database.types').Tables} Tables
 * @typedef {import('./database.types').Enums} Enums
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * @typedef {'pending' | 'active' | 'expired' | 'cancelled'} PassStatus
 */

/**
 * @typedef {'pending' | 'succeeded' | 'failed' | 'refunded'} PaymentStatus
 */

/**
 * @typedef {'active' | 'inactive' | 'pending' | 'suspended'} OrgSubscriptionStatus
 */

/**
 * @typedef {'pending' | 'accepted' | 'declined' | 'expired'} MembershipStatus
 */

/**
 * @typedef {'active' | 'expired' | 'cancelled' | 'pending'} LicenseStatus
 */

/**
 * @typedef {'active' | 'available' | 'occupied' | 'maintenance' | 'reserved'} LockerStatus
 */

/**
 * @typedef {'small' | 'medium' | 'large' | 'extra_large'} LockerSize
 */

/**
 * @typedef {'pending' | 'active' | 'expired' | 'cancelled' | 'completed'} AssignmentStatus
 */

/**
 * @typedef {'unlock' | 'lock' | 'status'} LockerCommandType
 */

/**
 * @typedef {'pending' | 'success' | 'failed'} CommandStatus
 */

/**
 * @typedef {'monthly' | 'annual' | 'one_time'} BillingModel
 */

/**
 * @typedef {'info' | 'warn' | 'error' | 'debug'} LogLevel
 */

/**
 * @typedef {'bypass' | 'enforce'} SecurityMode
 */

/**
 * @typedef {'org' | 'site'} FeatureScope
 */

/**
 * @typedef {'open' | 'in_progress' | 'resolved' | 'closed'} IncidentStatus
 */

/**
 * @typedef {'draft' | 'active' | 'completed' | 'archived'} SurveyStatus
 */

/**
 * @typedef {'new' | 'existing' | 'upgrade' | 'replacement'} SurveyItemIntent
 */

/**
 * @typedef {'approved' | 'rejected' | 'pending'} SurveyItemOutcome
 */

/**
 * @typedef {'image' | 'video' | 'document'} MediaKind
 */

/**
 * @typedef {'before' | 'after' | 'reference'} MediaRole
 */

/**
 * @typedef {'user' | 'org' | 'pass' | 'device' | 'payment' | 'subscription'} AuditEventType
 */

/**
 * @typedef {'general' | 'sales' | 'support' | 'partnership'} ContactTopic
 */

/**
 * @typedef {'email' | 'phone' | 'both'} ContactMethod
 */

// =============================================================================
// CORE SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} Organisation
 * @property {string} id - UUID
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [timezone]
 * @property {string} [locale]
 * @property {string} [billing_email]
 * @property {string} [custom_domain]
 * @property {Object} [brand_settings]
 * @property {Object} [agent_settings]
 * @property {Object} [usage_limits]
 * @property {Object} [current_usage]
 * @property {string} [tier_id] - UUID
 * @property {OrgSubscriptionStatus} [subscription_status]
 * @property {string} [subscription_ends_at] - ISO timestamp
 * @property {string} [default_partner_org_id] - UUID
 * @property {string} [default_partner_tier]
 * @property {boolean} [is_active]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Site
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [postal_code]
 * @property {string} [country]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Building
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} site_id - UUID
 * @property {string} name
 * @property {string} [type]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Floor
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} building_id - UUID
 * @property {string} name
 * @property {number} [level_rank]
 * @property {number} [width_pixels]
 * @property {number} [height_pixels]
 * @property {number} [width_meters]
 * @property {number} [height_meters]
 * @property {number} [orientation]
 * @property {string} [floor_plan_image]
 * @property {Object} [metadata]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Device
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [floor_id] - UUID
 * @property {string} [area_id] - UUID
 * @property {string} name
 * @property {string} [code]
 * @property {string} [slug]
 * @property {boolean} [slug_is_active]
 * @property {string} [category]
 * @property {string} [status]
 * @property {string} [serial]
 * @property {number} [lock_id]
 * @property {string} [custom_name]
 * @property {string} [custom_description]
 * @property {string} [custom_logo_url]
 * @property {string} [customer_id] - UUID
 * @property {string} [customer_name]
 * @property {string} [work_order_ref]
 * @property {string} [qr_instance_id] - UUID
 * @property {Object} [position]
 * @property {number} [rotation]
 * @property {number} [fov_angle]
 * @property {number} [fov_distance]
 * @property {boolean} [show_fov]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Area
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} floor_id - UUID
 * @property {string} name
 * @property {string} [kind]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} User
 * @property {string} id - UUID
 * @property {string} [user_uuid] - UUID (Supabase auth user)
 * @property {string} [sso_id]
 * @property {string} [default_organisation_id] - UUID
 * @property {string} [manager_id] - UUID
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id - UUID
 * @property {string} user_id - UUID
 * @property {string} [org_id] - UUID
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [display_name]
 * @property {string} [phone]
 * @property {string} [photo_url]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Membership
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} user_id - UUID
 * @property {string} role_id - UUID
 * @property {MembershipStatus} status
 * @property {string} [invited_by] - UUID
 * @property {string} [invited_at] - ISO timestamp
 * @property {string} [accepted_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Role
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} [is_system_role]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Permission
 * @property {string} id - UUID
 * @property {string} name
 * @property {string} [category]
 * @property {string} [description]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} AuditEvent
 * @property {string} id - UUID
 * @property {string} [org_id] - UUID
 * @property {string} [user_id] - UUID
 * @property {AuditEventType} event_type
 * @property {string} [resource_type]
 * @property {string} [resource_id] - UUID
 * @property {Object} [event_data]
 * @property {string} [ip_address]
 * @property {string} [user_agent]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} SystemLog
 * @property {string} id - UUID
 * @property {string} [org_id] - UUID
 * @property {LogLevel} level
 * @property {string} message
 * @property {Object} [context]
 * @property {string} [ip_address]
 * @property {string} [user_agent]
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// PASS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} Pass
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [device_id] - UUID
 * @property {string} pass_type_id - UUID
 * @property {PassStatus} status
 * @property {string} valid_from - ISO timestamp
 * @property {string} valid_to - ISO timestamp
 * @property {string} [purchaser_email]
 * @property {string} [vehicle_plate]
 * @property {boolean} [single_use]
 * @property {string} [terms_accepted_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} PassType
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} name
 * @property {string} [code]
 * @property {string} [description]
 * @property {number} duration_minutes
 * @property {number} price_cents
 * @property {string} currency
 * @property {number} [pincode_digit_length]
 * @property {string} [stripe_product_id]
 * @property {string} [stripe_price_id]
 * @property {boolean} is_active
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Payment
 * @property {string} id - UUID
 * @property {string} pass_id - UUID
 * @property {number} amount_cents
 * @property {string} currency
 * @property {string} status
 * @property {string} [stripe_payment_intent]
 * @property {string} [stripe_checkout_session]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} LockCode
 * @property {string} id - UUID
 * @property {string} pass_id - UUID
 * @property {string} [code]
 * @property {string} [code_hmac]
 * @property {string} status
 * @property {string} [provider]
 * @property {string} [provider_ref]
 * @property {string} starts_at - ISO timestamp
 * @property {string} ends_at - ISO timestamp
 * @property {string} [used_at] - ISO timestamp
 * @property {number} [attempt_count]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} AccesspointSlug
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [device_id] - UUID
 * @property {string} org_slug
 * @property {string} [site_slug]
 * @property {string} [accesspoint_slug]
 * @property {string} slug
 * @property {boolean} is_active
 * @property {string} [created_by] - UUID
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

// =============================================================================
// BILLING SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} OrgCustomer
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} stripe_customer_id
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} Subscription
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} stripe_subscription_id
 * @property {string} status
 * @property {string} [current_period_start] - ISO timestamp
 * @property {string} [current_period_end] - ISO timestamp
 * @property {boolean} [cancel_at_period_end]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} SubscriptionItem
 * @property {string} id - UUID
 * @property {string} stripe_subscription_id
 * @property {string} stripe_subscription_item_id
 * @property {string} [module_key]
 * @property {string} [sku]
 * @property {number} quantity
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

// =============================================================================
// LICENSING SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} OrgLicense
 * @property {string} org_id - UUID
 * @property {string} item_key
 * @property {LicenseStatus} status
 * @property {number} quantity
 * @property {number} [amount_cents]
 * @property {number} [rrp_cents]
 * @property {number} [net_amount_cents]
 * @property {string} [currency]
 * @property {string} [billing_model]
 * @property {string} [billing_cycle]
 * @property {string} [term]
 * @property {number} [term_length]
 * @property {string} [term_unit]
 * @property {string} [start_date] - ISO timestamp
 * @property {string} [renewal_date] - ISO timestamp
 * @property {string} [contract_end_date] - ISO date
 * @property {string} [stripe_product_id]
 * @property {string} [stripe_price_id]
 * @property {string} [package_id]
 * @property {number} [discount_percent]
 * @property {string} [discount_source]
 * @property {Object} [discount_info]
 * @property {Object} [features]
 * @property {Object} [tax_info]
 * @property {string} [partner_org_id] - UUID
 * @property {string} [partner_tier]
 * @property {number} [partner_discount_percent]
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} OrgModuleLicense
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} module_key
 * @property {string} [granted_at] - ISO timestamp
 * @property {string} [expires_at] - ISO timestamp
 * @property {Object} [org_module_answers]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} ModuleCatalog
 * @property {string} module_key
 * @property {string} name
 * @property {string} [description]
 */

/**
 * @typedef {Object} FeatureCatalog
 * @property {string} feature_key
 * @property {string} name
 * @property {string} [description]
 * @property {FeatureScope} [scope]
 */

// =============================================================================
// LOCKERS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} LockerBank
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} name
 * @property {string} [code]
 * @property {string} [description]
 * @property {Object} [rental_config]
 * @property {boolean} is_active
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 * @property {string} [deleted_at] - ISO timestamp
 */

/**
 * @typedef {Object} Locker
 * @property {string} id - UUID
 * @property {string} bank_id - UUID
 * @property {string} [device_id] - UUID
 * @property {string} locker_number
 * @property {LockerSize} size
 * @property {LockerStatus} status
 * @property {Object} [metadata]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 * @property {string} [deleted_at] - ISO timestamp
 */

/**
 * @typedef {Object} LockerAssignment
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} locker_id - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [user_id] - UUID
 * @property {string} [created_by] - UUID
 * @property {AssignmentStatus} status
 * @property {string} start_ts - ISO timestamp
 * @property {string} [end_ts] - ISO timestamp
 * @property {number} [amount_cents]
 * @property {string} [payment_intent_id]
 * @property {Object} [credential_data]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 * @property {string} [deleted_at] - ISO timestamp
 */

/**
 * @typedef {Object} LockerCommand
 * @property {string} id - UUID
 * @property {string} [assignment_id] - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [user_id] - UUID
 * @property {LockerCommandType} command_type
 * @property {CommandStatus} status
 * @property {Object} [request_payload]
 * @property {Object} [response_payload]
 * @property {string} created_at - ISO timestamp
 * @property {string} [executed_at] - ISO timestamp
 */

/**
 * @typedef {Object} LockerUserCredential
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [email]
 * @property {string} [mobile]
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [pin_hash]
 * @property {boolean} is_active
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

// =============================================================================
// ACCESS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} AccessLog
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [user_id] - UUID
 * @property {string} [credential_id] - UUID
 * @property {string} [action]
 * @property {string} [method]
 * @property {string} [provider]
 * @property {string} [platform]
 * @property {boolean} success
 * @property {string} [error_code]
 * @property {string} [error_desc]
 * @property {Object} [raw]
 * @property {string} occurred_at - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Grant
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} subject_type
 * @property {string} subject_id - UUID
 * @property {string} resource_type
 * @property {string} resource_id - UUID
 * @property {string} permission
 * @property {string} [schedule_id] - UUID
 * @property {string} [valid_from] - ISO timestamp
 * @property {string} [valid_to] - ISO timestamp
 * @property {string} [created_by] - UUID
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Schedule
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} name
 * @property {string} [description]
 * @property {string} [timezone]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Credential
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} type_id - UUID
 * @property {string} [template_id] - UUID
 * @property {string} [external_id]
 * @property {Object} [metadata]
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// EVENTS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} Incident
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [area_id] - UUID
 * @property {string} [category]
 * @property {string} [severity]
 * @property {IncidentStatus} status
 * @property {string} [summary]
 * @property {string} [details]
 * @property {string} [created_by] - UUID
 * @property {string} occurred_at - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} WebhookSubscription
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} url
 * @property {string} [secret]
 * @property {string[]} events
 * @property {string} status
 * @property {string} [description]
 * @property {string} [last_delivery_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} WebhookDelivery
 * @property {string} id - UUID
 * @property {string} subscription_id - UUID
 * @property {string} outbox_id - UUID
 * @property {string} status
 * @property {number} attempt_number
 * @property {number} [http_status_code]
 * @property {string} [response_body]
 * @property {string} [error_message]
 * @property {string} [delivered_at] - ISO timestamp
 * @property {string} [next_retry_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} EventOutbox
 * @property {string} id - UUID
 * @property {string} topic
 * @property {Object} payload
 * @property {string} [published_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// ANALYTICS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} QrScan
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [pass_id] - UUID
 * @property {string} [qr_instance_id] - UUID
 * @property {string} [slug]
 * @property {string} [source]
 * @property {string} [ip_address]
 * @property {string} [user_agent]
 * @property {boolean} [converted_to_purchase]
 * @property {string} scanned_at - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// SURVEY SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} Survey
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [building_id] - UUID
 * @property {string} [floor_id] - UUID
 * @property {string} title
 * @property {string} [kind]
 * @property {SurveyStatus} status
 * @property {string} [effective_at] - ISO timestamp
 * @property {string} [created_by]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} SurveyItem
 * @property {string} id - UUID
 * @property {string} survey_id - UUID
 * @property {string} org_id - UUID
 * @property {string} [floor_id] - UUID
 * @property {string} [area_id] - UUID
 * @property {string} [device_id] - UUID
 * @property {string} title
 * @property {string} [notes]
 * @property {string} [location_text]
 * @property {number} [x_norm]
 * @property {number} [y_norm]
 * @property {SurveyItemIntent} [intent]
 * @property {SurveyItemOutcome} [outcome]
 * @property {string} [status]
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} SurveyMedia
 * @property {string} id - UUID
 * @property {string} survey_id - UUID
 * @property {string} org_id - UUID
 * @property {string} [item_id] - UUID
 * @property {string} path
 * @property {MediaKind} kind
 * @property {MediaRole} [role]
 * @property {string} [label]
 * @property {string} [sha256]
 * @property {number} [bytes]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [status]
 * @property {string} [replaced_by] - UUID
 * @property {string} [captured_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// ROOMS SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} BookingFact
 * @property {string} booking_id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {string} [source]
 * @property {string} [reservation_id_norm]
 * @property {string} [guest_last_name_norm]
 * @property {string} [email_mask]
 * @property {string} [pin_last2]
 * @property {Uint8Array} [pin_ciphertext]
 * @property {string} [pin_expires_at] - ISO timestamp
 * @property {string} [synced_at] - ISO timestamp
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

/**
 * @typedef {Object} PinPolicy
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [site_id] - UUID
 * @property {number} pin_length
 * @property {number} [pin_ttl_hours]
 * @property {boolean} [allow_resend]
 * @property {number} [resend_cooldown_mins]
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 */

// =============================================================================
// VISION SCHEMA TABLES
// =============================================================================

/**
 * @typedef {Object} AiEvent
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} [device_id] - UUID
 * @property {string} [area_id] - UUID
 * @property {string} [model]
 * @property {number} [score]
 * @property {number} [window_ms]
 * @property {Object} payload
 * @property {string} occurred_at - ISO timestamp
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Calibration
 * @property {string} id - UUID
 * @property {string} org_id - UUID
 * @property {string} device_id - UUID
 * @property {string} [area_id] - UUID
 * @property {boolean} is_active
 * @property {string} [created_by] - UUID
 * @property {string} created_at - ISO timestamp
 */

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * @template T
 * @typedef {Partial<T>} InsertRow - Type for inserting a new row (all fields optional except required ones)
 */

/**
 * @template T
 * @typedef {Partial<T>} UpdateRow - Type for updating a row (all fields optional)
 */

/**
 * @typedef {Object} Tables
 * @property {Organisation} organisations
 * @property {Site} sites
 * @property {Building} buildings
 * @property {Floor} floors
 * @property {Device} devices
 * @property {Area} areas
 * @property {User} users
 * @property {UserProfile} user_profiles
 * @property {Membership} memberships
 * @property {Role} roles
 * @property {Permission} permissions
 * @property {Pass} passes
 * @property {PassType} pass_types
 * @property {Payment} payments
 * @property {LockCode} lock_codes
 * @property {AccesspointSlug} accesspoint_slugs
 * @property {OrgCustomer} org_customers
 * @property {Subscription} subscriptions
 * @property {SubscriptionItem} subscription_items
 * @property {OrgLicense} org_licenses
 * @property {OrgModuleLicense} org_module_licenses
 * @property {LockerBank} banks
 * @property {Locker} lockers
 * @property {LockerAssignment} assignments
 * @property {LockerCommand} commands
 * @property {LockerUserCredential} user_credentials
 * @property {AccessLog} access_logs
 * @property {Grant} grants
 * @property {Schedule} schedules
 * @property {Credential} credentials
 * @property {Incident} incidents
 * @property {WebhookSubscription} webhook_subscriptions
 * @property {WebhookDelivery} webhook_deliveries
 * @property {EventOutbox} outbox
 * @property {QrScan} qr_scans
 * @property {Survey} surveys
 * @property {SurveyItem} items
 * @property {SurveyMedia} media
 * @property {BookingFact} booking_facts
 * @property {PinPolicy} pin_policies
 * @property {AiEvent} ai_events
 * @property {Calibration} calibrations
 * @property {AuditEvent} audit_events
 * @property {SystemLog} system_logs
 */

/**
 * @typedef {Object} Enums
 * @property {PassStatus} pass_status
 * @property {PaymentStatus} payment_status
 * @property {OrgSubscriptionStatus} org_subscription_status
 * @property {MembershipStatus} membership_status
 * @property {LicenseStatus} license_status
 * @property {LockerStatus} locker_status
 * @property {LockerSize} locker_size
 * @property {AssignmentStatus} assignment_status
 * @property {LockerCommandType} locker_command_type
 * @property {CommandStatus} command_status
 * @property {BillingModel} billing_model
 * @property {LogLevel} log_level
 * @property {SecurityMode} security_mode
 * @property {FeatureScope} feature_scope
 * @property {IncidentStatus} incident_status
 * @property {SurveyStatus} survey_status
 * @property {SurveyItemIntent} survey_item_intent
 * @property {SurveyItemOutcome} survey_item_outcome
 * @property {MediaKind} media_kind
 * @property {MediaRole} media_role
 * @property {AuditEventType} audit_event_type
 * @property {ContactTopic} contact_topic
 * @property {ContactMethod} contact_method
 */

/**
 * Database type containing all schemas
 * @typedef {Object} Database
 * @property {Object} public - Public schema tables
 * @property {Object} core - Core schema tables
 * @property {Object} pass - Pass schema tables
 * @property {Object} billing - Billing schema tables
 * @property {Object} licensing - Licensing schema tables
 * @property {Object} lockers - Lockers schema tables
 * @property {Object} access - Access schema tables
 * @property {Object} events - Events schema tables
 * @property {Object} analytics - Analytics schema tables
 * @property {Object} survey - Survey schema tables
 * @property {Object} rooms - Rooms schema tables
 * @property {Object} vision - Vision schema tables
 */

// Export empty object to make this a module
export {}
