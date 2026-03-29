import assert from "node:assert/strict";
import test from "node:test";

import { updateCassandraConfig } from "../scripts/cassandra-config.mjs";

const options = {
  dataDir: "/tmp/data",
  commitlogDir: "/tmp/commitlog",
  savedCachesDir: "/tmp/saved",
  hintsDir: "/tmp/hints",
  cdcDir: "/tmp/cdc",
  host: "127.0.0.1",
  port: "9042",
};

test("updates active Cassandra yaml keys in place", () => {
  const input = `
commitlog_directory: /var/lib/cassandra/commitlog
saved_caches_directory: /var/lib/cassandra/saved_caches
hints_directory: /var/lib/cassandra/hints
cdc_raw_directory: /var/lib/cassandra/cdc_raw
listen_address: localhost
rpc_address: localhost
native_transport_port: 9042
data_file_directories:
    - /var/lib/cassandra/data
`;
  const output = updateCassandraConfig(input, options);
  assert.match(output, /^commitlog_directory: \/tmp\/commitlog$/m);
  assert.match(output, /^saved_caches_directory: \/tmp\/saved$/m);
  assert.match(output, /^hints_directory: \/tmp\/hints$/m);
  assert.match(output, /^cdc_raw_directory: \/tmp\/cdc$/m);
  assert.match(output, /^listen_address: 127\.0\.0\.1$/m);
  assert.match(output, /^rpc_address: 127\.0\.0\.1$/m);
  assert.match(output, /^native_transport_port: 9042$/m);
  assert.match(output, /^data_file_directories:\n    - \/tmp\/data$/m);
});

test("uncomments or appends Cassandra 5 style defaults when keys are commented out", () => {
  const input = `
# commitlog_directory: /var/lib/cassandra/commitlog
# saved_caches_directory: /var/lib/cassandra/saved_caches
# hints_directory: /var/lib/cassandra/hints
# cdc_raw_directory: /var/lib/cassandra/cdc_raw
listen_address: localhost
# rpc_address: localhost
native_transport_port: 9042
# data_file_directories:
#     - /var/lib/cassandra/data
`;
  const output = updateCassandraConfig(input, options);
  assert.match(output, /^commitlog_directory: \/tmp\/commitlog$/m);
  assert.match(output, /^saved_caches_directory: \/tmp\/saved$/m);
  assert.match(output, /^hints_directory: \/tmp\/hints$/m);
  assert.match(output, /^cdc_raw_directory: \/tmp\/cdc$/m);
  assert.match(output, /^rpc_address: 127\.0\.0\.1$/m);
  assert.match(output, /^data_file_directories:\n    - \/tmp\/data$/m);
});
