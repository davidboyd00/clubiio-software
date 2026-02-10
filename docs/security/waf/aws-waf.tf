# ============================================
# AWS WAF v2 CONFIGURATION FOR CLUBIO API
# ============================================
# Terraform configuration for AWS WAF WebACL
# Attach to Application Load Balancer or API Gateway

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"
}

variable "alb_arn" {
  description = "ARN of the Application Load Balancer to associate with WAF"
  type        = string
}

variable "allowed_countries" {
  description = "List of allowed country codes"
  type        = list(string)
  default     = ["US", "CA", "MX", "ES", "AR", "CO", "CL", "PE"]
}

variable "rate_limit_general" {
  description = "General API rate limit per 5 minutes"
  type        = number
  default     = 2000
}

variable "rate_limit_auth" {
  description = "Auth endpoint rate limit per 5 minutes"
  type        = number
  default     = 25
}

# Locals for resource naming
locals {
  name_prefix = "clubio-${var.environment}"
  common_tags = {
    Project     = "clubio"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "waf-security"
  }
}

# ─────────────────────────────────────────
# IP SETS
# ─────────────────────────────────────────

resource "aws_wafv2_ip_set" "blocked_ips" {
  name               = "${local.name_prefix}-blocked-ips"
  description        = "IP addresses to block"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = []

  tags = local.common_tags
}

resource "aws_wafv2_ip_set" "allowed_ips" {
  name               = "${local.name_prefix}-allowed-ips"
  description        = "Whitelisted IP addresses (monitoring, health checks)"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = []

  tags = local.common_tags
}

# ─────────────────────────────────────────
# REGEX PATTERN SETS
# ─────────────────────────────────────────

resource "aws_wafv2_regex_pattern_set" "sql_injection_patterns" {
  name        = "${local.name_prefix}-sqli-patterns"
  description = "SQL injection patterns"
  scope       = "REGIONAL"

  regular_expression {
    regex_string = "(?i)(union.*select|select.*from|insert.*into)"
  }
  regular_expression {
    regex_string = "(?i)(delete.*from|drop.*table|update.*set)"
  }
  regular_expression {
    regex_string = "(?i)(exec.*\\(|execute.*\\()"
  }

  tags = local.common_tags
}

resource "aws_wafv2_regex_pattern_set" "xss_patterns" {
  name        = "${local.name_prefix}-xss-patterns"
  description = "XSS attack patterns"
  scope       = "REGIONAL"

  regular_expression {
    regex_string = "(?i)<script[^>]*>"
  }
  regular_expression {
    regex_string = "(?i)javascript:"
  }
  regular_expression {
    regex_string = "(?i)on\\w+\\s*="
  }

  tags = local.common_tags
}

resource "aws_wafv2_regex_pattern_set" "bad_user_agents" {
  name        = "${local.name_prefix}-bad-user-agents"
  description = "Malicious user agent patterns"
  scope       = "REGIONAL"

  regular_expression {
    regex_string = "(?i)(sqlmap|nikto|nmap|masscan|zgrab)"
  }
  regular_expression {
    regex_string = "(?i)(libwww-perl|wget)"
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────
# WEB ACL
# ─────────────────────────────────────────

resource "aws_wafv2_web_acl" "main" {
  name        = "${local.name_prefix}-waf"
  description = "WAF for Clubio API"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # ─────────────────────────────────────────
  # Rule 1: Allow whitelisted IPs
  # ─────────────────────────────────────────
  rule {
    name     = "AllowWhitelistedIPs"
    priority = 1

    override_action {
      none {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.allowed_ips.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-allow-whitelist"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 2: Block blacklisted IPs
  # ─────────────────────────────────────────
  rule {
    name     = "BlockBlacklistedIPs"
    priority = 2

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocked_ips.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-block-blacklist"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 3: Block bad user agents
  # ─────────────────────────────────────────
  rule {
    name     = "BlockBadUserAgents"
    priority = 3

    action {
      block {
        custom_response {
          response_code = 403
          custom_response_body_key = "blocked"
        }
      }
    }

    statement {
      regex_pattern_set_reference_statement {
        arn = aws_wafv2_regex_pattern_set.bad_user_agents.arn
        field_to_match {
          single_header {
            name = "user-agent"
          }
        }
        text_transformation {
          priority = 0
          type     = "LOWERCASE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-block-bad-ua"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 4: AWS Managed - Common Rule Set
  # ─────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        rule_action_override {
          action_to_use {
            block {}
          }
          name = "SizeRestrictions_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-aws-common"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 5: AWS Managed - Known Bad Inputs
  # ─────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 11

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-aws-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 6: AWS Managed - SQL Injection
  # ─────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 12

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-aws-sqli"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 7: AWS Managed - Linux Rule Set
  # ─────────────────────────────────────────
  rule {
    name     = "AWSManagedRulesLinuxRuleSet"
    priority = 13

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesLinuxRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-aws-linux"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 8: Rate limit - Auth endpoints
  # ─────────────────────────────────────────
  rule {
    name     = "RateLimitAuthEndpoints"
    priority = 20

    action {
      block {
        custom_response {
          response_code = 429
          custom_response_body_key = "rate-limited"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit_auth
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/auth/"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-auth"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 9: Rate limit - General API
  # ─────────────────────────────────────────
  rule {
    name     = "RateLimitGeneralAPI"
    priority = 21

    action {
      block {
        custom_response {
          response_code = 429
          custom_response_body_key = "rate-limited"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit_general
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-general"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 10: Block path traversal
  # ─────────────────────────────────────────
  rule {
    name     = "BlockPathTraversal"
    priority = 30

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          byte_match_statement {
            search_string         = ".."
            positional_constraint = "CONTAINS"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "URL_DECODE"
            }
          }
        }
        statement {
          byte_match_statement {
            search_string         = "%2e%2e"
            positional_constraint = "CONTAINS"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-block-traversal"
      sampled_requests_enabled   = true
    }
  }

  # ─────────────────────────────────────────
  # Rule 11: Require JSON Content-Type
  # ─────────────────────────────────────────
  rule {
    name     = "RequireJSONContentType"
    priority = 40

    action {
      block {}
    }

    statement {
      and_statement {
        statement {
          byte_match_statement {
            search_string         = "/api/"
            positional_constraint = "STARTS_WITH"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "POST"
                positional_constraint = "EXACTLY"
                field_to_match {
                  method {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "PUT"
                positional_constraint = "EXACTLY"
                field_to_match {
                  method {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "PATCH"
                positional_constraint = "EXACTLY"
                field_to_match {
                  method {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
        statement {
          not_statement {
            statement {
              byte_match_statement {
                search_string         = "application/json"
                positional_constraint = "CONTAINS"
                field_to_match {
                  single_header {
                    name = "content-type"
                  }
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-require-json"
      sampled_requests_enabled   = true
    }
  }

  # Custom response bodies
  custom_response_body {
    key          = "blocked"
    content      = "{\"error\":\"ACCESS_DENIED\",\"message\":\"Request blocked by security policy\",\"code\":\"WAF_BLOCKED\"}"
    content_type = "APPLICATION_JSON"
  }

  custom_response_body {
    key          = "rate-limited"
    content      = "{\"error\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please try again later.\",\"code\":\"RATE_LIMIT_EXCEEDED\"}"
    content_type = "APPLICATION_JSON"
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

# ─────────────────────────────────────────
# ASSOCIATE WAF WITH ALB
# ─────────────────────────────────────────

resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ─────────────────────────────────────────
# CLOUDWATCH LOG GROUP FOR WAF
# ─────────────────────────────────────────

resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "aws-waf-logs-${local.name_prefix}"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn            = aws_wafv2_web_acl.main.arn

  logging_filter {
    default_behavior = "DROP"

    filter {
      behavior    = "KEEP"
      requirement = "MEETS_ANY"

      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      condition {
        action_condition {
          action = "COUNT"
        }
      }
    }
  }
}

# ─────────────────────────────────────────
# CLOUDWATCH ALARMS
# ─────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_block_rate" {
  alarm_name          = "${local.name_prefix}-waf-high-block-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 500
  alarm_description   = "High number of blocked WAF requests"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = data.aws_region.current.name
    Rule   = "ALL"
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "auth_rate_limit_triggered" {
  alarm_name          = "${local.name_prefix}-waf-auth-rate-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "Auth endpoint rate limiting triggered frequently"

  dimensions = {
    WebACL = aws_wafv2_web_acl.main.name
    Region = data.aws_region.current.name
    Rule   = "RateLimitAuthEndpoints"
  }

  tags = local.common_tags
}

# Data sources
data "aws_region" "current" {}

# ─────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────

output "web_acl_arn" {
  description = "ARN of the WAF WebACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_id" {
  description = "ID of the WAF WebACL"
  value       = aws_wafv2_web_acl.main.id
}

output "log_group_name" {
  description = "Name of the CloudWatch log group for WAF logs"
  value       = aws_cloudwatch_log_group.waf_logs.name
}
