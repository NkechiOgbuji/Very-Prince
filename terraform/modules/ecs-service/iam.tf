data "aws_iam_policy_document" "execution_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "execution_policy" {
  statement {
    sid = "CloudWatchLogsWrite"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams"
    ]
    resources = ["*"]
  }
  statement {
    sid = "ECRImagePull"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage"
    ]
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "task_policy" {
  dynamic "statement" {
    for_each = var.webhook_queue_arn == "" ? [] : [var.webhook_queue_arn]

    content {
      sid = "WebhookQueueWorker"
      actions = [
        "sqs:ChangeMessageVisibility",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:SendMessage",
      ]
      resources = [statement.value]
    }
  }

  dynamic "statement" {
    for_each = var.webhook_dlq_arn == "" ? [] : [var.webhook_dlq_arn]

    content {
      sid = "WebhookDlqWrite"
      actions = [
        "sqs:GetQueueAttributes",
        "sqs:SendMessage",
      ]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution-role"
  assume_role_policy = data.aws_iam_policy_document.execution_assume_role.json

  inline_policy {
    name   = "execution-policy"
    policy = data.aws_iam_policy_document.execution_policy.json
  }
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-task-role"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json

  inline_policy {
    name   = "task-policy"
    policy = data.aws_iam_policy_document.task_policy.json
  }
}
