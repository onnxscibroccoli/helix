# PostgreSQL Helix executor contract

The production task control plane remains PostgreSQL-backed and preserves the lifecycle:

PENDING -> RUNNING -> COMPLETED | FAILED

## Durable operation identity

The task idempotency_key is the durable executor operation identity.

The gateway sends that identity to the Kali agent bridge as operation_key. The bridge rejects a second active operation with the same key.

Task creation remains idempotent at the PostgreSQL boundary. This does not by itself establish exactly-once external side effects.

## Cancellation

Cancellation is a durable control-plane request, not a state transition.

The task records:

- cancel_requested_at
- cancel_requested_by
- cancel_acknowledged_at
- cancel_reconciliation_deadline

Cancellation requests and acknowledgements are also written to omnikali_task_events.

A running Kali task can be cancelled through POST /api/v1/tasks/{task_id}/cancel. The gateway persists the request before asking the agent bridge to deliver SIGTERM to the active guest operation.

## Cancellation acknowledgement

An acknowledgement means the executor accepted delivery of the cancellation signal. It does not mean that the external side effect has been proven absent.

The agent returns canceled=true when the guest process exits with SIGTERM. The worker records the acknowledgement before allowing a normal completion to be reported.

If a completion races with an unacknowledged cancellation request, PostgreSQL records FAILED with CANCELLATION_UNCONFIRMED. The result requires executor-side reconciliation before any external-side-effect claim is made.

## Recovery semantics

A stale worker lease can still be reclaimed by the existing PostgreSQL lease mechanism.

A recovered task with a durable cancellation request is never dispatched again. It is failed with CANCELLATION_REQUESTED.

A bridge restart can lose its process-local active-operation map. The durable cancellation request therefore remains authoritative, and the reconciliation deadline identifies the bounded period in which the executor must establish the external outcome.

## Exactly-once boundary

The control plane does not claim universal exactly-once side effects.

Commands whose external effects are safely repeatable may be retried according to their executor policy.

Generic non-idempotent commands require executor-side durable idempotency, cancellation fencing, or an explicit indeterminate/reconciliation outcome before recovery can dispatch them again.
