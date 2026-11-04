;; Test-only SIP-010 token. Not for production.
(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token usdcx)

(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-NOT-TOKEN-OWNER (err u101))

(define-data-var contract-owner principal tx-sender)

(define-public (transfer
  (amount uint)
  (sender principal)
  (recipient principal)
  (memo (optional (buff 34)))
)
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-TOKEN-OWNER)
    (try! (ft-transfer? usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (ft-mint? usdcx amount recipient)
  )
)

(define-read-only (get-name) (ok "Mock USDCx"))
(define-read-only (get-symbol) (ok "USDCx"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance usdcx who)))
(define-read-only (get-total-supply) (ok (ft-get-supply usdcx)))
(define-read-only (get-token-uri) (ok none))
