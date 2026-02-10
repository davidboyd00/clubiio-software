# Network Segmentation Configuration

## Overview

This document describes the network architecture and segmentation strategy for Clubio's infrastructure. Proper network segmentation isolates components to limit the blast radius of security incidents.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [VPC Configuration](#vpc-configuration)
3. [Subnet Design](#subnet-design)
4. [Security Groups](#security-groups)
5. [Network ACLs](#network-acls)
6. [Database Access](#database-access)
7. [Monitoring & Logging](#monitoring--logging)

---

## Architecture Overview

### Network Zones

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PUBLIC ZONE (DMZ)                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   CloudFlare    │  │   ALB/NLB       │  │   API Gateway   │      │
│  │   WAF + CDN     │  │   (HTTPS:443)   │  │   (Optional)    │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
└───────────┼────────────────────┼────────────────────┼───────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  APPLICATION ZONE (Private Subnet)                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   API Server    │  │   API Server    │  │   Worker        │      │
│  │   (Container)   │  │   (Container)   │  │   (Background)  │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
└───────────┼────────────────────┼────────────────────┼───────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DATA ZONE (Isolated Subnet)                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Neon DB       │  │   Redis Cache   │  │   S3 Storage    │      │
│  │   (PostgreSQL)  │  │   (Session)     │  │   (Files)       │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Zone Responsibilities

| Zone | Purpose | Internet Access | Inbound Access |
|------|---------|-----------------|----------------|
| Public (DMZ) | Edge services, load balancing | Yes | HTTPS (443) only |
| Application | API servers, workers | Outbound only (NAT) | From DMZ only |
| Data | Databases, caches, storage | None | From Application only |

---

## VPC Configuration

### Terraform VPC Module

```hcl
# infrastructure/terraform/modules/vpc/main.tf

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

locals {
  name_prefix = "clubio-${var.environment}"

  # Subnet CIDR calculations
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  data_subnets    = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${local.name_prefix}-vpc"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# NAT Gateway (one per AZ for HA)
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${local.name_prefix}-nat-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.main]
}
```

### CIDR Allocation

| Network | CIDR Block | Purpose | Usable IPs |
|---------|------------|---------|------------|
| VPC | 10.0.0.0/16 | Main VPC | 65,536 |
| Public 1 | 10.0.1.0/24 | DMZ AZ-A | 254 |
| Public 2 | 10.0.2.0/24 | DMZ AZ-B | 254 |
| Public 3 | 10.0.3.0/24 | DMZ AZ-C | 254 |
| Private 1 | 10.0.11.0/24 | App AZ-A | 254 |
| Private 2 | 10.0.12.0/24 | App AZ-B | 254 |
| Private 3 | 10.0.13.0/24 | App AZ-C | 254 |
| Data 1 | 10.0.21.0/24 | DB AZ-A | 254 |
| Data 2 | 10.0.22.0/24 | DB AZ-B | 254 |
| Data 3 | 10.0.23.0/24 | DB AZ-C | 254 |

---

## Subnet Design

### Public Subnets (DMZ)

```hcl
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Type = "public"
    Zone = "dmz"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

### Private Subnets (Application)

```hcl
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Type = "private"
    Zone = "application"
  }
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
```

### Data Subnets (Isolated)

```hcl
resource "aws_subnet" "data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.data_subnets[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${local.name_prefix}-data-${count.index + 1}"
    Type = "isolated"
    Zone = "data"
  }
}

# Data subnets have NO internet access (no route to NAT)
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.main.id

  # No routes to internet - completely isolated

  tags = {
    Name = "${local.name_prefix}-data-rt"
  }
}

resource "aws_route_table_association" "data" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data.id
}
```

---

## Security Groups

### ALB Security Group

```hcl
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # HTTPS from CloudFlare IPs only
  ingress {
    description = "HTTPS from CloudFlare"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [
      "173.245.48.0/20",
      "103.21.244.0/22",
      "103.22.200.0/22",
      "103.31.4.0/22",
      "141.101.64.0/18",
      "108.162.192.0/18",
      "190.93.240.0/20",
      "188.114.96.0/20",
      "197.234.240.0/22",
      "198.41.128.0/17",
      "162.158.0.0/15",
      "104.16.0.0/13",
      "104.24.0.0/14",
      "172.64.0.0/13",
      "131.0.72.0/22"
    ]
  }

  egress {
    description     = "To API servers"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}
```

### API Server Security Group

```hcl
resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-api-sg"
  description = "Security group for API servers"
  vpc_id      = aws_vpc.main.id

  # From ALB only
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # To database (Neon - external)
  egress {
    description = "PostgreSQL to Neon"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Neon uses various IPs
  }

  # To Redis (internal)
  egress {
    description     = "Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  # HTTPS for external services
  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-api-sg"
  }
}
```

### Redis Security Group

```hcl
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for Redis cache"
  vpc_id      = aws_vpc.main.id

  # From API servers only
  ingress {
    description     = "Redis from API"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  # No egress needed
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = []
  }

  tags = {
    Name = "${local.name_prefix}-redis-sg"
  }
}
```

### Security Group Matrix

| Source → Destination | ALB | API Server | Redis | Internet |
|----------------------|-----|------------|-------|----------|
| **Internet** | 443 (CloudFlare) | ✗ | ✗ | - |
| **ALB** | - | 3000 | ✗ | ✗ |
| **API Server** | ✗ | - | 6379 | 443, 5432 |
| **Redis** | ✗ | ✗ | - | ✗ |

---

## Network ACLs

### Public Subnet NACL

```hcl
resource "aws_network_acl" "public" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.public[*].id

  # Inbound HTTPS
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 443
    to_port    = 443
    cidr_block = "0.0.0.0/0"
  }

  # Inbound ephemeral ports (for responses)
  ingress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
  }

  # Outbound to private subnets
  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.11.0/24"
  }

  egress {
    rule_no    = 101
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.12.0/24"
  }

  egress {
    rule_no    = 102
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.13.0/24"
  }

  # Outbound ephemeral (for responses)
  egress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
  }

  tags = {
    Name = "${local.name_prefix}-public-nacl"
  }
}
```

### Private Subnet NACL

```hcl
resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  # Inbound from public subnets (ALB)
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.1.0/24"
  }

  ingress {
    rule_no    = 101
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.2.0/24"
  }

  ingress {
    rule_no    = 102
    action     = "allow"
    protocol   = "tcp"
    from_port  = 3000
    to_port    = 3000
    cidr_block = "10.0.3.0/24"
  }

  # Inbound ephemeral (for responses from internet via NAT)
  ingress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
  }

  # Outbound to data subnets (Redis)
  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.21.0/24"
  }

  egress {
    rule_no    = 101
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.22.0/24"
  }

  egress {
    rule_no    = 102
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.23.0/24"
  }

  # Outbound HTTPS (external APIs, Neon)
  egress {
    rule_no    = 200
    action     = "allow"
    protocol   = "tcp"
    from_port  = 443
    to_port    = 443
    cidr_block = "0.0.0.0/0"
  }

  # Outbound PostgreSQL (Neon)
  egress {
    rule_no    = 201
    action     = "allow"
    protocol   = "tcp"
    from_port  = 5432
    to_port    = 5432
    cidr_block = "0.0.0.0/0"
  }

  # Outbound ephemeral (for responses)
  egress {
    rule_no    = 300
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "0.0.0.0/0"
  }

  tags = {
    Name = "${local.name_prefix}-private-nacl"
  }
}
```

### Data Subnet NACL

```hcl
resource "aws_network_acl" "data" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.data[*].id

  # Inbound from private subnets only (Redis)
  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.11.0/24"
  }

  ingress {
    rule_no    = 101
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.12.0/24"
  }

  ingress {
    rule_no    = 102
    action     = "allow"
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.13.0/24"
  }

  # Block all other inbound
  ingress {
    rule_no    = 999
    action     = "deny"
    protocol   = "-1"
    from_port  = 0
    to_port    = 0
    cidr_block = "0.0.0.0/0"
  }

  # Outbound ephemeral to private subnets only
  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "10.0.11.0/24"
  }

  egress {
    rule_no    = 101
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "10.0.12.0/24"
  }

  egress {
    rule_no    = 102
    action     = "allow"
    protocol   = "tcp"
    from_port  = 1024
    to_port    = 65535
    cidr_block = "10.0.13.0/24"
  }

  # Block all other outbound
  egress {
    rule_no    = 999
    action     = "deny"
    protocol   = "-1"
    from_port  = 0
    to_port    = 0
    cidr_block = "0.0.0.0/0"
  }

  tags = {
    Name = "${local.name_prefix}-data-nacl"
  }
}
```

---

## Database Access

### Neon PostgreSQL (Managed)

Since Neon is a managed service outside our VPC:

```hcl
# Allow outbound to Neon from API servers
resource "aws_security_group_rule" "api_to_neon" {
  type              = "egress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]  # Neon IPs vary
  security_group_id = aws_security_group.api.id
  description       = "PostgreSQL to Neon"
}
```

**Neon Security Configuration:**
- Connection requires SSL (`sslmode=require`)
- IP allowlist configured in Neon dashboard
- Role-based access with least privilege

### Redis (Internal)

```hcl
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  # Enable encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = aws_subnet.data[*].id
}
```

---

## Monitoring & Logging

### VPC Flow Logs

```hcl
resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn

  tags = {
    Name = "${local.name_prefix}-flow-log"
  }
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/vpc/${local.name_prefix}/flow-logs"
  retention_in_days = 30
}

resource "aws_iam_role" "flow_log" {
  name = "${local.name_prefix}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "flow_log" {
  name = "${local.name_prefix}-flow-log-policy"
  role = aws_iam_role.flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}
```

### CloudWatch Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "rejected_connections" {
  alarm_name          = "${local.name_prefix}-rejected-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RejectedConnectionCount"
  namespace           = "AWS/NetworkELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High number of rejected connections"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}
```

---

## Verification Checklist

- [ ] VPC created with proper CIDR allocation
- [ ] Subnets created in multiple AZs
- [ ] Internet Gateway attached to VPC
- [ ] NAT Gateways deployed (one per AZ for HA)
- [ ] Security Groups configured with least privilege
- [ ] Network ACLs configured as additional layer
- [ ] VPC Flow Logs enabled
- [ ] Data subnet has no internet access
- [ ] All database traffic encrypted (TLS)
- [ ] CloudWatch alarms configured

---

## Appendix: Quick Reference

### Port Reference

| Service | Port | Protocol | Zone |
|---------|------|----------|------|
| HTTPS | 443 | TCP | Public |
| API | 3000 | TCP | Private |
| PostgreSQL | 5432 | TCP | External (Neon) |
| Redis | 6379 | TCP | Data |

### CIDR Quick Reference

```
VPC:        10.0.0.0/16
Public:     10.0.1.0/24, 10.0.2.0/24, 10.0.3.0/24
Private:    10.0.11.0/24, 10.0.12.0/24, 10.0.13.0/24
Data:       10.0.21.0/24, 10.0.22.0/24, 10.0.23.0/24
```
