# Sui DeFi security first principles

## Scope and conclusion

This note derives reusable DeFi rules from first-party protocol documentation and source. The source snapshots are Sui [`60f0e8a6`](https://github.com/MystenLabs/sui/tree/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03), Aptos [`0dfe6f57`](https://github.com/aptos-labs/aptos-core/tree/0dfe6f57be955b77180fc799bbfdb8758ab8dfee), DeepBook V3 [`1c0b5555`](https://github.com/MystenLabs/deepbookv3/tree/1c0b5555bb333010abf63aa6e1ce437653f26795), Sushi MasterChef [`4153a98c`](https://github.com/sushiswap/masterchef/tree/4153a98c34e06ee3c373fcff566d1048dcd01666), Uniswap V2 Core [`6a9e7c97`](https://github.com/Uniswap/v2-core/tree/6a9e7c97860676e0992f22a49665760444c1cdf5), and Solana Foundation Rewards [`20522ed0`](https://github.com/solana-foundation/rewards/tree/20522ed0bf7a514fcd50f872de90179e0dbbefe6).

The central rule is that temporary capital and arbitrary composition are normal inputs, not exceptional attacks. Security comes from enforcing the correct final ownership, solvency, exchange-rate, and entitlement invariants for every public transition. It does not come from assuming a caller held capital before the transaction, that calls occur alone, or that a favorable ordering will be used.

## PTBs and flash-profit sequences

Sui PTB commands execute in order, can feed one command's result into the next, and commit atomically; one PTB can contain up to 1,024 operations ([Sui PTB semantics](https://docs.sui.io/develop/transactions/ptbs/prog-txn-blocks)). Mysten's flash-lender example makes same-transaction liquidity explicit: a non-droppable, non-storable receipt forces repayment to the originating lender before a transaction can succeed ([receipt design](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/examples/move/flash_lender/sources/example.move#L21-L34), [loan and repayment checks](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/examples/move/flash_lender/sources/example.move#L82-L110)).

Therefore every economic entry point must remain safe in a sequence such as:

1. borrow temporary capital;
2. change a pool balance, spot price, share rate, or reward checkpoint;
3. call the target transition one or more times;
4. reverse the temporary market change;
5. repay and keep the extracted value.

The target must validate the proposed final state and authoritative asset deltas, not the caller's apparent wealth or a transient balance observed earlier in the PTB. A price used for collateral, liquidation, minting, or rewards must not be manipulable through another command in that same economic domain. Sui's oracle guidance specifically identifies single-instant manipulation windows and recommends averaging, independent sources, confidence checks, and deviation bounds; collateral should be valued conservatively and liquidation must use checked, fresh data ([oracle failure modes and consumer rules](https://docs.sui.io/onchain-finance/oracles/oracle-safety)). User-funded swaps and liquidity changes also need signer-approved minimum output, maximum input, and deadlines.

Test the complete profitable sequence, not just isolated calls. Include repeated calls to the same shared object, opposite-direction swaps, temporary liquidity, self-trades where applicable, oracle update then consume, and abort/retry boundaries. Atomic rollback prevents partial state, but it does not prevent profit when the attacker's whole sequence satisfies the program's incomplete checks.

## Reward and farm checkpointing

For an index-based farm, let `I` be cumulative reward per eligible stake unit and let a position store `amount`, `paid_index`, and optionally carried `accrued`. Its unclaimed reward is derived from the old position:

`accrued + amount * (I - paid_index)`

Every deposit, withdrawal, transfer of earning stake, claim, reward-rate change, fee change, or eligibility change follows one order:

1. advance the global index through the transition time using the **old eligible supply**;
2. settle the affected position using its **old amount and checkpoint**;
3. mutate stake, supply, or terms;
4. write the new checkpoint from the post-transition amount and current index.

MasterChef implements this order for deposits and withdrawals: it updates the pool, pays reward calculated from the old amount and debt, changes stake, then resets reward debt ([index and pending formula](https://github.com/sushiswap/masterchef/blob/4153a98c34e06ee3c373fcff566d1048dcd01666/contracts/MasterChef.sol#L177-L199), [deposit and withdrawal ordering](https://github.com/sushiswap/masterchef/blob/4153a98c34e06ee3c373fcff566d1048dcd01666/contracts/MasterChef.sol#L233-L269)). Aptos independently settles existing delegator rewards before minting commission shares, because minting first would let the new shares earn rewards they did not own; it also applies the next commission only after this synchronization ([Aptos synchronization](https://github.com/aptos-labs/aptos-core/blob/0dfe6f57be955b77180fc799bbfdb8758ab8dfee/aptos-move/framework/aptos-framework/sources/delegation_pool.move#L1915-L1993)).

The zero-supply case is policy, not an arithmetic accident. Reject or return new rewards, escrow them for a named future domain, or advance time without allocating them. Do not leave a backlog for the next first depositor: MasterChef advances its last-reward block and allocates nothing when supply is zero ([zero-supply branch](https://github.com/sushiswap/masterchef/blob/4153a98c34e06ee3c373fcff566d1048dcd01666/contracts/MasterChef.sol#L209-L230)). Likewise, stake added after a reward interval begins must not earn that earlier interval. Aptos explicitly prevents pending stake from stealing rewards from already-active stake ([pending-stake analysis](https://github.com/aptos-labs/aptos-core/blob/0dfe6f57be955b77180fc799bbfdb8758ab8dfee/aptos-move/framework/aptos-framework/sources/delegation_pool.move#L686-L708)).

Claims need a durable, domain-complete checkpoint keyed by the reward program or epoch, pool or position, reward asset, and claimant wherever those dimensions vary. Claimed amounts or nonces must move monotonically. The Solana Foundation rewards program derives a claim account from distribution plus claimant, computes unlocked minus already claimed, records both claim and distribution totals, and only then transfers ([claim processor](https://github.com/solana-foundation/rewards/blob/20522ed0bf7a514fcd50f872de90179e0dbbefe6/program/src/instructions/merkle/claim/processor.rs#L31-L117)). A second call in the same PTB must see the first call's checkpoint and receive no duplicate entitlement.

A useful conservation equation is:

`funded rewards = paid rewards + outstanding claimable liability + assigned dust + returned remainder`

Do not use the reward vault's current balance as the sole liability record; top-ups, donations, shortages, or multiple reward domains can make balance and ownership diverge.

## LST and share exchange rates

A share pool needs canonical `accounted_assets` and `total_shares`. Deposits mint against the exchange rate immediately before that deposit, after all rewards, losses, fees, and pending withdrawals belonging to the old supply have been recognized. Withdrawals burn the shares required at the pre-withdraw rate. Admin capital injections and slashing must change share value without secretly minting ownership.

Sui's staking pool makes epoch eligibility explicit: new stake is pending and starts counting only in the next epoch ([stake request](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-system/sources/staking_pool.move#L132-L151)). At an epoch boundary, rewards are deposited before pending stake is converted at the latest exchange rate, then a new rate is recorded and checked against pool balances ([reward and pending-stake processing](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-system/sources/staking_pool.move#L347-L414)). This prevents next-epoch stake from sharing the previous epoch's reward.

The empty-pool rate must be protocol-defined. Sui staking uses a 1:1 conversion when either side is zero, including one-sided dust, and checks that the recorded rate reproduces the actual pool-token balance ([conversion and invariant](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-system/sources/staking_pool.move#L643-L676)). Other designs can use virtual assets and shares, permanently locked minimum liquidity, or an authenticated seed, but must not let the first depositor choose a rate that makes later deposits mint zero or negligible shares. OpenZeppelin's first-party ERC-4626 analysis demonstrates how an empty vault plus a direct donation can shift the rate and round a victim to zero, and explains the virtual-offset defense ([inflation attack and defense](https://docs.openzeppelin.com/contracts/4.x/erc4626#defending_with_a_virtual_offset)).

On Sui, do not copy the EVM donation threat literally. A caller cannot mutate another module's private `Balance<T>` field, and transferring a `Coin<T>` object to an object's address makes that coin inaccessible rather than merging it into the recipient object's inner balance ([Sui transfer behavior](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-framework/sources/transfer.move#L47-L64)). The manipulation exists only if the protocol exposes a donation or capital-injection path, receives child objects, or otherwise includes unsolicited value in `accounted_assets`. Audit those concrete paths while retaining the first-depositor and zero-share protections.

## AMM and lending solvency

An AMM swap must derive input from authoritative custody changes, apply fees in the invariant, bound output by available reserves, and update canonical reserves from final balances. Uniswap V2's pair computes actual input from post-transfer balances and requires the fee-adjusted product not to fall below the prior reserve product ([swap invariant](https://github.com/Uniswap/v2-core/blob/6a9e7c97860676e0992f22a49665760444c1cdf5/contracts/UniswapV2Pair.sol#L158-L186)). Its bootstrap permanently locks minimum liquidity, later mints proportionally to both reserves, and rejects a zero-liquidity mint ([liquidity minting](https://github.com/Uniswap/v2-core/blob/6a9e7c97860676e0992f22a49665760444c1cdf5/contracts/UniswapV2Pair.sol#L109-L130)). For another curve, replace `x*y=k` with that curve's proved post-trade invariant; do not merely check that tokens were returned.

A lending market must keep cash, supplier claims, debt principal, accrued interest, protocol fees, reserves, and recognized bad debt in one reconciliation model. Before minting supply or debt shares, settle interest under the old totals. A borrow must satisfy both vault liquidity and a post-borrow utilization limit, and the resulting account must remain sufficiently collateralized under a checked oracle. DeepBook Margin enforces available cash and maximum utilization in the pool ([borrow checks](https://github.com/MystenLabs/deepbookv3/blob/1c0b5555bb333010abf63aa6e1ce437653f26795/packages/deepbook_margin/sources/margin_pool.move#L609-L629)), then values assets against debt shares and rejects a post-borrow account below the configured risk ratio ([risk calculation](https://github.com/MystenLabs/deepbookv3/blob/1c0b5555bb333010abf63aa6e1ce437653f26795/packages/deepbook_margin/sources/margin_manager.move#L1069-L1096), [post-borrow gate](https://github.com/MystenLabs/deepbookv3/blob/1c0b5555bb333010abf63aa6e1ce437653f26795/packages/deepbook_margin/sources/margin_manager.move#L2119-L2159)).

Liquidation must state who absorbs a shortfall. It must not erase collateral while leaving silent debt or report debt as repaid without receiving value. DeepBook's liquidation distinguishes recoverable debt, rewards, and pool default; when collateral is exhausted it clears the corresponding borrow shares and records the shortfall by reducing supplier assets ([liquidation accounting](https://github.com/MystenLabs/deepbookv3/blob/1c0b5555bb333010abf63aa6e1ce437653f26795/packages/deepbook_margin/sources/margin_manager.move#L2233-L2289), [pool default application](https://github.com/MystenLabs/deepbookv3/blob/1c0b5555bb333010abf63aa6e1ce437653f26795/packages/deepbook_margin/sources/margin_pool.move#L644-L664)). Whether a different protocol uses reserves, socialized loss, insurance, or frozen claims is a product decision, but the loss must be explicit and conserved.

## Rounding, dust, and boundary policy

Every conversion specifies its rounding beneficiary:

- minting claims or paying rewards rounds down;
- burning shares for an exact asset withdrawal and creating debt rounds up;
- collateral value rounds down and debt value rounds up;
- a nonzero deposit that would mint zero shares aborts;
- a nonzero repayment that would burn zero debt shares aborts or uses an explicit full-close rule;
- closure assigns dust to a named party or reserve and leaves no unowned liability.

Use checked wide intermediates and multiplication before division. Sui staking widens `u64` multiplication to `u128` ([`mul_div`](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-system/sources/staking_pool.move#L675-L677)); Aptos pool math defines an explicit empty-pool rate, scales shares for precision, and multiplies before dividing for both mint and redemption ([Aptos share conversions](https://github.com/aptos-labs/aptos-core/blob/0dfe6f57be955b77180fc799bbfdb8758ab8dfee/aptos-move/framework/aptos-stdlib/sources/pool_u64_unbound.move#L203-L242)). Precision reduces error; it does not replace a dust policy.

Test amounts around every quotient boundary: zero, one unit, one less and one more than a share, maximum supported supply and time horizon, full withdrawal, all-but-one share, repeated tiny claims, and long alternating deposit/withdraw or borrow/repay sequences. Assert conservation after every step and bound cumulative rounding gain available to any caller.

## Sui-specific review gate

For every public DeFi transition, require affirmative answers to these questions:

1. Does it remain safe when called repeatedly and composed with arbitrary public Move calls in one PTB using temporary capital?
2. Does it settle the old reward, interest, fee, and exchange-rate interval before changing eligible balances or parameters?
3. Are zero supply, first deposit, final withdrawal, one-sided dust, and zero-share results explicitly handled?
4. Are oracle identity, freshness, confidence, deviation, units, and conservative direction checked before value leaves custody?
5. Does the final state satisfy a written asset, share, debt, reward, and fee conservation equation?
6. Are every capability-to-object, receipt-to-origin, pool-to-position, and type-origin relationship checked? Sui warns that anyone can submit a transaction using a shared object and that privileged functions must enforce their own authorization ([shared-object and relationship checks](https://docs.sui.io/develop/security/best-practices#access-control)).
7. Can withdrawal, repayment, liquidation, or emergency settlement complete without an unbounded scan and without depending on an optional reward source?

Reject a design that answers these only with atomic rollback, Move's type safety, assumed honest ordering, lack of an advertised flash-loan endpoint, or the current absence of large capital. Those properties do not establish the economic invariant.
