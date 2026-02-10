# Web Application Firewall (WAF) Configuration

## Overview

This document describes the WAF configuration for Clubio API protection. We support both CloudFlare and AWS WAF configurations.

## Table of Contents

1. [CloudFlare Configuration](#cloudflare-configuration)
2. [AWS WAF Configuration](#aws-waf-configuration)
3. [Custom Rules](#custom-rules)
4. [Rate Limiting](#rate-limiting)
5. [Bot Protection](#bot-protection)
6. [Monitoring & Alerts](#monitoring--alerts)

---

## CloudFlare Configuration

### Prerequisites

- CloudFlare Pro plan or higher (for WAF features)
- Domain configured with CloudFlare DNS
- API token with Zone permissions

### Setup Steps

1. **Enable WAF in CloudFlare Dashboard**
   - Navigate to Security → WAF
   - Enable "Web Application Firewall"

2. **Configure Managed Rulesets**
   ```
   Rulesets to enable:
   ├── CloudFlare Managed Ruleset (Block)
   ├── CloudFlare OWASP Core Ruleset (Block)
   ├── CloudFlare Leaked Credentials Check (Block)
   └── CloudFlare Exposed Credentials Check (Block)
   ```

3. **Apply the configuration file**: See `cloudflare-waf.json`

### CloudFlare WAF Rules Priority

| Priority | Rule | Action | Description |
|----------|------|--------|-------------|
| 1 | Allow known IPs | Allow | Whitelist for monitoring/health checks |
| 2 | Block bad bots | Block | Known malicious user agents |
| 3 | Rate limit auth | Challenge | Auth endpoint protection |
| 4 | OWASP rules | Managed | SQL injection, XSS, etc. |
| 5 | API protection | Block | Invalid content types, oversized requests |

---

## AWS WAF Configuration

### Prerequisites

- AWS WAF v2
- Application Load Balancer or API Gateway
- IAM permissions for WAF management

### Terraform Configuration

See `aws-waf.tf` for the complete Terraform configuration.

### AWS WAF Rule Groups

| Rule Group | Priority | Action | Description |
|------------|----------|--------|-------------|
| AWSManagedRulesCommonRuleSet | 1 | Block | Common attack patterns |
| AWSManagedRulesKnownBadInputsRuleSet | 2 | Block | Known bad inputs |
| AWSManagedRulesSQLiRuleSet | 3 | Block | SQL injection |
| AWSManagedRulesLinuxRuleSet | 4 | Block | Linux-specific attacks |
| CustomRateLimitRules | 5 | Block | Custom rate limiting |
| CustomAPIRules | 6 | Block | API-specific protection |

---

## Custom Rules

### 1. Authentication Endpoint Protection

```yaml
# Rate limit login attempts
- name: auth-rate-limit
  priority: 10
  condition:
    uri_path:
      contains: "/api/auth/login"
    method: POST
  action: rate_limit
  rate_limit:
    requests: 5
    period: 300  # 5 minutes
  exceeded_action: block
```

### 2. API Request Validation

```yaml
# Block requests without proper content-type
- name: require-json-content-type
  priority: 20
  condition:
    method: [POST, PUT, PATCH]
    headers:
      content-type:
        not_contains: "application/json"
  action: block

# Block oversized request bodies
- name: block-large-payloads
  priority: 21
  condition:
    body_size:
      greater_than: 1048576  # 1MB
  action: block
```

### 3. SQL Injection Protection

```yaml
# Enhanced SQLi detection for query parameters
- name: sqli-query-params
  priority: 30
  condition:
    query_string:
      matches_regex: "(?i)(union|select|insert|update|delete|drop|truncate|exec)"
  action: block
```

### 4. Path Traversal Protection

```yaml
# Block path traversal attempts
- name: path-traversal
  priority: 40
  condition:
    uri_path:
      matches_regex: "(\\.\\./|\\.\\.\\\\)"
  action: block
```

### 5. Geographic Restrictions (Optional)

```yaml
# Block traffic from high-risk countries (adjust as needed)
- name: geo-block
  priority: 100
  condition:
    geo:
      country_code:
        not_in: [US, CA, MX, ES, AR, CO, CL, PE]  # Allowed countries
  action: challenge  # or block
```

---

## Rate Limiting

### Endpoint-Specific Limits

| Endpoint Pattern | Requests | Period | Action |
|------------------|----------|--------|--------|
| `/api/auth/login` | 5 | 5 min | Block |
| `/api/auth/register` | 3 | 1 hour | Block |
| `/api/auth/password-reset` | 3 | 1 hour | Block |
| `/api/auth/pin-login` | 3 | 5 min | Block |
| `/api/auth/mfa/*` | 5 | 15 min | Block |
| `/api/*` (general) | 100 | 1 min | Challenge |

### CloudFlare Rate Limiting Rules

```json
{
  "rules": [
    {
      "description": "Login rate limit",
      "expression": "(http.request.uri.path contains \"/api/auth/login\")",
      "action": "block",
      "ratelimit": {
        "characteristics": ["ip.src"],
        "period": 300,
        "requests_per_period": 5,
        "mitigation_timeout": 600
      }
    },
    {
      "description": "Registration rate limit",
      "expression": "(http.request.uri.path contains \"/api/auth/register\")",
      "action": "block",
      "ratelimit": {
        "characteristics": ["ip.src"],
        "period": 3600,
        "requests_per_period": 3,
        "mitigation_timeout": 3600
      }
    }
  ]
}
```

---

## Bot Protection

### Good Bots (Allow List)

```yaml
allowed_bots:
  - Googlebot
  - Bingbot
  - health-check/*
  - UptimeRobot/*
  - Pingdom/*
```

### Bad Bots (Block List)

```yaml
blocked_user_agents:
  - sqlmap
  - nikto
  - nmap
  - masscan
  - zgrab
  - python-requests  # Block unless from known IPs
  - curl  # Block unless from known IPs
  - wget
  - libwww-perl
```

### Bot Score Threshold (CloudFlare)

```yaml
bot_management:
  definitely_automated:
    score_threshold: 1
    action: block
  likely_automated:
    score_threshold: 30
    action: challenge
  likely_human:
    score_threshold: 80
    action: allow
```

---

## DDoS Protection

### CloudFlare DDoS Settings

```yaml
ddos_protection:
  sensitivity: high
  ruleset: default

  layer7:
    http_flood:
      action: challenge
      threshold: adaptive

  layer4:
    enabled: true

  advanced:
    tcp_protection: enabled
    udp_protection: enabled
```

### Rate-Based Rules for DDoS Mitigation

```yaml
ddos_rate_rules:
  - name: general-flood-protection
    threshold: 1000  # requests per 10 seconds
    action: challenge

  - name: api-flood-protection
    path_prefix: /api/
    threshold: 500
    action: block
```

---

## Monitoring & Alerts

### CloudFlare Analytics

Monitor these metrics:
- Blocked requests by rule
- Rate limited requests
- Bot score distribution
- Geographic distribution of threats
- Top attacking IPs

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Blocked requests/min | 100 | 500 | Page on-call |
| Rate limit triggers/min | 50 | 200 | Investigate |
| Bot score < 30 requests | 20% | 40% | Review rules |
| 5xx errors | 1% | 5% | Check origin |

### Integration with Monitoring

```yaml
# Datadog integration example
datadog:
  api_key: ${DATADOG_API_KEY}
  metrics:
    - cloudflare.waf.blocked_requests
    - cloudflare.waf.rate_limited
    - cloudflare.firewall.events
  alerts:
    - name: high_block_rate
      query: "avg(last_5m):cloudflare.waf.blocked_requests > 500"
      priority: P2
```

---

## Maintenance Procedures

### Adding New Rules

1. Create rule in staging environment first
2. Monitor for false positives (7 days minimum)
3. Gradually increase action severity (Log → Challenge → Block)
4. Document rule purpose and expected behavior

### Reviewing Blocked Requests

1. Check CloudFlare/AWS WAF logs daily
2. Identify false positives
3. Whitelist legitimate requests if needed
4. Update rules based on new attack patterns

### Emergency Procedures

**Under Attack Mode (CloudFlare)**
```bash
# Enable Under Attack mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/security_level" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"value":"under_attack"}'
```

**Disable specific rule (emergency)**
```bash
# Override a rule that's causing false positives
curl -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/rules/${RULE_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"paused": true}'
```

---

## Appendix: Rule Testing

### Test SQL Injection Detection

```bash
# Should be blocked
curl "https://api.clubio.com/api/users?id=1' OR '1'='1"

# Should pass
curl "https://api.clubio.com/api/users?id=123"
```

### Test Rate Limiting

```bash
# Should trigger rate limit after 5 requests
for i in {1..10}; do
  curl -X POST https://api.clubio.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### Test Bot Detection

```bash
# Should be blocked (bad user agent)
curl -A "sqlmap/1.0" https://api.clubio.com/api/health

# Should pass (legitimate request)
curl -A "Mozilla/5.0" https://api.clubio.com/api/health
```
