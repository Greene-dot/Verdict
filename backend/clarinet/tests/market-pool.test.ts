import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// Runs against the Clarinet simnet. Install with:
//   npm install -D vitest @hirosystems/clarinet-sdk @stacks/transactions vitest-environment-clarinet
// and add a vitest.config.js pointing environment to "clarinet".

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;

const CONTRACT = "market-pool";

describe("market-pool", () => {
  beforeEach(() => {
    // Give the contract a close height comfortably in the future
    // relative to the simnet's starting block height.
    simnet.callPublicFn(CONTRACT, "set-close-height", [Cl.uint(1000)], deployer);
  });

  it("accepts a yes bet and updates the pool", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "place-bet",
      [Cl.bool(true), Cl.uint(500)],
      alice
    );
    expect(result.result).toBeOk(Cl.bool(true));

    const pools = simnet.callReadOnlyFn(CONTRACT, "get-pools", [], deployer);
    expect(pools.result).toBeOk(
      Cl.tuple({ yes: Cl.uint(500), no: Cl.uint(0) })
    );
  });

  it("rejects a bet placed after the close height", () => {
    simnet.mineEmptyBlocks(1001);
    const result = simnet.callPublicFn(
      CONTRACT,
      "place-bet",
      [Cl.bool(true), Cl.uint(500)],
      alice
    );
    expect(result.result).toBeErr(Cl.uint(100)); // ERR-MARKET-CLOSED
  });

  it("only lets the resolver resolve the market", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "resolve",
      [Cl.bool(true)],
      alice
    );
    expect(result.result).toBeErr(Cl.uint(102)); // ERR-NOT-RESOLVER
  });

  it("pays the winning side proportionally on claim", () => {
    simnet.callPublicFn(CONTRACT, "place-bet", [Cl.bool(true), Cl.uint(300)], alice);
    simnet.callPublicFn(CONTRACT, "place-bet", [Cl.bool(false), Cl.uint(700)], bob);
    simnet.callPublicFn(CONTRACT, "resolve", [Cl.bool(true)], deployer);

    const claim = simnet.callPublicFn(CONTRACT, "claim", [], alice);
    // Alice staked the entire yes pool, so she claims the full total.
    expect(claim.result).toBeOk(Cl.uint(1000));

    const bobClaim = simnet.callPublicFn(CONTRACT, "claim", [], bob);
    expect(bobClaim.result).toBeErr(Cl.uint(104)); // ERR-NO-STAKE, bob was on the losing side
  });
});
