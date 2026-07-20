# Very-Prince Infrastructure Architecture

## Overview

This document describes the AWS infrastructure provisioned via Terraform for the very-prince backend service and its Next.js static-asset CDN. The infrastructure enables CloudWatch log aggregation, metric alarms, dashboards, SNS alert notifications for an ECS Fargate cluster, and global delivery of immutable frontend bundles.

```mermaid
flowchart TD
    subgraph AWS["AWS us-east-1"]
        subgraph VPC["VPC"]
            subgraph Private["Private Subnets"]
                ECS["ECS Fargate Cluster\n(Container Insights Enabled)"]
                Service["ECS Service\nvery-prince-backend"]
                Task["Fargate Tasks\n(CPU: 512, Mem: 1024 MiB)"]
            end
            
            subgraph Monitoring["Monitoring"]
                CWLogs["CloudWatch Log Group\n/ecs/very-prince-backend"]
                CWDashboard["CloudWatch Dashboard"]
                CWAlerts["CloudWatch Alarms\nCPU ≥ 80%, Memory ≥ 80%"]
                SNSTopic["SNS Topic\nvery-prince-shared-critical-alerts"]
                Email["Email Subscriptions"]
            end
        end
        
        State["Terraform State\nS3 + DynamoDB"]
    end
    
    Jenkins["Jenkins Pipeline"] -->|terraform apply| State
    Browser["Browser"] -->|HTTPS /_next/static/*| CDN["CloudFront\nGlobal edge network"]
    CDN -->|OAC SigV4| Assets["Private S3 asset bucket\n_next/static/* only"]
    Service -->|awslogs driver| CWLogs
    CWLogs -->|metric filters| CWDashboard
    CWAlerts -->|alarm actions| SNSTopic
    SNSTopic -->|email| Email
    Jenkins -->|deploy| Service
```

## Components

### ECS Cluster (`terraform/modules/ecs-cluster/`)
- Fargate + Fargate Spot capacity providers
- Container Insights enabled for enhanced metrics
- Tagged with Project/Environment

### ECS Service (`terraform/modules/ecs-service/`)
- Task definition with `awslogs` log driver → CloudWatch Logs
- Execution role: CloudWatch Logs write + ECR pull
- Task role: Least-privilege application permissions
- Network: Private subnets + security group
- Optional ALB target group attachment

### CloudWatch Logs (`terraform/modules/cloudwatch-logs/`)
- Log group: `/ecs/very-prince-backend`
- 30-day retention (configurable)
- KMS encryption (AWS-managed)

### CloudWatch Alarms (`terraform/modules/cloudwatch-alarms/`)
- **CPU High**: `CPUUtilization ≥ 80%` for 2 × 60s periods
- **Memory High**: `MemoryUtilization ≥ 80%` for 2 × 60s periods
- Both route to SNS topic for notification

### CloudWatch Dashboard (`terraform/modules/cloudwatch-dashboard/`)
- Cluster CPU/Memory (stacked)
- Service CPU/Memory (lines)
- Task counts (running/pending/desired)
- Log ingestion volume & bytes

### SNS Topics (`terraform/modules/sns-topics/`)
- Topic: `very-prince-shared-critical-alerts`
- Email subscriptions from `alert_email_addresses` variable
- CloudWatch alarm publishing policy

### Asset CDN (`terraform/modules/asset-cdn/`)
- CloudFront distribution using every edge location (`PriceClass_All` by default) to minimize global static-asset latency
- CloudFront Origin Access Control (SigV4) for a private S3 origin; no S3 public access is required
- Bucket policy permits CloudFront read access only to `/_next/static/*` and only from this distribution
- `_next/static/*` uses a dedicated cache policy with a fixed one-year TTL. These paths contain Next.js content-hashed, immutable bundles.
- All other paths use a zero-TTL fallback, so immutable caching cannot be applied accidentally to mutable content.

## Data Flow

1. ECS tasks emit stdout/stderr → `awslogs` driver → CloudWatch Log Group
2. CloudWatch collects ECS CPU/Memory metrics automatically (Container Insights)
3. Alarms evaluate metrics every 60s; trigger SNS on threshold breach
4. SNS delivers to email subscribers (and any HTTPS/Lambda endpoints added manually)
5. Dashboard visualizes all metrics in single pane
6. Browser requests for `/_next/static/*` are served from the nearest CloudFront edge; cache misses are signed and fetched from the private S3 origin.

## Jenkins Pipeline (`Jenkinsfile`)
- Declarative syntax
- Stages: Setup → Init → Validate → Plan → Apply (gated)
- OS detection: `isUnix()` → `sh` on Linux, `bat` on Windows
- Artifact: `tfplan` passed between Plan/Apply

## Windows Support
- `scripts/terraform-setup.ps1`: Chocolatey/Scoop/Zip install
- No WSL required
- Jenkins pipeline uses `bat` on Windows agents
- The CDN module uses only the Terraform AWS provider and runs with the native Windows Terraform CLI; WSL is not required.

## CDN Configuration

Set `asset_bucket_name` to the existing private S3 bucket that receives the Next.js build output. Upload immutable bundles beneath `_next/static/`; the module intentionally grants CloudFront access only to that prefix. Use the `cloudfront_distribution_domain_name` Terraform output as the asset host (for example, as the Next.js `assetPrefix` origin) when deploying the frontend.

## Operations

### Accessing Dashboard
```
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=very-prince-shared-very-prince-backend
```

### Alarm Names
- `very-prince-very-prince-backend-cpu-high`
- `very-prince-very-prince-backend-memory-high`

### SNS Topic
- `very-prince-shared-critical-alerts`

### Log Group
- `/ecs/very-prince-backend`
