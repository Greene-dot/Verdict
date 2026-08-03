;; market-pool.clar
;; Holds stakes for a single market and pays out the winning side.
;; This is a starting point, not an audited contract. Get a real
;; security review before any mainnet deploy.

(define-constant ERR-MARKET-CLOSED (err u100))
(define-constant ERR-ALREADY-RESOLVED (err u101))
(define-constant ERR-NOT-RESOLVER (err u102))
(define-constant ERR-NOT-RESOLVED (err u103))
(define-constant ERR-NO-STAKE (err u104))
(define-constant ERR-WRONG-SIDE (err u105))

;; Swap this for your real resolver address, or a small multisig,
;; before deploying anywhere real funds can reach.
(define-constant RESOLVER tx-sender)

(define-data-var closes-at uint u0)
(define-data-var resolved bool false)
(define-data-var outcome (optional bool) none) ;; true = yes, false = no

(define-data-var yes-pool uint u0)
(define-data-var no-pool uint u0)

;; side: true = yes, false = no
(define-map stakes { bettor: principal, side: bool } { amount: uint })
(define-map claimed { bettor: principal } { done: bool })

(define-public (set-close-height (height uint))
  (begin
    (asserts! (is-eq tx-sender RESOLVER) ERR-NOT-RESOLVER)
    (var-set closes-at height)
    (ok true)
  )
)

(define-public (place-bet (side bool) (amount uint))
  (begin
    (asserts! (< block-height (var-get closes-at)) ERR-MARKET-CLOSED)
    (asserts! (not (var-get resolved)) ERR-ALREADY-RESOLVED)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (let ((existing (default-to { amount: u0 } (map-get? stakes { bettor: tx-sender, side: side }))))
      (map-set stakes { bettor: tx-sender, side: side } { amount: (+ (get amount existing) amount) })
    )
    (if side
      (var-set yes-pool (+ (var-get yes-pool) amount))
      (var-set no-pool (+ (var-get no-pool) amount))
    )
    (ok true)
  )
)

(define-public (resolve (final-outcome bool))
  (begin
    (asserts! (is-eq tx-sender RESOLVER) ERR-NOT-RESOLVER)
    (asserts! (not (var-get resolved)) ERR-ALREADY-RESOLVED)
    (var-set resolved true)
    (var-set outcome (some final-outcome))
    (ok true)
  )
)

;; Winning side splits the total pool proportional to their stake.
;; A small fee could be carved out here before the payout, left at
;; zero in this starting version.
(define-public (claim)
  (begin
    (asserts! (var-get resolved) ERR-NOT-RESOLVED)
    (asserts! (is-none (map-get? claimed { bettor: tx-sender })) ERR-NO-STAKE)
    (let (
        (winning-side (unwrap-panic (var-get outcome)))
        (my-stake (default-to { amount: u0 } (map-get? stakes { bettor: tx-sender, side: winning-side })))
        (winning-pool (if winning-side (var-get yes-pool) (var-get no-pool)))
        (total-pool (+ (var-get yes-pool) (var-get no-pool)))
      )
      (asserts! (> (get amount my-stake) u0) ERR-NO-STAKE)
      (let ((payout (/ (* (get amount my-stake) total-pool) winning-pool)))
        (map-set claimed { bettor: tx-sender } { done: true })
        (try! (as-contract (stx-transfer? payout tx-sender tx-sender)))
        (ok payout)
      )
    )
  )
)

(define-read-only (get-pools)
  (ok { yes: (var-get yes-pool), no: (var-get no-pool) })
)

(define-read-only (get-outcome)
  (ok (var-get outcome))
)
