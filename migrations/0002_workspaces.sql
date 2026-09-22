create table if not exists workspaces (
  id text primary key,
  user_id text not null,
  name text not null,
  kind text not null,
  kernel text not null default '6.8.0-47-generic',
  status text not null default 'stopped',
  vcpus integer not null default 4,
  memory_gb integer not null default 8,
  volume_gb integer not null default 200,
  host_node text not null default 'hypervisor-node-01',
  ipv4 text,
  canary_hash text,
  created_at timestamptz not null default now(),
  last_boot_at timestamptz,
  session_count integer not null default 0
);
create index if not exists workspaces_user_id_idx on workspaces (user_id);

create table if not exists workspace_files (
  id serial primary key,
  workspace_id text not null,
  user_id text not null,
  path text not null,
  content text not null default '',
  is_dir boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (workspace_id, path)
);
create index if not exists workspace_files_ws_idx on workspace_files (workspace_id);

create table if not exists workspace_events (
  id serial primary key,
  workspace_id text not null,
  user_id text not null,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists workspace_events_ws_idx on workspace_events (workspace_id);
