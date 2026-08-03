# DynamoDB tables, all on-demand (PAY_PER_REQUEST) — zero idle cost, matches
# specs/00-constitution.md §3. See specs/01-architecture.md for the table
# shapes this implements.

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "identity_key"
    type = "S"
  }

  global_secondary_index {
    name            = "identity-index"
    hash_key        = "identity_key"
    projection_type = "ALL"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "donors" {
  name         = "${local.name_prefix}-donors"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "donor_id"

  attribute {
    name = "donor_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  # Matches a later OAuth sign-in to the donor record an admin approved —
  # see specs/features/007-donor-application-approval/design.md
  # ("find-or-claim-or-deny"). `email` is internal-only, never returned by
  # the public API.
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "donations" {
  name         = "${local.name_prefix}-donations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "donor_id"
  range_key    = "donation_id"

  attribute {
    name = "donor_id"
    type = "S"
  }
  attribute {
    name = "donation_id"
    type = "S"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "submissions" {
  name         = "${local.name_prefix}-submissions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "submission_id"

  attribute {
    name = "submission_id"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "events" {
  name         = "${local.name_prefix}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "signups" {
  name         = "${local.name_prefix}-signups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "signup_id"

  attribute {
    name = "signup_id"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }

  # Donor entries only (requested_signoff/approved/rejected) — volunteer
  # entries have no status and aren't returned by this index. See
  # specs/features/007-donor-application-approval/design.md.
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  tags = var.tags
}

# Mirrors `donors` exactly (email-index/user-index claim mechanism) but
# with no approval gate — created immediately at signup, not on admin
# approval. See specs/features/008-persona-dashboards-and-roles/design.md.
resource "aws_dynamodb_table" "volunteers" {
  name         = "${local.name_prefix}-volunteers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "volunteer_id"

  attribute {
    name = "volunteer_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = var.tags
}

# A volunteer's RSVP to an event. event-index is reserved for a future
# admin headcount view (unused today). See
# specs/features/008-persona-dashboards-and-roles/design.md.
resource "aws_dynamodb_table" "event_signups" {
  name         = "${local.name_prefix}-event-signups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "volunteer_id"
  range_key    = "event_id"

  attribute {
    name = "volunteer_id"
    type = "S"
  }
  attribute {
    name = "event_id"
    type = "S"
  }

  global_secondary_index {
    name            = "event-index"
    hash_key        = "event_id"
    projection_type = "ALL"
  }

  tags = var.tags
}

# A donor's own pre-scheduled delivery, optionally assigned to a specific
# volunteer — distinct from `events`/`event_signups` above (the site-wide
# packing-drive calendar). See
# specs/features/009-scheduled-donation-events/design.md.
resource "aws_dynamodb_table" "donation_events" {
  name         = "${local.name_prefix}-donation-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }
  attribute {
    name = "donor_id"
    type = "S"
  }
  attribute {
    name = "volunteer_id"
    type = "S"
  }

  global_secondary_index {
    name            = "donor-index"
    hash_key        = "donor_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "volunteer-index"
    hash_key        = "volunteer_id"
    projection_type = "ALL"
  }

  tags = var.tags
}

# Admin-editable content (founder adds/edits directly for now, same as
# `events` — no dedicated admin endpoint yet). See
# specs/features/006-partner-charities/design.md.
resource "aws_dynamodb_table" "partner_charities" {
  name         = "${local.name_prefix}-partner-charities"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "charity_id"

  attribute {
    name = "charity_id"
    type = "S"
  }

  tags = var.tags
}

# Single-item table: one row keyed pk="site" holding totals/milestones/theme.
# Founder-editable via POST /api/admin/config without a code deploy.
resource "aws_dynamodb_table" "config" {
  name         = "${local.name_prefix}-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = var.tags
}
