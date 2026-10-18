"""One-time backfill for specs/features/034-donation-kinds-and-quantity —
renames meals/packet_count/total_meals to quantity/total_quantity and sets
kind="Food Packets" on every pre-existing record, plus seeds the starter
kinds and the config item's kind_totals breakdown.

Run manually, once per environment, AFTER deploying this feature's code
(the new kind/quantity fields must exist in the model before old items
need to satisfy them) and BEFORE any new submission gets approved under
the new code (approve_submission expects config.kind_totals to already
exist as a map — see dynamo_store.py's SET ... if_not_exists comment).

Idempotent — skips items that already look migrated, so it's safe to
re-run if interrupted partway.

Defaults to a dry run (prints what it would do, writes nothing). Pass
--apply to actually write. Needs the same AWS credentials/region and the
same *_TABLE env vars the deployed Lambda uses — run it against dev
first, verify, then prod:

    AWS_PROFILE=... \
    USERS_TABLE=mmc-dev-users DONORS_TABLE=mmc-dev-donors \
    DONATIONS_TABLE=mmc-dev-donations SUBMISSIONS_TABLE=mmc-dev-submissions \
    DONATION_EVENTS_TABLE=mmc-dev-donation-events CONFIG_TABLE=mmc-dev-config \
    DONATION_KINDS_TABLE=mmc-dev-donation-kinds \
    uv run python scripts/backfill_donation_kind.py --apply
"""

import argparse
import os

import boto3

STARTER_KINDS = [
    "Food Packets",
    "Education Supplies",
    "Clothing",
    "Medicine",
    "Ambulance / Transport",
]


def _table(resource, env_var: str):
    return resource.Table(os.environ[env_var])


def seed_starter_kinds(donation_kinds_table, apply: bool) -> None:
    for kind in STARTER_KINDS:
        print(f"  seed kind: {kind!r}")
        if apply:
            donation_kinds_table.put_item(Item={"kind": kind})


def migrate_donations(table, apply: bool) -> int:
    migrated = 0
    for item in table.scan().get("Items", []):
        if "quantity" in item:
            continue
        print(
            f"  donation {item['donor_id']}/{item['donation_id']}: "
            f"meals={item.get('meals')} -> kind=Food Packets, quantity={item.get('meals')}"
        )
        if apply:
            table.update_item(
                Key={"donor_id": item["donor_id"], "donation_id": item["donation_id"]},
                UpdateExpression="SET kind = :kind, quantity = meals REMOVE meals",
                ExpressionAttributeValues={":kind": "Food Packets"},
            )
        migrated += 1
    return migrated


def migrate_submissions(table, apply: bool) -> int:
    migrated = 0
    for item in table.scan().get("Items", []):
        if "quantity" in item:
            continue
        print(
            f"  submission {item['submission_id']}: "
            f"meals={item.get('meals')} -> kind=Food Packets, quantity={item.get('meals')}"
        )
        if apply:
            table.update_item(
                Key={"submission_id": item["submission_id"]},
                UpdateExpression="SET kind = :kind, quantity = meals REMOVE meals",
                ExpressionAttributeValues={":kind": "Food Packets"},
            )
        migrated += 1
    return migrated


def migrate_donation_events(table, apply: bool) -> int:
    """Unlike donations/submissions, packet_count was always optional on a
    donation event — only rename it where it was actually set; an event
    that never specified a quantity stays kind-less, not falsely
    backfilled to "Food Packets" with a quantity of None."""
    migrated = 0
    for item in table.scan().get("Items", []):
        if "quantity" in item or "packet_count" not in item:
            continue
        print(
            f"  donation_event {item['event_id']}: "
            f"packet_count={item['packet_count']} -> kind=Food Packets, "
            f"quantity={item['packet_count']}"
        )
        if apply:
            table.update_item(
                Key={"event_id": item["event_id"]},
                UpdateExpression=(
                    "SET kind = :kind, quantity = packet_count REMOVE packet_count"
                ),
                ExpressionAttributeValues={":kind": "Food Packets"},
            )
        migrated += 1
    return migrated


def migrate_donors(table, apply: bool) -> int:
    migrated = 0
    for item in table.scan().get("Items", []):
        if "total_quantity" in item:
            continue
        total = item.get("total_meals", 0)
        print(f"  donor {item['donor_id']}: total_meals={total} -> total_quantity={total}")
        if apply:
            table.update_item(
                Key={"donor_id": item["donor_id"]},
                UpdateExpression="SET total_quantity = total_meals REMOVE total_meals",
            )
        migrated += 1
    return migrated


def migrate_config(table, apply: bool) -> int:
    resp = table.get_item(Key={"pk": "site"})
    item = resp.get("Item")
    if not item or "total_quantity" in item:
        return 0
    total = item.get("total_meals", 0)
    print(
        f"  config: total_meals={total} -> total_quantity={total}, "
        f"kind_totals={{'Food Packets': {total}}}"
    )
    if apply:
        table.update_item(
            Key={"pk": "site"},
            UpdateExpression=(
                "SET total_quantity = total_meals, kind_totals = :kt REMOVE total_meals"
            ),
            ExpressionAttributeValues={":kt": {"Food Packets": total}},
        )
    return 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Actually write changes (default: dry run)."
    )
    args = parser.parse_args()
    apply = args.apply

    resource = boto3.resource("dynamodb")
    donations = _table(resource, "DONATIONS_TABLE")
    submissions = _table(resource, "SUBMISSIONS_TABLE")
    donation_events = _table(resource, "DONATION_EVENTS_TABLE")
    donors = _table(resource, "DONORS_TABLE")
    config = _table(resource, "CONFIG_TABLE")
    donation_kinds = _table(resource, "DONATION_KINDS_TABLE")

    mode = "APPLYING" if apply else "DRY RUN (pass --apply to write)"
    print(f"=== {mode} ===\n")

    print("Seeding starter kinds:")
    seed_starter_kinds(donation_kinds, apply)

    print("\nMigrating donations:")
    n_donations = migrate_donations(donations, apply)

    print("\nMigrating submissions:")
    n_submissions = migrate_submissions(submissions, apply)

    print("\nMigrating donation_events:")
    n_events = migrate_donation_events(donation_events, apply)

    print("\nMigrating donors:")
    n_donors = migrate_donors(donors, apply)

    print("\nMigrating config:")
    n_config = migrate_config(config, apply)

    print(
        f"\n=== Done. donations={n_donations} submissions={n_submissions} "
        f"donation_events={n_events} donors={n_donors} config={n_config} ==="
    )
    if not apply:
        print("This was a dry run — nothing was written. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
