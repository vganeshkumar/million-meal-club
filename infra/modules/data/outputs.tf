output "table_names" {
  description = "Map of logical table name -> actual DynamoDB table name, for Lambda env vars."
  value = {
    users             = aws_dynamodb_table.users.name
    donors            = aws_dynamodb_table.donors.name
    donations         = aws_dynamodb_table.donations.name
    submissions       = aws_dynamodb_table.submissions.name
    events            = aws_dynamodb_table.events.name
    signups           = aws_dynamodb_table.signups.name
    volunteers        = aws_dynamodb_table.volunteers.name
    event_signups     = aws_dynamodb_table.event_signups.name
    partner_charities = aws_dynamodb_table.partner_charities.name
    config            = aws_dynamodb_table.config.name
  }
}

output "table_arns" {
  description = "All table ARNs (including GSIs via wildcard), for the Lambda execution role's IAM policy."
  value = [
    aws_dynamodb_table.users.arn,
    "${aws_dynamodb_table.users.arn}/index/*",
    aws_dynamodb_table.donors.arn,
    "${aws_dynamodb_table.donors.arn}/index/*",
    aws_dynamodb_table.donations.arn,
    aws_dynamodb_table.submissions.arn,
    "${aws_dynamodb_table.submissions.arn}/index/*",
    aws_dynamodb_table.events.arn,
    aws_dynamodb_table.signups.arn,
    "${aws_dynamodb_table.signups.arn}/index/*",
    aws_dynamodb_table.volunteers.arn,
    "${aws_dynamodb_table.volunteers.arn}/index/*",
    aws_dynamodb_table.event_signups.arn,
    "${aws_dynamodb_table.event_signups.arn}/index/*",
    aws_dynamodb_table.partner_charities.arn,
    aws_dynamodb_table.config.arn,
  ]
}
