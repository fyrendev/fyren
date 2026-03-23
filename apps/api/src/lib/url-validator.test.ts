import { describe, test, expect } from "bun:test";
import { isBlockedIP, isBlockedIPv4, isBlockedIPv6 } from "./url-validator";

describe("isBlockedIPv4", () => {
  test("blocks loopback addresses", () => {
    expect(isBlockedIPv4("127.0.0.1")).toBe(true);
    expect(isBlockedIPv4("127.255.255.255")).toBe(true);
  });

  test("blocks 10.0.0.0/8 private range", () => {
    expect(isBlockedIPv4("10.0.0.1")).toBe(true);
    expect(isBlockedIPv4("10.255.255.255")).toBe(true);
  });

  test("blocks 172.16.0.0/12 private range", () => {
    expect(isBlockedIPv4("172.16.0.1")).toBe(true);
    expect(isBlockedIPv4("172.31.255.255")).toBe(true);
  });

  test("allows 172.x outside /12 range", () => {
    expect(isBlockedIPv4("172.15.0.1")).toBe(false);
    expect(isBlockedIPv4("172.32.0.1")).toBe(false);
  });

  test("blocks 192.168.0.0/16 private range", () => {
    expect(isBlockedIPv4("192.168.0.1")).toBe(true);
    expect(isBlockedIPv4("192.168.255.255")).toBe(true);
  });

  test("blocks link-local / IMDS range (169.254.x.x)", () => {
    expect(isBlockedIPv4("169.254.169.254")).toBe(true);
    expect(isBlockedIPv4("169.254.0.1")).toBe(true);
  });

  test("blocks unspecified address range", () => {
    expect(isBlockedIPv4("0.0.0.0")).toBe(true);
  });

  test("allows public IPs", () => {
    expect(isBlockedIPv4("8.8.8.8")).toBe(false);
    expect(isBlockedIPv4("1.1.1.1")).toBe(false);
    expect(isBlockedIPv4("203.0.113.1")).toBe(false);
  });
});

describe("isBlockedIPv6", () => {
  test("blocks IPv6 loopback", () => {
    expect(isBlockedIPv6("::1")).toBe(true);
  });

  test("blocks IPv4-mapped IPv6 loopback", () => {
    expect(isBlockedIPv6("::ffff:127.0.0.1")).toBe(true);
  });

  test("blocks link-local IPv6", () => {
    expect(isBlockedIPv6("fe80::1")).toBe(true);
  });

  test("blocks unique local IPv6 (fc00::/7)", () => {
    expect(isBlockedIPv6("fc00::1")).toBe(true);
    expect(isBlockedIPv6("fd00::1")).toBe(true);
  });

  test("allows public IPv6", () => {
    expect(isBlockedIPv6("2001:db8::1")).toBe(false);
  });
});

describe("isBlockedIP", () => {
  test("detects both IPv4 and IPv6 private ranges", () => {
    expect(isBlockedIP("127.0.0.1")).toBe(true);
    expect(isBlockedIP("::1")).toBe(true);
    expect(isBlockedIP("8.8.8.8")).toBe(false);
  });
});
