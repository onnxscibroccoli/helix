data "archive_file" "recovery_controller" {
  type        = "zip"
  source_file = "${path.module}/recovery_controller.py"
  output_path = "${path.module}/.recovery_controller.zip"
}

data "aws_caller_identity" "current" {}

resource "aws_dynamodb_table" "origin_recovery" {
  name         = "${var.name}-origin-recovery"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = {
    Name = "${var.name}-origin-recovery"
  }
}

data "aws_iam_policy_document" "recovery_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "origin_recovery" {
  name               = "${var.name}-origin-recovery"
  assume_role_policy = data.aws_iam_policy_document.recovery_assume.json
}

data "aws_iam_policy_document" "origin_recovery" {
  statement {
    sid = "InstanceRecovery"

    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceStatus"
    ]

    resources = ["*"]
  }

  statement {
    sid = "MutateRecoveryTarget"

    actions = [
      "ec2:StartInstances",
      "ec2:RebootInstances"
    ]

    resources = [
      "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${var.recovery_instance_id}"
    ]
  }

  statement {
    sid = "RunHostGuard"

    actions = [
      "ssm:DescribeInstanceInformation",
      "ssm:SendCommand"
    ]

    resources = [
      "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
      "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${var.recovery_instance_id}"
    ]
  }

  statement {
    sid     = "StateLock"
    actions = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [
      aws_dynamodb_table.origin_recovery.arn
    ]
  }

  statement {
    sid = "Logs"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "origin_recovery" {
  name   = "${var.name}-origin-recovery"
  role   = aws_iam_role.origin_recovery.id
  policy = data.aws_iam_policy_document.origin_recovery.json
}

resource "aws_cloudwatch_log_group" "origin_recovery" {
  name              = "/aws/lambda/${var.name}-origin-recovery"
  retention_in_days = 30
}

resource "aws_lambda_function" "origin_recovery" {
  function_name    = "${var.name}-origin-recovery"
  description      = "Graduated self-healing controller for the Helix CloudFront origin"
  role             = aws_iam_role.origin_recovery.arn
  runtime          = "python3.13"
  handler          = "recovery_controller.lambda_handler"
  filename         = data.archive_file.recovery_controller.output_path
  source_code_hash = data.archive_file.recovery_controller.output_base64sha256
  timeout          = 20
  memory_size      = 256

  environment {
    variables = {
      INSTANCE_ID             = var.recovery_instance_id
      HEALTH_URL              = var.recovery_health_url
      TABLE_NAME              = aws_dynamodb_table.origin_recovery.name
      LEASE_SECONDS           = "45"
      REBOOT_COOLDOWN_SECONDS = "600"
      MEMORY_FLOOR_MB         = "256"
    }
  }

  depends_on = [
    aws_iam_role_policy.origin_recovery,
    aws_cloudwatch_log_group.origin_recovery
  ]
}

resource "aws_cloudwatch_event_rule" "origin_recovery" {
  name                = "${var.name}-origin-recovery"
  description         = "Run the Helix origin recovery controller every minute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "origin_recovery" {
  rule = aws_cloudwatch_event_rule.origin_recovery.name
  arn  = aws_lambda_function.origin_recovery.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.origin_recovery.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.origin_recovery.arn
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  alarm_name          = "${var.name}-cloudfront-5xx"
  alarm_description   = "Wake the external recovery controller when CloudFront returns a meaningful 5xx rate"
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = var.cloudfront_distribution_id
    Region         = "Global"
  }

  alarm_actions = [aws_lambda_function.origin_recovery.arn]
}

resource "aws_lambda_permission" "cloudwatch_alarm" {
  statement_id  = "AllowCloudWatchAlarmInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.origin_recovery.function_name
  principal     = "lambda.alarms.cloudwatch.amazonaws.com"
  source_arn    = aws_cloudwatch_metric_alarm.cloudfront_5xx.arn
}

output "origin_recovery_lambda" {
  value = aws_lambda_function.origin_recovery.arn
}

output "origin_recovery_table" {
  value = aws_dynamodb_table.origin_recovery.name
}

output "cloudfront_5xx_alarm" {
  value = aws_cloudwatch_metric_alarm.cloudfront_5xx.arn
}
