
type EscrowFeePolicy = {
    rateBps: number;
    minFeeKobo: number;
    maxFeeKobo: number;
};

export function calculateEscrowFee(
    subtotalKobo: number,
    policy: EscrowFeePolicy,
): number {
    if (subtotalKobo <= 0) {
        throw new Error("Invalid order subtotal");
    }

    const percentageFee = Math.floor(
        (subtotalKobo * policy.rateBps) / 10_000
    );

    return Math.min(
        policy.maxFeeKobo,
        Math.max(policy.minFeeKobo, percentageFee),
    );
}

export const policy: EscrowFeePolicy = {
    rateBps: 300,        // 3%
    minFeeKobo: 3000,    // ₦30
    maxFeeKobo: 150000,  // ₦1,500
};
