"""One-time backfill for the donation-photo CDN fix (see
specs/infra/design.md "modules/photos details", 2026-10-19 update) —
donation_events previously had photo_urls/cover_photo_url baked in as
literal strings at approval time, computed from whatever
PHOTOS_PUBLIC_BASE_URL happened to be set to back then. Events approved
before that env var existed got a bare "/approved/..." string (not
routable through the photos CloudFront behavior at all); events approved
after got "/photos/approved/..." (broken until the CloudFront Function
fix). Either way, the stored string is stale forever once baked.

This script derives the real S3 key from whichever stale string is
already stored (strip a leading "/photos" if present, then the leading
"/"), writes it as photo_keys/cover_photo_key, and removes the baked
strings — moving every donation_event onto the same "compute the URL
fresh on every read" path Donor.donations already uses, so this class of
bug can't recur.

Idempotent — skips items that already have photo_keys. Defaults to a dry
run; pass --apply to write. Needs DONATION_EVENTS_TABLE and the same AWS
credentials/region as the other backfill scripts:

    DONATION_EVENTS_TABLE=mmc-prod-donation-events \
    uv run python scripts/backfill_donation_event_photo_keys.py --apply
"""

import argparse
import os
import re

import boto3


def _derive_key(stale_url: str) -> str:
    return re.sub(r"^/photos", "", stale_url).lstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Actually write changes (default: dry run)."
    )
    args = parser.parse_args()
    apply = args.apply

    resource = boto3.resource("dynamodb")
    table = resource.Table(os.environ["DONATION_EVENTS_TABLE"])

    mode = "APPLYING" if apply else "DRY RUN (pass --apply to write)"
    print(f"=== {mode} ===\n")

    migrated = 0
    for item in table.scan().get("Items", []):
        if "photo_keys" in item or "cover_photo_url" not in item:
            continue

        cover_photo_key = _derive_key(item["cover_photo_url"])
        photo_keys = [_derive_key(u) for u in item.get("photo_urls", [])] or [
            cover_photo_key
        ]

        print(
            f"  event {item['event_id']}: "
            f"cover_photo_url={item['cover_photo_url']!r} -> cover_photo_key={cover_photo_key!r}, "
            f"photo_keys={photo_keys!r}"
        )
        if apply:
            table.update_item(
                Key={"event_id": item["event_id"]},
                UpdateExpression=(
                    "SET photo_keys = :keys, cover_photo_key = :cover_key "
                    "REMOVE photo_urls, cover_photo_url"
                ),
                ExpressionAttributeValues={
                    ":keys": photo_keys,
                    ":cover_key": cover_photo_key,
                },
            )
        migrated += 1

    print(f"\n=== Done. donation_events={migrated} ===")
    if not apply:
        print("This was a dry run — nothing was written. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
