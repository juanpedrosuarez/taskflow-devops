locals {
  name = "${var.project_name}-${var.environment}"
}

# ---------------------------------------------------------------- Rede
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${local.name}-vpc" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------- Segurança
resource "aws_security_group" "app" {
  name        = "${local.name}-app-sg"
  description = "HTTP publico e SSH restrito"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH somente da faixa autorizada"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    description = "Saida liberada (baixar imagens e pacotes)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_key_pair" "deploy" {
  count      = var.ssh_public_key == "" ? 0 : 1
  key_name   = "${local.name}-deploy"
  public_key = var.ssh_public_key
}

# ---------------------------------------------------------------- Permissões (SSM + CloudWatch)
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${local.name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.name}-ec2-profile"
  role = aws_iam_role.app.name
}

# ---------------------------------------------------------------- Logs
resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.project_name}/${var.environment}/app"
  retention_in_days = var.log_retention_days
}

# ---------------------------------------------------------------- Servidor
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  key_name               = var.ssh_public_key == "" ? null : aws_key_pair.deploy[0].key_name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    app_image  = var.app_image
    log_group  = aws_cloudwatch_log_group.app.name
    aws_region = var.aws_region
  })
  user_data_replace_on_change = true

  metadata_options {
    http_tokens = "required" # IMDSv2
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = "${local.name}-app" }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${local.name}-eip" }
}

# ---------------------------------------------------------------- Monitoramento
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${local.name}-cpu-alta"
  alarm_description   = "CPU acima de 80% por 10 minutos"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.app.id }
}

resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "${local.name}-status-check"
  alarm_description   = "Instância falhou no status check"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.app.id }
}
