;; MileStack v1 escrow.
;; Source of truth for project funds, milestones, contributors, payments, refunds.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant STATUS-PENDING u0)
(define-constant STATUS-PAID u1)
(define-constant STATUS-CANCELLED u2)

(define-constant ERR-EMPTY-SCHEDULE (err u2101))
(define-constant ERR-INVALID-AMOUNT (err u2102))
(define-constant ERR-SELF-PAY (err u2103))
(define-constant ERR-TRANSFER-FAILED (err u2104))
(define-constant ERR-NOT-FOUND (err u2106))
(define-constant ERR-NOT-CLIENT (err u2107))
(define-constant ERR-CANCELLED (err u2108))
(define-constant ERR-WRONG-TOKEN (err u2109))
(define-constant ERR-NOT-PENDING (err u2110))
(define-constant ERR-INSUFFICIENT-REMAINING (err u2111))

(define-data-var next-id uint u1)

(define-map projects
  uint
  {
    client: principal,
    token: principal,
    total: uint,
    remaining: uint,
    milestone-count: uint,
    cancelled: bool,
    created-at-block: uint
  }
)

(define-map milestones
  { id: uint, index: uint }
  {
    contributor: principal,
    amount: uint,
    status: uint
  }
)

(define-constant INDEX-RANGE
  (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19)
)

(define-private (validate-entry
  (entry { contributor: principal, amount: uint })
  (acc { ok-amount: bool, ok-self: bool, total: uint, client: principal })
)
  {
    ok-amount: (and (get ok-amount acc) (> (get amount entry) u0)),
    ok-self: (and (get ok-self acc) (not (is-eq (get contributor entry) (get client acc)))),
    total: (+ (get total acc) (get amount entry)),
    client: (get client acc)
  }
)

(define-private (write-entry
  (entry { contributor: principal, amount: uint })
  (acc { id: uint, index: uint })
)
  (begin
    (map-set milestones { id: (get id acc), index: (get index acc) }
      {
        contributor: (get contributor entry),
        amount: (get amount entry),
        status: STATUS-PENDING
      }
    )
    { id: (get id acc), index: (+ (get index acc) u1) }
  )
)

(define-private (cancel-if-pending (index uint) (id uint))
  (match (map-get? milestones { id: id, index: index })
    row
      (begin
        (if (is-eq (get status row) STATUS-PENDING)
          (map-set milestones { id: id, index: index }
            (merge row { status: STATUS-CANCELLED })
          )
          true
        )
        id
      )
    id
  )
)

(define-public (create-and-fund
  (token <sip-010-trait>)
  (entries (list 20 { contributor: principal, amount: uint }))
)
  (let (
      (client tx-sender)
      (count (len entries))
      (checked
        (fold validate-entry entries {
          ok-amount: true,
          ok-self: true,
          total: u0,
          client: client
        })
      )
      (total (get total checked))
      (id (var-get next-id))
      (escrow (as-contract tx-sender))
    )
    (asserts! (> count u0) ERR-EMPTY-SCHEDULE)
    (asserts! (get ok-amount checked) ERR-INVALID-AMOUNT)
    (asserts! (get ok-self checked) ERR-SELF-PAY)
    (unwrap! (contract-call? token transfer total client escrow none) ERR-TRANSFER-FAILED)
    (map-set projects id {
      client: client,
      token: (contract-of token),
      total: total,
      remaining: total,
      milestone-count: count,
      cancelled: false,
      created-at-block: block-height
    })
    (fold write-entry entries { id: id, index: u0 })
    (var-set next-id (+ id u1))
    (print {
      event: "created-and-funded",
      id: id,
      client: client,
      total: total,
      milestone-count: count
    })
    (ok id)
  )
)

(define-public (approve-and-pay
  (id uint)
  (index uint)
  (token <sip-010-trait>)
)
  (let (
      (project (unwrap! (map-get? projects id) ERR-NOT-FOUND))
      (row (unwrap! (map-get? milestones { id: id, index: index }) ERR-NOT-FOUND))
      (amount (get amount row))
      (contributor (get contributor row))
    )
    (asserts! (is-eq tx-sender (get client project)) ERR-NOT-CLIENT)
    (asserts! (not (get cancelled project)) ERR-CANCELLED)
    (asserts! (is-eq (contract-of token) (get token project)) ERR-WRONG-TOKEN)
    (asserts! (is-eq (get status row) STATUS-PENDING) ERR-NOT-PENDING)
    (asserts! (<= amount (get remaining project)) ERR-INSUFFICIENT-REMAINING)
    (unwrap!
      (as-contract (contract-call? token transfer amount tx-sender contributor none))
      ERR-TRANSFER-FAILED
    )
    (map-set milestones { id: id, index: index }
      (merge row { status: STATUS-PAID })
    )
    (map-set projects id
      (merge project { remaining: (- (get remaining project) amount) })
    )
    (print {
      event: "paid",
      id: id,
      index: index,
      contributor: contributor,
      amount: amount
    })
    (ok true)
  )
)

(define-public (cancel-remaining
  (id uint)
  (token <sip-010-trait>)
)
  (let (
      (project (unwrap! (map-get? projects id) ERR-NOT-FOUND))
      (refund (get remaining project))
      (client (get client project))
    )
    (asserts! (is-eq tx-sender client) ERR-NOT-CLIENT)
    (asserts! (not (get cancelled project)) ERR-CANCELLED)
    (asserts! (is-eq (contract-of token) (get token project)) ERR-WRONG-TOKEN)
    (if (> refund u0)
      (unwrap!
        (as-contract (contract-call? token transfer refund tx-sender client none))
        ERR-TRANSFER-FAILED
      )
      true
    )
    (fold cancel-if-pending INDEX-RANGE id)
    (map-set projects id
      (merge project {
        remaining: u0,
        cancelled: true
      })
    )
    (print {
      event: "cancelled",
      id: id,
      refunded: refund
    })
    (ok refund)
  )
)

(define-read-only (get-project (id uint))
  (map-get? projects id)
)

(define-read-only (get-milestone (id uint) (index uint))
  (map-get? milestones { id: id, index: index })
)

(define-read-only (get-next-id)
  (var-get next-id)
)
