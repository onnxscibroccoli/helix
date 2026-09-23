data "aws_availability_zones" "available" { state = "available" }
data "aws_ssm_parameter" "ubuntu_2404" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}
resource "aws_vpc" "helix" {
  cidr_block = "10.42.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  tags = { Name = "${var.name}-vpc" }
}
resource "aws_internet_gateway" "helix" {
  vpc_id = aws_vpc.helix.id
  tags = { Name = "${var.name}-igw" }
}
resource "aws_subnet" "public" {
  vpc_id = aws_vpc.helix.id
  cidr_block = "10.42.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = { Name = "${var.name}-public" }
}
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.helix.id
  route { cidr_block = "0.0.0.0/0" gateway_id = aws_internet_gateway.helix.id }
}
resource "aws_route_table_association" "public" {
  subnet_id = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
resource "aws_security_group" "desktop" {
  name = "${var.name}-sg"
  description = "Helix authenticated gateway"
  vpc_id = aws_vpc.helix.id
  ingress {
    description = "HTTPS/WebSocket gateway"
    protocol = "tcp"
    from_port = 443
    to_port = 443
    cidr_blocks = [var.allowed_gateway_cidr]
  }
  egress {
    protocol = "-1"
    from_port = 0
    to_port = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_iam_role" "helix" {
  name = "${var.name}-ssm-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role = aws_iam_role.helix.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "helix" {
  name = "${var.name}-profile"
  role = aws_iam_role.helix.name
}
resource "aws_instance" "hypervisor" {
  ami = data.aws_ssm_parameter.ubuntu_2404.value
  instance_type = var.instance_type
  subnet_id = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.desktop.id]
  iam_instance_profile = aws_iam_instance_profile.helix.name
  cpu_options { nested_virtualization = "enabled" }
  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size
    encrypted = true
    delete_on_termination = true
  }
  user_data = file("${path.module}/user-data.sh")
  user_data_replace_on_change = true
  tags = { Name = "${var.name}-hypervisor", HelixRole = "persistent-cloud-desktop" }
}
resource "aws_ebs_volume" "persistent" {
  availability_zone = aws_instance.hypervisor.availability_zone
  size = var.persistent_volume_size
  type = "gp3"
  encrypted = true
  tags = { Name = "${var.name}-persistent" }
}
resource "aws_volume_attachment" "persistent" {
  device_name = "/dev/sdf"
  volume_id = aws_ebs_volume.persistent.id
  instance_id = aws_instance.hypervisor.id
  stop_instance_before_detaching = true
}
output "instance_id" { value = aws_instance.hypervisor.id }
output "public_ip" { value = aws_instance.hypervisor.public_ip }
output "persistent_volume_id" { value = aws_ebs_volume.persistent.id }
output "ssm_role" { value = aws_iam_role.helix.arn }
