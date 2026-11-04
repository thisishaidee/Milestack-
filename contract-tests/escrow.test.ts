import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer");
const client = accounts.get("wallet_1");
const contributorA = accounts.get("wallet_2");
const contributorB = accounts.get("wallet_3");
const attacker = accounts.get("wallet_4");

if (!deployer || !client || !contributorA || !contributorB || !attacker) {
  throw new Error("Clarinet simnet accounts are missing");
}

const token = (name = "usdcx") => Cl.contractPrincipal(deployer, name);

function mintClient(amount: number) {
  return simnet.callPublicFn(
    "usdcx",
    "mint",
    [Cl.uint(amount), Cl.principal(client)],
    deployer
  );
}

function entries(items: Array<{ contributor: string; amount: number }>) {
  return Cl.list(
    items.map((item) =>
      Cl.tuple({
        contributor: Cl.principal(item.contributor),
        amount: Cl.uint(item.amount),
      })
    )
  );
}

function createProject(schedule: ReturnType<typeof entries>, tokenName = "usdcx") {
  return simnet.callPublicFn(
    "milestack-escrow",
    "create-and-fund",
    [token(tokenName), schedule],
    client
  );
}

function balance(owner: string) {
  return simnet.callReadOnlyFn(
    "usdcx",
    "get-balance",
    [Cl.principal(owner)],
    client
  );
}

describe("MileStack escrow", () => {
  it("escrows the exact total", () => {
    expect(mintClient(100).result).toBeOk(Cl.bool(true));
    const result = createProject(entries([
      { contributor: contributorA, amount: 40 },
      { contributor: contributorB, amount: 60 },
    ]));
    expect(result.result).toBeOk(Cl.uint(1));
    expect(balance(client).result).toBeOk(Cl.uint(0));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(100));
  });

  it("indexes funded projects by client for recovery", () => {
    expect(mintClient(30).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 10 },
    ])).result).toBeOk(Cl.uint(1));
    expect(createProject(entries([
      { contributor: contributorB, amount: 20 },
    ])).result).toBeOk(Cl.uint(2));

    const count = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-client-project-count",
      [Cl.principal(client)],
      client
    );
    const firstId = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-client-project-id",
      [Cl.principal(client), Cl.uint(0)],
      client
    );
    const secondId = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-client-project-id",
      [Cl.principal(client), Cl.uint(1)],
      client
    );
    const missingId = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-client-project-id",
      [Cl.principal(client), Cl.uint(2)],
      client
    );

    expect(count.result).toBeOk(Cl.uint(2));
    expect(firstId.result).toBeSome(Cl.uint(1));
    expect(secondId.result).toBeSome(Cl.uint(2));
    expect(JSON.stringify(missingId.result)).toContain('"type":"none"');
  });

  it("rejects empty schedules, zero amounts, and self-payment", () => {
    expect(createProject(entries([])).result).toBeErr(Cl.uint(2101));
    expect(createProject(entries([{ contributor: contributorA, amount: 0 }])).result)
      .toBeErr(Cl.uint(2102));
    expect(createProject(entries([{ contributor: client, amount: 10 }])).result)
      .toBeErr(Cl.uint(2103));
  });

  it("rejects a token other than the configured USDCx contract", () => {
    expect(createProject(
      entries([{ contributor: contributorA, amount: 10 }]),
      "fake-token"
    ).result).toBeErr(Cl.uint(2109));
  });

  it("allows only the client to approve milestone payouts", () => {
    expect(mintClient(50).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([{ contributor: contributorA, amount: 50 }])).result)
      .toBeOk(Cl.uint(1));
    const unauthorized = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(0), token()],
      attacker
    );
    expect(unauthorized.result).toBeErr(Cl.uint(2107));
    expect(balance(contributorA).result).toBeOk(Cl.uint(0));
  });

  it("pays once and refunds only the unpaid remainder", () => {
    expect(mintClient(100).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 40 },
      { contributor: contributorB, amount: 60 },
    ])).result).toBeOk(Cl.uint(1));

    const payout = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(0), token()],
      client
    );
    expect(payout.result).toBeOk(Cl.bool(true));
    expect(balance(contributorA).result).toBeOk(Cl.uint(40));

    const repeatedPayout = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(0), token()],
      client
    );
    expect(repeatedPayout.result).toBeErr(Cl.uint(2110));

    const refund = simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token()],
      client
    );
    expect(refund.result).toBeOk(Cl.uint(60));
    expect(balance(client).result).toBeOk(Cl.uint(60));
    expect(balance(contributorB).result).toBeOk(Cl.uint(0));

    const repeatedCancel = simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token()],
      client
    );
    expect(repeatedCancel.result).toBeErr(Cl.uint(2108));
  });

  it("rejects cancellation by anyone other than the client", () => {
    expect(mintClient(25).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([{ contributor: contributorA, amount: 25 }])).result)
      .toBeOk(Cl.uint(1));
    const unauthorized = simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token()],
      attacker
    );
    expect(unauthorized.result).toBeErr(Cl.uint(2107));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(25));
  });

  it("accepts the maximum schedule of 20 milestones", () => {
    expect(mintClient(20).result).toBeOk(Cl.bool(true));
    const schedule = entries(
      Array.from({ length: 20 }, () => ({
        contributor: contributorA,
        amount: 1,
      }))
    );
    expect(createProject(schedule).result).toBeOk(Cl.uint(1));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(20));
  });


  it("rejects a schedule larger than the 20-milestone contract limit", () => {
    expect(mintClient(21).result).toBeOk(Cl.bool(true));
    expect(() =>
      createProject(entries(
        Array.from({ length: 21 }, () => ({
          contributor: contributorA,
          amount: 1,
        }))
      ))
    ).toThrow();
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(0));
  });

  it("rejects reads and actions for missing projects or milestones", () => {
    const missingProject = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(999), Cl.uint(0), token()],
      client
    );
    expect(missingProject.result).toBeErr(Cl.uint(2106));

    expect(mintClient(10).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 10 },
    ])).result).toBeOk(Cl.uint(1));

    const missingMilestone = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(1), token()],
      client
    );
    expect(missingMilestone.result).toBeErr(Cl.uint(2106));

    const missingRow = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-milestone",
      [Cl.uint(999), Cl.uint(0)],
      client
    );
    expect(JSON.stringify(missingRow.result)).toContain('"type":"none"');
  });

  it("rejects the wrong token for payout and cancellation", () => {
    expect(mintClient(30).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 30 },
    ])).result).toBeOk(Cl.uint(1));

    const wrongPayoutToken = simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(0), token("fake-token")],
      client
    );
    expect(wrongPayoutToken.result).toBeErr(Cl.uint(2109));

    const wrongRefundToken = simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token("fake-token")],
      client
    );
    expect(wrongRefundToken.result).toBeErr(Cl.uint(2109));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(30));
    expect(balance(contributorA).result).toBeOk(Cl.uint(0));
  });

  it("tracks paid and cancelled milestone states after a partial refund", () => {
    expect(mintClient(100).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 40 },
      { contributor: contributorB, amount: 60 },
    ])).result).toBeOk(Cl.uint(1));

    expect(simnet.callPublicFn(
      "milestack-escrow",
      "approve-and-pay",
      [Cl.uint(1), Cl.uint(0), token()],
      client
    ).result).toBeOk(Cl.bool(true));

    const paidRow = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-milestone",
      [Cl.uint(1), Cl.uint(0)],
      client
    );
    const pendingRow = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      client
    );
    expect(JSON.stringify(paidRow.result)).toContain('"value":"1"');
    expect(JSON.stringify(pendingRow.result)).toContain('"value":"0"');

    expect(simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token()],
      client
    ).result).toBeOk(Cl.uint(60));

    const cancelledRow = simnet.callReadOnlyFn(
      "milestack-escrow",
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      client
    );
    expect(JSON.stringify(cancelledRow.result)).toContain('"value":"2"');
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(0));
  });

  it("keeps the escrow remainder exact across multiple milestone payouts", () => {
    expect(mintClient(100).result).toBeOk(Cl.bool(true));
    expect(createProject(entries([
      { contributor: contributorA, amount: 20 },
      { contributor: contributorB, amount: 30 },
      { contributor: attacker, amount: 50 },
    ])).result).toBeOk(Cl.uint(1));

    for (const index of [0, 1]) {
      expect(simnet.callPublicFn(
        "milestack-escrow",
        "approve-and-pay",
        [Cl.uint(1), Cl.uint(index), token()],
        client
      ).result).toBeOk(Cl.bool(true));
    }

    expect(balance(contributorA).result).toBeOk(Cl.uint(20));
    expect(balance(contributorB).result).toBeOk(Cl.uint(30));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(50));

    expect(simnet.callPublicFn(
      "milestack-escrow",
      "cancel-remaining",
      [Cl.uint(1), token()],
      client
    ).result).toBeOk(Cl.uint(50));

    expect(balance(client).result).toBeOk(Cl.uint(50));
    expect(balance(deployer + ".milestack-escrow").result).toBeOk(Cl.uint(0));
  });
});
