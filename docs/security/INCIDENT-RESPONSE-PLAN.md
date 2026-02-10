# Incident Response Plan

## Overview

This document defines the procedures for detecting, responding to, and recovering from security incidents at Clubio. All team members should be familiar with this plan.

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Team](#response-team)
3. [Detection & Reporting](#detection--reporting)
4. [Response Procedures](#response-procedures)
5. [Communication Plan](#communication-plan)
6. [Post-Incident Activities](#post-incident-activities)
7. [Runbooks](#runbooks)
8. [Contact Information](#contact-information)

---

## Incident Classification

### Severity Levels

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| **P1** | Critical | Active breach, data loss, full outage | 15 minutes | Ransomware, data exfiltration, complete service down |
| **P2** | High | Potential breach, partial outage | 1 hour | Unauthorized access attempt, API compromise, DDoS |
| **P3** | Medium | Security weakness, degraded service | 4 hours | Vulnerability discovered, unusual activity, auth issues |
| **P4** | Low | Minor issues, informational | 24 hours | Failed login spikes, policy violations, security advisories |

### Incident Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Data Breach** | Unauthorized access to sensitive data | PII exposure, credential theft |
| **System Compromise** | Unauthorized access to systems | Malware, backdoor, privilege escalation |
| **Denial of Service** | Service unavailability | DDoS, resource exhaustion |
| **Insider Threat** | Malicious or negligent internal actions | Data theft, policy violation |
| **Account Compromise** | Unauthorized account access | Credential stuffing, phishing success |
| **Vulnerability** | Discovery of security weakness | Zero-day, CVE, misconfiguration |

---

## Response Team

### Incident Response Team (IRT)

| Role | Responsibilities | Primary | Backup |
|------|------------------|---------|--------|
| **Incident Commander** | Overall coordination, decisions | CTO | Engineering Lead |
| **Security Lead** | Technical investigation, containment | Security Engineer | Senior Developer |
| **Communications Lead** | Internal/external communications | CEO | Product Manager |
| **Operations Lead** | System recovery, monitoring | DevOps Lead | Backend Lead |
| **Legal/Compliance** | Regulatory requirements, legal issues | Legal Counsel | CEO |

### On-Call Rotation

```
Week 1: Primary - Engineer A, Backup - Engineer B
Week 2: Primary - Engineer B, Backup - Engineer C
Week 3: Primary - Engineer C, Backup - Engineer A
...
```

### Escalation Matrix

```
P4 (Low)     → On-Call Engineer
P3 (Medium)  → On-Call Engineer + Security Lead
P2 (High)    → Security Lead + Engineering Lead + Incident Commander
P1 (Critical) → Full IRT + Executive Team
```

---

## Detection & Reporting

### Detection Sources

| Source | Type | Alert Mechanism |
|--------|------|-----------------|
| CloudFlare WAF | Automated | PagerDuty |
| Application Logs | Automated | CloudWatch Alarms |
| Database Monitoring | Automated | Neon Alerts |
| User Reports | Manual | Support Tickets |
| Security Scans | Scheduled | Email + Slack |
| External Reports | Manual | security@clubio.com |

### How to Report an Incident

**For Employees:**
1. Immediately contact Security Lead via Slack #security-incidents
2. Call the security hotline if urgent: +1-XXX-XXX-XXXX
3. Email security@clubio.com with details
4. Do NOT attempt to investigate or fix without guidance

**Required Information:**
- Date/time of discovery
- Who discovered the incident
- Description of what happened
- Systems/data potentially affected
- Actions already taken
- Contact information

### Incident Intake Form

```markdown
## Incident Report

**Date/Time Discovered:** ____________________
**Reported By:** ____________________
**Contact Info:** ____________________

**Incident Summary:**
(Brief description of what happened)

**Systems Affected:**
[ ] Production API
[ ] Database
[ ] User Accounts
[ ] Internal Systems
[ ] Other: ___________

**Data Potentially Affected:**
[ ] User PII
[ ] Authentication Credentials
[ ] Payment Information
[ ] Business Data
[ ] None Known

**Current Status:**
[ ] Ongoing
[ ] Contained
[ ] Resolved

**Actions Taken:**
(List any immediate actions)

**Initial Severity Assessment:** P1 / P2 / P3 / P4
```

---

## Response Procedures

### Phase 1: Identification (0-15 minutes)

```markdown
## Identification Checklist

1. [ ] Acknowledge alert/report
2. [ ] Gather initial information
3. [ ] Assign initial severity level
4. [ ] Notify appropriate team members
5. [ ] Create incident ticket/channel
6. [ ] Begin incident log

### Incident Log Template
| Time | Action | Person | Notes |
|------|--------|--------|-------|
| 10:30 | Alert received | System | WAF blocked unusual traffic |
| 10:32 | Acknowledged | On-Call | Investigating... |
```

### Phase 2: Containment (15 min - 1 hour)

**Immediate Containment Actions:**

```bash
# Block suspicious IP
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/access_rules/rules" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -d '{"mode":"block","configuration":{"target":"ip","value":"1.2.3.4"},"notes":"Incident INC-001"}'

# Revoke compromised tokens
./scripts/security/revoke-tokens.sh --user-id USER_ID

# Enable enhanced logging
./scripts/security/enable-debug-logging.sh

# Isolate affected systems (if needed)
./scripts/security/isolate-service.sh --service api
```

**Containment Strategies by Incident Type:**

| Type | Short-term | Long-term |
|------|------------|-----------|
| Account Compromise | Disable account, revoke sessions | Password reset, MFA enforcement |
| Data Breach | Block access, preserve evidence | Patch vulnerability, encrypt data |
| DDoS | Rate limiting, WAF rules | CDN scaling, traffic scrubbing |
| Malware | Isolate system, kill processes | Reimage system, scan all hosts |

### Phase 3: Eradication (1-4 hours)

```markdown
## Eradication Checklist

1. [ ] Identify root cause
2. [ ] Remove attacker access
3. [ ] Patch vulnerabilities
4. [ ] Reset compromised credentials
5. [ ] Update security controls
6. [ ] Verify eradication complete
```

**Evidence Preservation:**

```bash
# Preserve logs before rotation
aws logs get-log-events \
  --log-group-name /clubio/api \
  --log-stream-name production \
  --start-time $(date -d '24 hours ago' +%s000) \
  --output json > incident-logs-$(date +%s).json

# Create database snapshot
neon branches create \
  --project-id $PROJECT_ID \
  --name evidence-inc-001-$(date +%s)

# Export WAF logs
./scripts/security/export-waf-logs.sh --hours 24 --output evidence/
```

### Phase 4: Recovery (4-24 hours)

```markdown
## Recovery Checklist

1. [ ] Restore from clean backups if needed
2. [ ] Verify system integrity
3. [ ] Gradually restore services
4. [ ] Monitor for re-compromise
5. [ ] Confirm normal operations
6. [ ] Close containment measures
```

**System Verification:**

```bash
# Verify application integrity
./scripts/security/integrity-check.sh

# Run security scan
./scripts/security/scan-vulnerabilities.sh

# Test authentication
./scripts/security/test-auth-flows.sh

# Verify database integrity
./scripts/database/verify-integrity.sh
```

### Phase 5: Lessons Learned (1-2 weeks)

```markdown
## Post-Incident Review

### Incident Summary
- Incident ID: INC-YYYY-NNN
- Duration: Start time - End time
- Severity: P1/P2/P3/P4
- Category: [Type]

### Timeline
| Time | Event |
|------|-------|
| ... | ... |

### Impact Assessment
- Users affected: N
- Data exposed: [Description]
- Financial impact: $X
- Reputation impact: [Assessment]

### Root Cause Analysis
**What happened:**

**Why it happened:**

**How it was detected:**

**How it was resolved:**

### Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| ... | ... | ... | ... |

### What Went Well
-

### What Could Be Improved
-

### Process Changes
-
```

---

## Communication Plan

### Internal Communication

| Audience | Method | Timing | Content |
|----------|--------|--------|---------|
| IRT | Slack #incident-[id] | Immediate | Technical updates |
| Engineering | Slack #engineering | As needed | Impact & actions |
| All Staff | Email | After containment | Summary & guidance |
| Executives | Direct call | P1/P2 only | Status & decisions |

### External Communication

| Audience | Method | Timing | Owner |
|----------|--------|--------|-------|
| Affected Users | Email | After containment | Communications Lead |
| All Users | Status page | During incident | Operations Lead |
| Media | Press release | If newsworthy | CEO |
| Regulators | Official report | Within 72 hours* | Legal/Compliance |

*GDPR requires notification within 72 hours of becoming aware of a breach

### Communication Templates

**User Notification (Data Breach):**
```
Subject: Important Security Notice - Action Required

Dear [User],

We are writing to inform you of a security incident that may have affected your account.

**What Happened:**
On [date], we detected [brief description].

**What Information Was Involved:**
[List of data types]

**What We Are Doing:**
[Actions taken]

**What You Can Do:**
1. Change your password
2. Enable two-factor authentication
3. Monitor your account for suspicious activity

**For More Information:**
Contact our support team at support@clubio.com

We sincerely apologize for this incident.

[Signature]
```

**Status Page Update:**
```
[INVESTIGATING] We are investigating reports of [issue]
[IDENTIFIED] The issue has been identified. We are working on a fix.
[MONITORING] A fix has been implemented. We are monitoring.
[RESOLVED] This incident has been resolved.
```

---

## Post-Incident Activities

### 30-Day Review Cycle

| Day | Activity |
|-----|----------|
| 1-3 | Incident documentation, evidence preservation |
| 4-7 | Root cause analysis, timeline construction |
| 8-14 | Post-incident review meeting |
| 15-21 | Implement immediate fixes |
| 22-30 | Policy/procedure updates, training |

### Metrics to Track

| Metric | Target | Calculation |
|--------|--------|-------------|
| MTTD (Mean Time to Detect) | < 1 hour | Time from attack start to detection |
| MTTR (Mean Time to Respond) | < 30 min | Time from detection to first response |
| MTTC (Mean Time to Contain) | < 4 hours | Time from detection to containment |
| MTTR (Mean Time to Recover) | < 24 hours | Time from containment to full recovery |

---

## Runbooks

### Runbook: Account Takeover (ATO)

```markdown
## Severity: P2

### Indicators
- Multiple password reset requests
- Login from unusual location
- Unusual account activity
- User reports unauthorized access

### Immediate Actions
1. Disable affected account(s)
   ```bash
   ./scripts/security/disable-account.sh --user-id USER_ID --reason "ATO Investigation"
   ```

2. Revoke all sessions
   ```bash
   ./scripts/security/revoke-sessions.sh --user-id USER_ID
   ```

3. Block suspicious IPs
   ```bash
   ./scripts/security/block-ip.sh --ip X.X.X.X
   ```

### Investigation
1. Review authentication logs
2. Identify attack vector (credential stuffing, phishing, etc.)
3. Check for data access during compromise period
4. Identify other potentially affected accounts

### Recovery
1. Reset user password
2. Require MFA setup
3. Notify user with guidance
4. Monitor for re-compromise

### Prevention
- Implement additional login protections
- Review rate limiting effectiveness
- Consider credential breach monitoring
```

### Runbook: DDoS Attack

```markdown
## Severity: P1/P2

### Indicators
- Sudden traffic spike
- Service degradation/unavailability
- WAF blocking high request volume
- CPU/memory exhaustion

### Immediate Actions
1. Enable CloudFlare Under Attack Mode
   ```bash
   ./scripts/security/cloudflare-under-attack.sh --enable
   ```

2. Scale infrastructure
   ```bash
   ./scripts/infra/scale-up.sh --service api --replicas 10
   ```

3. Implement emergency rate limits
   ```bash
   ./scripts/security/emergency-rate-limit.sh --rps 10
   ```

### Investigation
1. Analyze attack patterns
2. Identify attack sources
3. Classify attack type (volumetric, application, protocol)

### Recovery
1. Gradually reduce defenses
2. Monitor for attack resumption
3. Return to normal scaling

### Prevention
- Review DDoS mitigation strategy
- Consider dedicated DDoS protection
- Implement better traffic analysis
```

### Runbook: Data Breach

```markdown
## Severity: P1

### Indicators
- Unauthorized data access detected
- Data exfiltration alerts
- External notification of breach
- Unusual database queries

### Immediate Actions
1. **PRESERVE EVIDENCE FIRST**
   ```bash
   ./scripts/security/preserve-evidence.sh --incident INC-XXX
   ```

2. Block attacker access
   ```bash
   ./scripts/security/revoke-api-keys.sh --compromised
   ./scripts/security/block-suspicious-ips.sh
   ```

3. Secure affected systems
   ```bash
   ./scripts/security/lockdown-database.sh
   ```

### Legal Requirements
- [ ] Notify legal/compliance team
- [ ] Determine regulatory obligations (GDPR: 72hr, CCPA, etc.)
- [ ] Document everything for potential investigation

### Investigation
1. Identify breach scope (what data, how much, whose)
2. Determine attack vector
3. Identify dwell time (how long was attacker in system)
4. Assess data sensitivity

### Notification Requirements
| Regulation | Requirement | Timeline |
|------------|-------------|----------|
| GDPR | Supervisory authority + affected users | 72 hours |
| CCPA | California residents | "Most expedient time" |
| HIPAA | HHS + affected individuals | 60 days |

### Recovery
1. Patch vulnerability
2. Reset all potentially compromised credentials
3. Implement additional monitoring
4. Conduct security audit
```

---

## Contact Information

### Internal Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Security Lead | [Name] | +1-XXX-XXX-XXXX | security-lead@clubio.com |
| CTO | [Name] | +1-XXX-XXX-XXXX | cto@clubio.com |
| CEO | [Name] | +1-XXX-XXX-XXXX | ceo@clubio.com |
| On-Call | Rotating | +1-XXX-XXX-XXXX | oncall@clubio.com |

### External Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| CloudFlare Support | support.cloudflare.com | WAF/DDoS assistance |
| Neon Support | support@neon.tech | Database issues |
| AWS Support | AWS Console | Infrastructure issues |
| Legal Counsel | [Firm Name] | Legal guidance |
| Cyber Insurance | [Carrier] | Claim reporting |
| FBI IC3 | ic3.gov | Cybercrime reporting |

### Security Email

```
security@clubio.com - For external security reports
security-incidents@clubio.com - Internal incident reporting (monitored 24/7)
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-XX | Security Team | Initial version |

**Review Schedule:** Quarterly
**Next Review:** [Date]
**Owner:** Security Lead
