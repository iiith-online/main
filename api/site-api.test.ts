import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedAddress } from "./site-api";

test("blocks private, loopback, link-local and reserved IPv4", () => {
  for (const ip of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test("allows public IPv4", () => {
  for (const ip of [
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "100.63.255.255",
    "100.128.0.1",
    "172.15.0.1",
    "172.32.0.1",
  ]) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test("blocks IPv6 loopback, ULA, link-local, multicast and mapped v4", () => {
  for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test("allows public IPv6", () => {
  for (const ip of ["2606:4700::1111", "2001:4860:4860::8888", "2a00:1450:4001:82f::200e", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});
