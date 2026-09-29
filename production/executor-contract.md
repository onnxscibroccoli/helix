# PostgreSQL Helix executor contract

The PostgreSQL task lifecycle remains PENDING -> RUNNING -> COMPLETED | FAILED.

The task `idempotency_key` is the durable executor operation identity and is passed to the guest agent as `operation_key`.

Cancellation is durable control-plane metadata, not a lifecycle state. Requests and acknowledgements are audited. A cancellation acknowledgement means the executor accepted signal delivery, not that an external side effect is absent.

If completion races an unacknowledged cancellation request, the control plane records FAILED/CANCELLATION_UNCONFIRMED and requires reconciliation.

Stale worker leases remain recoverable. A recovered task with a durable cancellation request is never dispatched again.

The system does not claim universal exactly-once external side effects.
